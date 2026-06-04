"use client";
// src/hooks/useBackgroundMusic.ts
/**
 * useBackgroundMusic — React hook that wires MusicManager to the game store.
 *
 * ROOT CAUSE ADDRESSED
 * ─────────────────────
 * Previously, no hook existed to control backsong.mp3 across navigation.
 * The SoundManager's "menu_bg" Howl had no lifecycle contract tied to
 * currentView changes.  Audio persisted or was silently abandoned on every
 * scene transition because clearActiveGame() only updated Zustand state —
 * it had no audio side-effect whatsoever.
 *
 * This hook owns the entire background-music lifecycle for the application.
 * Mount it ONCE at the top of GameRouter and never again.
 */

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { musicManager } from "@/managers/MusicManager";

// Views where the background track should be audible.
const MUSIC_VIEWS = new Set<string>([
  "menu",
  "briefing",
  "result",
  "session-end",
  "leaderboard",
]);

export function useBackgroundMusic(): void {
  const currentView = useGameStore((s) => s.currentView);

  // ── React to view changes ─────────────────────────────────────────────────
  useEffect(() => {
    // SSR Guard
    if (typeof window === "undefined") return;

    if (MUSIC_VIEWS.has(currentView)) {
      // Fade in the menu track smoothly over 300ms
      musicManager.play("menu", 300);
    } else {
      // Entering a game: fade out smoothly over 300ms then securely stop
      musicManager.stop(300);
    }
  }, [currentView]);
}