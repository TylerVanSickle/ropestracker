// src/app/analytics/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Force analytics display timezone (MST/MDT handled automatically by IANA zone)
const ANALYTICS_TZ = "America/Denver";

// ---- Timezone-safe helpers (always render in ANALYTICS_TZ) ----
function safeDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

function ymdInTimeZone(date, timeZone) {
  // en-CA gives YYYY-MM-DD reliably
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ymdTodayLocal() {
  // Use ANALYTICS_TZ (MST/MDT)
  return ymdInTimeZone(new Date(), ANALYTICS_TZ);
}

function fmtSecs(sec) {
  const s = Math.max(0, Number(sec || 0));
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function fmtNum(n, digits = 0) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtDate(iso) {
  const d = safeDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: ANALYTICS_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

function fmtHourBucket(iso) {
  const d = safeDate(iso);
  if (!d) return iso ? String(iso) : "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: ANALYTICS_TZ,
    weekday: "short",
    hour: "numeric",
  }).format(d);
}

function fmtDayBucketShort(iso) {
  const d = safeDate(iso);
  if (!d) return iso ? String(iso) : "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: ANALYTICS_TZ,
    month: "short",
    day: "numeric",
  }).format(d);
}

function fmtDayFull(iso) {
  const d = safeDate(iso);
  if (!d) return iso ? String(iso) : "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: ANALYTICS_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function pct(n, denom) {
  const a = Number(n || 0);
  const b = Number(denom || 0);
  if (!b) return "0%";
  return `${Math.round((a / b) * 100)}%`;
}

function Card({ title, subtitle, right, children, style }) {
  return (
    <div className="item" style={{ padding: 14, borderRadius: 16, ...style }}>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          width: "100%",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
          {subtitle ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div style={{ marginTop: 12, width: "100%" }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div
      className="item"
      style={{ padding: 14, minWidth: 240, borderRadius: 16 }}
    >
      <div className="muted" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontWeight: 950, fontSize: 26, marginTop: 6 }}>{value}</div>
      {sub ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

// ---------- CSV parsing helpers ----------
function parseCsv(text) {
  // Basic CSV parser with quotes support.
  // Returns { headers: string[], rows: Array<Record<string,string>> }
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (!lines.length) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols.length) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cols[c] ?? "";
    }
    rows.push(obj);
  }

  return { headers, rows };
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function numOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getField(row, candidates) {
  for (const k of candidates) {
    if (row && row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

// Convert an ISO timestamp into a YYYY-MM-DD string *in ANALYTICS_TZ*
function ymdFromIsoInAnalyticsTz(iso) {
  const d = safeDate(iso);
  if (!d) return "";
  return ymdInTimeZone(d, ANALYTICS_TZ); // "YYYY-MM-DD"
}

// Turn "YYYY-MM-DD" into an ISO-ish string we can feed to fmtDayFull/fmtDayBucketShort
// We use noon UTC to avoid edge cases; formatting always uses ANALYTICS_TZ anyway.
function pseudoIsoFromYmd(ymd) {
  if (!ymd) return "";
  return `${ymd}T12:00:00.000Z`;
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  // Calendar range
  const [mode, setMode] = useState("PRESET"); // PRESET | RANGE
  const [startYmd, setStartYmd] = useState("");
  const [endYmd, setEndYmd] = useState("");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // NEW: CSV-derived busiest people
  const [csvPeopleByDay, setCsvPeopleByDay] = useState(null); // Map<string, number> as plain object
  const [csvPeopleInfo, setCsvPeopleInfo] = useState({
    loading: false,
    error: "",
    rowsUsed: 0,
  });

  function buildUrl() {
    if (mode === "RANGE" && startYmd && endYmd) {
      return `/api/analytics?start=${encodeURIComponent(
        startYmd,
      )}&end=${encodeURIComponent(endYmd)}`;
    }
    return `/api/analytics?days=${days}`;
  }

  const csvHref = useMemo(() => {
    return mode === "RANGE" && startYmd && endYmd
      ? `/api/history.csv?start=${encodeURIComponent(
          startYmd,
        )}&end=${encodeURIComponent(endYmd)}`
      : `/api/history.csv?days=${days}`;
  }, [mode, startYmd, endYmd, days]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(buildUrl(), { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed");
      setData(json);
    } catch (e) {
      setErr(e?.message || "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize derived arrays to satisfy exhaustive-deps + keep refs stable
  const totals = useMemo(() => data?.totals || {}, [data]);
  const coverage = useMemo(() => data?.coverage || {}, [data]);
  const busiestHour = useMemo(() => data?.busiest_hour || null, [data]);
  const busiestDow = useMemo(() => data?.busiest_dow || null, [data]);

  const topHours = useMemo(
    () => (Array.isArray(data?.top_hours) ? data.top_hours : []),
    [data],
  );
  const statusBreakdown = useMemo(
    () => (Array.isArray(data?.status_breakdown) ? data.status_breakdown : []),
    [data],
  );
  const tagBreakdown = useMemo(
    () => (Array.isArray(data?.tag_breakdown) ? data.tag_breakdown : []),
    [data],
  );
  const dailyTrend = useMemo(
    () => (Array.isArray(data?.daily_trend) ? data.daily_trend : []),
    [data],
  );
  const dowBreakdown = useMemo(
    () => (Array.isArray(data?.dow_breakdown) ? data.dow_breakdown : []),
    [data],
  );

  const totalEntries = Number(totals.total_entries || 0); // DONE groups
  const totalPeople = Number(totals.total_people || 0); // sum(party_size) for DONE
  const avgParty = Number(totals.avg_party_size || 0);

  const rangeStartIso = data?.range?.start_iso || "";
  const rangeEndExclusiveIso = data?.range?.end_exclusive_iso || "";
  const serverTz = data?.range?.timezone || "unknown";

  const trendChart = useMemo(() => {
    const sliced = dailyTrend.slice(-21);
    return sliced.map((d) => ({
      day: fmtDayBucketShort(d.day_bucket),
      entries: Number(d.entries || 0),
      raw: d.day_bucket,
    }));
  }, [dailyTrend]);

  const dowChart = useMemo(() => {
    const m = new Map(
      dowBreakdown.map((x) => [Number(x.dow), Number(x.entries || 0)]),
    );
    return DOW.map((label, i) => ({
      dow: label,
      entries: m.get(i) || 0,
    }));
  }, [dowBreakdown]);

  const statusChart = useMemo(() => {
    return statusBreakdown.slice(0, 6).map((s) => ({
      name: String(s.status || ""),
      value: Number(s.entries || 0),
    }));
  }, [statusBreakdown]);

  const STATUS_COLORS = [
    "#8ab4f8",
    "#a7f3d0",
    "#fca5a5",
    "#fde68a",
    "#c4b5fd",
    "#f9a8d4",
  ];

  const opsSummary = useMemo(() => {
    const dayCount = Math.max(1, dailyTrend.length || 1);
    const avgGroupsPerDay = totalEntries / dayCount;
    const avgPeoplePerDay = totalPeople / dayCount;

    const peakGroupsPerHour = Number(busiestHour?.entries || 0);
    const peakPeoplePerHour =
      peakGroupsPerHour * (Number.isFinite(avgParty) ? avgParty : 0);

    const doneCount = Number(
      statusBreakdown.find((s) => String(s.status).toUpperCase() === "DONE")
        ?.entries || 0,
    );
    const archivedCount = Number(
      statusBreakdown.find((s) => String(s.status).toUpperCase() === "ARCHIVED")
        ?.entries || 0,
    );

    // archived ÷ DONE totals
    const archiveRate = totalEntries ? archivedCount / totalEntries : 0;

    return {
      dayCount,
      avgGroupsPerDay,
      avgPeoplePerDay,
      peakGroupsPerHour,
      peakPeoplePerHour,
      doneCount,
      archivedCount,
      archiveRate,
    };
  }, [
    dailyTrend.length,
    totalEntries,
    totalPeople,
    avgParty,
    busiestHour,
    statusBreakdown,
  ]);

  function setPreset(n) {
    setMode("PRESET");
    setDays(n);
    setStartYmd("");
    setEndYmd("");
  }

  function setTodayRange() {
    const t = ymdTodayLocal();
    setMode("RANGE");
    setStartYmd(t);
    setEndYmd(t);
  }

  // ---- Compute busiest day (groups) from server data (existing) ----
  const busiestDayGroups = useMemo(() => {
    const fromApi = data?.busiest_day_groups || null;
    if (fromApi?.day_bucket) {
      return {
        day_bucket: fromApi.day_bucket,
        entries: Number(fromApi.entries || 0),
      };
    }
    if (!dailyTrend.length) return null;
    let best = null;
    for (const d of dailyTrend) {
      const entries = Number(d?.entries || 0);
      if (!best || entries > Number(best.entries || 0)) {
        best = { day_bucket: d?.day_bucket, entries };
      }
    }
    return best;
  }, [data, dailyTrend]);

  // ---- NEW: CSV fallback for busiest day (people) ----
  const busiestDayPeople = useMemo(() => {
    // If API ever adds busiest_day_people, prefer it.
    const fromApi = data?.busiest_day_people || null;
    if (fromApi?.day_bucket) {
      const ppl =
        numOr0(fromApi.people) ||
        numOr0(fromApi.total_people) ||
        numOr0(fromApi.party_size_sum);
      if (ppl > 0) return { day_bucket: fromApi.day_bucket, people: ppl };
    }

    // Otherwise use CSV-derived map
    if (!csvPeopleByDay) return null;

    let bestYmd = "";
    let bestPeople = 0;

    for (const [ymd, people] of Object.entries(csvPeopleByDay)) {
      const p = Number(people || 0);
      if (p > bestPeople) {
        bestPeople = p;
        bestYmd = ymd;
      }
    }

    if (!bestYmd || bestPeople <= 0) return null;

    return {
      day_bucket: pseudoIsoFromYmd(bestYmd),
      people: bestPeople,
    };
  }, [data, csvPeopleByDay]);

  // Fetch & aggregate CSV whenever the selected range changes AND we don’t already have day-people data.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // If API starts providing it later, stop doing CSV work.
      if (data?.busiest_day_people?.day_bucket) return;

      setCsvPeopleInfo((s) => ({ ...s, loading: true, error: "" }));
      try {
        const res = await fetch(csvHref, { credentials: "include" });
        const text = await res.text();
        if (!res.ok) throw new Error(`CSV export failed (${res.status})`);

        const { headers, rows } = parseCsv(text);

        // Identify columns (be flexible with names)
        const statusCol =
          headers.find((h) => h.toLowerCase() === "status") || "";
        const partyCol =
          headers.find((h) => h.toLowerCase() === "party_size") ||
          headers.find((h) => h.toLowerCase() === "party") ||
          headers.find((h) => h.toLowerCase() === "people") ||
          "";
        const finishedCol =
          headers.find((h) => h.toLowerCase() === "finished_at") ||
          headers.find((h) => h.toLowerCase() === "finished") ||
          headers.find((h) => h.toLowerCase() === "done_at") ||
          "";

        // If no party_size column, we can’t compute people. (keeps the chip as —)
        if (!partyCol || !finishedCol) {
          if (!cancelled) {
            setCsvPeopleByDay({});
            setCsvPeopleInfo((s) => ({
              ...s,
              loading: false,
              error: `CSV is missing required columns (need finished_at + party_size). Found: ${headers
                .slice(0, 12)
                .join(", ")}${headers.length > 12 ? "…" : ""}`,
              rowsUsed: 0,
            }));
          }
          return;
        }

        const byDay = {}; // { "YYYY-MM-DD": number }
        let used = 0;

        for (const r of rows) {
          // Prefer DONE rows if status exists
          if (statusCol) {
            const st = String(r[statusCol] || "")
              .toUpperCase()
              .trim();
            if (st && st !== "DONE") continue;
          }

          const finishedIso = String(r[finishedCol] || "").trim();
          const ymd = ymdFromIsoInAnalyticsTz(finishedIso);
          if (!ymd) continue;

          const partySize = numOr0(r[partyCol]);
          if (partySize <= 0) continue;

          byDay[ymd] = (byDay[ymd] || 0) + partySize;
          used++;
        }

        if (!cancelled) {
          setCsvPeopleByDay(byDay);
          setCsvPeopleInfo((s) => ({
            ...s,
            loading: false,
            error: "",
            rowsUsed: used,
          }));
        }
      } catch (e) {
        if (!cancelled) {
          setCsvPeopleByDay({});
          setCsvPeopleInfo((s) => ({
            ...s,
            loading: false,
            error: e?.message || "Failed to compute people/day from CSV",
            rowsUsed: 0,
          }));
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [data, csvHref]);

  return (
    <main className="container">
      <div className="topbar">
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Analytics</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              Ops reporting + exports (staff only)
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link className="button" href="/">
              Bottom
            </Link>
            <Link className="button" href="/top">
              Top
            </Link>
            <Link className="button" href="/archive">
              Archive
            </Link>
            <Link className="button" href="/settings">
              Settings
            </Link>
          </div>
        </div>
      </div>

      <section className="card spacer-md" style={{ padding: 14 }}>
        {/* Controls */}
        <div
          className="item"
          style={{
            padding: 14,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr 1fr",
            alignItems: "start",
            borderRadius: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Date range</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Use preset ranges or select an exact calendar window.
            </div>

            <div
              className="row"
              style={{ gap: 10, flexWrap: "wrap", marginTop: 12 }}
            >
              <select
                className="input"
                style={{ width: 170, padding: 10 }}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                disabled={loading}
              >
                <option value="PRESET">Preset range</option>
                <option value="RANGE">Calendar range</option>
              </select>

              {mode === "PRESET" ? (
                <>
                  <select
                    className="input"
                    style={{ width: 190, padding: 10 }}
                    value={days}
                    onChange={(e) => setPreset(Number(e.target.value))}
                    disabled={loading}
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={180}>Last 180 days</option>
                  </select>

                  <button
                    className="button"
                    onClick={() => setPreset(7)}
                    disabled={loading}
                  >
                    7d
                  </button>
                  <button
                    className="button"
                    onClick={() => setPreset(30)}
                    disabled={loading}
                  >
                    30d
                  </button>
                  <button
                    className="button"
                    onClick={() => setPreset(90)}
                    disabled={loading}
                  >
                    90d
                  </button>
                </>
              ) : (
                <>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Start
                    </div>
                    <input
                      className="input"
                      style={{ padding: 10 }}
                      type="date"
                      value={startYmd}
                      onChange={(e) => setStartYmd(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      End
                    </div>
                    <input
                      className="input"
                      style={{ padding: 10 }}
                      type="date"
                      value={endYmd}
                      onChange={(e) => setEndYmd(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <button
                    className="button"
                    onClick={setTodayRange}
                    disabled={loading}
                  >
                    Today
                  </button>
                </>
              )}

              <button
                className="button button-primary"
                onClick={load}
                disabled={loading}
              >
                {loading ? "Running..." : "Run"}
              </button>

              <a className="button" href={csvHref}>
                Export CSV
              </a>
            </div>

            {mode === "RANGE" ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Tip: pick a single day by setting Start and End to the same
                date.
              </div>
            ) : null}
          </div>

          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Data coverage</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              How far back this site’s history goes.
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div className="item" style={{ padding: 12, borderRadius: 14 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Earliest finished record
                </div>
                <div style={{ fontWeight: 900, marginTop: 6 }}>
                  {fmtDate(coverage.earliest_finished_at)}
                </div>
              </div>

              <div className="item" style={{ padding: 12, borderRadius: 14 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Latest finished record
                </div>
                <div style={{ fontWeight: 900, marginTop: 6 }}>
                  {fmtDate(coverage.latest_finished_at)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {err ? (
          <div className="item" style={{ marginTop: 12, padding: 12 }}>
            <div style={{ fontWeight: 800 }}>Error</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {err}
            </div>
          </div>
        ) : null}

        {data ? (
          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            {/* KPI STRIP */}
            <div
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                justifyContent: "space-between",
              }}
            >
              <Kpi
                label="Total groups"
                value={fmtNum(totals.total_entries)}
                sub="DONE groups in selected range"
              />
              <Kpi
                label="Total people"
                value={fmtNum(totals.total_people)}
                sub={`Avg party (DONE): ${fmtNum(totals.avg_party_size, 1)}`}
              />
              <Kpi
                label="Wait (created→sent)"
                value={fmtSecs(totals.avg_wait_seconds)}
                sub={`Avg wait • P50: ${fmtSecs(
                  totals.p50_wait_seconds,
                )} • P90: ${fmtSecs(totals.p90_wait_seconds)}`}
              />
              <Kpi
                label="Duration (start→finish)"
                value={fmtSecs(totals.avg_duration_seconds)}
                sub={`Avg duration • P50: ${fmtSecs(
                  totals.p50_duration_seconds,
                )} • P90: ${fmtSecs(totals.p90_duration_seconds)}`}
              />
            </div>

            {/* Daily trend */}
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "1fr",
                alignItems: "start",
              }}
            >
              <Card
                title="Daily trend"
                subtitle="Finished DONE groups per day"
                right={
                  <span className="pill">
                    Showing {Math.min(21, trendChart.length)} days
                  </span>
                }
                style={{ minHeight: 360 }}
              >
                <div style={{ height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={trendChart}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        formatter={(v) => [`${v} groups`, "DONE Finished"]}
                        labelFormatter={(l) => `Day: ${l}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="entries"
                        strokeWidth={2}
                        fillOpacity={0.25}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div
                  className="row"
                  style={{ gap: 10, flexWrap: "wrap", marginTop: 10 }}
                >
                  <span className="pill">
                    Busiest day (groups):{" "}
                    <strong>
                      {busiestDayGroups?.day_bucket
                        ? fmtDayFull(busiestDayGroups.day_bucket)
                        : busiestDow
                          ? DOW[busiestDow.dow]
                          : "—"}
                    </strong>{" "}
                    {busiestDayGroups
                      ? `(${fmtNum(busiestDayGroups.entries)} groups)`
                      : busiestDow
                        ? `(${fmtNum(busiestDow.entries)} groups)`
                        : ""}
                  </span>

                  <span className="pill">
                    Busiest day (people):{" "}
                    <strong>
                      {busiestDayPeople?.day_bucket
                        ? fmtDayFull(busiestDayPeople.day_bucket)
                        : "—"}
                    </strong>{" "}
                    {busiestDayPeople
                      ? `(${fmtNum(busiestDayPeople.people)} people)`
                      : ""}
                  </span>

                  <span className="pill">
                    Busiest hour (groups):{" "}
                    <strong>
                      {busiestHour?.hour_bucket
                        ? fmtHourBucket(busiestHour.hour_bucket)
                        : "—"}
                    </strong>{" "}
                    {busiestHour
                      ? `(${fmtNum(busiestHour.entries)} groups)`
                      : ""}
                  </span>
                </div>
              </Card>
            </div>

            {/* Day-of-week + Operational */}
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                alignItems: "stretch",
              }}
            >
              <Card
                title="Day-of-week volume"
                subtitle="DONE finished groups by weekday"
                style={{ minHeight: 360 }}
              >
                <div style={{ height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dowChart}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="dow" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [`${v} groups`, "DONE"]} />
                      <Bar dataKey="entries" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Rendered in {ANALYTICS_TZ}.
                </div>
              </Card>

              <Card
                title="Operational summary"
                subtitle="Throughput + outcomes"
                style={{ minHeight: 360 }}
                right={<span className="pill">{opsSummary.dayCount} days</span>}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div
                      className="item"
                      style={{
                        padding: 12,
                        flex: "1 1 220px",
                        borderRadius: 14,
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12 }}>
                        Avg groups / day
                      </div>
                      <div
                        style={{ fontWeight: 950, fontSize: 18, marginTop: 6 }}
                      >
                        {fmtNum(opsSummary.avgGroupsPerDay, 1)}
                      </div>
                    </div>

                    <div
                      className="item"
                      style={{
                        padding: 12,
                        flex: "1 1 220px",
                        borderRadius: 14,
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12 }}>
                        Avg people / day
                      </div>
                      <div
                        style={{ fontWeight: 950, fontSize: 18, marginTop: 6 }}
                      >
                        {fmtNum(opsSummary.avgPeoplePerDay, 1)}
                      </div>
                    </div>
                  </div>

                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div
                      className="item"
                      style={{
                        padding: 12,
                        flex: "1 1 220px",
                        borderRadius: 14,
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12 }}>
                        Peak hour throughput
                      </div>
                      <div
                        style={{ fontWeight: 950, fontSize: 18, marginTop: 6 }}
                      >
                        {fmtNum(opsSummary.peakGroupsPerHour)} groups / hr
                      </div>
                      <div
                        className="muted"
                        style={{ fontSize: 12, marginTop: 6 }}
                      >
                        Est. {fmtNum(opsSummary.peakPeoplePerHour, 0)} people /
                        hr
                      </div>
                    </div>

                    <div
                      className="item"
                      style={{
                        padding: 12,
                        flex: "1 1 220px",
                        borderRadius: 14,
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12 }}>
                        Archive rate
                      </div>
                      <div
                        style={{ fontWeight: 950, fontSize: 18, marginTop: 6 }}
                      >
                        {Math.round(opsSummary.archiveRate * 100)}%
                      </div>
                      <div
                        className="muted"
                        style={{ fontSize: 12, marginTop: 6 }}
                      >
                        DONE: {fmtNum(opsSummary.doneCount)} • ARCHIVED:{" "}
                        {fmtNum(opsSummary.archivedCount)}
                      </div>
                    </div>
                  </div>

                  <div
                    className="muted"
                    style={{ fontSize: 12, lineHeight: 1.45 }}
                  >
                    Note: per-day averages are calculated as{" "}
                    <strong>DONE groups ÷ days shown</strong>.
                  </div>
                </div>
              </Card>
            </div>

            {/* Status + Definitions */}
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                alignItems: "stretch",
              }}
            >
              <Card
                title="Status breakdown"
                subtitle="All statuses in selected range"
                style={{ minHeight: 360 }}
              >
                <div style={{ height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChart}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {statusChart.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={STATUS_COLORS[idx % STATUS_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} groups`, "Count"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div
                  className="muted"
                  style={{ fontSize: 12, marginTop: 10, lineHeight: 1.45 }}
                >
                  P50 (Median): half under / half over.
                  <br />
                  P90: 90% under this (worst-case planning).
                </div>
              </Card>

              <Card
                title="Key / definitions"
                subtitle="So the numbers make sense instantly"
                style={{ minHeight: 360 }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    className="item"
                    style={{ padding: 12, borderRadius: 14 }}
                  >
                    <div style={{ fontWeight: 900 }}>Wait (created→sent)</div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}
                    >
                      The big number is the <strong>average</strong> wait time
                      for DONE rows in the window (Created → Sent Up).
                      <br />
                      P50 is the median. P90 is the “bad day” planning number.
                    </div>
                  </div>

                  <div
                    className="item"
                    style={{ padding: 12, borderRadius: 14 }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      Duration (start→finish)
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}
                    >
                      Start time → Finished at (DONE rows in window).
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Top Hours + Top Tags */}
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))",
                alignItems: "start",
                width: "100%",
              }}
            >
              {(() => {
                const total = Math.max(0, Number(totalEntries || 0));

                const hoursShown = topHours.reduce(
                  (a, x) => a + Number(x?.entries || 0),
                  0,
                );
                const otherHours = Math.max(0, total - hoursShown);

                const tagsShown = tagBreakdown.reduce(
                  (a, x) => a + Number(x?.entries || 0),
                  0,
                );
                const otherTags = Math.max(0, total - tagsShown);

                const hourRows = [
                  ...topHours.map((h) => ({
                    label: fmtHourBucket(h.hour_bucket),
                    count: Number(h?.entries || 0),
                    kind: "row",
                  })),
                  ...(otherHours > 0
                    ? [
                        {
                          label: "Other hours",
                          count: otherHours,
                          kind: "other",
                        },
                      ]
                    : []),
                ];

                const tagRows = [
                  ...tagBreakdown.map((t) => ({
                    label: String(t?.tag || ""),
                    count: Number(t?.entries || 0),
                    kind: "row",
                  })),
                  ...(otherTags > 0
                    ? [
                        {
                          label: "Other / Untagged",
                          count: otherTags,
                          kind: "other",
                        },
                      ]
                    : []),
                ];

                function shareLine(c) {
                  return `${pct(c, total)} (${fmtNum(c)} / ${fmtNum(total)})`;
                }

                function GridList({ rows }) {
                  return (
                    <div style={{ width: "100%" }}>
                      <div
                        className="muted"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 90px 170px",
                          gap: 10,
                          padding: "10px 12px",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          width: "100%",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ textAlign: "left" }}>Label</div>
                        <div style={{ textAlign: "right" }}>Groups</div>
                        <div style={{ textAlign: "right" }}>% of Total</div>
                      </div>

                      <div style={{ width: "100%" }}>
                        {rows.map((r, idx) => (
                          <div
                            key={`${r.label}-${idx}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 90px 170px",
                              gap: 10,
                              padding: "10px 12px",
                              width: "100%",
                              alignItems: "center",
                              borderBottom:
                                idx === rows.length - 1
                                  ? "none"
                                  : "1px solid rgba(0,0,0,0.04)",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: r.kind === "other" ? 950 : 900,
                                textAlign: "left",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                              }}
                              title={r.label}
                            >
                              {r.label}
                            </div>

                            <div
                              style={{ fontWeight: 950, textAlign: "right" }}
                            >
                              {fmtNum(r.count)}
                            </div>

                            <div
                              className="muted"
                              style={{ textAlign: "right" }}
                            >
                              {shareLine(r.count)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    <Card
                      title="Top hours"
                      subtitle="Hours with the most DONE finished groups"
                      right={
                        <span className="pill">
                          Total: {fmtNum(total)} groups
                        </span>
                      }
                      style={{ width: "100%" }}
                    >
                      <GridList rows={hourRows} />
                      <div
                        className="muted"
                        style={{
                          fontSize: 12,
                          marginTop: 10,
                          padding: "0 2px",
                        }}
                      >
                        Showing {fmtNum(topHours.length)} busiest hours +{" "}
                        <strong>Other</strong>. Table adds up to the full total.
                      </div>
                    </Card>

                    <Card
                      title="Top tags"
                      subtitle="Most used assigned tags (DONE groups)"
                      right={
                        <span className="pill">
                          Total: {fmtNum(total)} groups
                        </span>
                      }
                      style={{ width: "100%" }}
                    >
                      <GridList rows={tagRows} />
                      <div
                        className="muted"
                        style={{
                          fontSize: 12,
                          marginTop: 10,
                          padding: "0 2px",
                        }}
                      >
                        Showing {fmtNum(tagBreakdown.length)} top tags +{" "}
                        <strong>Other / Untagged</strong>. Table adds up to the
                        full total.
                      </div>
                    </Card>
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
