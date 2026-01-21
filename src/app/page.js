"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@/app/lib/ropesStore";

import Topbar from "@/app/components/ropes/Topbar";
import CallNowBanner from "@/app/components/ropes/CallNowBanner";
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

function isPinValid(input, pin) {
  const a = String(input ?? "").trim();
  const b = String(pin ?? "").trim();
  return !!b && a === b;
}

export default function Home() {
  // IMPORTANT: settings should update when changed in /settings
  const [settings, setSettings] = useState(() => loadSettings());

  const [entries, setEntries] = useState(() => ensureQueueOrder(loadEntries()));
  const [now, setNow] = useState(() => new Date());

  // Undo stack persisted
  const [undoStack, setUndoStack] = useState(() => loadUndoStack());

  // PIN gate
  const [authed, setAuthed] = useState(() => {
    const s = loadSettings();
    const pin = String(s.staffPin || "").trim();
    if (!pin) return true; // no pin set
    const at = loadStaffAuthedAt();
    // keep it simple: if authed at exists, we’re in
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

  // keep settings + entries synced across tabs
  const refreshFromStorage = () => {
    setSettings(loadSettings());
    setEntries(ensureQueueOrder(loadEntries()));
    setUndoStack(loadUndoStack());
  };

  useEffect(() => {
    const unsub = subscribeToRopesStorage(refreshFromStorage);
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tick + auto-complete expired runs inside interval callback
  useEffect(() => {
    const t = setInterval(() => {
      const current = new Date();
      setNow(current);
      const nowMs = current.getTime();

      setEntries((prev) => {
        let changed = false;
        const next = prev.map((e) => {
          if (e.status !== "UP") return e;
          if (!e.endTime) return e;

          const endMs = new Date(e.endTime).getTime();
          if (!Number.isFinite(endMs)) return e;

          if (endMs <= nowMs) {
            changed = true;
            return { ...e, status: "DONE" };
          }
          return e;
        });

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(t);
  }, []);

  // persist entries (but DO NOT push undo here)
  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  // push undo snapshot before user actions
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

  // derived lists
  const waiting = useMemo(() => {
    return entries
      .filter((e) => e.status === "WAITING")
      .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0));
  }, [entries]);

  const active = useMemo(
    () => entries.filter((e) => e.status === "UP"),
    [entries],
  );

  const occupiedLines = active.reduce((sum, e) => sum + (e.linesUsed || 0), 0);
  const availableLines = Math.max(0, settings.totalLines - occupiedLines);

  const nextWaiting = waiting.length ? waiting[0] : null;
  const nextNeeds = nextWaiting
    ? Math.max(1, Number(nextWaiting.partySize || 1))
    : null;
  const nextCanStartNow = nextWaiting ? availableLines >= nextNeeds : false;

  // estimates (strict order)
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

  async function notifyGuest(entry) {
    if (!entry) return;

    const est = estimateMap.get(entry.id);
    const estStart = est?.estStartISO ? new Date(est.estStartISO) : null;
    const startText = estStart
      ? estStart.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "soon";

    const msg = `You're up next for the ropes course! Please return to check-in now.\nEstimated start: ${startText}`;

    if (entry.phone) {
      const href = buildSmsHref(entry.phone, msg);
      if (href) {
        window.location.href = href;
        return;
      }
    }

    const ok = await copyToClipboard(msg);
    alert(
      ok
        ? "Notification message copied to clipboard."
        : "Could not copy message.",
    );
  }

  function addGuest(e) {
    e.preventDefault();
    const name = newGuest.name.trim();
    if (!name) return;

    const partySize = Math.max(1, Number(newGuest.partySize || 1));
    const phone = newGuest.phone.trim();

    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return ensureQueueOrder([
        ...prev,
        {
          id: uid(),
          name,
          phone,
          partySize,
          notes: newGuest.notes.trim(),
          status: "WAITING",
          createdAt: new Date().toISOString(),
          queueOrder: Date.now() + Math.random(),
        },
      ]);
    });

    setNewGuest({ name: "", phone: "", partySize: 1, notes: "" });
  }

  function startGroup(id) {
    setEntries((prev) => {
      pushUndoSnapshot(prev);

      const waitingPrev = prev
        .filter((e) => e.status === "WAITING")
        .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0));

      if (!waitingPrev.length) return prev;

      const front = waitingPrev[0];
      if (front.id !== id) {
        alert("You can’t skip the line. Only the next group can start.");
        return prev;
      }

      const activePrev = prev.filter((e) => e.status === "UP");
      const occupiedPrev = activePrev.reduce(
        (sum, e) => sum + (e.linesUsed || 0),
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

      return prev.map((e) => {
        if (e.id !== id) return e;
        return {
          ...e,
          status: "UP",
          linesUsed: linesNeeded,
          startedAt: new Date().toISOString(),
          endTime: minutesFromNow(settings.durationMin),
        };
      });
    });
  }

  function completeGroup(id) {
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.map((e) => (e.id === id ? { ...e, status: "DONE" } : e));
    });
  }

  function noShow(id) {
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.map((e) => (e.id === id ? { ...e, status: "NOSHOW" } : e));
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
    setEntries((prev) => {
      pushUndoSnapshot(prev);
      return prev.map((e) => (e.id === updated.id ? updated : e));
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

  // PIN gate UI (if enabled)
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
    // send them to public display if they can’t access staff tools
    window.location.href = "/client";
  }

  if (requiresPin && !authed) {
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
                onChange={(e) => setPinInput(e.target.value)}
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

      <NextUpActions
        nextWaiting={nextWaiting}
        nextEstStartText={nextEstStartText}
        nextWaitRange={nextWaitRange}
        canStartNow={nextCanStartNow}
        onNotify={() => (nextWaiting ? notifyGuest(nextWaiting) : null)}
        onStart={() => (nextWaiting ? startGroup(nextWaiting.id) : null)}
        onEdit={() => (nextWaiting ? setEditingId(nextWaiting.id) : null)}
        onNoShow={() => (nextWaiting ? noShow(nextWaiting.id) : null)}
        onRemove={() => (nextWaiting ? remove(nextWaiting.id) : null)}
      />

      {/* 
      <CallNowBanner
        nextWaiting={nextWaiting}
        nextNeeds={nextNeeds}
        nextCanStartNow={nextCanStartNow}
        nextEstStartText={nextEstStartText}
        nextWaitRange={nextWaitRange}
        onNotify={() => (nextWaiting ? notifyGuest(nextWaiting) : null)}
        onStartNext={() => (nextWaiting ? startGroup(nextWaiting.id) : null)}
      /> */}

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

      <section className="grid-2 spacer-md">
        <UpNowList
          active={active}
          now={now}
          onComplete={completeGroup}
          onRemove={remove}
          onCopy={copyToClipboard}
          onEdit={(id) => setEditingId(id)}
        />

        <WaitlingList
          waiting={waiting}
          availableLines={availableLines}
          estimateMap={estimateMap}
          onEdit={(id) => setEditingId(id)}
          onMoveUp={(id) => moveWaiting(id, "UP")}
          onMoveDown={(id) => moveWaiting(id, "DOWN")}
          onNotify={(entry) => notifyGuest(entry)}
          onStart={startGroup}
          onNoShow={noShow}
          onRemove={remove}
        />
      </section>

      {editingEntry ? (
        <EditEntryModal
          key={editingEntry.id}
          entry={editingEntry}
          settings={settings}
          onClose={() => setEditingId(null)}
          onSave={saveEdit}
        />
      ) : null}
    </main>
  );
}
