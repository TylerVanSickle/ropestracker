"use client";

export default function NextUpActions({
  nextWaiting,
  nextEstStartText,
  nextWaitRange,
  canStartNow,
  onNotify,
  onStart,
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
            One-tap actions for the next group to keep the desk moving.
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
              >
                Start
              </button>
              <button className="button" type="button" onClick={onNotify}>
                Notify
              </button>
              <button className="button" type="button" onClick={onEdit}>
                Edit
              </button>
              <button className="button" type="button" onClick={onNoShow}>
                No-show
              </button>
              <button className="button" type="button" onClick={onRemove}>
                Remove
              </button>
            </div>
          </div>

          {!canStartNow ? (
            <p className="muted helper spacer-sm">
              Start will enable automatically once enough lines are available.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
