// src/app/top/components/SplitGroupModal.jsx
"use client";

import { useState, useEffect } from "react";

export default function SplitGroupModal({ open, entry, onClose, onSplit }) {
  const totalLines = Math.max(2, Number(entry?.linesUsed ?? entry?.partySize ?? 2));

  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);

  // Reset when modal opens with a new entry
  useEffect(() => {
    if (open && entry) {
      // Default: split into groups of up to 4
      const subSize = 4;
      const count = Math.ceil(totalLines / subSize);
      const initial = [];
      let remaining = totalLines;
      for (let i = 0; i < count; i++) {
        const size = Math.min(subSize, remaining);
        initial.push(size);
        remaining -= size;
      }
      setGroups(initial);
      setSaving(false);
    }
  }, [open, entry?.id, totalLines]);

  if (!open || !entry) return null;

  const assigned = groups.reduce((a, b) => a + b, 0);
  const isValid = assigned === totalLines && groups.every((g) => g >= 1);

  function updateGroup(idx, value) {
    setGroups((prev) => {
      const next = [...prev];
      next[idx] = Math.max(1, Math.min(totalLines, Number(value) || 1));
      return next;
    });
  }

  function addGroup() {
    setGroups((prev) => [...prev, 1]);
  }

  function removeGroup(idx) {
    if (groups.length <= 2) return;
    setGroups((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSplit() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSplit(entry, groups);
    } finally {
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
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "min(540px, 100%)", padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <h2 className="section-title" style={{ margin: 0 }}>
            Split Group
          </h2>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Split <strong>{entry.name}</strong> ({totalLines} lines) into smaller
          sub-groups so each wave gets its own tag and timer.
        </div>

        <div style={{ marginTop: 14 }}>
          {groups.map((size, idx) => (
            <div
              key={idx}
              className="row"
              style={{ gap: 10, marginTop: idx > 0 ? 8 : 0, alignItems: "center" }}
            >
              <span
                className="muted"
                style={{ fontSize: 13, width: 80, fontWeight: 600 }}
              >
                Group {idx + 1}
              </span>
              <input
                className="input"
                type="number"
                min={0}
                max={totalLines}
                value={size}
                onChange={(e) => updateGroup(idx, e.target.value)}
                style={{ width: 80, padding: 10, textAlign: "center" }}
              />
              <span className="muted" style={{ fontSize: 13 }}>lines</span>
              {groups.length > 2 && (
                <button
                  className="button"
                  type="button"
                  onClick={() => removeGroup(idx)}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button
            className="button"
            type="button"
            onClick={addGroup}
            style={{ marginTop: 10, fontSize: 13 }}
          >
            + Add Group
          </button>
        </div>

        {/* Summary */}
        <div
          style={{
            marginTop: 14,
            padding: "8px 12px",
            borderRadius: 10,
            background:
              assigned === totalLines ? "var(--color-bg)" : "var(--danger-bg)",
            border: `1px solid ${assigned === totalLines ? "var(--color-border)" : "var(--danger)"}`,
            fontSize: 13,
          }}
        >
          {assigned} / {totalLines} lines assigned
          {assigned !== totalLines && (
            <span style={{ color: "var(--danger)", fontWeight: 600 }}>
              {" "}— must equal {totalLines}
            </span>
          )}
        </div>

        <div
          className="row"
          style={{
            gap: 10,
            marginTop: 14,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button className="button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="button button-primary"
            onClick={handleSplit}
            disabled={!isValid || saving}
            type="button"
          >
            {saving ? "Splitting..." : `Split into ${groups.length} Groups`}
          </button>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Each sub-group will appear separately in Coming Up so you can assign
          different tags and start them at different times.
        </div>
      </div>
    </div>
  );
}
