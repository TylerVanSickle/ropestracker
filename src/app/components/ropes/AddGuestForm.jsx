"use client";

import { useMemo } from "react";
import {
  loadSettings,
  MAX_SLING_LINES,
  LIMITS,
  clampText,
  clampInt,
} from "@/app/lib/ropesStore";

export default function AddGuestForm({ newGuest, setNewGuest, onAddGuest }) {
  // Pull current settings so we can clamp party size to totalLines
  const maxLines = useMemo(() => {
    const s = loadSettings();
    const n = Number(s?.totalLines ?? MAX_SLING_LINES);
    return Number.isFinite(n) ? Math.max(1, n) : MAX_SLING_LINES;
  }, []);

  return (
    <div className="card spacer-md">
      <div className="card-header">
        <div>
          <h2 className="section-title">Add Guest</h2>
          <p className="muted helper">
            Add them to the line. You can edit them later.
          </p>
        </div>
      </div>

      <form onSubmit={onAddGuest} className="guest-form spacer-sm">
        <div className="form-row">
          <label className="field">
            <span className="field-label">Name / Group</span>
            <input
              className="input"
              value={newGuest.name}
              maxLength={LIMITS.entryName}
              onChange={(e) =>
                setNewGuest((g) => ({
                  ...g,
                  name: clampText(e.target.value, LIMITS.entryName),
                }))
              }
              placeholder="e.g., Smith Family"
              autoComplete="off"
            />
            <span className="muted helper">
              {String(newGuest.name ?? "").length}/{LIMITS.entryName}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Party size</span>
            <input
              className="input"
              type="number"
              min={1}
              max={maxLines}
              value={newGuest.partySize}
              onChange={(e) => {
                const raw = e.target.value;

                if (raw === "") {
                  setNewGuest((g) => ({ ...g, partySize: "" }));
                  return;
                }

                const n = Number(raw);
                if (!Number.isFinite(n)) return;

                const clamped = clampInt(n, 1, maxLines);

                setNewGuest((g) => ({
                  ...g,
                  partySize: clamped,
                }));
              }}
              onBlur={() => {
                setNewGuest((g) => {
                  const current = g.partySize;

                  if (
                    current === "" ||
                    !Number.isFinite(Number(current)) ||
                    Number(current) < 1
                  ) {
                    return { ...g, partySize: 1 };
                  }

                  return {
                    ...g,
                    partySize: clampInt(current, 1, maxLines),
                  };
                });
              }}
            />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span className="field-label">Phone (optional)</span>
            <input
              className="input"
              type="number"
              value={newGuest.phone}
              maxLength={LIMITS.entryPhone}
              onChange={(e) =>
                setNewGuest((g) => ({
                  ...g,
                  phone: clampText(e.target.value, LIMITS.entryPhone),
                }))
              }
              placeholder="e.g., 801-555-1234"
              inputMode="tel"
              autoComplete="tel"
            />
            <span className="muted helper">
              {String(newGuest.phone ?? "").length}/{LIMITS.entryPhone}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Notes (optional)</span>
            <input
              className="input"
              value={newGuest.notes}
              maxLength={LIMITS.entryIntakeNotes}
              onChange={(e) =>
                setNewGuest((g) => ({
                  ...g,
                  notes: clampText(e.target.value, LIMITS.entryIntakeNotes),
                }))
              }
              placeholder="birthday, call at 3:10, etc."
              autoComplete="off"
            />
            <span className="muted helper">
              {String(newGuest.notes ?? "").length}/{LIMITS.entryIntakeNotes}
            </span>
          </label>
        </div>

        <button className="button button-primary button-wide" type="submit">
          Add to waitlist
        </button>
      </form>
    </div>
  );
}
