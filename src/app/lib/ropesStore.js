export const MAX_SLING_LINES = 15;

const LS_KEY_SETTINGS = "ropes_settings_v1";
const LS_KEY_ENTRIES = "ropes_entries_v1";

const DEFAULT_SETTINGS = { totalLines: 15, durationMin: 45 };

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

    return { totalLines, durationMin };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  if (typeof window === "undefined") return;
  const safe = settings || DEFAULT_SETTINGS;
  localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(safe));
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
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
