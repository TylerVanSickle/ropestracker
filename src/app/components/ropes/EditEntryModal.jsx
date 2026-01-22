"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import { formatPhoneForTel, minutesFromNow } from "@/app/lib/ropesUtils";
import { LIMITS, clampInt, clampText } from "@/app/lib/ropesStore";

function computeMinutesRemaining(endTime) {
  if (!endTime) return 0;
  const endMs = new Date(endTime).getTime();
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - Date.now()) / 60000));
}

export default function EditEntryModal({ entry, settings, onClose, onSave }) {
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

  const totalLines = useMemo(() => {
    // settings.totalLines is already normalized in loadSettings, but keep it safe here too
    const n = Number(settings?.totalLines ?? 15);
    return Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 15;
  }, [settings?.totalLines]);

  const initialDraft = useMemo(() => {
    const minsRemaining = isUp ? computeMinutesRemaining(safeEntry.endTime) : 0;

    const partySize = clampInt(safeEntry.partySize || 1, 1, totalLines);

    // If UP, linesUsed is editable and must be an int clamp too
    const linesUsed = isUp
      ? clampInt(safeEntry.linesUsed ?? partySize, 1, totalLines)
      : null;

    return {
      id: safeEntry.id,
      status: safeEntry.status,
      name: safeEntry.name || "",
      phone: safeEntry.phone || "",
      notes: safeEntry.notes || "",
      partySize,
      linesUsed,
      minutesRemaining: isUp ? clampInt(minsRemaining, 0, 999) : null,
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
    totalLines,
  ]);

  const [draft, setDraft] = useState(initialDraft);

  if (!entry) return null;

  function save() {
    const name = clampText(draft.name, LIMITS.entryName).trim();
    if (!name) {
      alert("Name is required.");
      return;
    }

    const phone = clampText(draft.phone, LIMITS.entryPhone).trim();
    const notes = clampText(draft.notes, LIMITS.entryIntakeNotes).trim();

    const partySize = clampInt(draft.partySize || 1, 1, totalLines);

    const updated = {
      ...entry,
      name,
      phone,
      notes,
      partySize,
    };

    if (isUp) {
      const linesUsed = clampInt(draft.linesUsed ?? partySize, 1, totalLines);
      updated.linesUsed = linesUsed;

      const minsRemain = clampInt(draft.minutesRemaining ?? 0, 0, 999);
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
              maxLength={LIMITS.entryName}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  name: clampText(e.target.value, LIMITS.entryName),
                }))
              }
            />
            <span className="muted helper">
              {String(draft.name ?? "").length}/{LIMITS.entryName}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Party size</span>
            <input
              className="input"
              type="number"
              min={1}
              max={totalLines}
              value={draft.partySize}
              onChange={(e) => {
                const raw = e.target.value;

                if (raw === "") {
                  // allow blank while typing
                  setDraft((d) => ({ ...d, partySize: "" }));
                  return;
                }

                const nextParty = clampInt(raw, 1, totalLines);

                setDraft((d) => {
                  // If linesUsed was equal to partySize, keep them in sync
                  const shouldSync =
                    isUp &&
                    (d.linesUsed === d.partySize ||
                      d.linesUsed === "" ||
                      d.linesUsed == null);

                  return {
                    ...d,
                    partySize: nextParty,
                    ...(shouldSync ? { linesUsed: nextParty } : {}),
                  };
                });
              }}
              onBlur={() => {
                setDraft((d) => {
                  const cur = d.partySize;
                  if (
                    cur === "" ||
                    Number(cur) < 1 ||
                    !Number.isFinite(Number(cur))
                  ) {
                    const fallback = 1;
                    return {
                      ...d,
                      partySize: fallback,
                      ...(isUp ? { linesUsed: d.linesUsed ?? fallback } : {}),
                    };
                  }
                  const fixed = clampInt(cur, 1, totalLines);
                  return {
                    ...d,
                    partySize: fixed,
                    ...(isUp && (d.linesUsed === "" || d.linesUsed == null)
                      ? { linesUsed: fixed }
                      : {}),
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
              value={draft.phone}
              maxLength={LIMITS.entryPhone}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  phone: clampText(e.target.value, LIMITS.entryPhone),
                }))
              }
              placeholder="801-555-1234"
              inputMode="tel"
              autoComplete="tel"
            />
            <span className="muted helper">
              {String(draft.phone ?? "").length}/{LIMITS.entryPhone}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Notes</span>
            <input
              className="input"
              value={draft.notes}
              maxLength={LIMITS.entryIntakeNotes}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  notes: clampText(e.target.value, LIMITS.entryIntakeNotes),
                }))
              }
              placeholder="call at 3:10"
              autoComplete="off"
            />
            <span className="muted helper">
              {String(draft.notes ?? "").length}/{LIMITS.entryIntakeNotes}
            </span>
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
                  max={totalLines}
                  value={draft.linesUsed ?? 1}
                  onChange={(e) => {
                    const raw = e.target.value;

                    if (raw === "") {
                      setDraft((d) => ({ ...d, linesUsed: "" }));
                      return;
                    }

                    const nextLines = clampInt(raw, 1, totalLines);

                    setDraft((d) => ({
                      ...d,
                      linesUsed: nextLines,
                    }));
                  }}
                  onBlur={() => {
                    setDraft((d) => {
                      const cur = d.linesUsed;
                      if (
                        cur === "" ||
                        cur == null ||
                        !Number.isFinite(Number(cur)) ||
                        Number(cur) < 1
                      ) {
                        return {
                          ...d,
                          linesUsed: clampInt(d.partySize || 1, 1, totalLines),
                        };
                      }
                      return { ...d, linesUsed: clampInt(cur, 1, totalLines) };
                    });
                  }}
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
                  max={999}
                  value={draft.minutesRemaining ?? 0}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setDraft((d) => ({ ...d, minutesRemaining: 0 }));
                      return;
                    }
                    setDraft((d) => ({
                      ...d,
                      minutesRemaining: clampInt(raw, 0, 999),
                    }));
                  }}
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
