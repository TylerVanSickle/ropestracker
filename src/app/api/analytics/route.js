// src/app/api/analytics/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getSiteIdOrThrow } from "@/app/lib/ropesSite";
import { requireStaffOrThrow } from "@/app/lib/requireStaff";

export const runtime = "nodejs";

const TZ = "America/Denver";

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

function roundInt(n) {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1))),
  );
  return sorted[idx];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function offsetToIso(offsetMin) {
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = pad2(Math.floor(abs / 60));
  const mm = pad2(abs % 60);
  return `${sign}${hh}:${mm}`;
}

function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function tzPartsFromMs(ms, timeZone) {
  // hourCycle:'h23' avoids "24:00" weirdness on some platforms
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = dtf.formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);

  let year = get("year");
  let month = get("month");
  let day = get("day");
  let hour = get("hour");
  const minute = get("minute");
  const second = get("second");

  // extra safety if platform returns hour=24 anyway
  if (hour === 24) hour = 0;

  return { year, month, day, hour, minute, second };
}

function tzOffsetMinutesAt(ms, timeZone) {
  const p = tzPartsFromMs(ms, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return Math.round((asUtc - ms) / 60000);
}

// Convert a wall time in TZ to UTC ISO (iterative convergence)
function zonedWallToUtcIso({ y, mo, d, hh, mm, ss }, timeZone) {
  let ms = Date.UTC(y, mo - 1, d, hh, mm, ss);

  for (let i = 0; i < 5; i++) {
    const off = tzOffsetMinutesAt(ms, timeZone);
    const guess = Date.UTC(y, mo - 1, d, hh, mm, ss) - off * 60000;
    if (Math.abs(guess - ms) < 500) {
      ms = guess;
      break;
    }
    ms = guess;
  }

  return new Date(ms).toISOString();
}

function rangeStartIsoFromYmdLocal(ymd, timeZone) {
  const p = parseYmd(ymd);
  if (!p) return null;
  return zonedWallToUtcIso(
    { y: p.y, mo: p.mo, d: p.d, hh: 0, mm: 0, ss: 0 },
    timeZone,
  );
}

function rangeEndIsoExclusiveFromYmdLocal(ymd, timeZone) {
  const p = parseYmd(ymd);
  if (!p) return null;

  // Add 1 day in calendar terms
  const tmp = new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0)); // midday anchor
  tmp.setUTCDate(tmp.getUTCDate() + 1);

  const y = tmp.getUTCFullYear();
  const mo = tmp.getUTCMonth() + 1;
  const d = tmp.getUTCDate();

  return zonedWallToUtcIso({ y, mo, d, hh: 0, mm: 0, ss: 0 }, timeZone);
}

// ISO strings WITH OFFSET so the browser formats them as local-time buckets nicely
function hourBucketIsoLocal(finishedMs, timeZone) {
  const p = tzPartsFromMs(finishedMs, timeZone);
  const off = tzOffsetMinutesAt(finishedMs, timeZone);
  const offset = offsetToIso(off);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(
    p.hour,
  )}:00:00${offset}`;
}

function dayBucketIsoLocal(finishedMs, timeZone) {
  const p = tzPartsFromMs(finishedMs, timeZone);
  const off = tzOffsetMinutesAt(finishedMs, timeZone);
  const offset = offsetToIso(off);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T00:00:00${offset}`;
}

function normalizeStatus(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

export async function GET(req) {
  try {
    await requireStaffOrThrow();
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const { searchParams } = new URL(req.url);

    const startYmd = searchParams.get("start");
    const endYmd = searchParams.get("end");
    const days = clampDays(searchParams.get("days"), 30);

    const startIso =
      rangeStartIsoFromYmdLocal(startYmd, TZ) ||
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const endIsoExclusive =
      rangeEndIsoExclusiveFromYmdLocal(endYmd, TZ) || null;

    // Coverage (overall)
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

    // Pull ALL rows in-range (no status filter here — we normalize in JS)
    let q = sb
      .from("ropes_entries_history")
      .select(
        [
          "finished_at",
          "created_at",
          "sent_up_at",
          "started_at",
          "start_time",
          "party_size",
          "status",
          "assigned_tag",
        ].join(","),
      )
      .eq("site_id", siteId)
      .gte("finished_at", startIso)
      .order("finished_at", { ascending: false })
      .limit(20000);

    if (endIsoExclusive) q = q.lt("finished_at", endIsoExclusive);

    const { data, error } = await q;
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    // Status breakdown = ALL rows
    const statusCounts = new Map();
    for (const r of rows) {
      const st = normalizeStatus(r.status) || "UNKNOWN";
      statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
    }
    const statusBreakdown = Array.from(statusCounts.entries())
      .map(([status, entries]) => ({ status, entries }))
      .sort((a, b) => b.entries - a.entries);

    // DONE rows (normalized)
    const doneRows = rows.filter((r) => normalizeStatus(r.status) === "DONE");

    // Totals + buckets are DONE-only
    let totalEntries = 0;
    let totalPeople = 0;
    let partySum = 0;

    const waitSecs = [];
    const durSecs = [];

    const dowCounts = new Array(7).fill(0);

    // GROUP BUCKETS
    const hourCounts = new Map();
    const dayCounts = new Map();

    // PEOPLE BUCKETS (NEW)
    const dayPeopleCounts = new Map(); // day_bucket -> sum(party_size)

    const tagCounts = new Map();

    for (const r of doneRows) {
      const finishedMs = toMs(r.finished_at);
      if (!finishedMs) continue;

      totalEntries += 1;

      const ps = Math.max(1, Number(r.party_size || 1));
      totalPeople += ps;
      partySum += ps;

      // DOW in Denver based on local Y-M-D parts
      const parts = tzPartsFromMs(finishedMs, TZ);
      const noonUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        12,
        0,
        0,
      );
      const dow = new Date(noonUtc).getUTCDay();
      dowCounts[dow] += 1;

      // Hour bucket (groups)
      const hk = hourBucketIsoLocal(finishedMs, TZ);
      hourCounts.set(hk, (hourCounts.get(hk) || 0) + 1);

      // Day bucket (groups)
      const dk = dayBucketIsoLocal(finishedMs, TZ);
      dayCounts.set(dk, (dayCounts.get(dk) || 0) + 1);

      // Day bucket (people) (NEW)
      dayPeopleCounts.set(dk, (dayPeopleCounts.get(dk) || 0) + ps);

      const tag = String(r.assigned_tag || "").trim();
      if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);

      // WAIT = created_at -> sent_up_at (if < 60s => 0 and INCLUDED)
      const createdMs = toMs(r.created_at);
      const sentMs = toMs(r.sent_up_at);
      if (createdMs != null && sentMs != null) {
        let w = Math.max(0, (sentMs - createdMs) / 1000);
        if (w < 60) w = 0;
        waitSecs.push(w);
      }

      // DURATION = start-ish -> finish
      const startMs =
        toMs(r.start_time) ??
        toMs(r.started_at) ??
        toMs(r.sent_up_at) ??
        toMs(r.created_at);

      if (startMs != null) {
        const d = Math.max(0, (finishedMs - startMs) / 1000);
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

    // busiest DOW (DONE, groups)
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

    // busiest hour (DONE, groups)
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

    // busiest day (DONE, groups) (NEW)
    let busiestDayGroups = null;
    {
      let bestKey = null;
      let bestCount = -1;
      for (const [k, c] of dayCounts.entries()) {
        if (c > bestCount) {
          bestCount = c;
          bestKey = k;
        }
      }
      if (bestKey)
        busiestDayGroups = { day_bucket: bestKey, entries: bestCount };
    }

    // busiest day (DONE, people = sum party_size) (NEW)
    let busiestDayPeople = null;
    {
      let bestKey = null;
      let bestPeople = -1;
      for (const [k, ppl] of dayPeopleCounts.entries()) {
        const n = Number(ppl || 0);
        if (n > bestPeople) {
          bestPeople = n;
          bestKey = k;
        }
      }
      if (bestKey)
        busiestDayPeople = { day_bucket: bestKey, people: bestPeople };
    }

    const topHours = Array.from(hourCounts.entries())
      .map(([k, c]) => ({ hour_bucket: k, entries: c }))
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 10);

    // daily trend now includes BOTH groups and people (NEW)
    const dailyTrend = Array.from(dayCounts.entries())
      .map(([k, c]) => ({
        day_bucket: k,
        entries: c,
        people: Number(dayPeopleCounts.get(k) || 0),
      }))
      .sort((a, b) => (a.day_bucket < b.day_bucket ? -1 : 1));

    const dowBreakdown = dowCounts
      .map((c, dow) => ({ dow, entries: c }))
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

      // NEW
      busiest_day_groups: busiestDayGroups,
      busiest_day_people: busiestDayPeople,

      top_hours: topHours,
      dow_breakdown: dowBreakdown,
      status_breakdown: statusBreakdown,
      tag_breakdown: tagBreakdown,
      daily_trend: dailyTrend,

      range: {
        start_iso: startIso,
        end_exclusive_iso: endIsoExclusive,
        timezone: TZ,
      },
      coverage: {
        earliest_finished_at: earliest || null,
        latest_finished_at: latest || null,
      },
      definitions: {
        totals_basis:
          "DONE rows (status normalized to trim+uppercase) within the selected local-day window using finished_at",
        wait_seconds:
          "created_at → sent_up_at (wait < 60s treated as 0 and included)",
        duration_seconds:
          "start_time/started_at (fallback: sent_up_at/created_at) → finished_at",

        // NEW
        people_basis: "People are computed as SUM(party_size) for DONE rows.",
        busiest_day_people:
          "Day with highest SUM(party_size) in local-day buckets.",
        daily_trend_people:
          "daily_trend[].people is SUM(party_size) per local day.",
      },
      debug: {
        rows_in_range: rows.length,
        done_rows_in_range: doneRows.length,
        start_iso: startIso,
        end_exclusive_iso: endIsoExclusive,

        // NEW (helps confirm it’s not blank anymore)
        days_bucketed: dayCounts.size,
        days_people_bucketed: dayPeopleCounts.size,
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
