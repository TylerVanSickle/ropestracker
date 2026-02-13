"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadSettings } from "@/app/lib/ropesStore";

/**
 * Plays a jingle on /top when Bottom sends a group up.
 * Detects "new sentUpAt" values in entries and plays once.
 
 */
export default function TopSoundController({
  entries = [],
  sentUpField = "sentUpAt", // your entry uses sentUpAt already
}) {
  const [unlocked, setUnlocked] = useState(false);

  // read setting once (simple). If you want it to react live, we can subscribe later.
  const soundsEnabled = useMemo(() => {
    const s = loadSettings();
    return s?.soundsEnabled ?? true;
  }, []);

  const audioRef = useRef(null);
  const lastSeenSentUpRef = useRef(0);

  // Create audio once
  useEffect(() => {
    audioRef.current = new Audio("/sounds/send-up.mp3");
    audioRef.current.preload = "auto";
  }, []);

  function toMs(value) {
    if (!value) return 0;
    if (typeof value === "number") return value;
    const d = new Date(value);
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  async function play() {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      await a.play();
    } catch {
      // iOS autoplay restrictions, muted device, etc.
    }
  }

  // iPad requires one user gesture to allow audio
  async function enableSounds() {
    if (!soundsEnabled) return;
    try {
      const a = audioRef.current;
      if (!a) return;
      const originalVol = a.volume;

      a.volume = 0.001;
      a.currentTime = 0;
      await a.play();
      a.pause();
      a.currentTime = 0;
      a.volume = originalVol;

      setUnlocked(true);
    } catch {
      setUnlocked(false);
    }
  }

  // detect new sentUpAt
  useEffect(() => {
    if (!soundsEnabled || !unlocked) return;

    let newest = lastSeenSentUpRef.current;

    for (const e of entries) {
      const t = toMs(e?.[sentUpField]);
      if (t > newest) newest = t;
    }

    if (newest > lastSeenSentUpRef.current) {
      lastSeenSentUpRef.current = newest;
      play();
    }
  }, [entries, soundsEnabled, unlocked, sentUpField]);

  if (!soundsEnabled) return null;

  if (!unlocked) {
    return (
      <div
        className="card spacer-sm"
        style={{
          position: "sticky",
          top: 10,
          zIndex: 50,
          marginBottom: 10,
        }}
      >
        <div className="estimate-row" style={{ alignItems: "center" }}>
          <div>
            <strong>Sounds are enabled</strong>
            <span className="sep">•</span>
            <span className="muted">
              Tap once to allow jingles on this iPad.
            </span>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button className="button button-primary" onClick={enableSounds}>
              Enable sounds
            </button>
          </div>
        </div>
        <p className="muted helper" style={{ marginTop: 8 }}>
          If you don’t hear anything, check mute switch / volume.
        </p>
      </div>
    );
  }

  return null;
}
