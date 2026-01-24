// WaitingList.jsx
"use client";

import { formatTime } from "@/app/lib/ropesStore";
import { formatPhoneForTel, getWaitRangeText } from "@/app/lib/ropesUtils";

export default function WaitlingList({
  waiting,
  availableLines,
  estimateMap,
  onEdit,
  onMoveUp,
  onMoveDown,
  onNotify,
  onStart, // now means "Send Up" (reserve lines + mark coming up)
  onNoShow,
  onRemove, // (kept for compatibility, but not used here anymore)
}) {
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

            const canSendUp = isFront && availableLines >= needs;

            const reason = !isFront
              ? "Can’t skip the line"
              : availableLines < needs
                ? `Needs ${needs}, only ${availableLines} available`
                : "";

            const est = estimateMap.get(e.id);
            const estStartText = est?.estStartISO
              ? formatTime(est.estStartISO)
              : "—";
            const waitRange =
              est?.estWaitMin != null ? getWaitRangeText(est.estWaitMin) : "—";

            return (
              <div key={e.id} className={`item ${isFront ? "item-next" : ""}`}>
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

                <div className="item-actions">
                  <button
                    className="button"
                    onClick={() => onEdit(e.id)}
                    type="button"
                  >
                    Edit
                  </button>

                  <div className="row" style={{ gap: 8 }}>
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
                      onClick={() => onNotify(e)}
                      type="button"
                    >
                      Notify
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

                  {/* Remove moved into Edit modal "Danger zone" */}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
