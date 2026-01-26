// /app/lib/alerts.js

function msOver(endTimeISO, nowMs = Date.now()) {
  if (!endTimeISO) return null;
  const t = new Date(endTimeISO).getTime();
  if (Number.isNaN(t)) return null;
  return nowMs - t;
}

function formatOverdueLabel(name, overMs) {
  const seconds = Math.floor(overMs / 1000);
  const minutes = Math.floor(overMs / 60000);

  if (minutes >= 1) {
    return `⚠️${name} is ${minutes} min over`;
  }

  return `⚠️${name} is ${seconds}s overdue`;
}

export function computeAlerts({ entries = [], nowMs = Date.now() }) {
  const alerts = [];

  // Dev vs Prod thresholds
  const DEV_SECONDS_THRESHOLD = null; // dev: fast testing (Change to whatever number in SECONDS you want the threshold to be)
  const PROD_MINUTES_THRESHOLD = 5; // prod: real ops (Change to minutes you want the threshold to be)

  const isDev =
    typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";

  const thresholdMs = isDev
    ? DEV_SECONDS_THRESHOLD * 1000
    : PROD_MINUTES_THRESHOLD * 60 * 1000;

  for (const e of entries) {
    if (!e || e.status !== "UP") continue;

    const overMs = msOver(e.endTime, nowMs);
    if (overMs == null) continue;

    if (overMs >= thresholdMs) {
      alerts.push({
        type: "OVERDUE_GROUP",
        level: "warning",
        entryId: e.id,
        message: formatOverdueLabel(e.name || "Group", overMs),
        meta: {
          overMs,
          minutesOver: Math.floor(overMs / 60000),
          secondsOver: Math.floor(overMs / 1000),
        },
      });
    }
  }

  // Most overdue first
  alerts.sort((a, b) => (b?.meta?.overMs ?? 0) - (a?.meta?.overMs ?? 0));

  return alerts;
}
