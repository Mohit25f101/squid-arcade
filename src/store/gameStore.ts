/**
 * src/store/gameStore.ts
 *
 * THE CANONICAL GAME STORE — Phase 1 Consolidation
 *
 * Migration notes:
 * - Replaces the broken `useGameStore.ts` (wrong path) and the missing
 * `store/gameStore.ts` that GameRouter was trying to import.
 * - All original actions/selectors are preserved verbatim.
 * - NEW (additive only, never breaking):
 * · GameId union type + activeGame / setActiveGame
 * · RuntimePhase union type + runtimePhase / setRuntimePhase
 * · Elimination pipeline: triggerElimination / clearElimination / eliminationPayload
 * · Viewport state: viewportState / setViewportState (written by GameShell)
 *
 * Import path (add to tsconfig paths if not already present):
 * "@/store/gameStore" → "src/store/gameStore.ts"
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — UNION TYPES (all exported for use across the codebase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every routable destination in the arcade.
 * Add new games here as the arcade grows.
 */
export type GameId = "red-light-green-light" | "dalgona" | "glass-breaker" | "glass-bridge" | "menu";

/**
 * The global runtime phase observable by ALL systems (audio engine, shell
 * overlays, analytics, etc.).  Individual games may maintain their own
 * internal phase machines, but must signal this store when reaching a
 * terminal state (see GlassBridge signal bridge for the pattern).
 *
 * idle         — app has loaded, no game is active
 * intro        — a game is mounted and showing its intro screen
 * countdown    — a pre-round countdown is running
 * playing      — live gameplay, input accepted
 * paused       — game is suspended (overlay visible)
 * eliminated   — player has died; elimination pipeline is active
 * victory      — player has won; victory pipeline is active
 * transitioning — router is animating between scenes
 */
export type RuntimePhase =
  | "idle"
  | "intro"
  | "countdown"
  | "playing"
  | "paused"
  | "eliminated"
  | "victory"
  | "transitioning";

/**
 * Original GamePhase — preserved for any existing code that imports it.
 * New code should prefer RuntimePhase.
 */
export type GamePhase =
  | "idle"
  | "menu"
  | "loading"
  | "playing"
  | "paused"
  | "gameover"
  | "victory"
  | "transition";

export type Difficulty = "easy" | "normal" | "hard";
export type Platform = "mobile" | "tablet" | "desktop";
export type Orientation = "portrait" | "landscape";

export type Breakpoint =
  | "desktop-landscape"
  | "tablet-landscape"
  | "tablet-portrait"
  | "mobile-landscape"
  | "mobile-portrait";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — PAYLOAD & SUB-STATE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface GameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Written by GameShell's ResizeObserver.
 * Consumed by any component that needs to know the true canvas dimensions
 * without drilling props (e.g. DalgonaCandy, input overlays).
 */
export interface ViewportState {
  containerW: number;
  containerH: number;
  scale: number;
  dpr: number;
  breakpoint: Breakpoint;
  orientation: Orientation;
  safeArea: SafeAreaInsets;
  gameRect: GameRect;
  isTouch: boolean;
  isResizing: boolean;
}

/**
 * Payload attached to every elimination event.
 * Games populate this when calling triggerElimination().
 * GameShell reads it to render the correct death overlay.
 */
export interface EliminationPayload {
  /** Which game triggered the elimination */
  sourceGame: GameId;
  /** Human-readable reason (shown in dev overlays, sent to analytics) */
  reason?: string;
  /** Game-specific progress marker (e.g. bridge row, RLGL distance) */
  progressMarker?: number;
  /** Total possible progress (used to compute a percentage) */
  progressTotal?: number;
  /** Timestamp (performance.now()) when elimination was triggered */
  triggeredAt: number;
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  difficulty: Difficulty;
  showFPS: boolean;
  screenShake: boolean;
  particlesEnabled: boolean;
  fullscreen: boolean;
}

export interface HUDState {
  score: number;
  highScore: number;
  lives: number;
  health: number;
  maxHealth: number;
  level: number;
  combo: number;
  maxCombo: number;
  coins: number;
  time: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — FULL STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface GameStoreState {
  platform: Platform;
  orientation: Orientation;
  setPlatform: (platform: Platform) => void;
  setOrientation: (orientation: Orientation) => void;
  
  // ── Routing ────────────────────────────────────────────────────────────────
  /** Which game (or menu) is currently mounted by GameRouter. */
  activeGame: GameId;
  setActiveGame: (id: GameId) => void;

  // ── Runtime Phase ──────────────────────────────────────────────────────────
  /**
   * The globally observable lifecycle phase.
   * Audio engine subscribes to this for music transitions.
   * GameShell subscribes for overlay rendering.
   */
  runtimePhase: RuntimePhase;
  setRuntimePhase: (phase: RuntimePhase) => void;

  // ── Elimination Pipeline ───────────────────────────────────────────────────
  /**
   * Non-null whenever runtimePhase === "eliminated".
   * Cleared by clearElimination() when the death sequence finishes.
   */
  eliminationPayload: EliminationPayload | null;

  /**
   * Call from any game when the player dies.
   * Atomically: sets runtimePhase → "eliminated" + stores payload.
   * GameShell will react and display the universal death overlay.
   */
  triggerElimination: (payload: Omit<EliminationPayload, "triggeredAt">) => void;

  /**
   * Call after the death overlay animation completes (e.g. fade-out done).
   * Resets eliminationPayload and returns runtimePhase → "idle" so
   * the router can transition to game-over or menu.
   */
  clearElimination: () => void;

  // ── Viewport (written by GameShell) ───────────────────────────────────────
  viewportState: ViewportState;
  setViewportState: (v: ViewportState) => void;

  // ── Legacy Phase (preserved for backward compat) ───────────────────────────
  phase: GamePhase;
  previousPhase: GamePhase;

  // ── Settings ───────────────────────────────────────────────────────────────
  settings: GameSettings;

  // ── HUD ────────────────────────────────────────────────────────────────────
  hud: HUDState;

  // ── Session ────────────────────────────────────────────────────────────────
  sessionStartTime: number | null;
  totalPlayTime: number;
  isPaused: boolean;
  isTransitioning: boolean;
  transitionTarget: GamePhase | null;

  // ── Actions — Legacy Phase ─────────────────────────────────────────────────
  setPhase: (phase: GamePhase) => void;
  transitionTo: (phase: GamePhase) => void;
  finishTransition: () => void;

  // ── Actions — Settings ────────────────────────────────────────────────────
  updateSettings: (patch: Partial<GameSettings>) => void;
  resetSettings: () => void;

  // ── Actions — HUD ────────────────────────────────────────────────────────
  setHUD: (patch: Partial<HUDState>) => void;
  resetHUD: () => void;
  addScore: (points: number) => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  loseLife: () => void;
  addCoins: (amount: number) => void;
  setHealth: (hp: number) => void;
  tickTime: (delta: number) => void;

  // ── Actions — Session ─────────────────────────────────────────────────────
  startSession: () => void;
  endSession: () => void;
  pauseGame: () => void;
  resumeGame: () => void;

  // ── Actions — Persistence ─────────────────────────────────────────────────
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.6,
  difficulty: "normal",
  showFPS: false,
  screenShake: true,
  particlesEnabled: true,
  fullscreen: false,
};

const DEFAULT_HUD: HUDState = {
  score: 0,
  highScore: 0,
  lives: 3,
  health: 100,
  maxHealth: 100,
  level: 1,
  combo: 0,
  maxCombo: 0,
  coins: 0,
  time: 0,
};

const DEFAULT_VIEWPORT: ViewportState = {
  containerW: 1280,
  containerH: 720,
  scale: 1,
  dpr: 1,
  breakpoint: "desktop-landscape",
  orientation: "landscape",
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  gameRect: { x: 0, y: 0, width: 1280, height: 720 },
  isTouch: false,
  isResizing: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versioned keys — bump the suffix when the shape changes to auto-invalidate
 * old cached data without a manual localStorage.clear().
 */
const STORAGE_KEY = "nexgame_settings_v2";
const HIGHSCORE_KEY = "nexgame_highscore_v2";

function safeLocalGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or private browsing — fail silently
  }
}

function safeLocalRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

function loadSettings(): Partial<GameSettings> {
  const raw = safeLocalGet(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<GameSettings>;
  } catch {
    return {};
  }
}

function loadHighScore(): number {
  const raw = safeLocalGet(HIGHSCORE_KEY);
  if (!raw) return 0;
  return parseInt(raw, 10) || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStoreState>()(
  subscribeWithSelector((set, get) => ({
    platform: "desktop",
    orientation: "landscape",
    setPlatform: (platform) => set({ platform }),
    setOrientation: (orientation) => set({ orientation }),

    // ── Routing ──────────────────────────────────────────────────────────────

    activeGame: "menu",

    setActiveGame: (id) =>
      set((state) => {
        // When navigating away from a game, reset runtime phase to idle
        // so audio engine and overlays don't hold stale state.
        const leavingGame = state.activeGame !== "menu" && id === "menu";
        return {
          activeGame: id,
          runtimePhase: leavingGame ? "idle" : id === "menu" ? "idle" : "intro",
          // Clear any lingering elimination payload when routing
          eliminationPayload: null,
        };
      }),

    // ── Runtime Phase ─────────────────────────────────────────────────────────

    runtimePhase: "idle",

    setRuntimePhase: (phase) =>
      set({ runtimePhase: phase }),

    // ── Elimination Pipeline ──────────────────────────────────────────────────

    eliminationPayload: null,

    triggerElimination: (payload) =>
      set({
        runtimePhase: "eliminated",
        eliminationPayload: {
          ...payload,
          triggeredAt: performance.now(),
        },
      }),

    clearElimination: () =>
      set({
        runtimePhase: "idle",
        eliminationPayload: null,
      }),

    // ── Viewport ──────────────────────────────────────────────────────────────

    viewportState: { ...DEFAULT_VIEWPORT },

    setViewportState: (v) =>
      set({ viewportState: v }),

    // ── Legacy Phase ──────────────────────────────────────────────────────────

    phase: "menu",
    previousPhase: "menu",

    setPhase: (phase) =>
      set((state) => ({
        previousPhase: state.phase,
        phase,
        isPaused: phase === "paused",
      })),

    transitionTo: (phase) =>
      set({
        isTransitioning: true,
        transitionTarget: phase,
        phase: "transition",
        runtimePhase: "transitioning",
      }),

    finishTransition: () =>
      set((state) => ({
        isTransitioning: false,
        phase: state.transitionTarget ?? "menu",
        previousPhase: "transition",
        transitionTarget: null,
        runtimePhase: "idle",
      })),

    // ── Settings ──────────────────────────────────────────────────────────────

    settings: { ...DEFAULT_SETTINGS },

    updateSettings: (patch) =>
      set((state) => {
        const next = { ...state.settings, ...patch };
        safeLocalSet(STORAGE_KEY, JSON.stringify(next));
        return { settings: next };
      }),

    resetSettings: () =>
      set(() => {
        safeLocalRemove(STORAGE_KEY);
        return { settings: { ...DEFAULT_SETTINGS } };
      }),

    // ── HUD ───────────────────────────────────────────────────────────────────

    hud: { ...DEFAULT_HUD, highScore: 0 },

    setHUD: (patch) =>
      set((state) => ({ hud: { ...state.hud, ...patch } })),

    resetHUD: () =>
      set((state) => ({
        hud: { ...DEFAULT_HUD, highScore: state.hud.highScore },
      })),

    addScore: (points) =>
      set((state) => {
        const { difficulty } = state.settings;
        const multiplier =
          difficulty === "easy" ? 0.75 : difficulty === "hard" ? 1.5 : 1;
        const gained = Math.floor(
          points * multiplier * Math.max(1, state.hud.combo)
        );
        const score = state.hud.score + gained;
        const highScore = Math.max(score, state.hud.highScore);

        if (highScore > state.hud.highScore) {
          safeLocalSet(HIGHSCORE_KEY, String(highScore));
        }

        return { hud: { ...state.hud, score, highScore } };
      }),

    incrementCombo: () =>
      set((state) => {
        const combo = state.hud.combo + 1;
        const maxCombo = Math.max(combo, state.hud.maxCombo);
        return { hud: { ...state.hud, combo, maxCombo } };
      }),

    resetCombo: () =>
      set((state) => ({ hud: { ...state.hud, combo: 0 } })),

    loseLife: () =>
      set((state) => ({
        hud: { ...state.hud, lives: Math.max(0, state.hud.lives - 1) },
      })),

    addCoins: (amount) =>
      set((state) => ({
        hud: { ...state.hud, coins: state.hud.coins + amount },
      })),

    setHealth: (hp) =>
      set((state) => ({
        hud: {
          ...state.hud,
          health: Math.max(0, Math.min(hp, state.hud.maxHealth)),
        },
      })),

    tickTime: (delta) =>
      set((state) => ({
        hud: { ...state.hud, time: state.hud.time + delta },
      })),

    // ── Session ───────────────────────────────────────────────────────────────

    sessionStartTime: null,
    totalPlayTime: 0,
    isPaused: false,
    isTransitioning: false,
    transitionTarget: null,

    startSession: () =>
      set((state) => {
        const highScore = loadHighScore();
        return {
          sessionStartTime: performance.now(),
          isPaused: false,
          phase: "playing",
          previousPhase: state.phase,
          runtimePhase: "playing",
          hud: { ...DEFAULT_HUD, highScore },
        };
      }),

    endSession: () =>
      set((state) => {
        const elapsed =
          state.sessionStartTime !== null
            ? (performance.now() - state.sessionStartTime) / 1000
            : 0;
        return {
          sessionStartTime: null,
          totalPlayTime: state.totalPlayTime + elapsed,
          isPaused: false,
        };
      }),

    pauseGame: () =>
      set((state) => {
        if (state.phase !== "playing") return {};
        return {
          isPaused: true,
          phase: "paused",
          previousPhase: "playing",
          runtimePhase: "paused",
        };
      }),

    resumeGame: () =>
      set((state) => {
        if (state.phase !== "paused") return {};
        return {
          isPaused: false,
          phase: "playing",
          previousPhase: "paused",
          runtimePhase: "playing",
        };
      }),

    // ── Persistence ───────────────────────────────────────────────────────────

    loadFromStorage: () =>
      set(() => {
        const saved = loadSettings();
        const highScore = loadHighScore();
        return {
          settings: { ...DEFAULT_SETTINGS, ...saved },
          hud: { ...DEFAULT_HUD, highScore },
        };
      }),

    saveToStorage: () => {
      const { settings, hud } = get();
      safeLocalSet(STORAGE_KEY, JSON.stringify(settings));
      safeLocalSet(HIGHSCORE_KEY, String(hud.highScore));
    },
  }))
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — TYPED SELECTORS
// All original selectors preserved. New ones added below.
// ─────────────────────────────────────────────────────────────────────────────

// ── Preserved (original) ──────────────────────────────────────────────────────
export const selectPhase = (s: GameStoreState) => s.phase;
export const selectHUD = (s: GameStoreState) => s.hud;
export const selectSettings = (s: GameStoreState) => s.settings;
export const selectIsPaused = (s: GameStoreState) => s.isPaused;
export const selectIsTransitioning = (s: GameStoreState) => s.isTransitioning;
export const selectDifficulty = (s: GameStoreState) => s.settings.difficulty;
export const selectVolumes = (s: GameStoreState) => ({
  master: s.settings.masterVolume,
  sfx: s.settings.sfxVolume,
  music: s.settings.musicVolume,
});

// ── New ───────────────────────────────────────────────────────────────────────

/** Current routed game — drives GameRouter's render switch */
export const selectActiveGame = (s: GameStoreState) => s.activeGame;

/** Global runtime phase — drives audio engine + shell overlays */
export const selectRuntimePhase = (s: GameStoreState) => s.runtimePhase;

/**
 * Elimination payload — non-null only while runtimePhase === "eliminated".
 * Use this in GameShell to render game-specific death copy.
 */
export const selectEliminationPayload = (s: GameStoreState) =>
  s.eliminationPayload;

/** True during the elimination pipeline — convenience boolean for overlays */
export const selectIsEliminated = (s: GameStoreState) =>
  s.runtimePhase === "eliminated";

/** True when the player has won — convenience boolean for overlays */
export const selectIsVictory = (s: GameStoreState) =>
  s.runtimePhase === "victory";

/** Viewport dimensions + scale — written by GameShell, read by games */
export const selectViewport = (s: GameStoreState) => s.viewportState;