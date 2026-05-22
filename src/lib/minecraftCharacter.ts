/**
 * SECTION 5 — MINECRAFT-STYLE CHARACTER RENDERING
 * src/lib/minecraftCharacter.ts
 *
 * Renders blocky, voxel-inspired characters using Canvas 2D.
 * No 3D library needed — uses isometric-style layered rectangles
 * to fake a low-poly look at near-zero GPU cost.
 *
 * CHARACTER ANATOMY (all sizes in "blocks", 1 block = 8px at default scale):
 *   Head:   2×2×2 blocks
 *   Torso:  2×3×1 blocks
 *   Arms:   1×3×1 blocks each
 *   Legs:   1×3×1 blocks each
 *
 * SPEED THEME OUTFITS:
 *   runner  — neon tracksuit, racing stripes, visor helmet
 *   guard   — dark military, red beret, rifle accessory
 *   vip     — white suit, gold trim, mask
 *   doll    — school uniform, pigtails, red/green LED eyes
 */

export type CharacterRole = "runner" | "guard" | "vip" | "doll";
export type CharacterState = "idle" | "running" | "jumping" | "falling" | "dead";

export interface CharacterColors {
  skin: string;
  primary: string;     // main outfit color
  secondary: string;   // accent / stripe color
  helmet: string;
  eyes: string;
}

const ROLE_COLORS: Record<CharacterRole, CharacterColors> = {
  runner: {
    skin:      "#f5c8a0",
    primary:   "#1a1a2e",    // dark navy tracksuit
    secondary: "#00ff88",    // neon green stripe
    helmet:    "#0d0d1a",
    eyes:      "#00ff88",
  },
  guard: {
    skin:      "#8d6e63",
    primary:   "#212529",    // near-black uniform
    secondary: "#e63946",    // red beret & accents
    helmet:    "#e63946",
    eyes:      "#ffffff",
  },
  vip: {
    skin:      "#ffe0bd",
    primary:   "#f8f9fa",    // white suit
    secondary: "#ffd60a",    // gold trim
    helmet:    "#f8f9fa",
    eyes:      "#ffd60a",
  },
  doll: {
    skin:      "#fce4d6",
    primary:   "#c0392b",    // school uniform red
    secondary: "#2c3e50",    // collar detail
    helmet:    "#2c3e50",
    eyes:      "#e74c3c",    // glowing red (switches to green)
  },
};

// ── Renderer class ─────────────────────────────────────────────────────────

export class MinecraftCharacterRenderer {
  private ctx: CanvasRenderingContext2D;
  private scale: number;

  constructor(ctx: CanvasRenderingContext2D, scale = 8) {
    this.ctx = ctx;
    this.scale = scale; // px per block
  }

  /**
   * Draw a complete character at (cx, cy) — cx/cy is the bottom-center.
   * @param animFrame  0-3 walk cycle frame (changes arm/leg positions)
   */
  draw(
    cx: number,
    cy: number,
    role: CharacterRole = "runner",
    state: CharacterState = "idle",
    animFrame = 0,
    facingRight = true
  ): void {
    const { ctx, scale: s } = this;
    const colors = ROLE_COLORS[role];

    ctx.save();

    // Flip for direction
    if (!facingRight) {
      ctx.scale(-1, 1);
      cx = -cx;
    }

    // Walk animation: bob the whole body slightly
    const bobY = state === "running" ? Math.sin(animFrame * Math.PI * 0.5) * s * 0.25 : 0;

    // ── Legs ──────────────────────────────────────────────────────────
    const legSwing = state === "running" ? (animFrame % 2 === 0 ? 1 : -1) : 0;

    // Left leg
    this._drawLimb(
      cx - s * 0.5,
      cy - s * 3 + bobY,
      s, s * 3,
      colors.primary,
      legSwing * s * 0.5
    );
    // Right leg
    this._drawLimb(
      cx + s * 0.5,
      cy - s * 3 + bobY,
      s, s * 3,
      colors.secondary.startsWith("#0") ? colors.primary : colors.primary,
      -legSwing * s * 0.5
    );

    // ── Torso ─────────────────────────────────────────────────────────
    this._drawBlock(
      cx - s,
      cy - s * 6 + bobY,
      s * 2, s * 3,
      colors.primary
    );

    // Speed stripe on torso
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(cx - s * 0.15, cy - s * 5.8 + bobY, s * 0.3, s * 2.6);

    // ── Arms ──────────────────────────────────────────────────────────
    const armSwing = state === "running" ? -legSwing * s * 0.6 : 0;

    // Left arm
    this._drawLimb(
      cx - s * 1.5,
      cy - s * 6 + bobY,
      s, s * 3,
      colors.primary,
      -armSwing
    );
    // Right arm
    this._drawLimb(
      cx + s * 1.5,
      cy - s * 6 + bobY,
      s, s * 3,
      colors.primary,
      armSwing
    );

    // ── Head ──────────────────────────────────────────────────────────
    this._drawBlock(
      cx - s,
      cy - s * 8.5 + bobY,
      s * 2, s * 2,
      colors.skin
    );

    // Helmet/hair
    this._drawBlock(
      cx - s * 1.05,
      cy - s * 9.1 + bobY,
      s * 2.1, s * 1.2,
      colors.helmet
    );

    // Eyes
    const eyeY = cy - s * 8.1 + bobY;
    this._drawPixel(cx - s * 0.55, eyeY, s * 0.4, colors.eyes);
    this._drawPixel(cx + s * 0.15, eyeY, s * 0.4, colors.eyes);

    // ── Death state: tilt and redden ──────────────────────────────────
    if (state === "dead") {
      // Drawn above is already rendered; apply a red overlay
      ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
      ctx.fillRect(cx - s * 2, cy - s * 9, s * 4, s * 9);
    }

    // ── Doll: special LED eye color toggle ────────────────────────────
    if (role === "doll") {
      // Eyes already drawn; add glow effect
      ctx.shadowColor = colors.eyes;
      ctx.shadowBlur = s * 1.5;
      this._drawPixel(cx - s * 0.55, eyeY, s * 0.4, colors.eyes);
      this._drawPixel(cx + s * 0.15, eyeY, s * 0.4, colors.eyes);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private _drawBlock(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ): void {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));

    // Subtle top highlight (faked lighting)
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 2);

    // Subtle left shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(Math.round(x + w - 2), Math.round(y), 2, Math.round(h));
  }

  private _drawLimb(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    offsetX: number
  ): void {
    // Limb swing is a simple horizontal offset (fake rotation without trig cost)
    this._drawBlock(x + offsetX, y, w, h, color);
  }

  private _drawPixel(
    x: number,
    y: number,
    size: number,
    color: string
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  }
}

// ── Animation helpers ─────────────────────────────────────────────────────

/**
 * Calculate walk animation frame from elapsed time.
 * Returns 0-3 cycling at `stepsPerSecond` rate.
 */
export function getWalkFrame(
  elapsedMs: number,
  stepsPerSecond = 4
): number {
  return Math.floor((elapsedMs / 1000) * stepsPerSecond) % 4;
}

/**
 * Map player velocity to stepsPerSecond for the walk animation.
 * Faster running = faster leg pumping.
 */
export function velocityToStepRate(
  velocityPct: number // 0-100
): number {
  return 2 + (velocityPct / 100) * 6; // 2 steps/sec idle → 8 steps/sec full speed
}
