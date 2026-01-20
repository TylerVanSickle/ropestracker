"use client";

import { formatPhoneForTel } from "@/app/lib/ropesUtils";

export default function CallNowBanner({
  nextWaiting,
  nextNeeds,
  nextCanStartNow,
  nextEstStartText,
  nextWaitRange,
  onNotify,
  onStartNext,
}) {
  if (!nextWaiting) {
    return (
      <div className="card spacer-md">
        <div className="next-strip">
          <div className="muted">No one is waiting right now.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card spacer-md">
      <div className={`next-strip ${nextCanStartNow ? "next-strip-hot" : ""}`}>
        <div>
          <div className="next-strip-title">
            {nextCanStartNow ? (
              <span className="badge badge-alert">CALL NOW</span>
            ) : (
              <span className="badge">NEXT UP</span>
            )}
            <strong>{nextWaiting.name}</strong>{" "}
            <span className="muted">({nextNeeds} lines)</span>
          </div>

          <div className="muted">
            Estimated start: <strong>{nextEstStartText}</strong>
            <span className="sep">•</span>
            Wait quote: <strong>{nextWaitRange}</strong>
          </div>
        </div>

        <div className="row">
          {nextWaiting.phone ? (
            <a
              className="button"
              href={`tel:${formatPhoneForTel(nextWaiting.phone)}`}
            >
              Call
            </a>
          ) : null}

          <button className="button" onClick={onNotify} type="button">
            Notify
          </button>

          <button
            className="button button-primary"
            onClick={onStartNext}
            disabled={!nextCanStartNow}
            title={
              !nextCanStartNow ? "Not enough lines yet" : "Start next group"
            }
            type="button"
          >
            Start next group
          </button>
        </div>
      </div>
    </div>
  );
}
