"use client";

import { useState } from "react";
import DateTimePicker from "@/app/components/ropes/DateTimePicker";
import { EVENT_TYPES, formatPhoneUS } from "@/app/lib/reservations";

function emptyForm() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  return {
    name: "",
    phone: "",
    party_size: 1,
    notes: "",
    reserved_at: next, // Date object
    event_type: "general",
  };
}

export default function AddReservationForm({ onCreate, saving }) {
  const [form, setForm] = useState(emptyForm);
  const [collapsed, setCollapsed] = useState(false);

  async function submit(e) {
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

    const ok = await onCreate({
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, "") || null,
      party_size: Number(form.party_size) || 1,
      notes: form.notes.trim() || null,
      reserved_at: form.reserved_at.toISOString(),
      event_type: form.event_type,
    });

    if (ok) setForm(emptyForm());
  }

  return (
    <section className="card spacer-md" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: collapsed ? 0 : 12,
        }}
      >
        <h2 className="section-title" style={{ margin: 0, fontSize: 18 }}>
          Add reservation
        </h2>
        <button
          type="button"
          className="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{ fontSize: 12, padding: "4px 10px", minHeight: 0 }}
        >
          {collapsed ? "Show form" : "Hide form"}
        </button>
      </div>

      {collapsed ? null : (
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
                placeholder="e.g. Smith Family"
                required
                maxLength={80}
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
                placeholder="Birthday cake at 3pm, etc."
                maxLength={500}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 14,
              justifyContent: "flex-end",
            }}
          >
            <button
              className="button button-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Add reservation"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
