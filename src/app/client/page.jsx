// src/app/client/page.jsx
"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { formatTime } from "../lib/ropesStore";
import {
  ensureQueueOrder,
  computeEstimates,
  estimateForNewGroupSize,
  getWaitRangeText,
} from "../lib/ropesUtils";

const COMMON_SIZES = [2, 4, 6];
const FALLBACK_REFRESH_MS = 15000;
const SITE_SLUG = "main";

/**
 * SECURITY NOTES (public page):
 * - Do NOT fetch phone numbers or internal notes.
 * - Display only first name + last initial.
 * - Keep read-only RLS policies for anon.
 */

function makeSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  return createClient(url, anon, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
}

function cleanName(v) {
  const s = String(v ?? "").trim();
  return s || "Guest";
}

// "Tyler VanSickle" -> "Tyler V."
function publicDisplayName(entry) {
  const raw = cleanName(entry?.name);
  const parts = raw.split(/\s+/).filter(Boolean);
  const first = parts[0] || "Guest";
  const last = parts[1] || "";
  const lastInitial = last ? `${last[0].toUpperCase()}.` : "";
  return `${first}${lastInitial ? " " + lastInitial : ""}`.slice(0, 24);
}

function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getFullscreenNowSafe() {
  if (!canUseDom()) return false;
  return Boolean(
    document.fullscreenElement || document.webkitFullscreenElement,
  );
}

async function requestFullscreen() {
  if (!canUseDom()) return;
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch {
    // ignore
  }
}

function mapDbSettings(db) {
  if (!db || typeof db !== "object") return null;
  return {
    siteId: db.site_id ?? null,
    totalLines: Number(db.total_lines ?? 15),
    durationMin: Number(db.duration_min ?? 45),
    paused: Boolean(db.paused ?? false),
    venueName: String(db.venue_name ?? "Ropes Course Waitlist"),
    clientTheme: String(db.client_theme ?? "auto"),
    flowPaused: Boolean(db.flow_paused ?? false),
    flowPauseReason: String(db.flow_pause_reason ?? ""),
  };
}

function mapDbEntry(db) {
  if (!db || typeof db !== "object") return null;
  return {
    id: db.id,
    name: db.name ?? "Guest",
    partySize: Number(db.party_size ?? 1),
    status: String(db.status ?? "WAITING"),
    coursePhase: db.course_phase ?? null,
    queueOrder:
      typeof db.queue_order === "number"
        ? db.queue_order
        : Number(db.queue_order ?? 0),
    assignedTag: db.assigned_tag ?? null,
    linesUsed: Number(db.lines_used ?? Number(db.party_size ?? 1)),
    createdAt: db.created_at ?? null,
    endTime: db.end_time ?? null,
  };
}

function summarizeSupabaseError(e) {
  if (!e) return "Unknown error";
  const msg = e.message || String(e);
  const code = e.code ? ` (${e.code})` : "";
  const details = e.details ? ` — ${e.details}` : "";
  return `${msg}${code}${details}`.slice(0, 220);
}

function upsertById(list, item) {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx < 0) return [...list, item];
  const next = list.slice();
  next[idx] = { ...next[idx], ...item };
  return next;
}

function buildLists(entries) {
  const normalized = ensureQueueOrder(Array.isArray(entries) ? entries : []);

  const up = [];
  const waiting = [];

  for (const e of normalized) {
    const status = String(e.status || "").toUpperCase();
    if (status === "DONE" || status === "FINISHED" || status === "COMPLETE")
      continue;

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
  const sp = useSearchParams();

  // URL toggles:
  //  - /client?tv=1      => kiosk/TV affordances
  //  - /client?debug=1   => show offline reason in tooltip
  const tvMode = sp.get("tv") === "1";
  const debug = sp.get("debug") === "1";

  const [settings, setSettings] = useState({
    totalLines: 15,
    durationMin: 45,
    paused: false,
    venueName: "Ropes Course Waitlist",
    clientTheme: "auto",
  });

  const [entries, setEntries] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);

  // Fullscreen state must NOT touch document during render
  const [fullscreen, setFullscreen] = useState(false);
  const [activated, setActivated] = useState(false);

  const [isTouch, setIsTouch] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false); // >= desktop width
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [online, setOnline] = useState(false);
  const [lastError, setLastError] = useState("");

  const nowDate = useMemo(() => new Date(nowTick), [nowTick]);

  const sbRef = useRef(null);
  const siteIdRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    setIsTouch(
      typeof window !== "undefined" &&
        ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    );
  }, []);

  // Wide screen detector (bigger than tablet)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(min-width: 1024px)"); // tablet-ish cutoff
    const sync = () => setIsWideScreen(Boolean(mq.matches));

    sync();
    if (mq.addEventListener) mq.addEventListener("change", sync);
    else mq.addListener(sync);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", sync);
      else mq.removeListener(sync);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Track fullscreen changes safely
  useEffect(() => {
    if (!canUseDom()) return;

    const sync = () => setFullscreen(getFullscreenNowSafe());
    sync();

    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);

    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  async function loadSiteId(sb) {
    if (siteIdRef.current) return siteIdRef.current;

    const { data, error } = await sb
      .from("ropes_sites")
      .select("id, slug")
      .eq("slug", SITE_SLUG)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) {
      throw new Error(
        `No site found for slug '${SITE_SLUG}'. (Or anon cannot read ropes_sites)`,
      );
    }

    siteIdRef.current = data.id;
    return data.id;
  }

  async function refreshPublic() {
    const sb = sbRef.current;
    if (!sb) return;

    try {
      const siteId = await loadSiteId(sb);

      const [{ data: s, error: se }, { data: rows, error: ee }] =
        await Promise.all([
          sb
            .from("ropes_settings")
            .select(
              "site_id,total_lines,duration_min,paused,venue_name,client_theme,flow_paused,flow_pause_reason",
            )
            .eq("site_id", siteId)
            .maybeSingle(),
          // SECURITY: intentionally do NOT select phone/notes
          sb
            .from("ropes_entries_live")
            .select(
              "id,name,party_size,status,course_phase,queue_order,assigned_tag,lines_used,created_at,end_time",
            )
            .eq("site_id", siteId)
            .order("queue_order", { ascending: true }),
        ]);

      if (se) throw se;
      if (ee) throw ee;

      const mappedSettings = mapDbSettings(s);
      const mappedEntries = (Array.isArray(rows) ? rows : [])
        .map(mapDbEntry)
        .filter(Boolean);

      if (mappedSettings) setSettings(mappedSettings);
      setEntries(ensureQueueOrder(mappedEntries));
      setUpdatedAt(new Date().toISOString());
      setOnline(true);
      setLastError("");
    } catch (e) {
      console.error("[/client] refreshPublic failed:", e);
      setOnline(false);
      setLastError(summarizeSupabaseError(e));
    }
  }

  // Initial load + fallback refresh
  useEffect(() => {
    const sb = sbRef.current || makeSupabaseBrowser();
    sbRef.current = sb;

    if (!sb) {
      setOnline(false);
      setLastError(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in this build.",
      );
      return;
    }

    refreshPublic();

    const t = setInterval(() => refreshPublic(), FALLBACK_REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: instant UI from payload, then background truth refresh
  useEffect(() => {
    const sb = sbRef.current;
    if (!sb) return;

    let cancelled = false;
    let refreshTimer = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refreshPublic();
      }, 300);
    };

    async function sub() {
      try {
        const siteId = await loadSiteId(sb);
        if (!siteId || cancelled) return;

        try {
          if (channelRef.current) sb.removeChannel(channelRef.current);
        } catch {}
        channelRef.current = null;

        const ch = sb
          .channel(`rt-client:${siteId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "ropes_entries_live",
              filter: `site_id=eq.${siteId}`,
            },
            (payload) => {
              setOnline(true);
              setLastError("");
              setUpdatedAt(new Date().toISOString());

              const ev = payload?.eventType;
              if (!ev) return;

              setEntries((prev) => {
                const list = Array.isArray(prev) ? prev : [];

                if (ev === "DELETE") {
                  const id = payload?.old?.id;
                  if (!id) return list;
                  return ensureQueueOrder(list.filter((e) => e.id !== id));
                }

                const mapped = mapDbEntry(payload?.new);
                if (!mapped) return list;

                return ensureQueueOrder(upsertById(list, mapped));
              });

              scheduleRefresh();
            },
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "ropes_settings",
              filter: `site_id=eq.${siteId}`,
            },
            (payload) => {
              setOnline(true);
              setLastError("");
              setUpdatedAt(new Date().toISOString());

              const mapped = mapDbSettings(payload?.new);
              if (mapped) setSettings(mapped);

              scheduleRefresh();
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setOnline(true);
              setLastError("");
              refreshPublic();
            }
          });

        channelRef.current = ch;
      } catch (e) {
        console.error("[/client] realtime subscribe failed:", e);
        setOnline(false);
        setLastError(summarizeSupabaseError(e));
      }
    }

    sub();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = null;
      try {
        if (channelRef.current) sb.removeChannel(channelRef.current);
      } catch {}
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If tv=1, treat as "activated" layout-wise (but fullscreen still requires gesture)
  useEffect(() => {
    if (!tvMode) return;
    setActivated(true);
  }, [tvMode]);

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

  const activateFullscreen = async () => {
    setActivated(true);
    await requestFullscreen();
    // fullscreen state will sync via the event listener
  };

  // Only show fullscreen controls on screens bigger than a tablet
  // (and also allow tv=1 to show them, but still requires wide screen)
  const showFullscreenControls = isWideScreen && (tvMode || !isTouch);

  const offlineTitle = debug
    ? lastError || "Realtime connection"
    : "Realtime connection";

  return (
    <div
      className={`client-display ${themeClass} ${
        activated ? "client-active" : ""
      }`}
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

            <div className="client-pill" title={offlineTitle}>
              {online ? "Realtime" : "Offline"}
            </div>

            {updatedLabel ? (
              <div className="client-pill">
                Updated: <b>{updatedLabel}</b>
              </div>
            ) : null}

            {showFullscreenControls ? (
              !fullscreen ? (
                <button className="client-btn" onClick={activateFullscreen}>
                  {tvMode ? "Start TV Mode" : "Fullscreen"}
                </button>
              ) : (
                <div className="client-pill">Fullscreen</div>
              )
            ) : null}
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

        {settings?.flowPaused ? (
          <div className="paused-banner" style={{ marginTop: 12 }}>
            <div className="paused-title">Loading Temporarily Paused</div>
            <div className="paused-sub">
              Staff are temporarily paused from loading new groups.
              {String(settings?.flowPauseReason || "").trim() ? (
                <>
                  <br />
                  <b>Reason:</b> {String(settings.flowPauseReason).trim()}
                </>
              ) : null}
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
              Wait times update automatically.
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
            ) : settings?.flowPaused ? (
              <div className="client-empty">
                Loading is paused — please wait for staff instructions.
              </div>
            ) : (
              <>
                <div className="client-nextbox">
                  <div className="client-nextname">
                    {publicDisplayName(nextUp)}
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
                  Names show first name + last initial only.
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
