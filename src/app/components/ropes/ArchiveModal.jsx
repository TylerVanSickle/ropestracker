"use client";

import { useMemo, useState } from "react";

export default function ArchiveModal({
  open,
  entry,
  initialReason = "",
  initialNote = "",
  initialMode = "REMOVE", // "REMOVE" | "KEEP"
  onClose,
  onSubmit,
}) {
  // This lets us reset local state without using useEffect.
  const sessionKey = useMemo(() => {
    if (!open || !entry?.id) return "";
    return `${entry.id}:${open ? "open" : "closed"}`;
  }, [open, entry?.id]);

  const [drafts, setDrafts] = useState(() => ({
    sessionKey: "",
    reason: "",
    note: "",
    mode: "REMOVE",
  }));

  // Reset drafts when a new session begins (no effect; done during render safely with guard)
  if (open && entry?.id && drafts.sessionKey !== sessionKey) {
  }

  const [reason, setReason] = useState(initialReason);
  const [note, setNote] = useState(initialNote);
  const [mode, setMode] = useState(initialMode);

  if (!open || !entry) return null;

  const party = Math.max(1, Number(entry.partySize || 1));

  function submit() {
    const r = String(reason || "").trim();
    const n = String(note || "").trim();
    if (r.length < 3) {
      alert("Please enter a short reason.");
      return;
    }
    onSubmit?.({ reason: r, note: n, mode });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
        zIndex: 10000,
      }}
      onClick={() => onClose?.()}
    >
      <div
        className="card"
        style={{ width: "min(720px, 100%)", padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <h2 className="section-title" style={{ margin: 0 }}>
            Flag & Archive
          </h2>
          <button className="button" type="button" onClick={() => onClose?.()}>
            Close
          </button>
        </div>

        <div className="item" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {entry.name} <span className="pill">{party} people</span>
            {entry.assignedTag ? (
              <span className="pill">{entry.assignedTag}</span>
            ) : null}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            This saves a record in <strong>/archive</strong>.
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <label className="field">
            <span className="field-label">Reason (required)</span>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Disrespectful behavior"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field-label">Extra note (optional)</span>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Threatened staff, refused rules, etc."
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field-label">Action</span>
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{ padding: 10 }}
            >
              <option value="REMOVE">Archive + remove from active lists</option>
              <option value="KEEP">
                Archive but keep them visible/on course
              </option>
            </select>
            <div className="muted helper" style={{ marginTop: 6 }}>
              “Keep” is useful if you still need to run their timer but want the
              record saved.
            </div>
          </label>

          <div
            className="row"
            style={{
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            <button
              className="button"
              type="button"
              onClick={() => onClose?.()}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={submit}
            >
              Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
