"use client";

import { useEffect } from "react";

export default function ConfirmModal({
  open,
  title = "Confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger", // "danger" | "primary"
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Enter") onConfirm?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onConfirm]);

  if (!open) return null;

  const confirmBtnStyle =
    tone === "danger"
      ? {
          border: "1px solid var(--danger, #ff4d4d)",
          background: "var(--danger, #ff4d4d)",
          color: "#fff",
        }
      : undefined;

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
        style={{ width: "min(560px, 100%)", padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <h2 className="section-title" style={{ margin: 0 }}>
            {title}
          </h2>
          <button className="button" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {message ? (
          <div className="muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
            {message}
          </div>
        ) : null}

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
            {cancelText}
          </button>
          <button
            className="button"
            style={confirmBtnStyle}
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Tip: Press <strong>Esc</strong> to cancel.
        </div>
      </div>
    </div>
  );
}
