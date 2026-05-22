/**
 * SECTION 4 — REALISTIC SPEED & TIME METER CALIBRATION
 * src/lib/gamePhysics.ts
 *
 * Frame-rate independent physics for all meters.
 * Every value is calculated using delta-time (dt) so the game feels
 * identical at 30fps, 60fps, and 120fps.
 *
 * DESIGN TARGETS:
 *   Red Light Green Light:
 *     - Player reaches top speed in ~2.5 seconds of holding the key
 *     - Deceleration takes ~1.5 seconds (momentum, not instant stop)
 *     - Time meter counts down from 60s at realistic pacing
 *
 *   Glass Bridge:
 *     - No speed meter; a "nerve" meter fills as player hesitates
 *     - 0 → 100% in 8 seconds of standing still (pressure mechanic)
 *     - Drops back 30% instantly on each step
 *     - Shake effect triggers at 80%
 */

// ── Constants ─────────────────────────────────────────────────────────────

/** Red Light Green Light physics */
export const RLGL_PHYSICS = {
  MAX_SPEED: 380,        // px/sec at internal 1280px canvas width
  ACCEL:     180,        // px/sec² acceleration (positive)
  DECEL:     260,        // px/sec² deceleration (when key released)
  BRAKE:     480,        // px/sec² when explicitly braking
  MIN_SPEED: 0,
  MAX_SPEED_DISPLAY: 100, // display units (0-100)
} as const;

/** Glass Bridge nerve meter */
export const NERVE_PHYSICS = {
  FILL_RATE:  12.5,   // % per second while standing still (0→100 in 8s)
  DROP_ON_STEP: 30,   // % instant drop on each step taken
  SHAKE_THRESHOLD: 80, // % where screen shake starts
  DANGER_THRESHOLD: 95,
  MIN: 0,
  MAX: 100,
} as const;

/** General time constants */
export const TIME_CONFIG = {
  RLGL_TOTAL_SEC: 60,     // total match time
  RLGL_DANGER_SEC: 10,    // danger zone threshold
  GLASS_TOTAL_SEC: 45,
  GLASS_DANGER_SEC: 8,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────

export interface PhysicsState {
  // Velocity in px/sec (internal units)
  velocity: number;
  // Displayed speed (0-100)
  displaySpeed: number;
  // Position along the track (0-1 normalized)
  progress: number;
  // Time remaining in seconds
  timeRemaining: number;
  // Whether player is in motion
  isMoving: boolean;
}

export interface GlassBridgePhysicsState {
  nerveLevel: number;  // 0-100
  shaking: boolean;
  danger: boolean;
}

// ── Red Light Green Light physics tick ────────────────────────────────────

/**
 * Call every frame from your RAF loop.
 * @param state    Current physics state (mutated in place for performance)
 * @param input    Current input state
 * @param dt       Delta time in seconds (cap at 0.05 to prevent spiral of death)
 * @param isRed    Whether it's currently red light (no moving allowed)
 * @returns        The updated state
 */
export function tickRLGLPhysics(
  state: PhysicsState,
  input: { moveForward: boolean; brake: boolean },
  dt: number,
  isRed: boolean
): PhysicsState {
  // Cap dt to prevent physics explosion on tab focus restore
  const safeDt = Math.min(dt, 0.05);

  const { MAX_SPEED, ACCEL, DECEL, BRAKE } = RLGL_PHYSICS;

  let newVelocity = state.velocity;

  if (isRed) {
    // Red light: instant deceleration (caught moving = instant death in game logic)
    // In forgiving mode, decelerate quickly instead
    newVelocity = approach(newVelocity, 0, BRAKE * safeDt);
  } else if (input.moveForward) {
    newVelocity = approach(newVelocity, MAX_SPEED, ACCEL * safeDt);
  } else {
    // Key released: realistic momentum decay
    const decelRate = input.brake ? BRAKE : DECEL;
    newVelocity = approach(newVelocity, 0, decelRate * safeDt);
  }

  // Clamp velocity
  newVelocity = Math.max(0, Math.min(MAX_SPEED, newVelocity));

  // Update position
  const newProgress = Math.min(1, state.progress + (newVelocity * safeDt) / 1280);

  // Display speed: smooth interpolation to displayed value
  // This prevents the needle from snapping and gives a satisfying lag
  const targetDisplay = (newVelocity / MAX_SPEED) * 100;
  const newDisplaySpeed = lerp(state.displaySpeed, targetDisplay, 1 - Math.pow(0.02, safeDt));

  // Time: count down at real-time rate
  const newTime = Math.max(0, state.timeRemaining - safeDt);

  return {
    velocity: newVelocity,
    displaySpeed: newDisplaySpeed,
    progress: newProgress,
    timeRemaining: newTime,
    isMoving: newVelocity > 5,
  };
}

// ── Glass Bridge nerve tick ────────────────────────────────────────────────

export function tickNerve(
  current: GlassBridgePhysicsState,
  dt: number,
  playerSteppedThisFrame: boolean
): GlassBridgePhysicsState {
  const safeDt = Math.min(dt, 0.05);
  const { FILL_RATE, DROP_ON_STEP, SHAKE_THRESHOLD, DANGER_THRESHOLD, MAX } =
    NERVE_PHYSICS;

  let nerve = current.nerveLevel;

  if (playerSteppedThisFrame) {
    nerve = Math.max(0, nerve - DROP_ON_STEP);
  } else {
    nerve = Math.min(MAX, nerve + FILL_RATE * safeDt);
  }

  return {
    nerveLevel: nerve,
    shaking: nerve >= SHAKE_THRESHOLD,
    danger: nerve >= DANGER_THRESHOLD,
  };
}

// ── Easing utilities ──────────────────────────────────────────────────────

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Move value towards target by at most `step` per call */
export function approach(current: number, target: number, step: number): number {
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

/** Exponential ease-out (for UI meter smoothing) */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Clamp a value between min and max */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Countdown timer (Glass Bridge) ────────────────────────────────────────

/**
 * Tick a countdown timer. Returns the new value and whether
 * the most recent second boundary was crossed (for tick SFX).
 */
export function tickCountdown(
  seconds: number,
  dt: number
): { value: number; crossedSecond: boolean } {
  const prev = Math.ceil(seconds);
  const next = Math.max(0, seconds - Math.min(dt, 0.05));
  return {
    value: next,
    crossedSecond: prev !== Math.ceil(next) && next > 0,
  };
}

// ── Speed-to-display formatter ─────────────────────────────────────────────

/** Format a speed value for the HUD. Returns e.g. "087" (zero-padded) */
export function formatSpeed(displaySpeed: number): string {
  return Math.round(displaySpeed).toString().padStart(3, "0");
}

/** Format a time remaining value as "0:59" */
export function formatTime(seconds: number): string {
  const s = Math.ceil(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

// ── Screen shake ──────────────────────────────────────────────────────────

export interface ShakeState {
  x: number;
  y: number;
  intensity: number;
}

/**
 * Generate a screen shake offset based on nerve level or impact force.
 * Apply this as a CSS transform to the game canvas wrapper.
 */
export function getShakeOffset(intensity: number): ShakeState {
  if (intensity <= 0) return { x: 0, y: 0, intensity: 0 };
  const mag = intensity * 6; // max 6px shake at 100% intensity
  return {
    x: (Math.random() - 0.5) * mag,
    y: (Math.random() - 0.5) * mag,
    intensity,
  };
}
