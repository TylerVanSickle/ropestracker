"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  loadEntries,
  loadSettings,
  subscribeToRopesStorage,
  normalizeEntries,
  patchEntry,
  extendEntryByMinutes,
  markEntryDone,
  formatTime,
  archiveFlaggedEntry,
  mergeEntries,
} from "@/app/lib/ropesStore";

import { COURSE_TAGS } from "../lib/ropesTags";
import { ensureQueueOrder } from "@/app/lib/ropesUtils";

import ArchiveModal from "@/app/components/ropes/ArchiveModal";

function minutesLeft(endTimeISO) {
  if (!endTimeISO) return null;
  const t = new Date(endTimeISO);
  if (Number.isNaN(t.getTime())) return null;
  return Math.ceil((t.getTime() - Date.now()) / 60000);
}

function isoPlusMinutes(mins) {
  const m = Math.max(1, Number(mins || 0));
  return new Date(Date.now() + m * 60 * 1000).toISOString();
}

function getAvailableTags(up, allTags) {
  const used = new Set((up || []).map((x) => x.assignedTag).filter(Boolean));
  return (allTags || []).filter((t) => !used.has(t));
}

function getDerived(entriesRaw, settings) {
  const { entries } = normalizeEntries(entriesRaw);
  const list = ensureQueueOrder(entries);

  const waiting = [];
  const up = [];

  for (const e of list) {
    const s = String(e.status || "").toUpperCase();
    if (s === "WAITING") waiting.push(e);
    else if (s === "UP") up.push(e);
  }

  waiting.sort((a, b) => {
    const ao = typeof a.queueOrder === "number" ? a.queueOrder : 0;
    const bo = typeof b.queueOrder === "number" ? b.queueOrder : 0;
    return ao - bo;
  });

  const totalLines = Math.max(0, Number(settings?.totalLines ?? 0));
  const now = Date.now();

  let used = 0;
  for (const e of up) {
    const needs = Math.max(1, Number(e.partySize || 1));
    const end = e.endTime ? new Date(e.endTime).getTime() : NaN;

    if (Number.isFinite(end) && end > now) used += needs;
    if (!Number.isFinite(end)) used += needs;
  }

  const availableLines = Math.max(0, totalLines - used);

  const sentUp = up
    .filter((e) => String(e.coursePhase || "").toUpperCase() === "SENT")
    .sort((a, b) => {
      const ao = new Date(
        a.sentUpAt || a.startedAt || a.createdAt || 0,
      ).getTime();
      const bo = new Date(
        b.sentUpAt || b.startedAt || b.createdAt || 0,
      ).getTime();
      return ao - bo;
    });

  const onCourse = up
    .filter((e) => String(e.coursePhase || "").toUpperCase() !== "SENT")
    .sort((a, b) => {
      const ao = new Date(
        a.startTime || a.startedAt || a.createdAt || 0,
      ).getTime();
      const bo = new Date(
        b.startTime || b.startedAt || b.createdAt || 0,
      ).getTime();
      return ao - bo;
    });

  return { waiting, up, sentUp, onCourse, availableLines, totalLines };
}

export default function TopRopesPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() => loadEntries());

  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const [showAllSent, setShowAllSent] = useState(false);

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

  useEffect(() => {
    const unsub = subscribeToRopesStorage(() => {
      setSettings(loadSettings());
      setEntries(loadEntries());
    });
    return () => unsub?.();
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
  const { waiting, up, sentUp, onCourse, availableLines, totalLines } = derived;

  const closed = Boolean(settings?.paused);

  const availableTagsGlobal = useMemo(
    () => getAvailableTags(up, COURSE_TAGS),
    [up],
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

  function handleFinish(entry) {
    if (!entry?.id) return;

    const name = String(entry.name || "this group");
    const ok = confirm(
      `Finish "${name}"?\n\nThis will mark them DONE and free up their lines.`,
    );
    if (!ok) return;

    const nextEntries = markEntryDone(entry.id);
    setLocalEntries(nextEntries);
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

    // cleanup merge selection
    setMergeIds((prev) => prev.filter((id) => id !== archiveEntry.id));

    closeArchive();
  }

  return (
    <main className="page" style={{ padding: "14px 14px 28px" }}>
      {/* Header */}
      <div className="topbar">
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Top Ropes</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              Operators: tag → Start Course • Desk: Send Up reserves lines
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link className="button" href="/">
              Bottom
            </Link>
            <Link className="button" href="/client" target="_blank">
              Client Display
            </Link>
            <Link className="button" href="/archive" target="_blank">
              Archive
            </Link>
            <Link className="button" href="/settings" target="_blank">
              Settings
            </Link>
          </div>
        </div>

        {/* Status strip */}
        <div
          className="card"
          style={{
            marginTop: 12,
            padding: 12,
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Status:
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {closed ? "CLOSED" : "OPEN"}
            </div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Lines:
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {availableLines} / {totalLines} free
            </div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Coming Up:
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{sentCount}</div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              On Course:
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{courseCount}</div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Waiting:
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{waitingCount}</div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Course Timer:
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {Number(settings?.topDurationMin ?? 35)} min
            </div>
          </div>
        </div>

        {closed ? (
          <div
            className="card"
            style={{
              marginTop: 12,
              border: "2px solid var(--danger, #ff4d4d)",
            }}
          >
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <strong>Closed</strong>
              <span className="muted">
                Start Course is disabled while Closed is on.
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.55fr 1fr",
          gap: 14,
          marginTop: 12,
          alignItems: "start",
        }}
      >
        {/* LEFT column */}
        <div style={{ display: "grid", gap: 14 }}>
          {/* Coming Up Now */}
          <section className="card">
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>
                Coming Up Now ({sentUp.length})
              </h2>

              <div
                className="row"
                style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}
              >
                {mergeIds.length ? (
                  <span className="pill">Selected: {mergeIds.length}/2</span>
                ) : null}

                {mergeIds.length === 2 ? (
                  <>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={doMergeSelected}
                    >
                      Merge Selected
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={clearMerge}
                    >
                      Clear
                    </button>
                  </>
                ) : mergeIds.length === 1 ? (
                  <button className="button" type="button" onClick={clearMerge}>
                    Clear
                  </button>
                ) : null}

                {sentUp.length > 5 ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => setShowAllSent((v) => !v)}
                  >
                    {showAllSent ? "View Less" : "View More"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Tip: Select 2 groups to merge if desk sent them up together.
            </div>

            {sentUp.length === 0 ? (
              <div className="item" style={{ padding: 14, marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  No groups coming up
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Desk hasn’t sent anyone up yet. When they hit{" "}
                  <strong>Send Up</strong>, groups will appear here.
                </div>
              </div>
            ) : (
              <div className="list spacer-sm" style={{ marginTop: 12 }}>
                {sentPreview.map((e) => {
                  const needs = Math.max(1, Number(e.partySize || 1));
                  const tagOptions = tagOptionsForEntry(e);
                  const selected = mergeIds.includes(e.id);

                  return (
                    <div
                      key={e.id}
                      className="item item-next"
                      style={{
                        padding: 14,
                        outline: selected
                          ? "2px solid var(--accent, #6aa9ff)"
                          : "none",
                      }}
                    >
                      <div className="item-main">
                        <div className="item-title" style={{ fontSize: 18 }}>
                          {e.name} <span className="pill">{needs} lines</span>{" "}
                          <span className="pill">COMING UP</span>
                          {e.assignedTag ? (
                            <span className="pill">{e.assignedTag}</span>
                          ) : null}
                          {selected ? (
                            <span className="pill">SELECTED</span>
                          ) : null}
                        </div>

                        {e.notes ? (
                          <div className="item-notes">📝 {e.notes}</div>
                        ) : null}

                        <div className="muted item-sub">
                          Sent up: {e.sentUpAt ? formatTime(e.sentUpAt) : "—"}
                        </div>

                        <div
                          className="row"
                          style={{
                            gap: 10,
                            marginTop: 10,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className="button"
                            type="button"
                            onClick={() => toggleMergeSelect(e.id)}
                          >
                            {selected ? "Unselect" : "Select"}
                          </button>

                          <label className="muted" style={{ fontSize: 13 }}>
                            Group Tag (required):
                          </label>

                          <select
                            className="input"
                            style={{ minWidth: 240, padding: 10 }}
                            value={e.assignedTag ?? ""}
                            onChange={(ev) =>
                              handleAssignTag(e.id, ev.target.value)
                            }
                          >
                            <option value="">Select a tag…</option>
                            {tagOptions.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>

                          <button
                            className="button"
                            type="button"
                            onClick={() => openEdit(e)}
                          >
                            Edit
                          </button>
                        </div>

                        {!e.assignedTag ? (
                          <div className="muted" style={{ marginTop: 10 }}>
                            Choose a tag to enable <strong>Start Course</strong>
                            .
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="item-actions"
                        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                      >
                        <button
                          className="button button-primary"
                          onClick={() => handleStartCourse(e)}
                          disabled={closed || !e.assignedTag}
                          type="button"
                          style={{ padding: "10px 14px" }}
                        >
                          Start Course ({Number(settings?.topDurationMin ?? 35)}
                          )
                        </button>

                        <button
                          className="button"
                          onClick={() => handleFinish(e)}
                          type="button"
                        >
                          Finish
                        </button>

                        <button
                          className="button"
                          onClick={() => openArchive(e)}
                          type="button"
                        >
                          Flag & Archive
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* On Course */}
          <section className="card">
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>
                On Course ({onCourse.length})
              </h2>
              <span className="muted" style={{ fontSize: 13 }}>
                +5 / End Early / Done / Edit / Archive
              </span>
            </div>

            {onCourse.length === 0 ? (
              <div className="item" style={{ padding: 14, marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  No one is on course
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  When you press <strong>Start Course</strong> for a Coming Up
                  group, they’ll appear here with a timer.
                </div>
              </div>
            ) : (
              <div className="list spacer-sm" style={{ marginTop: 12 }}>
                {onCourse.map((e) => {
                  const needs = Math.max(1, Number(e.partySize || 1));
                  const left = minutesLeft(e.endTime);
                  const leftText =
                    left == null
                      ? "—"
                      : left >= 0
                        ? `${left} min left`
                        : `${Math.abs(left)} min overdue`;

                  return (
                    <div key={e.id} className="item" style={{ padding: 14 }}>
                      <div className="item-main">
                        <div className="item-title" style={{ fontSize: 18 }}>
                          {e.name} <span className="pill">{needs} lines</span>{" "}
                          <span className="pill">ON COURSE</span>
                          {e.assignedTag ? (
                            <span className="pill">{e.assignedTag}</span>
                          ) : null}
                        </div>

                        <div className="muted item-sub">
                          Ends: {e.endTime ? formatTime(e.endTime) : "—"} •{" "}
                          <strong>{leftText}</strong>
                          {Number(e.timeAdjustMin || 0) ? (
                            <> • Adjusted: +{Number(e.timeAdjustMin || 0)}m</>
                          ) : null}
                        </div>

                        {e.notes ? (
                          <div className="item-notes" style={{ marginTop: 8 }}>
                            📝 {e.notes}
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="item-actions"
                        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                      >
                        <button
                          className="button"
                          onClick={() => handleExtend(e.id)}
                          type="button"
                        >
                          +5 min
                        </button>
                        <button
                          className="button button-primary"
                          onClick={() => handleFinish(e)}
                          type="button"
                          title="Marks group done and frees up lines"
                        >
                          Finish
                        </button>

                        <button
                          className="button"
                          onClick={() => openEdit(e)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="button"
                          onClick={() => openArchive(e)}
                          type="button"
                        >
                          Flag & Archive
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT column */}
        <div style={{ display: "grid", gap: 14 }}>
          {/* Waitlist */}
          <section className="card">
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>
                Waitlist ({waiting.length})
              </h2>

              {waiting.length > 8 ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => setShowAllWaiting((v) => !v)}
                >
                  {showAllWaiting ? "View Less" : "View More"}
                </button>
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>
                  Shows all
                </span>
              )}
            </div>

            {waiting.length === 0 ? (
              <div className="item" style={{ padding: 14, marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  Waitlist is empty
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  New groups will appear here after desk check-in.
                </div>
              </div>
            ) : (
              <div className="list spacer-sm" style={{ marginTop: 12 }}>
                {waitingPreview.map((e, idx) => (
                  <div key={e.id} className="item" style={{ padding: 12 }}>
                    <div className="item-title">
                      #{idx + 1} {e.name}{" "}
                      <span className="pill">
                        {Math.max(1, Number(e.partySize || 1))} lines
                      </span>
                    </div>
                    <div className="muted item-sub">
                      Added: {formatTime(e.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Operator Notes */}
          <section className="card">
            <details>
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  userSelect: "none",
                }}
              >
                <div>
                  <h2 className="section-title" style={{ margin: 0 }}>
                    Operator Notes
                  </h2>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Tap to expand (workflow + tools)
                  </div>
                </div>

                <span className="pill">Help</span>
              </summary>

              <div style={{ marginTop: 12 }}>
                <div className="item" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>Workflow</div>
                  <div
                    className="muted"
                    style={{ marginTop: 6, lineHeight: 1.5 }}
                  >
                    1) Desk hits <strong>Send Up</strong> → group appears in{" "}
                    <strong>Coming Up Now</strong>.
                    <br />
                    2) Choose <strong>Group Tag</strong> (required).
                    <br />
                    3) Press <strong>Start Course</strong> → timer starts and
                    moves to <strong>On Course</strong>.
                  </div>
                </div>

                <div className="item" style={{ padding: 12, marginTop: 10 }}>
                  <div style={{ fontWeight: 700 }}>Merge</div>
                  <div
                    className="muted"
                    style={{ marginTop: 6, lineHeight: 1.5 }}
                  >
                    If desk sent two groups up together (ex: 3 + 2), select both
                    in <strong>Coming Up Now</strong> and tap{" "}
                    <strong>Merge Selected</strong>.
                  </div>
                </div>

                <div className="item" style={{ padding: 12, marginTop: 10 }}>
                  <div style={{ fontWeight: 700 }}>Flag & Archive</div>
                  <div
                    className="muted"
                    style={{ marginTop: 6, lineHeight: 1.5 }}
                  >
                    Use <strong>Flag & Archive</strong> if a group is
                    disrespectful. It saves a record in{" "}
                    <strong>/archive</strong>. You can choose whether to remove
                    them from the active lists.
                  </div>
                </div>

                <div className="item" style={{ padding: 12, marginTop: 10 }}>
                  <div style={{ fontWeight: 700 }}>Closed</div>
                  <div
                    className="muted"
                    style={{ marginTop: 6, lineHeight: 1.5 }}
                  >
                    When Closed is on, <strong>Start Course</strong> is
                    disabled.
                  </div>
                </div>
              </div>
            </details>
          </section>
        </div>
      </div>

      {/* Archive Modal */}
      <ArchiveModal
        open={archiveOpen}
        entry={archiveEntry}
        onClose={closeArchive}
        onSubmit={handleArchiveSubmit}
      />

      {/* Edit Modal */}
      {editingId ? (
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
          onClick={closeEdit}
        >
          <div
            className="card"
            style={{ width: "min(720px, 100%)", padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>
                Edit Group
              </h2>
              <button className="button" onClick={closeEdit} type="button">
                Close
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px" }}>
                  <div
                    className="muted"
                    style={{ fontSize: 13, marginBottom: 6 }}
                  >
                    Name
                  </div>
                  <input
                    className="input"
                    style={{ width: "100%", padding: 10 }}
                    value={editDraft.name}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, name: e.target.value }))
                    }
                  />
                </div>

                <div style={{ width: 180 }}>
                  <div
                    className="muted"
                    style={{ fontSize: 13, marginBottom: 6 }}
                  >
                    Lines (party size)
                  </div>
                  <input
                    className="input"
                    style={{ width: "100%", padding: 10 }}
                    value={editDraft.partySize}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, partySize: e.target.value }))
                    }
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div
                className="row"
                style={{ gap: 12, marginTop: 12, flexWrap: "wrap" }}
              >
                <div style={{ flex: "1 1 260px" }}>
                  <div
                    className="muted"
                    style={{ fontSize: 13, marginBottom: 6 }}
                  >
                    Phone
                  </div>
                  <input
                    className="input"
                    style={{ width: "100%", padding: 10 }}
                    value={editDraft.phone}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, phone: e.target.value }))
                    }
                  />
                </div>

                <div style={{ flex: "2 1 340px" }}>
                  <div
                    className="muted"
                    style={{ fontSize: 13, marginBottom: 6 }}
                  >
                    Notes
                  </div>
                  <input
                    className="input"
                    style={{ width: "100%", padding: 10 }}
                    value={editDraft.notes}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, notes: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div
                className="row"
                style={{
                  gap: 10,
                  marginTop: 14,
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button className="button" onClick={closeEdit} type="button">
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  onClick={saveEdit}
                  type="button"
                >
                  Save Changes
                </button>
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Updates reflect on other screens on the same device/tabs.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
