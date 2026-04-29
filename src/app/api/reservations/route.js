// src/app/api/reservations/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getSiteIdOrThrow } from "@/app/lib/ropesSite";
import { requireStaffOrThrow } from "@/app/lib/requireStaff";

export const runtime = "nodejs";

const VALID_STATUSES = new Set([
  "PENDING",
  "CHECKED_IN",
  "CANCELLED",
  "NO_SHOW",
  "COMPLETED",
]);

const SELECT_COLS =
  "id, site_id, name, phone, party_size, notes, reserved_at, duration_min, event_type, status, linked_entry_id, created_by, created_at, updated_at";

function clean(s, max = 200) {
  return String(s ?? "").trim().slice(0, max);
}

function clampPartySize(n) {
  const v = Math.floor(Number(n) || 1);
  return Math.max(1, Math.min(20, v));
}

// GET /api/reservations?from=ISO&to=ISO&status=X&eventType=Y
export async function GET(req) {
  try {
    await requireStaffOrThrow();
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    const eventType = searchParams.get("eventType");

    let q = sb
      .from("ropes_reservations")
      .select(SELECT_COLS)
      .eq("site_id", siteId)
      .order("reserved_at", { ascending: true })
      .limit(500);

    if (from) q = q.gte("reserved_at", from);
    if (to) q = q.lte("reserved_at", to);
    if (status) q = q.eq("status", status);
    if (eventType) q = q.eq("event_type", eventType);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ ok: true, reservations: data || [] });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load reservations" },
      { status: err?.status || 500 },
    );
  }
}

// POST /api/reservations  (create)
export async function POST(req) {
  try {
    await requireStaffOrThrow();
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "Missing body" },
        { status: 400 },
      );
    }

    const name = clean(body.name, 80);
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Name is required" },
        { status: 400 },
      );
    }

    const reservedAt = body.reserved_at || body.reservedAt;
    if (!reservedAt || isNaN(new Date(reservedAt).getTime())) {
      return NextResponse.json(
        { ok: false, error: "Valid reserved_at required" },
        { status: 400 },
      );
    }

    const row = {
      site_id: siteId,
      name,
      phone: body.phone ? clean(body.phone, 30) : null,
      party_size: clampPartySize(body.party_size ?? body.partySize ?? 1),
      notes: body.notes ? clean(body.notes, 500) : null,
      reserved_at: new Date(reservedAt).toISOString(),
      duration_min: Number.isFinite(Number(body.duration_min ?? body.durationMin))
        ? Math.max(15, Math.min(480, Number(body.duration_min ?? body.durationMin)))
        : 60,
      event_type: clean(body.event_type ?? body.eventType ?? "general", 30) || "general",
      status: "PENDING",
      created_by: clean(body.created_by ?? body.createdBy ?? "staff", 20) || "staff",
    };

    const { data, error } = await sb
      .from("ropes_reservations")
      .insert(row)
      .select(SELECT_COLS)
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, reservation: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to create reservation" },
      { status: err?.status || 500 },
    );
  }
}

// PATCH /api/reservations  (update)
export async function PATCH(req) {
  try {
    await requireStaffOrThrow();
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const body = await req.json().catch(() => null);
    if (!body?.id) {
      return NextResponse.json(
        { ok: false, error: "Missing id" },
        { status: 400 },
      );
    }

    const patch = {};
    if (body.name !== undefined) patch.name = clean(body.name, 80);
    if (body.phone !== undefined) {
      patch.phone = body.phone ? clean(body.phone, 30) : null;
    }
    if (body.party_size !== undefined || body.partySize !== undefined) {
      patch.party_size = clampPartySize(body.party_size ?? body.partySize);
    }
    if (body.notes !== undefined) {
      patch.notes = body.notes ? clean(body.notes, 500) : null;
    }
    if (body.reserved_at !== undefined || body.reservedAt !== undefined) {
      const v = body.reserved_at ?? body.reservedAt;
      if (v && !isNaN(new Date(v).getTime())) {
        patch.reserved_at = new Date(v).toISOString();
      }
    }
    if (body.duration_min !== undefined || body.durationMin !== undefined) {
      const v = Number(body.duration_min ?? body.durationMin);
      if (Number.isFinite(v)) {
        patch.duration_min = Math.max(15, Math.min(480, v));
      }
    }
    if (body.event_type !== undefined || body.eventType !== undefined) {
      const v = clean(body.event_type ?? body.eventType, 30);
      if (v) patch.event_type = v;
    }
    if (body.status !== undefined) {
      const v = String(body.status).toUpperCase();
      if (!VALID_STATUSES.has(v)) {
        return NextResponse.json(
          { ok: false, error: `Invalid status: ${v}` },
          { status: 400 },
        );
      }
      patch.status = v;
    }
    if (body.linked_entry_id !== undefined || body.linkedEntryId !== undefined) {
      const v = body.linked_entry_id ?? body.linkedEntryId;
      patch.linked_entry_id = v || null;
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await sb
      .from("ropes_reservations")
      .update(patch)
      .eq("site_id", siteId)
      .eq("id", body.id)
      .select(SELECT_COLS)
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, reservation: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to update reservation" },
      { status: err?.status || 500 },
    );
  }
}

// DELETE /api/reservations?id=X
export async function DELETE(req) {
  try {
    await requireStaffOrThrow();
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing id" },
        { status: 400 },
      );
    }

    const { error } = await sb
      .from("ropes_reservations")
      .delete()
      .eq("site_id", siteId)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to delete reservation" },
      { status: err?.status || 500 },
    );
  }
}
