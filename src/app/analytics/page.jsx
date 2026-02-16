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
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtHourBucket(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric" });
}

function fmtDayBucketShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function pct(n, denom) {
  const a = Number(n || 0);
  const b = Number(denom || 0);
  if (!b) return "0%";
  return `${Math.round((a / b) * 100)}%`;
}

function ymdTodayLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.70)",
                  fontWeight: 900,
                  padding: "10px 8px",
                  borderBottom: "1px solid rgba(255,255,255,0.10)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, idx) => (
              <tr
                key={idx}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
              >
                {r.map((cell, cidx) => (
                  <td
                    key={cidx}
                    style={{
                      padding: "10px 8px",
                      fontSize: 13,
                      verticalAlign: "middle",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={headers.length}
                className="muted"
                style={{ padding: "12px 8px" }}
              >
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
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

  function buildUrl() {
    if (mode === "RANGE" && startYmd && endYmd) {
      return `/api/analytics?start=${encodeURIComponent(
        startYmd,
      )}&end=${encodeURIComponent(endYmd)}`;
    }
    return `/api/analytics?days=${days}`;
  }

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

  const totals = data?.totals || {};
  const coverage = data?.coverage || {};
  const busiestHour = data?.busiest_hour || null;
  const busiestDow = data?.busiest_dow || null;

  const topHours = Array.isArray(data?.top_hours) ? data.top_hours : [];
  const statusBreakdown = Array.isArray(data?.status_breakdown)
    ? data.status_breakdown
    : [];
  const tagBreakdown = Array.isArray(data?.tag_breakdown)
    ? data.tag_breakdown
    : [];
  const dailyTrend = Array.isArray(data?.daily_trend) ? data.daily_trend : [];
  const dowBreakdown = Array.isArray(data?.dow_breakdown)
    ? data.dow_breakdown
    : [];

  const totalEntries = Number(totals.total_entries || 0);
  const totalPeople = Number(totals.total_people || 0);
  const avgParty = Number(totals.avg_party_size || 0);

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

  const csvHref =
    mode === "RANGE" && startYmd && endYmd
      ? `/api/history.csv?start=${encodeURIComponent(
          startYmd,
        )}&end=${encodeURIComponent(endYmd)}`
      : `/api/history.csv?days=${days}`;

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
                sub="Groups in selected range"
              />
              <Kpi
                label="Total people"
                value={fmtNum(totals.total_people)}
                sub={`Avg party: ${fmtNum(totals.avg_party_size, 1)}`}
              />
              <Kpi
                label="Wait (sent→start)"
                value={fmtSecs(totals.avg_wait_seconds)}
                sub={`P50: ${fmtSecs(totals.p50_wait_seconds)} • P90: ${fmtSecs(
                  totals.p90_wait_seconds,
                )}`}
              />
              <Kpi
                label="Duration (start→finish)"
                value={fmtSecs(totals.avg_duration_seconds)}
                sub={`P50: ${fmtSecs(
                  totals.p50_duration_seconds,
                )} • P90: ${fmtSecs(totals.p90_duration_seconds)}`}
              />
            </div>

            {/* GRID AREA 1: Daily trend alone */}
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
                subtitle="Finished groups per day (visual)"
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
                        formatter={(v) => [`${v} groups`, "Finished"]}
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
                    Busiest day:{" "}
                    <strong>{busiestDow ? DOW[busiestDow.dow] : "—"}</strong>{" "}
                    {busiestDow ? `(${busiestDow.entries})` : ""}
                  </span>
                  <span className="pill">
                    Busiest hour:{" "}
                    <strong>
                      {busiestHour?.hour_bucket
                        ? fmtHourBucket(busiestHour.hour_bucket)
                        : "—"}
                    </strong>{" "}
                    {busiestHour ? `(${busiestHour.entries})` : ""}
                  </span>
                </div>
              </Card>
            </div>

            {/* GRID AREA 2: next 2 (DOW + Operational) */}
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
                subtitle="Where demand concentrates"
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
                      <Tooltip formatter={(v) => [`${v} groups`, "Finished"]} />
                      <Bar dataKey="entries" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Shows finished groups by weekday (range-based).
                </div>
              </Card>

              <Card
                title="Operational summary"
                subtitle="Throughput + outcomes (quick read)"
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
                    Note: if there’s less history than the selected range,
                    per-day averages are calculated as{" "}
                    <strong>groups ÷ days of available data</strong>, so they
                    may be slightly skewed early on.
                  </div>
                </div>
              </Card>
            </div>

            {/* GRID AREA 3: next 2 (Status + Key/Definitions) */}
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
                subtitle="Distribution in history"
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
                    <div style={{ fontWeight: 900 }}>P50 (Median)</div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}
                    >
                      Half of groups are under this value, half are above it.
                    </div>
                  </div>

                  <div
                    className="item"
                    style={{ padding: 12, borderRadius: 14 }}
                  >
                    <div style={{ fontWeight: 900 }}>P90</div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}
                    >
                      90% of groups are under this value. The slowest ~10% are
                      above it.
                    </div>
                  </div>

                  <div
                    className="item"
                    style={{ padding: 12, borderRadius: 14 }}
                  >
                    <div style={{ fontWeight: 900 }}>Wait vs Duration</div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}
                    >
                      <strong>Wait</strong> = Created at → Start Time
                      <br />
                      <strong>Duration</strong> = Start time → Finished At
                    </div>
                  </div>
                </div>
              </Card>
            </div>

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
                const hours = Array.isArray(topHours) ? topHours : [];
                const tags = Array.isArray(tagBreakdown) ? tagBreakdown : [];

                const total = Math.max(0, Number(totalEntries || 0));

                const hoursShown = hours.reduce(
                  (a, x) => a + Number(x?.entries || 0),
                  0,
                );
                const otherHours = Math.max(0, total - hoursShown);

                const tagsShown = tags.reduce(
                  (a, x) => a + Number(x?.entries || 0),
                  0,
                );
                const otherTags = Math.max(0, total - tagsShown);

                const hourRows = [
                  ...hours.map((h) => ({
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
                  ...tags.map((t) => ({
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
                      {/* header */}
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

                      {/* rows */}
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
                      subtitle="Hours with the most finished groups"
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
                        Showing {fmtNum(hours.length)} busiest hours +{" "}
                        <strong>Other</strong>. Table adds up to the full total.
                      </div>
                    </Card>

                    <Card
                      title="Top tags"
                      subtitle="Most used assigned tags"
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
                        Showing {fmtNum(tags.length)} top tags +{" "}
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
