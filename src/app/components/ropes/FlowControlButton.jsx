"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadSettings,
  patchSettings,
  subscribeToRopesStorage,
} from "@/app/lib/ropesStore";
import ConfirmModal from "@/app/components/ropes/ConfirmModal";

function clampReason(v) {
  return String(v || "")
    .trim()
    .slice(0, 120);
}

export default function FlowControlButton({ className = "button" }) {
  const [settings, setSettings] = useState(() => loadSettings());
  const paused = Boolean(settings.flowPaused);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    return subscribeToRopesStorage(() => setSettings(loadSettings()));
  }, []);

  const existingReason = useMemo(
    () => clampReason(settings.flowPauseReason),
    [settings.flowPauseReason],
  );

  function openModal() {
    setReason(paused ? existingReason : "");
    setOpen(true);
  }

  function pauseFlow() {
    patchSettings({
      flowPaused: true,
      flowPauseReason: clampReason(reason),
      flowPausedAt: new Date().toISOString(),
    });
    setOpen(false);
  }

  function unpauseFlow() {
    patchSettings({
      flowPaused: false,
      flowPauseReason: "",
      flowPausedAt: null,
    });
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`${className} ${paused ? "button-warning" : ""}`.trim()}
        onClick={openModal}
        title={paused ? "Flow is paused" : "Flow is running"}
      >
        {paused ? "Flow: Paused" : "Flow"}
      </button>

      {/* Uses your existing modal styling */}
      <ConfirmModal
        open={open}
        title="Flow control"
        description={
          paused
            ? "Flow is paused. Bottom cannot send groups up right now."
            : "Pause flow to temporarily stop Bottom from sending groups up."
        }
        confirmText={paused ? "Unpause flow" : "Pause flow"}
        confirmVariant={paused ? "primary" : "warning"}
        onConfirm={paused ? unpauseFlow : pauseFlow}
        onClose={() => setOpen(false)}
      >
        {!paused ? (
          <div className="spacer-sm">
            <label className="field">
              <span className="field-label">Reason (optional)</span>
              <textarea
                className="input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., short staffed, resetting stations, holding for a party..."
              />
            </label>
          </div>
        ) : existingReason ? (
          <div className="notice warning spacer-sm">
            <div className="notice-title">Reason</div>
            <div className="notice-body">{existingReason}</div>
          </div>
        ) : null}
      </ConfirmModal>
    </>
  );
}
