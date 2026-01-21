"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadEntries,
  loadSettings,
  loadUpdatedAt,
  formatTime,
  subscribeToRopesStorage,
} from "../lib/ropesStore";
import {
  ensureQueueOrder,
  computeEstimates,
  estimateForNewGroupSize,
  getWaitRangeText,
} from "../lib/ropesUtils";

const COMMON_SIZES = [2, 4, 6];
const POLL_MS = 2500;

function cleanName(v) {
  const s = String(v ?? "").trim();
  return s || "Guest";
}

function isFullscreenNow() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

async function requestFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch {
    // ignore
  }
}

function buildLists(entries) {
  const normalized = ensureQueueOrder(Array.isArray(entries) ? entries : []);

  const up = [];
  const waiting = [];

  for (const e of normalized) {
    const status = String(e.status || "").toUpperCase();

    if (status === "DONE" || status === "FINISHED" || status === "COMPLETE") {
      continue;
    }

    if (status === "UP") up.push(e);
    else if (status === "WAITING") waiting.push(e);
    else waiting.push(e);
  }

  waiting.sort((a, b) => {
    const ao = typeof a.queueOrder === "number" ? a.queueOrder : 0;
    const bo = typeof b.queueOrder === "number" ? b.queueOrder : 0;
    return ao - bo;
  });

  return { up, waiting };
}

export default function ClientPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() => loadEntries());
  const [updatedAt, setUpdatedAt] = useState(() => loadUpdatedAt());
  const [activated, setActivated] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const nowDate = useMemo(() => new Date(nowTick), [nowTick]);

  const refreshFromStorage = () => {
    setSettings(loadSettings());
    setEntries(loadEntries());
    setUpdatedAt(loadUpdatedAt());
    setNowTick(Date.now());
  };

  useEffect(() => {
    const unsub = subscribeToRopesStorage(refreshFromStorage);
    const t = setInterval(refreshFromStorage, POLL_MS);

    return () => {
      unsub?.();
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!isFullscreenNow()) setActivated(false);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  const { up, waiting } = useMemo(() => buildLists(entries), [entries]);
  const nextUp = waiting.length ? waiting[0] : null;

  const durationMin = settings?.durationMin ?? 45;
  const totalLines = settings?.totalLines ?? 15;
  const closed = !!settings?.paused;

  const venueName = useMemo(() => {
    const raw = String(settings?.venueName ?? "").trim();
    return raw ? raw.slice(0, 60) : "Ropes Course Waitlist";
  }, [settings?.venueName]);

  const theme = settings?.clientTheme ?? "auto";
  const themeClass =
    theme === "dark"
      ? "client-theme-dark"
      : theme === "light"
        ? "client-theme-light"
        : "client-theme-auto";

  const timeLabel = useMemo(() => {
    return nowDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [nowDate]);

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return null;
    return formatTime(updatedAt);
  }, [updatedAt]);

  const waitingEstimates = useMemo(() => {
    if (closed) return new Map();

    const active = up.map((e) => ({
      linesUsed: Math.max(1, Number(e.partySize || 1)),
      endTime: e.endTime || null,
    }));

    const waitingList = waiting.map((e) => ({
      id: e.id,
      partySize: Math.max(1, Number(e.partySize || 1)),
    }));

    return computeEstimates({
      totalLines,
      durationMin,
      active,
      waiting: waitingList,
      now: nowDate,
    });
  }, [closed, up, waiting, totalLines, durationMin, nowDate]);

  const nextUpInfo = useMemo(() => {
    if (!nextUp || closed) return { eta: null, rangeText: null };

    const r = waitingEstimates.get(nextUp.id);
    const waitMin = r?.estWaitMin ?? null;

    return {
      eta: r?.estStartISO ? formatTime(r.estStartISO) : null,
      rangeText: waitMin == null ? null : getWaitRangeText(waitMin),
    };
  }, [closed, nextUp, waitingEstimates]);

  const quotes = useMemo(() => {
    if (closed) {
      return COMMON_SIZES.map((size) => ({
        size,
        rangeText: "Closed",
        eta: null,
      }));
    }

    return COMMON_SIZES.map((size) => {
      const q = estimateForNewGroupSize({
        totalLines,
        durationMin,
        entries,
        partySize: size,
        now: nowDate,
      });

      return {
        size,
        rangeText:
          q.waitMin == null ? "Ask staff" : getWaitRangeText(q.waitMin),
        eta: q.estStartISO ? formatTime(q.estStartISO) : null,
      };
    });
  }, [closed, entries, totalLines, durationMin, nowDate]);

  const courseStatus = useMemo(() => {
    if (closed) {
      return {
        badge: "Closed",
        headline: "Ropes course is currently closed.",
        sub: "Please check with the front desk for the latest timing.",
      };
    }

    if (up.length === 0) {
      return {
        badge: "Ready",
        headline: "The course is ready for the next group.",
        sub: "Please stay nearby. Staff will call groups as space becomes available.",
      };
    }

    return {
      badge: "In Progress",
      headline: "Groups are currently on the course.",
      sub: "As groups finish, the next group will be loaded in check-in order.",
    };
  }, [closed, up.length]);

  const activate = async () => {
    setActivated(true);
    await requestFullscreen();
  };

  return (
    <div
      className={`client-display ${themeClass} ${activated ? "client-active" : ""}`}
    >
      <div className="client-wrap">
        <header className="client-header">
          <div>
            <div className="client-title">{venueName}</div>
            <div className="client-subtitle">
              Live wait estimates • Please wait for staff to call your group •{" "}
              {timeLabel}
            </div>
          </div>

          <div className="client-pills">
            <div className="client-pill live-pill">
              <span className={`live-dot ${closed ? "closed" : ""}`} />
              {closed ? "Closed" : "Live"}
            </div>

            {updatedLabel ? (
              <div className="client-pill">
                Updated: <b>{updatedLabel}</b>
              </div>
            ) : null}

            {!activated ? (
              <button className="client-btn" onClick={activate}>
                Activate Display Mode
              </button>
            ) : (
              <div className="client-pill">Display Mode Active</div>
            )}
          </div>
        </header>

        {closed ? (
          <div className="paused-banner">
            <div className="paused-title">Currently Closed</div>
            <div className="paused-sub">
              The ropes course is closed right now. Please check with the front
              desk for the latest timing.
            </div>
          </div>
        ) : null}

        <main className="client-grid">
          <section className="client-card">
            <h2 className="client-h2">Course Status</h2>

            <div
              className="client-nextbox"
              style={{ padding: activated ? 18 : 14 }}
            >
              <div className="client-nextmeta" style={{ marginTop: 0 }}>
                <span
                  className="client-pill"
                  style={{ display: "inline-block" }}
                >
                  {courseStatus.badge}
                </span>
              </div>

              <div
                className="client-nextname"
                style={{
                  fontSize: activated ? 40 : 26,
                  marginTop: 10,
                  whiteSpace: "normal",
                }}
              >
                {courseStatus.headline}
              </div>

              <div className="client-note" style={{ marginTop: 10 }}>
                {courseStatus.sub}
              </div>
            </div>

            <div className="client-note" style={{ marginTop: 12 }}>
              Wait times change as groups finish and new groups check in.
            </div>
          </section>

          <section className="client-card highlight">
            <h2 className="client-h2">Next Up</h2>

            {!nextUp ? (
              <div className="client-empty">No one is waiting right now.</div>
            ) : closed ? (
              <div className="client-empty">
                Loading is closed — staff will call the next group when we open.
              </div>
            ) : (
              <>
                <div className="client-nextbox">
                  <div className="client-nextname">
                    {cleanName(nextUp.name)}
                  </div>

                  <div className="client-nextmeta">
                    {nextUpInfo.eta ? (
                      <>
                        Estimated load: <b>{nextUpInfo.eta}</b>
                        {nextUpInfo.rangeText ? (
                          <>
                            <span style={{ opacity: 0.8 }}>•</span>
                            About <b>{nextUpInfo.rangeText}</b>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>Please stay nearby. Staff will call your group.</>
                    )}
                  </div>
                </div>

                <div className="client-note">
                  Groups load in check-in order.
                </div>
              </>
            )}
          </section>

          <section className="client-card wide">
            <h2 className="client-h2">Estimated Wait (Common Group Sizes)</h2>

            <div className="client-quotes">
              {quotes.map((q) => (
                <div key={q.size} className="client-quote">
                  <div className="client-qsize">Group of {q.size}</div>
                  <div className="client-qtime">{q.rangeText}</div>
                  <div className="client-qeta">
                    {q.eta ? (
                      <>
                        Est. start: <b>{q.eta}</b>
                      </>
                    ) : closed ? (
                      "Please check with the front desk"
                    ) : (
                      "Times update automatically"
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="client-card how-card"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <h2 className="client-h2" style={{ marginBottom: 0 }}>
                How it works
              </h2>
              <ul className="how-list">
                <li>Groups load in check-in order.</li>
                <li>Some groups may need more space before they can start.</li>
                <li>If your plans change, please tell the front desk.</li>
              </ul>
            </div>
          </section>
        </main>

        <footer className="client-footer">
          Haven’t checked in yet? Please see the front desk.
        </footer>
      </div>
    </div>
  );
}
