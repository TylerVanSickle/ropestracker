import Link from "next/link";
import FlowControlButton from "./FlowControlButton";

export default function TopHeader({
  closed,
  availableLines,
  totalLines,
  sentCount,
  courseCount,
  waitingCount,
  settings,
}) {
  return (
    <div className="topbar">
      {/* ROW 1: Title + helper text (full width) */}
      <div>
        <h1 style={{ margin: 0 }}>Top Ropes</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Operators: tag → Start Course • Desk: Send Up reserves lines
        </div>
      </div>

      {/* ROW 2: Buttons (left) + Status cards (right) */}
      <div className="topbarRow2">
        {/* LEFT: Buttons */}
        <div className="row topbarLinks">
          <Link className="button" href="/">
            Bottom
          </Link>

          <Link className="button" href="/client" target="_blank">
            Client Display
          </Link>

          <Link className="button" href="/archive" target="_blank">
            Archive
          </Link>

          <Link className="button" href="/settings" target="_blank">
            Settings
          </Link>

          {/* ✅ pass DB-backed settings down */}
          <FlowControlButton className="button" settings={settings} />
        </div>

        {/* RIGHT: Status cards */}
        <div
          className="card topbarStatus"
          style={{
            padding: 12,
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Status
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {closed ? "CLOSED" : "OPEN"}
            </div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Lines
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {availableLines} / {totalLines} free
            </div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Coming Up
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{sentCount}</div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              On Course
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{courseCount}</div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Waiting
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{waitingCount}</div>
          </div>

          <div className="item" style={{ padding: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Course Timer
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {Number(settings?.topDurationMin ?? 35)} min
            </div>
          </div>
        </div>
      </div>

      {/* CLOSED warning */}
      {closed ? (
        <div
          className="card"
          style={{
            marginTop: 12,
            border: "2px solid var(--danger, #ff4d4d)",
          }}
        >
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <strong>Closed</strong>
            <span className="muted">
              Start Course is disabled while Closed is on.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
