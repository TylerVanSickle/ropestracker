// src/app/lib/reservations.js
// Shared config + helpers for the reservations system.

// To add new reservation types in the future, add a new entry here.
// `value` is what gets stored in the DB; `label` is shown in UI; `emoji` is decorative.
export const EVENT_TYPES = [
  { value: "general", label: "General", emoji: "" },
  { value: "birthday", label: "Birthday", emoji: "" },
  { value: "corporate", label: "Corporate", emoji: "" },
  { value: "school", label: "School Group", emoji: "" },
  { value: "private", label: "Private", emoji: "" },
  { value: "other", label: "Other", emoji: "" },
];

export function getEventType(value) {
  return EVENT_TYPES.find((t) => t.value === value) || EVENT_TYPES[0];
}

export function eventTypeLabel(value) {
  return getEventType(value).label;
}

export function eventTypeEmoji(value) {
  return getEventType(value).emoji;
}

// Format helpers (consistent across the app)
const ANALYTICS_TZ = "America/Denver";

export function fmtReservationDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: ANALYTICS_TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export function fmtReservationTime(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: ANALYTICS_TZ,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export function fmtReservationDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: ANALYTICS_TZ,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

// Compute YYYY-MM-DD in Denver timezone for "is today" checks
export function ymdInDenver(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Bucket a list of reservations into Today, ThisWeek (next 7 days excluding today), Future
export function bucketReservations(reservations, now = new Date()) {
  const today = ymdInDenver(now);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const todayList = [];
  const thisWeek = [];
  const future = [];
  const past = [];

  for (const r of reservations || []) {
    if (!r?.reserved_at) continue;
    const rDate = new Date(r.reserved_at);
    if (isNaN(rDate.getTime())) continue;

    const rYmd = ymdInDenver(rDate);
    if (rYmd === today) {
      todayList.push(r);
    } else if (rDate < now) {
      past.push(r);
    } else if (rDate <= sevenDaysFromNow) {
      thisWeek.push(r);
    } else {
      future.push(r);
    }
  }

  return { today: todayList, thisWeek, future, past };
}

// Format input value for <input type="datetime-local"> from a Date or ISO string
export function toLocalInputValue(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Parse <input type="datetime-local"> value to ISO string
export function localInputValueToISO(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function formatPhoneUS(input) {
  let digits = String(input || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  const len = digits.length;
  if (len === 0) return "";
  if (len < 4) return digits;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
