"use client";

import { useMemo, useState } from "react";

export default function ArchiveModal({
  open,
  entry,
  initialReason = "",
  initialNote = "",
  initialMode = "REMOVE", // "REMOVE" | "KEEP"
  onClose,
  onSubmit, // can be async now
}) {
  const sessionKey = useMemo(() => {
    if (!open || !entry?.id) return "";
    return `${entry.id}:open`;
  }, [open, entry?.id]);

  const [drafts, setDrafts] = useState(() => ({
    sessionKey: "",
    reason: "",
    note: "",
    mode: "REMOVE",
  }));

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Reset drafts when a new session begins (safe guard during render)
  if (open && entry?.id && drafts.sessionKey !== sessionKey) {
    setDrafts({
      sessionKey,
      reason: String(initialReason || ""),
      note: String(initialNote || ""),
      mode: initialMode === "KEEP" ? "KEEP" : "REMOVE",
    });
    setErr("");
    setSaving(false);
  }

  if (!open || !entry) return null;

  const party = Math.max(1, Number(entry.partySize || 1));

  async function submit() {
    const r = String(drafts.reason || "").trim();
    const n = String(drafts.note || "").trim();

    if (r.length < 3) {
      alert("Please enter a short reason.");
      return;
    }

    setErr("");
    setSaving(true);

    try {
      // IMPORTANT: await the caller (which now does the DB write)
      await onSubmit?.({ reason: r, note: n, mode: drafts.mode });

      // Clear immediately so if modal stays mounted or reopens fast, it’s clean
      setDrafts({
        sessionKey: "",
        reason: "",
        note: "",
        mode: "REMOVE",
      });

      onClose?.();
    } catch (e) {
      setErr(e?.message || "Failed to archive. Please try again.");
      setSaving(false);
    }
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
      onClick={() => {
        if (saving) return;
        onClose?.();
      }}
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
          <button
            className="button"
            type="button"
            disabled={saving}
            onClick={() => onClose?.()}
          >
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

        {err ? (
          <div
            className="item"
            style={{
              padding: 12,
              marginTop: 12,
              borderLeft: "6px solid #e65a4f",
            }}
          >
            <div style={{ fontWeight: 800 }}>Couldn’t archive</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {err}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <label className="field">
            <span className="field-label">Reason (required)</span>
            <input
              className="input"
              value={drafts.reason}
              disabled={saving}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, reason: e.target.value }))
              }
              placeholder="e.g., Disrespectful behavior"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field-label">Extra note (optional)</span>
            <input
              className="input"
              value={drafts.note}
              disabled={saving}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, note: e.target.value }))
              }
              placeholder="e.g., Threatened staff, refused rules, etc."
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field-label">Action</span>
            <select
              className="input"
              value={drafts.mode}
              disabled={saving}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, mode: e.target.value }))
              }
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
              disabled={saving}
              onClick={() => onClose?.()}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={saving}
              onClick={submit}
            >
              {saving ? "Saving…" : "Archive"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
