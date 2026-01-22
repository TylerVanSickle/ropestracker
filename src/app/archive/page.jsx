"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadFlagArchive,
  subscribeToRopesStorage,
  formatTime,
  deleteArchiveRecord,
} from "@/app/lib/ropesStore";

export default function ArchivePage() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeToRopesStorage(() => setTick((x) => x + 1));
    return () => unsub?.();
  }, []);

  const records = useMemo(() => loadFlagArchive(), [tick]);

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
        {records.length === 0 ? (
          <div className="item" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800 }}>No archived groups yet</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Use “Flag & Archive” from the Top screen.
            </div>
          </div>
        ) : (
          <div className="list spacer-sm">
            {records.map((r) => {
              const e = r.entrySnapshot || {};
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
                    Archived: {formatTime(r.archivedAt)} • By:{" "}
                    <strong>{r.archivedBy}</strong>
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

                  {Array.isArray(r.guestNotes) && r.guestNotes.length ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Staff Notes
                      </div>
                      <div style={{ marginTop: 6 }}>
                        {r.guestNotes.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
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
                      onClick={() => {
                        if (!confirm("Delete this archive record?")) return;
                        deleteArchiveRecord(r.id);
                      }}
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
