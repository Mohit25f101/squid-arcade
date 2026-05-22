/**
 * SECTION 6 — FULL UI/UX THEME REDESIGN
 * src/components/ui/GameMenu.tsx
 *
 * Speed-themed game selection screen.
 * Visual identity: dark racing aesthetic, neon speed streaks,
 * Barlow Condensed for that sports-broadcast feel.
 *
 * Color language:
 *   Green (#00ff88)  = safe / go / Glass Bridge accent
 *   Red   (#ff2d55)  = danger / stop / Red Light accent
 *   Yellow (#ffd60a) = warning / active state
 *   Blue  (#0a84ff)  = info / neutral
 *   Dark  (#060608)  = background (near black, not flat black)
 */

"use client";

import { useEffect, useRef } from "react";
import { useGameStore, type GameId } from "@/store/gameStore";

interface GameMenuProps {
  onLaunch?: (id: GameId) => void;
}

export default function GameMenu({ onLaunch }: GameMenuProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Atmospheric speed-streak background
 useEffect(() => {
  // 1. Explicitly cast it so the closures never doubt its existence
  const canvas = canvasRef.current as HTMLCanvasElement; 
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  // ...

    let raf: number;
    let streaks: Streak[] = [];

    interface Streak {
      x: number; y: number;
      length: number; speed: number;
      alpha: number; color: string;
    }

    const COLORS = ["#00ff8820", "#ff2d5515", "#ffd60a12", "#0a84ff10"];

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function spawnStreak(): Streak {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: 60 + Math.random() * 200,
        speed: 4 + Math.random() * 12,
        alpha: 0.4 + Math.random() * 0.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    }

    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 30; i++) streaks.push(spawnStreak());

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of streaks) {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.length, s.y);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, s.color);
        ctx.fillStyle = grad;
        ctx.fillRect(s.x, s.y, s.length, 1);
        ctx.restore();

        s.x += s.speed;
        if (s.x > canvas.width + s.length) {
          s.x = -s.length;
          s.y = Math.random() * canvas.height;
        }
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  async function handleSelectGame(id: GameId) {
    onLaunch?.(id);
  }

  return (
    <div className="menu-root">
      <canvas ref={canvasRef} className="menu-bg-canvas" aria-hidden />

      <div className="menu-content">
        {/* Header */}
        <header className="menu-header">
          <div className="menu-eyebrow">SEASON 1 — SELECT GAME</div>
          <h1 className="menu-title">
            <span className="menu-title-main">SPEED</span>
            <span className="menu-title-sub">ARENA</span>
          </h1>
          <div className="menu-tagline">Survive. Or don't.</div>
        </header>

        {/* Game cards */}
        <div className="menu-cards">
          <GameCard
            id="red-light-green-light"
            episode={1}
            title="Red Light"
            subtitle="Green Light"
            desc="Run. Freeze. Survive 60 seconds. One false move ends everything."
            accent="#ff2d55"
            symbol="●"
            difficulty={3}
            onSelect={handleSelectGame}
          />
          <GameCard
            id="glass-bridge"
            episode={5}
            title="Glass"
            subtitle="Bridge"
            desc="Two panes. One safe. Sixteen rows to cross. No second chances."
            accent="#00ff88"
            symbol="▲"
            difficulty={4}
            onSelect={handleSelectGame}
          />
          <GameCard
            id="dalgona"
            episode={3}
            title="Dalgona"
            subtitle="Candy"
            desc="Carve the shape without breaking the candy. Steady hands survive."
            accent="#ffd60a" 
            symbol="★"
            difficulty={3}
            onSelect={handleSelectGame}
          />
        </div>

        {/* Platform hint */}
        <div className="menu-hint">
          Use ← → arrow keys to move · Space to jump
        </div>
      </div>

      {/* Portrait rotation warning */}
      <div className="portrait-warning" role="alert">
        <div className="portrait-warning-icon">📱</div>
        <p style={{ fontFamily: "var(--font-hud)", letterSpacing: "0.1em" }}>
          ROTATE YOUR DEVICE
        </p>
      </div>
    </div>
  );
}

// ── GameCard sub-component ─────────────────────────────────────────────────

interface GameCardProps {
  id: "glass-bridge" | "red-light-green-light" | "dalgona";
  episode: number;
  title: string;
  subtitle: string;
  desc: string;
  accent: string;
  symbol: string;
  difficulty: number;
  onSelect: (id: "glass-bridge" | "red-light-green-light" | "dalgona") => void;
}

function GameCard({
  id, episode, title, subtitle, desc, accent, symbol, difficulty, onSelect,
}: GameCardProps) {
  return (
    <button
      className="game-card-btn"
      style={{ "--card-accent": accent } as React.CSSProperties}
      onClick={() => onSelect(id)}
      aria-label={`Play ${title} ${subtitle}`}
      
    >
      <div className="gc-episode">EP. {episode}</div>
      <div className="gc-symbol">{symbol}</div>
      <div className="gc-title">
        <span>{title}</span>
        <span className="gc-title-sub">{subtitle}</span>
      </div>
      <p className="gc-desc">{desc}</p>
      <div className="gc-footer">
        <div className="gc-diff">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="gc-diff-dot"
              style={{ opacity: i < difficulty ? 1 : 0.15 }}
            />
          ))}
        </div>
        <span className="gc-cta">ENTER →</span>
      </div>
    </button>
  );
}
