// src/app/top/lib/useUndoHistory.js
"use client";

import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 10;

/**
 * Undo history for top-page actions.
 * Stores up to MAX_HISTORY actions in memory.
 * Each action carries a reverse() closure that re-applies the prior state via the API.
 */
export default function useUndoHistory() {
  const [actions, setActions] = useState([]);
  const actionsRef = useRef([]);
  const busyRef = useRef(false);

  const sync = useCallback((next) => {
    actionsRef.current = next;
    setActions(next);
  }, []);

  const pushAction = useCallback(
    (action) => {
      const full = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ...action,
      };
      const next = [full, ...actionsRef.current].slice(0, MAX_HISTORY);
      sync(next);
    },
    [sync],
  );

  const undo = useCallback(
    async (actionId) => {
      if (busyRef.current) return { ok: false, error: "Busy" };
      const target = actionsRef.current.find((a) => a.id === actionId);
      if (!target) return { ok: false, error: "Action not found" };

      busyRef.current = true;
      try {
        if (typeof target.reverse === "function") {
          await target.reverse();
        }
        sync(actionsRef.current.filter((a) => a.id !== actionId));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e?.message || "Undo failed" };
      } finally {
        busyRef.current = false;
      }
    },
    [sync],
  );

  const clear = useCallback(() => sync([]), [sync]);

  return { actions, pushAction, undo, clear };
}
