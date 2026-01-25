import { COURSE_TAGS } from "@/app/lib/ropesTags";
import { normalizeEntries } from "@/app/lib/ropesStore";
import { ensureQueueOrder } from "@/app/lib/ropesUtils";

export function minutesLeft(endTimeISO) {
  if (!endTimeISO) return null;
  const t = new Date(endTimeISO);
  const endMs = t.getTime();
  if (!Number.isFinite(endMs)) return null;

  const diffMs = endMs - Date.now();

  // ✅ For positive time remaining, ceil (e.g. 0.2 min => 1 min left)
  if (diffMs >= 0) return Math.ceil(diffMs / 60000);

  // ✅ For overdue, become negative immediately (e.g. -10s => -1 min overdue)
  return -Math.ceil(Math.abs(diffMs) / 60000);
}

export function isoPlusMinutes(mins) {
  const m = Math.max(1, Number(mins || 0));
  return new Date(Date.now() + m * 60 * 1000).toISOString();
}

export function getAvailableTags(up, allTags) {
  const used = new Set((up || []).map((x) => x.assignedTag).filter(Boolean));
  return (allTags || []).filter((t) => !used.has(t));
}

export function getDerived(entriesRaw, settings) {
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

export function getTagMetaByLabel(label) {
  const s = String(label || "");
  return COURSE_TAGS.find((t) => t.label === s) || null;
}

export function entryTintStyle(entry) {
  const meta = getTagMetaByLabel(entry?.assignedTag);
  if (!meta?.color) return null;

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement?.getAttribute("data-theme") === "dark";

  const bgAlpha = isDark ? 0.14 : 0.08;
  const borderAlpha = isDark ? 0.65 : 0.55;

  return {
    background: `rgba(${meta.color}, ${bgAlpha})`,
    borderLeft: `6px solid rgba(${meta.color}, ${borderAlpha})`,
  };
}
