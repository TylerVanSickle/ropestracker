"use client";

import { formatTime } from "@/app/lib/ropesStore";

function formatPhoneForTel(phone) {
  const trimmed = (phone || "").trim();
  if (!trimmed) return "";
  const isPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return isPlus ? `+${digits}` : digits;
}

function getPhaseLabel(e) {
  const raw = String(e?.coursePhase || "").toUpperCase();
  if (raw === "SENT") return "COMING UP";
  if (raw === "ON_COURSE") return "ON COURSE";
  return "ON COURSE";
}

// Uses remaining seconds for warning styling (0..total)
function timeDangerStyle({ secsRemaining, totalMins = 35, isOverdue = false }) {
  if (secsRemaining == null) return null;

  // 🔥 If overdue, go full danger
  if (isOverdue) {
    return {
      background: `rgba(255, 59, 48, 0.22)`,
      borderLeft: `6px solid rgba(255, 59, 48, 0.9)`,
      animation: "dangerPulse 1.1s ease-in-out infinite",
    };
  }

  const totalSecs = totalMins * 60;
  const clamped = Math.max(0, Math.min(totalSecs, secsRemaining));
  const progress = clamped / totalSecs;

  if (progress > 0.43) return null;

  const danger = (0.5 - progress) / 0.5;

  const bgAlpha = Math.min(0.35, 0.08 + danger * 0.35);
  const borderAlpha = Math.min(0.9, 0.3 + danger * 0.6);

  const style = {
    background: `rgba(255, 59, 48, ${bgAlpha})`,
    borderLeft: `6px solid rgba(255, 59, 48, ${borderAlpha})`,
  };

  if (secsRemaining <= 60)
    style.animation = "dangerPulse 1s ease-in-out infinite";
  else if (secsRemaining <= 180)
    style.animation = "dangerPulse 1.6s ease-in-out infinite";
  else if (secsRemaining <= 300)
    style.animation = "dangerPulse 2.4s ease-in-out infinite";

  return style;
}

function mmssFromSeconds(absSecs) {
  const mins = Math.floor(absSecs / 60);
  const secs = absSecs % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
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

  // ✅ total "people/lines" currently on course (sum of partySize)
  const activeLinesUsed = safeActive.reduce(
    (sum, e) => sum + Math.max(1, Number(e.partySize || 1)),
    0,
  );

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <h2 className="section-title" style={{ margin: 0 }}>
          Up now ({safeActive.length})
        </h2>

        <span className="muted" style={{ fontSize: 13 }}>
          On course: <strong>{activeLinesUsed}</strong> line(s)
        </span>
      </div>

      <div className="list spacer-sm">
        {safeActive.length === 0 ? (
          <p className="muted">No one is currently on the course.</p>
        ) : (
          safeActive.map((e) => {
            const endMs = e.endTime ? new Date(e.endTime).getTime() : null;

            // ✅ can be negative (overdue)
            const secsDiff =
              endMs != null && Number.isFinite(endMs)
                ? Math.floor((endMs - now.getTime()) / 1000)
                : null;

            const isOverdue = secsDiff != null ? secsDiff < 0 : false;
            const secsRemaining =
              secsDiff != null ? Math.max(0, secsDiff) : null;

            const phaseLabel = getPhaseLabel(e);

            const timeText =
              secsDiff == null
                ? null
                : isOverdue
                  ? `OVERDUE ${mmssFromSeconds(Math.abs(secsDiff))}`
                  : mmssFromSeconds(secsDiff);

            return (
              <div
                key={e.id}
                className="item"
                style={{
                  ...(timeDangerStyle({
                    secsRemaining,
                    totalMins: Number(e.topDurationMin || 35),
                    isOverdue,
                  }) || {}),
                }}
              >
                <div className="item-main">
                  <div className="item-title">
                    {e.name}{" "}
                    <span className="pill">
                      {Math.max(1, Number(e.partySize || 1))} lines
                    </span>
                    <span className="pill">{phaseLabel}</span>
                    {e.assignedTag ? (
                      <span className="pill">{e.assignedTag}</span>
                    ) : null}
                    {isOverdue ? <span className="pill">OVERDUE</span> : null}
                  </div>

                  <div className="muted item-sub">
                    Ends: <strong>{formatTime(e.endTime)}</strong>
                    {timeText ? (
                      <>
                        {" "}
                        •{" "}
                        <strong style={{ letterSpacing: 0.2 }}>
                          {isOverdue ? timeText : `Time left: ${timeText}`}
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
