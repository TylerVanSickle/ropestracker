"use client";

import Link from "next/link";
import { formatTime, MAX_SLING_LINES } from "@/app/lib/ropesStore";

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
}) {
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
          <button className="button" type="button" onClick={onOpenClient}>
            Client
          </button>
          {/* <button className="button" type="button" onClick={onOpenPrint}>
            Print
          </button> */}

          {/* <button className="button" type="button" onClick={onArchiveToday}>
            Archive Today
          </button> */}
          <button
            className="button"
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={!canUndo ? "Nothing to undo" : "Undo last action"}
          >
            Undo
          </button>
          <Link className="button" href="/top">
            Top
          </Link>
          <button className="button" onClick={onClearAll} type="button">
            Clear list
          </button>
          <Link className="button" href="/settings">
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
