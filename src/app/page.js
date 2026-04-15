// src/app/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  loadEntries,
  loadSettings,
  saveSettings, // kept (you may use later)
  saveEntries,
  uid,
  subscribeToRopesStorage,
  loadUndoStack,
  saveUndoStack,
  archiveToday,
  loadStaffAuthedAt,
  setStaffAuthedNow,
  LIMITS,
  clampText,
  clampInt,
  digitsOnlyMax,
  ensureQueueOrder, // use the store version (stable manual ordering)
} from "@/app/lib/ropesStore";

import Topbar from "@/app/components/ropes/Topbar";
import QuickQuote from "@/app/components/ropes/QuickQuote";
import AddGuestForm from "@/app/components/ropes/AddGuestForm";
import UpNowList from "@/app/components/ropes/UpNowList";
import WaitlingList from "@/app/components/ropes/WaitingList";
import EditEntryModal from "@/app/components/ropes/EditEntryModal";
import NextUpActions from "@/app/components/ropes/NextUpActions";
import ConfirmModal from "@/app/components/ropes/ConfirmModal";

import {
  buildSmsHref,
  computeEstimates,
  copyToClipboard,
  getWaitRangeText,
  minutesFromNow,
} from "@/app/lib/ropesUtils";

import { sendSms } from "@/app/lib/smsClient";
import { buildNotifyMessage } from "@/app/lib/ropesMessage";

import FlowPausedBanner from "@/app/components/ropes/FlowPausedBanner";
import CourseClosedBanner from "./components/ropes/CourseClosedBanner";

import { computeAlerts } from "@/app/lib/alerts";
import AlertToast from "@/app/components/ropes/AlertToast";

import ReservationsPopup from "@/app/components/ropes/ReservationsPopup";

const FALLBACK_REFRESH_MS = 15000; // fallback only (Realtime should handle instant)
const NOTIFY_TIMEOUT_MS = 5 * 60 * 1000; // 5-minute no-show window

// ---------- helpers ----------
function isPinValid(input, pin) {
  const a = digitsOnlyMax(input, LIMITS.staffPinMaxDigits);
  const b = digitsOnlyMax(pin, LIMITS.staffPinMaxDigits);
  return !!b && a === b;
}

function nowQueueOrderBigintSafe() {
  // BIGINT-safe integer (no decimals)
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function makeSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
}

function makeClientUuid() {
  // MUST be a UUID because DB column is uuid
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: if your uid() is not a UUID, the server will ignore it and DB will generate.
  return uid();
}

// ensure queueOrder is present on every entry (store helper mutates + returns changed boolean)
function ensureQueueOrderList(list) {
  const next = Array.isArray(list) ? list.slice() : [];
  ensureQueueOrder(next);
  return next;
}

// Simple collapsible — NO effects, NO persistence (fixes your lint rule)
function CollapsibleCard({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <section className="card spacer-sm" style={{ padding: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="button"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 12px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <span className="muted helper" style={{ margin: 0 }}>
            {open ? "Hide" : "Show"}
          </span>
        </div>

        <span
          aria-hidden="true"
          style={{
            fontSize: 14,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            lineHeight: 1,
          }}
        >
          ▾
        </span>
      </button>

      {open ? <div style={{ padding: "0 12px 12px" }}>{children}</div> : null}
    </section>
  );
}

// DB -> UI mapping (snake_case -> camelCase used in your app)
function mapDbSettings(db) {
  if (!db || typeof db !== "object") return null;
  return {
    siteId: db.site_id ?? null,
    totalLines: Number(db.total_lines ?? 15),
    durationMin: Number(db.duration_min ?? 45),
    topDurationMin: Number(db.top_duration_min ?? 35),
    stagingDurationMin: Number(db.staging_duration_min ?? 45),
    paused: Boolean(db.paused ?? false),
    venueName: String(db.venue_name ?? "Ropes Course Waitlist"),
    clientTheme: String(db.client_theme ?? "auto"),
    staffPin: String(db.staff_pin ?? ""),
    leadPin: String(db.lead_pin ?? ""),
    flowPaused: Boolean(db.flow_paused ?? false),
    flowPauseReason: String(db.flow_pause_reason ?? ""),
    flowPausedAt: db.flow_paused_at ?? null,
  };
}

function mapDbEntry(db) {
  if (!db || typeof db !== "object") return null;

  // IMPORTANT:
  // If queue_order is null/invalid, keep it as null (NOT 0),
  // so ensureQueueOrder can assign a stable value and we don’t “shuffle” later.
  const qo = Number(db.queue_order);
  const queueOrder = Number.isFinite(qo) && qo > 0 ? qo : null;

  return {
    id: db.id,
    name: db.name ?? "Guest",
    partySize: Number(db.party_size ?? 1),
    phone: db.phone ?? "",
    notes: db.notes ?? "",
    status: String(db.status ?? "WAITING"),
    coursePhase: db.course_phase ?? null,
    queueOrder,
    assignedTag: db.assigned_tag ?? null,
    linesUsed: Number(db.lines_used ?? Number(db.party_size ?? 1)),
    timeAdjustMin: Number(db.time_adjust_min ?? 0),

    createdAt: db.created_at ?? null,
    sentUpAt: db.sent_up_at ?? null,
    startedAt: db.started_at ?? null,
    startTime: db.start_time ?? null,
    endTime: db.end_time ?? null,
    endedEarlyAt: db.ended_early_at ?? null,

    lastNotifiedAt: db.last_notified_at ?? null,
    notifiedCount: db.notified_count ?? 0,
    reserveAtISO: db.reserve_at_iso ?? null,
    mergeHistory: db.merge_history ?? null,
  };
}

// UI -> DB patch mapping
function toDbPatchFromUi(patch) {
  const p = patch || {};
  const out = {};

  if ("name" in p) out.name = p.name ?? null;
  if ("partySize" in p) out.party_size = p.partySize ?? null;
  if ("phone" in p) out.phone = p.phone ? String(p.phone) : null;
  if ("notes" in p) out.notes = p.notes ? String(p.notes) : null;

  if ("status" in p) out.status = p.status ?? null;
  if ("coursePhase" in p) out.course_phase = p.coursePhase ?? null;
  if ("queueOrder" in p) out.queue_order = p.queueOrder ?? null;
  if ("assignedTag" in p) out.assigned_tag = p.assignedTag ?? null;
  if ("linesUsed" in p) out.lines_used = p.linesUsed ?? null;

  if ("timeAdjustMin" in p) out.time_adjust_min = p.timeAdjustMin ?? null;

  if ("createdAt" in p) out.created_at = p.createdAt ?? null;
  if ("sentUpAt" in p) out.sent_up_at = p.sentUpAt ?? null;
  if ("startedAt" in p) out.started_at = p.startedAt ?? null;
  if ("startTime" in p) out.start_time = p.startTime ?? null;
  if ("endTime" in p) out.end_time = p.endTime ?? null;
  if ("endedEarlyAt" in p) out.ended_early_at = p.endedEarlyAt ?? null;

  if ("lastNotifiedAt" in p) out.last_notified_at = p.lastNotifiedAt ?? null;
  if ("notifiedCount" in p) out.notified_count = p.notifiedCount ?? null;

  return out;
}

// ---------- API wrappers ----------
async function stateGet() {
  const res = await fetch("/api/state", { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok)
    throw new Error(json?.error || "Failed to load state.");
  return json;
}

async function statePut(body) {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ensure cookies are sent (staff wall)
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { ok: false, error: text || "Non-JSON response" };
  }

  if (!res.ok || !json?.ok) {
    const msg =
      json?.error ||
      `HTTP ${res.status} ${res.statusText}` ||
      "Failed to write state.";

    console.error("statePut failed:", {
      status: res.status,
      statusText: res.statusText,
      msg,
      json,
      body,
    });

    throw new Error(msg);
  }

  return json;
}

function upsertById(list, item) {
  const idx = list.findIndex((x) => String(x.id) === String(item.id));
  if (idx < 0) return [...list, item];
  const next = list.slice();
  next[idx] = { ...next[idx], ...item };
  return next;
}

export default function Home() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() =>
    ensureQueueOrderList(loadEntries()),
  );
  const entriesRef = useRef(entries);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const [now, setNow] = useState(() => new Date());

  const [undoStack, setUndoStack] = useState(() => loadUndoStack());

  // reservations popup
  const [reservationsOpen, setReservationsOpen] = useState(false);

  // Unified right-side toast
  const [toastKey, setToastKey] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastTone, setToastTone] = useState("info"); // success|warning|info

  function fireToast(message, tone = "info") {
    const msg = String(message || "").trim();
    if (!msg) return;
    setToastMsg(msg);
    setToastTone(tone);
    setToastKey(`${Date.now()}:${Math.random().toString(16).slice(2)}`);
  }

  // Remote sync status
  const [remoteOnline, setRemoteOnline] = useState(false);
  const siteIdRef = useRef(null);

  // Realtime client + channel refs
  const sbRef = useRef(null);
  const channelRef = useRef(null);

  // PIN gate
  const [authed, setAuthed] = useState(() => {
    const s = loadSettings();
    const pin = String(s.staffPin || "").trim();
    if (!pin) return true;
    const at = loadStaffAuthedAt();
    return !!at;
  });
  const [pinInput, setPinInput] = useState("");

  const [newGuest, setNewGuest] = useState({
    name: "",
    phone: "",
    partySize: 1,
    notes: "",
  });

  const [quoteSizeInput, setQuoteSizeInput] = useState("1");
  const [editingId, setEditingId] = useState(null);

  const [notifyBusyId, setNotifyBusyId] = useState(null);

  // Notify confirmation
  const [confirmNotifyEntry, setConfirmNotifyEntry] = useState(null);

  // Lead / Overdrive mode
  const [leadModeActive, setLeadModeActive] = useState(false);
  const [leadPinInput, setLeadPinInput] = useState("");
  const [leadPinOpen, setLeadPinOpen] = useState(false);

  // Alerts shown when a notify timer expires (cleared by staff)
  const [expiredNotifyAlerts, setExpiredNotifyAlerts] = useState([]);
  // Tracks which lastNotifiedAt timestamps have already been handled (avoid re-firing)
  const notifyExpiredHandledRef = useRef({});

  const refreshFromLocal = () => {
    setSettings(loadSettings());
    setEntries(ensureQueueOrderList(loadEntries()));
    setUndoStack(loadUndoStack());
  };

  const createLockRef = useRef(false);

  const refreshFromServer = async () => {
    try {
      const json = await stateGet();
      const nextSettings = mapDbSettings(json.settings);
      const nextEntries = (Array.isArray(json.entries) ? json.entries : [])
        .map(mapDbEntry)
        .filter(Boolean);

      setRemoteOnline(true);
      if (nextSettings) {
        setSettings(nextSettings);
        siteIdRef.current = nextSettings.siteId || siteIdRef.current;
      }

      const ensured = ensureQueueOrderList(nextEntries);
      setEntries(ensured);

      try {
        saveEntries(ensured);
      } catch {}
    } catch {
      setRemoteOnline(false);
    }
  };

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // local storage subscription
  useEffect(() => {
    const unsub = subscribeToRopesStorage(() => {
      if (!remoteOnline) refreshFromLocal();
    });
    return () => unsub?.();
  }, [remoteOnline]);

  // focus + visibility refresh
  useEffect(() => {
    const onFocus = () => refreshFromServer();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshFromServer();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // initial load
  useEffect(() => {
    (async () => {
      refreshFromLocal();
      await refreshFromServer();
    })();
  }, []);

  // fallback refresh (slow) in case realtime drops
  useEffect(() => {
    const t = setInterval(() => {
      refreshFromServer();
    }, FALLBACK_REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  // Setup Supabase Realtime subscription once we know site_id
  useEffect(() => {
    const sb = sbRef.current || makeSupabaseBrowser();
    sbRef.current = sb;
    if (!sb) return;

    let cancelled = false;

    async function ensureSiteIdThenSubscribe() {
      if (!siteIdRef.current) {
        await refreshFromServer();
      }
      const siteId = siteIdRef.current;
      if (!siteId || cancelled) return;

      try {
        if (channelRef.current) sb.removeChannel(channelRef.current);
      } catch {}
      channelRef.current = null;

      const ch = sb
        .channel(`rt-live:${siteId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ropes_entries_live",
            filter: `site_id=eq.${siteId}`,
          },
          (payload) => {
            const ev = payload?.eventType;
            if (!ev) return;

            setEntries((prev) => {
              const list = Array.isArray(prev) ? prev : [];

              if (ev === "DELETE") {
                const id = payload?.old?.id;
                if (!id) return list;
                const next = list.filter((e) => String(e.id) !== String(id));
                return ensureQueueOrderList(next);
              }

              const row = payload?.new;
              const mapped = mapDbEntry(row);
              if (!mapped) return list;

              // IMPORTANT: preserve local queueOrder if the incoming row has null queueOrder.
              // This prevents the DB/refresh stream from clobbering manual ordering
              // when queue_order is missing/late.
              const existing = list.find(
                (e) => String(e.id) === String(mapped.id),
              );
              const merged = existing
                ? {
                    ...existing,
                    ...mapped,
                    queueOrder:
                      mapped.queueOrder != null
                        ? mapped.queueOrder
                        : (existing.queueOrder ?? null),
                  }
                : mapped;

              const next = upsertById(list, merged);
              return ensureQueueOrderList(next);
            });

            setRemoteOnline(true);
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
            const row = payload?.new;
            const mapped = mapDbSettings(row);
            if (!mapped) return;
            setSettings(mapped);
            siteIdRef.current = mapped.siteId || siteIdRef.current;
            setRemoteOnline(true);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setRemoteOnline(true);
        });

      channelRef.current = ch;
    }

    ensureSiteIdThenSubscribe();

    return () => {
      cancelled = true;
      try {
        if (channelRef.current) sb.removeChannel(channelRef.current);
      } catch {}
      channelRef.current = null;
    };
  }, []);

  // keep local cache up to date
  useEffect(() => {
    try {
      saveEntries(entries);
    } catch {}
  }, [entries]);

  function pushUndoSnapshot(prevEntries) {
    const snap = {
      at: new Date().toISOString(),
      entries: Array.isArray(prevEntries) ? prevEntries : [],
    };
    setUndoStack((prev) => {
      const next = [snap, ...(Array.isArray(prev) ? prev : [])].slice(0, 20);
      saveUndoStack(next);
      return next;
    });
  }

  function undoLast() {
    setUndoStack((prev) => {
      if (!prev || prev.length === 0) return prev;
      const [top, ...rest] = prev;
      if (top?.entries) {
        setEntries(ensureQueueOrderList(top.entries));
      }
      saveUndoStack(rest);
      return rest;
    });
  }

  const waiting = useMemo(() => {
    return entries
      .filter((e) => String(e.status || "").toUpperCase() === "WAITING")
      .slice()
      .sort((a, b) => Number(a.queueOrder ?? 0) - Number(b.queueOrder ?? 0));
  }, [entries]);

  const active = useMemo(
    () => entries.filter((e) => String(e.status || "").toUpperCase() === "UP"),
    [entries],
  );

  const occupiedLines = useMemo(() => {
    return active.reduce(
      (sum, e) => sum + Math.max(1, Number(e.linesUsed ?? e.partySize ?? 1)),
      0,
    );
  }, [active]);

  const availableLines = Math.max(0, settings.totalLines - occupiedLines);

  const nextWaiting = waiting.length ? waiting[0] : null;
  const nextNeeds = nextWaiting
    ? Math.max(1, Number(nextWaiting.partySize || 1))
    : null;

  const nextCanStartNow = nextWaiting
    ? (leadModeActive || availableLines >= nextNeeds) &&
      !Boolean(settings.flowPaused)
    : false;

  const nextNotifyTs = nextWaiting?.lastNotifiedAt
    ? new Date(nextWaiting.lastNotifiedAt).getTime()
    : 0;
  const nextNotifySecondsLeft =
    nextNotifyTs && !leadModeActive
      ? Math.max(
          0,
          Math.ceil(
            (NOTIFY_TIMEOUT_MS - (now.getTime() - nextNotifyTs)) / 1000,
          ),
        )
      : 0;
  const nextNotifyBlocked = nextNotifySecondsLeft > 0;

  const estimateMap = useMemo(() => {
    return computeEstimates({
      totalLines: settings.totalLines,
      durationMin: settings.durationMin,
      active,
      waiting,
      now,
    });
  }, [settings.totalLines, settings.durationMin, active, waiting, now]);

  const nextEst = nextWaiting ? estimateMap.get(nextWaiting.id) : null;
  const nextEstStartText = nextEst?.estStartISO
    ? new Date(nextEst.estStartISO).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
  const nextWaitRange =
    nextEst?.estWaitMin != null ? getWaitRangeText(nextEst.estWaitMin) : "—";

  const quoteSize = useMemo(() => {
    const n = Number(quoteSizeInput);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.floor(n));
  }, [quoteSizeInput]);

  const quoteResult = useMemo(() => {
    const fakeId = "__QUOTE__";
    const fakeWaiting = [
      ...waiting,
      { id: fakeId, partySize: quoteSize, queueOrder: 999999999 },
    ];
    const m = computeEstimates({
      totalLines: settings.totalLines,
      durationMin: settings.durationMin,
      active,
      waiting: fakeWaiting,
      now,
    });
    const est = m.get(fakeId);
    if (!est || !est.estStartISO || est.estWaitMin == null) {
      return { range: "—", estStartText: "—" };
    }
    return {
      range: getWaitRangeText(est.estWaitMin),
      estStartText: new Date(est.estStartISO).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  }, [
    quoteSize,
    waiting,
    active,
    settings.totalLines,
    settings.durationMin,
    now,
  ]);

  const reservationsCount = useMemo(
    () =>
      entries.filter((e) => String(e.status || "").toUpperCase() === "RESERVED")
        .length,
    [entries],
  );

  // Overdue loop → warning toast
  const overdueShownRef = useRef({});
  useEffect(() => {
    const t = setInterval(() => {
      const alerts = computeAlerts({ entries, nowMs: Date.now() });
      const firstOverdue = alerts.find((a) => a.type === "OVERDUE_GROUP");
      if (!firstOverdue) return;

      const id = firstOverdue.entryId;
      const nowMs = Date.now();
      const lastShown = overdueShownRef.current[id] ?? 0;

      if (nowMs - lastShown < 3 * 60 * 1000) return;

      overdueShownRef.current[id] = nowMs;
      fireToast(firstOverdue.message, "warning");
    }, 20000);

    return () => clearInterval(t);
  }, [entries]);

  async function notifyGuest(entry) {
    if (!entry) return;
    if (notifyBusyId === entry.id) return;

    const COOLDOWN_MS = 2 * 60 * 1000;
    const last = entry.lastNotifiedAt
      ? new Date(entry.lastNotifiedAt).getTime()
      : 0;

    if (last && Date.now() - last < COOLDOWN_MS) {
      const minsLeft = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 60000);
      alert(`Already notified recently. Try again in ~${minsLeft} min.`);
      return;
    }

    const est = estimateMap.get(entry.id);
    const estStart = est?.estStartISO ? new Date(est.estStartISO) : null;
    const startText = estStart
      ? estStart.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "soon";

    const msg = buildNotifyMessage({ entry, estStartText: startText });

    if (!entry.phone) {
      const ok = await copyToClipboard(msg);
      alert(ok ? "Message copied to clipboard." : "Could not copy message.");
      if (ok) {
        const nowISO = new Date().toISOString();
        const newCount = (entry.notifiedCount || 0) + 1;
        setEntries((prev) =>
          prev.map((e) =>
            String(e.id) !== String(entry.id)
              ? e
              : { ...e, lastNotifiedAt: nowISO, notifiedCount: newCount },
          ),
        );
        statePut({
          op: "PATCH_ENTRY",
          payload: {
            id: entry.id,
            patch: toDbPatchFromUi({
              lastNotifiedAt: nowISO,
              notifiedCount: newCount,
            }),
          },
        }).catch(() => {});
      }
      return;
    }

    try {
      setNotifyBusyId(entry.id);
      await sendSms({ to: entry.phone, message: msg });

      const nowISO = new Date().toISOString();
      const newCount = (entry.notifiedCount || 0) + 1;
      setEntries((prev) =>
        prev.map((e) =>
          String(e.id) !== String(entry.id)
            ? e
            : { ...e, lastNotifiedAt: nowISO, notifiedCount: newCount },
        ),
      );
      statePut({
        op: "PATCH_ENTRY",
        payload: {
          id: entry.id,
          patch: toDbPatchFromUi({
            lastNotifiedAt: nowISO,
            notifiedCount: newCount,
          }),
        },
      }).catch(() => {});
      fireToast("Text sent", "success");
    } catch (e) {
      const err = String(e?.message || "");

      if (
        err.includes("30032") ||
        err.includes("30034") ||
        err.includes("3003")
      ) {
        fireToast("SMS unavailable (pending carrier approval)", "warning");
        return;
      }

      const href = buildSmsHref(entry.phone, msg);
      if (href) {
        const ok = confirm("SMS failed.\n\nOpen your phone’s SMS app instead?");
        if (ok) window.location.href = href;
        return;
      }

      fireToast("Failed to send text", "warning");
    } finally {
      setNotifyBusyId(null);
    }
  }

  async function addGuest(e) {
    e.preventDefault();

    // guard: prevents double submit / double click
    if (createLockRef.current) return;
    createLockRef.current = true;

    try {
      const name = clampText(newGuest.name, LIMITS.entryName).trim();
      if (!name) return;

      const phone = clampText(newGuest.phone, LIMITS.entryPhone).trim();
      const notes = clampText(newGuest.notes, LIMITS.entryIntakeNotes).trim();

      const maxLines = clampInt(
        settings.totalLines,
        1,
        leadModeActive ? 20 : 15,
      );
      const partySize = clampInt(newGuest.partySize || 1, 1, maxLines);

      // IMPORTANT: must be UUID if we send it to DB
      const localId = makeClientUuid();

      const createdAtISO = new Date().toISOString();
      const queueOrder = nowQueueOrderBigintSafe();

      // optimistic local
      setEntries((prev) => {
        pushUndoSnapshot(prev);
        const next = [
          ...prev,
          {
            id: localId,
            name,
            phone,
            partySize,
            linesUsed: partySize,
            notes,
            status: "WAITING",
            createdAt: createdAtISO,
            queueOrder,
          },
        ];
        return ensureQueueOrderList(next);
      });

      setNewGuest({ name: "", phone: "", partySize: 1, notes: "" });
      fireToast("Guest added", "success");

      try {
        await statePut({
          op: "CREATE_ENTRY",
          payload: {
            id: localId, // uuid
            name,
            party_size: partySize,
            phone: phone || null,
            notes: notes || null,
            status: "WAITING",
            queue_order: queueOrder,
            lines_used: partySize,
            created_at: createdAtISO,
          },
        });

        setRemoteOnline(true);
      } catch (err) {
        console.error("CREATE_ENTRY failed:", err);
        setRemoteOnline(false);
        fireToast(String(err?.message || "Couldn’t sync to server"), "warning");
      }
    } finally {
      // always release lock (even if validation returns early)
      createLockRef.current = false;
    }
  }

  async function startGroup(id) {
    const s = settings;
    if (s.flowPaused) {
      alert(
        s.flowPauseReason
          ? `Flow paused: ${s.flowPauseReason}`
          : "Flow is currently paused.",
      );
      return;
    }

    const HOLD_MIN = settings.durationMin;

    const waitingPrev = entriesRef.current
      .filter((e) => String(e.status || "").toUpperCase() === "WAITING")
      .slice()
      .sort((a, b) => Number(a.queueOrder ?? 0) - Number(b.queueOrder ?? 0));

    if (!waitingPrev.length) return;

    const front = waitingPrev[0];
    if (String(front.id) !== String(id)) {
      alert("You can’t skip the line. Only the next group can be sent up.");
      return;
    }

    const activePrev = entriesRef.current.filter(
      (e) => String(e.status || "").toUpperCase() === "UP",
    );
    const occupiedPrev = activePrev.reduce(
      (sum, e) => sum + Math.max(1, Number(e.linesUsed ?? e.partySize ?? 1)),
      0,
    );
    const availablePrev = Math.max(0, settings.totalLines - occupiedPrev);
    const linesNeeded = Math.max(1, Number(front.linesUsed ?? front.partySize ?? 1));

    if (!leadModeActive && linesNeeded > availablePrev) {
      alert(
        `Not enough sling lines available. Available: ${availablePrev}, needed: ${linesNeeded}.`,
      );
      return;
    }

    const nowISO = new Date().toISOString();
    const patch = {
      status: "UP",
      partySize: linesNeeded,
      linesUsed: linesNeeded,
      startedAt: nowISO,
      sentUpAt: nowISO,
      coursePhase: "SENT",
      endTime: minutesFromNow(HOLD_MIN),
    };

    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.map((e) =>
        String(e.id) !== String(id) ? e : { ...e, ...patch },
      );
    });

    try {
      await statePut({
        op: "PATCH_ENTRY",
        payload: { id, patch: toDbPatchFromUi(patch) },
      });
      setRemoteOnline(true);
    } catch (err) {
      console.error("PATCH_ENTRY (startGroup) failed:", err);
      setRemoteOnline(false);
      fireToast("Updated locally — couldn’t sync", "warning");
    }
  }

  async function completeGroup(id) {
    // optimistic local
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.map((e) =>
        String(e.id) === String(id)
          ? { ...e, status: "DONE", linesUsed: 0 }
          : e,
      );
    });

    // move to history so it disappears from live table too
    try {
      await statePut({
        op: "MOVE_TO_HISTORY",
        payload: { id, status: "DONE", finish_reason: "Finished (bottom)" },
      });
      setRemoteOnline(true);
    } catch (err) {
      console.error("MOVE_TO_HISTORY (completeGroup) failed:", err);
      setRemoteOnline(false);
      fireToast("Finished locally — couldn’t sync", "warning");
    }
  }

  async function remove(id) {
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.filter((e) => String(e.id) !== String(id));
    });

    try {
      await statePut({ op: "DELETE_ENTRY", payload: { id } });
      setRemoteOnline(true);
    } catch (err) {
      console.error("DELETE_ENTRY failed:", err);
      setRemoteOnline(false);
      fireToast("Removed locally — couldn’t sync", "warning");
    }
  }

  async function clearAll() {
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return [];
    });

    try {
      await statePut({
        op: "CLEAR_ALL_TO_HISTORY",
        payload: { status: "ARCHIVED", finish_reason: "Cleared list (bottom)" },
      });
      setRemoteOnline(true);
      fireToast("Cleared", "warning");
    } catch (err) {
      console.error("CLEAR_ALL_TO_HISTORY failed:", err);
      setRemoteOnline(false);
      fireToast("Cleared locally — couldn’t sync", "warning");
    }
  }

  // IMPORTANT: compute swap from the latest entries (via ref) to avoid “sometimes works”
  async function moveWaiting(id, direction) {
    const targetId = String(id);

    const current = Array.isArray(entriesRef.current) ? entriesRef.current : [];

    const waitingNow = current
      .filter((e) => String(e.status || "").toUpperCase() === "WAITING")
      .slice()
      .sort((a, b) => Number(a.queueOrder ?? 0) - Number(b.queueOrder ?? 0));

    const idx = waitingNow.findIndex((e) => String(e.id) === targetId);
    if (idx < 0) return;

    const swapIdx = direction === "UP" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= waitingNow.length) return;

    const a = waitingNow[idx];
    const b = waitingNow[swapIdx];

    const aOrder = Number(a.queueOrder);
    const bOrder = Number(b.queueOrder);

    if (
      !Number.isFinite(aOrder) ||
      !Number.isFinite(bOrder) ||
      aOrder <= 0 ||
      bOrder <= 0
    ) {
      // normalize locally then let them click again (prevents 0/0 no-op swaps)
      setEntries((prev) => {
        pushUndoSnapshot(prev);
        return ensureQueueOrderList(prev);
      });
      fireToast("Order normalized — try again", "info");
      return;
    }

    const swappedA = { id: a.id, queueOrder: bOrder };
    const swappedB = { id: b.id, queueOrder: aOrder };

    // optimistic local swap
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      const next = prev.map((e) => {
        const eid = String(e.id);
        if (eid === String(swappedA.id))
          return { ...e, queueOrder: swappedA.queueOrder };
        if (eid === String(swappedB.id))
          return { ...e, queueOrder: swappedB.queueOrder };
        return e;
      });
      return ensureQueueOrderList(next);
    });

    try {
      await Promise.all([
        statePut({
          op: "PATCH_ENTRY",
          payload: {
            id: swappedA.id,
            patch: toDbPatchFromUi({ queueOrder: swappedA.queueOrder }),
          },
        }),
        statePut({
          op: "PATCH_ENTRY",
          payload: {
            id: swappedB.id,
            patch: toDbPatchFromUi({ queueOrder: swappedB.queueOrder }),
          },
        }),
      ]);
      setRemoteOnline(true);
    } catch (err) {
      console.error("PATCH_ENTRY (moveWaiting) failed:", err);
      setRemoteOnline(false);
      fireToast("Reordered locally — couldn’t sync", "warning");
    }
  }

  // Notify expiry — after 5 min with no response, move group down one spot
  useEffect(() => {
    const nowMs = now.getTime();
    waiting.forEach((entry) => {
      if (!entry.lastNotifiedAt) return;
      const ts = new Date(entry.lastNotifiedAt).getTime();
      if (!ts || Number.isNaN(ts)) return;
      if (nowMs - ts < NOTIFY_TIMEOUT_MS) return; // not expired yet

      const lastHandled = notifyExpiredHandledRef.current[entry.id] ?? 0;
      if (lastHandled >= ts) return; // already handled this notification round

      notifyExpiredHandledRef.current[entry.id] = ts;

      setExpiredNotifyAlerts((prev) =>
        prev.find((a) => a.id === entry.id && a.ts === ts)
          ? prev
          : [...prev, { id: entry.id, name: entry.name, ts }],
      );
      moveWaiting(entry.id, "DOWN");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // RESERVED check-ins
  useEffect(() => {
    const t = setInterval(() => {
      const nowMs = Date.now();

      setEntries((prev) => {
        let changed = false;
        const transitioned = [];

        const next = prev.map((e) => {
          if (String(e.status || "").toUpperCase() !== "RESERVED") return e;
          const at = e.reserveAtISO ? new Date(e.reserveAtISO).getTime() : 0;
          if (!at || Number.isNaN(at)) return e;
          if (at > nowMs) return e;

          changed = true;
          const patch = {
            ...e,
            status: "WAITING",
            queueOrder: nowQueueOrderBigintSafe(),
          };
          transitioned.push({ id: e.id, queueOrder: patch.queueOrder });
          return patch;
        });

        if (!changed) return prev;

        pushUndoSnapshot(prev);

        if (transitioned.length) {
          Promise.all(
            transitioned.map((x) =>
              statePut({
                op: "PATCH_ENTRY",
                payload: {
                  id: x.id,
                  patch: toDbPatchFromUi({
                    status: "WAITING",
                    queueOrder: x.queueOrder,
                  }),
                },
              }),
            ),
          ).catch(() => setRemoteOnline(false));
        }

        return ensureQueueOrderList(next);
      });
    }, 15000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editingEntry = useMemo(() => {
    if (!editingId) return null;
    return entries.find((e) => String(e.id) === String(editingId)) || null;
  }, [editingId, entries]);

  async function saveEdit(updated) {
    const isUp = String(updated.status || "").toUpperCase() === "UP";
    const linesUsed = Math.max(1, Number(updated.linesUsed || 1));
    // For UP entries: keep original partySize (analytics). For WAITING: sync with linesUsed.
    const partySize = isUp
      ? Math.max(1, Number(updated.partySize || 1))
      : linesUsed;

    const coerced = { ...updated, partySize, linesUsed };

    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.map((e) =>
        String(e.id) === String(coerced.id) ? coerced : e,
      );
    });

    setEditingId(null);
    fireToast("Saved", "success");

    try {
      const patch = toDbPatchFromUi({
        name: coerced.name,
        // Only write party_size to DB for WAITING entries — UP entries preserve
        // the original registered count so analytics records the right number.
        ...(!isUp ? { partySize: coerced.partySize } : {}),
        phone: coerced.phone,
        notes: coerced.notes,
        linesUsed: coerced.linesUsed,
        assignedTag: coerced.assignedTag ?? null,
        status: coerced.status,
        coursePhase: coerced.coursePhase ?? null,
        queueOrder: coerced.queueOrder ?? null,
        startTime: coerced.startTime ?? null,
        endTime: coerced.endTime ?? null,
        sentUpAt: coerced.sentUpAt ?? null,
        startedAt: coerced.startedAt ?? null,
        endedEarlyAt: coerced.endedEarlyAt ?? null,
        timeAdjustMin: coerced.timeAdjustMin ?? 0,
      });

      await statePut({ op: "PATCH_ENTRY", payload: { id: coerced.id, patch } });
      setRemoteOnline(true);
    } catch (err) {
      console.error("PATCH_ENTRY (saveEdit) failed:", err);
      setRemoteOnline(false);
      fireToast("Saved locally — couldn’t sync", "warning");
    }
  }

  function doArchiveToday() {
    const key = archiveToday({ entries, settings });
    alert(key ? "Archived" : "Could not archive.");
  }

  function openClient() {
    window.open("/client", "_blank", "noopener,noreferrer");
  }

  function openPrint() {
    window.open("/print", "_blank", "noopener,noreferrer");
  }

  function tryActivateLead(e) {
    e.preventDefault();
    const storedPin = settings.leadPin || "";
    if (!storedPin) {
      fireToast("No lead PIN set. Configure one in Settings.", "warning");
      setLeadPinOpen(false);
      setLeadPinInput("");
      return;
    }
    if (isPinValid(leadPinInput, storedPin)) {
      setLeadModeActive(true);
      setLeadPinOpen(false);
      setLeadPinInput("");
      fireToast("Lead mode active — up to 20 guests allowed", "success");
    } else {
      alert("Wrong lead PIN.");
      setLeadPinInput("");
    }
  }

  const staffPin = String(settings.staffPin || "").trim();
  const requiresPin = !!staffPin;

  function submitPin(e) {
    e.preventDefault();
    if (!requiresPin) {
      setAuthed(true);
      return;
    }

    if (isPinValid(pinInput, staffPin)) {
      setStaffAuthedNow();
      setAuthed(true);
      setPinInput("");
      return;
    }

    alert("Wrong PIN.");
    setPinInput("");
    window.location.href = "/client";
  }

  if (requiresPin && !authed) {
    if (!hydrated) return <main className="container" />;

    return (
      <main className="container">
        <div className="card spacer-md">
          <h1 className="title">Staff Access</h1>
          <p className="muted helper">
            Enter the staff PIN to access the waitlist tools.
          </p>

          <form className="guest-form spacer-sm" onSubmit={submitPin}>
            <label className="field">
              <span className="field-label">Staff PIN</span>
              <input
                className="input"
                value={pinInput}
                onChange={(e) =>
                  setPinInput(
                    digitsOnlyMax(e.target.value, LIMITS.staffPinMaxDigits),
                  )
                }
                inputMode="numeric"
                autoFocus
                autoComplete="off"
              />
            </label>

            <button className="button button-primary button-wide" type="submit">
              Unlock
            </button>

            <p className="muted helper">
              No PIN? Open the public screen instead: <strong>/client</strong>
            </p>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <Topbar
        now={now}
        availableLines={availableLines}
        totalLines={settings.totalLines}
        onClearAll={clearAll}
        onUndo={undoLast}
        canUndo={undoStack.length > 0}
        onArchiveToday={doArchiveToday}
        onOpenClient={openClient}
        onOpenPrint={openPrint}
        onOpenReservations={() => setReservationsOpen(true)}
        reservationsCount={reservationsCount}
        leadModeActive={leadModeActive}
        onLeadMode={() => setLeadPinOpen(true)}
        onLeadModeOff={() => setLeadModeActive(false)}
      />

      <FlowPausedBanner settings={settings} />
      <CourseClosedBanner settings={settings} />

      <CollapsibleCard title="Next up actions" defaultOpen={false}>
        <NextUpActions
          nextWaiting={nextWaiting}
          nextEstStartText={nextEstStartText}
          nextWaitRange={nextWaitRange}
          canStartNow={nextCanStartNow}
          notifyBlocked={nextNotifyBlocked}
          notifySecondsLeft={nextNotifySecondsLeft}
          onNotify={() =>
            nextWaiting ? setConfirmNotifyEntry(nextWaiting) : null
          }
          onStart={() => (nextWaiting ? startGroup(nextWaiting.id) : null)}
          onEdit={() => (nextWaiting ? setEditingId(nextWaiting.id) : null)}
          onRemove={() => (nextWaiting ? remove(nextWaiting.id) : null)}
        />
      </CollapsibleCard>

      <CollapsibleCard title="Quick wait quote" defaultOpen={false}>
        <QuickQuote
          quoteSizeInput={quoteSizeInput}
          setQuoteSizeInput={setQuoteSizeInput}
          quoteResult={quoteResult}
        />
      </CollapsibleCard>

      <AddGuestForm
        newGuest={newGuest}
        setNewGuest={setNewGuest}
        onAddGuest={addGuest}
        overdriveMax={leadModeActive ? 20 : undefined}
      />

      {expiredNotifyAlerts.length > 0 && (
        <div
          className="card spacer-sm"
          style={{ borderLeft: "4px solid #f59e0b", padding: "10px 14px" }}
        >
          {expiredNotifyAlerts.map((a) => (
            <div
              key={a.id}
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 0",
                gap: 12,
              }}
            >
              <span>
                <strong>{a.name}</strong> | 5-minute window passed. Moved
                down a spot
              </span>
              <button
                className="button"
                type="button"
                onClick={() =>
                  setExpiredNotifyAlerts((prev) =>
                    prev.filter((x) => x.id !== a.id),
                  )
                }
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="grid-2 spacer-md">
        <WaitlingList
          waiting={waiting}
          availableLines={availableLines}
          totalLines={settings.totalLines}
          leadModeActive={leadModeActive}
          estimateMap={estimateMap}
          onEdit={(id) => setEditingId(id)}
          onMoveUp={(id) => moveWaiting(id, "UP")}
          onMoveDown={(id) => moveWaiting(id, "DOWN")}
          onNotify={(entry) => setConfirmNotifyEntry(entry)}
          onStart={startGroup}
          onRemove={remove}
        />

        <UpNowList
          active={active}
          now={now}
          onComplete={completeGroup}
          onRemove={remove}
          onCopy={copyToClipboard}
          onEdit={(id) => setEditingId(id)}
        />
      </section>

      {editingEntry ? (
        <EditEntryModal
          entry={editingEntry}
          settings={settings}
          overdriveMax={leadModeActive ? 20 : undefined}
          onClose={() => setEditingId(null)}
          onSave={saveEdit}
          onRemove={remove}
          onComplete={completeGroup}
        />
      ) : null}

      <ReservationsPopup
        open={reservationsOpen}
        onClose={() => setReservationsOpen(false)}
        entries={entries}
        setEntries={setEntries}
        nowMs={now.getTime()}
      />

      <ConfirmModal
        open={confirmNotifyEntry !== null}
        title="Send notification?"
        message={
          confirmNotifyEntry
            ? `Send a text message to ${confirmNotifyEntry.name}?`
            : ""
        }
        confirmText="Send"
        cancelText="Cancel"
        tone="primary"
        onClose={() => setConfirmNotifyEntry(null)}
        onConfirm={() => {
          const e = confirmNotifyEntry;
          setConfirmNotifyEntry(null);
          notifyGuest(e);
        }}
      />

      {leadPinOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 9999,
          }}
          onClick={() => {
            setLeadPinOpen(false);
            setLeadPinInput("");
          }}
        >
          <div
            className="card"
            style={{ width: "min(400px, 100%)", padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Lead Mode
            </h2>
            <p className="muted helper">
              Enter the lead PIN to allow overdrive — party sizes up to 20.
            </p>
            <form className="guest-form spacer-sm" onSubmit={tryActivateLead}>
              <label className="field">
                <span className="field-label">Lead PIN</span>
                <input
                  className="input"
                  value={leadPinInput}
                  onChange={(e) =>
                    setLeadPinInput(
                      digitsOnlyMax(e.target.value, LIMITS.staffPinMaxDigits),
                    )
                  }
                  inputMode="numeric"
                  autoFocus
                  autoComplete="off"
                />
              </label>
              <div className="row">
                <button className="button button-primary" type="submit">
                  Unlock
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setLeadPinOpen(false);
                    setLeadPinInput("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AlertToast
        toastKey={toastKey}
        message={toastMsg}
        durationMs={2200}
        side="right"
        tone={toastTone}
      />
    </main>
  );
}
