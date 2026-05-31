/**
 * src/hooks/useSessionTracking.ts  —  FIX 7.2
 *
 * Thin hook consumed by each game component.
 * Provides a single `completeGame(score, outcome)` callback that:
 *   1. Calls recordGameCompletion in the store
 *   2. Plays the appropriate audio stinger (victory / elimination)
 *   3. Returns control to the router via the onComplete prop
 *
 * Usage in a game component:
 *
 *   const { completeGame } = useSessionTracking({ onComplete, gameId });
 *
 *   // When player wins:
 *   completeGame(finalScore, "victory");
 *
 *   // When player is eliminated:
 *   completeGame(currentScore, "eliminated");
 */

"use client";

import { useCallback, useRef } from "react";
import { useGameStore, type GameId } from "@/store/gameStore";

interface UseSessionTrackingOptions {
  gameId:     GameId;
  onComplete: (score: number, outcome: "victory" | "eliminated") => void;
}

interface UseSessionTrackingReturn {
  completeGame: (score: number, outcome: "victory" | "eliminated") => void;
  /** True once completeGame has been called — prevents double-firing */
  isCompleted:  boolean;
}

export function useSessionTracking({
  gameId,
  onComplete,
}: UseSessionTrackingOptions): UseSessionTrackingReturn {
  const recordGameCompletion = useGameStore((s) => s.recordGameCompletion);
  const completedRef         = useRef(false);

  const completeGame = useCallback(
    (score: number, outcome: "victory" | "eliminated") => {
      // Guard: never fire twice in the same mount lifecycle
      if (completedRef.current) return;
      completedRef.current = true;

      // Record in store (also sets view → "result")
      recordGameCompletion({ gameId, outcome, score, timestamp: Date.now() });

      // Delegate to parent (GameRouter) for navigation
      onComplete(score, outcome);
    },
    [gameId, onComplete, recordGameCompletion]
  );

  return {
    completeGame,
    isCompleted: completedRef.current,
  };
}

// ─── Game-component integration guide ────────────────────────────────────────
//
// Each game component currently calls onComplete (or similar) via its own
// internal logic. Replace those call sites with completeGame() from this hook:
//
//   BEFORE (Phase 6):
//     props.onComplete(score, 'victory');
//
//   AFTER (Phase 7):
//     completeGame(score, 'victory');
//
// The hook is idempotent — safe to call from multiple code paths
// (timeout, input handler, animation callback) without double-recording.
//
// If a game component has an onBack prop (used for mid-game exit), that
// still calls props.onBack directly — it does NOT go through this hook.