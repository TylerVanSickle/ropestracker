// src/app/top/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import { loadEntries, loadSettings } from "@/app/lib/ropesStore";
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

const FALLBACK_REFRESH_MS = 15000;

function makeSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
}

// ---------- DB mapping helpers ----------
function mapDbSettings(db) {
  if (!db || typeof db !== "object") return null;
  return {
    siteId: db.site_id ?? null,
    totalLines: Number(db.total_lines ?? 15),
    durationMin: Number(db.duration_min ?? 45),
    topDurationMin: Number(db.top_duration_min ?? 35),
    stagingDurationMin: Number(db.staging_duration_min ?? 45),
    paused: Boolean(db.paused ?? false),
    venueName: String(db.venue_name ?? "Ropes Course"),
    clientTheme: String(db.client_theme ?? "auto"),
    staffPin: String(db.staff_pin ?? ""),
    flowPaused: Boolean(db.flow_paused ?? false),
    flowPauseReason: String(db.flow_pause_reason ?? ""),
    flowPausedAt: db.flow_paused_at ?? null,
  };
}

function mapDbEntry(db) {
  if (!db || typeof db !== "object") return null;
  return {
    id: db.id,
    name: db.name ?? "Guest",
    partySize: Number(db.party_size ?? 1),
    phone: db.phone ?? "",
    notes: db.notes ?? "",
    status: String(db.status ?? "WAITING"),
    coursePhase: db.course_phase ?? null,
    queueOrder:
      typeof db.queue_order === "number"
        ? db.queue_order
        : Number(db.queue_order ?? 0),
    assignedTag: db.assigned_tag ?? null,
    linesUsed: Number(db.lines_used ?? Number(db.party_size ?? 1)),
    timeAdjustMin: Number(db.time_adjust_min ?? 0),

    createdAt: db.created_at ?? null,
    sentUpAt: db.sent_up_at ?? null,
    startedAt: db.started_at ?? null,
    startTime: db.start_time ?? null,
    endTime: db.end_time ?? null,
    endedEarlyAt: db.ended_early_at ?? null,
  };
}

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

  if ("sentUpAt" in p) out.sent_up_at = p.sentUpAt ?? null;
  if ("startedAt" in p) out.started_at = p.startedAt ?? null;
  if ("startTime" in p) out.start_time = p.startTime ?? null;
  if ("endTime" in p) out.end_time = p.endTime ?? null;
  if ("endedEarlyAt" in p) out.ended_early_at = p.endedEarlyAt ?? null;

  return out;
}

// ---------- API wrappers (staff-only) ----------
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
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok)
    throw new Error(json?.error || "Failed to write state.");
  return json;
}

function upsertById(list, item) {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx < 0) return [...list, item];
  const next = list.slice();
  next[idx] = { ...next[idx], ...item };
  return next;
}

export default function TopRopesPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [entries, setEntries] = useState(() => loadEntries());

  const [remoteOnline, setRemoteOnline] = useState(false);
  const siteIdRef = useRef(null);

  const sbRef = useRef(null);
  const channelRef = useRef(null);

  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const [showAllSent, setShowAllSent] = useState(false);

  // Toast
  const [toastKey, setToastKey] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [toastTone, setToastTone] = useState("info");
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
  const [mergeIds, setMergeIds] = useState([]);

  // Archive modal state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveEntry, setArchiveEntry] = useState(null);

  // Finish confirm
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [finishEntry, setFinishEntry] = useState(null);

  function refreshFromLocal() {
    setSettings(loadSettings());
    setEntries(loadEntries());
  }

  async function refreshFromServer() {
    try {
      const json = await stateGet();
      const s = mapDbSettings(json.settings);
      const list = (Array.isArray(json.entries) ? json.entries : [])
        .map(mapDbEntry)
        .filter(Boolean);

      if (s) {
        setSettings(s);
        siteIdRef.current = s.siteId || siteIdRef.current;
      }
      setEntries(list);
      setRemoteOnline(true);
    } catch {
      setRemoteOnline(false);
    }
  }

  // Mount: local -> server; focus/visibility refresh
  useEffect(() => {
    refreshFromLocal();
    refreshFromServer();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fallback refresh
  useEffect(() => {
    const t = setInterval(() => refreshFromServer(), FALLBACK_REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime subscription
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
        .channel(`rt-top:${siteId}`)
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
                return list.filter((e) => e.id !== id);
              }

              const row = payload?.new;
              const mapped = mapDbEntry(row);
              if (!mapped) return list;

              return upsertById(list, mapped);
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
            const mapped = mapDbSettings(payload?.new);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function tagOptionsForEntry(entry) {
    const current = entry?.assignedTag ? [entry.assignedTag] : [];
    return Array.from(new Set([...current, ...availableTagsGlobal]));
  }

  async function patchEntryRemote(entryId, uiPatch) {
    // optimistic local
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, ...uiPatch } : e)),
    );

    try {
      await statePut({
        op: "PATCH_ENTRY",
        payload: { id: entryId, patch: toDbPatchFromUi(uiPatch) },
      });
      setRemoteOnline(true);
      // Realtime will reflect final state; no need to refresh
    } catch {
      setRemoteOnline(false);
      showToast("Saved locally — couldn’t sync", "warning");
    }
  }

  function handleAssignTag(entryId, tag) {
    patchEntryRemote(entryId, { assignedTag: tag || null });
  }

  function handleStartCourse(entry) {
    if (!entry) return;
    if (closed) return;
    if (!entry.assignedTag) return;

    const TOP_MIN = Number(settings?.topDurationMin ?? 35);
    const linesNeeded = Math.max(1, Number(entry.partySize || 1));
    const nowISO = new Date().toISOString();

    patchEntryRemote(entry.id, {
      coursePhase: "ON_COURSE",
      linesUsed: Number.isFinite(Number(entry.linesUsed))
        ? entry.linesUsed
        : linesNeeded,
      startedAt: entry.startedAt || nowISO,
      startTime: nowISO,
      endTime: isoPlusMinutes(TOP_MIN),
    });
  }

  function handleExtend(entryId) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    const currentEnd = entry.endTime ? new Date(entry.endTime) : null;
    const base =
      currentEnd && !isNaN(currentEnd.getTime()) ? currentEnd : new Date();
    const nextEnd = new Date(base.getTime() + 5 * 60 * 1000).toISOString();

    patchEntryRemote(entryId, { endTime: nextEnd });
  }

  function openFinishConfirm(entry) {
    setFinishEntry(entry);
    setFinishConfirmOpen(true);
  }

  function closeFinishConfirm() {
    setFinishConfirmOpen(false);
    setFinishEntry(null);
  }

  async function confirmFinish() {
    if (!finishEntry?.id) return;

    // optimistic local (remove or mark done)
    setEntries((prev) => prev.filter((e) => e.id !== finishEntry.id));

    try {
      await statePut({
        op: "MOVE_TO_HISTORY",
        payload: {
          id: finishEntry.id,
          status: "DONE",
          finish_reason: "Finished (top)",
        },
      });
      setRemoteOnline(true);
    } catch {
      setRemoteOnline(false);
      showToast("Finished locally — couldn’t sync", "warning");
    } finally {
      closeFinishConfirm();
    }
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

  async function saveEdit() {
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

    await patchEntryRemote(editingId, {
      name,
      partySize: partySizeNum,
      linesUsed: partySizeNum,
      phone,
      notes,
    });

    showToast("Saved", "success");
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

  async function doMergeSelected() {
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

    const mergedParty =
      Math.max(1, Number(a.partySize || 1)) +
      Math.max(1, Number(b.partySize || 1));
    const mergedNotes = [
      String(a.notes || "").trim(),
      String(b.notes || "").trim(),
      `Merged: ${a.name} + ${b.name}`,
    ]
      .filter(Boolean)
      .join(" • ")
      .slice(0, 200);

    // optimistic local
    setEntries((prev) =>
      prev
        .filter((e) => e.id !== secondaryId)
        .map((e) =>
          e.id !== primaryId
            ? e
            : {
                ...e,
                partySize: mergedParty,
                linesUsed: mergedParty,
                notes: mergedNotes,
              },
        ),
    );

    try {
      await Promise.all([
        statePut({
          op: "PATCH_ENTRY",
          payload: {
            id: primaryId,
            patch: {
              party_size: mergedParty,
              lines_used: mergedParty,
              notes: mergedNotes,
            },
          },
        }),
        statePut({ op: "DELETE_ENTRY", payload: { id: secondaryId } }),
      ]);

      setRemoteOnline(true);
      clearMerge();
    } catch {
      setRemoteOnline(false);
      showToast("Merged locally — couldn’t sync", "warning");
    }
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

  async function handleArchiveSubmit({ reason, note, mode }) {
    if (!archiveEntry) return;

    const r = String(reason || "").trim();
    const n = String(note || "").trim();
    if (r.length < 3) {
      alert("Please enter a short reason.");
      return;
    }

    const combined = n ? `${r} • Note: ${n}` : r;
    const removeFromActive = String(mode) !== "KEEP";

    // optimistic local
    if (removeFromActive) {
      setEntries((prev) => prev.filter((e) => e.id !== archiveEntry.id));
    } else {
      setEntries((prev) =>
        prev.map((e) =>
          e.id !== archiveEntry.id
            ? e
            : {
                ...e,
                notes: String(e.notes || "")
                  ? `${String(e.notes).slice(0, 180)} • FLAG: ${combined}`.slice(
                      0,
                      220,
                    )
                  : `FLAG: ${combined}`.slice(0, 220),
              },
        ),
      );
    }

    setMergeIds((prev) => prev.filter((id) => id !== archiveEntry.id));
    closeArchive();

    try {
      if (removeFromActive) {
        await statePut({
          op: "MOVE_TO_HISTORY",
          payload: {
            id: archiveEntry.id,
            status: "ARCHIVED",
            finish_reason: combined,
          },
        });
      } else {
        await statePut({
          op: "PATCH_ENTRY",
          payload: {
            id: archiveEntry.id,
            patch: { notes: `FLAG: ${combined}` },
          },
        });
      }
      setRemoteOnline(true);
    } catch {
      setRemoteOnline(false);
      showToast("Archived locally — couldn’t sync", "warning");
    }
  }

  return (
    <main className="page" style={{ padding: "14px 14px 28px" }}>
      <AlertToast
        toastKey={toastKey}
        message={toastMsg}
        tone={toastTone}
        durationMs={1600}
        side="right"
      />

      {/* <div className="muted helper" style={{ marginBottom: 8 }}>
        Sync:{" "}
        {remoteOnline ? "Online (Supabase Realtime)" : "Offline (fallback)"}
      </div> */}

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
            ? `Finish "${String(finishEntry.name || "this group")}"?\n\nThis will mark them DONE and move them to history.`
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
