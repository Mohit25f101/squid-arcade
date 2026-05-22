/**
 * useOptimizedGameLoop.ts
 *
 * Production-grade rAF loop with:
 * - Fixed timestep (deterministic physics regardless of frame rate)
 * - Delta clamping (prevents "spiral of death" on slow devices)
 * - Frame-budget enforcement (skip render if update took too long)
 * - Visibility-based pause (saves battery when tab is hidden)
 * - Slow-motion support via a timeScale factor
 * - Performance.now() for monotonic, high-res timing
 *
 * WHY fixed timestep:
 * Variable delta physics produces different outcomes on 30fps vs 60fps devices.
 * Fixed timestep (here: 1/60s) separates simulation frequency from render
 * frequency. Accumulator-based stepping ensures physics runs exactly the
 * right number of times per render frame.
 *
 * Frame budget:
 *   Update:  ≤4ms  (physics, AI, input)
 *   Render:  ≤12ms (canvas draw)
 *   Total:   ≤16ms (60fps)
 *
 * On mobile, these budgets are tighter (~8ms/frame on 120hz ProMotion).
 * If update overshoots, we skip the render for that frame and catch up
 * next frame rather than compounding debt.
 */

import { useRef, useEffect, useCallback } from "react";

const FIXED_DT    = 1 / 60;      // 16.67ms physics step
const MAX_DELTA   = 0.1;         // clamp to 100ms max (6 dropped frames)
const MAX_STEPS   = 5;           // max physics steps per render frame (spiral guard)
const RENDER_BUDGET_MS = 14;     // if we're over this, skip non-critical render

export interface GameLoopCallbacks {
  /**
   * Fixed-timestep update. Called 1-MAX_STEPS times per rAF frame.
   * dt is always exactly FIXED_DT seconds (= 1/60).
   * timeScale: 1 = normal, 0.25 = slow-mo, 2 = fast-forward
   */
  update: (dt: number, timeScale: number) => void;
  /**
   * Render. Called once per rAF frame.
   * alpha: interpolation factor between last two physics states (0-1).
   * Use for sub-frame interpolation of smooth positions.
   */
  render: (alpha: number) => void;
  /**
   * Optional: called when tab becomes hidden/visible.
   */
  onVisibilityChange?: (visible: boolean) => void;
}

interface GameLoopOptions {
  /** Initial time scale. 1 = normal, 0.25 = slow-mo */
  initialTimeScale?: number;
  /** Whether to automatically pause when tab is hidden */
  pauseOnHidden?: boolean;
}

interface GameLoopControls {
  /** Change time scale mid-game (e.g. slow-mo on elimination) */
  setTimeScale: (scale: number) => void;
  /** Manually pause/resume */
  setPaused: (paused: boolean) => void;
  /** Diagnostics: current measured FPS */
  getFPS: () => number;
}

export function useOptimizedGameLoop(
  callbacks: GameLoopCallbacks,
  options: GameLoopOptions = {}
): GameLoopControls {
  const { initialTimeScale = 1, pauseOnHidden = true } = options;

  const rafHandle    = useRef<number>(0);
  const lastTime     = useRef<number>(-1);
  const accumulator  = useRef<number>(0);
  const timeScaleRef = useRef<number>(initialTimeScale);
  const pausedRef    = useRef<boolean>(false);
  const fpsRef       = useRef<number>(60);

  // FPS rolling average (last 30 frames)
  const fpsSamples   = useRef<number[]>([]);

  // Stable refs so the loop closure doesn't go stale
  const updateRef = useRef(callbacks.update);
  const renderRef = useRef(callbacks.render);
  const visibilityRef = useRef(callbacks.onVisibilityChange);
  useEffect(() => { updateRef.current = callbacks.update; });
  useEffect(() => { renderRef.current = callbacks.render; });
  useEffect(() => { visibilityRef.current = callbacks.onVisibilityChange; });

  const loop = useCallback((timestamp: number) => {
    rafHandle.current = requestAnimationFrame(loop);

    if (pausedRef.current) {
      lastTime.current = -1; // reset so we don't get a huge delta on resume
      return;
    }

    // First frame init
    if (lastTime.current < 0) {
      lastTime.current = timestamp;
      return;
    }

    // ── Delta clamping ────────────────────────────────────────────────────────
    const rawDelta = (timestamp - lastTime.current) / 1000;
    lastTime.current = timestamp;
    const clampedDelta = Math.min(rawDelta, MAX_DELTA);

    // FPS measurement
    const rawFPS = 1 / rawDelta;
    fpsSamples.current.push(rawFPS);
    if (fpsSamples.current.length > 30) fpsSamples.current.shift();
    fpsRef.current =
      fpsSamples.current.reduce((a, b) => a + b, 0) / fpsSamples.current.length;

    // ── Fixed-timestep accumulator ────────────────────────────────────────────
    const scaledDelta = clampedDelta * timeScaleRef.current;
    accumulator.current += scaledDelta;

    const frameStart = performance.now();
    let steps = 0;

    while (accumulator.current >= FIXED_DT && steps < MAX_STEPS) {
      updateRef.current(FIXED_DT, timeScaleRef.current);
      accumulator.current -= FIXED_DT;
      steps++;
    }

    const updateTime = performance.now() - frameStart;

    // ── Render ────────────────────────────────────────────────────────────────
    // alpha = how far we are between the last two physics ticks.
    // Smooth positions can interpolate using this for buttery movement.
    const alpha = accumulator.current / FIXED_DT;

    // Skip render if update already consumed most of our budget
    if (updateTime < RENDER_BUDGET_MS) {
      renderRef.current(alpha);
    }
    // On budget overrun, we still ran physics — just skipped a paint frame.
    // This is preferable to both: (a) blocking, (b) skipping physics.

  }, []);

  useEffect(() => {
    rafHandle.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafHandle.current);
  }, [loop]);

  // ── Visibility API pause ──────────────────────────────────────────────────
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      pausedRef.current = hidden;
      visibilityRef.current?.(!hidden);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [pauseOnHidden]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const setTimeScale = useCallback((scale: number) => {
    timeScaleRef.current = Math.max(0, scale);
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    if (!paused) lastTime.current = -1; // reset timing on resume
  }, []);

  const getFPS = useCallback(() => fpsRef.current, []);

  return { setTimeScale, setPaused, getFPS };
}