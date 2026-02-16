"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTime } from "@/app/lib/ropesStore";

export default function ArchivePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  return (
    <main className="container">
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
            <div style={{ fontWeight: 800 }}>Couldn’t load archive</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {err}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="button" onClick={load} type="button">
                Retry
              </button>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="item" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800 }}>No archived groups yet</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Use “Flag & Archive” from the Top screen.
            </div>
          </div>
        ) : (
          <div className="list spacer-sm">
            {records.map((r) => {
              const e = r.entry_snapshot || {};
              const guestNotes = r.guest_notes || [];

              return (
                <div key={r.id} className="item" style={{ padding: 14 }}>
                  <div className="item-title" style={{ fontSize: 18 }}>
                    {e.name || "Unknown"}{" "}
                    <span className="pill">
                      {Math.max(1, Number(e.partySize || 1))} people
                    </span>
                    {e.assignedTag ? (
                      <span className="pill">{e.assignedTag}</span>
                    ) : null}
                  </div>

                  <div className="muted item-sub" style={{ marginTop: 4 }}>
                    Archived: {formatTime(r.archived_at)} • By:{" "}
                    <strong>{r.archived_by}</strong>
                  </div>

                  {e.phone ? (
                    <div className="muted" style={{ marginTop: 6 }}>
                      Phone: <strong>{e.phone}</strong>
                    </div>
                  ) : null}

                  {r.reason ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Reason
                      </div>
                      <div style={{ fontWeight: 800 }}>{r.reason}</div>
                    </div>
                  ) : null}

                  {e.notes ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Entry Notes
                      </div>
                      <div>{e.notes}</div>
                    </div>
                  ) : null}

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

                  <div
                    className="row"
                    style={{
                      justifyContent: "flex-end",
                      gap: 10,
                      marginTop: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="button"
                      type="button"
                      onClick={() => onDelete(r.id)}
                    >
                      Delete Record
                    </button>
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
