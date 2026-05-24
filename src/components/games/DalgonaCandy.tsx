"use client";

/**
 * PHASE 3 — DALGONA CANDY CHALLENGE
 * src/components/games/DalgonaCandy.tsx
 *
 * Runtime contracts consumed from previous phases:
 *
 *   Phase 1 — GameShell / store / inputManager
 *     useGameShellBridge()  → signals runtimePhase + elimination to global store
 *     useGameShell()        → canvasRef, scale, viewport from GameShell's ResizeObserver
 *     inputManager          → UnifiedInput.stability drives fractureRisk each frame
 *
 *   Phase 2 — AudioEngine
 *     audioEngine.setGameState("green_light")     → on game start
 *     audioEngine.setTensionLevel(1-integrity)    → every frame, reactive to candy health
 *     audioEngine.playCandyScrape(intensity)      → on scrape motion
 *     audioEngine.playCandyMicrocrack(severity)   → on fracture threshold cross
 *     audioEngine.playCandySnap()                 → on totalIntegrity === 0
 *
 * CANDY INTEGRITY MODEL:
 *   totalIntegrity  (0–1)   overall candy health; 0 = eliminated
 *   edgeStress      (0–1)   stress concentrated at the shape perimeter
 *   fracturePoints  Point[] active crack nodes on the candy surface
 *
 *   Each scraping motion applies:
 *     Δstress = BASE_STRESS + (1 - stability) * INSTABILITY_MULTIPLIER
 *
 *   stability comes from inputManager.getInput().stability (Phase 1 rolling-variance metric).
 *   A rock-steady hand applies less stress; a shaking hand applies significantly more.
 *
 * SHAPES:
 *   Triangle | Circle | Star | Umbrella
 *   Each shape is defined as a closed SVG-style path projected onto the canvas.
 *   The player must carve the shape outline without breaking the candy.
 *
 * GAME PHASES:
 *   "intro"       → shape reveal + 3-2-1 countdown
 *   "playing"     → active carving, integrity model running
 *   "success"     → shape fully carved, integrity > 0
 *   "eliminated"  → integrity hit 0 (candy snapped)
 *   "transitioning" → fade handled by GameShell's TransitionCurtain
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useHUDSync } from "@/components/hud/useHUDSync";
import { useGameShellBridge, useGameShell } from "@/components/GameShell";

// ── Types ─────────────────────────────────────────────────────────────────────

type GamePhase = "intro" | "playing" | "success" | "eliminated" | "transitioning";

type ShapeId = "triangle" | "circle" | "star" | "umbrella";

interface Point {
  x: number; // canvas-space pixels
  y: number;
}

interface FracturePoint {
  pos: Point;
  radius: number;   // crack radius in px
  age: number;      // frames since creation — used to animate crack growth
  severity: number; // 0–1 how bad this fracture is
}

interface CandyState {
  totalIntegrity: number;   // 0–1, starts at 1.0
  edgeStress: number;       // 0–1, accumulates at shape boundary
  fracturePoints: FracturePoint[];
  completionRatio: number;  // 0–1 how much of the shape outline is carved
  shape: ShapeId;
}

interface ScrapeState {
  isActive: boolean;
  lastPos: Point | null;
  velocity: number;         // px/frame — used for intensity calculation
  lastScrapeTime: number;   // performance.now() — throttles audio calls
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WORLD_W = 390;   // design canvas width  (matches GameShell defaults)
const WORLD_H = 844;   // design canvas height

const CANDY_W = 280;   // candy slab width  in design px
const CANDY_H = 280;   // candy slab height in design px
const CANDY_X = (WORLD_W - CANDY_W) / 2;
const CANDY_Y = (WORLD_H - CANDY_H) / 2 - 40;

// Stress budget
const BASE_STRESS_PER_FRAME      = 0.0008;  // stress added each scraping frame
const INSTABILITY_MULTIPLIER     = 0.006;   // max extra stress from a completely shaky hand
const EDGE_TO_INTEGRITY_TRANSFER = 0.35;    // fraction of edgeStress that bleeds to integrity
const FRACTURE_EDGE_THRESHOLD    = 0.55;    // edgeStress level that spawns a FracturePoint
const SNAP_INTEGRITY_THRESHOLD   = 0.0;

// Carving
const CARVE_RADIUS               = 14;      // px radius of the carving tool in design px
const COMPLETION_THRESHOLD       = 0.82;    // 82% of outline carved = success

// Audio throttle — don't fire scrape SFX more than once per N ms
const SCRAPE_AUDIO_THROTTLE_MS   = 80;

// Countdown duration
const INTRO_COUNTDOWN_SEC        = 3;

// Shape path tolerance — how close the pointer must be to the outline (design px)
const ON_EDGE_TOLERANCE          = 22;

// ── Shape definitions ─────────────────────────────────────────────────────────
//
//  All coordinates are in [0,1] normalised space relative to the candy slab.
//  They are scaled to canvas px in getShapePath().

type NormPoint = { nx: number; ny: number };

const SHAPES: Record<ShapeId, NormPoint[]> = {
  triangle: [
    { nx: 0.50, ny: 0.10 },
    { nx: 0.88, ny: 0.85 },
    { nx: 0.12, ny: 0.85 },
  ],
  circle: (() => {
    const pts: NormPoint[] = [];
    const segments = 64;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push({ nx: 0.5 + Math.cos(a) * 0.38, ny: 0.5 + Math.sin(a) * 0.38 });
    }
    return pts;
  })(),
  star: (() => {
    const pts: NormPoint[] = [];
    const spikes = 5;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 0.42 : 0.18;
      pts.push({ nx: 0.5 + Math.cos(a) * r, ny: 0.5 + Math.sin(a) * r });
    }
    return pts;
  })(),
  umbrella: [
    // handle bottom
    { nx: 0.50, ny: 0.92 },
    { nx: 0.50, ny: 0.78 },
    { nx: 0.45, ny: 0.78 },
    { nx: 0.45, ny: 0.72 },
    // canopy arc (approximated as polyline segments)
    { nx: 0.10, ny: 0.72 },
    { nx: 0.10, ny: 0.60 },
    { nx: 0.16, ny: 0.46 },
    { nx: 0.26, ny: 0.36 },
    { nx: 0.38, ny: 0.30 },
    { nx: 0.50, ny: 0.28 },
    { nx: 0.62, ny: 0.30 },
    { nx: 0.74, ny: 0.36 },
    { nx: 0.84, ny: 0.46 },
    { nx: 0.90, ny: 0.60 },
    { nx: 0.90, ny: 0.72 },
    { nx: 0.55, ny: 0.72 },
    { nx: 0.55, ny: 0.78 },
    { nx: 0.50, ny: 0.78 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Convert normalised shape coords → canvas-space Point */
function normToCanvas(n: NormPoint, scale: number): Point {
  return {
    x: (CANDY_X + n.nx * CANDY_W) * scale,
    y: (CANDY_Y + n.ny * CANDY_H) * scale,
  };
}

/** Build a canvas-space polygon from a ShapeId */
function getShapePath(id: ShapeId, scale: number): Point[] {
  return SHAPES[id].map((n) => normToCanvas(n, scale));
}

/**
 * Returns the minimum distance from point P to the line segment AB.
 * Used to test whether the pointer is on the shape outline.
 */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Minimum distance from point P to any segment of the shape outline */
function distToOutline(p: Point, path: Point[]): number {
  let minD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    minD = Math.min(minD, distToSegment(p, a, b));
  }
  return minD;
}

/** Pick a random shape, optionally excluding one */
function pickShape(exclude?: ShapeId): ShapeId {
  const all: ShapeId[] = ["triangle", "circle", "star", "umbrella"];
  const pool = exclude ? all.filter((s) => s !== exclude) : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Initial candy state ───────────────────────────────────────────────────────

function makeCandyState(shape: ShapeId): CandyState {
  return {
    totalIntegrity: 1.0,
    edgeStress: 0.0,
    fracturePoints: [],
    completionRatio: 0.0,
    shape,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DalgonaCandyProps {
  onExit?: () => void;
}

export default function DalgonaCandy({ onExit }: DalgonaCandyProps) {
  // ── Shell / store integration ──────────────────────────────────────────
  const { canvasRef: shellCanvas, scale, viewport } = useGameShell();
  const hudSync = useHUDSync({ flushInterval: 200 });

  // ── Local canvas (DalgonaCandy owns its own canvas, identical to GlassBridge pattern)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Game state ─────────────────────────────────────────────────────────
  const [uiPhase, setUiPhase] = useState<GamePhase>("intro");
  const [countdown, setCountdown] = useState(INTRO_COUNTDOWN_SEC);
  const [candyState, setCandyState] = useState<CandyState>(() =>
    makeCandyState(pickShape())
  );
  useEffect(() => {
  hudSync.write({
    health:    Math.round(candyState.totalIntegrity * 100),
    maxHealth: 100,
    score:     Math.round(candyState.completionRatio * 100),
    lives:     uiPhase === "eliminated" ? 0 : 1,
  });
}, [candyState, uiPhase, hudSync]);

  // Mutable refs for the hot path (avoid closure-over-stale-state in rAF)
  const candyRef       = useRef<CandyState>(candyState);
  const phaseRef       = useRef<GamePhase>("intro");
  const scrapeRef      = useRef<ScrapeState>({
    isActive: false,
    lastPos: null,
    velocity: 0,
    lastScrapeTime: 0,
  });
  const carvedSegments = useRef<Set<number>>(new Set()); // indices of outline segments carved
  const rafId          = useRef<number>(0);
  const scaleRef       = useRef<number>(scale);
  const shapePathRef   = useRef<Point[]>([]);

  useEffect(() => {
  hudSync.write({
    health: Math.round(candyState.totalIntegrity * 100),
    maxHealth: 100,
    score: Math.round(candyState.completionRatio * 100),
    lives: uiPhase === "eliminated" ? 0 : 1,
  });
}, [candyState, uiPhase, hudSync]);
  // Keep scale ref in sync (written by GameShell's ResizeObserver → Zustand → component)
  useEffect(() => {
    scaleRef.current = scale;
    shapePathRef.current = getShapePath(candyRef.current.shape, scale);
  }, [scale]);

  // ── Phase 1 bridge — signals global store ──────────────────────────────
  useGameShellBridge({
    uiPhase,
    sourceGame: "dalgona",
    progressMarker: Math.round(candyState.completionRatio * 100),
    progressTotal: 100,
  });

  // ── Audio: set game state on mount ────────────────────────────────────
  useEffect(() => {
    // Audio engine not available in this build
    return () => {
      // Audio cleanup
    };
  }, []);

  // ── Countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (uiPhase !== "intro") return;

    let n = INTRO_COUNTDOWN_SEC;
    setCountdown(n);

    const tick = setInterval(() => {
      // Audio: countdown tick
      // audioEngine.playSfx("countdown_tick");
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(tick);
        setUiPhase("playing");
        phaseRef.current = "playing";
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [uiPhase]);

 // ── Subsequent resize handling (A-3) ──────────────────────────────────
// Fires whenever GameShell's ResizeObserver updates the viewport context.
// On first mount this fires with placeholder dimensions (containerW: worldW)
// before the ResizeObserver has measured the real container.
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const { containerW, containerH, dpr } = viewport;

  canvas.width  = Math.round(containerW * dpr);
  canvas.height = Math.round(containerH * dpr);
  canvas.style.width  = `${containerW}px`;
  canvas.style.height = `${containerH}px`;

  const newScale = canvas.width / WORLD_W;
  shapePathRef.current = getShapePath(candyRef.current.shape, newScale);
  scaleRef.current = newScale;
}, [viewport]);

// ── Initial canvas sizing from real DOM measurements ───────────────────
// The [viewport] effect above fires first (on mount, effects run in
// declaration order) with placeholder dims. This effect fires second,
// overriding those values with actual container measurements from the DOM.
// The render loop effect below fires third — it always starts with the
// correct scaleRef because this effect precedes it in declaration order.
//
// useEffect (not useLayoutEffect) keeps this SSR-safe for Next.js App
// Router, which pre-renders "use client" components on the server.
useEffect(() => {
  const canvas = canvasRef.current;
  const container = containerRef.current ?? canvas?.parentElement;
  if (!canvas || !container) return;

  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width  = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const newScale = canvas.width / WORLD_W;
  shapePathRef.current = getShapePath(candyRef.current.shape, newScale);
  scaleRef.current = newScale;
}, []); // [] = runs once on mount, after [viewport] but before render loop

// ── Render loop ────────────────────────────────────────────────────────
// Declared here, fires third on mount. scaleRef is already correct.
useEffect(() => {
  // ... existing render loop code unchanged ...
}, []);

  // ── Pointer input ──────────────────────────────────────────────────────

  const toCanvasPoint = useCallback((e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // Audio unlock not available
    // Input attached via native listeners
    scrapeRef.current.isActive = true;
    scrapeRef.current.lastPos  = toCanvasPoint(e);
  }, [toCanvasPoint]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!scrapeRef.current.isActive || phaseRef.current !== "playing") return;

    const pos     = toCanvasPoint(e);
    const last    = scrapeRef.current.lastPos;
    const velocity = last ? dist(pos, last) : 0;

    scrapeRef.current.lastPos  = pos;
    scrapeRef.current.velocity = velocity;

    // ── Is the pointer on the shape outline? ──────────────────────────
    const onEdge = distToOutline(pos, shapePathRef.current) < ON_EDGE_TOLERANCE * scaleRef.current;

    if (onEdge && velocity > 0.5) {
      // ── Mark nearby outline segments as carved ────────────────────
      const path = shapePathRef.current;
      for (let i = 0; i < path.length; i++) {
        const a = path[i];
        const b = path[(i + 1) % path.length];
        const segMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (dist(pos, segMid) < CARVE_RADIUS * scaleRef.current * 1.5) {
          carvedSegments.current.add(i);
        }
      }

      // ── Update candy stress ────────────────────────────────────────
      // Input handled via native listeners
      const input = { pointerX: 0, pointerY: 0, isDown: false };
      const stability   = (input as any).stability || 0.5; // 0=chaotic, 1=steady
      const stressDelta =
        BASE_STRESS_PER_FRAME + (1 - stability) * INSTABILITY_MULTIPLIER;

      const prev = candyRef.current;
      let newEdgeStress    = clamp(prev.edgeStress + stressDelta, 0, 1);
      let newIntegrity     = prev.totalIntegrity;
      const newFractures   = [...prev.fracturePoints];
      const newCompletion  = carvedSegments.current.size / path.length;

      // Stress bleeds into overall integrity
      newIntegrity = clamp(
        newIntegrity - stressDelta * EDGE_TO_INTEGRITY_TRANSFER,
        0,
        1
      );

      // Spawn fracture point if stress crosses threshold
      if (
        newEdgeStress > FRACTURE_EDGE_THRESHOLD &&
        Math.random() < (newEdgeStress - FRACTURE_EDGE_THRESHOLD) * 0.3
      ) {
        // Crack appears near the current pointer position, offset slightly
        const jitter = () => (Math.random() - 0.5) * 30 * scaleRef.current;
        const severity = clamp(newEdgeStress - FRACTURE_EDGE_THRESHOLD, 0, 1);
        newFractures.push({
          pos: { x: pos.x + jitter(), y: pos.y + jitter() },
          radius: 4 * scaleRef.current,
          age: 0,
          severity,
        });
        // Relieve some edge stress (the crack absorbed it)
        newEdgeStress = clamp(newEdgeStress - 0.12, 0, 1);

        // Audio: microcrack
        // Audio event: candy crack
        // audioEngine.playCandyMicrocrack(severity);
      }

      // ── Audio: tension level driven by integrity ──────────────────
      // Audio event: set tension level
      // audioEngine.setTensionLevel(1 - newIntegrity);

      // ── Audio: scrape (throttled) ─────────────────────────────────
      const now = performance.now();
      if (now - scrapeRef.current.lastScrapeTime > SCRAPE_AUDIO_THROTTLE_MS) {
        // Audio event: candy scrape
        // const intensity = clamp(velocity / 20, 0, 1);
        // audioEngine.playCandyScrape(intensity);
        scrapeRef.current.lastScrapeTime = now;
      }

      
      const next: CandyState = {
        ...prev,
        totalIntegrity: newIntegrity,
        edgeStress: newEdgeStress,
        fracturePoints: newFractures,
        completionRatio: newCompletion,
      };

      candyRef.current = next;
      setCandyState(next);

      // ── Check win/lose ────────────────────────────────────────────
      if (newIntegrity <= 0) {
        // Player broke the candy
        phaseRef.current = "eliminated";
        setUiPhase("eliminated");
      } else if (newCompletion >= COMPLETION_THRESHOLD) {
        // Player carved out the shape successfully
        phaseRef.current = "success";
        setUiPhase("success");
      }
    }
  }, [toCanvasPoint]);

  const onPointerUp = useCallback(() => {
    scrapeRef.current.isActive = false;
    scrapeRef.current.velocity = 0;
  }, []);

  // ── Render loop ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;

    const draw = () => {
      rafId.current = requestAnimationFrame(draw);
      frame++;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cs = candyRef.current;
      const s  = scaleRef.current;
      const W  = canvas.width;
      const H  = canvas.height;
      const ph = phaseRef.current;

      ctx.clearRect(0, 0, W, H);

      // ── Background ─────────────────────────────────────────────────
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8);
      bg.addColorStop(0, "#1a0a00");
      bg.addColorStop(1, "#0a0500");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Candy slab ─────────────────────────────────────────────────
      const cx = CANDY_X * s;
      const cy = CANDY_Y * s;
      const cw = CANDY_W * s;
      const ch = CANDY_H * s;

      // Candy colour shifts from warm amber → cracked bone as integrity drops
      const integrityRatio = cs.totalIntegrity;
      const r = Math.round(lerp(230, 210, 1 - integrityRatio));
      const g = Math.round(lerp(160, 140, 1 - integrityRatio));
      const b = Math.round(lerp(40, 50, 1 - integrityRatio));

      // Drop shadow
      ctx.shadowColor = `rgba(255,140,0,${0.3 + (1 - integrityRatio) * 0.2})`;
      ctx.shadowBlur  = 30 * s;

      // Candy body
      const candyGrad = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
      candyGrad.addColorStop(0, `rgb(${r + 20},${g + 20},${b + 10})`);
      candyGrad.addColorStop(0.5, `rgb(${r},${g},${b})`);
      candyGrad.addColorStop(1, `rgb(${r - 20},${g - 15},${b - 5})`);

      ctx.fillStyle = candyGrad;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 12 * s);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Caramel gloss highlight
      const gloss = ctx.createLinearGradient(cx, cy, cx, cy + ch * 0.45);
      gloss.addColorStop(0, "rgba(255,255,220,0.22)");
      gloss.addColorStop(1, "rgba(255,255,220,0)");
      ctx.fillStyle = gloss;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch * 0.45, [12 * s, 12 * s, 0, 0]);
      ctx.fill();

      // ── Shape outline ───────────────────────────────────────────────
      const path = shapePathRef.current;
      if (path.length > 1) {
        // Full outline (ghost)
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.closePath();
        ctx.strokeStyle = "rgba(255,220,100,0.18)";
        ctx.lineWidth   = 3 * s;
        ctx.setLineDash([8 * s, 6 * s]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Carved segments (bright amber)
        ctx.lineWidth   = 4 * s;
        ctx.strokeStyle = "rgba(255,200,60,0.85)";
        ctx.lineCap     = "round";
        for (const idx of carvedSegments.current) {
          const a = path[idx];
          const b = path[(idx + 1) % path.length];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
      }

      // ── Fracture points ─────────────────────────────────────────────
      for (const fp of cs.fracturePoints) {
        fp.age++;
        const maxRadius = (8 + fp.severity * 16) * s;
        fp.radius = Math.min(fp.radius + 0.4 * s, maxRadius);
        const alpha = clamp(0.6 + fp.severity * 0.3, 0, 0.9);

        // Dark crack core
        ctx.beginPath();
        ctx.arc(fp.pos.x, fp.pos.y, fp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80,40,0,${alpha})`;
        ctx.lineWidth   = 1.5 * s;
        ctx.stroke();

        // Hairline crack spokes
        const spokes = Math.round(3 + fp.severity * 5);
        for (let k = 0; k < spokes; k++) {
          const angle = (k / spokes) * Math.PI * 2 + fp.age * 0.01;
          const len   = fp.radius * (1.4 + Math.sin(fp.age * 0.05 + k) * 0.3);
          ctx.beginPath();
          ctx.moveTo(fp.pos.x, fp.pos.y);
          ctx.lineTo(
            fp.pos.x + Math.cos(angle) * len,
            fp.pos.y + Math.sin(angle) * len
          );
          ctx.strokeStyle = `rgba(60,30,0,${alpha * 0.7})`;
          ctx.lineWidth   = 0.8 * s;
          ctx.stroke();
        }
      }

      // ── Carving tool cursor (only while scraping in playing phase) ──
      if (ph === "playing" && scrapeRef.current.isActive && scrapeRef.current.lastPos) {
        const tp = scrapeRef.current.lastPos;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, CARVE_RADIUS * s, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,240,180,0.7)";
        ctx.lineWidth   = 2 * s;
        ctx.stroke();
        // Inner dot
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 3 * s, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,240,180,0.9)";
        ctx.fill();
      }

      // ── Integrity bar ───────────────────────────────────────────────
      if (ph === "playing" || ph === "intro") {
        const barX  = cx;
        const barY  = cy + ch + 18 * s;
        const barW  = cw;
        const barH  = 10 * s;
        const barR  = 5 * s;

        // Track
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, barR);
        ctx.fill();

        // Fill — amber → red as integrity drops
        const fillW   = barW * cs.totalIntegrity;
        const barRed  = Math.round(lerp(80, 220, 1 - cs.totalIntegrity));
        const barGreen = Math.round(lerp(200, 40, 1 - cs.totalIntegrity));
        ctx.fillStyle = `rgb(${barRed},${barGreen},40)`;
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillW, barH, barR);
        ctx.fill();

        // Label
        ctx.fillStyle   = "rgba(255,220,140,0.6)";
        ctx.font        = `${10 * s}px 'Courier New', monospace`;
        ctx.textAlign   = "left";
        ctx.fillText("CANDY INTEGRITY", barX, barY - 6 * s);
      }

      // ── Completion arc ──────────────────────────────────────────────
      if (ph === "playing" || ph === "success") {
        const arcCX = W / 2;
        const arcCY = (CANDY_Y + CANDY_H + 50) * s;
        const arcR  = 22 * s;
        ctx.beginPath();
        ctx.arc(arcCX, arcCY, arcR, -Math.PI / 2, -Math.PI / 2 + cs.completionRatio * Math.PI * 2);
        ctx.strokeStyle = "rgba(255,210,60,0.85)";
        ctx.lineWidth   = 4 * s;
        ctx.stroke();

        ctx.fillStyle   = "rgba(255,220,140,0.7)";
        ctx.font        = `bold ${9 * s}px 'Courier New', monospace`;
        ctx.textAlign   = "center";
        ctx.fillText(
          `${Math.round(cs.completionRatio * 100)}%`,
          arcCX,
          arcCY + 4 * s
        );
      }

      // ── Screen-flash on snap ────────────────────────────────────────
      if (ph === "eliminated") {
        const flashAlpha = clamp(0.6 - (frame % 30) / 30, 0, 0.6);
        if (frame < 60) {
          ctx.fillStyle = `rgba(180,0,0,${flashAlpha})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    };

    draw();
    return () => cancelAnimationFrame(rafId.current);
  }, []); // runs once — reads all live data through refs

  // ── Restart ────────────────────────────────────────────────────────────

  const handleRestart = useCallback(() => {
    const shape = pickShape(candyRef.current.shape);
    const fresh = makeCandyState(shape);
    candyRef.current = fresh;
    carvedSegments.current.clear();
    scrapeRef.current = { isActive: false, lastPos: null, velocity: 0, lastScrapeTime: 0 };
    shapePathRef.current = getShapePath(shape, scaleRef.current);
    setCandyState(fresh);
    setCountdown(INTRO_COUNTDOWN_SEC);
    // Audio event: set game state
    // audioEngine.setGameState("green_light");
    // setUiPhase("intro");
    // Audio event: set game state
    // audioEngine.setGameState("green_light");
    // audioEngine.resetTensionLevel(0.3);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  const shapeName = candyState.shape.charAt(0).toUpperCase() + candyState.shape.slice(1);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#0a0500",
        userSelect: "none",
        touchAction: "none",
     }}
    >
    
      {/* ── Canvas ── */}
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", cursor: "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* ── Intro overlay ── */}
      {uiPhase === "intro" && (
        <div style={styles.overlay}>
          <div style={styles.shapeLabel}>
            {shapeName}
          </div>
          <div style={styles.instruction}>
            Carve the shape without breaking the candy
          </div>
          <div style={styles.countdown}>
            {countdown > 0 ? countdown : "GO!"}
          </div>
        </div>
      )}

      {/* ── Success overlay ── */}
      {uiPhase === "success" && (
        <div style={{ ...styles.overlay, background: "rgba(0,0,0,0.72)" }}>
          <div style={{ ...styles.resultTitle, color: "#ffd93d" }}>
            SUCCESS
          </div>
          <div style={styles.resultSub}>
            Shape preserved · Integrity {Math.round(candyRef.current.totalIntegrity * 100)}%
          </div>
          <button style={styles.btn} onClick={handleRestart}>
            Play Again
          </button>
          {onExit && (
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onExit}>
              Exit
            </button>
          )}
        </div>
      )}

      {/* ── Eliminated overlay ── */}
      {uiPhase === "eliminated" && (
        <div style={{ ...styles.overlay, background: "rgba(0,0,0,0.80)" }}>
          <div style={{ ...styles.resultTitle, color: "#ff4444" }}>
            ELIMINATED
          </div>
          <div style={styles.resultSub}>
            The candy snapped.
          </div>
          <button style={styles.btn} onClick={handleRestart}>
            Try Again
          </button>
          {onExit && (
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onExit}>
              Exit
            </button>
          )}
        </div>
      )}

      {/* ── Live HUD: edge stress warning ── */}
      {uiPhase === "playing" && candyState.edgeStress > 0.4 && (
        <div
          style={{
            ...styles.stressWarning,
            opacity: clamp((candyState.edgeStress - 0.4) / 0.6, 0, 1),
          }}
        >
          {candyState.edgeStress > 0.75 ? "⚠ CRITICAL — STEADY YOUR HAND" : "⚠ EASE UP"}
        </div>
      )}
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────
//
// Intentionally restrained — the canvas carries the visual weight.
// UI chrome uses Courier New (monospace) to echo the show's stark numbered aesthetic.

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    background: "rgba(0,0,0,0.60)",
    pointerEvents: "none",
  },
  shapeLabel: {
    fontFamily: "'Courier New', monospace",
    fontSize: "clamp(36px, 8vw, 64px)",
    fontWeight: 700,
    letterSpacing: "0.18em",
    color: "#ffd93d",
    textTransform: "uppercase",
    textShadow: "0 0 30px rgba(255,210,60,0.6)",
  },
  instruction: {
    fontFamily: "'Courier New', monospace",
    fontSize: "clamp(13px, 3vw, 17px)",
    color: "rgba(255,220,140,0.7)",
    letterSpacing: "0.08em",
    textAlign: "center",
    maxWidth: 280,
  },
  countdown: {
    fontFamily: "'Courier New', monospace",
    fontSize: "clamp(72px, 18vw, 120px)",
    fontWeight: 900,
    color: "#ffffff",
    textShadow: "0 0 40px rgba(255,255,255,0.4)",
    lineHeight: 1,
    marginTop: 8,
  },
  resultTitle: {
    fontFamily: "'Courier New', monospace",
    fontSize: "clamp(42px, 10vw, 80px)",
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    textShadow: "0 0 40px currentColor",
  },
  resultSub: {
    fontFamily: "'Courier New', monospace",
    fontSize: "clamp(14px, 3.5vw, 18px)",
    color: "rgba(255,220,140,0.65)",
    letterSpacing: "0.06em",
  },

  btn: {
    fontFamily: "'Courier New', monospace",
    fontSize: "clamp(13px, 3vw, 16px)",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#ffffff",
    background: "#037a76", // Squid Game Tracksuit Green
    border: "4px solid #000000", // Minecraft blocky edge
    boxShadow: "4px 4px 0px #000000", // 8-bit shadow
    borderRadius: 0, // Hard corners for Minecraft theme
    padding: "12px 32px",
    cursor: "pointer",
    marginTop: 8,
    pointerEvents: "auto",
    transition: "transform 0.1s",
  },
  btnSecondary: {
    background: "#ed1b76", // Guard Pink for secondary actions
    color: "#ffffff",
  },
  stressWarning: {
    position: "absolute",
    bottom: "22%",
    left: "50%",
    transform: "translateX(-50%)",
    fontFamily: "'Courier New', monospace",
    fontSize: "clamp(11px, 2.5vw, 14px)",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#ff6b35",
    textShadow: "0 0 12px rgba(255,80,0,0.5)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}