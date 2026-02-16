"use client";

import { useMemo, useState, useEffect } from "react";
import Modal from "./Modal";
import ConfirmDangerModal from "./ConfirmDangerModal";
import { formatPhoneForTel, minutesFromNow } from "@/app/lib/ropesUtils";
import { LIMITS, clampInt, clampText } from "@/app/lib/ropesStore";

function computeMinutesRemaining(endTime) {
  if (!endTime) return 0;
  const endMs = new Date(endTime).getTime();
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - Date.now()) / 60000));
}

export default function EditEntryModal({
  entry,
  settings,
  onClose,
  onSave,
  onRemove,
  onComplete,
}) {
  //   Always define a safeEntry FIRST so hooks are never conditional
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
    const n = Number(settings?.totalLines ?? 15);
    return Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 15;
  }, [settings?.totalLines]);

  const initialDraft = useMemo(() => {
    const minsRemaining = isUp ? computeMinutesRemaining(safeEntry.endTime) : 0;
    const partySize = clampInt(safeEntry.partySize || 1, 1, totalLines);

    return {
      name: safeEntry.name || "",
      phone: safeEntry.phone || "",
      notes: safeEntry.notes || "",
      partySize,
      minutesRemaining: isUp ? clampInt(minsRemaining, 0, 999) : 0,
    };
  }, [
    isUp,
    safeEntry.name,
    safeEntry.phone,
    safeEntry.notes,
    safeEntry.partySize,
    safeEntry.endTime,
    totalLines,
  ]);

  const [draft, setDraft] = useState(initialDraft);

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [removeToken, setRemoveToken] = useState(0);
  const [completeToken, setCompleteToken] = useState(0);

  //   AFTER hooks, you can safely bail out
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

    // 🔒 FORCE equality. Always.
    const updated = {
      ...entry,
      name,
      phone,
      notes,
      partySize,
      linesUsed: partySize,
    };

    if (isUp) {
      const minsRemain = clampInt(draft.minutesRemaining ?? 0, 0, 999);
      updated.endTime = minutesFromNow(minsRemain);
    }

    onSave(updated);
  }

  function doRemove() {
    if (!entry?.id) return;
    onRemove?.(entry.id);
    onClose?.();
  }

  function doComplete() {
    if (!entry?.id) return;
    onComplete?.(entry.id);
    onClose?.();
  }

  const removeWord = "YES";
  const completeWord = "YES";

  return (
    <>
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
              <span className="field-label">Party size (lines)</span>
              <input
                className="input"
                type="number"
                min={1}
                max={totalLines}
                value={draft.partySize}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setDraft((d) => ({ ...d, partySize: "" }));
                    return;
                  }
                  setDraft((d) => ({
                    ...d,
                    partySize: clampInt(raw, 1, totalLines),
                  }));
                }}
                onBlur={() => {
                  setDraft((d) => {
                    const cur = d.partySize;
                    if (
                      cur === "" ||
                      !Number.isFinite(Number(cur)) ||
                      Number(cur) < 1
                    ) {
                      return { ...d, partySize: 1 };
                    }
                    return { ...d, partySize: clampInt(cur, 1, totalLines) };
                  });
                }}
              />
              <p className="muted helper">
                This always equals sling lines in use.
              </p>
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
            </label>
          </div>

          {isUp ? (
            <div className="card spacer-sm" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 13 }}>
                Active group controls
              </div>

              <div className="form-row" style={{ marginTop: 8 }}>
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

            <div className="card danger-zone">
              <div className="muted" style={{ fontSize: 13 }}>
                Danger zone
              </div>

              <div
                className="row"
                style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}
              >
                {isUp ? (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => {
                      setCompleteToken((t) => t + 1);
                      setConfirmCompleteOpen(true);
                    }}
                    disabled={!onComplete}
                  >
                    Complete
                  </button>
                ) : null}

                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setRemoveToken((t) => t + 1);
                    setConfirmRemoveOpen(true);
                  }}
                  disabled={!onRemove}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDangerModal
        key={`remove-${entry.id}-${removeToken}`}
        open={confirmRemoveOpen}
        title={`Remove: ${entry.name}`}
        dangerVerb="Remove"
        confirmWord={removeWord}
        description={`This will permanently remove "${entry.name}" from the list.`}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={doRemove}
      />

      <ConfirmDangerModal
        key={`complete-${entry.id}-${completeToken}`}
        open={confirmCompleteOpen}
        title={`Complete: ${entry.name}`}
        dangerVerb="Complete"
        confirmWord={completeWord}
        description={`This will mark "${entry.name}" as DONE and free up their lines.`}
        onClose={() => setConfirmCompleteOpen(false)}
        onConfirm={doComplete}
      />
    </>
  );
}
