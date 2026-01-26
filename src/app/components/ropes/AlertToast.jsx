"use client";

import { useEffect, useRef, useState } from "react";

export default function AlertToast({
  toastKey,
  message,
  durationMs = 1200,
  side = "right", // "right" | "left"
}) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);
  const showTimer = useRef(null);

  useEffect(() => {
    if (!toastKey || !message) return;

    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (showTimer.current) clearTimeout(showTimer.current);

    // async state changes (lint-safe)
    showTimer.current = setTimeout(() => setVisible(true), 0);
    hideTimer.current = setTimeout(() => setVisible(false), durationMs);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, [toastKey, message, durationMs]);

  if (!message) return null;

  const classes = [
    "alert-toast",
    side === "left" ? "alert-toast--left" : "alert-toast--right",
    visible ? "is-visible" : "",
  ].join(" ");

  return (
    <div className={classes} role="status" aria-live="polite">
      <div className="alert-toast__inner">{message}</div>
    </div>
  );
}
