"use client";
import { motion, AnimatePresence } from "framer-motion";
import { audioEventBus } from '../../lib/audio/AudioEventBus';
import { useHUDSync } from "@/components/hud/useHUDSync";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useGameStore } from "../../store/gameStore";
import { useOptimizedGameLoop } from "@/hooks/useOptimizedGameLoop";
import { useAdaptiveQuality } from "@/hooks/useAdaptiveQuality";
import { useCanvasScale } from "@/hooks/useCanvasScale";
import { useSceneCleanup } from "@/hooks/useSceneCleanup";
import MobileTouchControls from "@/components/touch/MobileTouchControls";
import CanvasWrapper, { type CanvasWrapperHandle, type CanvasSize } from "../canvas/CanvasWrapper";
import { useGameAudio } from "../../hooks/useAmbientAudio";
import { SoundManager } from "@/managers/SoundManager";
import { drawMinecraftCharacter } from "@/lib/render/drawMinecraftCharacter";

// ─── Design Constants ─────────────────────────────────────────────────────────

const DW = 1280;
const DH = 720;

const GROUND_Y       = DH - 110;
const PLAYER_W       = 36;
const PLAYER_H       = 56;
const FINISH_X       = DW * 6.5;
const START_X        = 160;
const DOLL_WORLD_X   = FINISH_X + 60;

const ACCEL          = 980;
const DECEL          = 1400;
const MAX_SPEED_BASE = 320;
const SPRINT_MULT    = 1.55;
const JUMP_FORCE     = -510;
const GRAVITY        = 880;
const MAX_FALL       = 1100;

const SAFE_VELOCITY_THRESHOLD = 18;
const GRACE_PERIOD_MS         = 380;
const FAKE_OUT_TURN_BACK_MS   = 260;

const GREEN_BASE     = 4.25;
const RED_BASE       = 3.0;
const TURN_DUR       = 0.42;
const WARNING_DUR    = 0.55;

const NPC_COUNT      = 14;
const NPC_LANES      = 7;

const CAM_LEAD_X     = 0.32;
const CAM_LERP       = 6;

const DOLL_SIZE      = 78;

// ─── Types ────────────────────────────────────────────────────────────────────

type LightPhase = "green" | "warning" | "turning" | "red" | "fake_out";
type EliminationPhase = "none" | "impact" | "slow_mo" | "showing";
type PlayerStatus = "alive" | "eliminating" | "eliminated" | "finished";

interface Player {
  id: number;
  wx: number;
  wy: number;
  vy: number;
  vx: number;
  onGround: boolean;
  status: PlayerStatus;
  laneY: number;
  opacity: number;
  scaleX: number;
  scaleY: number;
  facing: 1 | -1;
  animPhase: number;
  lastStepVx: number;
  stepTimer: number;
  isNPC: boolean;
  npcSpeed: number;
  npcReactDelay: number;
  npcReactTimer: number;
  elimTimer: number;
  hitFlashTimer: number;
  score: number;
}

interface DollState {
  angle: number;
  targetAngle: number;
  phase: LightPhase;
  stateTimer: number;
  gracePct: number;
  eyeOpen: boolean;
  eyeBlinkT: number;
  fakeOutTimer: number;
}

interface CameraState {
  x: number;
  shake: number;
  shakeTimer: number;
  shakeDecay: number;
}

interface ParticleData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
  type: "dust" | "spark" | "blood";
}

interface GameState {
  phase: "countdown" | "playing" | "eliminating" | "gameover" | "victory";
  lightPhase: LightPhase;
  elimPhase: EliminationPhase;
  elapsed: number;
  timeLeft: number;
  totalTime: number;
  countdown: number;
  graceMsLeft: number;
  slowMoMult: number;
  players: Player[];
  doll: DollState;
  camera: CameraState;
  particles: ParticleData[];
  difficulty: number;
  round: number;
  fakeOutProb: number;
  aliveCount: number;
  playerScore: number;
  inputLeft: boolean;
  inputRight: boolean;
  inputJump: boolean;
  inputSprint: boolean;
  audioEvents: Set<string>;
}

// ─── Colour Palette ───────────────────────────────────────────────────────────

const C = {
  bg0:        "#050810",
  bg1:        "#0b1220",
  ground:     "#111827",
  groundTop:  "#1e293b",
  groundGrid: "#1a2440",
  accent:     "#00f5c4",
  danger:     "#ff3d5a",
  warn:       "#f97316",
  green:      "#22c55e",
  red:        "#ef4444",
  muted:      "rgba(255,255,255,0.32)",
  white:      "#ffffff",
  dollPink:   "#f472b6",
  dollDress:  "#be185d",
  dollHair:   "#1c1917",
  dollFace:   "#fde68a",
  finish:     "#fbbf24",
  blood:      "#dc2626",
  dust:       "rgba(200,210,230,0.6)",
  spark:      "#fef08a",
} as const;

// ─── Pure Utilities ───────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI)  d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ─── Factory Functions ────────────────────────────────────────────────────────

function makePlayer(id: number, isNPC: boolean): Player {
  const lane  = isNPC ? (id % NPC_LANES) : 0;
  const laneY = GROUND_Y - lane * 3.5 - PLAYER_H;
  return {
    id,
    wx:            START_X - (isNPC ? Math.random() * 80 : 0),
    wy:            laneY,
    vy:            0,
    vx:            0,
    onGround:      true,
    status:        "alive",
    laneY,
    opacity:       1,
    scaleX:        1,
    scaleY:        1,
    facing:        1,
    animPhase:     Math.random() * Math.PI * 2,
    lastStepVx:    0,
    stepTimer:     0,
    isNPC,
    npcSpeed:      MAX_SPEED_BASE * (0.55 + Math.random() * 0.6),
    npcReactDelay: 0.1 + Math.random() * 0.25,
    npcReactTimer: 0,
    elimTimer:     0,
    hitFlashTimer: 0,
    score:         0,
  };
}

function makeDoll(): DollState {
  return {
    angle: 0, targetAngle: 0,
    phase: "green", stateTimer: GREEN_BASE,
    gracePct: 0, eyeOpen: true,
    eyeBlinkT: 2 + Math.random() * 2, fakeOutTimer: 0,
  };
}

function makeCamera(): CameraState {
  return { x: 0, shake: 0, shakeTimer: 0, shakeDecay: 8 };
}

function makeGameState(diffNum: number): GameState {
  const players: Player[] = [makePlayer(0, false)];
  for (let i = 1; i <= NPC_COUNT; i++) players.push(makePlayer(i, true));

  return {
    phase: "countdown", lightPhase: "green", elimPhase: "none",
    elapsed: 0, timeLeft: 90, totalTime: 90, countdown: 3,
    graceMsLeft: 0, slowMoMult: 1,
    players, doll: makeDoll(), camera: makeCamera(),
    particles: [], difficulty: diffNum, round: 1, fakeOutProb: 0.08,
    aliveCount: NPC_COUNT + 1, playerScore: 0,
    inputLeft: false, inputRight: false, inputJump: false, inputSprint: false,
    audioEvents: new Set(),
  };
}

// ─── Draw Helpers ─────────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, camX: number, gs: GameState): void {
  // Eerie, over-exposed synthetic sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  const danger = gs.lightPhase === "red" ? 1 : gs.lightPhase === "warning" ? 0.5 : 0;
  
  // Base sky: Surreal bright blue to dusty horizon
  const rT = Math.floor(lerp(120, 230, danger));
  const gT = Math.floor(lerp(180, 50, danger));
  const bT = Math.floor(lerp(255, 50, danger));
  
  sky.addColorStop(0, `rgb(${rT}, ${gT}, ${bT})`);
  sky.addColorStop(1, `rgb(${rT + 60}, ${gT + 60}, ${bT + 40})`); // Dusty horizon
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, DW, GROUND_Y);

  // Stylized Clouds (Geometric/Synthetic feel)
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  for (let i = 0; i < 12; i++) {
    const cx = ((i * 320 - camX * 0.05) % (DW + 400) + DW + 400) % (DW + 400) - 200;
    const cy = 40 + (i * 30 % 150);
    ctx.beginPath();
    ctx.roundRect(cx, cy, 180 + (i % 3) * 60, 40, 20);
    ctx.fill();
  }

  // Painted playground walls in the deep distance
  const wallGrad = ctx.createLinearGradient(0, GROUND_Y - 120, 0, GROUND_Y);
  wallGrad.addColorStop(0, "rgba(237, 27, 118, 0.15)"); // Brand Pink bounce light
  wallGrad.addColorStop(1, "rgba(0, 0, 0, 0.4)");
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, GROUND_Y - 120, DW, 120);
}

function drawGround(ctx: CanvasRenderingContext2D, camX: number): void {
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, GROUND_Y, DW, DH - GROUND_Y);
  ctx.fillStyle = C.groundTop;
  ctx.fillRect(0, GROUND_Y, DW, 3);

  ctx.strokeStyle = C.groundGrid;
  ctx.lineWidth   = 1;
  const gridSize  = 80;
  const gOff      = camX % gridSize;
  ctx.beginPath();
  for (let x = -gOff; x < DW + gridSize; x += gridSize) {
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x, DH);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 30);
  ctx.lineTo(DW, GROUND_Y + 30);
  ctx.moveTo(0, GROUND_Y + 70);
  ctx.lineTo(DW, GROUND_Y + 70);
  ctx.stroke();
}

function drawFinishLine(ctx: CanvasRenderingContext2D, camX: number): void {
  const sx = FINISH_X - camX;
  if (sx < -60 || sx > DW + 60) return;

  const grd = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
  grd.addColorStop(0,   "rgba(251,191,36,0)");
  grd.addColorStop(0.5, "rgba(251,191,36,0.22)");
  grd.addColorStop(1,   "rgba(251,191,36,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(sx - 30, 0, 60, DH);

  const tW = 16, tH = 20;
  const rows = Math.ceil(GROUND_Y / tH);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? C.finish : "rgba(255,255,255,0.92)";
      ctx.fillRect(sx - tW + c * tW, r * tH, tW, tH);
    }
  }

  ctx.fillStyle   = C.finish;
  ctx.font        = "bold 13px JetBrains Mono, monospace";
  ctx.textAlign   = "center";
  ctx.fillText("FINISH", sx, GROUND_Y - 8);
}

function drawDoll(ctx: CanvasRenderingContext2D, doll: DollState, camX: number, gs: GameState): void {
  const sx = DOLL_WORLD_X - camX;
  if (sx < -DOLL_SIZE * 2 || sx > DW + DOLL_SIZE * 2) return;

  const S  = DOLL_SIZE;
  const HS = S / 2;

  ctx.save();
  ctx.translate(sx, GROUND_Y - S * 0.18);
  ctx.rotate(doll.angle);

  ctx.save();
  ctx.rotate(-doll.angle);
  ctx.fillStyle   = "rgba(0,0,0,0.35)";
  ctx.scale(1, 0.3);
  ctx.beginPath();
  ctx.ellipse(0, S * 0.85, S * 0.45, S * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle   = C.dollDress;
  ctx.beginPath();
  ctx.moveTo(-HS * 0.42, 0);
  ctx.bezierCurveTo(-HS * 0.42, S * 0.35, -HS * 0.82, S * 0.75, -HS * 0.72, S * 0.82);
  ctx.lineTo(HS * 0.72, S * 0.82);
  ctx.bezierCurveTo(HS * 0.82, S * 0.75, HS * 0.42, S * 0.35, HS * 0.42, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(-HS * 0.3, 0);
  ctx.bezierCurveTo(-HS * 0.3, S * 0.3, -HS * 0.55, S * 0.6, -HS * 0.5, S * 0.78);
  ctx.lineTo(0, S * 0.78);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.dollPink;
  ctx.beginPath();
  ctx.roundRect(-HS * 0.36, -S * 0.06, HS * 0.72, S * 0.46, 4);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.14, Math.PI * 0.85, Math.PI * 0.15);
  ctx.stroke();

  ctx.fillStyle = C.dollFace;
  ctx.beginPath();
  ctx.arc(0, -S * 0.26, S * 0.23, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.dollHair;
  ctx.beginPath();
  ctx.arc(0, -S * 0.34, S * 0.23, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-S * 0.23, -S * 0.41, S * 0.46, S * 0.1);

  const pt = [[-S * 0.28, -S * 0.32], [S * 0.28, -S * 0.32]] as const;
  for (const [px, py] of pt) {
    ctx.fillStyle = C.dollHair;
    ctx.beginPath();
    ctx.arc(px, py, S * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#db2777";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(px, py + S * 0.06, S * 0.04, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (doll.eyeOpen) {
    const isDanger  = gs.lightPhase === "red";
    const isWarning = gs.lightPhase === "warning" || gs.lightPhase === "turning";
    const eyeCol    = isDanger ? C.red : isWarning ? C.warn : "#1c1917";
    const eyeR      = isDanger ? S * 0.048 : S * 0.034;

    for (const ex of [-S * 0.096, S * 0.096]) {
      if (isDanger) {
        ctx.shadowBlur  = 16;
        ctx.shadowColor = C.red;
      }
      ctx.fillStyle = eyeCol;
      ctx.beginPath();
      ctx.arc(ex, -S * 0.28, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(ex - eyeR * 0.3, -S * 0.28 - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth   = 1.5;
    for (const ex of [-S * 0.096, S * 0.096]) {
      ctx.beginPath();
      ctx.arc(ex, -S * 0.275, S * 0.034, 0, Math.PI);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "#92400e";
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = "round";
  const isRed     = gs.lightPhase === "red";
  ctx.beginPath();
  if (isRed) {
    ctx.moveTo(-S * 0.1, -S * 0.15);
    ctx.lineTo( S * 0.1, -S * 0.15);
  } else {
    ctx.arc(0, -S * 0.17, S * 0.08, 0.15, Math.PI - 0.15);
  }
  ctx.stroke();
  ctx.lineCap = "butt";

  const orbCol = gs.lightPhase === "red" ? C.red
    : gs.lightPhase === "warning" ? C.warn
    : gs.lightPhase === "turning" ? C.warn
    : C.green;
  ctx.shadowBlur  = 24;
  ctx.shadowColor = orbCol;
  ctx.fillStyle   = orbCol;
  ctx.beginPath();
  ctx.arc(0, -S * 0.62, S * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur  = 0;

  ctx.fillStyle   = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(-S * 0.03, -S * 0.645, S * 0.03, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── NEW: Minecraft Character Drawer ──────────────────────────────────────────

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  camX: number,
  isHuman: boolean,
  gs: GameState
): void {
  const sx = p.wx - camX;
  if (sx < -PLAYER_W * 3 || sx > DW + PLAYER_W * 3) return;
  if (p.status === "finished") return;

  const state = p.status === "eliminating"
    ? "hit"
    : !p.onGround
      ? "jumping"
      : Math.abs(p.vx) > 10
        ? "running"
        : "idle";

  drawMinecraftCharacter(ctx, {
    x:            sx,
    y:            p.wy,
    width:        PLAYER_W,
    height:       PLAYER_H,
    facing:       p.facing,
    animPhase:    p.animPhase,
    opacity:      p.opacity,
    scaleX:       p.scaleX,
    scaleY:       p.scaleY,
    
    // THE FIX: Forces everyone to be a "player" and assigns unique numbers
    role:         "player",
    playerNumber: isHuman ? 456 : (p.id + 6), 
    
    state,
    hitFlash:     p.hitFlashTimer,
  });
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: ParticleData[], camX: number): void {
  for (const p of particles) {
    const t    = p.life / p.maxLife;
    const alpha = p.type === "dust"
      ? (t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7) * 0.7
      : (1 - t);

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle   = p.color;

    if (p.type === "spark") {
      ctx.shadowBlur  = 6;
      ctx.shadowColor = p.color;
    }

    ctx.beginPath();
    ctx.arc(p.x - camX, p.y, p.r * (1 - t * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEnvironmentLighting(ctx: CanvasRenderingContext2D, gs: GameState): void {
  const lp = gs.lightPhase;

  if (lp === "red" || lp === "warning" || lp === "turning") {
    const beamCol = lp === "red" ? "rgba(239,68,68,0.13)" : "rgba(249,115,22,0.08)";
    const grd = ctx.createLinearGradient(DW, 0, 0, 0);
    grd.addColorStop(0,   beamCol);
    grd.addColorStop(0.6, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, DW, DH);
  }

  if (lp === "green") {
    const grd = ctx.createLinearGradient(DW, 0, 0, 0);
    grd.addColorStop(0,   "rgba(34,197,94,0.07)");
    grd.addColorStop(0.7, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, DW, DH);
  }

  const vigStr = lp === "red" ? 0.72 : lp === "warning" ? 0.5 : 0.38;
  const vig    = ctx.createRadialGradient(
    DW / 2, DH / 2, DH * 0.2,
    DW / 2, DH / 2, DH * 0.92
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, `rgba(0,0,0,${vigStr})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, DW, DH);

  if (lp === "red") {
    // 1. Red pulsing vignette
    const pulse = 0.5 + Math.sin(Date.now() * 0.004) * 0.5;
    const redV  = ctx.createRadialGradient(DW, DH / 2, 0, DW, DH / 2, DW * 0.9);
    redV.addColorStop(0,   `rgba(239,68,68,${0.08 * pulse})`);
    redV.addColorStop(0.5, `rgba(239,68,68,${0.04 * pulse})`);
    redV.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = redV;
    ctx.fillRect(0, 0, DW, DH);

    // 2. NEW: Terrifying Scanner Laser Sweep
    const sweepPct = (Date.now() % 1200) / 1200; // Sweeps across every 1.2 seconds
    const laserX = DW - (DW * sweepPct); // Sweeps right to left toward the player
    
    // Core laser line
    ctx.fillStyle = "rgba(255, 30, 30, 0.9)";
    ctx.fillRect(laserX, 0, 4, DH);
    
    // Laser glow
    const lg = ctx.createLinearGradient(laserX - 60, 0, laserX + 60, 0);
    lg.addColorStop(0, "rgba(255,0,0,0)");
    lg.addColorStop(0.5, "rgba(255,0,0,0.25)");
    lg.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(laserX - 60, 0, 120, DH);
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, gs: GameState): void {
  const human    = gs.players[0];
  const progress = clamp((human.wx - START_X) / (FINISH_X - START_X), 0, 1);

  const bX = 40, bY = 18, bW = DW - 80, bH = 9;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(bX, bY, bW, bH, 4.5);
  ctx.fill();

  const bCol = gs.lightPhase === "red" ? C.red : C.green;
  ctx.fillStyle   = bCol;
  ctx.shadowBlur  = 10;
  ctx.shadowColor = bCol;
  ctx.beginPath();
  ctx.roundRect(bX, bY, bW * progress, bH, 4.5);
  ctx.fill();
  ctx.shadowBlur  = 0;

  const pipX = bX + bW * progress;
  ctx.fillStyle   = C.warn;
  ctx.shadowBlur  = 12;
  ctx.shadowColor = C.warn;
  ctx.beginPath();
  ctx.arc(pipX, bY + bH / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur  = 0;

  for (let i = 1; i < gs.players.length; i++) {
    const np = gs.players[i];
    if (np.status !== "alive") continue;
    const npPct = clamp((np.wx - START_X) / (FINISH_X - START_X), 0, 1);
    ctx.fillStyle = "rgba(232,67,138,0.6)";
    ctx.beginPath();
    ctx.arc(bX + bW * npPct, bY + bH / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = C.muted;
  ctx.font      = "10px JetBrains Mono, monospace";
  ctx.textAlign = "left";
  ctx.fillText("START", bX, bY + bH + 14);
  ctx.textAlign = "right";
  ctx.fillText("FINISH", bX + bW, bY + bH + 14);

  const tl   = Math.max(0, gs.timeLeft);
  const tMin = Math.floor(tl / 60);
  const tSec = Math.floor(tl % 60);
  const tCol = tl < 10 ? C.danger : tl < 20 ? C.warn : C.white;

  ctx.font        = "bold 30px Rajdhani, sans-serif";
  ctx.fillStyle   = tCol;
  ctx.textAlign   = "center";
  if (tl < 10) { ctx.shadowBlur = 18; ctx.shadowColor = C.danger; }
  ctx.fillText(
    `${tMin.toString().padStart(2, "0")}:${tSec.toString().padStart(2, "0")}`,
    DW / 2, 58
  );
  ctx.shadowBlur = 0;

  const liLabel = gs.lightPhase === "green"   ? "● GREEN LIGHT"
    : gs.lightPhase === "red"     ? "● RED LIGHT"
    : gs.lightPhase === "warning" ? "◉ WARNING"
    : gs.lightPhase === "fake_out"? "○ ..."
    : "◐ TURNING";
  const liCol = gs.lightPhase === "green"   ? C.green
    : gs.lightPhase === "red"     ? C.red
    : gs.lightPhase === "warning" || gs.lightPhase === "turning"
    ? C.warn : C.muted;

  ctx.font        = "bold 13px Rajdhani, sans-serif";
  ctx.fillStyle   = liCol;
  ctx.textAlign   = "center";
  ctx.shadowBlur  = 14;
  ctx.shadowColor = liCol;
  ctx.fillText(liLabel, DW / 2, 78);
  ctx.shadowBlur  = 0;

  ctx.font        = "bold 12px JetBrains Mono, monospace";
  ctx.fillStyle   = C.muted;
  ctx.textAlign   = "left";
  ctx.fillText(`ALIVE  ${gs.aliveCount}/${NPC_COUNT + 1}`, 44, 62);

  ctx.fillStyle   = C.accent;
  ctx.textAlign   = "right";
  ctx.fillText(gs.playerScore.toString().padStart(7, "0"), DW - 44, 62);

  ctx.fillStyle   = "rgba(255,255,255,0.18)";
  ctx.font        = "10px JetBrains Mono, monospace";
  ctx.fillText(`ROUND ${gs.round}   LVL ${gs.difficulty.toFixed(1)}`, DW - 44, 79);

  if (gs.graceMsLeft > 0) {
    const gpct = gs.graceMsLeft / GRACE_PERIOD_MS;
    ctx.fillStyle = `rgba(249,115,22,${gpct * 0.6})`;
    ctx.font      = `bold ${Math.round(16 + gpct * 6)}px Rajdhani, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("STOP!", DW / 2, DH - 60);
  }
}

// ─── Light State Machine ──────────────────────────────────────────────────────

function updateLightStateMachine(gs: GameState, dt: number): void {
  const doll = gs.doll;
  doll.stateTimer -= dt;

  doll.eyeBlinkT -= dt;
  if (doll.eyeBlinkT <= 0) {
    doll.eyeOpen  = !doll.eyeOpen;
    doll.eyeBlinkT = doll.eyeOpen ? 2 + Math.random() * 3 : 0.1;
  }

  const angleDist = Math.abs(doll.targetAngle - doll.angle);
  if (angleDist > 0.005) {
    doll.angle = lerpAngle(doll.angle, doll.targetAngle, Math.min(1, dt / TURN_DUR * 3.5));
  } else {
    doll.angle = doll.targetAngle;
  }

  if (doll.stateTimer <= 0) {
switch (doll.phase) {
      case "green": {
        // Audio finishes exactly as this timer hits 0. Trigger warning immediately.
        doll.phase       = "warning";
        doll.stateTimer  = WARNING_DUR / gs.difficulty;
        gs.lightPhase    = "warning";
        gs.audioEvents.add("warning");
        break;
      }
      case "fake_out": {
        // Unused in perfect-sync mode, but kept for state safety
        break;
      }
      case "warning": {
        doll.phase       = "turning";
        doll.targetAngle = Math.PI;
        doll.stateTimer  = TURN_DUR / gs.difficulty;
        gs.graceMsLeft   = GRACE_PERIOD_MS;
        gs.audioEvents.add("doll_turn");
        break;
      }
      case "turning": {
        doll.phase       = "red";
        doll.stateTimer  = RED_BASE / gs.difficulty; 
        gs.lightPhase    = "red";
        gs.audioEvents.add("red_light");
        gs.audioEvents.add("heartbeat_start"); // NEW: Start pumping heartbeat
        break;
      }
      case "red": {
        doll.phase       = "green";
        doll.targetAngle = 0;
        doll.stateTimer  = GREEN_BASE / gs.difficulty; 
        gs.lightPhase    = "green";
        gs.audioEvents.add("green_light");
        gs.audioEvents.add("heartbeat_stop"); // NEW: Instant relief silence
        break;
      }
    }
  }

  if (gs.graceMsLeft > 0) {
    gs.graceMsLeft -= dt * 1000;
    if (gs.graceMsLeft < 0) gs.graceMsLeft = 0;
  }
}

// ─── Player Update ────────────────────────────────────────────────────────────

function updatePlayer(p: Player, gs: GameState, dt: number, isHuman: boolean): void {
  if (p.status !== "alive") return;

  const prevVx  = p.vx;
  const maxSpeed= (isHuman
    ? MAX_SPEED_BASE * (gs.inputSprint ? SPRINT_MULT : 1)
    : p.npcSpeed) * (0.7 + gs.difficulty * 0.15);

  if (isHuman) {
    if (gs.inputRight) {
      p.vx     = Math.min(p.vx + ACCEL * dt, maxSpeed);
      p.facing = 1;
    } else if (gs.inputLeft) {
      p.vx     = Math.max(p.vx - ACCEL * dt, -maxSpeed * 0.5);
      p.facing = -1;
    } else {
      if (p.vx > 0) p.vx = Math.max(0, p.vx - DECEL * dt);
      if (p.vx < 0) p.vx = Math.min(0, p.vx + DECEL * dt);
    }

    if (gs.inputJump && p.onGround) {
      p.vy       = JUMP_FORCE;
      p.onGround = false;
      p.scaleX   = 0.72;
      p.scaleY   = 1.28;
      gs.audioEvents.add("jump");
      spawnDust(gs, p.wx, p.wy, 4);
    }
  } else {
    p.npcReactTimer -= dt;

    const npcShouldMove = gs.lightPhase === "green" ||
      (gs.lightPhase === "turning" && gs.graceMsLeft > 100);

    if (npcShouldMove && p.npcReactTimer <= 0) {
      p.vx     = Math.min(p.vx + ACCEL * dt * 0.7, p.npcSpeed);
      p.facing = 1;
    } else if (!npcShouldMove) {
      if (p.npcReactTimer <= -p.npcReactDelay) {
        if (p.vx > 0) p.vx = Math.max(0, p.vx - DECEL * dt * 0.9);
      }
    }

    if (p.onGround && Math.random() < 0.003) {
      p.vy       = JUMP_FORCE * 0.6;
      p.onGround = false;
    }
  }

  if (!p.onGround) {
    p.vy += GRAVITY * dt;
    p.vy  = Math.min(p.vy, MAX_FALL);
    p.wy += p.vy * dt;

    if (p.wy >= p.laneY) {
      p.wy       = p.laneY;
      p.vy       = 0;
      p.onGround = true;

      if (prevVx !== 0 || Math.abs(p.vy) > 50) {
        p.scaleX = 1.25;
        p.scaleY = 0.78;
        if (isHuman) gs.audioEvents.add("land");
        spawnDust(gs, p.wx, p.wy + PLAYER_H, 3);
      }
    }
  }

  p.wx = Math.max(START_X, p.wx + p.vx * dt);

  p.scaleX = lerp(p.scaleX, 1, Math.min(1, dt * 12));
  p.scaleY = lerp(p.scaleY, 1, Math.min(1, dt * 12));

  const isMoving = Math.abs(p.vx) > 10;
  if (isMoving) {
    p.animPhase += dt * Math.abs(p.vx) * 0.055;

    if (isHuman && p.onGround) {
      p.stepTimer -= dt;
      if (p.stepTimer <= 0) {
        p.stepTimer = 0.22 - Math.min(0.12, Math.abs(p.vx) * 0.0003);
        gs.audioEvents.add("step");
        spawnDust(gs, p.wx, p.wy + PLAYER_H, 1);
      }
    }
  }

  if (p.hitFlashTimer > 0) {
    p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt * 3);
  }

  if (p.wx >= FINISH_X) {
    p.status = "finished";
    if (isHuman) {
      gs.audioEvents.add("victory");
      gs.phase = "victory";
    }
  }
}

// ─── Movement Detection ───────────────────────────────────────────────────────

function checkEliminationForPlayer(p: Player, gs: GameState, isHuman: boolean): boolean {
  if (gs.lightPhase !== "red") return false;
  if (gs.graceMsLeft > 0)      return false;
  if (p.status !== "alive")    return false;

  const speed = Math.abs(p.vx) + Math.abs(p.vy) * 0.5;
  const caught = speed > SAFE_VELOCITY_THRESHOLD;

  if (caught) {
    p.status        = "eliminating";
    p.hitFlashTimer = 1;
    spawnBlood(gs, p.wx, p.wy);
    spawnSpark(gs, p.wx, p.wy, 8);

    if (isHuman) {
      gs.phase             = "eliminating";
      gs.elimPhase         = "impact";
      gs.camera.shake      = 16;
      gs.camera.shakeTimer = 0.55;
      gs.slowMoMult        = 1;
      gs.audioEvents.add("eliminated");
    } else {
      // NEW: Proximity Terror
      const human = gs.players[0];
      const dist = Math.abs(p.wx - human.wx);
      
      // If the NPC dies within 150 pixels of the human player
      if (human.status === "alive" && dist < 150) {
        // Flinch camera shake
        gs.camera.shake      = Math.max(gs.camera.shake, 14);
        gs.camera.shakeTimer = Math.max(gs.camera.shakeTimer, 0.4);
        
        // Extra blood splatter exploding near the human
        spawnBlood(gs, human.wx + (Math.random() - 0.5) * 80, human.wy - 20); 
        spawnBlood(gs, human.wx + (Math.random() - 0.5) * 80, human.wy);
        
        // Trigger gasp
        gs.audioEvents.add("crowd_gasp");
      }
    }
  }

  return caught;
}

// ─── Particle Update ──────────────────────────────────────────────────────────

function updateParticles(gs: GameState, dt: number): void {
  const arr = gs.particles;
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.life += dt;
    if (p.life >= p.maxLife) { arr.splice(i, 1); continue; }

    p.x  += p.vx * dt;
    p.y  += p.vy * dt;
    p.vy += (p.type === "dust" ? 20 : 280) * dt;
    p.vx *= p.type === "dust" ? 0.92 : 0.97;
  }
}

// ─── Camera Update ────────────────────────────────────────────────────────────

function updateCamera(gs: GameState, dt: number): void {
  const human = gs.players[0];
  const cam   = gs.camera;

  const targetX = clamp(
    human.wx - DW * CAM_LEAD_X,
    0,
    DOLL_WORLD_X - DW * 0.5
  );
  cam.x = lerp(cam.x, targetX, Math.min(1, dt * CAM_LERP));

  if (cam.shakeTimer > 0) {
    cam.shakeTimer -= dt;
    cam.shake = lerp(cam.shake, 0, Math.min(1, dt * cam.shakeDecay));
  } else {
    cam.shake = 0;
  }
}

// ─── Elimination Sequence ─────────────────────────────────────────────────────

function updateEliminationSequence(gs: GameState, dt: number): void {
  if (gs.phase !== "eliminating") return;

  const human = gs.players[0];
  human.elimTimer += dt;

  switch (gs.elimPhase) {
    case "impact": {
      if (human.elimTimer > 0.12) {
        gs.elimPhase  = "slow_mo";
        gs.slowMoMult = 0.12;
      }
      break;
    }
    case "slow_mo": {
      gs.slowMoMult = lerp(gs.slowMoMult, 0.05, dt * 2);
      human.opacity = lerp(human.opacity, 0.25, dt * 1.8);

      if (human.elimTimer > 0.7) {
        gs.elimPhase  = "showing";
        gs.slowMoMult = 1;
        human.status  = "eliminated";
      }
      break;
    }
    case "showing": {
      if (human.elimTimer > 1.1) {
        gs.phase     = "gameover";
        gs.elimPhase = "none";
      }
      break;
    }
  }
}

function updateDifficulty(gs: GameState): void {
  gs.difficulty   = clamp(1 + gs.elapsed * 0.009,  1, 3.2);
  gs.fakeOutProb  = clamp(0.06 + gs.elapsed * 0.002, 0, 0.35);
  gs.round        = Math.floor(gs.elapsed / 18) + 1;
}

// ─── Particle Spawn Helpers ───────────────────────────────────────────────────

function spawnDust(gs: GameState, wx: number, wy: number, count = 3): void {
  for (let i = 0; i < count; i++) {
    gs.particles.push({
      x: wx, y: wy + PLAYER_H,
      vx: (Math.random() - 0.5) * 60, vy: -(10 + Math.random() * 30),
      life: 0, maxLife: 0.35 + Math.random() * 0.2,
      r: 2 + Math.random() * 3, color: C.dust, type: "dust",
    });
  }
}

function spawnBlood(gs: GameState, wx: number, wy: number): void {
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 40 + Math.random() * 180;
    gs.particles.push({
      x: wx, y: wy + PLAYER_H * 0.4,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 60,
      life: 0, maxLife: 0.6 + Math.random() * 0.5,
      r: 2 + Math.random() * 4, color: C.blood, type: "blood",
    });
  }
}

function spawnSpark(gs: GameState, wx: number, wy: number, count = 6): void {
  for (let i = 0; i < count; i++) {
    gs.particles.push({
      x: wx, y: wy,
      vx: (Math.random() - 0.5) * 220, vy: -(80 + Math.random() * 120),
      life: 0, maxLife: 0.4 + Math.random() * 0.3,
      r: 1.5 + Math.random() * 2.5, color: C.spark, type: "spark",
    });
  }
}

// ─── Master Tick ──────────────────────────────────────────────────────────────

function gameTick(gs: GameState, rawDt: number): void {
  if (gs.phase === "gameover" || gs.phase === "victory") return;

  const dt = rawDt * gs.slowMoMult;
  gs.audioEvents.clear();

  if (gs.phase === "countdown") {
    gs.countdown -= rawDt;
    return;
  }

  gs.elapsed   += rawDt;
  gs.timeLeft  -= rawDt;

  if (gs.timeLeft <= 0) {
    gs.phase = "gameover";
    return;
  }

  updateDifficulty(gs);
  updateLightStateMachine(gs, dt);
  updateEliminationSequence(gs, rawDt);
  updateParticles(gs, dt);
  updateCamera(gs, rawDt);

  let alive = 0;
  for (let i = 0; i < gs.players.length; i++) {
    const p     = gs.players[i];
    const isHum = i === 0;

    if (p.status === "alive" || p.status === "eliminating") {
      updatePlayer(p, gs, dt, isHum);
    }

    if (p.status === "eliminating") {
      p.elimTimer += rawDt;
      p.opacity    = Math.max(0.18, 1 - p.elimTimer * 0.9);
      if (p.elimTimer > 1.2 && !isHum) p.status = "eliminated";
    }

    if (p.status === "alive") {
      checkEliminationForPlayer(p, gs, isHum);
      alive++;
    }
    if (p.status === "finished") alive++;
  }

  gs.aliveCount   = alive;
  gs.playerScore += rawDt * gs.difficulty * 7;
}

// ─── Master Render ────────────────────────────────────────────────────────────

function renderFrame(ctx: CanvasRenderingContext2D, size: CanvasSize, gs: GameState): void {
  const scaleX = size.width  / DW;
  const scaleY = size.height / DH;

  ctx.save();
  ctx.scale(scaleX, scaleY);

  const camX = gs.camera.x +
    (gs.camera.shake > 0 ? (Math.random() - 0.5) * gs.camera.shake : 0);
  const camY = gs.camera.shake > 0
    ? (Math.random() - 0.5) * gs.camera.shake * 0.4
    : 0;

  ctx.clearRect(-2, -2, DW + 4, DH + 4);
  if (camY !== 0) ctx.translate(0, camY);

  drawBackground(ctx, camX, gs);
  drawEnvironmentLighting(ctx, gs);
  drawFinishLine(ctx, camX);
  drawGround(ctx, camX);
  drawParticles(ctx, gs.particles, camX);

  for (let i = gs.players.length - 1; i >= 1; i--) {
    drawPlayer(ctx, gs.players[i], camX, false, gs);
  }
  drawPlayer(ctx, gs.players[0], camX, true, gs);
  drawDoll(ctx, gs.doll, camX, gs);

  if (gs.phase === "playing" || gs.phase === "eliminating") {
    drawHUD(ctx, gs);
  }

  ctx.restore();
}

// ─── Touch Controls Gate (SSR-safe) ───────────────────────────────────────────

function TouchControlsGate({ inputRef }: { inputRef: React.MutableRefObject<any> }) {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const check =
      window.matchMedia("(pointer: coarse)").matches ||
      window.innerWidth < 900 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsTouch(check);
  }, []);

  if (!isTouch) return null;
  return <MobileTouchControls touchStateRef={inputRef} visible={true} />;
}

// ─── React Component ──────────────────────────────────────────────────────────

interface GameProps {
  onExit?: () => void;
}

export default function RedLightGreenLight({ onExit }: GameProps) {
  const [uiPhase,     setUIPhase]     = useState<GameState["phase"]>("countdown");
  const [countdownN,  setCountdownN]  = useState(3);
  const [finalScore,  setFinalScore]  = useState(0);
  const [showElim,    setShowElim]    = useState(false);

  const settingsDiff    = useGameStore((s) => s.settings.difficulty);
  const addScore        = useGameStore((s) => s.addScore);
  const loadFromStorage = useGameStore((s) => s.loadFromStorage);

  const diffNum = settingsDiff === "easy" ? 0.75 : settingsDiff === "hard" ? 1.5 : 1.0;

  const { qualityRef, recordFrame } = useAdaptiveQuality("HIGH");
  const containerRef = useRef<HTMLDivElement>(null);

  const gsRef     = useRef<GameState>(makeGameState(diffNum));
  const canvasRef = useRef<CanvasWrapperHandle>(null);

  const audio     = useGameAudio();

  const inputRef = useRef({ left: false, right: false, jump: false, sprint: false });
  const jumpConsumedRef = useRef(false);

  useEffect(() => { loadFromStorage(); audio.preloadGame(); }, []);

  // ── Key listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowLeft":  case "KeyA":             inputRef.current.left   = true;  break;
        case "ArrowRight": case "KeyD":             inputRef.current.right  = true;  break;
        case "ArrowUp": case "KeyW": case "Space":
          e.preventDefault();
          if (!jumpConsumedRef.current) {
            inputRef.current.jump  = true;
            jumpConsumedRef.current = true;
          }
          break;
        case "ShiftLeft": case "ShiftRight":        inputRef.current.sprint = true;  break;
      }
    };
    const up = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowLeft":  case "KeyA":             inputRef.current.left   = false; break;
        case "ArrowRight": case "KeyD":             inputRef.current.right  = false; break;
        case "ArrowUp": case "KeyW": case "Space":
          inputRef.current.jump   = false;
          jumpConsumedRef.current = false;
          break;
        case "ShiftLeft": case "ShiftRight":        inputRef.current.sprint = false; break;
      }
    };
    window.addEventListener("keydown", dn, { passive: false });
    window.addEventListener("keyup",   up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup",   up);
    };
  }, []);

  // ── Escape → exit to menu ────────────────────────────────────────────────
  useEffect(() => {
    if (!onExit) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        audio.stopHeartbeat();
        onExit();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onExit, audio]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    gsRef.current = makeGameState(diffNum);
    setUIPhase("countdown");
    setCountdownN(3);
    setFinalScore(0);
    setShowElim(false);
    jumpConsumedRef.current = false;
    audio.stopHeartbeat();
  }, [diffNum, audio]);

  // ── Game tick ─────────────────────────────────────────────────────────────
  const prevUIPhase = useRef<GameState["phase"]>("countdown");
  const prevCountdown = useRef(3);
  const hudSync = useHUDSync({ flushInterval: 80 });

  const onTick = useCallback(
    (rawDelta: number) => {
      const handle = canvasRef.current;
      if (!handle) return;
      const ctx  = handle.getContext();
      const size = handle.getSize();
      if (!ctx) return;

      const gs = gsRef.current;

      gs.inputLeft   = inputRef.current.left;
      gs.inputRight  = inputRef.current.right;
      gs.inputSprint = inputRef.current.sprint;
      gs.inputJump   = inputRef.current.jump;

      if (gs.inputJump) inputRef.current.jump = false;
hudSync.write({
  score:    Math.floor(gs.playerScore),
  lives:    gs.aliveCount,         // alive player count doubles as "lives remaining"
  time:     Math.ceil(gs.timeLeft),
  health:   gs.players[0].status === "alive" ? 100 : 0,
  maxHealth: 100,
});
      gameTick(gs, rawDelta);
      renderFrame(ctx, size, gs);

      for (const ev of gs.audioEvents) {
        switch (ev) {
          case "green_light":
            // Play the song and speed it up exactly matching the game difficulty
            SoundManager.getInstance().play("doll_song", 0, gs.difficulty);
            audioEventBus.emit('greenLightActivated');
            break;
          case "warning":     
            audio.onDollTurn();      
            break;
          case "doll_turn":   
            audio.onDollTurn();      
            break;
            // Add these right below case "red_light":
          case "heartbeat_start": 
            SoundManager.getInstance().setHeartbeatIntensity(1.0); 
            break;
          case "heartbeat_stop":  
            SoundManager.getInstance().setHeartbeatIntensity(0.0); 
            break;
          case "crowd_gasp":      
            SoundManager.getInstance().play("crowd_gasp", 0, 0, 1); 
            break;
          case "red_light":
            // Stop the song if it happens to trail off, and play the red light stinger
            SoundManager.getInstance().stopLoop("doll_song", 0);
            SoundManager.getInstance().play("red_light_stinger", 0, 1);
            audioEventBus.emit('redLightActivated');
            break;
          case "step":        audio.onStep();          break;
          case "jump":        audio.onJump();          break;
          case "land":        audio.onLand();          break;
          case "eliminated":
            audio.onEliminated();
            audioEventBus.emit('playerEliminated', 'Player_1');
            break;
          case "victory":     audio.onVictory();       break;
        }
      }

      setShowElim(gs.players[0].status === "eliminated" || gs.players[0].status === "eliminating");

      if (gs.phase !== prevUIPhase.current) {
        prevUIPhase.current = gs.phase;
        setUIPhase(gs.phase);

        if (gs.phase === "gameover") {
          setFinalScore(Math.floor(gs.playerScore));
          setShowElim(gs.players[0].status === "eliminated" || gs.players[0].status === "eliminating");
          addScore(Math.floor(gs.playerScore));
        }
        if (gs.phase === "victory") {
          setFinalScore(Math.floor(gs.playerScore));
          addScore(Math.floor(gs.playerScore));
        }
      }

      if (gs.phase === "countdown") {
        const cn = Math.ceil(gs.countdown);
        if (cn !== prevCountdown.current && cn >= 0) {
          prevCountdown.current = cn;
          setCountdownN(cn);
          if (cn > 0) audio.onCountdownBeep();
          else         audio.onCountdownGo();
        }
        if (gs.countdown <= 0 && prevUIPhase.current === "countdown") {
          gs.phase            = "playing";
          prevUIPhase.current = "playing";
          setUIPhase("playing");
        }
      }
    },
    [audio, addScore,hudSync]
  );

  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    rawCanvasRef.current = canvasRef.current?.getCanvas() ?? null;
  });

  useCanvasScale({
    canvasRef:    rawCanvasRef as React.RefObject<HTMLCanvasElement>,
    containerRef: containerRef as React.RefObject<HTMLElement>,
    qualityRef,
  });

  const { setPaused } = useOptimizedGameLoop(
    {
      update: (dt: number) => { onTick(dt); },
      render: (_alpha: number) => {},
      onVisibilityChange: (visible: boolean) => {
        if (!visible) audio.stopHeartbeat();
      },
    },
    { initialTimeScale: 1, pauseOnHidden: true }
  );

  useSceneCleanup(rawCanvasRef as React.RefObject<HTMLCanvasElement>);

  useEffect(() => {
    setPaused(false);
    return () => {
      setPaused(true);
      audio.stopHeartbeat();
    };
  }, [setPaused, audio]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <CanvasWrapper
        ref={canvasRef}
        designWidth={DW}
        designHeight={DH}
        resizeStrategy="contain"
        enableDPR
        background="#050810"
        ariaLabel="Red Light Green Light"
        canvasId="rlgl-canvas"
        className="w-full h-full"
      />

      {/* ── Persistent BACK TO MENU button ───────────────────────────────── */}
      {onExit && (
        <button
          onClick={() => { audio.stopHeartbeat(); onExit(); }}
          style={{
            position: "absolute", top: 16, left: 16, zIndex: 250,
            padding: "10px 18px",
            background: "rgba(0,0,0,0.65)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 4,
            color: "#fff",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
          aria-label="Back to menu"
        >
          ← MENU (ESC)
        </button>
      )}

      {/* ── Countdown ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {uiPhase === "countdown" && (
          <motion.div
            key={`cd-${countdownN}`}
            initial={{ scale: 2.4, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{   scale: 0.4,  opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              pointerEvents: "none", zIndex: 80,
            }}
          >
            <div style={{
              fontFamily:  "var(--font-display)",
              fontSize:    "clamp(88px, 18vw, 172px)",
              fontWeight:  700,
              lineHeight:  1,
              color:       countdownN > 0 ? "#fff" : C.green,
              textShadow:  `0 0 60px ${countdownN > 0 ? C.warn : C.green}`,
            }}>
              {countdownN > 0 ? countdownN : "GO!"}
            </div>
            {countdownN > 0 && (
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 13,
                color: "rgba(255,255,255,0.5)", letterSpacing: "0.2em",
                marginTop: 16, textTransform: "uppercase",
              }}>
                Get ready…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Elimination vignette ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showElim && uiPhase === "eliminating" && (
          <motion.div
            key="elim-vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0.6, 0] }}
            transition={{ duration: 0.7, times: [0, 0.1, 0.4, 1] }}
            style={{
              position: "absolute", inset: 0,
              pointerEvents: "none", zIndex: 70,
              background: "radial-gradient(ellipse at center, transparent 30%, rgba(220,38,38,0.75) 100%)",
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Game Over ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {uiPhase === "gameover" && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{   opacity: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 28,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(16px)",
              zIndex: 100,
            }}
          >
            <motion.div
              initial={{ y: -28, opacity: 0 }}
              animate={{ y: 0,   opacity: 1 }}
              transition={{ delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ textAlign: "center" }}
            >
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize:   "clamp(44px, 9vw, 88px)",
                fontWeight: 700, letterSpacing: "0.07em",
                color:      showElim ? C.danger : C.warn,
                textShadow: `0 0 48px ${showElim ? C.danger : C.warn}`,
                textTransform: "uppercase",
              }}>
                {showElim ? "ELIMINATED" : "TIME'S UP"}
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1   }}
                transition={{ delay: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 32,
                  color: "#fff", marginTop: 14, letterSpacing: "0.06em",
                }}
              >
                {finalScore.toLocaleString("en-US")}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  color: C.muted, marginTop: 6, letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {showElim ? "You moved during red light" : "Finish line not reached"}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0  }}
              transition={{ delay: 0.75 }}
              style={{ display: "flex", gap: 16 }}
            >
              <OverlayBtn label="TRY AGAIN" accent onClick={resetGame} />
              {onExit && <OverlayBtn label="← MENU" onClick={onExit} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Victory ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {uiPhase === "victory" && (
          <motion.div
            key="victory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{   opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 28,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(14px)",
              zIndex: 100,
            }}
          >
            <motion.div
              initial={{ scale: 0.65, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              transition={{ delay: 0.1, ease: [0.34, 1.56, 0.64, 1], duration: 0.6 }}
              style={{ textAlign: "center" }}
            >
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize:   "clamp(44px, 9vw, 88px)",
                fontWeight: 700, letterSpacing: "0.07em",
                color:      C.green,
                textShadow: `0 0 48px ${C.green}`,
                textTransform: "uppercase",
              }}>
                YOU SURVIVED
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 32,
                  color: C.warn, marginTop: 14, letterSpacing: "0.06em",
                  textShadow: `0 0 20px ${C.warn}`,
                }}
              >
                {finalScore.toLocaleString("en-US")}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0  }}
              transition={{ delay: 0.65 }}
              style={{ display: "flex", gap: 16 }}
            >
              <OverlayBtn label="PLAY AGAIN" accent onClick={resetGame} />
              {onExit && <OverlayBtn label="← MENU" onClick={onExit} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile Touch Controls (SSR-safe) ──────────────────────────────── */}
      <TouchControlsGate inputRef={inputRef} />
    </div>
  );
}

// ─── Overlay Button ───────────────────────────────────────────────────────────

function OverlayBtn({
  label, accent = false, onClick,
}: {
  label: string; accent?: boolean; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const col = accent ? "var(--color-accent)" : "rgba(255,255,255,0.48)";
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:    "13px 40px",
        background: hov ? (accent ? "var(--color-accent)" : "rgba(255,255,255,0.09)") : "transparent",
        border:     `1.5px solid ${col}`,
        borderRadius: 5, cursor: "pointer",
        fontFamily: "var(--font-display)", fontSize: 17,
        fontWeight: 700, letterSpacing: "0.14em",
        color:      hov && accent ? "#000" : col,
        textTransform: "uppercase",
        transition: "all 0.17s",
        boxShadow:  hov && accent ? `0 0 28px var(--color-accent-dim)` : "none",
      }}
    >
      {label}
    </button>
  );
}