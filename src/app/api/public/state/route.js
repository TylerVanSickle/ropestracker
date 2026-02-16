import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getSiteIdOrThrow } from "@/app/lib/ropesSite";

export const runtime = "nodejs";

function sanitizeEntry(e) {
  return {
    id: e.id,
    name: String(e.name || "Guest").slice(0, 50),
    partySize: Math.max(1, Number(e.party_size || 1)),
    status: String(e.status || "").toUpperCase(),
    coursePhase: e.course_phase ?? null,
    queueOrder: typeof e.queue_order === "number" ? e.queue_order : null,
    assignedTag: e.assigned_tag ?? null,
    startTime: e.start_time ?? null,
    endTime: e.end_time ?? null,
    sentUpAt: e.sent_up_at ?? null,
  };
}

export async function GET() {
  try {
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

    // guest-safe settings subset
    const safeSettings = settings
      ? {
          paused: Boolean(settings.paused),
          venueName: String(
            settings.venue_name || "Ropes Course Waitlist",
          ).slice(0, 60),
          clientTheme: settings.client_theme || "auto",
          totalLines: settings.total_lines ?? 15,
          durationMin: settings.duration_min ?? 45,
        }
      : null;

    return NextResponse.json({
      ok: true,
      settings: safeSettings,
      entries: (entries || []).map(sanitizeEntry),
      updatedAt: settings?.updated_at ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load public state." },
      { status: 500 },
    );
  }
}
