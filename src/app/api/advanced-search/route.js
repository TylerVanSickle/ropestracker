// src/app/api/advanced-search/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getSiteIdOrThrow } from "@/app/lib/ropesSite";
import { requireStaffOrThrow } from "@/app/lib/requireStaff";

export const runtime = "nodejs";

const TZ = "America/Denver";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function tzPartsFromMs(ms, timeZone) {
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

  let hour = get("hour");
  if (hour === 24) hour = 0;

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

function tzOffsetMinutesAt(ms, timeZone) {
  const p = tzPartsFromMs(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - ms) / 60000);
}

function zonedWallToUtcIso({ y, mo, d, hh, mm, ss }, timeZone) {
  let ms = Date.UTC(y, mo - 1, d, hh, mm, ss);
  for (let i = 0; i < 5; i++) {
    const off = tzOffsetMinutesAt(ms, timeZone);
    const guess = Date.UTC(y, mo - 1, d, hh, mm, ss) - off * 60000;
    if (Math.abs(guess - ms) < 500) { ms = guess; break; }
    ms = guess;
  }
  return new Date(ms).toISOString();
}

function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

export async function GET(req) {
  try {
    await requireStaffOrThrow();
    const sb = supabaseAdmin();
    const siteId = await getSiteIdOrThrow();

    const { searchParams } = new URL(req.url);

    const name = (searchParams.get("name") || "").trim();
    const phone = (searchParams.get("phone") || "").trim().replace(/\D/g, "");
    const partySize = searchParams.get("party_size")
      ? Number(searchParams.get("party_size"))
      : null;
    const dateYmd = searchParams.get("date") || "";
    const timeFrom = searchParams.get("time_from") || ""; // HH:MM
    const timeTo = searchParams.get("time_to") || "";     // HH:MM

    // Build date range in UTC from Denver wall-clock
    const dateParsed = parseYmd(dateYmd);

    let dateStartUtc = null;
    let dateEndUtc = null;

    if (dateParsed) {
      const fromHH = timeFrom ? Number(timeFrom.split(":")[0]) : 0;
      const fromMM = timeFrom ? Number(timeFrom.split(":")[1]) : 0;
      const toHH = timeTo ? Number(timeTo.split(":")[0]) : 23;
      const toMM = timeTo ? Number(timeTo.split(":")[1]) : 59;

      dateStartUtc = zonedWallToUtcIso(
        { y: dateParsed.y, mo: dateParsed.mo, d: dateParsed.d, hh: fromHH, mm: fromMM, ss: 0 },
        TZ,
      );
      dateEndUtc = zonedWallToUtcIso(
        { y: dateParsed.y, mo: dateParsed.mo, d: dateParsed.d, hh: toHH, mm: toMM, ss: 59 },
        TZ,
      );
    }

    // Query history
    let q = sb
      .from("ropes_entries_history")
      .select("id, name, phone, party_size, assigned_tag, status, notes, created_at, sent_up_at, started_at, start_time, end_time, finished_at, finish_reason, merge_history")
      .eq("site_id", siteId)
      .order("finished_at", { ascending: false })
      .limit(500);

    // Apply filters
    if (name) {
      q = q.ilike("name", `%${name}%`);
    }

    if (partySize && Number.isFinite(partySize) && partySize > 0) {
      q = q.eq("party_size", partySize);
    }

    if (dateStartUtc && dateEndUtc) {
      // Use start_time for the time window (when they actually went on the course)
      // Fall back to filtering by finished_at for the date
      q = q.gte("start_time", dateStartUtc).lte("start_time", dateEndUtc);
    } else if (dateParsed) {
      // Date only, no time filter — use full day
      const dayStart = zonedWallToUtcIso(
        { y: dateParsed.y, mo: dateParsed.mo, d: dateParsed.d, hh: 0, mm: 0, ss: 0 },
        TZ,
      );
      const dayEnd = zonedWallToUtcIso(
        { y: dateParsed.y, mo: dateParsed.mo, d: dateParsed.d, hh: 23, mm: 59, ss: 59 },
        TZ,
      );
      q = q.gte("start_time", dayStart).lte("start_time", dayEnd);
    }

    const { data, error } = await q;
    if (error) throw error;

    let results = Array.isArray(data) ? data : [];

    // Phone filter in JS (stored format varies, so strip non-digits and compare)
    if (phone) {
      results = results.filter((r) => {
        const stored = (r.phone || "").replace(/\D/g, "");
        return stored.includes(phone);
      });
    }

    return NextResponse.json({ ok: true, results, count: results.length });
  } catch (err) {
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, error: err?.message || "Search failed." },
      { status },
    );
  }
}
