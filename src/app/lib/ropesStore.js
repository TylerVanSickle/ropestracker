export const MAX_SLING_LINES = 15;

export const LS_KEY_SETTINGS = "ropes_settings_v1";
export const LS_KEY_ENTRIES = "ropes_entries_v1";
export const LS_KEY_UPDATED_AT = "ropes_updatedAt_v1";
export const LS_KEY_VERSION = "ropes_version_v1";

export const LS_KEY_UNDO = "ropes_undo_v1";
export const LS_KEY_AUTH = "ropes_staff_authed_v1";

// archives: ropes_archive_YYYY-MM-DD
export const LS_KEY_ARCHIVE_PREFIX = "ropes_archive_";

const DEFAULT_SETTINGS = {
  totalLines: 15,
  durationMin: 45,
  paused: false, // "closed" on client
  venueName: "Ropes Course Waitlist",
  clientTheme: "auto", // "auto" | "light" | "dark"
  staffPin: "", // if set, staff page requires PIN
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
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) || {};

    const totalLines = Math.min(
      MAX_SLING_LINES,
      Math.max(0, Number(parsed.totalLines ?? DEFAULT_SETTINGS.totalLines)),
    );

    const durationMin = Math.max(
      5,
      Math.min(180, Number(parsed.durationMin ?? DEFAULT_SETTINGS.durationMin)),
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

    const staffPin = String(parsed.staffPin ?? DEFAULT_SETTINGS.staffPin)
      .trim()
      .slice(0, 12);

    return {
      totalLines,
      durationMin,
      paused,
      venueName,
      clientTheme,
      staffPin,
    };
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
      e.key === LS_KEY_VERSION
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

/* =========================
   Undo stack (entries snapshots)
   ========================= */

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

/* =========================
   Auth flag (staff PIN)
   ========================= */

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

/* =========================
   Misc
   ========================= */

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
