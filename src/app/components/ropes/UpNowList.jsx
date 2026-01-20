"use client";

import { formatTime } from "@/app/lib/ropesStore";

function formatPhoneForTel(phone) {
  const trimmed = (phone || "").trim();
  if (!trimmed) return "";
  const isPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return isPlus ? `+${digits}` : digits;
}

export default function UpNowList({
  active = [],
  now = new Date(),
  onComplete = () => {},
  onRemove = () => {},
  onCopy = () => {},
  onEdit = () => {},
}) {
  const safeActive = Array.isArray(active) ? active : [];

  return (
    <div className="card">
      <h2 className="section-title">Up now ({safeActive.length})</h2>

      <div className="list spacer-sm">
        {safeActive.length === 0 ? (
          <p className="muted">No one is currently on the course.</p>
        ) : (
          safeActive.map((e) => {
            const endMs = e.endTime ? new Date(e.endTime).getTime() : null;
            const secsLeft = endMs
              ? Math.max(0, Math.floor((endMs - now.getTime()) / 1000))
              : null;
            const mins = secsLeft !== null ? Math.floor(secsLeft / 60) : null;
            const secs = secsLeft !== null ? secsLeft % 60 : null;

            return (
              <div key={e.id} className="item">
                <div className="item-main">
                  <div className="item-title">
                    {e.name} <span className="pill">{e.linesUsed} lines</span>
                  </div>

                  <div className="muted item-sub">
                    Ends: <strong>{formatTime(e.endTime)}</strong>{" "}
                    {secsLeft !== null ? (
                      <>
                        • Time left:{" "}
                        <strong>
                          {mins}:{String(secs).padStart(2, "0")}
                        </strong>
                      </>
                    ) : null}
                  </div>

                  {e.phone ? (
                    <div className="item-phone">
                      📞{" "}
                      <a
                        className="link"
                        href={`tel:${formatPhoneForTel(e.phone)}`}
                      >
                        {e.phone}
                      </a>
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => onCopy(e.phone)}
                        title="Copy phone"
                      >
                        Copy
                      </button>
                    </div>
                  ) : null}

                  {e.notes ? (
                    <div className="item-notes">📝 {e.notes}</div>
                  ) : null}
                </div>

                <div className="item-actions">
                  <button
                    className="button"
                    onClick={() => onEdit?.(e.id)}
                    type="button"
                  >
                    Edit
                  </button>

                  <button
                    className="button button-primary"
                    onClick={() => onComplete(e.id)}
                    type="button"
                  >
                    Complete
                  </button>

                  <button
                    className="button"
                    onClick={() => onRemove(e.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
