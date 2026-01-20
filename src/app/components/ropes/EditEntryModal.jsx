"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import { formatPhoneForTel, minutesFromNow } from "@/app/lib/ropesUtils";

function computeMinutesRemaining(endTime) {
  if (!endTime) return 0;
  const endMs = new Date(endTime).getTime();
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - Date.now()) / 60000));
}

export default function EditEntryModal({ entry, settings, onClose, onSave }) {
  // Always derive safe values so hooks always run (no conditional hooks)
  const safeEntry = entry ?? {
    id: "__none__",
    status: "WAITING",
    name: "",
    phone: "",
    notes: "",
    partySize: 1,
    linesUsed: 1,
    endTime: null,
  };

  const isUp = safeEntry.status === "UP";

  // This memo is fine; modal remounts by key={entry.id} so initial state resets cleanly.
  const initialDraft = useMemo(() => {
    const minsRemaining = isUp ? computeMinutesRemaining(safeEntry.endTime) : 0;

    return {
      id: safeEntry.id,
      status: safeEntry.status,
      name: safeEntry.name || "",
      phone: safeEntry.phone || "",
      notes: safeEntry.notes || "",
      partySize: Math.max(1, Number(safeEntry.partySize || 1)),
      linesUsed: isUp
        ? Math.max(1, Number(safeEntry.linesUsed || safeEntry.partySize || 1))
        : null,
      minutesRemaining: isUp ? minsRemaining : null,
    };
  }, [
    safeEntry.id,
    safeEntry.status,
    safeEntry.endTime,
    safeEntry.partySize,
    safeEntry.linesUsed,
    safeEntry.name,
    safeEntry.phone,
    safeEntry.notes,
    isUp,
  ]);

  const [draft, setDraft] = useState(initialDraft);

  // If entry is actually missing, just render nothing AFTER hooks
  if (!entry) return null;

  function save() {
    const name = String(draft.name || "").trim();
    if (!name) {
      alert("Name is required.");
      return;
    }

    const partySize = Math.max(1, Number(draft.partySize || 1));

    const updated = {
      ...entry,
      name,
      phone: String(draft.phone || "").trim(),
      notes: String(draft.notes || "").trim(),
      partySize,
    };

    if (isUp) {
      const linesUsed = Math.max(1, Number(draft.linesUsed || partySize));
      if (linesUsed > settings.totalLines) {
        alert(`Lines used can't exceed total lines (${settings.totalLines}).`);
        return;
      }
      updated.linesUsed = linesUsed;

      const minsRemain = Math.max(0, Number(draft.minutesRemaining || 0));
      updated.endTime = minutesFromNow(minsRemain);
    }

    onSave(updated);
  }

  return (
    <Modal title={`Edit: ${entry.name}`} onClose={onClose}>
      <div className="guest-form">
        <div className="form-row">
          <label className="field">
            <span className="field-label">Name / Group</span>
            <input
              className="input"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
          </label>

          <label className="field">
            <span className="field-label">Party size</span>
            <input
              className="input"
              type="number"
              min={1}
              value={draft.partySize}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  partySize: Math.max(1, Number(e.target.value || 1)),
                }))
              }
            />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span className="field-label">Phone</span>
            <input
              className="input"
              value={draft.phone}
              onChange={(e) =>
                setDraft((d) => ({ ...d, phone: e.target.value }))
              }
              placeholder="801-555-1234"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>

          <label className="field">
            <span className="field-label">Notes</span>
            <input
              className="input"
              value={draft.notes}
              onChange={(e) =>
                setDraft((d) => ({ ...d, notes: e.target.value }))
              }
              placeholder="call at 3:10"
              autoComplete="off"
            />
          </label>
        </div>

        {isUp ? (
          <div className="card spacer-sm" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Active group controls
            </div>

            <div className="form-row" style={{ marginTop: 8 }}>
              <label className="field">
                <span className="field-label">Lines currently used</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={settings.totalLines}
                  value={draft.linesUsed ?? 1}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      linesUsed: Math.max(1, Number(e.target.value || 1)),
                    }))
                  }
                />
                <p className="muted helper">
                  Use if someone gets off early / returns a ticket.
                </p>
              </label>

              <label className="field">
                <span className="field-label">Minutes remaining</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.minutesRemaining ?? 0}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      minutesRemaining: Math.max(
                        0,
                        Number(e.target.value || 0),
                      ),
                    }))
                  }
                />
                <p className="muted helper">Adjust when they’ll finish.</p>
              </label>
            </div>
          </div>
        ) : null}

        <div className="row spacer-sm">
          {draft.phone ? (
            <a
              className="button"
              href={`tel:${formatPhoneForTel(draft.phone)}`}
            >
              Call
            </a>
          ) : null}

          <button
            className="button button-primary"
            type="button"
            onClick={save}
          >
            Save changes
          </button>
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
