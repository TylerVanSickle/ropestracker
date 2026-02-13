// src/app/lib/ropesRemote.js
"use client";

/**
 * Staff Remote Sync (Hybrid)
 * - Polls /api/state (cookie-protected)
 * - Provides "mode": remote | local
 * - Simple, reliable cross-device sync (no Supabase realtime needed)
 */

const DEFAULT_POLL_MS_ACTIVE = 1000;
const DEFAULT_POLL_MS_HIDDEN = 3500;

function isAbortError(err) {
  return (
    err?.name === "AbortError" ||
    String(err?.message || "")
      .toLowerCase()
      .includes("aborted")
  );
}

export async function fetchStaffState({ signal } = {}) {
  const res = await fetch("/api/state", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    signal,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error || `Failed to load state (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return json; // { ok:true, settings, entries }
}

export async function putStaffState(body, { signal } = {}) {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    credentials: "include",
    body: JSON.stringify(body || {}),
    signal,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error || `Failed to update state (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return json;
}

export async function opCreateEntry(payload) {
  return putStaffState({ op: "CREATE_ENTRY", payload });
}
export async function opPatchEntry(id, patch) {
  return putStaffState({ op: "PATCH_ENTRY", payload: { id, patch } });
}
export async function opDeleteEntry(id) {
  return putStaffState({ op: "DELETE_ENTRY", payload: { id } });
}
export async function opMoveToHistory(
  id,
  { status = "DONE", finish_reason = null } = {},
) {
  return putStaffState({
    op: "MOVE_TO_HISTORY",
    payload: { id, status, finish_reason },
  });
}
export async function patchRemoteSettings(settingsPatch) {
  return putStaffState({ settingsPatch });
}

/**
 * React hook: polls /api/state.
 * - "remote" mode when API works
 * - "local" mode if API fails (keeps last known state)
 */
import { useEffect, useMemo, useRef, useState } from "react";

export function useStaffRemoteSync({
  enabled = true,
  pollMsActive = DEFAULT_POLL_MS_ACTIVE,
  pollMsHidden = DEFAULT_POLL_MS_HIDDEN,
  onState,
} = {}) {
  const [mode, setMode] = useState("local"); // local | remote
  const [lastOkAt, setLastOkAt] = useState(null);
  const [lastErr, setLastErr] = useState(null);

  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const runningRef = useRef(false);

  const isHidden = () =>
    typeof document !== "undefined" && document.visibilityState === "hidden";

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const stop = () => {
    runningRef.current = false;
    clearTimer();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
  };

  const scheduleNext = (ms) => {
    clearTimer();
    timerRef.current = setTimeout(() => tick(), ms);
  };

  const tick = async () => {
    if (!enabled) return;
    if (!runningRef.current) return;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const data = await fetchStaffState({ signal: abortRef.current.signal });
      setMode("remote");
      setLastOkAt(Date.now());
      setLastErr(null);
      onState?.(data);
      scheduleNext(isHidden() ? pollMsHidden : pollMsActive);
    } catch (err) {
      if (isAbortError(err)) return;
      setLastErr(err);
      // If staff cookie expired or unauthorized, treat as "local" and slow down
      setMode("local");
      scheduleNext(
        isHidden() ? pollMsHidden : Math.max(2500, pollMsActive * 2),
      );
    }
  };

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    runningRef.current = true;
    tick();

    const onVis = () => {
      // when returning to tab, refresh faster immediately
      if (!runningRef.current) return;
      tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollMsActive, pollMsHidden]);

  return useMemo(
    () => ({
      mode,
      lastOkAt,
      lastErr,
    }),
    [mode, lastOkAt, lastErr],
  );
}
