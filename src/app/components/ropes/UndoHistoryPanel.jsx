// src/app/top/components/UndoHistoryPanel.jsx
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DROPDOWN_WIDTH = 340;
const VIEWPORT_MARGIN = 12;

function fmtRelative(ts) {
  const now = Date.now();
  const diff = Math.max(0, now - Number(ts || now));
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function UndoHistoryPanel({ actions = [], onUndo, onClear }) {
  const [open, setOpen] = useState(false);
  const [undoing, setUndoing] = useState(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: DROPDOWN_WIDTH });
  const wrapRef = useRef(null);
  const dropRef = useRef(null);

  const count = actions.length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        dropRef.current &&
        !dropRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Position the dropdown relative to the button, clamped to viewport
  useLayoutEffect(() => {
    if (!open) return;
    const btn = wrapRef.current;
    if (!btn) return;

    const recalc = () => {
      const rect = btn.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const width = Math.min(DROPDOWN_WIDTH, viewportW - VIEWPORT_MARGIN * 2);

      // Try left-align with button first; if it'd overflow right, clamp.
      let left = rect.left;
      if (left + width + VIEWPORT_MARGIN > viewportW) {
        left = viewportW - width - VIEWPORT_MARGIN;
      }
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

      const top = rect.bottom + 6;
      setPos({ top, left, width });
    };

    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open]);

  async function handleUndo(id) {
    if (undoing) return;
    setUndoing(id);
    try {
      await onUndo(id);
    } finally {
      setUndoing(null);
    }
  }

  return (
    <>
      <div
        ref={wrapRef}
        style={{ position: "relative", display: "inline-block" }}
      >
        <button
          type="button"
          className="button"
          onClick={() => setOpen((v) => !v)}
          disabled={count === 0}
          style={{
            fontSize: 13,
            padding: "6px 10px",
            opacity: count === 0 ? 0.5 : 1,
          }}
          title={
            count === 0
              ? "No recent actions"
              : `${count} recent action${count === 1 ? "" : "s"}`
          }
        >
          ↶ Undo {count > 0 ? `(${count})` : ""}
        </button>
      </div>

      {open && count > 0 && (
        <div
          ref={dropRef}
          className="card"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 1000,
            maxHeight: "min(420px, 70vh)",
            overflowY: "auto",
            padding: 10,
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>Recent Actions</div>
            <button
              type="button"
              className="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              style={{ fontSize: 11, padding: "4px 8px", minHeight: 0 }}
            >
              Clear
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {actions.map((a, idx) => (
              <div
                key={a.id}
                className="item"
                style={{
                  padding: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: idx === 0 ? 700 : 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.description}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {fmtRelative(a.timestamp)}
                  </div>
                </div>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => handleUndo(a.id)}
                  disabled={Boolean(undoing)}
                  style={{ fontSize: 12, padding: "6px 10px", minHeight: 0 }}
                >
                  {undoing === a.id ? "..." : "Undo"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
