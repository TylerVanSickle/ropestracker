import { formatTime } from "@/app/lib/ropesStore";

export default function WaitlistSection({
  waiting,
  waitingPreview,
  showAllWaiting,
  setShowAllWaiting,
}) {
  return (
    <section className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <h2 className="section-title" style={{ margin: 0 }}>
          Waitlist ({waiting.length})
        </h2>

        {waiting.length > 8 ? (
          <button
            className="button"
            type="button"
            onClick={() => setShowAllWaiting((v) => !v)}
          >
            {showAllWaiting ? "View Less" : "View More"}
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>
            Shows all
          </span>
        )}
      </div>

      {waiting.length === 0 ? (
        <div className="item" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Waitlist is empty</div>
          <div className="muted" style={{ marginTop: 6 }}>
            New groups will appear here after desk check-in.
          </div>
        </div>
      ) : (
        <div className="list spacer-sm" style={{ marginTop: 12 }}>
          {waitingPreview.map((e, idx) => (
            <div key={e.id} className="item" style={{ padding: 12 }}>
              <div className="item-title">
                #{idx + 1} {e.name}{" "}
                <span className="pill">
                  {Math.max(1, Number(e.partySize || 1))} lines
                </span>
              </div>
              <div className="muted item-sub">
                Added: {formatTime(e.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
