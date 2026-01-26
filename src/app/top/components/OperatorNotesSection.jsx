export default function OperatorNotesSection() {
  return (
    <section className="card">
      <details>
        <summary
          style={{
            cursor: "pointer",
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            userSelect: "none",
          }}
        >
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>
              Operator Notes
            </h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Tap to expand (workflow + tools)
            </div>
          </div>

          <span className="pill">Help</span>
        </summary>

        <div style={{ marginTop: 12 }}>
          <div className="item" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700 }}>Workflow</div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              1) Desk hits <strong>Send Up</strong> → group appears in{" "}
              <strong>Coming Up Now</strong>.
              <br />
              2) Choose <strong>Group Tag</strong> (required).
              <br />
              3) Press <strong>Start Course</strong> → timer starts and moves to{" "}
              <strong>On Course</strong>.
            </div>
          </div>

          <div className="item" style={{ padding: 12, marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Merge</div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              If desk sent two groups up together (ex: 3 + 2), select both in{" "}
              <strong>Coming Up Now</strong> and tap{" "}
              <strong>Merge Selected</strong>.
            </div>
          </div>

          <div className="item" style={{ padding: 12, marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Flag & Archive</div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Use <strong>Flag & Archive</strong> if a group is disrespectful.
              It saves a record in <strong>/archive</strong>. You can choose
              whether to remove them from the active lists.
            </div>
          </div>

          <div className="item" style={{ padding: 12, marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Closed</div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              When Closed is on, <strong>Start Course</strong> is disabled.
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
