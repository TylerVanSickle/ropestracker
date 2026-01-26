"use client";

export default function FlowPausedBanner({ settings }) {
  const paused = Boolean(settings?.flowPaused);
  if (!paused) return null;

  const reason = String(settings?.flowPauseReason || "").trim();

  return (
    <div
      className="card spacer-sm"
      style={{
        borderLeft: "6px solid #f5c542",
        background: "rgba(245, 197, 66, 0.08)",
      }}
    >
      <div className="card-header">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            Flow paused
          </h2>
          <p className="muted helper" style={{ margin: 0 }}>
            Bottom cannot send groups up right now.
            {reason ? (
              <>
                <br />
                <strong>Reason:</strong> {reason}
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
