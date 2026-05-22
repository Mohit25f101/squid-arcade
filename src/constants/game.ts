/**
 * src/constants/game.ts
 *
 * Single source of truth for every magic number in the Red Light / Green Light
 * game.  All values are sourced from the final RedLightGreenLight.tsx
 * implementation.  Nothing in the game files should contain a bare numeric
 * literal — import from here instead.
 *
 * Sections
 * ─────────
 *  1. Design Resolution
 *  2. World Layout
 *  3. Player Physics
 *  4. Movement Detection (fairness-critical)
 *  5. Sprint / Acceleration
 *  6. NPC Configuration
 *  7. Doll Configuration
 *  8. Light Phase Timing
 *  9. Difficulty Scaling
 * 10. Game Loop / Engine
 * 11. HUD & UI
 * 12. Colours (C palette — single canonical definition)
 * 13. Storage Keys
 */

// ─── 1. Design Resolution ────────────────────────────────────────────────────

/** Logical canvas width in design pixels. */
export const DW = 1280;

/** Logical canvas height in design pixels. */
export const DH = 720;

// ─── 2. World Layout ─────────────────────────────────────────────────────────

/**
 * Y coordinate of the ground surface in canvas (design) pixels.
 * Players and NPCs stand on this line; everything below is the floor fill.
 * Must be < DH.  Approx 78 % of DH, leaving room for a visible ground strip.
 */
export const GROUND_Y = Math.round(DH * 0.78); // ≈ 562 px

/**
 * World-space X where the player spawns / resets.
 * Kept far enough from the left edge for a comfortable first move.
 */
export const PLAYER_START_X = 160;

/**
 * World-space X of the finish line.
 * Exceeds DW so the camera must scroll — creates the "just one more step" feel.
 */
export const FINISH_LINE_X = 1400;

/**
 * World-space X of the doll (the judge).
 * Placed ahead of the player but short of the finish so the doll is always
 * visible as a looming threat.
 */
export const DOLL_WORLD_X = 980;

// ─── 3. Player Physics ────────────────────────────────────────────────────────

/** Player hitbox width in design pixels. */
export const PLAYER_W = 28;

/** Player hitbox height in design pixels. */
export const PLAYER_H = 44;

/** Downward acceleration applied every frame (design px / s²). */
export const GRAVITY = 880;

/** Vertical velocity applied at jump initiation (design px / s, negative = up). */
export const JUMP_FORCE = 1100;

/**
 * Maximum horizontal speed the player can reach on flat ground (design px / s).
 * Difficulty multiplier is applied on top of this in-engine.
 */
export const MAX_SPEED_BASE = 320;

/**
 * FAIRNESS-CRITICAL — movement detection threshold.
 *
 * A player is only considered "moving" during Red Light if:
 *   Math.abs(player.vx) > SAFE_VELOCITY_THRESHOLD
 *
 * WHY NOT zero?
 *   Floating-point friction never produces an exact 0.  Checking vx !== 0
 *   would cause false eliminations every frame the player is decelerating,
 *   breaking player trust.  This threshold gives a small but clear dead-zone
 *   that covers all friction-induced residual velocity.
 *
 * Tuning notes:
 *   • Too high → player can shuffle slightly during red light unpunished.
 *   • Too low  → floating-point residue triggers false deaths.
 *   • 18 px/s was validated as the sweet spot for GRAVITY=880 / ACCEL=380.
 */
export const SAFE_VELOCITY_THRESHOLD = 18; // design px / s

// ─── 4. Sprint / Acceleration ─────────────────────────────────────────────────

/**
 * Horizontal acceleration rate while an input is held (design px / s²).
 * Higher values make the character feel "snappy"; lower values feel floaty.
 */
export const ACCEL = 380;

/** Speed multiplier when the sprint input (Shift) is held. */
export const SPRINT_MULTIPLIER = 1.55;

/**
 * Friction coefficient applied when no horizontal input is held.
 * Applied as:  vx *= (1 - FRICTION_DAMPING)  per fixed-timestep tick.
 * Lower = icier / slower stop; higher = snappier stop.
 */
export const FRICTION_DAMPING = 0.32;

// ─── 5. NPC Configuration ────────────────────────────────────────────────────

/** Total number of characters on screen including the human player (index 0). */
export const MAX_PLAYERS = 14;

/**
 * Vertical lane offset between adjacent NPCs in design pixels.
 * Applied as: laneY = GROUND_Y - lane * NPC_LANE_SPREAD
 * Small value creates a tight crowd; larger spreads them into rows.
 */
export const NPC_LANE_SPREAD = 7; // design px per lane

/**
 * NPC speed is randomised per character in the range:
 *   BASE_MOVE_SPEED * [NPC_SPEED_MIN_FACTOR, NPC_SPEED_MAX_FACTOR]
 */
export const NPC_SPEED_MIN_FACTOR = 0.68;
export const NPC_SPEED_MAX_FACTOR = 1.22;

/**
 * NPC panic threshold — fraction of Red-Light-duration remaining at which
 * an NPC "panics" and may make a movement mistake (used by NPC AI).
 */
export const NPC_PANIC_THRESHOLD = 0.22;

// ─── 6. Doll Configuration ───────────────────────────────────────────────────

/** Rendered size of the doll sprite (square bounding box) in design pixels. */
export const DOLL_SIZE = 78;

// ─── 7. Light Phase Timing ────────────────────────────────────────────────────

/**
 * Base duration of the Green Light phase in seconds (before difficulty scaling).
 * Actual duration = GREEN_DURATION_BASE / difficulty
 */
export const GREEN_DURATION_BASE = 3.8; // seconds

/**
 * Base duration of the Red Light phase in seconds (before difficulty scaling).
 * Actual duration = RED_DURATION_BASE / (difficulty * 0.8)
 * The 0.8 divisor keeps red lights slightly longer than green lights
 * to maintain fairness without sacrificing tension.
 */
export const RED_DURATION_BASE = 2.2; // seconds

/**
 * Duration of the doll's head-turn animation in seconds.
 *
 * WHY this matters for fairness:
 *   The turn animation is the player's only visual warning that Red Light
 *   is imminent.  This window defines how much reaction time they have.
 *   Too short = cheap deaths.  Too long = trivially avoidable.
 *   0.42 s gives ~5-6 frames of anticipation at 60 fps.
 */
export const TURN_ANIM_DURATION = 0.42; // seconds

/**
 * Duration of the pre-Red-Light "Warning" phase in seconds.
 * During this phase the doll is mid-rotation and the light blinks amber.
 * Overlaps with TURN_ANIM_DURATION intentionally.
 */
export const WARNING_DUR = 0.55; // seconds

/**
 * Grace period in milliseconds granted at the exact moment the light
 * transitions to Red.
 *
 * WHY this exists:
 *   Input latency, browser frame pacing, and touch event batching mean a
 *   player who released input at the last possible moment may still have
 *   non-zero velocity in the first Red frame — through no fault of their own.
 *   The grace period suppresses movement checks for this window, eliminating
 *   the "I wasn't moving!" false-death experience.
 *
 *   260 ms ≈ 15–16 frames at 60 fps — enough to absorb one browser event
 *   cycle and a full FRICTION_DAMPING deceleration pass, while still being
 *   imperceptible to the player as "free movement time".
 */
export const GRACE_PERIOD_MS = 260; // milliseconds

// ─── 8. Difficulty Scaling ───────────────────────────────────────────────────

/**
 * Difficulty multipliers keyed by Difficulty string (from useGameStore).
 *
 *  GREEN phase duration  ÷  difficultyMultiplier  → shorter greens = harder
 *  RED phase duration    ÷ (difficultyMultiplier × 0.8)
 *  Player speed          ×  difficultyMultiplier
 */
export const DIFFICULTY_MULTIPLIERS: Record<"easy" | "normal" | "hard", number> = {
  easy: 0.7,
  normal: 1.0,
  hard: 1.45,
};

// ─── 9. Game Loop / Engine ────────────────────────────────────────────────────

/** Target frame rate for the rAF loop. */
export const TARGET_FPS = 60;

/**
 * Maximum allowed delta time per tick in seconds.
 * Clamps runaway deltas (tab blur, debugger pause) so physics doesn't explode.
 * At 60 fps, one normal frame = 0.0167 s.  0.05 s = 3 dropped frames max.
 */
export const MAX_DELTA = 0.05; // seconds

/** Minimum delta guard to prevent division-by-zero in timing code. */
export const MIN_DELTA = 0.0001; // seconds

// ─── 10. HUD & UI ─────────────────────────────────────────────────────────────

/**
 * How frequently the HUD React state is flushed from the game loop (ms).
 * ~10 fps — enough for readable numbers without causing React re-render
 * pressure on the main thread during gameplay.
 */
export const HUD_FLUSH_INTERVAL_MS = 100; // ms  (≈ 10 fps)

/** Maximum number of life icons shown inline before a "+N" overflow badge. */
export const HUD_MAX_LIFE_ICONS = 5;

// ─── 11. Colours ─────────────────────────────────────────────────────────────

/**
 * Canonical colour palette.  One place to update if the design changes.
 *
 * Used by:
 *  • renderFrame (canvas drawing)
 *  • React overlay components (inline styles)
 *  • HUD component
 *
 * Import as:  import { C } from "@/constants/game";
 */
export const C = {
  // Backgrounds
  bg0:        "#050810",
  bg1:        "#0b1220",

  // Ground
  ground:     "#111827",
  groundTop:  "#1e293b",
  groundGrid: "#1a2440",
  groundLine: "rgba(255,255,255,0.06)",

  // Semantic
  accent:  "#00f5c4",
  danger:  "#ff3d5a",
  warn:    "#f97316",
  green:   "#22c55e",
  red:     "#ef4444",
  muted:   "rgba(255,255,255,0.32)",
  white:   "#ffffff",

  // Player / NPC
  playerFill:   "#38bdf8",
  playerStroke: "#7dd3fc",
  playerSkin:   "#fde68a",
  npcFill:      "#a78bfa",
  npcStroke:    "#c4b5fd",
  npcSkin:      "#e9d5ff",

  // Doll
  dollPink:  "#f472b6",
  dollDress: "#be185d",
  dollHair:  "#1c1917",
  dollFace:  "#fde68a",
  dollBody:  "#fca5a5",

  // FX
  finish:    "#fbbf24",
  finishLine:"#fbbf24",
  blood:     "#dc2626",
  dust:      "rgba(200,210,230,0.6)",
  spark:     "#fef08a",
} as const;

export type GameColor = keyof typeof C;

// ─── 12. Storage Keys ────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  settings:  "rlgl_settings_v1",
  highScore: "rlgl_highscore_v1",
} as const;