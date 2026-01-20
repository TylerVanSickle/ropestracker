"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  loadSettings,
  saveSettings,
  MAX_SLING_LINES,
} from "@/app/lib/ropesStore";

export default function SettingsPage() {
  // ✅ Lazy init avoids setState-in-effect lint
  const [settings, setSettings] = useState(() => loadSettings());
  const [savedMsg, setSavedMsg] = useState("");

  const clamped = useMemo(() => {
    const totalLines = Math.min(
      MAX_SLING_LINES,
      Math.max(0, Number(settings.totalLines ?? 0)),
    );

    // keep duration reasonable
    const durationMin = Math.max(
      5,
      Math.min(180, Number(settings.durationMin ?? 45)),
    );

    return { totalLines, durationMin };
  }, [settings.totalLines, settings.durationMin]);

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

  function onSave() {
    saveSettings(clamped);
    setSavedMsg("Saved ✅");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  function onReset() {
    // reset to your known defaults (and still respect MAX)
    const defaults = { totalLines: MAX_SLING_LINES, durationMin: 45 };
    setSettings(defaults);
    saveSettings(defaults);
    setSavedMsg("Reset ✅");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  return (
    <main className="container">
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
          <button className="button" onClick={onReset}>
            Reset
          </button>
          <button className="button button-primary" onClick={onSave}>
            Save
          </button>
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
              <span className="field-label">Session duration (minutes)</span>
              <input
                className="input"
                type="number"
                min={5}
                max={180}
                value={settings.durationMin}
                onChange={(e) => updateDuration(e.target.value)}
              />
              <p className="muted helper">
                Default is 45 — change it if ops changes the time.
              </p>
            </label>
          </div>

          <div className="estimate-row">
            <div>
              <span className="muted">Current total lines:</span>{" "}
              <strong>{clamped.totalLines}</strong>
            </div>
            <div>
              <span className="muted">Current duration:</span>{" "}
              <strong>{clamped.durationMin} min</strong>
            </div>
            {savedMsg ? (
              <div>
                <strong>{savedMsg}</strong>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
