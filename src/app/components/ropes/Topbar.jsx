"use client";

import Link from "next/link";
import { useState } from "react";
import { formatTime, MAX_SLING_LINES } from "@/app/lib/ropesStore";
import ConfirmDangerModal from "@/app/components/ropes/ConfirmDangerModal";

export default function Topbar({
  now,
  availableLines,
  totalLines,
  onClearAll,
  onUndo,
  canUndo,
  onArchiveToday,
  onOpenClient,
  onOpenPrint,

  //   reservations popup
  onOpenReservations,
  reservationsCount = 0,
}) {
  const [clearOpen, setClearOpen] = useState(false);
  const [clearModalKey, setClearModalKey] = useState(0);

  function openClear() {
    setClearModalKey((k) => k + 1);
    setClearOpen(true);
  }

  function closeClear() {
    setClearOpen(false);
  }

  return (
    <div className="card">
      <div className="topbar">
        <div>
          <h1 className="title">Ropes Course Waitlist</h1>

          <p className="muted">
            {formatTime(now)} • Sling lines:{" "}
            <strong className="big-count">{availableLines}</strong> /{" "}
            {totalLines} available{" "}
            <span className="muted">({MAX_SLING_LINES} max)</span>
          </p>

          <p className="muted helper">
            “Up now” = on the course. “Waiting” = queued until enough lines are
            free.
          </p>
        </div>

        <div className="row">
          <Link className="button" href="/top">
            Top
          </Link>

          <button className="button" type="button" onClick={onOpenClient}>
            Client
          </button>

          <button
            className="button"
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={!canUndo ? "Nothing to undo" : "Undo last action"}
          >
            Undo
          </button>

          {/*   popup button */}
          <button
            className="button"
            type="button"
            onClick={onOpenReservations}
            title="View reservations"
          >
            Reservations{" "}
            <span
              style={{
                marginLeft: 8,
                display: "inline-flex",
                minWidth: 22,
                height: 18,
                padding: "0 6px",
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                opacity: 0.9,
              }}
            >
              {reservationsCount}
            </span>
          </button>

          <button
            className="button"
            type="button"
            onClick={openClear}
            title="Clear waitlist + active runs"
          >
            Clear list
          </button>

          <Link className="button" href="/settings">
            Settings
          </Link>
          <Link className="button" href="/archive">
            Archive
          </Link>
        </div>
      </div>

      <ConfirmDangerModal
        key={clearModalKey}
        open={clearOpen}
        title="Clear everything?"
        dangerVerb="Clear now"
        confirmWord="CLEAR"
        description="This will clear the entire waitlist and any active runs. This is intended for end-of-day resets."
        onClose={closeClear}
        onConfirm={() => onClearAll?.()}
      />
    </div>
  );
}
