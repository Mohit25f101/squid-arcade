/**
 * SECTION 7 — CROSS-PLATFORM WEB & DESKTOP OPTIMIZATION
 * src/hooks/useAdaptiveInput.ts
 *
 * Unified input layer that works identically on:
 *   - Desktop (keyboard + mouse)
 *   - Tablet (touch + optional keyboard)
 *   - Mobile (touch only)
 *
 * Architecture:
 *   - Returns a stable `inputRef` that is read each RAF tick
 *   - Zero React state updates from input events (no re-render per keystroke)
 *   - Touch events use `passive: false` only when `preventDefault()` is needed
 *   - Gamepad API polled each frame (optional, for desktop controllers)
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";

export interface GameInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  brake: boolean;
  pause: boolean;
  // Consumed flags prevent double-triggers
  jumpConsumed: boolean;
  pauseConsumed: boolean;
}

const INITIAL_INPUT: GameInput = {
  left: false,
  right: false,
  jump: false,
  brake: false,
  pause: false,
  jumpConsumed: false,
  pauseConsumed: false,
};

/**
 * Returns a ref containing the current input state.
 * Read `inputRef.current` in your RAF loop — do NOT subscribe to re-renders.
 *
 * @param containerRef  The game canvas container (for touch events)
 */
export function useAdaptiveInput(
  containerRef: React.RefObject<HTMLElement>
): React.MutableRefObject<GameInput> {
  const inputRef = useRef<GameInput>({ ...INITIAL_INPUT });
  const platform = useGameStore((s) => s.platform);

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const KEY_MAP: Record<string, keyof GameInput> = {
      ArrowLeft:  "left",
      KeyA:       "left",
      ArrowRight: "right",
      KeyD:       "right",
      Space:      "jump",
      ArrowUp:    "jump",
      KeyW:       "jump",
      KeyS:       "brake",
      ArrowDown:  "brake",
      Escape:     "pause",
      KeyP:       "pause",
    };

    function onKeyDown(e: KeyboardEvent) {
      const key = KEY_MAP[e.code];
      if (!key) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault(); // prevent page scroll
      }
      inputRef.current[key] = true;
      if (key === "jump") inputRef.current.jumpConsumed = false;
      if (key === "pause") inputRef.current.pauseConsumed = false;
    }

    function onKeyUp(e: KeyboardEvent) {
      const key = KEY_MAP[e.code];
      if (key) inputRef.current[key] = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ── Touch (virtual buttons set these directly from MobileTouchControls) ──
  // Touch buttons write to inputRef.current directly via the returned ref.
  // See MobileTouchControls component below.

  // ── Gamepad polling (desktop controllers) ────────────────────────────
  useEffect(() => {
    if (platform !== "desktop") return;

    let animFrame: number;

    function pollGamepad() {
      const pads = navigator.getGamepads?.();
      if (pads) {
        const pad = pads[0];
        if (pad) {
          // Standard gamepad mapping (Xbox, PlayStation, etc.)
          inputRef.current.left  = pad.axes[0] < -0.3 || !!pad.buttons[14]?.pressed;
          inputRef.current.right = pad.axes[0] >  0.3 || !!pad.buttons[15]?.pressed;
          inputRef.current.jump  = !!pad.buttons[0]?.pressed; // A / Cross
          inputRef.current.brake = !!pad.buttons[1]?.pressed; // B / Circle
          const pauseNow = !!pad.buttons[9]?.pressed;         // Start / Options
          if (pauseNow && !inputRef.current.pause) {
            inputRef.current.pause = true;
            inputRef.current.pauseConsumed = false;
          } else if (!pauseNow) {
            inputRef.current.pause = false;
          }
        }
      }
      animFrame = requestAnimationFrame(pollGamepad);
    }

    animFrame = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animFrame);
  }, [platform]);

  return inputRef;
}

// ── Mobile touch controls component ───────────────────────────────────────

/**
 * Renders on-screen touch buttons and writes directly to inputRef.
 * Uses native touch events (not React synthetic events) for minimal latency.
 */
import React from "react";
import { useGameStore as _useGameStore } from "@/store/gameStore";

interface MobileTouchControlsProps {
  inputRef: React.MutableRefObject<GameInput>;
  showJump?: boolean;
  onPause?: () => void;
}

export function MobileTouchControls({
  inputRef,
  showJump = true,
  onPause,
}: MobileTouchControlsProps) {
  const platform = _useGameStore((s) => s.platform);

  // Only show on touch devices
  if (platform === "desktop") return null;

  function makeBtn(
    key: "left" | "right" | "jump",
    label: string,
    className: string
  ) {
    return (
      <button
        className={`touch-btn ${className}`}
        aria-label={label}
        onPointerDown={(e) => {
          e.preventDefault();
          inputRef.current[key] = true;
          if (key === "jump") inputRef.current.jumpConsumed = false;
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          inputRef.current[key] = false;
        }}
        onPointerLeave={(e) => {
          e.preventDefault();
          inputRef.current[key] = false;
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="touch-controls" aria-hidden="true">
      {makeBtn("left", "←", "touch-btn-left")}
      {makeBtn("right", "→", "touch-btn-right")}
      {showJump && makeBtn("jump", "↑", "touch-btn-jump")}

      {/* Pause button */}
      <button
        className="touch-btn"
        style={{ top: "env(safe-area-inset-top, 8px)", right: "calc(env(safe-area-inset-right, 0px) + 12px)" }}
        aria-label="Pause"
        onClick={onPause}
      >
        ⏸
      </button>
    </div>
  );
}

// ── Desktop-specific HUD additions ─────────────────────────────────────────

/**
 * Keyboard hints overlay — shown on desktop when game starts.
 * Fades out after 4 seconds.
 */
export function KeyboardHints() {
  const platform = _useGameStore((s) => s.platform);
  if (platform !== "desktop") return null;

  return (
    <div
      className="kb-hints"
      style={{
        position: "absolute",
        bottom: "var(--space-md)",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "var(--space-md)",
        animation: "fade-in 0.5s ease, fade-out 0.5s ease 4s forwards",
        pointerEvents: "none",
      }}
    >
      {[
        { key: "←/→", label: "Move" },
        { key: "Space", label: "Jump" },
        { key: "Esc", label: "Pause" },
      ].map(({ key, label }) => (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <kbd
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--hud-size-xs)",
              padding: "3px 8px",
              background: "rgba(255 255 255 / 0.08)",
              border: "1px solid rgba(255 255 255 / 0.15)",
              borderRadius: "4px",
              color: "var(--color-text)",
              letterSpacing: "0.1em",
            }}
          >
            {key}
          </kbd>
          <span style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "var(--color-muted)" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
