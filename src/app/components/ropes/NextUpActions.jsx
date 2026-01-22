"use client";

export default function NextUpActions({
  nextWaiting,
  nextEstStartText,
  nextWaitRange,
  canStartNow,
  onNotify,
  onStart, // now means "Send Up"
  onEdit,
  onNoShow,
  onRemove,
}) {
  return (
    <div className="card spacer-md">
      <div className="card-header">
        <div>
          <h2 className="title" style={{ marginTop: 0 }}>
            Next Up (Quick Actions)
          </h2>
          <p className="muted helper">
            One-tap actions for the next group. <strong>Send Up</strong>{" "}
            reserves lines but does not start the ropes timer (Top does that).
          </p>
        </div>
      </div>

      {!nextWaiting ? (
        <div className="muted">No one is waiting right now.</div>
      ) : (
        <>
          <div className="next-strip next-strip-hot">
            <div className="next-strip-title">
              <strong>{nextWaiting.name}</strong>
              <span className="sep">•</span>
              <span className="muted">
                Est. load: <strong>{nextEstStartText}</strong>
              </span>
              <span className="sep">•</span>
              <span className="muted">
                About <strong>{nextWaitRange}</strong>
              </span>
            </div>

            <div className="row">
              <button
                className="button button-primary"
                type="button"
                onClick={onStart}
                disabled={!canStartNow}
                title={
                  canStartNow
                    ? "Send this group up (reserves sling lines)"
                    : "Will enable once enough lines are available"
                }
              >
                Send Up
              </button>

              <button className="button" type="button" onClick={onNotify}>
                Notify
              </button>

              <button className="button" type="button" onClick={onEdit}>
                Edit
              </button>

              <button className="button" type="button" onClick={onRemove}>
                Remove
              </button>
            </div>
          </div>

          {!canStartNow ? (
            <p className="muted helper spacer-sm">
              <strong>Send Up</strong> will enable automatically once enough
              lines are available.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
