"use client";

import { useEffect, useRef, useState } from "react";
import { loadSettings } from "@/app/lib/ropesStore";

const STORAGE_KEY = "rt_sounds_unlocked";

/**
 * Plays a jingle on /top when Bottom sends a group up.
 * Detects "new sentUpAt" values in entries and plays once.
 */
export default function TopSoundController({
  entries = [],
  sentUpField = "sentUpAt",
}) {
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const audioRef = useRef(null);
  const lastSeenSentUpRef = useRef(0);
  const unlockedRef = useRef(false);

  // Wait for mount to avoid hydration mismatch (localStorage not available on server)
  useEffect(() => {
    setMounted(true);
  }, []);

  const soundsEnabled = mounted ? (loadSettings()?.soundsEnabled ?? true) : true;

  // Create audio once
  useEffect(() => {
    audioRef.current = new Audio("/sounds/send-up.mp3");
    audioRef.current.preload = "auto";
  }, []);

  // On mount, if previously unlocked, auto-unlock on first user gesture
  useEffect(() => {
    if (!mounted || !soundsEnabled) return;

    const wasUnlocked = localStorage.getItem(STORAGE_KEY) === "1";
    if (!wasUnlocked) return;

    const trySilentUnlock = async () => {
      if (unlockedRef.current) return;
      const a = audioRef.current;
      if (!a) return;
      try {
        const originalVol = a.volume;
        a.volume = 0.001;
        a.currentTime = 0;
        await a.play();
        a.pause();
        a.currentTime = 0;
        a.volume = originalVol;
        unlockedRef.current = true;
        setUnlocked(true);
        cleanup();
      } catch {
        // blocked — wait for user gesture
      }
    };

    const onGesture = () => trySilentUnlock();

    const cleanup = () => {
      document.removeEventListener("click", onGesture, true);
      document.removeEventListener("touchstart", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
    };

    document.addEventListener("click", onGesture, true);
    document.addEventListener("touchstart", onGesture, true);
    document.addEventListener("keydown", onGesture, true);

    // Try immediately (works on soft navigation, may fail on hard refresh)
    trySilentUnlock();

    return cleanup;
  }, [mounted, soundsEnabled]);

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

      localStorage.setItem(STORAGE_KEY, "1");
      unlockedRef.current = true;
      setUnlocked(true);
    } catch {
      setUnlocked(false);
    }
  }

  // Detect new sentUpAt
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

  // Don't render anything until mounted (avoids hydration mismatch)
  if (!mounted) return null;
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
          If you don't hear anything, check mute switch / volume.
        </p>
      </div>
    );
  }

  return null;
}
