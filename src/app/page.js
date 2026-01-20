"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadEntries,
  loadSettings,
  saveEntries,
  uid,
} from "@/app/lib/ropesStore";

import Topbar from "@/app/components/ropes/Topbar";
import CallNowBanner from "@/app/components/ropes/CallNowBanner";
import QuickQuote from "@/app/components/ropes/QuickQuote";
import AddGuestForm from "@/app/components/ropes/AddGuestForm";
import UpNowList from "@/app/components/ropes/UpNowList";
import WaitlingList from "@/app/components/ropes/WaitingList";
import EditEntryModal from "@/app/components/ropes/EditEntryModal";

import {
  buildSmsHref,
  computeEstimates,
  copyToClipboard,
  ensureQueueOrder,
  getWaitRangeText,
  minutesFromNow,
} from "@/app/lib/ropesUtils";

export default function Home() {
  const [settings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() => ensureQueueOrder(loadEntries()));
  const [now, setNow] = useState(new Date());

  const [newGuest, setNewGuest] = useState({
    name: "",
    phone: "",
    partySize: 1,
    notes: "",
  });

  // quote input: store as string (fixes typing bug)
  const [quoteSizeInput, setQuoteSizeInput] = useState("1");

  // edit modal
  const [editingId, setEditingId] = useState(null);

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

  // persist
  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

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

  // next-up estimate strings
  const nextEst = nextWaiting ? estimateMap.get(nextWaiting.id) : null;
  const nextEstStartText = nextEst?.estStartISO
    ? new Date(nextEst.estStartISO).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
  const nextWaitRange =
    nextEst?.estWaitMin != null ? getWaitRangeText(nextEst.estWaitMin) : "—";

  // quote calc
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

    setEntries((prev) =>
      ensureQueueOrder([
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
      ]),
    );

    setNewGuest({ name: "", phone: "", partySize: 1, notes: "" });
  }

  function startGroup(id) {
    setEntries((prev) => {
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
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "DONE" } : e)),
    );
  }

  function noShow(id) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "NOSHOW" } : e)),
    );
  }

  function remove(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function clearAll() {
    if (!confirm("Clear the entire waitlist + active runs?")) return;
    setEntries([]);
  }

  // reorder waiting: swap queueOrder with neighbor
  function moveWaiting(id, direction) {
    setEntries((prev) => {
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
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditingId(null);
  }

  return (
    <main className="container">
      <Topbar
        now={now}
        availableLines={availableLines}
        totalLines={settings.totalLines}
        onClearAll={clearAll}
      />

      <CallNowBanner
        nextWaiting={nextWaiting}
        nextNeeds={nextNeeds}
        nextCanStartNow={nextCanStartNow}
        nextEstStartText={nextEstStartText}
        nextWaitRange={nextWaitRange}
        onNotify={() => (nextWaiting ? notifyGuest(nextWaiting) : null)}
        onStartNext={() => (nextWaiting ? startGroup(nextWaiting.id) : null)}
      />

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
