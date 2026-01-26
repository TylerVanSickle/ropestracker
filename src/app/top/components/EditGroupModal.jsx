export default function EditGroupModal({
  open,
  editDraft,
  setEditDraft,
  closeEdit,
  saveEdit,
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
        zIndex: 9999,
      }}
      onClick={closeEdit}
    >
      <div
        className="card"
        style={{ width: "min(720px, 100%)", padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <h2 className="section-title" style={{ margin: 0 }}>
            Edit Group
          </h2>
          <button className="button" onClick={closeEdit} type="button">
            Close
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Name
              </div>
              <input
                className="input"
                style={{ width: "100%", padding: 10 }}
                value={editDraft.name}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </div>

            <div style={{ width: 180 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Lines (party size)
              </div>
              <input
                className="input"
                style={{ width: "100%", padding: 10 }}
                value={editDraft.partySize}
                onChange={(e) =>
                  setEditDraft((d) => ({
                    ...d,
                    partySize: e.target.value,
                  }))
                }
                inputMode="numeric"
              />
            </div>
          </div>

          <div
            className="row"
            style={{ gap: 12, marginTop: 12, flexWrap: "wrap" }}
          >
            <div style={{ flex: "1 1 260px" }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Phone
              </div>
              <input
                className="input"
                style={{ width: "100%", padding: 10 }}
                value={editDraft.phone}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, phone: e.target.value }))
                }
              />
            </div>

            <div style={{ flex: "2 1 340px" }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Notes
              </div>
              <input
                className="input"
                style={{ width: "100%", padding: 10 }}
                value={editDraft.notes}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <div
            className="row"
            style={{
              gap: 10,
              marginTop: 14,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button className="button" onClick={closeEdit} type="button">
              Cancel
            </button>
            <button
              className="button button-primary"
              onClick={saveEdit}
              type="button"
            >
              Save Changes
            </button>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Updates reflect on other screens on the same device/tabs.
          </div>
        </div>
      </div>
    </div>
  );
}
