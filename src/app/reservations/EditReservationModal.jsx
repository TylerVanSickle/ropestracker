"use client";

import { useEffect, useState } from "react";
import DateTimePicker from "@/app/components/ropes/DateTimePicker";
import { EVENT_TYPES, formatPhoneUS } from "@/app/lib/reservations";

function buildInitial(r) {
  if (!r) {
    return {
      name: "",
      phone: "",
      party_size: 1,
      notes: "",
      reserved_at: null,
      event_type: "general",
    };
  }
  return {
    name: r.name || "",
    phone: r.phone || "",
    party_size: r.party_size || 1,
    notes: r.notes || "",
    reserved_at: r.reserved_at ? new Date(r.reserved_at) : null,
    event_type: r.event_type || "general",
  };
}

export default function EditReservationModal({
  reservation,
  saving,
  onSave,
  onClose,
}) {
  const open = Boolean(reservation);
  const [form, setForm] = useState(() => buildInitial(reservation));

  useEffect(() => {
    if (open) setForm(buildInitial(reservation));
  }, [open, reservation]);

  if (!open) return null;

  function submit(e) {
    e.preventDefault();
    if (saving) return;

    if (!form.reserved_at || isNaN(form.reserved_at.getTime())) {
      alert("Please pick a date and time.");
      return;
    }
    if (!form.name.trim()) {
      alert("Name is required.");
      return;
    }

    onSave({
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, "") || null,
      party_size: Number(form.party_size) || 1,
      notes: form.notes.trim() || null,
      reserved_at: form.reserved_at.toISOString(),
      event_type: form.event_type,
    });
  }

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
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "min(620px, 100%)",
          padding: 18,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h2 className="section-title" style={{ margin: 0, fontSize: 18 }}>
            Edit: {reservation?.name || "Reservation"}
          </h2>
          <button className="button" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={submit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label className="field-label">Name / Group</label>
              <input
                className="input"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                maxLength={80}
                autoFocus
              />
            </div>

            <div>
              <label className="field-label">Phone</label>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={formatPhoneUS(form.phone)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                placeholder="(801) 555-1234"
              />
            </div>

            <div>
              <label className="field-label">Group size</label>
              <input
                className="input"
                type="number"
                min={1}
                max={20}
                step={1}
                value={form.party_size}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    party_size: Math.max(
                      1,
                      Math.min(20, Math.floor(Number(e.target.value) || 1)),
                    ),
                  }))
                }
              />
            </div>

            <div>
              <label className="field-label">Event type</label>
              <select
                className="input"
                value={form.event_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, event_type: e.target.value }))
                }
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Date &amp; time</label>
              <DateTimePicker
                value={form.reserved_at}
                onChange={(d) =>
                  setForm((f) => ({ ...f, reserved_at: d }))
                }
                required
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Notes</label>
              <input
                className="input"
                type="text"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                maxLength={500}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 18,
              justifyContent: "flex-end",
            }}
          >
            <button
              className="button"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
