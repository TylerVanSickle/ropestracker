// src/app/api/analytics/route.js
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

function toMs(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function hourKeyUTC(ms) {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function dayKeyUTC(ms) {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1))),
  );
  return sorted[idx];
}

function roundInt(n) {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseYmdToStartIso(ymd) {
  // ymd: "YYYY-MM-DD" -> start of day UTC ISO
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) return null;
  const [_, y, mo, d] = m;
  const dt = new Date(
    Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0),
  );
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function parseYmdToEndIsoExclusive(ymd) {
  // end exclusive: next day 00:00:00.000Z
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) return null;
  const [_, y, mo, d] = m;
  const dt = new Date(
    Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0),
  );
  if (isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString();
}

export async function GET(req) {
  try {
    await requireStaffOrThrow();
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const { searchParams } = new URL(req.url);

    // Calendar range support: start/end (YYYY-MM-DD)
    const startYmd = searchParams.get("start");
    const endYmd = searchParams.get("end");
    const startIso = parseYmdToStartIso(startYmd);
    const endIsoExclusive = parseYmdToEndIsoExclusive(endYmd);

    const days = clampDays(searchParams.get("days"), 30);

    // Coverage (earliest & latest overall)
    const [earliestRes, latestRes] = await Promise.all([
      sb
        .from("ropes_entries_history")
        .select("finished_at")
        .eq("site_id", siteId)
        .order("finished_at", { ascending: true })
        .limit(1),
      sb
        .from("ropes_entries_history")
        .select("finished_at")
        .eq("site_id", siteId)
        .order("finished_at", { ascending: false })
        .limit(1),
    ]);

    const earliest = Array.isArray(earliestRes.data)
      ? earliestRes.data[0]?.finished_at
      : null;
    const latest = Array.isArray(latestRes.data)
      ? latestRes.data[0]?.finished_at
      : null;

    // Range selection:
    // - If start/end provided: use that
    // - Else: use last N days
    const rangeStartIso =
      startIso ||
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const rangeEndIsoExclusive = endIsoExclusive || null;

    // Pull rows in range
    let q = sb
      .from("ropes_entries_history")
      .select(
        [
          "finished_at",
          "created_at",
          "sent_up_at",
          "started_at",
          "start_time",
          "ended_early_at",
          "party_size",
          "status",
          "assigned_tag",
        ].join(","),
      )
      .eq("site_id", siteId)
      .gte("finished_at", rangeStartIso)
      .order("finished_at", { ascending: false })
      .limit(20000);

    if (rangeEndIsoExclusive) {
      q = q.lt("finished_at", rangeEndIsoExclusive);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    let totalEntries = 0;
    let totalPeople = 0;
    let partySum = 0;

    const waitSecs = [];
    const durSecs = [];

    const dowCounts = new Array(7).fill(0);
    const hourCounts = new Map();
    const dayCounts = new Map();
    const statusCounts = new Map();
    const tagCounts = new Map();

    // Trend series uses what we have in-range; we’ll display last ~14 days on UI
    for (const r of rows) {
      const finishedMs = toMs(r.finished_at);
      if (!finishedMs) continue;

      totalEntries += 1;

      const ps = Math.max(1, Number(r.party_size || 1));
      totalPeople += ps;
      partySum += ps;

      const dow = new Date(finishedMs).getUTCDay();
      dowCounts[dow] += 1;

      const hk = hourKeyUTC(finishedMs);
      hourCounts.set(hk, (hourCounts.get(hk) || 0) + 1);

      const dk = dayKeyUTC(finishedMs);
      dayCounts.set(dk, (dayCounts.get(dk) || 0) + 1);

      const st = String(r.status || "UNKNOWN").toUpperCase();
      statusCounts.set(st, (statusCounts.get(st) || 0) + 1);

      const tag = String(r.assigned_tag || "").trim();
      if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);

      const sentOrCreatedMs = toMs(r.sent_up_at) ?? toMs(r.created_at);
      const startishMs = toMs(r.started_at) ?? toMs(r.start_time) ?? finishedMs;
      if (sentOrCreatedMs != null && startishMs != null) {
        const w = Math.max(0, (startishMs - sentOrCreatedMs) / 1000);
        waitSecs.push(w);
      }

      const startForDurMs =
        toMs(r.start_time) ?? toMs(r.started_at) ?? toMs(r.created_at);
      if (startForDurMs != null) {
        const d = Math.max(0, (finishedMs - startForDurMs) / 1000);
        durSecs.push(d);
      }
    }

    waitSecs.sort((a, b) => a - b);
    durSecs.sort((a, b) => a - b);

    const totals = {
      total_entries: totalEntries,
      total_people: totalPeople,
      avg_party_size: totalEntries ? partySum / totalEntries : 0,

      avg_wait_seconds: waitSecs.length
        ? roundInt(waitSecs.reduce((a, b) => a + b, 0) / waitSecs.length)
        : 0,
      p50_wait_seconds: roundInt(percentile(waitSecs, 0.5)),
      p90_wait_seconds: roundInt(percentile(waitSecs, 0.9)),

      avg_duration_seconds: durSecs.length
        ? roundInt(durSecs.reduce((a, b) => a + b, 0) / durSecs.length)
        : 0,
      p50_duration_seconds: roundInt(percentile(durSecs, 0.5)),
      p90_duration_seconds: roundInt(percentile(durSecs, 0.9)),
    };

    let busiestDow = null;
    {
      let bestDow = 0;
      let bestCount = -1;
      for (let i = 0; i < 7; i++) {
        if (dowCounts[i] > bestCount) {
          bestCount = dowCounts[i];
          bestDow = i;
        }
      }
      if (bestCount >= 0) busiestDow = { dow: bestDow, entries: bestCount };
    }

    let busiestHour = null;
    {
      let bestKey = null;
      let bestCount = -1;
      for (const [k, c] of hourCounts.entries()) {
        if (c > bestCount) {
          bestCount = c;
          bestKey = k;
        }
      }
      if (bestKey) busiestHour = { hour_bucket: bestKey, entries: bestCount };
    }

    const topHours = Array.from(hourCounts.entries())
      .map(([k, c]) => ({ hour_bucket: k, entries: c }))
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 10);

    const dailyTrend = Array.from(dayCounts.entries())
      .map(([k, c]) => ({ day_bucket: k, entries: c }))
      .sort((a, b) => (a.day_bucket < b.day_bucket ? -1 : 1));

    const dowBreakdown = dowCounts
      .map((c, dow) => ({ dow, entries: c }))
      .sort((a, b) => b.entries - a.entries);

    const statusBreakdown = Array.from(statusCounts.entries())
      .map(([status, entries]) => ({ status, entries }))
      .sort((a, b) => b.entries - a.entries);

    const tagBreakdown = Array.from(tagCounts.entries())
      .map(([tag, entries]) => ({ tag, entries }))
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 12);

    return NextResponse.json({
      ok: true,
      totals,
      busiest_hour: busiestHour,
      busiest_dow: busiestDow,
      top_hours: topHours,
      dow_breakdown: dowBreakdown,
      status_breakdown: statusBreakdown,
      tag_breakdown: tagBreakdown,
      daily_trend: dailyTrend,
      range: {
        start_iso: rangeStartIso,
        end_exclusive_iso: rangeEndIsoExclusive,
      },
      coverage: {
        earliest_finished_at: earliest || null,
        latest_finished_at: latest || null,
      },
    });
  } catch (err) {
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load analytics." },
      { status },
    );
  }
}
