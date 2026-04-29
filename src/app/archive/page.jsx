"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatTime } from "@/app/lib/ropesStore";

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function fmtPhoneUS(input) {
  const d = digitsOnly(input).slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export default function ArchivePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");

  // Read ?phone=X from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("phone");
    if (p) setPhoneFilter(digitsOnly(p));
  }, []);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/archive", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load archive");
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (e) {
      setErr(e?.message || "Failed to load archive");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this archive record?")) return;
    try {
      const res = await fetch(`/api/archive?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert(e?.message || "Delete failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const phone = digitsOnly(phoneFilter);

    return records.filter((r) => {
      const e = r?.entry_snapshot || {};

      if (phone && phone.length >= 7) {
        const stored = digitsOnly(e.phone);
        if (!stored) return false;
        if (!stored.endsWith(phone) && !phone.endsWith(stored)) return false;
      }

      if (q) {
        const name = String(e.name || "").toLowerCase();
        const reason = String(r.reason || "").toLowerCase();
        const notes = String(e.notes || "").toLowerCase();
        if (!name.includes(q) && !reason.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [records, search, phoneFilter]);

  // Build phone -> count map for "repeat" badge
  const phoneCounts = useMemo(() => {
    const m = new Map();
    for (const r of records) {
      const p = digitsOnly(r?.entry_snapshot?.phone);
      if (!p) continue;
      m.set(p, (m.get(p) || 0) + 1);
    }
    return m;
  }, [records]);

  const totalShown = filtered.length;
  const totalAll = records.length;
  const hasFilters = Boolean(search || phoneFilter);

  return (
    <main className="container">
      {/* Header */}
      <div className="topbar">
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Archive</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              Flagged groups saved for staff reference.
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link className="button" href="/">
              Bottom
            </Link>
            <Link className="button" href="/top">
              Top
            </Link>
            <Link className="button" href="/settings">
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <section className="card spacer-md" style={{ padding: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              Search
            </div>
            <input
              className="input"
              type="text"
              placeholder="Name, reason, or notes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              Phone
            </div>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="(801) 555-1234"
              value={fmtPhoneUS(phoneFilter)}
              onChange={(e) => setPhoneFilter(digitsOnly(e.target.value))}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            {hasFilters ? (
              <button
                className="button"
                type="button"
                onClick={() => {
                  setSearch("");
                  setPhoneFilter("");
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="muted"
          style={{ fontSize: 12, marginTop: 10 }}
        >
          Showing {totalShown} of {totalAll} record{totalAll === 1 ? "" : "s"}
          {hasFilters ? " (filtered)" : ""}
        </div>
      </section>

      {/* Records */}
      <section className="card spacer-md">
        {loading ? (
          <div className="item" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800 }}>Loading…</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Pulling records from database.
            </div>
          </div>
        ) : err ? (
          <div className="item" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800 }}>Couldn&apos;t load archive</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {err}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="button" onClick={load} type="button">
                Retry
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="item" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800 }}>
              {hasFilters
                ? "No records match your filters"
                : "No archived groups yet"}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              {hasFilters
                ? "Try clearing the filters above."
                : 'Use "Flag & Archive" from the Top screen.'}
            </div>
          </div>
        ) : (
          <div className="list spacer-sm">
            {filtered.map((r) => {
              const e = r.entry_snapshot || {};
              const guestNotes = r.guest_notes || [];
              const storedDigits = digitsOnly(e.phone);
              const repeatCount = storedDigits
                ? phoneCounts.get(storedDigits) || 0
                : 0;
              const isRepeat = repeatCount >= 2;

              const partySize = Math.max(1, Number(e.partySize || 1));
              return (
                <div
                  key={r.id}
                  style={{
                    display: "block",
                    padding: 0,
                    overflow: "hidden",
                    borderRadius: 12,
                    border: isRepeat
                      ? "1px solid rgba(239, 68, 68, 0.4)"
                      : "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {/* Top accent strip for repeats */}
                  {isRepeat && (
                    <div
                      style={{
                        height: 4,
                        background:
                          "linear-gradient(90deg, var(--danger, #ef4444), rgba(239, 68, 68, 0.4))",
                      }}
                    />
                  )}

                  {/* Card body */}
                  <div style={{ padding: 14 }}>
                    {/* Header: name + pills, Delete on right */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: 18, fontWeight: 800 }}>
                            {e.name || "Unknown"}
                          </span>
                          <span className="pill">
                            {partySize} {partySize === 1 ? "person" : "people"}
                          </span>
                          {e.assignedTag ? (
                            <span className="pill">{e.assignedTag}</span>
                          ) : null}
                          {isRepeat ? (
                            <span
                              className="pill"
                              style={{
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "var(--danger, #b91c1c)",
                                borderColor: "rgba(239, 68, 68, 0.4)",
                                fontWeight: 700,
                              }}
                              title={`${repeatCount} archives on this phone`}
                            >
                              🚨 {repeatCount}× repeat
                            </span>
                          ) : null}
                        </div>

                        <div
                          className="muted"
                          style={{ fontSize: 12, marginTop: 4 }}
                        >
                          {fmtDate(r.archived_at)} • by{" "}
                          <strong>{r.archived_by}</strong>
                        </div>
                      </div>

                      <button
                        className="button"
                        type="button"
                        onClick={() => onDelete(r.id)}
                        style={{ fontSize: 12, padding: "6px 10px" }}
                      >
                        Delete
                      </button>
                    </div>

                    {/* Reason — the most important info, prominent */}
                    {r.reason ? (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "10px 12px",
                          background: isRepeat
                            ? "rgba(239, 68, 68, 0.08)"
                            : "var(--color-bg)",
                          borderRadius: 10,
                          borderLeft: `3px solid ${isRepeat ? "var(--danger, #ef4444)" : "var(--color-border)"}`,
                        }}
                      >
                        <div
                          className="muted"
                          style={{
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            fontWeight: 600,
                          }}
                        >
                          Reason
                        </div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            marginTop: 2,
                          }}
                        >
                          {r.reason}
                        </div>
                      </div>
                    ) : null}

                    {/* Notes (only if present) */}
                    {e.notes ? (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 13,
                        }}
                      >
                        <span className="muted">Entry notes: </span>
                        <span>{e.notes}</span>
                      </div>
                    ) : null}

                    {/* Phone bar */}
                    {e.phone ? (
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="muted">📞</span>
                        <a
                          href={`tel:${digitsOnly(e.phone)}`}
                          style={{
                            fontWeight: 600,
                            textDecoration: "none",
                            color: "inherit",
                          }}
                        >
                          {e.phone}
                        </a>
                        {storedDigits ? (
                          <button
                            type="button"
                            onClick={() => setPhoneFilter(storedDigits)}
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              background: "transparent",
                              border: "1px solid var(--color-border)",
                              borderRadius: 6,
                              cursor: "pointer",
                              color: "var(--color-muted)",
                            }}
                          >
                            Show all from this phone
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                  {/* Original groups before merge */}
                  {Array.isArray(e.mergeHistory) && e.mergeHistory.length > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Original Groups (before merge)
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          padding: 10,
                          background: "var(--color-bg)",
                          borderRadius: 10,
                          border: "1px solid var(--color-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {e.mergeHistory.map((g, i) => (
                          <div key={g.id || i}>
                            <div style={{ fontWeight: 700 }}>
                              {g.name || "—"}{" "}
                              <span
                                className="muted"
                                style={{ fontWeight: 400 }}
                              >
                                — group of {g.partySize || "?"}
                              </span>
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: 12, marginTop: 2 }}
                            >
                              Phone:{" "}
                              <strong>
                                {g.phone && g.phone !== "0"
                                  ? g.phone
                                  : "No phone"}
                              </strong>
                              {g.assignedTag ? ` • Tag: ${g.assignedTag}` : ""}
                              {g.notes ? ` • Notes: ${g.notes}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Staff notes */}
                  {Array.isArray(guestNotes) && guestNotes.length ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Staff Notes
                      </div>
                      <div style={{ marginTop: 6 }}>
                        {guestNotes.slice(0, 8).map((n) => (
                          <div
                            key={n.id || `${n.createdAt}-${n.text}`}
                            className="item"
                            style={{ padding: 10, marginTop: 8 }}
                          >
                            <div style={{ fontWeight: 800 }}>
                              {n.kind === "alert" ? "⚠️ " : ""}
                              {n.text}
                            </div>
                            <div
                              className="muted"
                              style={{ fontSize: 12, marginTop: 4 }}
                            >
                              {n.createdBy} • {formatTime(n.createdAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
