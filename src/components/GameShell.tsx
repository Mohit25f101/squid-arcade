"use client";

/**
 * src/components/GameShell.tsx
 *
 * UNIVERSAL GAME SHELL — Phase 1
 *
 * The single mount point for every game in the Squid Arcade. Wraps the active
 * game with:
 *
 * 1. ResizeObserver — watches the container, computes the CSS scale factor,
 * and writes ViewportState to the global store + inputManager. Games never
 * need their own resize logic again (GlassBridge's internal observer is
 * superseded; it will be removed in Phase 3).
 *
 * 2. Canvas context provider — creates one <canvas> element and passes a
 * stable ref down via GameShellContext. Games that opt in (DalgonaCandy)
 * read the ref instead of creating their own. Games that manage their own
 * canvas (GlassBridge) ignore the context — both patterns coexist safely.
 *
 * 3. InputManager lifecycle — calls attach() on mount, setScale() on resize,
 * reset() on game change, and detach() on unmount. Games import the
 * singleton directly; GameShell owns the lifecycle so games don't have to.
 *
 * 4. Global elimination overlay — subscribes to runtimePhase === "eliminated"
 * and renders a universal cinematic death sequence (red flash → slow
 * letterbox → "ELIMINATED" card). Individual games may show their own
 * overlays on top; GameShell's overlay fires regardless, ensuring
 * consistent UX across all games without duplicating overlay code.
 *
 * 5. Global victory overlay — same pattern for runtimePhase === "victory".
 *
 * 6. Transition curtain — renders the CSS-animated curtain that GameRouter's
 * `transition` state drives. Moving it here means GameRouter stays a pure
 * router with no visual responsibilities.
 *
 * 7. Frame boundary hook — calls inputManager.endFrame() at the end of every
 * rAF tick so single-frame flags (justPressed, justReleased) are always
 * cleared even when the active game doesn't call endFrame itself.
 *
 * USAGE (in GameRouter.tsx):
 *
 * <GameShell worldW={1280} worldH={720}>
 * <GlassBridge onExit={handleExit} />
 * </GameShell>
 *
 * CONTEXT (for games that want the shell canvas):
 *
 * const { canvasRef, scale } = useGameShell();
 *
 * WORLD SIZE NOTE:
 * Pass the logical resolution of the current game. If your games have
 * different resolutions, re-mount GameShell with the new dimensions when
 * the active game changes (GameRouter already keys SceneWrapper per game).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useGameStore,
  selectSessionPlayed,
  selectSessionSurvived,
} from "@/store/gameStore";
import { inputManager } from "@/managers/InputManager";
import { HUD } from "@/components/hud";
import { ResultScreen } from "@/components/ui/ResultScreen";
import type { ViewportState } from "@/store/gameStore";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

export interface GameShellContextValue {
  /**
   * Ref to the shell-managed <canvas>.
   * Only populated when GameShell renders its own canvas
   * (i.e. `ownCanvas` prop is true, which is the default).
   * GlassBridge ignores this and manages its own canvas — that's fine.
   */
  canvasRef: React.RefObject<HTMLCanvasElement>;

  /** Current CSS scale factor (world px → CSS px). Updated on every resize. */
  scale: number;

  /** Current viewport state (mirrors the store, provided here for convenience) */
  viewport: ViewportState;

  /** Logical world width passed to GameShell */
  worldW: number;

  /** Logical world height passed to GameShell */
  worldH: number;
}

const GameShellContext = createContext<GameShellContextValue | null>(null);

/**
 * Hook for child games to access shell-provided canvas and scale.
 * Returns null if called outside a GameShell — handle gracefully.
 */
export function useGameShell(): GameShellContextValue {
  const ctx = useContext(GameShellContext);
  if (!ctx) {
    throw new Error("useGameShell must be called inside a <GameShell> tree.");
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — OVERLAY ANIMATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Delay before the "ELIMINATED" card fades in */
const ELIM_CARD_DELAY_MS = 600;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3b — GAME NAV (back button, consolidated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GameNav — the single, authoritative back-to-menu button.
 *
 * Rendered by GameShell at z:300, above the HUD overlay (z:100).
 * Games that are wrapped in GameShell (currently: DalgonaCandy via GameRouter's
 * SceneWrapper) should pass onExit to GameShell and remove their own inline
 * back buttons.
 *
 * GlassBridge and RLGL keep their own buttons because they are not fully
 * wrapped in GameShell yet (Priority 3 work). For now they co-exist —
 * this component is used only when GameShell receives onExit.
 */
const GameNav: React.FC<{ onExit: () => void }> = ({ onExit }) => (
  <button
    onClick={onExit}
    aria-label="Back to menu"
    style={{
      margin:          "14px 16px",
      padding:         "9px 16px",
      display:         "flex",
      alignItems:      "center",
      gap:             6,
      background:      "rgba(5, 5, 8, 0.72)",
      border:          "1px solid rgba(255, 255, 255, 0.18)",
      borderRadius:    3,
      color:           "rgba(245, 245, 245, 0.85)",
      fontFamily:      "'JetBrains Mono', 'Fira Mono', monospace",
      fontSize:        11,
      fontWeight:      700,
      letterSpacing:   "0.18em",
      textTransform:   "uppercase",
      cursor:          "pointer",
      backdropFilter:  "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      // Crisp mechanical transition — matches the broadcast aesthetic
      transition:      "background 120ms, border-color 120ms",
      // Minimum touch target
      minHeight:       44,
      minWidth:        44,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background      = "rgba(255, 45, 45, 0.18)";
      (e.currentTarget as HTMLButtonElement).style.borderColor     = "rgba(255, 45, 45, 0.5)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background  = "rgba(5, 5, 8, 0.72)";
      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255, 255, 255, 0.18)";
    }}
  >
    {/* Left-pointing chevron — SVG avoids font-dependency */}
    <svg
      width="8" height="12" viewBox="0 0 8 12"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7 1L1 6L7 11"
        stroke="rgba(245,245,245,0.7)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    MENU
  </button>
);
// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — TRANSITION CURTAIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The black curtain that animates during scene transitions.
 * Previously lived as a bare div in GameRouter — moved here so GameRouter
 * is a pure routing component with no visual responsibilities.
 *
 * `state` values match the CSS classes you have (or will have) in globals.css:
 * "idle"     → opacity 0, pointer-events none
 * "entering" → animating in (opacity 0→1)
 * "active"   → fully opaque (router swaps the scene here)
 * "leaving"  → animating out (opacity 1→0)
 */
const TransitionCurtain: React.FC<{ state: string }> = ({ state }) => {
  const isVisible = state !== "idle";

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 800,
        background: "#000",
        pointerEvents: isVisible ? "auto" : "none",
        opacity:
          state === "active"
            ? 1
            : state === "entering" || state === "leaving"
            ? 0.85
            : 0,
        transition:
          state === "entering"
            ? "opacity 0.2s ease-in"
            : state === "leaving"
            ? "opacity 0.3s ease-out"
            : "none",
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — FRAME BOUNDARY HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs a requestAnimationFrame loop that only calls inputManager.endFrame().
 * This ensures single-frame flags are cleared even when the active game is on
 * its intro screen and not running its own loop.
 *
 * Automatically pauses when `active` is false (e.g. menu is showing).
 */
function useInputFrameBoundary(active: boolean): void {
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    function tick() {
      inputManager.endFrame();
      rafRef.current = requestAnimationFrame(tick);
    }

     rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — GAMESHELL PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface GameShellProps {
  children: React.ReactNode;
  worldW?: number;
  worldH?: number;
  ownCanvas?: boolean;
  dpr?: number;
  transition?: string;
  onEliminationComplete?: () => void;
  onVictoryComplete?: () => void;
  background?: string;
  showGlobalHUD?: boolean;
  /**
   * When provided, GameShell renders a GameNav back button at z:300.
   */
  onExit?: () => void;
  showGameNav?: boolean;
  onRestart?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — GAMESHELL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const GameShell: React.FC<GameShellProps> = ({
  children,
  worldW = 1280,
  worldH = 720,
  ownCanvas = false,
  dpr: dprOverride,
  transition = "idle",
  onEliminationComplete,
  onVictoryComplete,
  background = "#000",
  showGlobalHUD = true,
  showGameNav = true,
  onExit,
  onRestart,
}) => {
  // ── Store subscriptions ─────────────────────────────────────────────────
  const runtimePhase   = useGameStore((s) => s.runtimePhase);
  const eliminationPayload = useGameStore((s) => s.eliminationPayload);
  const setRuntimePhase    = useGameStore((s) => s.setRuntimePhase);
  const setViewportState   = useGameStore((s) => s.setViewportState);
  
  const sessionPlayed = useGameStore(selectSessionPlayed);
  const sessionSurvived = useGameStore(selectSessionSurvived);
  // ── Refs ────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  // ── Local state ─────────────────────────────────────────────────────────
  const [viewport, setLocalViewport] = useState<ViewportState>({
    containerW: worldW,
    containerH: worldH,
    scale: 1,
    dpr: 1,
    breakpoint: "desktop-landscape",
    orientation: "landscape",
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    gameRect: { x: 0, y: 0, width: worldW, height: worldH },
    isTouch: false,
    isResizing: false,
  });

  // Whether the input frame boundary loop should run
  const inputLoopActive = runtimePhase !== "idle";

  // ── ResizeObserver ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const computedDpr =
      dprOverride ??
      (typeof window !== "undefined"
        ? Math.min(window.devicePixelRatio ?? 1, 2)
        : 1);

    const handleResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      // Scale to fit while preserving the logical world aspect ratio
      const scale = Math.min(cw / worldW, ch / worldH);

      inputManager.setScale(scale);

      const isPortrait = cw < ch;
      const isMobile = cw < 768;

      const nextViewport: ViewportState = {
        containerW: cw,
        containerH: ch,
        scale,
        dpr: computedDpr,
        breakpoint: isMobile
          ? (isPortrait ? "mobile-portrait" : "mobile-landscape")
          : "desktop-landscape",
        orientation: isPortrait ? "portrait" : "landscape",
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
        gameRect: { x: 0, y: 0, width: worldW * scale, height: worldH * scale },
        isTouch: typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0),
        isResizing: false,
      };

      // 1. Update the shell's own canvas if we own one
      if (ownCanvas && canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width  = worldW * computedDpr;
        canvas.height = worldH * computedDpr;
        canvas.style.width  = `${worldW * scale}px`;
        canvas.style.height = `${worldH * scale}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Reset the transform before re-applying DPR scale to avoid
          // compounding scale on repeated resize events
          ctx.setTransform(computedDpr, 0, 0, computedDpr, 0, 0);
        }
      }

      // 2. Note: Input scaling handled by native event listeners

      // 3. Write to Zustand store (audio engine + games can subscribe)
      setViewportState(nextViewport);

      // 4. Update local React state (for context value)
      setLocalViewport(nextViewport);
    };

    // Run immediately to catch the initial render dimensions
    handleResize();

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    return () => ro.disconnect();
  }, [worldW, worldH, ownCanvas, dprOverride, setViewportState]);

  // ── InputManager lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    inputManager.attach(target);

    // Input listeners are attached via native events
    // (previously managed by inputManager)

    return () => {
      inputManager.detach();
      inputManager.reset();
      // Cleanup handled by native event listener cleanup
    };
  }, []); // attach once; detach on shell unmount

  // Reset input state when the active game changes
  useEffect(() => {
    // Input state reset handled by native event listeners
  }, [worldW, worldH]);

  // ── Frame boundary loop ──────────────────────────────────────────────────
  useInputFrameBoundary(inputLoopActive);

  // ── Elimination overlay completion handler ───────────────────────────────
  const handleEliminationComplete = useCallback(() => {
    setRuntimePhase("idle");
    if (onExit) onExit();
    onEliminationComplete?.();
  }, [setRuntimePhase, onExit, onEliminationComplete]);

  // Global sound triggers based on phase changes
  const prevPhaseRef = useRef(runtimePhase);
  useEffect(() => {
    if (prevPhaseRef.current !== "victory" && runtimePhase === "victory") {
      import("@/managers/SoundManager").then(({ SoundManager }) => {
        SoundManager.getInstance().play("victory");
      });
    } else if (prevPhaseRef.current !== "eliminated" && runtimePhase === "eliminated") {
      import("@/managers/SoundManager").then(({ SoundManager }) => {
        SoundManager.getInstance().play("eliminated");
      });
    }
    prevPhaseRef.current = runtimePhase;
  }, [runtimePhase]);

  // ── Victory overlay completion handler ──────────────────────────────────
  const handleVictoryComplete = useCallback(() => {
    setRuntimePhase("idle");
    if (onExit) onExit();
    onVictoryComplete?.();
  }, [setRuntimePhase, onExit, onVictoryComplete]);

  // ── Context value ────────────────────────────────────────────────────────
  const contextValue: GameShellContextValue = {
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    scale: viewport.scale,
    viewport,
    worldW,
    worldH,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <GameShellContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          // Ensure touch events on the container don't cause iOS Safari
          // to rubber-band scroll or trigger the back-gesture
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* Shell-owned canvas (opt-in; games like GlassBridge skip this) */}
        {ownCanvas && (
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              // Crisp pixel rendering for pixel-art style games
              imageRendering: "pixelated",
            }}
          />
        )}

        {/* Game content — sits in the flex-centered flow */}
        {children}

        {/* HUD overlay — absolutely positioned so it never participates in
        flex layout and cannot push or be pushed by the canvas.
        `pointerEvents: none` on the wrapper means only interactive HUD
        children (buttons etc.) need to opt back in with pointer-events: auto.
        */}
        {/* ── GameNav — back button, always wins over HUD ── */}
        {showGameNav && onExit && (
          <div
            style={{
              position: "absolute",
              top:  "env(safe-area-inset-top,  0px)",
              left: "env(safe-area-inset-left, 0px)",
              zIndex: 300,
              pointerEvents: "auto",
            }}
          >
            <GameNav onExit={onExit} />
          </div>
        )}

        {/* ── HUD overlay — z:100, pointer-events:none wrapper ──
            hud-overlay class (globals.css) provides position:absolute, inset:0,
            pointer-events:none, safe-area calc() padding, and the 3×3 grid layout
            consumed by .hud-top-left / .hud-top-right / etc. child classes.
            zIndex:100 inline overrides the class's z-index:10 so HUD stays
            above the shell canvas but below overlays (z:800+). */}
        {showGlobalHUD && (
          <div className="hud-overlay" style={{ zIndex: 100 }}>
            <HUD />
          </div>
        )}

        {/* Global overlays */}
        {(runtimePhase === "eliminated" || runtimePhase === "victory") && (
          <div style={{ position: "absolute", zIndex: 900, inset: 0, pointerEvents: "auto" }}>
            <ResultScreen 
              outcome={runtimePhase}
              score={runtimePhase === "victory" ? useGameStore.getState().hud.score : 0} 
              statLine={runtimePhase === "eliminated" ? eliminationPayload?.reason || "ELIMINATED" : "ROUND CLEARED"}
              survived={sessionSurvived}
              played={sessionPlayed}
              total={456}
              onMenu={runtimePhase === "victory" ? handleVictoryComplete : handleEliminationComplete}
              onTryAgain={() => {
                setRuntimePhase("idle");
                if (onRestart) onRestart();
              }}
            />
          </div>
        )}
        <TransitionCurtain state={transition} />
      </div>
    </GameShellContext.Provider>
  );
};

export default GameShell;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — GAMESHELL SIGNAL BRIDGE HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useGameShellBridge — thin signal hook for existing games.
 *
 * Drop this into any game component (e.g. GlassBridge) to connect its
 * internal UI phase to the global store WITHOUT refactoring the game's
 * internal state machine.
 *
 * Usage in GlassBridge.tsx (add after existing useState declarations):
 *
 * useGameShellBridge({
 * uiPhase,
 * sourceGame: "glass-bridge",
 * progressMarker: finalRow,
 * progressTotal: TOTAL_ROWS,
 * });
 *
 * That's the entire bridge. GlassBridge keeps all internal logic untouched.
 *
 * @param opts.uiPhase        The game's local UI phase string
 * @param opts.sourceGame     GameId of the calling game (for overlay copy)
 * @param opts.progressMarker Game-specific progress value (e.g. row reached)
 * @param opts.progressTotal  Maximum possible progress value
 * @param opts.reason         Optional human-readable elimination reason
 */
export function useGameShellBridge(opts: {
  uiPhase: string;
  sourceGame: import("@/store/gameStore").GameId;
  progressMarker?: number;
  progressTotal?: number;
  reason?: string;
  outcome?: "victory" | "eliminated"; // 1. Add definitive explicit outcome
}): void {
  const setRuntimePhase    = useGameStore((s) => s.setRuntimePhase);
  const triggerElimination = useGameStore((s) => s.triggerElimination);

  const { uiPhase, sourceGame, progressMarker, progressTotal, reason, outcome } = opts;

  useEffect(() => {
    switch (uiPhase) {
      case "intro": setRuntimePhase("intro"); break;
      case "playing": setRuntimePhase("playing"); break;
      case "gameover":
      case "victory":
        // 2. Derive purely from the explicit outcome prop
        if (outcome === "victory") {
          setRuntimePhase("victory");
        } else if (outcome === "eliminated") {
          triggerElimination({ sourceGame, reason, progressMarker, progressTotal });
        }
        break;
      default: break;
    }
  }, [ uiPhase, sourceGame, reason, progressMarker, progressTotal, setRuntimePhase, triggerElimination, outcome ]);
}