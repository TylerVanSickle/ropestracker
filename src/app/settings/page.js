// src/app/settings/page.jsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadSettings,
  saveSettings,
  MAX_SLING_LINES,
} from "@/app/lib/ropesStore";

import AlertToast from "@/app/components/ropes/AlertToast";
import ConfirmModal from "@/app/components/ropes/ConfirmModal";

async function stateGet() {
  const res = await fetch("/api/state", {
    method: "GET",
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok)
    throw new Error(json?.error || "Failed to load state.");
  return json;
}

async function statePut(body) {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok)
    throw new Error(json?.error || "Failed to save settings.");
  return json;
}

function mapDbSettings(db) {
  if (!db || typeof db !== "object") return null;
  return {
    siteId: db.site_id ?? null,
    totalLines: Number(db.total_lines ?? 15),
    durationMin: Number(db.duration_min ?? 45),
    topDurationMin: Number(db.top_duration_min ?? 35),
    stagingDurationMin: Number(db.staging_duration_min ?? 45),
    paused: Boolean(db.paused ?? false),
    venueName: String(db.venue_name ?? "Ropes Course Waitlist"),
    clientTheme: String(db.client_theme ?? "auto"),
    flowPaused: Boolean(db.flow_paused ?? false),
    flowPauseReason: String(db.flow_pause_reason ?? ""),
    flowPausedAt: db.flow_paused_at ?? null,
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [savedMsg, setSavedMsg] = useState("");

  // Toast (with tone)
  const [toastKey, setToastKey] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [toastTone, setToastTone] = useState("info");
  const toastClearRef = useRef(null);

  function showToast(msg, tone = "info") {
    setToastMsg(String(msg || "").trim());
    setToastTone(tone);
    setToastKey((k) => k + 1);

    if (toastClearRef.current) clearTimeout(toastClearRef.current);
    toastClearRef.current = setTimeout(() => setToastMsg(""), 1800);
  }

  // Reset confirm modal
  const [resetOpen, setResetOpen] = useState(false);

  // Load from DB on mount (and keep local cache aligned)
  useEffect(() => {
    (async () => {
      try {
        const json = await stateGet();
        const s = mapDbSettings(json.settings);
        if (s) {
          setSettings(s);
          try {
            saveSettings(s);
          } catch {}
        }
      } catch {
        // ignore; local fallback remains
      }
    })();
  }, []);

  const clamped = useMemo(() => {
    const totalLines = Math.min(
      MAX_SLING_LINES,
      Math.max(0, Number(settings.totalLines ?? 0)),
    );

    const durationMin = Math.max(
      5,
      Math.min(180, Number(settings.durationMin ?? 45)),
    );

    const topDurationMin = Math.max(
      5,
      Math.min(180, Number(settings.topDurationMin ?? 35)),
    );

    const paused = Boolean(settings.paused ?? false);

    const venueName = String(settings.venueName ?? "Ropes Course Waitlist")
      .trim()
      .slice(0, 60);

    const themeRaw = String(settings.clientTheme ?? "auto").toLowerCase();
    const clientTheme =
      themeRaw === "light" || themeRaw === "dark" || themeRaw === "auto"
        ? themeRaw
        : "auto";

    return {
      totalLines,
      durationMin,
      topDurationMin,
      paused,
      venueName,
      clientTheme,
    };
  }, [
    settings.totalLines,
    settings.durationMin,
    settings.topDurationMin,
    settings.paused,
    settings.venueName,
    settings.clientTheme,
  ]);

  function updateTotalLines(value) {
    setSettings((s) => ({
      ...s,
      totalLines: Math.min(MAX_SLING_LINES, Math.max(0, Number(value || 0))),
    }));
    setSavedMsg("");
  }

  function updateDuration(value) {
    setSettings((s) => ({
      ...s,
      durationMin: Math.max(5, Math.min(180, Number(value || 0))),
    }));
    setSavedMsg("");
  }

  function updateTopDuration(value) {
    setSettings((s) => ({
      ...s,
      topDurationMin: Math.max(5, Math.min(180, Number(value || 0))),
    }));
    setSavedMsg("");
  }

  function updateClosed(value) {
    setSettings((s) => ({ ...s, paused: Boolean(value) }));
    setSavedMsg("");
  }

  function updateVenueName(value) {
    setSettings((s) => ({ ...s, venueName: value }));
    setSavedMsg("");
  }

  function updateClientTheme(value) {
    setSettings((s) => ({ ...s, clientTheme: value }));
    setSavedMsg("");
  }

  async function onSave() {
    // optimistic local
    setSettings((s) => ({ ...s, ...clamped }));
    try {
      saveSettings(clamped);
    } catch {}

    setSavedMsg("Saving…");
    try {
      await statePut({
        settingsPatch: {
          total_lines: clamped.totalLines,
          duration_min: clamped.durationMin,
          top_duration_min: clamped.topDurationMin,
          paused: clamped.paused,
          venue_name: clamped.venueName,
          client_theme: clamped.clientTheme,
        },
      });

      setSavedMsg("Saved ✅");
      showToast("Saved ✅", "success");
    } catch (e) {
      setSavedMsg("Saved locally (sync failed)");
      showToast(String(e?.message || "Couldn’t sync to server"), "warning");
    } finally {
      setTimeout(() => setSavedMsg(""), 1500);
    }
  }

  async function doResetNow() {
    const defaults = {
      totalLines: MAX_SLING_LINES,
      durationMin: 45,
      topDurationMin: 35,
      paused: false,
      venueName: "Ropes Course Waitlist",
      clientTheme: "auto",
    };

    setSettings((s) => ({ ...s, ...defaults }));
    try {
      saveSettings(defaults);
    } catch {}

    setSavedMsg("Resetting…");
    try {
      await statePut({
        settingsPatch: {
          total_lines: defaults.totalLines,
          duration_min: defaults.durationMin,
          top_duration_min: defaults.topDurationMin,
          paused: defaults.paused,
          venue_name: defaults.venueName,
          client_theme: defaults.clientTheme,
        },
      });

      setSavedMsg("Reset ✅");
      showToast("Reset ✅", "warning");
    } catch (e) {
      setSavedMsg("Reset locally (sync failed)");
      showToast(String(e?.message || "Couldn’t sync to server"), "warning");
    } finally {
      setTimeout(() => setSavedMsg(""), 1500);
    }
  }

  return (
    <main className="container">
      <AlertToast
        toastKey={toastKey}
        message={toastMsg}
        tone={toastTone}
        durationMs={1600}
        side="right"
      />

      <div className="topbar">
        <div>
          <h1 className="title">Settings</h1>
          <p className="muted">
            Adjust course inventory + timing. Max sling lines is{" "}
            <strong>{MAX_SLING_LINES}</strong>.
          </p>
        </div>

        <div className="row">
          <Link className="button" href="/">
            Back
          </Link>

          <button
            className="button"
            onClick={() => setResetOpen(true)}
            type="button"
          >
            Reset
          </button>

          <button
            className="button button-primary"
            onClick={onSave}
            type="button"
          >
            Save
          </button>
        </div>
      </div>

      <div className="card spacer-md">
        <h2 className="section-title">Public display</h2>

        <div className="guest-form spacer-sm">
          <label className="field">
            <span className="field-label">Display name (shown on /client)</span>
            <input
              className="input"
              type="text"
              value={settings.venueName ?? ""}
              onChange={(e) => updateVenueName(e.target.value)}
              placeholder="Ropes Course Waitlist"
            />
            <p className="muted helper">
              This appears on the public facing screen. Keep it short.
            </p>
          </label>

          <label className="field">
            <span className="field-label">Public status</span>

            <div className="estimate-row" style={{ alignItems: "center" }}>
              <div>
                <strong>{clamped.paused ? "Closed" : "Open"}</strong>
                <span className="sep">•</span>
                <span className="muted">
                  When closed, /client shows a closed banner and hides ETAs.
                </span>
              </div>

              <div style={{ marginLeft: "auto" }}>
                <button
                  className={`button ${clamped.paused ? "" : "button-primary"}`}
                  type="button"
                  onClick={() => updateClosed(false)}
                  disabled={!clamped.paused}
                >
                  Open
                </button>{" "}
                <button
                  className={`button ${clamped.paused ? "button-primary" : ""}`}
                  type="button"
                  onClick={() => updateClosed(true)}
                  disabled={clamped.paused}
                >
                  Close
                </button>
              </div>
            </div>

            <p className="muted helper">
              Use this if the course is temporarily down (reset, safety check,
              staffing, etc.).
            </p>
          </label>

          <label className="field">
            <span className="field-label">Client display theme</span>
            <select
              className="input"
              value={settings.clientTheme ?? "auto"}
              onChange={(e) => updateClientTheme(e.target.value)}
            >
              <option value="auto">Auto (match device)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="muted helper">
              This only affects the public /client screen (not the staff view).
            </p>
          </label>
        </div>
      </div>

      <div className="card spacer-md">
        <h2 className="section-title">Course inventory</h2>

        <div className="guest-form spacer-sm">
          <div className="form-row form-row-2">
            <label className="field">
              <span className="field-label">Total sling lines available</span>
              <input
                className="input"
                type="number"
                min={0}
                max={MAX_SLING_LINES}
                value={settings.totalLines}
                onChange={(e) => updateTotalLines(e.target.value)}
              />
              <p className="muted helper">
                If one is out of service, drop this number.
              </p>
            </label>

            <label className="field">
              <span className="field-label">
                Desk “Send Up” duration (minutes)
              </span>
              <input
                className="input"
                type="number"
                min={5}
                max={180}
                value={settings.durationMin}
                onChange={(e) => updateDuration(e.target.value)}
              />
              <p className="muted helper">
                This is the default time used when the desk sends a group up.
              </p>
            </label>
          </div>

          <div className="form-row form-row-2">
            <label className="field">
              <span className="field-label">
                Top Ropes “Start Course” timer (minutes)
              </span>
              <input
                className="input"
                type="number"
                min={5}
                max={180}
                value={settings.topDurationMin ?? 35}
                onChange={(e) => updateTopDuration(e.target.value)}
              />
              <p className="muted helper">
                This is the timer that starts when the operator presses{" "}
                <strong>Start Course</strong> on /top.
              </p>
            </label>
          </div>

          <div className="estimate-row">
            <div>
              <span className="muted">Current total lines:</span>{" "}
              <strong>{clamped.totalLines}</strong>
            </div>
            <div>
              <span className="muted">Desk duration:</span>{" "}
              <strong>{clamped.durationMin} min</strong>
            </div>
            <div>
              <span className="muted">Top timer:</span>{" "}
              <strong>{clamped.topDurationMin} min</strong>
            </div>
            <div>
              <span className="muted">Public status:</span>{" "}
              <strong>{clamped.paused ? "Closed" : "Open"}</strong>
            </div>
            <div>
              <span className="muted">Client theme:</span>{" "}
              <strong>
                {clamped.clientTheme === "auto"
                  ? "Auto"
                  : clamped.clientTheme === "dark"
                    ? "Dark"
                    : "Light"}
              </strong>
            </div>

            {savedMsg ? (
              <div>
                <strong>{savedMsg}</strong>
              </div>
            ) : null}
          </div>

          <p className="muted helper" style={{ marginTop: 10 }}>
            Tip: Public screen: <strong>/client</strong> • Print sheet:{" "}
            <strong>/print</strong>
          </p>
        </div>
      </div>

      <ConfirmModal
        open={resetOpen}
        title="Reset settings?"
        message="This will restore defaults."
        confirmText="Reset"
        cancelText="Cancel"
        tone="danger"
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          doResetNow();
        }}
      />
    </main>
  );
}
