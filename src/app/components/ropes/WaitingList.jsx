// WaitingList.jsx
"use client";
import { useMemo } from "react";
import { formatTime } from "@/app/lib/ropesStore";
import { formatPhoneForTel, getWaitRangeText } from "@/app/lib/ropesUtils";

const NOTIFY_TIMEOUT_MS = 5 * 60 * 1000;

function fmtCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WaitingList({
  waiting,
  availableLines,
  totalLines,
  leadModeActive,
  estimateMap,
  onEdit,
  onMoveUp,
  onMoveDown,
  onNotify,
  onStart, // "Send Up"
  onNoShow,
  onRemove, // kept for compatibility
}) {
  const waitingLinesDemand = useMemo(() => {
    return waiting.reduce(
      (sum, e) => sum + Math.max(1, Number(e.partySize || 1)),
      0,
    );
  }, [waiting]);

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <h2 className="section-title" style={{ margin: 0 }}>
          Waiting ({waiting.length})
        </h2>

        <span className="muted" style={{ fontSize: 13 }}>
          Demand: <strong>{waitingLinesDemand}</strong> line(s)
        </span>

        <span className="muted" style={{ fontSize: 13 }}>
          You can reorder + edit anytime
        </span>
      </div>

      <div className="list spacer-sm">
        {waiting.length === 0 ? (
          <p className="muted">No one is waiting.</p>
        ) : (
          waiting.map((e, idx) => {
            const needs = Math.max(1, Number(e.partySize || 1));
            const isFront = idx === 0;

            const canSendUp = isFront && (leadModeActive || availableLines >= needs);

            const reason = !isFront
              ? "Can’t skip the line"
              : availableLines < needs && !leadModeActive
                ? `Needs ${needs}, only ${availableLines} available`
                : "";

            const est = estimateMap.get(e.id);
            const estStartText = est?.estStartISO
              ? formatTime(est.estStartISO)
              : "—";
            const waitRange =
              est?.estWaitMin != null ? getWaitRangeText(est.estWaitMin) : "—";

            const notifyTs = e.lastNotifiedAt
              ? new Date(e.lastNotifiedAt).getTime()
              : 0;
            const notifySecondsLeft =
              notifyTs && !leadModeActive
                ? Math.max(
                    0,
                    Math.ceil(
                      (NOTIFY_TIMEOUT_MS - (Date.now() - notifyTs)) / 1000,
                    ),
                  )
                : 0;
            const isNotifyBlocked = notifySecondsLeft > 0;

            return (
              <div
                key={e.id}
                className={`item item-split ${isFront ? "item-next" : ""}`}
              >
                <div className="item-main">
                  <div className="item-title">
                    #{idx + 1} {e.name}{" "}
                    <span className="pill">{needs} lines</span>
                    {isFront ? <span className="pill">NEXT</span> : null}
                  </div>

                  <div className="muted item-sub">
                    Added: {formatTime(e.createdAt)}
                  </div>

                  <div className="estimate-row">
                    <div>
                      <span className="muted">Estimated start:</span>{" "}
                      <strong>{estStartText}</strong>
                    </div>
                    <div>
                      <span className="muted">Quoted wait:</span>{" "}
                      <strong>{waitRange}</strong>
                    </div>
                  </div>

                  {isFront && !canSendUp ? (
                    <div className="muted item-sub">{reason}</div>
                  ) : null}

                  {e.phone ? (
                    <div className="item-phone">
                      📞{" "}
                      <a
                        className="link"
                        href={`tel:${formatPhoneForTel(e.phone)}`}
                      >
                        {e.phone}
                      </a>
                    </div>
                  ) : null}

                  {e.notes ? (
                    <div className="item-notes">📝 {e.notes}</div>
                  ) : null}
                </div>

                <div className="item-actions item-actions-row">
                  <button
                    className="button"
                    onClick={() => onEdit(e.id)}
                    type="button"
                  >
                    Edit
                  </button>

                  <div className="row waiting-arrows" style={{ gap: 8 }}>
                    <button
                      className="button"
                      onClick={() => onMoveUp(e.id)}
                      disabled={idx === 0}
                      title="Move up"
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      className="button"
                      onClick={() => onMoveDown(e.id)}
                      disabled={idx === waiting.length - 1}
                      title="Move down"
                      type="button"
                    >
                      ↓
                    </button>
                  </div>

                  {isFront && canSendUp ? (
                    <button
                      className="button"
                      onClick={() => !isNotifyBlocked && onNotify(e)}
                      disabled={isNotifyBlocked}
                      title={
                        isNotifyBlocked
                          ? `Already notified — ${fmtCountdown(notifySecondsLeft)} remaining`
                          : undefined
                      }
                      type="button"
                    >
                      {isNotifyBlocked
                        ? `Notify (${fmtCountdown(notifySecondsLeft)})`
                        : "Notify"}
                    </button>
                  ) : null}

                  <button
                    className="button button-primary"
                    onClick={() => onStart(e.id)}
                    disabled={!canSendUp}
                    title={
                      !canSendUp ? reason : "Send this group up (reserve lines)"
                    }
                    type="button"
                  >
                    Send Up
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
