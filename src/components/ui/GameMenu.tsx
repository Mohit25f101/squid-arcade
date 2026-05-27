// src/components/ui/GameMenu.tsx
//
// SQUID GAME — Main Menu
//
// Visual identity: fully sourced from the uploaded zip design scope.
// Colors, fonts, animations, effects — all faithful to the spec.
// Reuses existing gameStore, audio hook, and SquidSymbols components.
//
// Flow:
//   1. Cinematic intro (curtain opens, title reveals)
//   2. Main screen: SQUID GAME + 3 game mode icons + nav (PLAY · SETTINGS · EXIT)
//   3. "PLAY" expands game selection (same cards, Squid identity)
//   4. SETTINGS opens the overlay
//   5. EXIT shows confirmation modal

"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react";
import { useGameStore, type GameId } from "@/store/gameStore";
import { SymbolTrio, CircleSymbol, TriangleSymbol, SquareSymbol } from "./SquidSymbols";
import { useMenuAudio } from "@/hooks/useMenuAudio";
import dynamic from "next/dynamic";

const SettingsOverlay = dynamic(() => import("./SettingsOverlay"), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// Sub-types
// ─────────────────────────────────────────────────────────────────────────────

interface GameMenuProps {
  onLaunch?: (id: GameId) => void;
}

type MenuState = "intro" | "main" | "select" | "settings" | "exit-confirm";

interface GameMode {
  id:         GameId;
  icon:       string;
  label:      string;
  sub:        string;
  color:      string;
  badge:      string;
  episode:    number;
  desc:       string;
  difficulty: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const GAME_MODES: GameMode[] = [
  {
    id:         "red-light-green-light",
    icon:       "/RedLightGreenLight.ico",
    label:      "RED LIGHT\nGREEN LIGHT",
    sub:        "RED LIGHT GREEN LIGHT",
    color:      "#FF0066",
    badge:      "GAME 01",
    episode:    1,
    desc:       "Run. Freeze. Survive 60 seconds. One false move ends everything.",
    difficulty: 3,
  },
  {
    id:         "glass-bridge",
    icon:       "/GlassBridge.ico",
    label:      "GLASS\nBRIDGE",
    sub:        "GLASS BRIDGE",
    color:      "#00FFB2",
    badge:      "GAME 04",
    episode:    5,
    desc:       "Two panes. One safe. Sixteen rows to cross. No second chances.",
    difficulty: 4,
  },
  {
    id:         "dalgona",
    icon:       "/DalgonaCandy.ico",
    label:      "DALGONA\nCANDY",
    sub:        "DALGONA CHALLENGE",
    color:      "#FFD700",
    badge:      "GAME 02",
    episode:    3,
    desc:       "Carve the shape without breaking the candy. Steady hands survive.",
    difficulty: 3,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Background canvas (horizontal light streaks)
// ─────────────────────────────────────────────────────────────────────────────

function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    const COLORS = [
      "rgba(255,0,102,0.10)",
      "rgba(255,0,102,0.05)",
      "rgba(180,0,60,0.07)",
      "rgba(0,255,178,0.04)",
      "rgba(255,255,255,0.025)",
    ];

    type Streak = { x: number; y: number; length: number; speed: number; alpha: number; color: string };
    let streaks: Streak[] = [];

    function resize() {
      canvas!.width  = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }

    function spawn(): Streak {
      return {
        x:      Math.random() * canvas!.width,
        y:      Math.random() * canvas!.height,
        length: 80 + Math.random() * 220,
        speed:  3 + Math.random() * 10,
        alpha:  0.3 + Math.random() * 0.7,
        color:  COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    }

    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 28; i++) streaks.push(spawn());

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const s of streaks) {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        const g = ctx.createLinearGradient(s.x, s.y, s.x + s.length, s.y);
        g.addColorStop(0, "transparent");
        g.addColorStop(1, s.color);
        ctx.fillStyle = g;
        ctx.fillRect(s.x, s.y, s.length, 1.5);
        ctx.restore();
        s.x += s.speed;
        if (s.x > canvas!.width + s.length) {
          s.x = -s.length;
          s.y = Math.random() * canvas!.height;
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

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game mode icon card
// ─────────────────────────────────────────────────────────────────────────────

interface IconCardProps {
  mode:    GameMode;
  onHover: () => void;
  onClick: (id: GameId) => void;
  delay:   number;
}

function GameIconCard({ mode, onHover, onClick, delay }: IconCardProps) {
  const lines = mode.label.split("\n");
  const colorKey = mode.color === "#FF0066" ? "pink" : mode.color === "#00FFB2" ? "teal" : "gold";

  return (
    <button
      className="sq-icon-card"
      data-color={colorKey}
      style={{ animationDelay: `${delay}s` }}
      onMouseEnter={onHover}
      onClick={() => onClick(mode.id)}
      aria-label={`Select ${mode.sub}`}
    >
      <span
        className="sq-icon-badge"
        style={{
          color:      mode.color,
          background: `${mode.color}12`,
          border:     `1px solid ${mode.color}30`,
        }}
      >
        {mode.badge}
      </span>

      <img
        src={mode.icon}
        alt={mode.sub}
        className="sq-icon-img"
        style={{ color: mode.color }}
      />

      <span className="sq-icon-label" style={{ color: mode.color }}>
        {lines.map((l, i) => (
          <React.Fragment key={i}>
            {l}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game select card (expanded PLAY view)
// ─────────────────────────────────────────────────────────────────────────────

interface SelectCardProps {
  mode:    GameMode;
  onHover: () => void;
  onClick: (id: GameId) => void;
}

function SelectCard({ mode, onHover, onClick }: SelectCardProps) {
  const titleWords  = mode.sub.split(" ");
  const half        = Math.ceil(titleWords.length / 2);
  const titleMain   = titleWords.slice(0, half).join(" ");
  const titleSub    = titleWords.slice(half).join(" ");
  const symbolChar  = mode.id === "red-light-green-light" ? "●" : mode.id === "glass-bridge" ? "▲" : "★";

  return (
    <button
      className="game-card-btn"
      style={{ "--card-accent": mode.color } as React.CSSProperties}
      onMouseEnter={onHover}
      onClick={() => onClick(mode.id)}
      aria-label={`Play ${mode.sub}`}
    >
      <div className="gc-episode">EP. {String(mode.episode).padStart(2, "0")}</div>
      <div className="gc-symbol">{symbolChar}</div>
      <div className="gc-title">
        <span>{titleMain}</span>
        <span className="gc-title-sub">{titleSub}</span>
      </div>
      <p className="gc-desc">{mode.desc}</p>
      <div className="gc-footer">
        <div className="gc-diff">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="gc-diff-dot" style={{ opacity: i < mode.difficulty ? 1 : 0.15 }} />
          ))}
        </div>
        <span className="gc-cta">ENTER →</span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit confirmation
// ─────────────────────────────────────────────────────────────────────────────

function ExitConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div
      className="sq-overlay-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="sq-overlay-panel" style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
          <SymbolTrio size={18} gap={10} />
        </div>
        <h2 className="sq-overlay-title" style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", marginBottom: "0.5rem" }}>
          EXIT GAME?
        </h2>
        <p style={{
          fontFamily:   "var(--font-mono-sq)",
          fontSize:     "0.72rem",
          letterSpacing:"0.15em",
          color:        "rgba(255,255,255,0.4)",
          marginBottom: "1.5rem",
          lineHeight:   1.6,
        }}>
          Your progress will be lost.<br />Are you sure you want to exit?
        </p>
        <div className="sq-confirm-row">
          <button className="sq-btn sq-btn-cancel" onClick={onCancel}>CANCEL</button>
          <button className="sq-btn sq-btn-confirm" onClick={onConfirm}>EXIT</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function GameMenu({ onLaunch }: GameMenuProps = {}) {
  const [menuState, setMenuState]       = useState<MenuState>("intro");
  const [curtainOpen, setCurtainOpen]   = useState(false);
  const [playerCount, setPlayerCount]   = useState(456);
  const [countTick, setCountTick]       = useState(false);
  const [countdownSec, setCountdownSec] = useState(30);
  const setActiveGame                   = useGameStore((s) => s.setActiveGame);
  const audio                           = useMenuAudio();

  // Cinematic intro
  useEffect(() => {
    const t1 = setTimeout(() => setCurtainOpen(true), 600);
    const t2 = setTimeout(() => { setMenuState("main"); audio.startBg(); }, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Player count flicker
  useEffect(() => {
    const id = setInterval(() => {
      setPlayerCount((p) => { const n = p - Math.floor(Math.random() * 3); return n < 1 ? 456 : n; });
      setCountTick((t) => !t);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  // Countdown
  useEffect(() => {
    const id = setInterval(() => setCountdownSec((s) => (s <= 0 ? 30 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const handleHover = useCallback(() => audio.play("hover"), [audio]);
  const handleClick = useCallback(() => audio.play("click"), [audio]);

  const handleLaunch = useCallback((id: GameId) => {
    audio.play("transition");
    audio.stopBg();
    setTimeout(() => { onLaunch?.(id); setActiveGame(id); }, 350);
  }, [audio, onLaunch, setActiveGame]);

  const handleOpenSettings = useCallback(() => { audio.play("open"); setMenuState("settings"); }, [audio]);
  const handleCloseSettings = useCallback(() => { audio.play("click"); setMenuState("main"); }, [audio]);
  const handleExitRequest   = useCallback(() => { audio.play("open"); setMenuState("exit-confirm"); }, [audio]);
  const handleExitConfirm   = useCallback(() => { audio.play("exit"); audio.stopBg(); setTimeout(() => window.close(), 500); }, [audio]);
  const handleShowSelect    = useCallback(() => { audio.play("transition"); setMenuState("select"); }, [audio]);
  const handleBackToMain    = useCallback(() => { audio.play("click"); setMenuState("main"); }, [audio]);

  return (
    <div className="sq-menu-root sq-scanlines">

      {/* ── Background ── */}
      <BackgroundCanvas />
      <div className="sq-grid-bg" aria-hidden />
      <div className="sq-scanline-sweep" aria-hidden />

      {/* Ambient blobs */}
      <div className="sq-ambient-shape pink" aria-hidden
        style={{ width: 600, height: 600, top: "-15%", left: "-10%" }} />
      <div className="sq-ambient-shape teal" aria-hidden
        style={{ width: 400, height: 400, bottom: "-10%", right: "-8%", animationDelay: "3s" }} />

      {/* Rotating border circles */}
      <div className="sq-geo-circle spin" aria-hidden
        style={{ width: 500, height: 500, top: "-120px", right: "-120px", borderColor: "rgba(255,0,102,0.08)" }} />
      <div className="sq-geo-circle" aria-hidden
        style={{ width: 700, height: 700, bottom: "-220px", left: "-220px", borderColor: "rgba(0,255,178,0.04)", animation: "sq-spin-slow 40s linear reverse infinite" }} />

      {/* Floating shape accents */}
      <CircleSymbol   size={70} color="#FF0066" glow animate style={{ position:"absolute", top:"12%", left:"6%", opacity:0.15 }} />
      <TriangleSymbol size={50} color="#00FFB2" glow animate style={{ position:"absolute", top:"20%", right:"8%", opacity:0.15 }} />
      <SquareSymbol   size={40} color="#FFD700" glow animate style={{ position:"absolute", bottom:"25%", left:"10%", opacity:0.12 }} />
      <CircleSymbol   size={30} color="#00FFB2" glow animate style={{ position:"absolute", bottom:"18%", right:"6%", opacity:0.12 }} />

      {/* ── Intro curtain ── */}
      <div className={`sq-curtain${curtainOpen ? " open" : ""}`} aria-hidden />

      {/* ── Content wrapper ── */}
      <div
        className="sq-menu-content"
        style={{ opacity: menuState === "intro" ? 0 : 1, transition: "opacity 0.5s ease" }}
      >
        {/* Title block */}
        <div className="sq-title-block">
          <span className="sq-korean-label sq-font-korean">오징어 게임</span>
          <h1 className="sq-main-title sq-font-bebas">SQUID GAME</h1>
          <div className="sq-title-divider">
            <div className="sq-title-divider-line pink-right" />
            <CircleSymbol   size={7} color="#FF0066" glow />
            <TriangleSymbol size={7} color="#00FFB2" glow />
            <SquareSymbol   size={7} color="#FF0066" glow />
            <div className="sq-title-divider-line pink-left" />
          </div>
        </div>

        {/* Game mode icons */}
        {menuState !== "select" && (
          <div className="sq-icons-row">
            {GAME_MODES.map((mode, i) => (
              <GameIconCard
                key={mode.id}
                mode={mode}
                onHover={handleHover}
                onClick={menuState === "main" ? handleShowSelect : handleLaunch}
                delay={0.65 + i * 0.12}
              />
            ))}
          </div>
        )}

        {/* Game select (expanded) */}
        {menuState === "select" && (
          <div style={{ width: "100%", animation: "sq-slide-up 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
            <button
              onClick={handleBackToMain}
              onMouseEnter={handleHover}
              style={{
                all: "unset", cursor: "pointer",
                fontFamily: "var(--font-mono-sq)", fontSize: "0.68rem",
                letterSpacing: "0.25em", color: "rgba(255,0,102,0.5)",
                marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.4rem",
                transition: "color 200ms",
              }}
            >
              ← BACK
            </button>
            <div className="menu-cards">
              {GAME_MODES.map((mode) => (
                <SelectCard key={mode.id} mode={mode} onHover={handleHover} onClick={handleLaunch} />
              ))}
            </div>
          </div>
        )}

        {/* Main nav */}
        {menuState === "main" && (
          <nav className="sq-nav-list" aria-label="Main menu navigation">
            <button className="sq-nav-item" onMouseEnter={handleHover}
              onClick={() => { handleClick(); handleShowSelect(); }}>
              <span className="sq-nav-item-label sq-font-bebas">PLAY GAME</span>
              <span className="sq-nav-item-arrow">→</span>
            </button>

            <button className="sq-nav-item" onMouseEnter={handleHover}
              onClick={() => { handleClick(); handleOpenSettings(); }}>
              <span className="sq-nav-item-label sq-font-bebas">SETTINGS</span>
              <span className="sq-nav-item-arrow">→</span>
            </button>

            <button className="sq-nav-item danger" onMouseEnter={handleHover}
              onClick={() => { handleClick(); handleExitRequest(); }}>
              <span className="sq-nav-item-label sq-font-bebas">EXIT</span>
              <span className="sq-nav-item-arrow" style={{ color: "rgba(255,80,80,0.4)" }}>→</span>
            </button>
          </nav>
        )}

        {/* Live status pill */}
        {menuState === "main" && (
          <div className="sq-status-pill">
            <div className="sq-status-item">
              <span className="sq-status-label sq-font-mono">PLAYERS</span>
              <span className="sq-status-val sq-font-bebas sq-neon-teal"
                style={{ color: "#00FFB2", transform: countTick ? "scale(1.08)" : "scale(1)", transition: "transform 0.4s" }}>
                {playerCount}
              </span>
            </div>
            <div className="sq-status-divider" aria-hidden />
            <div className="sq-status-item">
              <span className="sq-status-label sq-font-mono">PRIZE</span>
              <span className="sq-status-val sq-font-bebas sq-neon-gold" style={{ color: "#FFD700" }}>₩45.6B</span>
            </div>
            <div className="sq-status-divider" aria-hidden />
            <div className="sq-status-item">
              <span className="sq-status-label sq-font-mono">TIMER</span>
              <span className="sq-status-val sq-font-mono sq-neon-pink" style={{ color: "#FF0066", fontSize: "1.2rem" }}>
                00:{String(countdownSec).padStart(2, "0")}
              </span>
            </div>
          </div>
        )}

        {/* Footer symbol trio */}
        <div style={{ opacity: 0.22, animation: "sq-fade-in 0.8s ease 1.6s both" }}>
          <SymbolTrio size={10} gap={8} glow={false} />
        </div>
      </div>

      {/* ── Overlays ── */}
      {menuState === "settings" && (
        <Suspense fallback={null}>
          <SettingsOverlay
            onClose={handleCloseSettings}
            onHover={handleHover}
            onClick={handleClick}
          />
        </Suspense>
      )}

      {menuState === "exit-confirm" && (
        <ExitConfirm
          onCancel={() => { handleClick(); setMenuState("main"); }}
          onConfirm={handleExitConfirm}
        />
      )}

      {/* Portrait warning */}
      <div className="portrait-warning" role="alert">
        <div className="portrait-warning-icon">📱</div>
        <p style={{ fontFamily: "var(--font-mono-sq)", letterSpacing: "0.1em" }}>
          ROTATE YOUR DEVICE
        </p>
      </div>
    </div>
  );
}