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

import { sendSms } from "@/app/lib/smsClient";
import { buildNotifyMessage } from "@/app/lib/ropesMessage";

import FlowPausedBanner from "@/app/components/ropes/FlowPausedBanner";
import CourseClosedBanner from "./components/ropes/CourseClosedBanner";

import { computeAlerts } from "@/app/lib/alerts";
import AlertToast from "@/app/components/ropes/AlertToast";

import ReservationsPopup from "@/app/components/ropes/ReservationsPopup";

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

  // ✅ reservations popup
  const [reservationsOpen, setReservationsOpen] = useState(false);

  // ✅ Unified right-side toast
  const [toastKey, setToastKey] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastTone, setToastTone] = useState("info"); // "success" | "warning" | "info"

  function fireToast(message, tone = "info") {
    const msg = String(message || "").trim();
    if (!msg) return;
    setToastMsg(msg);
    setToastTone(tone);
    setToastKey(`${Date.now()}:${Math.random().toString(16).slice(2)}`);
  }

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

  useEffect(() => {
    const onFocus = () => refreshFromStorage();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

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

  // ✅ reservations count for badge
  const reservationsCount = useMemo(
    () => entries.filter((e) => e.status === "RESERVED").length,
    [entries],
  );

  // ✅ Overdue loop → warning toast
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
      return;
    }

    try {
      setNotifyBusyId(entry.id);
      await sendSms({ to: entry.phone, message: msg });

      setEntries((prev) =>
        prev.map((e) =>
          e.id !== entry.id
            ? e
            : {
                ...e,
                lastNotifiedAt: new Date().toISOString(),
                notifiedCount: (e.notifiedCount || 0) + 1,
              },
        ),
      );

      fireToast("Text sent ✅", "success");
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
          linesUsed: partySize,
          notes,
          status: "WAITING",
          createdAt: new Date().toISOString(),
          queueOrder: Date.now() + Math.random(),
        },
      ]);
    });

    setNewGuest({ name: "", phone: "", partySize: 1, notes: "" });

    fireToast("Guest added ✅", "success");
  }

  function startGroup(id) {
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
          linesUsed: linesNeeded,
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

  // THIS IS FOR RESERVED CHECK-INS
  useEffect(() => {
    const t = setInterval(() => {
      const nowMs = Date.now();

      setEntries((prev) => {
        let changed = false;

        const next = prev.map((e) => {
          if (e.status !== "RESERVED") return e;
          const at = e.reserveAtISO ? new Date(e.reserveAtISO).getTime() : 0;
          if (!at || Number.isNaN(at)) return e;
          if (at > nowMs) return e;

          changed = true;
          return {
            ...e,
            status: "WAITING",
            queueOrder: nowMs - 10_000 + Math.random(),
          };
        });

        if (!changed) return prev;

        pushUndoSnapshot(prev);
        return ensureQueueOrder(next);
      });
    }, 15000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // THIS IS FOR RESERVED CHECK-INS ^^^

  const editingEntry = useMemo(() => {
    if (!editingId) return null;
    return entries.find((e) => e.id === editingId) || null;
  }, [editingId, entries]);

  function saveEdit(updated) {
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
    fireToast("Saved ✅", "success");
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
      />

      <FlowPausedBanner settings={settings} />
      <CourseClosedBanner settings={settings} />

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

      {/* ✅ Reservations popup */}
      <ReservationsPopup
        open={reservationsOpen}
        onClose={() => setReservationsOpen(false)}
        entries={entries}
        setEntries={setEntries}
        nowMs={now.getTime()}
      />

      {/* ✅ One toast system (right side), tone-based */}
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
