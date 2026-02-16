"use client";

import { useMemo, useState } from "react";
import { patchSettings } from "@/app/lib/ropesStore";
import ConfirmModal from "@/app/components/ropes/ConfirmModal";

function clampReason(v) {
  return String(v || "")
    .trim()
    .slice(0, 120);
}

async function statePut(body) {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { ok: false, error: text || "Non-JSON response" };
  }

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `HTTP ${res.status} ${res.statusText}`);
  }
  return json;
}

export default function FlowControlButton({
  className = "button",
  settings, // ✅ comes from TopRopesPage (DB-backed via realtime)
}) {
  const paused = Boolean(settings?.flowPaused);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const existingReason = useMemo(
    () => clampReason(settings?.flowPauseReason),
    [settings?.flowPauseReason],
  );

  function openModal() {
    setReason(paused ? existingReason : "");
    setOpen(true);
  }

  async function pauseFlow() {
    if (busy) return;
    setBusy(true);

    const nextReason = clampReason(reason);
    const nowISO = new Date().toISOString();

    // optimistic local cache (nice for same-device UX)
    patchSettings({
      flowPaused: true,
      flowPauseReason: nextReason,
      flowPausedAt: nowISO,
    });

    try {
      await statePut({
        settingsPatch: {
          flow_paused: true,
          flow_pause_reason: nextReason,
          flow_paused_at: nowISO,
        },
      });
      setOpen(false);
    } catch (e) {
      // revert local cache if DB failed
      patchSettings({
        flowPaused: false,
        flowPauseReason: "",
        flowPausedAt: null,
      });
      alert(String(e?.message || "Failed to pause flow."));
    } finally {
      setBusy(false);
    }
  }

  async function unpauseFlow() {
    if (busy) return;
    setBusy(true);

    patchSettings({
      flowPaused: false,
      flowPauseReason: "",
      flowPausedAt: null,
    });

    try {
      await statePut({
        settingsPatch: {
          flow_paused: false,
          flow_pause_reason: "",
          flow_paused_at: null,
        },
      });
      setOpen(false);
    } catch (e) {
      // revert local cache back to paused (best-effort)
      patchSettings({
        flowPaused: true,
        flowPauseReason: existingReason,
        flowPausedAt: settings?.flowPausedAt || new Date().toISOString(),
      });
      alert(String(e?.message || "Failed to unpause flow."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${className} ${paused ? "button-warning" : ""}`.trim()}
        onClick={openModal}
        title={paused ? "Flow is paused" : "Flow is running"}
        disabled={busy}
      >
        {busy ? "Saving…" : paused ? "Flow: Paused" : "Flow"}
      </button>

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
        onClose={() => (busy ? null : setOpen(false))}
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
                disabled={busy}
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
