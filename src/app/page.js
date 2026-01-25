"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadEntries,
  loadSettings,
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
} from "@/app/lib/ropesStore";

import Topbar from "@/app/components/ropes/Topbar";
import QuickQuote from "@/app/components/ropes/QuickQuote";
import AddGuestForm from "@/app/components/ropes/AddGuestForm";
import UpNowList from "@/app/components/ropes/UpNowList";
import WaitlingList from "@/app/components/ropes/WaitingList";
import EditEntryModal from "@/app/components/ropes/EditEntryModal";
import NextUpActions from "@/app/components/ropes/NextUpActions";

import {
  buildSmsHref,
  computeEstimates,
  copyToClipboard,
  ensureQueueOrder,
  getWaitRangeText,
  minutesFromNow,
} from "@/app/lib/ropesUtils";

// ✅ add this
import { sendSms } from "@/app/lib/smsClient";
import { buildNotifyMessage } from "@/app/lib/ropesMessage";

// ✅ FIXED import (absolute path)
import FlowPausedBanner from "@/app/components/ropes/FlowPausedBanner";

function isPinValid(input, pin) {
  const a = digitsOnlyMax(input, LIMITS.staffPinMaxDigits);
  const b = digitsOnlyMax(pin, LIMITS.staffPinMaxDigits);
  return !!b && a === b;
}

export default function Home() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() => ensureQueueOrder(loadEntries()));
  const [now, setNow] = useState(() => new Date());

  const [undoStack, setUndoStack] = useState(() => loadUndoStack());

  // ✅ Toast (subtle "Added", etc.)
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false); // controls mount
  const [toastPhase, setToastPhase] = useState("out"); // "in" | "out"

  const toastOutTimerRef = useRef(null);
  const toastHideTimerRef = useRef(null);

  function showToast(msg, holdMs = 1500) {
    const text = String(msg || "").trim();
    if (!text) return;

    // clear any existing timers
    if (toastOutTimerRef.current) clearTimeout(toastOutTimerRef.current);
    if (toastHideTimerRef.current) clearTimeout(toastHideTimerRef.current);

    // IMPORTANT: mount it in the OUT position first (so enter animation works)
    setToast(text);
    setToastPhase("out");
    setToastVisible(true);

    // next frames -> slide IN (ensures browser sees the "out" state first)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setToastPhase("in");
      });
    });

    // after hold -> slide OUT
    toastOutTimerRef.current = setTimeout(() => {
      setToastPhase("out");
    }, holdMs);

    // after animation -> unmount
    toastHideTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setToast("");
    }, holdMs + 280); // matches transition duration below
  }

  // cleanup on unmount (prevents stray timers in dev)
  useEffect(() => {
    return () => {
      if (toastOutTimerRef.current) clearTimeout(toastOutTimerRef.current);
      if (toastHideTimerRef.current) clearTimeout(toastHideTimerRef.current);
    };
  }, []);

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

  // ✅ optional but helpful: track which entry is currently being notified
  const [notifyBusyId, setNotifyBusyId] = useState(null);

  const refreshFromStorage = () => {
    setSettings(loadSettings());
    setEntries(ensureQueueOrder(loadEntries()));
    setUndoStack(loadUndoStack());
  };

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const unsub = subscribeToRopesStorage(refreshFromStorage);
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Backup: when you come back to this tab, refresh immediately
  useEffect(() => {
    const onFocus = () => refreshFromStorage();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ tick only (NO auto-mutating entries)
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(t);
  }, []);

  // persist on actual edits only (buttons, modals, etc)
  useEffect(() => {
    saveEntries(entries);
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
        setEntries(ensureQueueOrder(top.entries));
      }
      saveUndoStack(rest);
      return rest;
    });
  }

  const waiting = useMemo(() => {
    return entries
      .filter((e) => e.status === "WAITING")
      .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0));
  }, [entries]);

  const active = useMemo(
    () => entries.filter((e) => e.status === "UP"),
    [entries],
  );

  // ✅ SINGLE SOURCE OF TRUTH: partySize == sling lines in use
  const occupiedLines = useMemo(() => {
    return active.reduce(
      (sum, e) => sum + Math.max(1, Number(e.partySize || 1)),
      0,
    );
  }, [active]);

  const availableLines = Math.max(0, settings.totalLines - occupiedLines);

  const nextWaiting = waiting.length ? waiting[0] : null;
  const nextNeeds = nextWaiting
    ? Math.max(1, Number(nextWaiting.partySize || 1))
    : null;

  // ✅ IMPORTANT: flowPaused blocks starts
  const nextCanStartNow = nextWaiting
    ? availableLines >= nextNeeds && !Boolean(settings.flowPaused)
    : false;

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

  // ✅ UPDATED: Twilio notify (graceful when SMS isn't connected)
  async function notifyGuest(entry) {
    if (!entry) return;

    // Prevent double taps
    if (notifyBusyId === entry.id) return;

    // Cooldown (2 minutes)
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

    const msg = buildNotifyMessage({
      entry,
      estStartText: startText,
    });

    // If they don't have a phone, keep old behavior: copy message
    if (!entry.phone) {
      const ok = await copyToClipboard(msg);
      alert(ok ? "Message copied to clipboard." : "Could not copy message.");
      return;
    }

    try {
      setNotifyBusyId(entry.id);

      // ✅ send via Twilio API route
      await sendSms({ to: entry.phone, message: msg });

      // ✅ update local entry so you can see "notified" state later (no DB needed)
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entry.id) return e;
          return {
            ...e,
            lastNotifiedAt: new Date().toISOString(),
            notifiedCount: (e.notifiedCount || 0) + 1,
          };
        }),
      );

      alert("Text sent ✅");
    } catch (e) {
      const err = String(e?.message || "");

      // 🚧 Twilio not connected / blocked by compliance (ex: 30032, 30034)
      if (
        err.includes("30032") ||
        err.includes("30034") ||
        err.includes("3003")
      ) {
        alert("SMS is currently unavailable (pending carrier approval).");
        return;
      }

      // Optional fallback: open phone SMS app
      const href = buildSmsHref(entry.phone, msg);
      if (href) {
        const ok = confirm("SMS failed.\n\nOpen your phone’s SMS app instead?");
        if (ok) window.location.href = href;
        return;
      }

      alert("Failed to send text.");
    } finally {
      setNotifyBusyId(null);
    }
  }

  function addGuest(e) {
    e.preventDefault();

    const name = clampText(newGuest.name, LIMITS.entryName).trim();
    if (!name) return;

    const phone = clampText(newGuest.phone, LIMITS.entryPhone).trim();
    const notes = clampText(newGuest.notes, LIMITS.entryIntakeNotes).trim();

    const maxLines = clampInt(settings.totalLines, 1, 15);
    const partySize = clampInt(newGuest.partySize || 1, 1, maxLines);

    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return ensureQueueOrder([
        ...prev,
        {
          id: uid(),
          name,
          phone,
          partySize,
          // keep legacy field in sync (harmless)
          linesUsed: partySize,
          notes,
          status: "WAITING",
          createdAt: new Date().toISOString(),
          queueOrder: Date.now() + Math.random(),
        },
      ]);
    });

    setNewGuest({ name: "", phone: "", partySize: 1, notes: "" });

    // ✅ subtle confirmation (slide in + hold + slide out)
    showToast("Guest added ✅", 1500);
  }

  function startGroup(id) {
    // ✅ HARD BLOCK: read fresh settings at click time (works even if React state lags)
    const s = loadSettings();
    if (s.flowPaused) {
      alert(
        s.flowPauseReason
          ? `Flow paused: ${s.flowPauseReason}`
          : "Flow is currently Paused by the Top Operators",
      );
      return;
    }

    const HOLD_MIN = settings.durationMin;

    setEntries((prev) => {
      pushUndoSnapshot(prev);

      const waitingPrev = prev
        .filter((e) => e.status === "WAITING")
        .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0));

      if (!waitingPrev.length) return prev;

      const front = waitingPrev[0];
      if (front.id !== id) {
        alert("You can’t skip the line. Only the next group can be sent up.");
        return prev;
      }

      const activePrev = prev.filter((e) => e.status === "UP");

      // ✅ SINGLE SOURCE OF TRUTH: partySize == sling lines in use
      const occupiedPrev = activePrev.reduce(
        (sum, e) => sum + Math.max(1, Number(e.partySize || 1)),
        0,
      );

      const availablePrev = Math.max(0, settings.totalLines - occupiedPrev);

      const linesNeeded = Math.max(1, Number(front.partySize || 1));

      if (linesNeeded > settings.totalLines) {
        alert(
          `This party needs ${linesNeeded} lines, but total available is set to ${settings.totalLines}.`,
        );
        return prev;
      }

      if (linesNeeded > availablePrev) {
        alert(
          `Not enough sling lines available right now. Available: ${availablePrev}, needed: ${linesNeeded}.`,
        );
        return prev;
      }

      const nowISO = new Date().toISOString();

      return prev.map((e) => {
        if (e.id !== id) return e;
        return {
          ...e,
          status: "UP",
          partySize: linesNeeded,
          linesUsed: linesNeeded, // keep legacy field in sync
          startedAt: nowISO,
          sentUpAt: nowISO,
          coursePhase: "SENT",
          endTime: minutesFromNow(HOLD_MIN),
        };
      });
    });
  }

  function completeGroup(id) {
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.map((e) =>
        e.id === id ? { ...e, status: "DONE", linesUsed: 0 } : e,
      );
    });
  }

  function remove(id) {
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.filter((e) => e.id !== id);
    });
  }

  function clearAll() {
    if (!confirm("Clear the entire waitlist + active runs?")) return;
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return [];
    });
  }

  function moveWaiting(id, direction) {
    setEntries((prev) => {
      pushUndoSnapshot(prev);

      const waitingPrev = prev
        .filter((e) => e.status === "WAITING")
        .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0));

      const idx = waitingPrev.findIndex((e) => e.id === id);
      if (idx < 0) return prev;

      const swapIdx = direction === "UP" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= waitingPrev.length) return prev;

      const a = waitingPrev[idx];
      const b = waitingPrev[swapIdx];

      const aOrder = a.queueOrder ?? 0;
      const bOrder = b.queueOrder ?? 0;

      return prev.map((e) => {
        if (e.id === a.id) return { ...e, queueOrder: bOrder };
        if (e.id === b.id) return { ...e, queueOrder: aOrder };
        return e;
      });
    });
  }

  const editingEntry = useMemo(() => {
    if (!editingId) return null;
    return entries.find((e) => e.id === editingId) || null;
  }, [editingId, entries]);

  function saveEdit(updated) {
    // ✅ make absolutely sure the invariant holds even if some other screen edits
    const coerced = {
      ...updated,
      partySize: Math.max(1, Number(updated.partySize || 1)),
    };
    coerced.linesUsed = coerced.partySize;

    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.map((e) => (e.id === coerced.id ? coerced : e));
    });
    setEditingId(null);
  }

  function doArchiveToday() {
    const key = archiveToday({ entries, settings });
    alert(key ? "Archived ✅" : "Could not archive.");
  }

  function openClient() {
    window.open("/client", "_blank", "noopener,noreferrer");
  }

  function openPrint() {
    window.open("/print", "_blank", "noopener,noreferrer");
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
      />

      {/* ✅ Styled + live banner */}
      <FlowPausedBanner settings={settings} />

      <QuickQuote
        quoteSizeInput={quoteSizeInput}
        setQuoteSizeInput={setQuoteSizeInput}
        quoteResult={quoteResult}
      />

      <AddGuestForm
        newGuest={newGuest}
        setNewGuest={setNewGuest}
        onAddGuest={addGuest}
      />

      <NextUpActions
        nextWaiting={nextWaiting}
        nextEstStartText={nextEstStartText}
        nextWaitRange={nextWaitRange}
        canStartNow={nextCanStartNow}
        onNotify={() => (nextWaiting ? notifyGuest(nextWaiting) : null)}
        onStart={() => (nextWaiting ? startGroup(nextWaiting.id) : null)}
        onEdit={() => (nextWaiting ? setEditingId(nextWaiting.id) : null)}
        onRemove={() => (nextWaiting ? remove(nextWaiting.id) : null)}
      />

      <section className="grid-2 spacer-md">
        <WaitlingList
          waiting={waiting}
          availableLines={availableLines}
          estimateMap={estimateMap}
          onEdit={(id) => setEditingId(id)}
          onMoveUp={(id) => moveWaiting(id, "UP")}
          onMoveDown={(id) => moveWaiting(id, "DOWN")}
          onNotify={(entry) => notifyGuest(entry)}
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
          onClose={() => setEditingId(null)}
          onSave={saveEdit}
          onRemove={remove}
          onComplete={completeGroup}
        />
      ) : null}

      {/* ✅ Toast (slides in, holds, slides out) */}
      {toastVisible && toast ? (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform:
              toastPhase === "in"
                ? "translateX(-50%) translateY(0)"
                : "translateX(-50%) translateY(28px)", // starts lower
            opacity: toastPhase === "in" ? 1 : 0,
            transition: "transform 280ms ease, opacity 280ms ease",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 9999,
            pointerEvents: "none",
            willChange: "transform, opacity",
          }}
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}
