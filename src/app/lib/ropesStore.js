export const MAX_SLING_LINES = 15;

export const LS_KEY_SETTINGS = "ropes_settings_v2";
export const LS_KEY_ENTRIES = "ropes_entries_v1";
export const LS_KEY_UPDATED_AT = "ropes_updatedAt_v1";
export const LS_KEY_VERSION = "ropes_version_v1";

export const LS_KEY_UNDO = "ropes_undo_v1";
export const LS_KEY_AUTH = "ropes_staff_authed_v1";

// archives: ropes_archive_YYYY-MM-DD
export const LS_KEY_ARCHIVE_PREFIX = "ropes_archive_";

/** =========================
 *  NEW: DB-friendly collections
 *  ========================= */
export const LS_KEY_GUEST_NOTES = "ropes_guest_notes_v1";
export const LS_KEY_STAFF_FEED = "ropes_staff_feed_v1";
export const LS_KEY_PUBLIC_ANNOUNCEMENTS = "ropes_public_announcements_v1";

/** =========================
 *  Limits (DB-ready)
 *  ========================= */
export const LIMITS = {
  // entry fields
  entryName: 80,
  entryPhone: 24,
  entryIntakeNotes: 500,

  // collections
  guestNoteText: 1000,
  staffMessageText: 400,
  publicAnnouncementText: 220,

  // settings
  staffPinMaxDigits: 4,
};

/** =========================
 *  Helpers (safe for DB later)
 *  ========================= */
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

function digitsOnlyMax(s, maxDigits) {
  const raw = String(s ?? "");
  const digits = raw.replace(/\D/g, "");
  return digits.slice(0, maxDigits);
}

const DEFAULT_SETTINGS = {
  totalLines: 15,
  durationMin: 45,
  topDurationMin: 35, // timer when top operator starts the course
  stagingDurationMin: 45, // optional: how long they have to arrive (or omit)
  paused: false, // "closed" on client
  venueName: "Ropes Course Waitlist",
  clientTheme: "auto", // "auto" | "light" | "dark"
  staffPin: "3003", // if set, staff page requires PIN
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
 *  ========================= */
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

    const settings = {
      totalLines,
      durationMin,
      topDurationMin,
      stagingDurationMin,
      paused,
      venueName,
      clientTheme,
      staffPin,
    };

    localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(settings));

    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  if (typeof window === "undefined") return;
  const safe = settings || DEFAULT_SETTINGS;
  localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(safe));
  stampAll("SETTINGS_UPDATED");
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

export function subscribeToRopesStorage(onChange) {
  if (typeof window === "undefined") return () => {};

  const handler = (e) => {
    if (
      e.key === LS_KEY_SETTINGS ||
      e.key === LS_KEY_ENTRIES ||
      e.key === LS_KEY_UPDATED_AT ||
      e.key === LS_KEY_VERSION ||
      e.key === LS_KEY_GUEST_NOTES ||
      e.key === LS_KEY_STAFF_FEED ||
      e.key === LS_KEY_PUBLIC_ANNOUNCEMENTS
    ) {
      onChange?.();
    }
  };

  window.addEventListener("storage", handler);

  let bc = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = () => onChange?.();
  } catch {
    bc = null;
  }

  return () => {
    window.removeEventListener("storage", handler);
    if (bc) bc.close();
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
  } catch {
    // ok
  }
}

export function clearStaffAuth() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY_AUTH);
  } catch {
    // ok
  }
}

/* =========================
   Archives
   ========================= */

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
    // newest first
    out.sort((a, b) => (a < b ? 1 : -1));
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

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** =========================
 *  NEW: Guest Notes (DB-ready)
 *  ========================= */
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
  return loadGuestNotes().filter((n) => n.entryId === id);
}

/** =========================
 *  NEW: Staff Feed (Top/Bottom chat + alerts)
 *  ========================= */
export function loadStaffFeed() {
  return loadList(LS_KEY_STAFF_FEED);
}

export function saveStaffFeed(feed) {
  saveList(LS_KEY_STAFF_FEED, feed, "STAFF_FEED_UPDATED");
}

export function addStaffMessage({
  from,
  to = "all",
  severity = "info",
  text,
  entryId = null,
}) {
  const msg = {
    id: uid(),
    createdAt: Date.now(),
    from: from === "top" ? "top" : "bottom",
    to: to === "top" || to === "bottom" || to === "all" ? to : "all",
    severity: severity === "alert" ? "alert" : "info",
    text: clampText(text, LIMITS.staffMessageText),
    entryId: entryId ? String(entryId) : null,
  };

  const feed = loadStaffFeed();
  saveStaffFeed([msg, ...feed]);
  return msg;
}

/** =========================
 *  NEW: Public Announcements (Client TV)
 *  ========================= */
export function loadPublicAnnouncements() {
  return loadList(LS_KEY_PUBLIC_ANNOUNCEMENTS);
}

export function savePublicAnnouncements(list) {
  saveList(LS_KEY_PUBLIC_ANNOUNCEMENTS, list, "PUBLIC_ANNOUNCEMENTS_UPDATED");
}

export function addPublicAnnouncement({
  text,
  level = "info",
  expiresAt = null,
}) {
  const a = {
    id: uid(),
    createdAt: Date.now(),
    text: clampText(text, LIMITS.publicAnnouncementText),
    level: level === "warning" ? "warning" : "info",
    isActive: true,
    expiresAt: expiresAt ? Number(expiresAt) : null,
  };

  const list = loadPublicAnnouncements();
  savePublicAnnouncements([a, ...list]);
  return a;
}

export function dismissPublicAnnouncement(id) {
  const list = loadPublicAnnouncements();
  const next = list.map((a) => (a.id === id ? { ...a, isActive: false } : a));
  savePublicAnnouncements(next);
  return next;
}

/* =========================
   Entry normalization / patching
   ========================= */

export function normalizeEntry(e) {
  if (!e || typeof e !== "object") return e;

  const status = String(e.status || "").toUpperCase();
  const partyLines = Math.max(1, Number(e.partySize || 1));

  return {
    ...e,
    assignedTag: e.assignedTag ?? null,
    endedEarlyAt: e.endedEarlyAt ?? null,
    timeAdjustMin: Number.isFinite(Number(e.timeAdjustMin))
      ? Number(e.timeAdjustMin)
      : 0,

    // ✅ safety net: if it's UP but missing linesUsed, infer from partySize
    ...(status === "UP" && !Number.isFinite(Number(e.linesUsed))
      ? { linesUsed: partyLines }
      : {}),
  };
}

export function normalizeEntries(list) {
  const arr = Array.isArray(list) ? list : [];
  let changed = false;
  const next = arr.map((e) => {
    const ne = normalizeEntry(e);
    // Detect if we added defaults
    if (
      (e?.assignedTag ?? null) !== ne.assignedTag ||
      (e?.endedEarlyAt ?? null) !== ne.endedEarlyAt ||
      Number(e?.timeAdjustMin ?? 0) !== ne.timeAdjustMin
    ) {
      changed = true;
    }
    return ne;
  });
  return { entries: next, changed };
}

export function patchEntry(entryId, patch) {
  const entries = loadEntries();
  const { entries: normalized, changed } = normalizeEntries(entries);

  const next = normalized.map((e) =>
    e.id === entryId ? { ...e, ...patch } : e,
  );

  // If normalization changed anything, we still want to persist
  if (changed || next !== normalized) saveEntries(next);
  else saveEntries(next);

  return next;
}

export function setEntryStatus(entryId, status) {
  return patchEntry(entryId, { status: String(status || "").toUpperCase() });
}

export function startEntry(entryId, durationMin) {
  const now = Date.now();

  // 🔒 HARD SOURCE OF TRUTH
  const settings = loadSettings();

  const dur =
    Number.isFinite(Number(durationMin)) && Number(durationMin) > 0
      ? Number(durationMin)
      : Number(settings.stagingDurationMin);

  const startedAtISO = new Date(now).toISOString();
  const endTimeISO = new Date(now + dur * 60 * 1000).toISOString();

  console.log("[startEntry] duration used:", dur); // 👈 DEBUG, KEEP FOR NOW

  const entries = loadEntries();
  const { entries: normalized } = normalizeEntries(entries);

  const next = normalized.map((e) => {
    if (e.id !== entryId) return e;

    const linesNeeded = Math.max(1, Number(e.partySize || 1));

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
  return patchEntry(entryId, { status: "DONE" });
}

export function sendUpEntry(entryId) {
  const nextEntries = patchEntry(entryId, {
    status: "STAGING",
    sentUpAt: new Date().toISOString(),
  });
  return nextEntries;
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

    const linesNeeded = Math.max(1, Number(e.partySize || 1));

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
