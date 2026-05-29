"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameShellBridge } from "@/components/GameShell";
import { useHUDSync } from "@/components/hud/useHUDSync";

interface GameProps {
  onExit?: () => void;
}

// ============================================================
// 1. CONSTANTS & PALETTE
// ============================================================

const WORLD_W = 1280;
const WORLD_H = 720;

const TOTAL_ROWS = 18;
const PANEL_W = 180;
const PANEL_H = 80;
const PANEL_GAP_X = 24;
const PANEL_GAP_Y = 36;
const BRIDGE_X_LEFT = WORLD_W / 2 - PANEL_W - PANEL_GAP_X / 2;
const BRIDGE_X_RIGHT = WORLD_W / 2 + PANEL_GAP_X / 2;
const ROW_0_Y = WORLD_H * 0.85; 

const JUMP_DURATION = 0.38; 
const JUMP_HEIGHT = 60; 
const FALL_GRAVITY = 1800; 
const SLOW_MO_SCALE = 0.08;
const SLOW_MO_RESTORE_DELAY = 0.9; 

const SHAKE_SHATTER = 14;
const SHAKE_DECAY_RATE = 0.88;

const PLAYER_W = 52;
const PLAYER_H = 76;

const SAFE_BLUE: [number, number, number] = [3, 135, 121]; // Clinical Teal
const FRAGILE_BLUE: [number, number, number] = [180, 210, 220]; // Thin, cheap glass
const VOID_COLOR = "#050810";

const CAMERA_LERP = 5;
const CAMERA_ROW_OFFSET = 2.5; 

const COUNTDOWN_TOTAL = 120; 

// ============================================================
// 2. TYPES
// ============================================================

interface Panel {
  row: number;
  col: 0 | 1;
  safe: boolean;
  state: "intact" | "cracking" | "shattered" | "gone";
  crackTimer: number; 
  glintTimer: number;
  glintPhase: number; 
  glintPhase2: number; 
  wobbleAmp: number;
  wobblePhase: number;
  reflectionAlpha: number;
  flashAlpha: number;
}

interface PlayerState {
  row: number; 
  col: 0 | 1 | null; 
  worldY: number; 
  jumpT: number; 
  jumping: boolean;
  targetRow: number;
  targetCol: 0 | 1;
  startY: number;
  facing: -1 | 1;
  status: "alive" | "falling" | "finished";
  fallY: number;
  fallVy: number;
  screenShakeX: number;
  screenShakeY: number;
  walkBob: number;
  walkBobDir: number;
}

interface CameraState {
  y: number;
  targetY: number;
  shake: number;
  shakeTimer: number;
  shakeDecay: number;
  zoom: number;
  targetZoom: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; 
  decay: number;
  r: number;
  g: number;
  b: number;
  size: number;
  active: boolean;
}

type Phase = "intro" | "playing" | "falling" | "gameover" | "victory" | "transitioning";
type ElimPhase = "none" | "shatter" | "slow_fall" | "showing";

interface GameState {
  phase: Phase;
  elimPhase: ElimPhase;
  elimTimer: number;
  panels: Panel[][];
  currentRow: number;
  totalRows: number;
  player: PlayerState;
  camera: CameraState;
  timeLeft: number;
  elapsed: number;
  slowMoMult: number;
  particles: Particle[];
  audioEvents: Set<string>;
  atmosphericT: number;
  vignetteIntensity: number;
  vignetteTarget: number;
  flashAlpha: number;
  fadeAlpha: number;
  inputConsumed: boolean;
  seed: number;
  ambientDripTimer: number;
  lateGameZoomActive: boolean;
}

// ============================================================
// 3. OBJECT POOL
// ============================================================

class ObjectPool<T extends { active: boolean }> {
  private pool: T[];
  private factory: () => T;
  private _available: number;

  constructor(size: number, factory: () => T) {
    this.factory = factory;
    this.pool = Array.from({ length: size }, factory);
    this._available = size;
  }

  acquire(): T | null {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].active = true;
        this._available--;
        return this.pool[i];
      }
    }
    return null;
  }

  release(obj: T): void {
    obj.active = false;
    this._available++;
  }

  get availableCount(): number {
    return this._available;
  }
}

// ============================================================
// 4. SEEDED RANDOM (xorshift32)
// ============================================================

function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return {
    next(): number {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      return ((s >>> 0) / 4294967296);
    },
  };
}

// ============================================================
// 5. PURE UTILITIES
// ============================================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function jumpArc(startY: number, targetY: number, t: number): number {
  return lerp(startY, targetY, t) - Math.sin(t * Math.PI) * JUMP_HEIGHT;
}

function rowWorldY(row: number): number {
  return ROW_0_Y - row * (PANEL_H + PANEL_GAP_Y);
}

function colWorldX(col: 0 | 1): number {
  return col === 0 ? BRIDGE_X_LEFT : BRIDGE_X_RIGHT;
}

function rgb(r: number, g: number, b: number, a = 1): string {
  return `rgba(${r|0},${g|0},${b|0},${a})`;
}

// ============================================================
// 6. BRIDGE GENERATOR
// ============================================================

function generateBridge(rows: number, seed: number): Panel[][] {
  const rng = makeRng(seed);
  const panels: Panel[][] = [];

  for (let row = 1; row <= rows; row++) {
    const safeCol = rng.next() < 0.5 ? 0 : 1;
    const rowPanels: Panel[] = [];

    for (let col = 0 as 0 | 1; col <= 1; col++) {
      const isSafe = col === safeCol;
      const glintBase = rng.next() * Math.PI * 2;

      rowPanels.push({
        row,
        col,
        safe: isSafe,
        state: "intact",
        crackTimer: 0,
        glintTimer: glintBase,
        glintPhase: isSafe ? 0.6 + rng.next() * 0.3 : 0.9 + rng.next() * 0.4,
        glintPhase2: 0.7 + rng.next() * 0.5,
        wobbleAmp: isSafe ? 0.8 + rng.next() * 0.4 : 1.4 + rng.next() * 0.8,
        wobblePhase: rng.next() * Math.PI * 2,
        reflectionAlpha: isSafe ? 0.18 + rng.next() * 0.08 : 0.06 + rng.next() * 0.06,
        flashAlpha: 0,
      });
    }

    panels.push(rowPanels);
  }

  return panels;
}

// ============================================================
// 7. BAKED ASSET INITIALIZER
// ============================================================

interface BakedAssets {
  background: HTMLCanvasElement | OffscreenCanvas;
  crackStages: Array<HTMLCanvasElement | OffscreenCanvas>;
  safeReflection: HTMLCanvasElement | OffscreenCanvas;
  fragileReflection: HTMLCanvasElement | OffscreenCanvas;
  vignetteCanvas: HTMLCanvasElement | OffscreenCanvas;
}

function createOffscreen(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function getCtx2d(c: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D {
  return c.getContext("2d") as CanvasRenderingContext2D;
}

function bakeBackground(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  const c = createOffscreen(w, h);
  const ctx = getCtx2d(c);

  // Deep, terrifying abyss gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#02070d"); // Near ceiling
  grad.addColorStop(0.4, "#030d1a"); // Bridge level
  grad.addColorStop(0.8, "#010308"); // Deep fall
  grad.addColorStop(1, "#000000");   // Abyss
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Volumetric Fog Layers (Cinematic Depth)
  for (let i = 0; i < 4; i++) {
    const yPos = h * (0.3 + i * 0.25);
    const bandGrad = ctx.createRadialGradient(w / 2, yPos, 0, w / 2, yPos, w * 0.8);
    bandGrad.addColorStop(0, `rgba(3, 135, 121, ${0.06 - i * 0.01})`); // Brand Teal Fog
    bandGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // Suspended structural cables in the deep background
  ctx.strokeStyle = "rgba(255,255,255,0.02)";
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() * 40 - 20), h);
    ctx.stroke();
  }

  return c;
}

function bakeCrackStages(w: number, h: number): Array<HTMLCanvasElement | OffscreenCanvas> {
  return [0.25, 0.5, 0.75, 1.0].map((progress) => {
    const c = createOffscreen(w, h);
    const ctx = getCtx2d(c);
    const cx = w / 2;
    const cy = h / 2;
    const count = Math.ceil(6 * progress);

    ctx.strokeStyle = `rgba(255,255,255,${0.3 + progress * 0.5})`;
    ctx.lineWidth = 1 + progress * 1.5;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const len = (30 + i * 15) * progress;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.stroke();

      if (progress > 0.5) {
        const branchAngle = angle + (Math.random() - 0.5) * 0.6;
        const branchStart = len * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * branchStart, cy + Math.sin(angle) * branchStart);
        ctx.lineTo(cx + Math.cos(branchAngle) * (branchStart + len * 0.4), cy + Math.sin(branchAngle) * (branchStart + len * 0.4));
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.lineWidth = 1 + progress * 1.5;
      }
    }
    return c;
  });
}

function bakeReflection(w: number, h: number, isSafe: boolean): HTMLCanvasElement | OffscreenCanvas {
  const c = createOffscreen(w, h);
  const ctx = getCtx2d(c);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (isSafe) {
    grad.addColorStop(0, "rgba(180,220,255,0.22)");
    grad.addColorStop(0.4, "rgba(120,185,255,0.14)");
    grad.addColorStop(1, "rgba(60,120,220,0.04)");
  } else {
    grad.addColorStop(0, "rgba(140,190,160,0.12)");
    grad.addColorStop(0.4, "rgba(100,155,130,0.08)");
    grad.addColorStop(1, "rgba(50,100,80,0.02)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function bakeVignette(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  const c = createOffscreen(w, h);
  const ctx = getCtx2d(c);
  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, w * 0.8);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.6, "rgba(0,0,0,0.3)");
  grad.addColorStop(1, "rgba(0,4,12,0.92)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function initBakedAssets(): BakedAssets {
  return {
    background: bakeBackground(WORLD_W, WORLD_H),
    crackStages: bakeCrackStages(PANEL_W, PANEL_H),
    safeReflection: bakeReflection(PANEL_W, PANEL_H, true),
    fragileReflection: bakeReflection(PANEL_W, PANEL_H, false),
    vignetteCanvas: bakeVignette(WORLD_W, WORLD_H),
  };
}

// ============================================================
// 8. PARTICLE EMITTER
// ============================================================

let particlePool: ObjectPool<Particle> | null = null;

function getPool(): ObjectPool<Particle> {
  if (!particlePool) {
    particlePool = new ObjectPool<Particle>(256, () => ({
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, decay: 0, r: 255, g: 255, b: 255,
      size: 4, active: false,
    }));
  }
  return particlePool;
}

interface BurstOptions {
  x: number; y: number; count: number; r: number; g: number; b: number;
  speed: number; decay: number; sizeMin?: number; sizeMax?: number; upwardBias?: number;
}

function emitBurst(gs: GameState, opts: BurstOptions): void {
  const pool = getPool();
  for (let i = 0; i < opts.count; i++) {
    if (pool.availableCount <= 0) break;
    const p = pool.acquire();
    if (!p) break;

    const angle = Math.random() * Math.PI * 2;
    const speed = opts.speed * (0.4 + Math.random() * 0.8);
    const upBias = opts.upwardBias ?? 0;

    p.x = opts.x + (Math.random() - 0.5) * 20;
    p.y = opts.y + (Math.random() - 0.5) * 10;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - upBias * speed;
    p.life = 1;
    p.decay = opts.decay * (0.7 + Math.random() * 0.6);
    p.r = opts.r;
    p.g = opts.g;
    p.b = opts.b;
    p.size = (opts.sizeMin ?? 2) + Math.random() * ((opts.sizeMax ?? 6) - (opts.sizeMin ?? 2));
    gs.particles.push(p);
  }
}

function updateParticles(gs: GameState, dtSec: number): void {
  const pool = getPool();
  let i = gs.particles.length;
  while (i--) {
    const p = gs.particles[i];
    p.vy += 400 * dtSec;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.life -= p.decay * dtSec;

    if (p.life <= 0) {
      pool.release(p);
      gs.particles[i] = gs.particles[gs.particles.length - 1];
      gs.particles.length--;
    }
  }
}

function updateCamera(gs: GameState, dtSec: number): void {
  const cam = gs.camera;
  const playerWorldY = gs.player.worldY;
  cam.targetY = playerWorldY - WORLD_H * 0.55 + CAMERA_ROW_OFFSET * (PANEL_H + PANEL_GAP_Y);

  if (gs.player.status === "falling") {
    cam.y = cam.targetY;
  } else {
    cam.y = lerp(cam.y, cam.targetY, clamp(CAMERA_LERP * dtSec, 0, 1));
  }

  if (cam.shake > 0.01) {
    cam.shake *= cam.shakeDecay;
  } else {
    cam.shake = 0;
  }

  const progress = gs.currentRow / gs.totalRows;
  cam.targetZoom = progress > 0.7 ? 1 + (progress - 0.7) * 0.3 : 1;
  cam.zoom = lerp(cam.zoom, cam.targetZoom, dtSec * 1.5);
}

function applyShake(ctx: CanvasRenderingContext2D, cam: CameraState): void {
  if (cam.shake > 0.1) {
    const sx = (Math.random() - 0.5) * 2 * cam.shake;
    const sy = (Math.random() - 0.5) * cam.shake * 0.6;
    ctx.translate(sx, sy);
  }
}

function startJump(gs: GameState, targetCol: 0 | 1): void {
  if (gs.player.jumping || gs.player.status !== "alive") return;
  if (gs.phase !== "playing") return;

  const targetRow = gs.player.row + 1;
  if (targetRow > gs.totalRows) return;

  gs.player.jumping = true;
  gs.player.targetRow = targetRow;
  gs.player.targetCol = targetCol;
  gs.player.jumpT = 0;
  gs.player.startY = gs.player.worldY;
  gs.player.facing = targetCol === 0 ? -1 : 1;
  gs.inputConsumed = true;
}

function triggerElimination(gs: GameState): void {
  gs.phase = "falling";
  gs.elimPhase = "shatter";
  gs.elimTimer = 0;
  gs.player.status = "falling";
  gs.player.fallY = gs.player.worldY;
  gs.player.fallVy = 0;
  gs.slowMoMult = SLOW_MO_SCALE;
  gs.camera.shake = SHAKE_SHATTER;
  gs.camera.shakeDecay = SHAKE_DECAY_RATE;
  gs.vignetteTarget = 1;
  gs.flashAlpha = 1;
  gs.audioEvents.add("shatter");
}

function triggerVictory(gs: GameState): void {
  gs.phase = "victory";
  gs.player.status = "finished";
  gs.player.col = null;
  gs.audioEvents.add("victory");
}

function updatePlayer(gs: GameState, dtSec: number): void {
  const p = gs.player;

  if (p.status === "falling") {
    const scaled = dtSec;
    p.fallVy += FALL_GRAVITY * scaled;
    p.fallY += p.fallVy * scaled;
    p.worldY = p.fallY;
    return;
  }

  if (!p.jumping) {
    p.walkBob += dtSec * 3;
    return;
  }

  p.jumpT = clamp(p.jumpT + dtSec / JUMP_DURATION, 0, 1);
  const targetY = rowWorldY(p.targetRow);
  p.worldY = jumpArc(p.startY, targetY, p.jumpT);

  if (p.jumpT >= 1) {
    p.row = p.targetRow;
    p.col = p.targetCol;
    p.worldY = targetY;
    p.jumping = false;
    gs.currentRow = p.row;
    gs.inputConsumed = false;

    if (p.row > gs.totalRows) {
      triggerVictory(gs);
      return;
    }

    const panel = gs.panels[p.row - 1]?.[p.col];
    if (!panel) {
      triggerVictory(gs);
      return;
    }

    if (!panel.safe) {
      triggerElimination(gs);
      const px = colWorldX(p.col) + PANEL_W / 2;
      const py = rowWorldY(p.row) + PANEL_H / 2;
      emitBurst(gs, { x: px, y: py, count: 32, r: 140, g: 200, b: 255, speed: 320, decay: 1.8, sizeMin: 2, sizeMax: 8, upwardBias: 0.4 });
      emitBurst(gs, { x: px, y: py, count: 18, r: 80, g: 140, b: 200, speed: 160, decay: 2.4, sizeMin: 1, sizeMax: 4 });
      panel.state = "shattered";
    } else {
      panel.state = "cracking";
      panel.crackTimer = 0;
      const px = colWorldX(p.col) + PANEL_W / 2;
      const py = rowWorldY(p.row) + PANEL_H / 2;
      emitBurst(gs, { x: px, y: py, count: 6, r: 160, g: 210, b: 255, speed: 80, decay: 3, sizeMin: 1, sizeMax: 3, upwardBias: 0.2 });
      if (p.row >= gs.totalRows) {
        triggerVictory(gs);
      }
    }
  }
}

function updatePanels(gs: GameState, dtSec: number): void {
  const rowMin = Math.max(0, gs.currentRow - 1);
  const rowMax = Math.min(gs.totalRows - 1, gs.currentRow + 3);

  for (let r = rowMin; r <= rowMax; r++) {
    const row = gs.panels[r];
    if (!row) continue;
    for (let c = 0; c < 2; c++) {
      const panel = row[c];
      panel.glintTimer += dtSec * panel.glintPhase;
      panel.flashAlpha = Math.max(0, panel.flashAlpha - dtSec * 3);

      if (panel.state === "cracking") {
        panel.crackTimer += dtSec * 4;
        if (panel.crackTimer > 1) {
          panel.state = "intact";
          panel.crackTimer = 0;
        }
      }
    }
  }
}

function updateElimination(gs: GameState, dtSec: number): void {
  gs.elimTimer += dtSec;
  gs.flashAlpha = Math.max(0, gs.flashAlpha - dtSec * 4);

  switch (gs.elimPhase) {
    case "shatter":
      if (gs.elimTimer >= 0.2) {
        gs.elimPhase = "slow_fall";
        gs.elimTimer = 0;
      }
      break;
    case "slow_fall":
      if (gs.elimTimer >= SLOW_MO_RESTORE_DELAY) {
        gs.elimPhase = "showing";
        gs.elimTimer = 0;
        gs.slowMoMult = 1;
        gs.vignetteTarget = 0.3;
      }
      break;
    case "showing":
      gs.fadeAlpha = clamp(gs.elimTimer / 0.4, 0, 1);
      if (gs.elimTimer >= 0.6) gs.phase = "gameover";
      break;
  }
}

function updateAtmosphere(gs: GameState, dtSec: number): void {
  gs.atmosphericT += dtSec * 0.4;
  gs.vignetteIntensity = lerp(gs.vignetteIntensity, gs.vignetteTarget, dtSec * 3);

  if (gs.phase === "playing" && getPool().availableCount > 10) {
    gs.ambientDripTimer -= dtSec;
    if (gs.ambientDripTimer <= 0) {
      gs.ambientDripTimer = 0.8 + Math.random() * 0.6;
      const rx = BRIDGE_X_LEFT + Math.random() * (BRIDGE_X_RIGHT + PANEL_W - BRIDGE_X_LEFT);
      const ry = rowWorldY(gs.currentRow) - (Math.random() * 200 + 50);
      emitBurst(gs, { x: rx, y: ry, count: 2, r: 60, g: 90, b: 140, speed: 40, decay: 1.2, sizeMin: 1, sizeMax: 2.5, upwardBias: -0.5 });
    }
  }

  if (gs.phase === "playing") {
    gs.timeLeft -= dtSec;
    if (gs.timeLeft <= 0) {
      gs.timeLeft = 0;
      if (gs.player.status === "alive") triggerElimination(gs);
    }
    if (gs.timeLeft < 20) {
      gs.vignetteTarget = Math.max(gs.vignetteTarget, 0.3 + (20 - gs.timeLeft) / 20 * 0.4);
    }
  }
}

function gameTick(gs: GameState, dtSec: number, inputRef: React.MutableRefObject<TouchState>): void {
  if (gs.phase === "gameover" || gs.phase === "victory" || gs.phase === "intro") return;

  const scaled = dtSec * gs.slowMoMult;

  if (!gs.inputConsumed && !gs.player.jumping && gs.player.status === "alive") {
    if (inputRef.current.left) startJump(gs, 0);
    else if (inputRef.current.right) startJump(gs, 1);
  }

  inputRef.current.left = false;
  inputRef.current.right = false;

  updatePanels(gs, scaled);
  updatePlayer(gs, scaled);
  updateCamera(gs, scaled);
  updateParticles(gs, scaled);
  updateAtmosphere(gs, dtSec);

  if (gs.phase === "falling") updateElimination(gs, dtSec);
  gs.elapsed += dtSec;
}

function renderPanel(
  ctx: CanvasRenderingContext2D,
  panel: Panel,
  camY: number,
  assets: BakedAssets,
  atmosphericT: number,
  isPlayerOn: boolean,
  quality: "high" | "low"
): void {
  const wx = colWorldX(panel.col);
  const wy = rowWorldY(panel.row) - camY;

  if (wy < -PANEL_H - 20 || wy > WORLD_H + 20) return;

  const wobble = Math.sin(atmosphericT * 1.2 + panel.wobblePhase) * panel.wobbleAmp * 0.3;

  ctx.save();
  ctx.translate(wx, wy + wobble);

  switch (panel.state) {
    case "gone": ctx.restore(); return;
    case "shattered":
      ctx.fillStyle = "rgba(0,4,12,0.9)";
      ctx.fillRect(0, 0, PANEL_W, PANEL_H);
      ctx.strokeStyle = "rgba(80,140,220,0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, PANEL_W, PANEL_H);
      ctx.restore();
      return;
  }

  const [br, bg, bb] = panel.safe ? SAFE_BLUE : FRAGILE_BLUE;
  const baseAlpha = 0.18 + Math.sin(atmosphericT * 0.7 + panel.wobblePhase) * 0.04;

  ctx.fillStyle = rgb(br, bg, bb, baseAlpha);
  ctx.fillRect(0, 0, PANEL_W, PANEL_H);

  const refCanvas = panel.safe ? assets.safeReflection : assets.fragileReflection;
  ctx.globalAlpha = panel.reflectionAlpha + Math.sin(panel.glintTimer) * 0.04;
  ctx.drawImage(refCanvas as CanvasImageSource, 0, 0, PANEL_W, PANEL_H);
  ctx.globalAlpha = 1;

  const glint1 = (Math.sin(panel.glintTimer * panel.glintPhase) + 1) * 0.5;
  let glintVal: number;
  if (panel.safe) {
    glintVal = glint1 * 0.25;
  } else {
    const glint2 = (Math.sin(panel.glintTimer * panel.glintPhase2 + 1.7) + 1) * 0.5;
    glintVal = (glint1 * 0.6 + glint2 * 0.4) * 0.18;
    if (glint2 > 0.8) {
      ctx.fillStyle = `rgba(180,220,180,${(glint2 - 0.8) * 0.15})`;
      const shimX = PANEL_W * 0.3 + glint2 * PANEL_W * 0.4;
      ctx.fillRect(shimX, 0, 3, PANEL_H);
    }
  }
  ctx.fillStyle = `rgba(220,240,255,${glintVal})`;
  ctx.fillRect(0, 0, PANEL_W, PANEL_H);

  const borderAlpha = isPlayerOn ? 0.7 : 0.25 + glintVal * 0.3;
  ctx.strokeStyle = rgb(br, bg + 20, bb + 20, borderAlpha);
  ctx.lineWidth = isPlayerOn ? 2.5 : 1.5;
  ctx.strokeRect(0.75, 0.75, PANEL_W - 1.5, PANEL_H - 1.5);

  ctx.strokeStyle = rgb(255, 255, 255, 0.08 + glintVal * 0.15);
  ctx.lineWidth = 1;
  ctx.strokeRect(3, 3, PANEL_W - 6, PANEL_H - 6);

  if (isPlayerOn && quality === "high") {
    ctx.shadowColor = rgb(br, bg, bb, 0.8);
    ctx.shadowBlur = 18;
    ctx.strokeStyle = rgb(br, bg, bb, 0.6);
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, PANEL_W, PANEL_H);
    ctx.shadowBlur = 0;
  }

  if (panel.state === "cracking" && panel.crackTimer > 0) {
    const stage = Math.min(3, Math.floor(panel.crackTimer * 4));
    const crackCanvas = assets.crackStages[stage];
    ctx.globalAlpha = panel.crackTimer;
    ctx.drawImage(crackCanvas as CanvasImageSource, 0, 0, PANEL_W, PANEL_H);
    ctx.globalAlpha = 1;
  }

  if (panel.flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${panel.flashAlpha})`;
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
  }

  ctx.restore();
}

function renderPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  camY: number,
  atmosphericT: number
): void {
  const screenX = colWorldX(player.col ?? (player.targetCol ?? 0));
  const screenY = player.worldY - camY;

  ctx.save();
  ctx.translate(screenX + PANEL_W / 2, screenY + PANEL_H / 2);
  ctx.scale(player.facing, 1);

  const bob = player.jumping ? 0 : Math.sin(player.walkBob * 2) * 1.5;
  const py = bob;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.ellipse(0, PLAYER_H * 0.45, PLAYER_W * 0.35, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0a1628";
  ctx.fillRect(-PLAYER_W / 2 + 6, py - PLAYER_H * 0.2, PLAYER_W - 12, PLAYER_H * 0.55);

  ctx.fillStyle = "#1a8a7a";
  ctx.fillRect(-PLAYER_W / 2 + 9, py - PLAYER_H * 0.15, PLAYER_W - 18, PLAYER_H * 0.45);

  ctx.fillStyle = "#0a1628";
  ctx.fillRect(-10, py - PLAYER_H * 0.02, 20, 18);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("456", 0, py + 12);

  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.ellipse(0, py - PLAYER_H * 0.32, PLAYER_W * 0.22, PLAYER_H * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  const breathe = Math.sin(atmosphericT * 1.8) * 0.05;
  ctx.fillStyle = `rgba(80,200,240,${0.25 + breathe})`;
  ctx.beginPath();
  ctx.ellipse(3, py - PLAYER_H * 0.34, PLAYER_W * 0.14, PLAYER_H * 0.1, 0.2, 0, Math.PI * 2);
  ctx.fill();

  const legSwing = player.jumping ? Math.sin(player.jumpT * Math.PI) * 12 : 0;
  ctx.fillStyle = "#0a1628";
  ctx.fillRect(-PLAYER_W / 2 + 9, py + PLAYER_H * 0.32, PLAYER_W * 0.3, PLAYER_H * 0.15);
  ctx.fillRect(PLAYER_W * 0.04, py + PLAYER_H * 0.32 + legSwing, PLAYER_W * 0.3, PLAYER_H * 0.15);

  ctx.restore();
}

function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[], camY: number): void {
  if (particles.length === 0) return;
  ctx.save();
  for (const p of particles) {
    if (!p.active) continue;
    const alpha = p.life * p.life;
    ctx.fillStyle = rgb(p.r, p.g, p.b, alpha);
    ctx.fillRect(p.x - p.size / 2, p.y - camY - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function renderHUD(ctx: CanvasRenderingContext2D, gs: GameState): void {
  const progress = gs.currentRow / gs.totalRows;
  const timeLeft = gs.timeLeft;
  const isLow = timeLeft < 20;

  ctx.fillStyle = "rgba(0,4,12,0.7)";
  ctx.fillRect(0, 0, WORLD_W, 52);

  ctx.fillStyle = "rgba(140,200,255,0.9)";
  ctx.font = "bold 16px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`PANEL  ${gs.currentRow} / ${gs.totalRows}`, 28, 30);

  const mins = Math.floor(timeLeft / 60);
  const secs = Math.floor(timeLeft % 60).toString().padStart(2, "0");
  ctx.fillStyle = isLow ? `rgba(255,${60 + Math.sin(gs.atmosphericT * 8) * 60},60,0.95)` : "rgba(200,230,255,0.8)";
  ctx.font = `bold ${isLow ? 22 : 18}px 'Courier New', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${mins}:${secs}`, WORLD_W / 2, 32);

  const barW = 240;
  const barX = WORLD_W - barW - 28;
  ctx.fillStyle = "rgba(20,40,80,0.6)";
  ctx.fillRect(barX, 14, barW, 10);
  ctx.fillStyle = `rgba(80,180,255,${0.7 + progress * 0.3})`;
  ctx.fillRect(barX, 14, barW * progress, 10);
  ctx.strokeStyle = "rgba(80,140,220,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, 14, barW, 10);

  ctx.fillStyle = "rgba(140,190,240,0.7)";
  ctx.font = "11px 'Courier New', monospace";
  ctx.textAlign = "right";
  ctx.fillText("PROGRESS", WORLD_W - 28, 11);

  if (gs.currentRow === 0 && gs.elapsed < 5) {
    const alpha = clamp(1 - (gs.elapsed - 3) / 2, 0, 1);
    ctx.fillStyle = `rgba(180,220,255,${alpha * 0.8})`;
    ctx.font = "14px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("← LEFT / RIGHT → TO CHOOSE", WORLD_W / 2, WORLD_H - 80);
  }
}

function renderOverlays(ctx: CanvasRenderingContext2D, gs: GameState, assets: BakedAssets): void {
  if (gs.vignetteIntensity > 0.01) {
    ctx.globalAlpha = gs.vignetteIntensity;
    ctx.drawImage(assets.vignetteCanvas as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);
    ctx.globalAlpha = 1;
  }
  if (gs.flashAlpha > 0) {
    ctx.fillStyle = `rgba(180,230,255,${gs.flashAlpha * 0.6})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  if (gs.fadeAlpha > 0) {
    ctx.fillStyle = `rgba(0,2,8,${gs.fadeAlpha})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  const breatheA = (Math.sin(gs.atmosphericT * 0.6) + 1) * 0.5 * 0.025;
  ctx.fillStyle = `rgba(10,30,70,${breatheA})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

function renderFrame(ctx: CanvasRenderingContext2D, gs: GameState, assets: BakedAssets, quality: "high" | "low"): void {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  ctx.drawImage(assets.background as CanvasImageSource, 0, 0, WORLD_W, WORLD_H);

  const cam = gs.camera;
  const camY = cam.y;

  ctx.save();
  if (cam.zoom !== 1) {
    ctx.translate(WORLD_W / 2, WORLD_H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-WORLD_W / 2, -WORLD_H / 2);
  }
  applyShake(ctx, cam);

  const startPlatformY = rowWorldY(0) - camY;
  const endPlatformY = rowWorldY(gs.totalRows + 1) - camY;

  ctx.fillStyle = "rgba(20,50,100,0.6)";
  ctx.fillRect(WORLD_W / 2 - 160, startPlatformY, 320, 30);
  ctx.strokeStyle = "rgba(80,140,220,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(WORLD_W / 2 - 160, startPlatformY, 320, 30);

  ctx.fillStyle = "rgba(20,80,60,0.6)";
  ctx.fillRect(WORLD_W / 2 - 160, endPlatformY, 320, 30);
  ctx.strokeStyle = "rgba(80,200,140,0.4)";
  ctx.strokeRect(WORLD_W / 2 - 160, endPlatformY, 320, 30);

  ctx.strokeStyle = "rgba(60,90,140,0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 16]);
  ctx.beginPath();
  ctx.moveTo(WORLD_W / 2 - PANEL_W - PANEL_GAP_X * 0.5, endPlatformY);
  ctx.lineTo(WORLD_W / 2 - PANEL_W - PANEL_GAP_X * 0.5, startPlatformY + 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(WORLD_W / 2 + PANEL_W + PANEL_GAP_X * 0.5, endPlatformY);
  ctx.lineTo(WORLD_W / 2 + PANEL_W + PANEL_GAP_X * 0.5, startPlatformY + 30);
  ctx.stroke();
  ctx.setLineDash([]);

  const rowMin = Math.max(1, gs.currentRow - 1);
  const rowMax = Math.min(gs.totalRows, gs.currentRow + 5);

  for (let r = rowMin; r <= rowMax; r++) {
    const rowPanels = gs.panels[r - 1];
    if (!rowPanels) continue;
    for (const panel of rowPanels) {
      const isPlayerOn = gs.player.row === r && gs.player.col === panel.col && !gs.player.jumping;
      renderPanel(ctx, panel, camY, assets, gs.atmosphericT, isPlayerOn, quality);
    }
  }

  if (gs.player.status !== "finished") renderPlayer(ctx, gs.player, camY, gs.atmosphericT);
  renderParticles(ctx, gs.particles, camY);
  ctx.restore(); 

  if (gs.phase === "playing" || gs.phase === "falling") renderHUD(ctx, gs);
  renderOverlays(ctx, gs, assets);
}

// ============================================================
// 21. TOUCH STATE
// ============================================================

interface TouchState {
  left: boolean;
  right: boolean;
}

function createGameState(seed: number): GameState {
  const startY = rowWorldY(0);
  return {
    phase: "playing", elimPhase: "none", elimTimer: 0,
    panels: generateBridge(TOTAL_ROWS, seed),
    currentRow: 0, totalRows: TOTAL_ROWS,
    player: {
      row: 0, col: null, worldY: startY, jumpT: 0, jumping: false, targetRow: 1, targetCol: 0,
      startY, facing: 1, status: "alive", fallY: 0, fallVy: 0, screenShakeX: 0, screenShakeY: 0, walkBob: 0, walkBobDir: 1,
    },
    camera: { y: startY - WORLD_H * 0.5, targetY: startY - WORLD_H * 0.5, shake: 0, shakeTimer: 0, shakeDecay: SHAKE_DECAY_RATE, zoom: 1, targetZoom: 1 },
    timeLeft: COUNTDOWN_TOTAL, elapsed: 0, slowMoMult: 1, particles: [], audioEvents: new Set(),
    atmosphericT: 0, vignetteIntensity: 0.15, vignetteTarget: 0.15, flashAlpha: 0, fadeAlpha: 0, inputConsumed: false, seed, ambientDripTimer: 1, lateGameZoomActive: false,
  };
}

// ============================================================
// 23. GAME LOOP HOOK
// ============================================================

function useGameLoop(callback: (dt: number) => void, active: boolean): React.MutableRefObject<((scale: number) => void) | null> {
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const scaleRef = useRef<((s: number) => void) | null>(null);
  const scaleValRef = useRef(1);

  // Architecture Loop Fix: Decouples rendering engine ticks from reference closures
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  scaleRef.current = (s: number) => { scaleValRef.current = s; };

  useEffect(() => {
    if (!active) return;
    function frame(now: number) {
      const raw = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;
      callbackRef.current(raw);
      rafRef.current = requestAnimationFrame(frame);
    }
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
  return scaleRef;
}

interface MobileTouchControlsProps {
  visible: boolean;
  inputRef: React.MutableRefObject<TouchState>;
}

const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({ visible, inputRef }) => {
  const leftRef = useRef<HTMLButtonElement>(null);
  const rightRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;
    const onLeftDown = (e: Event) => { e.preventDefault(); inputRef.current.left = true; };
    const onRightDown = (e: Event) => { e.preventDefault(); inputRef.current.right = true; };
    left.addEventListener("touchstart", onLeftDown, { passive: false });
    right.addEventListener("touchstart", onRightDown, { passive: false });
    return () => {
      left.removeEventListener("touchstart", onLeftDown);
      right.removeEventListener("touchstart", onRightDown);
    };
  }, [inputRef]);

  if (!visible) return null;
  const btnBase: React.CSSProperties = {
    position: "absolute", bottom: 32, width: 100, height: 80, borderRadius: 12,
    background: "rgba(20,60,120,0.55)", border: "1.5px solid rgba(80,160,255,0.4)",
    color: "rgba(160,210,255,0.9)", fontSize: 28, fontFamily: "monospace", display: "flex",
    alignItems: "center", justifyContent: "center", cursor: "pointer",
    userSelect: "none", WebkitUserSelect: "none", touchAction: "none", backdropFilter: "blur(4px)", zIndex: 100
  };

  return (
    <>
      <button ref={leftRef} style={{ ...btnBase, left: 24 }} aria-label="Left panel">←</button>
      <button ref={rightRef} style={{ ...btnBase, right: 24 }} aria-label="Right panel">→</button>
    </>
  );
};

const IntroScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,4,14,0.92)", zIndex: 10 }}>
    <div style={{ fontFamily: "'Courier New', monospace", color: "rgba(140,200,255,0.95)", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: "bold", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 8, textShadow: "0 0 40px rgba(80,160,255,0.6)" }}>
      Glass Bridge
    </div>
    <div style={{ fontFamily: "'Courier New', monospace", color: "rgba(100,150,200,0.7)", fontSize: 14, letterSpacing: "0.2em", marginBottom: 48 }}>
      ONE WRONG STEP. ONE CHANCE.
    </div>
    <div style={{ fontFamily: "'Courier New', monospace", color: "rgba(120,180,240,0.6)", fontSize: 13, marginBottom: 40, textAlign: "center", lineHeight: 2, maxWidth: 320 }}>
      {`← / → ARROW KEYS  or  TOUCH BUTTONS\n\nChoose left or right panel.\nOne is tempered glass. One is not.`}
    </div>
    <button onClick={onStart} style={{ fontFamily: "'Courier New', monospace", fontSize: 16, letterSpacing: "0.25em", color: "#0a1628", background: "rgba(80,180,255,0.9)", border: "none", padding: "16px 48px", borderRadius: 4, cursor: "pointer", fontWeight: "bold", textTransform: "uppercase" }}>
      Begin
    </button>
  </div>
);

const GameOverScreen: React.FC<{ row: number; total: number; onRestart: () => void; onExit?: () => void }> = ({
  row, total, onRestart, onExit
}) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,2,8,0.88)", zIndex: 10 }}>
    <div style={{ fontFamily: "'Courier New', monospace", color: "rgba(255,80,80,0.95)", fontSize: "clamp(32px, 6vw, 56px)", fontWeight: "bold", letterSpacing: "0.3em", marginBottom: 16, textShadow: "0 0 60px rgba(255,60,60,0.5)" }}>
      ELIMINATED
    </div>
    <div style={{ fontFamily: "'Courier New', monospace", color: "rgba(140,180,220,0.7)", fontSize: 14, letterSpacing: "0.2em", marginBottom: 48 }}>
      {`PANEL ${row} of ${total}`}
    </div>
    <div style={{ display: "flex", gap: "16px" }}>
      <button onClick={onRestart} style={{ fontFamily: "'Courier New', monospace", fontSize: 15, letterSpacing: "0.2em", color: "#0a1628", background: "rgba(80,160,255,0.85)", border: "none", padding: "14px 40px", borderRadius: 4, cursor: "pointer", fontWeight: "bold", textTransform: "uppercase" }}>
        Try Again
      </button>
      {onExit && (
        <button onClick={onExit} style={{ fontFamily: "'Courier New', monospace", fontSize: 15, letterSpacing: "0.2em", color: "white", background: "transparent", border: "1px solid rgba(80,160,255,0.85)", padding: "14px 40px", borderRadius: 4, cursor: "pointer", fontWeight: "bold", textTransform: "uppercase" }}>
          ← Menu
        </button>
      )}
    </div>
  </div>
);

const VictoryScreen: React.FC<{ elapsed: number; onRestart: () => void; onExit?: () => void }> = ({
  elapsed, onRestart, onExit
}) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,4,10,0.88)", zIndex: 10 }}>
    <div style={{ fontFamily: "'Courier New', monospace", color: "rgba(80,220,160,0.98)", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: "bold", letterSpacing: "0.3em", marginBottom: 12, textShadow: "0 0 60px rgba(60,200,140,0.5)" }}>
      SURVIVED
    </div>
    <div style={{ fontFamily: "'Courier New', monospace", color: "rgba(120,200,160,0.65)", fontSize: 13, letterSpacing: "0.2em", marginBottom: 48 }}>
      {`TIME: ${Math.floor(elapsed)}s`}
    </div>
    <div style={{ display: "flex", gap: "16px" }}>
      <button onClick={onRestart} style={{ fontFamily: "'Courier New', monospace", fontSize: 15, letterSpacing: "0.2em", color: "#0a1a0f", background: "rgba(80,200,140,0.85)", border: "none", padding: "14px 40px", borderRadius: 4, cursor: "pointer", fontWeight: "bold", textTransform: "uppercase" }}>
        Play Again
      </button>
      {onExit && (
        <button onClick={onExit} style={{ fontFamily: "'Courier New', monospace", fontSize: 15, letterSpacing: "0.2em", color: "white", background: "transparent", border: "1px solid rgba(80,200,140,0.85)", padding: "14px 40px", borderRadius: 4, cursor: "pointer", fontWeight: "bold", textTransform: "uppercase" }}>
          ← Menu
        </button>
      )}
    </div>
  </div>
);

// ============================================================
// 26. MAIN REACT COMPONENT
// ============================================================

const GlassBridge: React.FC<GameProps> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState | null>(null);
  const assetsRef = useRef<BakedAssets | null>(null);
  const inputRef = useRef<TouchState>({ left: false, right: false });
  const containerRef = useRef<HTMLDivElement>(null);

  const [uiPhase, setUiPhase] = useState<"intro" | "playing" | "gameover" | "victory">("intro");
  const [finalRow, setFinalRow] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState(0);

  // Sync reference guard configuration prevents closures from leaking stale metadata states
  const uiPhaseRef = useRef(uiPhase);
  useEffect(() => {
    uiPhaseRef.current = uiPhase;
  }, [uiPhase]);

  // Memory Hygiene: Explicit particle system teardown prevent memory leaks across sessions
  useEffect(() => {
    return () => {
      particlePool = null;
    };
  }, []);

  useGameShellBridge({
    uiPhase,
    sourceGame: "glass-breaker",
    progressMarker: finalRow,
    progressTotal: TOTAL_ROWS,
  });

  const hudSync = useHUDSync({ flushInterval: 100 });
  const isTouchDevice =
    typeof window !== "undefined" &&
    (window.matchMedia("(pointer: coarse)").matches ||
      /android|iphone|ipad|ipod/i.test(navigator.userAgent));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const scale = Math.min(cw / WORLD_W, ch / WORLD_H);
      canvas.style.width = `${WORLD_W * scale}px`;
      canvas.style.height = `${WORLD_H * scale}px`;
    };

    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio ?? 1, 2) : 1;
    canvas.width = WORLD_W * dpr;
    canvas.height = WORLD_H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        if (!e.repeat) inputRef.current.left = true;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        if (!e.repeat) inputRef.current.right = true;
      }
      if (e.key === "Escape" && onExit) {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const startGame = useCallback(() => {
    const seed = Date.now() ^ (Math.random() * 0xffffffff);
    gsRef.current = createGameState(seed >>> 0);
    if (!assetsRef.current) {
      assetsRef.current = initBakedAssets();
    }
    setUiPhase("playing");
  }, []);

  const restartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  const tick = useCallback((dt: number) => {
    const gs = gsRef.current;
    const assets = assetsRef.current;
    const canvas = canvasRef.current;
    if (!gs || !assets || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    gameTick(gs, dt, inputRef);

    const playerAlive = gs.player.status === "alive";
    hudSync.write({
      score:    gs.currentRow,
      lives:    playerAlive ? 1 : 0,
      time:     Math.ceil(Math.max(0, gs.timeLeft)),
      health:   playerAlive ? 100 : 0,
      maxHealth: 100,
      level:    gs.currentRow,
    });
    
    // Explicit frame cycle sync tick flush instruction prevents telemetry interface lag
    hudSync.tick(performance.now());   

    if (gs.phase === "gameover" && uiPhaseRef.current === "playing") {
      hudSync.write({ health: 0, lives: 0 });
      hudSync.forceFlush();
      setFinalRow(gs.currentRow);
      setUiPhase("gameover");
    }
    if (gs.phase === "victory" && uiPhaseRef.current === "playing") {
      setFinalElapsed(gs.elapsed);
      setUiPhase("victory");
    }

    const quality: "high" | "low" = "high";
    renderFrame(ctx, gs, assets, quality);
  }, [hudSync]);

  useGameLoop(tick, uiPhase === "playing");

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 400,
        background: VOID_COLOR,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          imageRendering: "pixelated",
          width: "100%", 
          height: "100%", 
          objectFit: "contain" 
        }}
      />

      {onExit && (
        <button
          onClick={onExit}
          style={{
            position: "absolute", top: 16, left: 16, zIndex: 250, padding: "10px 18px",
            background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 4, color: "#fff", fontFamily: "monospace", fontSize: 12,
            letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
        >
          ← MENU (ESC)
        </button>
      )}

      {uiPhase === "intro" && <IntroScreen onStart={startGame} />}
      {uiPhase === "gameover" && (
        <GameOverScreen
          row={finalRow}
          total={TOTAL_ROWS}
          onRestart={restartGame}
          onExit={onExit} 
        />
      )}
      {uiPhase === "victory" && (
        <VictoryScreen elapsed={finalElapsed} onRestart={restartGame} onExit={onExit} />
      )}

      {uiPhase === "playing" && (
        <MobileTouchControls visible={isTouchDevice} inputRef={inputRef} />
      )}
    </div>
  );
};

export default GlassBridge;