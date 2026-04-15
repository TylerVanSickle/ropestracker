// src/app/components/ropes/MergeHistoryBadge.jsx
"use client";

import { useState } from "react";

export default function MergeHistoryBadge({ mergeHistory }) {
  const [expanded, setExpanded] = useState(false);

  if (!Array.isArray(mergeHistory) || mergeHistory.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: "none",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "4px 10px",
          fontSize: 12,
          cursor: "pointer",
          color: "var(--color-muted)",
        }}
      >
        {expanded ? "Hide" : "Show"} original groups ({mergeHistory.length})
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 6,
            padding: 10,
            background: "var(--color-bg)",
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 13,
          }}
        >
          {mergeHistory.map((g, i) => (
            <div key={g.id || i}>
              <div style={{ fontWeight: 700 }}>
                {g.name || "—"}{" "}
                <span className="muted" style={{ fontWeight: 400 }}>
                  — group of {g.partySize || "?"}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {g.phone && g.phone !== "0" ? g.phone : "No phone"}
                {g.assignedTag ? ` • ${g.assignedTag}` : ""}
                {g.notes ? ` • ${g.notes}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
