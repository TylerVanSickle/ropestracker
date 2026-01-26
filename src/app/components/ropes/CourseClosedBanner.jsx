"use client";

export default function CourseClosedBanner({ settings }) {
  const closed = Boolean(settings?.paused);
  if (!closed) return null;

  return (
    <div
      className="card spacer-sm"
      style={{
        borderLeft: "6px solid #e54848",
        background: "rgba(229, 72, 72, 0.08)",
      }}
    >
      <div className="card-header">
        <div>
          <h2
            className="section-title"
            style={{ marginBottom: 4, color: "#e54848" }}
          >
            Course closed
          </h2>
          <p className="muted helper" style={{ margin: 0 }}>
            The ropes course is currently closed.
            <br />
          </p>
        </div>
      </div>
    </div>
  );
}
