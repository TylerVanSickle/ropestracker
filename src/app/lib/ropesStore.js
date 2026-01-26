// src/app/lib/ropesStore.js

export const MAX_SLING_LINES = 15;

export const LS_KEY_SETTINGS = "ropes_settings_v2";
export const LS_KEY_ENTRIES = "ropes_entries_v1";
export const LS_KEY_UPDATED_AT = "ropes_updatedAt_v1";
export const LS_KEY_VERSION = "ropes_version_v1";

export const LS_KEY_UNDO = "ropes_undo_v1";
export const LS_KEY_AUTH = "ropes_staff_authed_v1";

// archives: ropes_archive_YYYY-MM-DD
export const LS_KEY_ARCHIVE_PREFIX = "ropes_archive_";

/* DB-friendly collections (localStorage-only for now)  */
export const LS_KEY_GUEST_NOTES = "ropes_guest_notes_v1";
export const LS_KEY_FLAG_ARCHIVE = "ropes_flag_archive_v1";

/**
  Limits (DB-ready)
 *  */
export const LIMITS = {
  // entry fields
  entryName: 50,
  entryPhone: 14,
  entryIntakeNotes: 50,

  // collections
  guestNoteText: 500,

  // archive reason
  archiveReasonText: 220,

  // settings
  staffPinMaxDigits: 4,
};

/** =========================
 *  Helpers (safe for DB later)
 *  */
export function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  const i = Math.trunc(x);
  return Math.max(min, Math.min(max, i));
}

export function clampText(value, max) {
  const s = String(value ?? "");
  const trimmedStart = s.replace(/^\s+/, "");
  return trimmedStart.slice(0, max);
}

// ✅ exported because app/page.js imports it
export function digitsOnlyMax(s, maxDigits) {
  const raw = String(s ?? "");
  const digits = raw.replace(/\D/g, "");
  return digits.slice(0, maxDigits);
}

const DEFAULT_SETTINGS = {
  totalLines: 15,
  durationMin: 45,
  topDurationMin: 35, // timer when top operator starts the course
  stagingDurationMin: 45, // how long they have to arrive / hold time
  paused: false, // "closed" on client
  venueName: "Ropes Course Waitlist",
  clientTheme: "auto", // "auto" | "light" | "dark"
  staffPin: "", // if set, staff page requires PIN
  flowPaused: false,
  flowPauseReason: "",
  flowPausedAt: null, // ISO string or null
};

const BC_NAME = "ropes_waitlist_updates_v1";

function broadcastUpdate(type) {
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({ type, at: Date.now() });
    bc.close();
  } catch {
    // ok
  }
}

function bumpVersion() {
  try {
    const raw = localStorage.getItem(LS_KEY_VERSION);
    const n = raw ? Number(raw) : 0;
    const next = Number.isFinite(n) ? n + 1 : 1;
    localStorage.setItem(LS_KEY_VERSION, String(next));
  } catch {
    // ok
  }
}

function stampUpdatedAt() {
  try {
    localStorage.setItem(LS_KEY_UPDATED_AT, String(Date.now()));
  } catch {
    // ok
  }
}

function stampAll(type) {
  stampUpdatedAt();
  bumpVersion();
  broadcastUpdate(type);
}

/** =========================
 *  Generic list helpers
 *  */
function loadList(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveList(key, list, stampType) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
    stampAll(stampType);
  } catch {
    // ok
  }
}

export function loadUpdatedAt() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY_UPDATED_AT);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function loadVersion() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(LS_KEY_VERSION);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function loadSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = localStorage.getItem(LS_KEY_SETTINGS);
    const parsed = raw ? JSON.parse(raw) || {} : {};

    const totalLines = Math.min(
      MAX_SLING_LINES,
      Math.max(0, Number(parsed.totalLines ?? DEFAULT_SETTINGS.totalLines)),
    );

    const durationMin = Math.max(
      5,
      Math.min(180, Number(parsed.durationMin ?? DEFAULT_SETTINGS.durationMin)),
    );

    const topDurationMin = Math.max(
      5,
      Math.min(
        180,
        Number(parsed.topDurationMin ?? DEFAULT_SETTINGS.topDurationMin),
      ),
    );

    const stagingDurationMin = Math.max(
      5,
      Math.min(
        180,
        Number(
          parsed.stagingDurationMin ?? DEFAULT_SETTINGS.stagingDurationMin,
        ),
      ),
    );

    const paused = Boolean(parsed.paused ?? DEFAULT_SETTINGS.paused);

    const venueName = String(parsed.venueName ?? DEFAULT_SETTINGS.venueName)
      .trim()
      .slice(0, 60);

    const t = String(
      parsed.clientTheme ?? DEFAULT_SETTINGS.clientTheme,
    ).toLowerCase();
    const clientTheme =
      t === "dark" || t === "light" || t === "auto" ? t : "auto";

    // ✅ PIN: digits only, max 4
    const staffPin = digitsOnlyMax(
      parsed.staffPin ?? DEFAULT_SETTINGS.staffPin,
      LIMITS.staffPinMaxDigits,
    );

    // ✅ Flow control (Top can pause Bottom send-ups)
    const flowPaused = Boolean(
      parsed.flowPaused ?? DEFAULT_SETTINGS.flowPaused,
    );

    const flowPauseReason = String(
      parsed.flowPauseReason ?? DEFAULT_SETTINGS.flowPauseReason,
    )
      .trim()
      .slice(0, 120);

    let flowPausedAt = parsed.flowPausedAt ?? DEFAULT_SETTINGS.flowPausedAt;
    flowPausedAt = flowPausedAt ? String(flowPausedAt) : null;

    // Validate ISO date (if invalid, null it out)
    if (flowPausedAt) {
      const d = new Date(flowPausedAt);
      if (Number.isNaN(d.getTime())) flowPausedAt = null;
    }

    const settings = {
      totalLines,
      durationMin,
      topDurationMin,
      stagingDurationMin,
      paused,
      venueName,
      clientTheme,
      staffPin,

      flowPaused,
      flowPauseReason,
      flowPausedAt,
    };

    // normalize stored settings
    localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(settings));
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next) {
  if (typeof window === "undefined") return;

  try {
    // IMPORTANT: merge to avoid dropping new keys like flowPaused
    const current = loadSettings();
    const merged = { ...current, ...(next || {}) };

    localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(merged));

    // ✅ this is the "signal" that forces other screens to refresh
    localStorage.setItem(LS_KEY_UPDATED_AT, new Date().toISOString());

    // ✅ if your subscribeToRopesStorage listens to a custom event, fire it
    window.dispatchEvent(new Event("ropes_storage"));
  } catch {
    // ignore
  }
}

export function patchSettings(partial) {
  const current = loadSettings();
  const next = { ...current, ...(partial || {}) };
  saveSettings(next);
  return next;
}

export function loadEntries() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY_ENTRIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  if (typeof window === "undefined") return;
  const safe = Array.isArray(entries) ? entries : [];
  localStorage.setItem(LS_KEY_ENTRIES, JSON.stringify(safe));
  stampAll("ENTRIES_UPDATED");
}

export function subscribeToRopesStorage(cb) {
  if (typeof window === "undefined") return () => {};

  const handler = () => cb?.();

  // ✅ same-tab updates (our explicit signal)
  window.addEventListener("ropes_storage", handler);

  // ✅ cross-tab updates (native storage event)
  const onStorage = (e) => {
    if (!e) return;
    if (
      e.key === LS_KEY_ENTRIES ||
      e.key === LS_KEY_SETTINGS ||
      e.key === LS_KEY_UPDATED_AT
    ) {
      handler();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("ropes_storage", handler);
    window.removeEventListener("storage", onStorage);
  };
}

export function loadUndoStack() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY_UNDO);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUndoStack(stack) {
  if (typeof window === "undefined") return;
  try {
    const safe = Array.isArray(stack) ? stack : [];
    localStorage.setItem(LS_KEY_UNDO, JSON.stringify(safe));
  } catch {
    // ok
  }
}

export function loadStaffAuthedAt() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY_AUTH);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setStaffAuthedNow() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY_AUTH, String(Date.now()));
    stampAll("STAFF_AUTHED");
  } catch {
    // ok
  }
}

export function clearStaffAuth() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY_AUTH);
    stampAll("STAFF_AUTH_CLEARED");
  } catch {
    // ok
  }
}

/* =========================
   Archives (daily snapshot)
   */

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function getLocalDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

export function archiveToday({ entries, settings }) {
  if (typeof window === "undefined") return null;
  try {
    const key = LS_KEY_ARCHIVE_PREFIX + getLocalDateKey(new Date());
    const payload = {
      date: getLocalDateKey(new Date()),
      archivedAt: new Date().toISOString(),
      settings: settings || null,
      entries: Array.isArray(entries) ? entries : [],
    };
    localStorage.setItem(key, JSON.stringify(payload));
    stampAll("ARCHIVE_SAVED");
    return key;
  } catch {
    return null;
  }
}

export function listArchives() {
  if (typeof window === "undefined") return [];
  try {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(LS_KEY_ARCHIVE_PREFIX)) out.push(k);
    }
    out.sort((a, b) => (a < b ? 1 : -1)); // newest first
    return out;
  } catch {
    return [];
  }
}

export function loadArchive(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/* =========================
   Utilities
   */

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** =========================
 *  Guest Notes (per-entry)
 *  Bottom can add; Top can archive.
 *  */

export function loadGuestNotes() {
  return loadList(LS_KEY_GUEST_NOTES);
}

export function saveGuestNotes(notes) {
  saveList(LS_KEY_GUEST_NOTES, notes, "GUEST_NOTES_UPDATED");
}

export function addGuestNote({
  entryId,
  createdBy,
  text,
  visibility = "private",
  kind = "note",
}) {
  const note = {
    id: uid(),
    entryId: String(entryId),
    createdAt: Date.now(),
    createdBy: createdBy === "top" ? "top" : "bottom",
    visibility: visibility === "public" ? "public" : "private",
    kind: kind === "alert" ? "alert" : "note",
    text: clampText(text, LIMITS.guestNoteText),
  };

  const notes = loadGuestNotes();
  saveGuestNotes([note, ...notes]);
  return note;
}

export function getNotesForEntry(entryId) {
  const id = String(entryId);
  return loadGuestNotes().filter((n) => n && String(n.entryId) === id);
}

export function deleteNotesForEntry(entryId) {
  const id = String(entryId);
  const notes = loadGuestNotes();
  const next = notes.filter((n) => String(n.entryId) !== id);
  saveGuestNotes(next);
  return next;
}

/** =========================
 *  Flag Archive (problem groups)
 *  */

export function loadFlagArchive() {
  return loadList(LS_KEY_FLAG_ARCHIVE);
}

export function saveFlagArchive(list) {
  saveList(LS_KEY_FLAG_ARCHIVE, list, "FLAG_ARCHIVE_UPDATED");
}

export function archiveFlaggedEntry({
  entryId,
  archivedBy = "top",
  reason = "",
  removeFromActive = true,
  cleanupGuestNotes = false, // set true if you want to prune notes after archiving
} = {}) {
  const entries = loadEntries();
  const { entries: normalized } = normalizeEntries(entries);

  const target = normalized.find((e) => e && e.id === entryId);
  if (!target) return null;

  const guestNotes = getNotesForEntry(entryId);

  const record = {
    id: uid(),
    archivedAt: Date.now(),
    archivedBy: archivedBy === "bottom" ? "bottom" : "top",
    reason: clampText(reason, LIMITS.archiveReasonText).trim(),
    entrySnapshot: {
      id: String(target.id),
      name: clampText(String(target.name ?? ""), LIMITS.entryName).trim(),
      phone: clampText(String(target.phone ?? ""), LIMITS.entryPhone).trim(),
      partySize: Math.max(1, Number(target.partySize || 1)),
      notes: clampText(
        String(target.notes ?? ""),
        LIMITS.entryIntakeNotes,
      ).trim(),
      status: String(target.status ?? ""),
      createdAt: target.createdAt ?? null,
      sentUpAt: target.sentUpAt ?? null,
      startedAt: target.startedAt ?? null,
      assignedTag: target.assignedTag ?? null,
    },
    guestNotes: Array.isArray(guestNotes) ? guestNotes : [],
  };

  const list = loadFlagArchive();
  saveFlagArchive([record, ...list]);

  if (removeFromActive) {
    const nextEntries = normalized.filter((e) => e.id !== entryId);
    saveEntries(nextEntries);
  }

  if (cleanupGuestNotes) {
    deleteNotesForEntry(entryId);
  }

  stampAll("FLAG_ARCHIVED");
  return record;
}

export function deleteArchiveRecord(recordId) {
  const list = loadFlagArchive();
  const next = list.filter((r) => r && r.id !== recordId);
  saveFlagArchive(next);
  return next;
}

/*
 *  Merge (Top "Coming Up Now")
 *  */

export function mergeEntries(
  primaryId,
  secondaryId,
  { mergedBy = "top" } = {},
) {
  const aId = String(primaryId || "");
  const bId = String(secondaryId || "");
  if (!aId || !bId || aId === bId) return loadEntries();

  const entries = loadEntries();
  const { entries: normalized } = normalizeEntries(entries);

  const a = normalized.find((e) => e.id === aId);
  const b = normalized.find((e) => e.id === bId);
  if (!a || !b) return normalized;

  // Only merge "Coming Up" groups (SENT phase)
  const aPhase = String(a.coursePhase || "").toUpperCase();
  const bPhase = String(b.coursePhase || "").toUpperCase();
  if (aPhase !== "SENT" || bPhase !== "SENT") return normalized;

  const aSize = Math.max(1, Number(a.partySize || 1));
  const bSize = Math.max(1, Number(b.partySize || 1));
  const mergedPartySize = aSize + bSize;

  const aName = String(a.name || "").trim();
  const bName = String(b.name || "").trim();
  const mergedName = clampText(`${aName} + ${bName}`.trim(), LIMITS.entryName);

  const mergedPhone = clampText(
    (String(a.phone || "").trim() || String(b.phone || "").trim() || "").trim(),
    LIMITS.entryPhone,
  );

  // Tag logic:
  // - keep primary tag if set
  // - else take secondary tag
  // - if both exist but differ: clear to force re-select
  let assignedTag = a.assignedTag ?? null;
  if (!assignedTag && b.assignedTag) assignedTag = b.assignedTag;
  if (a.assignedTag && b.assignedTag && a.assignedTag !== b.assignedTag) {
    assignedTag = null;
  }

  const mergedNotesParts = [
    String(a.notes || "").trim(),
    String(b.notes || "").trim()
      ? `Merged: ${String(b.notes || "").trim()}`
      : "",
    `Merged by ${mergedBy === "bottom" ? "bottom" : "top"}`,
  ].filter(Boolean);

  const mergedNotes = clampText(
    mergedNotesParts.join(" • "),
    LIMITS.entryIntakeNotes,
  );

  // pick earliest sent time for display ordering
  const aSent = new Date(
    a.sentUpAt || a.startedAt || a.createdAt || 0,
  ).getTime();
  const bSent = new Date(
    b.sentUpAt || b.startedAt || b.createdAt || 0,
  ).getTime();
  const earliestSentUpAt =
    (Number.isFinite(aSent) ? aSent : 0) <= (Number.isFinite(bSent) ? bSent : 0)
      ? a.sentUpAt || a.startedAt || a.createdAt || null
      : b.sentUpAt || b.startedAt || b.createdAt || null;

  const nextEntries = normalized
    .map((e) => {
      if (e.id !== aId) return e;
      return {
        ...e,
        name: mergedName,
        phone: mergedPhone,
        partySize: mergedPartySize,
        notes: mergedNotes,
        assignedTag,
        sentUpAt: earliestSentUpAt ?? e.sentUpAt ?? null,
        // reserve combined lines while they walk up
        linesUsed: mergedPartySize,
      };
    })
    .filter((e) => e.id !== bId);

  saveEntries(nextEntries);

  // Move guest notes from secondary entryId -> primary entryId
  const notes = loadGuestNotes();
  const moved = notes.map((n) => {
    if (!n) return n;
    if (String(n.entryId) !== bId) return n;
    return { ...n, entryId: aId };
  });
  saveGuestNotes(moved);

  stampAll("ENTRIES_MERGED");
  return nextEntries;
}

/* =========================
   Entry normalization / patching
   */

export function normalizeEntry(e) {
  if (!e || typeof e !== "object") return e;

  const status = String(e.status || "").toUpperCase();

  // partySize as int >= 1
  const partyLines = Math.max(1, Math.trunc(Number(e.partySize || 1)) || 1);

  return {
    ...e,
    partySize: partyLines,
    assignedTag: e.assignedTag ?? null,
    endedEarlyAt: e.endedEarlyAt ?? null,
    timeAdjustMin: Number.isFinite(Number(e.timeAdjustMin))
      ? Number(e.timeAdjustMin)
      : 0,

    // if it's UP but missing linesUsed, infer from partySize
    ...(status === "UP" && !Number.isFinite(Number(e.linesUsed))
      ? { linesUsed: partyLines }
      : {}),
  };
}

export function normalizeEntries(list) {
  const arr = Array.isArray(list) ? list : [];
  const next = arr.map((e) => normalizeEntry(e));
  return { entries: next, changed: false };
}

export function patchEntry(entryId, patch) {
  const entries = loadEntries();
  const { entries: normalized } = normalizeEntries(entries);

  const next = normalized.map((e) =>
    e.id === entryId ? { ...e, ...patch } : e,
  );

  saveEntries(next);
  return next;
}

export function setEntryStatus(entryId, status) {
  return patchEntry(entryId, { status: String(status || "").toUpperCase() });
}

export function startEntry(entryId, durationMin) {
  const now = Date.now();
  const settings = loadSettings();

  const dur =
    Number.isFinite(Number(durationMin)) && Number(durationMin) > 0
      ? Number(durationMin)
      : Number(settings.stagingDurationMin);

  const startedAtISO = new Date(now).toISOString();
  const endTimeISO = new Date(now + dur * 60 * 1000).toISOString();

  const entries = loadEntries();
  const { entries: normalized } = normalizeEntries(entries);

  const next = normalized.map((e) => {
    if (e.id !== entryId) return e;

    const linesNeeded = Math.max(1, Math.trunc(Number(e.partySize || 1)) || 1);

    return {
      ...e,
      status: "UP",
      linesUsed: linesNeeded,
      startedAt: startedAtISO,
      startTime: startedAtISO,
      endTime: endTimeISO,
    };
  });

  saveEntries(next);
  return next;
}

export function extendEntryByMinutes(entryId, addMin) {
  const add = Number(addMin || 0);
  if (!Number.isFinite(add) || add <= 0) return loadEntries();

  const entries = loadEntries();
  const { entries: normalized } = normalizeEntries(entries);

  const next = normalized.map((e) => {
    if (e.id !== entryId) return e;

    const currentEnd = e.endTime ? new Date(e.endTime) : null;
    if (!currentEnd || Number.isNaN(currentEnd.getTime())) return e;

    const newEnd = new Date(
      currentEnd.getTime() + add * 60 * 1000,
    ).toISOString();

    return {
      ...e,
      endTime: newEnd,
      timeAdjustMin: (Number(e.timeAdjustMin || 0) || 0) + add,
    };
  });

  saveEntries(next);
  return next;
}

export function endEntryEarly(entryId) {
  return patchEntry(entryId, {
    status: "DONE",
    endedEarlyAt: new Date().toISOString(),
  });
}

export function markEntryDone(entryId) {
  return patchEntry(entryId, { status: "DONE", linesUsed: 0 });
}

export function sendUpEntry(entryId) {
  return patchEntry(entryId, {
    status: "STAGING",
    sentUpAt: new Date().toISOString(),
  });
}

export function startTopCourse(entryId, topDurationMin) {
  const now = Date.now();
  const dur = Math.max(5, Number(topDurationMin || 35));
  const startedAtISO = new Date(now).toISOString();
  const endTimeISO = new Date(now + dur * 60 * 1000).toISOString();

  const entries = loadEntries();
  const { entries: normalized } = normalizeEntries(entries);

  const next = normalized.map((e) => {
    if (e.id !== entryId) return e;

    const linesNeeded = Math.max(1, Math.trunc(Number(e.partySize || 1)) || 1);

    return {
      ...e,
      status: "UP",
      linesUsed: linesNeeded,
      startedAt: startedAtISO,
      startTime: startedAtISO,
      endTime: endTimeISO,
    };
  });

  saveEntries(next);
  return next;
}

// THIS IS FOR WHEN WE IMPLEMENT TWILLIO IT FORMATS PHONES
export function toE164US(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return null;

  // If 11 digits and starts with 1, keep it
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // If 10 digits, assume US and add +1
  if (digits.length === 10) return `+1${digits}`;

  // Anything else: reject
  return null;
}
