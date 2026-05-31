// src/hooks/useMenuAudio.ts
//
// FIX 3.1 — Migrate menu audio from raw Howl instances to SoundManager.
//
// Previously this hook created its own Howl objects for the BG track and five
// SFX sounds, bypassing SoundManager entirely. That meant:
//   - Menu BG volume was computed with a hand-rolled formula that drifted from
//     the store's master/music settings after a single-digit rounding error.
//   - The unlock gate was a separate code path — mute/unmute from the settings
//     panel had no effect on menu audio until the next page load.
//   - Two parallel audio systems could both call Howl.play() concurrently,
//     causing double-trigger artefacts at game launch.
//
// Now: all audio is routed through the SoundManager singleton.
//   - menu_bg maps to the new "menu_bg" SoundId (registered in SoundManager).
//   - SFX names map to existing SoundIds:
//       hover      → ui_hover
//       click      → ui_click
//       open       → riser_micro
//       transition → riser_standard
//       exit       → player_eliminated
// Volume, mute, and unlock are now fully controlled by SoundManager.

"use client";

import { useCallback } from "react";
import { SoundManager } from "@/managers/SoundManager";

type SoundName = "hover" | "click" | "open" | "transition" | "exit";

interface MenuAudioController {
  play:    (name: SoundName) => void;
  startBg: () => void;
  stopBg:  () => void;
}

// Map friendly menu names to canonical SoundManager IDs
const MENU_SFX_MAP: Record<SoundName, Parameters<SoundManager["play"]>[0]> = {
  hover:      "ui_hover",
  click:      "ui_click",
  open:       "riser_micro",
  transition: "riser_standard",
  exit:       "player_eliminated",
};

export function useMenuAudio(): MenuAudioController {
  // Use the singleton directly — useSoundManager() is for hook-lifecycle
  // management (volume sync, unlock events). Here we just need fire-and-forget
  // calls that don't need React re-render tracking.
  const sm = SoundManager.getInstance();

  const play = useCallback((name: SoundName) => {
    const id = MENU_SFX_MAP[name];
    const cooldown = name === "hover" ? 60 : name === "click" ? 80 : 0;
    sm.play(id, cooldown);
  }, [sm]);

  const startBg = useCallback(() => {
    // loop() is idempotent — safe to call if already playing
    sm.loop("menu_bg");
  }, [sm]);

  const stopBg = useCallback(() => {
    sm.stopLoop("menu_bg", 800);
  }, [sm]);

  return { play, startBg, stopBg };
}
