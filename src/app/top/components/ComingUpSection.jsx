import { formatTime } from "@/app/lib/ropesStore";

export default function ComingUpSection({
  sentUp,
  sentPreview,
  settings,
  closed,
  mergeIds,
  showAllSent,
  setShowAllSent,
  toggleMergeSelect,
  doMergeSelected,
  clearMerge,
  tagOptionsForEntry,
  handleAssignTag,
  openEdit,
  handleStartCourse,
  handleFinish,
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
          Coming Up Now ({sentUp.length})
        </h2>

        <div
          className="row"
          style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}
        >
          {mergeIds.length ? (
            <span className="pill">Selected: {mergeIds.length}/2</span>
          ) : null}

          {mergeIds.length === 2 ? (
            <>
              <button
                className="button button-primary"
                type="button"
                onClick={doMergeSelected}
              >
                Merge Selected
              </button>
              <button className="button" type="button" onClick={clearMerge}>
                Clear
              </button>
            </>
          ) : mergeIds.length === 1 ? (
            <button className="button" type="button" onClick={clearMerge}>
              Clear
            </button>
          ) : null}

          {sentUp.length > 5 ? (
            <button
              className="button"
              type="button"
              onClick={() => setShowAllSent((v) => !v)}
            >
              {showAllSent ? "View Less" : "View More"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Tip: Select 2 groups to merge if desk sent them up together.
      </div>

      {sentUp.length === 0 ? (
        <div className="item" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            No groups coming up
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Desk hasn’t sent anyone up yet. When they hit{" "}
            <strong>Send Up</strong>, groups will appear here.
          </div>
        </div>
      ) : (
        <div className="list spacer-sm" style={{ marginTop: 12 }}>
          {sentPreview.map((e) => {
            const needs = Math.max(1, Number(e.partySize || 1));
            const tagOptions = tagOptionsForEntry(e);
            const selected = mergeIds.includes(e.id);

            return (
              <div
                key={e.id}
                className="item item-next"
                style={{
                  padding: 14,
                  ...(entryTintStyle(e) || {}),
                  outline: selected
                    ? "2px solid var(--accent, #6aa9ff)"
                    : "none",
                }}
              >
                <div className="item-main">
                  <div className="item-title" style={{ fontSize: 18 }}>
                    {e.name} <span className="pill">{needs} lines</span>{" "}
                    <span className="pill">COMING UP</span>
                    {e.assignedTag ? (
                      <span className="pill">{e.assignedTag}</span>
                    ) : null}
                    {selected ? <span className="pill">SELECTED</span> : null}
                  </div>

                  {e.notes ? (
                    <div className="item-notes">📝 {e.notes}</div>
                  ) : null}

                  <div className="muted item-sub">
                    Sent up: {e.sentUpAt ? formatTime(e.sentUpAt) : "—"}
                  </div>

                  <div
                    className="row"
                    style={{
                      gap: 10,
                      marginTop: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="button"
                      type="button"
                      onClick={() => toggleMergeSelect(e.id)}
                    >
                      {selected ? "Unselect" : "Select"}
                    </button>

                    <label className="muted" style={{ fontSize: 13 }}>
                      Group Tag (required):
                    </label>

                    <select
                      className="input"
                      style={{ minWidth: 240, padding: 10 }}
                      value={e.assignedTag ?? ""}
                      onChange={(ev) => handleAssignTag(e.id, ev.target.value)}
                    >
                      <option value="">Select a tag…</option>
                      {tagOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    <button
                      className="button"
                      type="button"
                      onClick={() => openEdit(e)}
                    >
                      Edit
                    </button>
                  </div>

                  {!e.assignedTag ? (
                    <div className="muted" style={{ marginTop: 10 }}>
                      Choose a tag to enable <strong>Start Course</strong>.
                    </div>
                  ) : null}
                </div>

                <div
                  className="item-actions"
                  style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                >
                  <button
                    className="button button-primary"
                    onClick={() => handleStartCourse(e)}
                    disabled={closed || !e.assignedTag}
                    type="button"
                    style={{ padding: "10px 14px" }}
                  >
                    Start Course ({Number(settings?.topDurationMin ?? 35)})
                  </button>

                  <button
                    className="button"
                    onClick={() => handleFinish(e)}
                    type="button"
                  >
                    Finish
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
