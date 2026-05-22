/**
 * SECTIONS 6 & 7 — PLATFORM DETECTION + FULLSCREEN UTILITIES
 * src/hooks/usePlatformDetection.ts
 *
 * Detects device type, orientation, pixel density, and available inputs.
 * Populates the game store so all components can branch on platform.
 *
 * Detection heuristics:
 *   - "mobile"  = pointer: coarse AND max-width ≤ 767px
 *   - "tablet"  = pointer: coarse AND max-width ≤ 1199px  OR  iPad UA
 *   - "desktop" = pointer: fine (mouse) OR max-width > 1199px
 */

"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

export function usePlatformDetection() {
  const setPlatform = useGameStore((s) => s.setPlatform);
  const setOrientation = useGameStore((s) => s.setOrientation);

  useEffect(() => {
    function detect() {
      const hasTouch = window.matchMedia("(pointer: coarse)").matches;
      const isNarrow = window.innerWidth <= 767;
      const isMedium = window.innerWidth <= 1199;

      if (hasTouch && isNarrow) setPlatform("mobile");
      else if (hasTouch && isMedium) setPlatform("tablet");
      else setPlatform("desktop");

      setOrientation(
        window.innerWidth > window.innerHeight ? "landscape" : "portrait"
      );
    }

    detect();

    const ro = new ResizeObserver(detect);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [setPlatform, setOrientation]);
}

// ── Fullscreen API utility ─────────────────────────────────────────────────

/**
 * Request fullscreen on the game root element.
 * Handles vendor prefixes and iOS (which doesn't support requestFullscreen
 * on arbitrary elements — fallback handled gracefully).
 */
export async function requestFullscreen(
  el: HTMLElement = document.documentElement
): Promise<void> {
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: "hide" });
    } else if ((el as any).webkitRequestFullscreen) {
      await (el as any).webkitRequestFullscreen();
    }
  } catch {
    // Fullscreen rejected (iOS Safari, some embedded contexts) — no-op
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    }
  } catch {}
}

export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement
  );
}

// ── Orientation lock ──────────────────────────────────────────────────────

/**
 * Lock screen orientation to landscape on mobile.
 * Screen Orientation API is supported on Android Chrome; iOS ignores it.
 * Best practice: show a "rotate your device" overlay as a fallback.
 */
export async function lockLandscape(): Promise<void> {
  try {
    if ((screen.orientation as any)?.lock) {
      await (screen.orientation as any).lock("landscape");
    }
  } catch {
    // Not supported (iOS, Firefox) — show portrait warning overlay instead
  }
}

// ── Canvas scaling hook ────────────────────────────────────────────────────

/**
 * Sizes a canvas to its container using ResizeObserver, accounting for
 * devicePixelRatio for crisp rendering on retina screens.
 *
 * Usage:
 *   const { canvasRef, containerRef } = useCanvasScaling();
 *   <div ref={containerRef}><canvas ref={canvasRef} /></div>
 */
import { useRef, useCallback } from "react";

export function useCanvasScaling(
  onResize?: (w: number, h: number) => void
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2× for perf

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;

      // Set CSS size (display size)
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Set buffer size (actual pixels)
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      // Scale context so (0,0)→(width,height) in logical coordinates
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);

      onResize?.(width, height);
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [onResize]);

  return { canvasRef, containerRef };
}
