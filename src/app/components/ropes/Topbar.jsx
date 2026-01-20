"use client";

import Link from "next/link";
import { formatTime, MAX_SLING_LINES } from "@/app/lib/ropesStore";

export default function Topbar({
  now,
  availableLines,
  totalLines,
  onClearAll,
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
          <Link className="button" href="/settings">
            Settings
          </Link>
          <button className="button" onClick={onClearAll} type="button">
            Clear list
          </button>
        </div>
      </div>
    </div>
  );
}
