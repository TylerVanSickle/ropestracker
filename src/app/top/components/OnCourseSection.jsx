import { formatTime } from "@/app/lib/ropesStore";
import { minutesLeft } from "@/app/top/lib/topRopesHelpers";

export default function OnCourseSection({
  onCourse,
  handleExtend,
  handleFinish,
  openEdit,
  openArchive,
  entryTintStyle,
}) {
  return (
    <section className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <h2 className="section-title" style={{ margin: 0 }}>
          On Course ({onCourse.length})
        </h2>
        <span className="muted" style={{ fontSize: 13 }}>
          +5 / End Early / Done / Edit / Archive
        </span>
      </div>

      {onCourse.length === 0 ? (
        <div className="item" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            No one is on course
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            When you press <strong>Start Course</strong> for a Coming Up group,
            they’ll appear here with a timer.
          </div>
        </div>
      ) : (
        <div className="list spacer-sm" style={{ marginTop: 12 }}>
          {onCourse.map((e) => {
            const needs = Math.max(1, Number(e.partySize || 1));
            const left = minutesLeft(e.endTime);
            const leftText =
              left == null
                ? "—"
                : left >= 0
                  ? `${left} min left`
                  : `${Math.abs(left)} min overdue`;

            return (
              <div
                key={e.id}
                className="item"
                style={{
                  padding: 14,
                  ...(entryTintStyle(e) || {}),
                }}
              >
                <div className="item-main">
                  <div className="item-title" style={{ fontSize: 18 }}>
                    {e.name} <span className="pill">{needs} lines</span>{" "}
                    <span className="pill">ON COURSE</span>
                    {e.assignedTag ? (
                      <span className="pill">{e.assignedTag}</span>
                    ) : null}
                  </div>

                  <div className="muted item-sub">
                    Ends: {e.endTime ? formatTime(e.endTime) : "—"} •{" "}
                    <strong>{leftText}</strong>
                    {Number(e.timeAdjustMin || 0) ? (
                      <> • Adjusted: +{Number(e.timeAdjustMin || 0)}m</>
                    ) : null}
                  </div>

                  {e.notes ? (
                    <div className="item-notes" style={{ marginTop: 8 }}>
                      📝 {e.notes}
                    </div>
                  ) : null}
                </div>

                <div
                  className="item-actions"
                  style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                >
                  <button
                    className="button"
                    onClick={() => handleExtend(e.id)}
                    type="button"
                  >
                    +5 min
                  </button>

                  <button
                    className="button button-primary"
                    onClick={() => handleFinish(e)}
                    type="button"
                    title="Marks group done and frees up lines"
                  >
                    Finish
                  </button>

                  <button
                    className="button"
                    onClick={() => openEdit(e)}
                    type="button"
                  >
                    Edit
                  </button>

                  <button
                    className="button"
                    onClick={() => openArchive(e)}
                    type="button"
                  >
                    Flag & Archive
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
