// src/components/ui/GameMenu.tsx

"use client";

import { useEffect, useRef } from "react";
import { useGameStore, type GameId } from "@/store/gameStore";

interface GameMenuProps {
  onLaunch?: (id: GameId) => void;
}

export default function GameMenu({ onLaunch }: GameMenuProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let raf: number;

    interface Streak {
      x: number; y: number;
      length: number; speed: number;
      alpha: number; color: string;
    }

    // Dark red / charcoal streaks instead of multi-color neon
    const COLORS = [
      "rgba(255,45,45,0.12)",
      "rgba(255,45,45,0.07)",
      "rgba(180,20,20,0.09)",
      "rgba(255,255,255,0.04)",
    ];

    let streaks: Streak[] = [];

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function spawnStreak(): Streak {
      return {
        x:      Math.random() * canvas.width,
        y:      Math.random() * canvas.height,
        length: 60 + Math.random() * 200,
        speed:  4 + Math.random() * 12,
        alpha:  0.4 + Math.random() * 0.6,
        color:  COLORS[Math.floor(Math.random() * COLORS.length)],
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

  function handleSelectGame(id: GameId) {
    onLaunch?.(id);
  }

  return (
    <div className="menu-root">
      <canvas ref={canvasRef} className="menu-bg-canvas" aria-hidden />

      {/* Pure-CSS scanline overlay — zero JS */}
      <div
        aria-hidden="true"
        style={{
          position:        "absolute",
          inset:           0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
          pointerEvents:   "none",
          zIndex:          1,
        }}
      />

      <div className="menu-content" style={{ zIndex: 2 }}>
        {/* Header */}
        <header className="menu-header">
          <div className="menu-eyebrow">BROADCAST — EPISODE SELECT</div>
          <h1 className="menu-title">
            <span className="menu-title-main">SQUID</span>
            <span className="menu-title-sub">ARCADE</span>
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
            accent="#ff2d2d"
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

        <div className="menu-hint">
          Use ← → arrow keys to move · Space to jump
        </div>
      </div>

      <div className="portrait-warning" role="alert">
        <div className="portrait-warning-icon">📱</div>
        <p style={{ fontFamily: "var(--font-hud)", letterSpacing: "0.1em" }}>
          ROTATE YOUR DEVICE
        </p>
      </div>
    </div>
  );
}

interface GameCardProps {
  id:         "glass-bridge" | "red-light-green-light" | "dalgona";
  episode:    number;
  title:      string;
  subtitle:   string;
  desc:       string;
  accent:     string;
  symbol:     string;
  difficulty: number;
  onSelect:   (id: "glass-bridge" | "red-light-green-light" | "dalgona") => void;
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
      <div className="gc-episode">EP. {String(episode).padStart(2, "0")}</div>
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