"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  loadEntries,
  loadSettings,
  subscribeToRopesStorage,
  patchEntry,
  extendEntryByMinutes,
  markEntryDone,
  archiveFlaggedEntry,
  mergeEntries,
} from "@/app/lib/ropesStore";

import { COURSE_TAG_LABELS } from "../lib/ropesTags";

import ArchiveModal from "@/app/components/ropes/ArchiveModal";
import ConfirmModal from "@/app/components/ropes/ConfirmModal";
import AlertToast from "@/app/components/ropes/AlertToast";

import TopHeader from "./components/TopHeader";
import ComingUpSection from "./components/ComingUpSection";
import OnCourseSection from "./components/OnCourseSection";
import WaitlistSection from "./components/WaitlistSection";
import OperatorNotesSection from "./components/OperatorNotesSection";
import EditGroupModal from "./components/EditGroupModal";

import {
  entryTintStyle,
  getAvailableTags,
  getDerived,
  isoPlusMinutes,
} from "./lib/topRopesHelpers";

export default function TopRopesPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() => loadEntries());

  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const [showAllSent, setShowAllSent] = useState(false);

  // ✅ Toast (with tone)
  const [toastKey, setToastKey] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [toastTone, setToastTone] = useState("info"); // success|warning|info
  const toastClearRef = useRef(null);

  function showToast(msg, tone = "info") {
    setToastMsg(String(msg || "").trim());
    setToastTone(tone);
    setToastKey((k) => k + 1);

    if (toastClearRef.current) clearTimeout(toastClearRef.current);
    toastClearRef.current = setTimeout(() => setToastMsg(""), 1800);
  }

  // Edit modal state
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    partySize: "",
    phone: "",
    notes: "",
  });

  // Merge selection (SENT only)
  const [mergeIds, setMergeIds] = useState([]); // up to 2 ids

  // Archive modal state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveEntry, setArchiveEntry] = useState(null);

  // Finish confirm modal state
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [finishEntry, setFinishEntry] = useState(null);

  useEffect(() => {
    const refresh = () => {
      setSettings(loadSettings());
      setEntries(loadEntries());
    };

    refresh();
    const unsub = subscribeToRopesStorage(refresh);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      unsub?.();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // tick for countdowns
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const derived = useMemo(
    () => getDerived(entries, settings),
    [entries, settings],
  );
  const { waiting, sentUp, onCourse, availableLines, totalLines } = derived;

  const closed = Boolean(settings?.paused);

  const availableTagsGlobal = useMemo(
    () => getAvailableTags(sentUp, COURSE_TAG_LABELS),
    [sentUp],
  );

  function setLocalEntries(nextEntries) {
    setEntries(nextEntries);
  }

  function tagOptionsForEntry(entry) {
    const current = entry?.assignedTag ? [entry.assignedTag] : [];
    return Array.from(new Set([...current, ...availableTagsGlobal]));
  }

  function handleAssignTag(entryId, tag) {
    const nextEntries = patchEntry(entryId, { assignedTag: tag || null });
    setLocalEntries(nextEntries);
    // optional: showToast("Tag saved ✅", "success");
  }

  function handleStartCourse(entry) {
    if (!entry) return;
    if (closed) return;
    if (!entry.assignedTag) return;

    const TOP_MIN = Number(settings?.topDurationMin ?? 35);

    const linesNeeded = Math.max(1, Number(entry.partySize || 1));
    const nowISO = new Date().toISOString();

    const nextEntries = patchEntry(entry.id, {
      coursePhase: "ON_COURSE",
      linesUsed: Number.isFinite(Number(entry.linesUsed))
        ? entry.linesUsed
        : linesNeeded,
      startedAt: entry.startedAt || nowISO,
      startTime: nowISO,
      endTime: isoPlusMinutes(TOP_MIN),
    });

    setLocalEntries(nextEntries);
  }

  function handleExtend(entryId) {
    const nextEntries = extendEntryByMinutes(entryId, 5);
    setLocalEntries(nextEntries);
  }

  function openFinishConfirm(entry) {
    setFinishEntry(entry);
    setFinishConfirmOpen(true);
  }

  function closeFinishConfirm() {
    setFinishConfirmOpen(false);
    setFinishEntry(null);
  }

  function confirmFinish() {
    if (!finishEntry?.id) return;
    const nextEntries = markEntryDone(finishEntry.id);
    setLocalEntries(nextEntries);
    closeFinishConfirm();
    // optional: showToast("Finished ✅", "success");
  }

  function handleFinish(entry) {
    if (!entry?.id) return;
    openFinishConfirm(entry);
  }

  // ===== Edit modal =====
  function openEdit(entry) {
    setEditingId(entry.id);
    setEditDraft({
      name: String(entry.name ?? ""),
      partySize: String(entry.partySize ?? ""),
      phone: String(entry.phone ?? ""),
      notes: String(entry.notes ?? ""),
    });
  }

  function closeEdit() {
    setEditingId(null);
    setEditDraft({ name: "", partySize: "", phone: "", notes: "" });
  }

  function saveEdit() {
    if (!editingId) return;

    const name = String(editDraft.name || "")
      .trim()
      .slice(0, 40);
    const partySizeNum = Math.max(
      1,
      Math.min(15, Number(editDraft.partySize || 1)),
    );
    const phone = String(editDraft.phone || "")
      .trim()
      .slice(0, 20);
    const notes = String(editDraft.notes || "")
      .trim()
      .slice(0, 120);

    const nextEntries = patchEntry(editingId, {
      name,
      partySize: partySizeNum,
      phone,
      notes,
    });

    setLocalEntries(nextEntries);

    // ✅ GREEN save
    showToast("Saved ✅", "success");

    closeEdit();
  }

  const waitingPreview = showAllWaiting ? waiting : waiting.slice(0, 8);
  const sentPreview = showAllSent ? sentUp : sentUp.slice(0, 5);

  const sentCount = sentUp.length;
  const courseCount = onCourse.length;
  const waitingCount = waiting.length;

  // ===== Merge =====
  function toggleMergeSelect(entryId) {
    setMergeIds((prev) => {
      const has = prev.includes(entryId);
      if (has) return prev.filter((id) => id !== entryId);
      if (prev.length >= 2) return [prev[1], entryId];
      return [...prev, entryId];
    });
  }

  function clearMerge() {
    setMergeIds([]);
  }

  function doMergeSelected() {
    if (mergeIds.length !== 2) return;

    const primaryId = mergeIds[0];
    const secondaryId = mergeIds[1];

    const a = sentUp.find((x) => x.id === primaryId);
    const b = sentUp.find((x) => x.id === secondaryId);

    if (!a || !b) {
      alert("Merge only works for Coming Up groups.");
      clearMerge();
      return;
    }

    const ok = confirm(
      `Merge these groups?\n\n1) ${a.name} (${a.partySize || 1})\n2) ${b.name} (${b.partySize || 1})\n\nThis will combine them into one group.`,
    );
    if (!ok) return;

    const nextEntries = mergeEntries(primaryId, secondaryId, {
      mergedBy: "top",
    });
    setLocalEntries(nextEntries);
    clearMerge();
    // optional: showToast("Merged ✅", "success");
  }

  // ===== Archive Modal =====
  function openArchive(entry) {
    setArchiveEntry(entry);
    setArchiveOpen(true);
  }

  function closeArchive() {
    setArchiveOpen(false);
    setArchiveEntry(null);
  }

  function handleArchiveSubmit({ reason, note, mode }) {
    if (!archiveEntry) return;

    const r = String(reason || "").trim();
    const n = String(note || "").trim();
    if (r.length < 3) {
      alert("Please enter a short reason.");
      return;
    }

    const combined = n ? `${r} • Note: ${n}` : r;
    const removeFromActive = String(mode) !== "KEEP";

    archiveFlaggedEntry({
      entryId: archiveEntry.id,
      archivedBy: "top",
      reason: combined,
      removeFromActive,
    });

    if (removeFromActive) {
      setEntries((prev) => prev.filter((e) => e.id !== archiveEntry.id));
    }

    setMergeIds((prev) => prev.filter((id) => id !== archiveEntry.id));
    closeArchive();

    // optional: showToast("Archived ✅", "success");
  }

  return (
    <main className="page" style={{ padding: "14px 14px 28px" }}>
      {/* ✅ Toast (top-right slide) */}
      <AlertToast
        toastKey={toastKey}
        message={toastMsg}
        tone={toastTone}
        durationMs={1600}
        side="right"
      />

      <TopHeader
        closed={closed}
        availableLines={availableLines}
        totalLines={totalLines}
        sentCount={sentCount}
        courseCount={courseCount}
        waitingCount={waitingCount}
        settings={settings}
      />

      <div className="topBody">
        <div style={{ display: "grid", gap: 14 }}>
          <ComingUpSection
            sentUp={sentUp}
            sentPreview={sentPreview}
            settings={settings}
            closed={closed}
            mergeIds={mergeIds}
            showAllSent={showAllSent}
            setShowAllSent={setShowAllSent}
            toggleMergeSelect={toggleMergeSelect}
            doMergeSelected={doMergeSelected}
            clearMerge={clearMerge}
            tagOptionsForEntry={tagOptionsForEntry}
            handleAssignTag={handleAssignTag}
            openEdit={openEdit}
            handleStartCourse={handleStartCourse}
            handleFinish={handleFinish}
            openArchive={openArchive}
            entryTintStyle={entryTintStyle}
          />

          <OnCourseSection
            onCourse={onCourse}
            handleExtend={handleExtend}
            handleFinish={handleFinish}
            openEdit={openEdit}
            openArchive={openArchive}
            entryTintStyle={entryTintStyle}
          />
        </div>

        <div style={{ display: "grid", marginTop: 14, gap: 14 }}>
          <WaitlistSection
            waiting={waiting}
            waitingPreview={waitingPreview}
            showAllWaiting={showAllWaiting}
            setShowAllWaiting={setShowAllWaiting}
          />
          <OperatorNotesSection />
        </div>
      </div>

      <ConfirmModal
        open={finishConfirmOpen}
        title="Finish group?"
        message={
          finishEntry
            ? `Finish "${String(finishEntry.name || "this group")}"?\n\nThis will mark them DONE and free up their lines.`
            : ""
        }
        confirmText="Finish"
        cancelText="Cancel"
        tone="danger"
        onClose={closeFinishConfirm}
        onConfirm={confirmFinish}
      />

      <ArchiveModal
        open={archiveOpen}
        entry={archiveEntry}
        onClose={closeArchive}
        onSubmit={handleArchiveSubmit}
      />

      <EditGroupModal
        open={Boolean(editingId)}
        editDraft={editDraft}
        setEditDraft={setEditDraft}
        closeEdit={closeEdit}
        saveEdit={saveEdit}
      />
    </main>
  );
}
