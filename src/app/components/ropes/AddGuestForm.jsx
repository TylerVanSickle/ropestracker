"use client";

import { useMemo } from "react";
import {
  loadSettings,
  MAX_SLING_LINES,
  LIMITS,
  clampText,
  clampInt,
} from "@/app/lib/ropesStore";

/* Phone formatter (US) */
function formatPhoneUS(input) {
  if (!input) return "";

  // Strip non-digits
  let digits = input.replace(/\D/g, "");

  // Handle leading US country code
  if (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  // Cap at 10 digits
  digits = digits.slice(0, 10);

  const len = digits.length;

  if (len === 0) return "";
  if (len < 4) return digits;
  if (len < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

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

                setNewGuest((g) => ({
                  ...g,
                  partySize: clampInt(n, 1, maxLines),
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
            <span className="field-label">Phone</span>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={newGuest.phone}
              required
              placeholder="(801) 555-1234"
              onChange={(e) => {
                const formatted = formatPhoneUS(e.target.value);
                setNewGuest((g) => ({
                  ...g,
                  phone: formatted,
                }));
              }}
            />
            <span className="muted helper">Formatted automatically</span>
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
