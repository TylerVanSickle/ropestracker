"use client";

import { useEffect, useState } from "react";
import { loadSettings, subscribeToRopesStorage } from "@/app/lib/ropesStore";

export function useRopesSettings() {
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    return subscribeToRopesStorage(() => {
      setSettings(loadSettings());
    });
  }, []);

  return settings;
}
