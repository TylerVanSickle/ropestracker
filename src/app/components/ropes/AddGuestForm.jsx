"use client";

export default function AddGuestForm({ newGuest, setNewGuest, onAddGuest }) {
  return (
    <div className="card spacer-md">
      <div className="card-header">
        <div>
          <h2 className="section-title">Add guest</h2>
          <p className="muted helper">
            Add them to the line. You can edit them later.
          </p>
        </div>
      </div>

      <form onSubmit={onAddGuest} className="guest-form spacer-sm">
        <div className="form-row">
          <label className="field">
            <span className="field-label">Name / Group</span>
            <input
              className="input"
              value={newGuest.name}
              onChange={(e) =>
                setNewGuest((g) => ({ ...g, name: e.target.value }))
              }
              placeholder="e.g., Smith Family"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field-label">Party size</span>
            <input
              className="input"
              type="number"
              min={1}
              value={newGuest.partySize}
              onChange={(e) =>
                setNewGuest((g) => ({
                  ...g,
                  partySize: Math.max(1, Number(e.target.value || 1)),
                }))
              }
            />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span className="field-label">Phone (optional)</span>
            <input
              className="input"
              value={newGuest.phone}
              onChange={(e) =>
                setNewGuest((g) => ({ ...g, phone: e.target.value }))
              }
              placeholder="e.g., 801-555-1234"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>

          <label className="field">
            <span className="field-label">Notes (optional)</span>
            <input
              className="input"
              value={newGuest.notes}
              onChange={(e) =>
                setNewGuest((g) => ({ ...g, notes: e.target.value }))
              }
              placeholder="birthday, call at 3:10, etc."
              autoComplete="off"
            />
          </label>
        </div>

        <button className="button button-primary button-wide" type="submit">
          Add to waitlist
        </button>
      </form>
    </div>
  );
}
