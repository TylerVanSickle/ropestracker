"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function ConfirmDangerModal({
  open,
  title = "Confirm",
  dangerVerb = "Confirm",
  confirmWord = "CLEAR",
  description = "This action cannot be undone.",
  onConfirm,
  onClose,
}) {
  const [step, setStep] = useState(1);
  const [typed, setTyped] = useState("");

  const normalizedNeeded = String(confirmWord || "")
    .trim()
    .toLowerCase();
  const normalizedTyped = String(typed || "")
    .trim()
    .toLowerCase();
  const canConfirm = normalizedTyped === normalizedNeeded && normalizedNeeded;

  function closeAll() {
    onClose?.();
    // no local reset here; parent remount (key) handles it
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function next() {
    setStep((s) => Math.min(2, s + 1));
  }

  function confirm() {
    if (!canConfirm) return;
    onConfirm?.();
    closeAll();
  }

  if (!open) return null;

  return (
    <Modal title={title} onClose={closeAll}>
      {step === 1 ? (
        <div className="spacer-sm">
          <p className="muted helper" style={{ marginTop: 0 }}>
            {description}
          </p>

          <div className="row spacer-sm">
            <button className="button" type="button" onClick={closeAll}>
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={next}
              title="Continue"
            >
              Yes, continue
            </button>
          </div>
        </div>
      ) : (
        <div className="spacer-sm">
          <p className="muted helper" style={{ marginTop: 0 }}>
            Type <strong>{confirmWord}</strong> to confirm.
          </p>

          <label className="field">
            <span className="field-label">Confirmation</span>
            <input
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              autoComplete="off"
              autoFocus
            />
          </label>

          <div className="row spacer-sm">
            <button className="button" type="button" onClick={back}>
              Back
            </button>
            <button className="button" type="button" onClick={closeAll}>
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={confirm}
              disabled={!canConfirm}
              title={!canConfirm ? `Type ${confirmWord} to enable` : dangerVerb}
            >
              {dangerVerb}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
