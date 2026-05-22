"use client";

import { useRef, useEffect, useCallback } from "react";
import { useGameStore } from "../store/gameStore";
// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameLoopMetrics {
  fps: number;
  frameTime: number;   // ms for last frame
  deltaTime: number;   // seconds, clamped
  totalTime: number;   // seconds since loop started
  frameCount: number;
}

export interface GameLoopOptions {
  /** Target FPS cap — frames faster than this are skipped (default: 60) */
  targetFPS?: number;
  /** Maximum delta-time in seconds to prevent spiral of death (default: 0.05) */
  maxDelta?: number;
  /** Minimum delta-time in seconds to prevent zero-delta frames (default: 0.001) */
  minDelta?: number;
  /** Whether to pause the loop automatically when the tab is hidden */
  pauseOnHidden?: boolean;
  /** Whether to pause when the Zustand game phase is "paused" */
  respectGamePause?: boolean;
  /** FPS averaging window size (default: 60) */
  fpsWindowSize?: number;
}

export interface GameLoopCallbacks {
  /** Called every active frame — the main update/render callback */
  onTick: (delta: number, metrics: GameLoopMetrics) => void;
  /** Called when the loop starts or resumes */
  onStart?: () => void;
  /** Called when the loop is paused (tab hidden / game paused) */
  onPause?: () => void;
  /** Called when the loop resumes from pause */
  onResume?: () => void;
  /** Called when the loop is fully stopped (cleanup) */
  onStop?: () => void;
}

export interface GameLoopHandle {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  getMetrics: () => GameLoopMetrics;
  isRunning: () => boolean;
  isPaused: () => boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TARGET_FPS = 60;
const DEFAULT_MAX_DELTA = 0.05;      // 50ms  — prevents spiral of death
const DEFAULT_MIN_DELTA = 0.0001;    // 0.1ms — prevents zero division
const DEFAULT_FPS_WINDOW = 60;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameLoop(
  callbacks: GameLoopCallbacks,
  options: GameLoopOptions = {}
): GameLoopHandle {
  const {
    targetFPS = DEFAULT_TARGET_FPS,
    maxDelta = DEFAULT_MAX_DELTA,
    minDelta = DEFAULT_MIN_DELTA,
    pauseOnHidden = true,
    respectGamePause = true,
    fpsWindowSize = DEFAULT_FPS_WINDOW,
  } = options;

  // ── Store refs (never trigger re-renders) ──────────────────────────────────
  const rafIdRef        = useRef<number | null>(null);
  const isRunningRef    = useRef(false);
  const isPausedRef     = useRef(false);
  const lastTimeRef     = useRef<number>(0);
  const startTimeRef    = useRef<number>(0);
  const frameCountRef   = useRef<number>(0);
  const totalTimeRef    = useRef<number>(0);

  // Rolling FPS window
  const fpsWindowRef    = useRef<number[]>([]);
  const currentFPSRef   = useRef<number>(0);
  const frameTimeRef    = useRef<number>(0);
  const deltaRef        = useRef<number>(0);

  // Frame-cap interval (ms between frames)
  const frameIntervalRef = useRef<number>(1000 / targetFPS);

  // Keep callbacks in refs so the RAF closure never goes stale
  const onTickRef   = useRef(callbacks.onTick);
  const onStartRef  = useRef(callbacks.onStart);
  const onPauseRef  = useRef(callbacks.onPause);
  const onResumeRef = useRef(callbacks.onResume);
  const onStopRef   = useRef(callbacks.onStop);

  useEffect(() => { onTickRef.current  = callbacks.onTick;   }, [callbacks.onTick]);
  useEffect(() => { onStartRef.current = callbacks.onStart;  }, [callbacks.onStart]);
  useEffect(() => { onPauseRef.current = callbacks.onPause;  }, [callbacks.onPause]);
  useEffect(() => { onResumeRef.current= callbacks.onResume; }, [callbacks.onResume]);
  useEffect(() => { onStopRef.current  = callbacks.onStop;   }, [callbacks.onStop]);

  // Update frame interval when targetFPS changes
  useEffect(() => {
    frameIntervalRef.current = 1000 / targetFPS;
  }, [targetFPS]);

  // Subscribe to Zustand pause state without re-rendering
  const zustandPausedRef = useRef(false);
  useEffect(() => {
    if (!respectGamePause) return;
    const unsub = useGameStore.subscribe(
      (state) => state.isPaused,
      (isPaused) => {
        zustandPausedRef.current = isPaused;
      },
      { fireImmediately: true }
    );
    return unsub;
  }, [respectGamePause]);

  // ── FPS rolling average ───────────────────────────────────────────────────
  const updateFPS = useCallback(
    (frameTimeMs: number) => {
      const win = fpsWindowRef.current;
      win.push(frameTimeMs);
      if (win.length > fpsWindowSize) win.shift();
      const avgFrameTime = win.reduce((a, b) => a + b, 0) / win.length;
      currentFPSRef.current = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
    },
    [fpsWindowSize]
  );

  // ── Core RAF loop ─────────────────────────────────────────────────────────
  const loop = useCallback(
    (timestamp: number) => {
      if (!isRunningRef.current) return;

      // Re-schedule immediately to keep the RAF chain alive
      rafIdRef.current = requestAnimationFrame(loop);

      // Frame cap: skip if we're ahead of schedule
      const elapsed = timestamp - lastTimeRef.current;
      if (elapsed < frameIntervalRef.current - 0.5) return;

      // Snap lastTime to a multiple of the interval to prevent drift
      lastTimeRef.current =
        timestamp - (elapsed % frameIntervalRef.current);

      // Skip update if paused (but keep RAF alive for resume)
      if (isPausedRef.current || zustandPausedRef.current) return;

      // Delta-time calculation
      const rawDelta = elapsed / 1000;
      const delta = Math.max(minDelta, Math.min(maxDelta, rawDelta));

      deltaRef.current    = delta;
      frameTimeRef.current = elapsed;
      totalTimeRef.current += delta;
      frameCountRef.current += 1;

      updateFPS(elapsed);

      const metrics: GameLoopMetrics = {
        fps:        currentFPSRef.current,
        frameTime:  elapsed,
        deltaTime:  delta,
        totalTime:  totalTimeRef.current,
        frameCount: frameCountRef.current,
      };

      onTickRef.current(delta, metrics);
    },
    [maxDelta, minDelta, updateFPS]
  );

  // ── Public controls ───────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (isRunningRef.current) return;

    isRunningRef.current  = true;
    isPausedRef.current   = false;
    lastTimeRef.current   = performance.now();
    startTimeRef.current  = lastTimeRef.current;
    frameCountRef.current = 0;
    totalTimeRef.current  = 0;
    fpsWindowRef.current  = [];

    onStartRef.current?.();
    rafIdRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    if (!isRunningRef.current) return;

    isRunningRef.current = false;
    isPausedRef.current  = false;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    onStopRef.current?.();
  }, []);

  const pause = useCallback(() => {
    if (!isRunningRef.current || isPausedRef.current) return;
    isPausedRef.current = true;
    onPauseRef.current?.();
  }, []);

  const resume = useCallback(() => {
    if (!isRunningRef.current || !isPausedRef.current) return;
    isPausedRef.current = false;
    // Reset lastTime so first post-resume delta is not huge
    lastTimeRef.current = performance.now();
    onResumeRef.current?.();
  }, []);

  const getMetrics = useCallback(
    (): GameLoopMetrics => ({
      fps:        currentFPSRef.current,
      frameTime:  frameTimeRef.current,
      deltaTime:  deltaRef.current,
      totalTime:  totalTimeRef.current,
      frameCount: frameCountRef.current,
    }),
    []
  );

  const isRunning = useCallback(() => isRunningRef.current, []);
  const isPaused  = useCallback(() => isPausedRef.current,  []);

  // ── Page Visibility API ───────────────────────────────────────────────────
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isRunningRef.current && !isPausedRef.current) {
          pause();
        }
      } else {
        if (isRunningRef.current && isPausedRef.current) {
          resume();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pauseOnHidden, pause, resume]);

  // ── Window blur / focus ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleBlur  = () => {
      if (isRunningRef.current && !isPausedRef.current) pause();
    };
    const handleFocus = () => {
      if (isRunningRef.current && isPausedRef.current) resume();
    };

    window.addEventListener("blur",  handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur",  handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [pauseOnHidden, pause, resume]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (isRunningRef.current) stop();
    };
  }, [stop]);

  // ── Stable handle object ──────────────────────────────────────────────────
  const handleRef = useRef<GameLoopHandle>({
    start,
    stop,
    pause,
    resume,
    getMetrics,
    isRunning,
    isPaused,
  });

  // Keep handle functions fresh without creating a new object
  useEffect(() => {
    handleRef.current.start      = start;
    handleRef.current.stop       = stop;
    handleRef.current.pause      = pause;
    handleRef.current.resume     = resume;
    handleRef.current.getMetrics = getMetrics;
    handleRef.current.isRunning  = isRunning;
    handleRef.current.isPaused   = isPaused;
  }, [start, stop, pause, resume, getMetrics, isRunning, isPaused]);

  return handleRef.current;
}