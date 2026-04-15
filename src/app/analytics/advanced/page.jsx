// src/app/analytics/advanced/page.jsx
"use client";

import { useState } from "react";
import Link from "next/link";

const ANALYTICS_TZ = "America/Denver";

function safeDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

function fmtDateTime(iso) {
  const d = safeDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: ANALYTICS_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function fmtTime(iso) {
  const d = safeDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: ANALYTICS_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function fmtDate(iso) {
  const d = safeDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: ANALYTICS_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function durationMinutes(startIso, endIso) {
  const s = safeDate(startIso);
  const e = safeDate(endIso);
  if (!s || !e) return "—";
  const mins = Math.round((e - s) / 60000);
  if (mins < 0) return "—";
  return `${mins} min`;
}

function ymdToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AdvancedSearchPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("");
  const [date, setDate] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");

  const [results, setResults] = useState(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function search(e) {
    e?.preventDefault();
    setErr("");
    setLoading(true);

    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    if (phone.trim()) params.set("phone", phone.trim());
    if (partySize) params.set("party_size", partySize);
    if (date) params.set("date", date);
    if (timeFrom) params.set("time_from", timeFrom);
    if (timeTo) params.set("time_to", timeTo);

    try {
      const res = await fetch(`/api/advanced-search?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Search failed");
      setResults(json.results || []);
      setCount(json.count || 0);
    } catch (e) {
      setErr(e?.message || "Search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setName("");
    setPhone("");
    setPartySize("");
    setDate("");
    setTimeFrom("");
    setTimeTo("");
    setResults(null);
    setCount(0);
    setErr("");
  }

  const hasFilters = name || phone || partySize || date || timeFrom || timeTo;

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div className="topbar">
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Advanced Search</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              Look up past groups by name, phone, size, date &amp; time
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link className="button" href="/analytics">
              Analytics
            </Link>
            <Link className="button" href="/">
              Bottom
            </Link>
            <Link className="button" href="/top">
              Top
            </Link>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <form
        onSubmit={search}
        className="card spacer-md"
        style={{ padding: 16 }}
      >
        <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 12 }}>
          Search Filters
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {/* Name */}
          <div>
            <label className="field-label">Guest Name</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="field-label">Phone Number</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. 801-555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Group Size */}
          <div>
            <label className="field-label">Group Size</label>
            <input
              className="input"
              type="number"
              min="1"
              max="50"
              placeholder="e.g. 5"
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
            />
          </div>

          {/* Date */}
          <div>
            <label className="field-label">Date</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Time From */}
          <div>
            <label className="field-label">Time From (Denver)</label>
            <input
              className="input"
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
            />
          </div>

          {/* Time To */}
          <div>
            <label className="field-label">Time To (Denver)</label>
            <input
              className="input"
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
            />
          </div>
        </div>

        <div
          className="row"
          style={{ gap: 10, marginTop: 16, justifyContent: "flex-end" }}
        >
          {hasFilters && (
            <button
              type="button"
              className="button"
              onClick={clearFilters}
              disabled={loading}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="button"
            onClick={() => {
              setDate(ymdToday());
            }}
          >
            Today
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={loading || !hasFilters}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {/* Error */}
      {err && (
        <div
          className="card spacer-md"
          style={{ padding: 14, background: "var(--danger-bg)", color: "var(--danger)" }}
        >
          {err}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div className="card spacer-md" style={{ padding: 16 }}>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 16 }}>
              Results
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {count} {count === 1 ? "group" : "groups"} found
            </div>
          </div>

          {results.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>
              No groups match your search filters.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map((r) => (
                <div
                  key={r.id}
                  className="item"
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "start",
                  }}
                >
                  <div>
                    {/* Name + tag */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>
                        {r.name || "—"}
                      </span>
                      {r.assigned_tag && (
                        <span
                          className="muted"
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 8,
                            background: "var(--color-bg)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          {r.assigned_tag}
                        </span>
                      )}
                    </div>

                    {/* Details row */}
                    <div
                      className="muted"
                      style={{
                        fontSize: 13,
                        marginTop: 6,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                      }}
                    >
                      <span>
                        Group of {r.party_size}
                      </span>
                      {r.phone && r.phone !== "0" && (
                        <span>{r.phone}</span>
                      )}
                      <span>
                        {fmtDate(r.start_time || r.finished_at)}
                      </span>
                    </div>

                    {/* Timeline */}
                    <div
                      className="muted"
                      style={{
                        fontSize: 12,
                        marginTop: 6,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                      }}
                    >
                      <span>
                        Checked in: {fmtTime(r.created_at)}
                      </span>
                      <span>
                        Started: {fmtTime(r.start_time || r.started_at)}
                      </span>
                      <span>
                        Finished: {fmtTime(r.finished_at)}
                      </span>
                      <span>
                        Duration: {durationMinutes(r.start_time || r.started_at, r.finished_at)}
                      </span>
                    </div>

                    {/* Notes */}
                    {r.notes && (
                      <div
                        style={{
                          fontSize: 12,
                          marginTop: 6,
                          padding: "4px 8px",
                          background: "var(--color-bg)",
                          borderRadius: 8,
                          fontStyle: "italic",
                        }}
                      >
                        {r.notes}
                      </div>
                    )}

                    {/* Merge history */}
                    {Array.isArray(r.merge_history) && r.merge_history.length > 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          marginTop: 8,
                          padding: "8px 10px",
                          background: "var(--color-bg)",
                          borderRadius: 10,
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          Original groups before merge:
                        </div>
                        {r.merge_history.map((g, i) => (
                          <div key={g.id || i} style={{ marginTop: 4 }}>
                            <span style={{ fontWeight: 600 }}>{g.name || "—"}</span>
                            {" — "}group of {g.partySize || "?"}
                            {g.phone && g.phone !== "0" ? ` • ${g.phone}` : ""}
                            {g.assignedTag ? ` • ${g.assignedTag}` : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right side: status */}
                  <div
                    className="muted"
                    style={{ fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}
                  >
                    {r.status}
                    {r.finish_reason && (
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        {r.finish_reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
