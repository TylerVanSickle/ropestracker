// src/app/api/state/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getSiteIdOrThrow } from "@/app/lib/ropesSite";
import { requireStaffOrThrow } from "@/app/lib/requireStaff";

export const runtime = "nodejs";

const isUuid = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || ""),
  );

export async function GET() {
  try {
    await requireStaffOrThrow();

    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const [{ data: settings, error: se }, { data: entries, error: ee }] =
      await Promise.all([
        sb.from("ropes_settings").select("*").eq("site_id", siteId).single(),
        sb
          .from("ropes_entries_live")
          .select("*")
          .eq("site_id", siteId)
          .order("queue_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

    if (se) throw se;
    if (ee) throw ee;

    return NextResponse.json({ ok: true, settings, entries });
  } catch (err) {
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load state." },
      { status },
    );
  }
}

/**
 * PUT supports modes:
 * 1) { settingsPatch: {...} }              -> patch settings
 * 2) { op: "...", payload: {...} }        -> entry operations
 */
export async function PUT(req) {
  try {
    await requireStaffOrThrow();

    const body = await req.json();
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    // ---- Settings patch ----
    if (body?.settingsPatch && typeof body.settingsPatch === "object") {
      const patch = body.settingsPatch;

      const { error } = await sb
        .from("ropes_settings")
        .update(patch)
        .eq("site_id", siteId);

      if (error) throw error;

      return NextResponse.json({ ok: true });
    }

    // ---- Entry operations ----
    const op = String(body?.op || "").toUpperCase();
    const payload = body?.payload || {};

    if (!op) {
      return NextResponse.json(
        { ok: false, error: "Missing op or settingsPatch." },
        { status: 400 },
      );
    }

    // Create entry
    if (op === "CREATE_ENTRY") {
      const row = {
        // ✅ only include id if it's a real uuid, otherwise let DB generate
        ...(isUuid(payload?.id) ? { id: payload.id } : {}),
        site_id: siteId,
        name: payload?.name ?? "Guest",
        party_size: Math.max(1, Number(payload?.party_size || 1)),
        phone: payload?.phone ?? null,
        notes: payload?.notes ?? null,
        status: payload?.status ?? "WAITING",
        course_phase: payload?.course_phase ?? null,
        queue_order: payload?.queue_order ?? null,
        assigned_tag: payload?.assigned_tag ?? null,
        lines_used: payload?.lines_used ?? null,
        created_at: payload?.created_at ?? undefined,
      };

      const { data, error } = await sb
        .from("ropes_entries_live")
        .insert(row)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, entry: data });
    }

    // Patch entry
    if (op === "PATCH_ENTRY") {
      const id = payload?.id;
      const patch = payload?.patch || {};
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Missing entry id." },
          { status: 400 },
        );
      }

      const { data, error } = await sb
        .from("ropes_entries_live")
        .update(patch)
        .eq("site_id", siteId)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, entry: data });
    }

    // Delete entry
    if (op === "DELETE_ENTRY") {
      const id = payload?.id;
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Missing entry id." },
          { status: 400 },
        );
      }

      const { error } = await sb
        .from("ropes_entries_live")
        .delete()
        .eq("site_id", siteId)
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    /**
     * Move one entry to history (DONE / ARCHIVED)
     */
    if (op === "MOVE_TO_HISTORY") {
      const id = payload?.id;
      const status = String(payload?.status || "DONE").toUpperCase();
      const finishReason = payload?.finish_reason
        ? String(payload.finish_reason)
        : null;

      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Missing entry id." },
          { status: 400 },
        );
      }

      const { data: live, error: le } = await sb
        .from("ropes_entries_live")
        .select("*")
        .eq("site_id", siteId)
        .eq("id", id)
        .single();

      if (le) throw le;
      if (!live) {
        return NextResponse.json(
          { ok: false, error: "Entry not found." },
          { status: 404 },
        );
      }

      const historyRow = {
        site_id: siteId,
        live_entry_id: live.id,
        name: live.name,
        party_size: live.party_size,
        phone: live.phone,
        notes: live.notes,
        status,
        course_phase: live.course_phase,
        queue_order: live.queue_order,
        assigned_tag: live.assigned_tag,
        lines_used: live.lines_used,
        time_adjust_min: live.time_adjust_min,
        created_at: live.created_at,
        sent_up_at: live.sent_up_at,
        started_at: live.started_at,
        start_time: live.start_time,
        end_time: live.end_time,
        ended_early_at: live.ended_early_at,
        finish_reason: finishReason,
      };

      const { error: he } = await sb
        .from("ropes_entries_history")
        .insert(historyRow);
      if (he) throw he;

      const { error: de } = await sb
        .from("ropes_entries_live")
        .delete()
        .eq("site_id", siteId)
        .eq("id", id);

      if (de) throw de;

      return NextResponse.json({ ok: true });
    }

    /**
     * ✅ Clear the entire live list -> move everything to history -> then delete live.
     */
    if (op === "CLEAR_ALL_TO_HISTORY") {
      const finishReason = String(
        payload?.finish_reason || "Cleared list",
      ).slice(0, 200);
      const status = String(payload?.status || "ARCHIVED").toUpperCase();

      const { data: liveRows, error: le } = await sb
        .from("ropes_entries_live")
        .select("*")
        .eq("site_id", siteId);

      if (le) throw le;

      const rows = Array.isArray(liveRows) ? liveRows : [];
      if (!rows.length) {
        return NextResponse.json({ ok: true, moved: 0 });
      }

      const historyRows = rows.map((live) => ({
        site_id: siteId,
        live_entry_id: live.id,
        name: live.name,
        party_size: live.party_size,
        phone: live.phone,
        notes: live.notes,
        status,
        course_phase: live.course_phase,
        queue_order: live.queue_order,
        assigned_tag: live.assigned_tag,
        lines_used: live.lines_used,
        time_adjust_min: live.time_adjust_min,
        created_at: live.created_at,
        sent_up_at: live.sent_up_at,
        started_at: live.started_at,
        start_time: live.start_time,
        end_time: live.end_time,
        ended_early_at: live.ended_early_at,
        finish_reason: finishReason,
      }));

      const { error: he } = await sb
        .from("ropes_entries_history")
        .insert(historyRows);

      if (he) throw he;

      const { error: de } = await sb
        .from("ropes_entries_live")
        .delete()
        .eq("site_id", siteId);

      if (de) throw de;

      return NextResponse.json({ ok: true, moved: rows.length });
    }

    /**
     * ✅ Undo last clear (best-effort)
     */
    if (op === "UNDO_LAST_CLEAR") {
      const reason = String(payload?.finish_reason || "Cleared list").slice(
        0,
        200,
      );

      const { data: newest, error: ne } = await sb
        .from("ropes_entries_history")
        .select("*")
        .eq("site_id", siteId)
        .eq("finish_reason", reason)
        .order("created_at", { ascending: false })
        .limit(1);

      if (ne) throw ne;

      const newestRow = Array.isArray(newest) ? newest[0] : null;
      if (!newestRow?.created_at) {
        return NextResponse.json({ ok: true, restored: 0 });
      }

      const batchCreatedAt = newestRow.created_at;

      const { data: batch, error: be } = await sb
        .from("ropes_entries_history")
        .select("*")
        .eq("site_id", siteId)
        .eq("finish_reason", reason)
        .eq("created_at", batchCreatedAt);

      if (be) throw be;

      const batchRows = Array.isArray(batch) ? batch : [];
      if (!batchRows.length) {
        return NextResponse.json({ ok: true, restored: 0 });
      }

      const liveRows = batchRows.map((h) => ({
        site_id: siteId,
        name: h.name ?? "Guest",
        party_size: Math.max(1, Number(h.party_size || 1)),
        phone: h.phone ?? null,
        notes: h.notes ?? null,
        status: "WAITING",
        course_phase: null,
        queue_order: h.queue_order ?? null,
        assigned_tag: h.assigned_tag ?? null,
        lines_used: h.lines_used ?? Math.max(1, Number(h.party_size || 1)),
        time_adjust_min: h.time_adjust_min ?? 0,
        created_at: h.created_at ?? undefined,
        sent_up_at: null,
        started_at: null,
        start_time: null,
        end_time: null,
        ended_early_at: null,
      }));

      const { error: ie } = await sb
        .from("ropes_entries_live")
        .insert(liveRows);
      if (ie) throw ie;

      const { error: de } = await sb
        .from("ropes_entries_history")
        .delete()
        .eq("site_id", siteId)
        .eq("finish_reason", reason)
        .eq("created_at", batchCreatedAt);

      if (de) throw de;

      return NextResponse.json({ ok: true, restored: batchRows.length });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown op: ${op}` },
      { status: 400 },
    );
  } catch (err) {
    console.error("STATE ROUTE ERROR:", err);
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to update state." },
      { status },
    );
  }
}
