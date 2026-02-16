// src/app/api/history.csv/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getSiteIdOrThrow } from "@/app/lib/ropesSite";
import { requireStaffOrThrow } from "@/app/lib/requireStaff";

export const runtime = "nodejs";

function clampDays(v, def = 30) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

function isYmd(s) {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(String(s || ""));
}

function parseYmdToStartIso(ymd) {
  if (!isYmd(ymd)) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function parseYmdToEndIsoExclusive(ymd) {
  if (!isYmd(ymd)) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString();
}

function toMs(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function round1(n) {
  if (!Number.isFinite(n)) return "";
  return Math.round(n * 10) / 10;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  // escape quotes and wrap if needed
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ymdFromIso(iso) {
  const ms = toMs(iso);
  if (!ms) return "";
  const d = new Date(ms);
  // Use local date so it looks normal to staff in Sheets
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hourLabelLocal(iso) {
  const ms = toMs(iso);
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
  });
}

function dayLabelLocal(iso) {
  const ms = toMs(iso);
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, { weekday: "short" });
}

export async function GET(req) {
  try {
    await requireStaffOrThrow();

    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const { searchParams } = new URL(req.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const days = clampDays(searchParams.get("days"), 30);

    const startIso = parseYmdToStartIso(start);
    const endIsoExclusive = parseYmdToEndIsoExclusive(end);

    const rangeStartIso =
      startIso ||
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // If end is provided, use exclusive end; otherwise no upper bound
    const rangeEndIsoExclusive = endIsoExclusive || null;

    // Pull history rows
    let q = sb
      .from("ropes_entries_history")
      .select(
        [
          "id",
          "site_id",
          "live_entry_id",
          "name",
          "party_size",
          "phone",
          "notes",
          "status",
          "course_phase",
          "queue_order",
          "assigned_tag",
          "lines_used",
          "time_adjust_min",
          "created_at",
          "sent_up_at",
          "started_at",
          "start_time",
          "end_time",
          "ended_early_at",
          "finished_at",
          "finish_reason",
        ].join(","),
      )
      .eq("site_id", siteId)
      .gte("finished_at", rangeStartIso)
      .order("finished_at", { ascending: true })
      .limit(50000);

    if (rangeEndIsoExclusive) {
      q = q.lt("finished_at", rangeEndIsoExclusive);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    // Coverage info (for header)
    const earliest = rows.length ? rows[0]?.finished_at : null;
    const latest = rows.length ? rows[rows.length - 1]?.finished_at : null;

    // Determine friendly range label for filename
    const fnStart = start && isYmd(start) ? start : ymdFromIso(rangeStartIso);
    const fnEnd =
      end && isYmd(end)
        ? end
        : latest
          ? ymdFromIso(latest)
          : ymdFromIso(new Date().toISOString());

    const filename = `ropes_history_${fnStart}_to_${fnEnd}.csv`;

    // ===== Build “official” CSV =====
    // Pro header section (2 columns), then a blank row, then the table
    const lines = [];

    // UTF-8 BOM helps Excel
    const BOM = "\ufeff";

    const nowLocal = new Date().toLocaleString();

    lines.push(
      ["Report", "Ropes Tracker – History Export"].map(csvEscape).join(","),
    );
    lines.push(["Generated (local time)", nowLocal].map(csvEscape).join(","));
    lines.push(["Site ID", siteId].map(csvEscape).join(","));
    lines.push(
      [
        "Range",
        rangeEndIsoExclusive
          ? `${fnStart} → ${fnEnd} (inclusive)`
          : `Last ${days} days (from ${fnStart})`,
      ]
        .map(csvEscape)
        .join(","),
    );
    lines.push(["Rows", String(rows.length)].map(csvEscape).join(","));
    lines.push(
      ["Earliest finished_at", earliest || ""].map(csvEscape).join(","),
    );
    lines.push(["Latest finished_at", latest || ""].map(csvEscape).join(","));

    // Blank line before table
    lines.push("");

    // Table header (clean + boss-friendly)
    const header = [
      "Finished Date",
      "Finished Day",
      "Finished Hour",
      "Group Name",
      "Party Size",
      "Assigned Tag",
      "Status",
      "Wait (min)",
      "Duration (min)",
      "Created At",
      "Sent Up At",
      "Started At",
      "Finished At",
      "Finish Reason",
      "Notes",
      "Phone",
      "Live Entry ID",
      "History ID",
    ];
    lines.push(header.map(csvEscape).join(","));

    for (const r of rows) {
      const finishedMs = toMs(r.finished_at);

      const createdMs = toMs(r.created_at);
      const sentMs = toMs(r.sent_up_at);
      const startedMs = toMs(r.started_at) ?? toMs(r.start_time);
      const finishMs = finishedMs;

      // Wait: sent_up_at (or created_at) -> started_at/start_time
      const sentOrCreated = sentMs ?? createdMs;
      const startForWait = startedMs ?? finishMs;
      const waitMin =
        sentOrCreated != null && startForWait != null
          ? round1(Math.max(0, (startForWait - sentOrCreated) / 60000))
          : "";

      // Duration: start_time/started_at -> finished_at
      const startForDur = startedMs ?? createdMs;
      const durMin =
        startForDur != null && finishMs != null
          ? round1(Math.max(0, (finishMs - startForDur) / 60000))
          : "";

      const finishedDate = finishedMs ? ymdFromIso(r.finished_at) : "";
      const finishedDay = finishedMs ? dayLabelLocal(r.finished_at) : "";
      const finishedHour = finishedMs ? hourLabelLocal(r.finished_at) : "";

      const row = [
        finishedDate,
        finishedDay,
        finishedHour,
        r.name ?? "",
        r.party_size ?? "",
        r.assigned_tag ?? "",
        r.status ?? "",
        waitMin,
        durMin,
        r.created_at ?? "",
        r.sent_up_at ?? "",
        r.started_at ?? "",
        r.finished_at ?? "",
        r.finish_reason ?? "",
        r.notes ?? "",
        r.phone ?? "",
        r.live_entry_id ?? "",
        r.id ?? "",
      ];

      lines.push(row.map(csvEscape).join(","));
    }

    const csv = BOM + lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to export CSV." },
      { status },
    );
  }
}
