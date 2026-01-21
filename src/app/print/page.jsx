"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  loadEntries,
  loadSettings,
  formatTime,
  subscribeToRopesStorage,
  listArchives,
  loadArchive,
} from "@/app/lib/ropesStore";
import { ensureQueueOrder } from "@/app/lib/ropesUtils";

function groupLists(entries) {
  const normalized = ensureQueueOrder(Array.isArray(entries) ? entries : []);
  const waiting = normalized
    .filter((e) => e.status === "WAITING")
    .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0));
  const up = normalized.filter((e) => e.status === "UP");
  return { waiting, up };
}

export default function PrintPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() => loadEntries());
  const [now, setNow] = useState(() => new Date());

  // optional: show most recent archive key
  const [latestArchive, setLatestArchive] = useState(null);

  const refresh = () => {
    setSettings(loadSettings());
    setEntries(loadEntries());
    setNow(new Date());
    const keys = listArchives();
    setLatestArchive(keys.length ? keys[0] : null);
  };

  useEffect(() => {
    refresh();
    const unsub = subscribeToRopesStorage(refresh);
    const t = setInterval(() => setNow(new Date()), 5000);
    return () => {
      unsub?.();
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { waiting, up } = useMemo(() => groupLists(entries), [entries]);

  const title = settings?.venueName?.trim() || "Ropes Course";
  const closed = !!settings?.paused;

  const latestArchiveData = useMemo(() => {
    if (!latestArchive) return null;
    return loadArchive(latestArchive);
  }, [latestArchive]);

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <h1 className="title">Daily Sheet</h1>
          <p className="muted">
            {title} • Printed at <strong>{formatTime(now)}</strong> • Public
            status: <strong>{closed ? "Closed" : "Open"}</strong>
          </p>
        </div>

        <div className="row">
          <Link className="button" href="/">
            Back
          </Link>
          <button
            className="button button-primary"
            type="button"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      <div className="card spacer-md">
        <h2 className="section-title">Quick script (what to say)</h2>
        <div className="list spacer-sm">
          <div className="item">
            <div className="item-main">
              <div className="item-title">“How long is the wait?”</div>
              <div className="item-sub muted">
                Use Quick Quote on the staff screen for their group size. Times
                shift as groups finish.
              </div>
            </div>
          </div>

          <div className="item">
            <div className="item-main">
              <div className="item-title">“Are we next?”</div>
              <div className="item-sub muted">
                “We load groups in check-in order. When it’s your turn and
                there’s enough space, we’ll call you.”
              </div>
            </div>
          </div>

          <div className="item">
            <div className="item-main">
              <div className="item-title">
                If someone leaves / changes plans
              </div>
              <div className="item-sub muted">
                Edit their entry or remove it so estimates stay accurate.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card spacer-md">
        <h2 className="section-title">Current snapshot</h2>

        <div className="grid-2 spacer-sm">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Now on course</h3>
            {up.length === 0 ? (
              <p className="muted">No groups currently on the course.</p>
            ) : (
              <ol className="how-list">
                {up.map((g) => (
                  <li key={g.id}>
                    <strong>{g.name}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Waiting list</h3>
            {waiting.length === 0 ? (
              <p className="muted">No groups waiting.</p>
            ) : (
              <ol className="how-list">
                {waiting.slice(0, 25).map((g) => (
                  <li key={g.id}>
                    <strong>{g.name}</strong>
                  </li>
                ))}
              </ol>
            )}
            {waiting.length > 25 ? (
              <p className="muted helper">Showing first 25.</p>
            ) : null}
          </div>
        </div>
      </div>

      {latestArchiveData ? (
        <div className="card spacer-md">
          <h2 className="section-title">Most recent archive</h2>
          <p className="muted">
            {latestArchiveData.date} • Archived at{" "}
            <strong>{formatTime(latestArchiveData.archivedAt)}</strong> •
            Entries:{" "}
            <strong>
              {Array.isArray(latestArchiveData.entries)
                ? latestArchiveData.entries.length
                : 0}
            </strong>
          </p>
          <p className="muted helper">
            Archives are stored locally on this device (localStorage).
          </p>
        </div>
      ) : null}
    </main>
  );
}
