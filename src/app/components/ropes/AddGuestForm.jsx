"use client";

import { useMemo } from "react";
import { loadSettings, MAX_SLING_LINES } from "@/app/lib/ropesStore";

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
          <h2 className="section-title">Add guest</h2>
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
              onChange={(e) =>
                setNewGuest((g) => ({ ...g, name: e.target.value }))
              }
              placeholder="e.g., Smith Family"
              autoComplete="off"
            />
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

                const clamped = Math.min(maxLines, Math.max(1, n));

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
                    current < 1
                  ) {
                    return { ...g, partySize: 1 };
                  }

                  return { ...g, partySize: Math.min(maxLines, current) };
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
              value={newGuest.phone}
              onChange={(e) =>
                setNewGuest((g) => ({ ...g, phone: e.target.value }))
              }
              placeholder="e.g., 801-555-1234"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>

          <label className="field">
            <span className="field-label">Notes (optional)</span>
            <input
              className="input"
              value={newGuest.notes}
              onChange={(e) =>
                setNewGuest((g) => ({ ...g, notes: e.target.value }))
              }
              placeholder="birthday, call at 3:10, etc."
              autoComplete="off"
            />
          </label>
        </div>

        <button className="button button-primary button-wide" type="submit">
          Add to waitlist
        </button>
      </form>
    </div>
  );
}
