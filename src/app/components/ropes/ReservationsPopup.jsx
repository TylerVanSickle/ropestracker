"use client";

import Link from "next/link";
import Modal from "@/app/components/ropes/Modal";
import { ensureQueueOrder } from "@/app/lib/ropesUtils";

function formatPhone(digits) {
  const d = String(digits || "")
    .replace(/\D/g, "")
    .slice(0, 10);
  if (!d) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ReservationsPopup({
  open,
  onClose,
  entries,
  setEntries,
  nowMs, // ✅ pass from Home to avoid Date.now() during render
}) {
  if (!open) return null;

  const reserved = (entries || [])
    .filter((e) => e.status === "RESERVED")
    .slice()
    .sort((a, b) => {
      const atA = a.reserveAtISO ? new Date(a.reserveAtISO).getTime() : 0;
      const atB = b.reserveAtISO ? new Date(b.reserveAtISO).getTime() : 0;
      return atA - atB;
    });

  const dueNow = [];
  const upcoming = [];

  for (const e of reserved) {
    const at = e.reserveAtISO ? new Date(e.reserveAtISO).getTime() : 0;
    if (at && !Number.isNaN(at) && at <= nowMs) dueNow.push(e);
    else upcoming.push(e);
  }

  function checkInNow(id) {
    setEntries((prev) => {
      const ms = Date.now(); // ok inside event handler
      const next = prev.map((e) => {
        if (e.id !== id) return e;
        return {
          ...e,
          status: "WAITING",
          linesUsed: 0,
          queueOrder: ms - 10_000 + Math.random(),
        };
      });
      return ensureQueueOrder(next);
    });
  }

  function deleteReservation(id) {
    const ok = confirm("Delete this reservation?");
    if (!ok) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <Modal title="Reservations" onClose={onClose}>
      <div className="spacer-sm">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <p className="muted helper" style={{ margin: 0 }}>
            Ready now: <strong>{dueNow.length}</strong> • Upcoming:{" "}
            <strong>{upcoming.length}</strong>
          </p>

          <Link className="button" href="/reservations" onClick={onClose}>
            Open page
          </Link>
        </div>

        <div className="card spacer-sm" style={{ marginTop: 10 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Ready now
          </h3>

          {dueNow.length === 0 ? (
            <p className="muted helper">None due yet.</p>
          ) : (
            dueNow.map((e) => (
              <div
                key={e.id}
                className="row spacer-sm"
                style={{ justifyContent: "space-between" }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {e.name}{" "}
                    <span className="muted">• {Number(e.partySize || 1)}</span>
                  </div>
                  <div className="muted helper">
                    {formatWhen(e.reserveAtISO)} • {formatPhone(e.phone)}
                    {e.notes ? ` • ${e.notes}` : ""}
                  </div>
                </div>

                <div className="row">
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => checkInNow(e.id)}
                    title="Move to the front of the waiting list"
                  >
                    Check in
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => deleteReservation(e.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card spacer-sm" style={{ marginTop: 10 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Upcoming
          </h3>

          {upcoming.length === 0 ? (
            <p className="muted helper">No upcoming reservations.</p>
          ) : (
            upcoming.slice(0, 8).map((e) => (
              <div
                key={e.id}
                className="row spacer-sm"
                style={{ justifyContent: "space-between" }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {e.name}{" "}
                    <span className="muted">• {Number(e.partySize || 1)}</span>
                  </div>
                  <div className="muted helper">
                    {formatWhen(e.reserveAtISO)} • {formatPhone(e.phone)}
                    {e.notes ? ` • ${e.notes}` : ""}
                  </div>
                </div>

                <button
                  className="button"
                  type="button"
                  onClick={() => deleteReservation(e.id)}
                >
                  Delete
                </button>
              </div>
            ))
          )}

          {upcoming.length > 8 ? (
            <p className="muted helper" style={{ marginTop: 10 }}>
              Showing first 8 upcoming. Open the Reservations page to see all.
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
