// src/app/lib/ropesUtils.js

export function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000);
}

export function minutesFromNow(mins) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

export function formatPhoneForTel(phone) {
  const trimmed = (phone || "").trim();
  if (!trimmed) return "";
  const isPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return isPlus ? `+${digits}` : digits;
}

export function buildSmsHref(phone, body) {
  const p = formatPhoneForTel(phone);
  if (!p) return null;

  const encoded = encodeURIComponent(body || "");
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  return isIOS ? `sms:${p}&body=${encoded}` : `sms:${p}?body=${encoded}`;
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {}
  return false;
}

export function getWaitRangeText(waitMin) {
  if (waitMin === null || waitMin === undefined) return "—";
  const w = Math.max(0, Number(waitMin));
  const margin = Math.max(5, Math.min(15, Math.ceil(w * 0.2)));
  const low = Math.max(0, w - margin);
  const high = w + margin;
  if (w <= 2) return "0–5 min";
  return `${low}–${high} min`;
}

/**
 * WaitlistMe-style estimate simulation (NO skipping).
 * Returns Map(id => { estStartISO, estEndISO, estWaitMin })
 */
export function computeEstimates({
  totalLines,
  durationMin,
  active,
  waiting,
  now,
}) {
  const results = new Map();

  const releases = [];
  let occupiedNow = 0;

  for (const r of active) {
    const lines = Math.max(0, Number(r.linesUsed || 0));
    const end = r.endTime ? new Date(r.endTime) : null;
    if (!end || isNaN(end.getTime())) continue;
    if (end.getTime() <= now.getTime()) continue;

    occupiedNow += lines;
    releases.push({ time: end, lines });
  }

  releases.sort((a, b) => a.time - b.time);

  let available = Math.max(0, totalLines - occupiedNow);
  let t = new Date(now.getTime());
  let i = 0;

  function applyReleasesUpTo(currentTime) {
    while (
      i < releases.length &&
      releases[i].time.getTime() <= currentTime.getTime()
    ) {
      const releaseTime = releases[i].time.getTime();
      let freed = 0;
      while (
        i < releases.length &&
        releases[i].time.getTime() === releaseTime
      ) {
        freed += releases[i].lines;
        i++;
      }
      available += freed;
    }
  }

  applyReleasesUpTo(t);

  for (const entry of waiting) {
    const needed = Math.max(1, Number(entry.partySize || 1));

    if (needed > totalLines) {
      results.set(entry.id, {
        estStartISO: null,
        estEndISO: null,
        estWaitMin: null,
      });
      continue;
    }

    while (available < needed) {
      if (i >= releases.length) {
        results.set(entry.id, {
          estStartISO: null,
          estEndISO: null,
          estWaitMin: null,
        });
        break;
      }
      t = new Date(releases[i].time.getTime());
      applyReleasesUpTo(t);
    }

    const current = results.get(entry.id);
    if (current && current.estStartISO === null) continue;

    if (available >= needed) {
      const estStart = new Date(t.getTime());
      const estEnd = addMinutes(estStart, durationMin);

      results.set(entry.id, {
        estStartISO: estStart.toISOString(),
        estEndISO: estEnd.toISOString(),
        estWaitMin: Math.max(
          0,
          Math.ceil((estStart.getTime() - now.getTime()) / 60000),
        ),
      });

      available -= needed;
      releases.push({ time: estEnd, lines: needed });
      releases.sort((a, b) => a.time - b.time);
    }
  }

  return results;
}

export function ensureQueueOrder(entries) {
  // Adds queueOrder to WAITING entries if missing (stable for reorder)
  let changed = false;
  const next = entries.map((e) => {
    if (e.status !== "WAITING") return e;
    if (typeof e.queueOrder === "number") return e;
    changed = true;
    return { ...e, queueOrder: Date.now() + Math.random() };
  });
  return changed ? next : entries;
}

/**
 * Public-facing “If you joined RIGHT NOW” estimate (strict FIFO).
 * Returns: { waitMin, estStartISO, estEndISO }
 *
 * This does NOT reveal internal counts; it just returns the time math.
 */
export function estimateForNewGroupSize({
  totalLines,
  durationMin,
  entries,
  partySize,
  now,
}) {
  const list = ensureQueueOrder(Array.isArray(entries) ? entries : []);
  const nowDate = now instanceof Date ? now : new Date();

  const active = [];
  const waiting = [];

  for (const e of list) {
    const status = String(e.status || "").toUpperCase();

    if (status === "UP") {
      // Your estimator expects:
      // active: [{ linesUsed, endTime }]
      active.push({
        linesUsed: Math.max(1, Number(e.partySize || 1)),
        endTime: e.endTime || null,
      });
      continue;
    }

    if (status === "WAITING") {
      waiting.push({
        id: e.id,
        partySize: Math.max(1, Number(e.partySize || 1)),
        queueOrder: e.queueOrder,
      });
    }
  }

  waiting.sort((a, b) => {
    const ao = typeof a.queueOrder === "number" ? a.queueOrder : 0;
    const bo = typeof b.queueOrder === "number" ? b.queueOrder : 0;
    return ao - bo;
  });

  const quoteId = "__QUOTE__";
  waiting.push({
    id: quoteId,
    partySize: Math.max(1, Number(partySize || 1)),
    queueOrder: Number.MAX_SAFE_INTEGER,
  });

  const map = computeEstimates({
    totalLines,
    durationMin,
    active,
    waiting,
    now: nowDate,
  });

  const r = map.get(quoteId) || {
    estStartISO: null,
    estEndISO: null,
    estWaitMin: null,
  };

  return {
    waitMin: r.estWaitMin,
    estStartISO: r.estStartISO,
    estEndISO: r.estEndISO,
  };
}
