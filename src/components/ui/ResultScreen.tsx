// src/components/ui/ResultScreen.tsx
// Premium Victory / Elimination screen — based on the UI Redesign Scope
// design language: neon glow, geometric shapes, Korean text accents

"use client";

import React, { useEffect, useState, useMemo } from "react";

/* ─── types ─────────────────────────────────────────────────────────────── */

export interface ResultProps {
  outcome: "victory" | "eliminated";
  score?: number;
  statLine?: string;            // e.g. "MOVED DURING RED LIGHT"
  survived?: number;            // survivors remaining
  played?: number;              // games played this session
  total?: number;               // total players
  prize?: number;
  timeBonus?: number;
  onTryAgain?: () => void;
  onMenu?: () => void;
}

/* ─── constants ─────────────────────────────────────────────────────────── */

const COLORS = {
  pink:   "#FF0066",
  teal:   "#00FFB2",
  gold:   "#FFD700",
  red:    "#FF3333",
  white:  "#F5F5F5",
  dim:    "rgba(245,245,245,0.45)",
  bgElim: "#0A0000",
  bgWin:  "#080500",
} as const;

/* ─── floating squid shapes ────────────────────────────────────────────── */

const SHAPES = [
  { type: "circle", x: "8%",  y: "12%", size: 44, delay: 0,    color: COLORS.pink },
  { type: "tri",    x: "25%", y: "8%",  size: 32, delay: 0.3,  color: COLORS.pink },
  { type: "square", x: "82%", y: "10%", size: 40, delay: 0.6,  color: COLORS.pink },
  { type: "tri",    x: "15%", y: "72%", size: 48, delay: 0.9,  color: COLORS.pink },
  { type: "square", x: "85%", y: "68%", size: 36, delay: 1.2,  color: COLORS.pink },
  { type: "circle", x: "70%", y: "80%", size: 28, delay: 0.5,  color: COLORS.pink },
  { type: "tri",    x: "50%", y: "6%",  size: 24, delay: 0.7,  color: COLORS.pink },
  { type: "tri",    x: "40%", y: "85%", size: 20, delay: 1.4,  color: COLORS.pink },
];

function FloatingShape({ type, x, y, size, delay, isRed }: {
  type: string; x: string; y: string; size: number; delay: number; isRed: boolean;
}) {
  const color = isRed ? COLORS.red : COLORS.gold;
  const stroke = isRed ? "rgba(255,51,51,0.6)" : "rgba(255,215,0,0.6)";
  const dimColor = isRed ? "rgba(255,51,51,0.25)" : "rgba(255,215,0,0.25)";

  const shapeEl = type === "circle" ? (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${stroke}`,
      boxShadow: `0 0 15px ${dimColor}`,
    }} />
  ) : type === "tri" ? (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <polygon points="50,5 95,95 5,95" fill="none" stroke={stroke}
        strokeWidth="6" strokeLinejoin="round"
        filter={`drop-shadow(0 0 8px ${color})`} />
    </svg>
  ) : (
    <div style={{
      width: size, height: size,
      border: `2px solid ${stroke}`,
      boxShadow: `0 0 15px ${dimColor}`,
    }} />
  );

  return (
    <div style={{
      position: "absolute", left: x, top: y,
      animation: `result-float 6s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      opacity: 0.55,
      pointerEvents: "none",
    }}>
      {shapeEl}
    </div>
  );
}

/* ─── gold particles (victory only) ────────────────────────────────────── */

function GoldParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      delay: `${Math.random() * 4}s`,
      dur: `${2.5 + Math.random() * 3}s`,
      size: 2 + Math.random() * 4,
    })), []);

  return (
    <>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: p.left, bottom: 0,
          width: p.size, height: p.size, borderRadius: "50%",
          background: COLORS.gold, boxShadow: `0 0 6px ${COLORS.gold}`,
          animation: `result-particle-rise ${p.dur} ease-out infinite`,
          animationDelay: p.delay,
          pointerEvents: "none",
        }} />
      ))}
    </>
  );
}

/* ─── player badge ─────────────────────────────────────────────────────── */

function PlayerBadge({ number, color }: { number: string; color: string }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
      fontWeight: 700,
      fontSize: "clamp(14px, 2vw, 20px)",
      letterSpacing: "0.1em",
      color,
      padding: "6px 16px",
      borderRadius: 4,
      border: `1px solid ${color}60`,
      background: `${color}10`,
      boxShadow: `0 0 10px ${color}30`,
    }}>
      #{number}
    </span>
  );
}

/* ─── stat chip ────────────────────────────────────────────────────────── */

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: 11, letterSpacing: "0.3em",
        color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
        marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)",
        fontSize: "clamp(18px, 3vw, 28px)",
        color,
        textShadow: `0 0 12px ${color}80`,
      }}>{value}</div>
    </div>
  );
}

/* ─── main component ──────────────────────────────────────────────────── */

export const ResultScreen: React.FC<ResultProps> = ({
  outcome,
  score,
  statLine,
  survived,
  played,
  total,
  prize,
  timeBonus,
  onTryAgain,
  onMenu,
}) => {
  const isVictory = outcome === "victory";

  // stagger reveal
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 150);   // title
    const t2 = setTimeout(() => setStep(2), 600);   // badge + subtitle
    const t3 = setTimeout(() => setStep(3), 1100);  // stats
    const t4 = setTimeout(() => setStep(4), 1600);  // buttons
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const accent = isVictory ? COLORS.gold : COLORS.red;
  const bgColor = isVictory ? COLORS.bgWin : COLORS.bgElim;
  const title = isVictory ? "WINNER" : "ELIMINATED";
  const koreanText = isVictory ? "우승자" : "탈락";

  return (
    <div
      data-testid="result-screen"
      className={!isVictory ? "anim-eliminated" : ""}
      style={{
        position: "absolute", inset: 0, zIndex: 100,
        background: bgColor,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        overflow: "hidden",
        animation: "result-fade-in 0.4s ease",
      }}
    >
      {/* radial glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse at center, ${accent}18, transparent 70%)`,
      }} />

      {/* floating shapes */}
      {SHAPES.map((s, i) => (
        <FloatingShape key={i} {...s} isRed={!isVictory} />
      ))}

      {/* gold particles (victory only) */}
      {isVictory && <GoldParticles />}

      {/* scanlines overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)`,
        opacity: 0.5,
      }} />

      {/* ── content ─────────────────────────────────────────────── */}

      {/* Korean subtitle */}
      <div style={{
        opacity: step >= 1 ? 1 : 0,
        transform: step >= 1 ? "translateY(0)" : "translateY(10px)",
        transition: "all 0.5s ease",
        fontFamily: "'Noto Sans KR', sans-serif",
        fontSize: 14, color: "rgba(255,255,255,0.35)",
        marginBottom: 8,
      }}>
        {koreanText}
      </div>

      {/* Main title */}
      <h1 style={{
        opacity: step >= 1 ? 1 : 0,
        transform: step >= 1 ? "scale(1)" : "scale(0.8)",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)",
        fontSize: "clamp(48px, 12vw, 100px)",
        lineHeight: 0.9,
        letterSpacing: "0.08em",
        color: accent,
        textShadow: `0 0 50px ${accent}CC, 0 0 100px ${accent}40`,
        margin: "0 0 12px",
        textAlign: "center",
      }}>
        {title}
      </h1>

      {/* Player badge */}
      <div style={{
        opacity: step >= 2 ? 1 : 0,
        transform: step >= 2 ? "translateY(0)" : "translateY(15px)",
        transition: "all 0.5s ease",
        marginBottom: 8,
      }}>
        <PlayerBadge number="456" color={accent} />
      </div>

      {/* Stat line / subtitle */}
      {statLine && (
        <div style={{
          opacity: step >= 2 ? 1 : 0,
          transition: "opacity 0.5s ease",
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 12, letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          marginBottom: 16,
          textAlign: "center",
        }}>
          {statLine}
        </div>
      )}

      {/* Prize money (victory) */}
      {isVictory && (
        <div style={{
          opacity: step >= 2 ? 1 : 0,
          transform: step >= 2 ? "translateY(0)" : "translateY(15px)",
          transition: "all 0.6s ease",
          fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)",
          fontSize: "clamp(24px, 5vw, 42px)",
          color: COLORS.gold,
          textShadow: `0 0 30px ${COLORS.gold}AA`,
          marginBottom: 4,
        }}>
          ₩{(prize ?? 45600000000).toLocaleString()}
        </div>
      )}
      {isVictory && (
        <div style={{
          opacity: step >= 2 ? 0.6 : 0,
          transition: "opacity 0.5s ease",
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 10, letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          marginBottom: 20,
        }}>
          PRIZE MONEY AWARDED
        </div>
      )}

      {/* Stats row */}
      <div style={{
        opacity: step >= 3 ? 1 : 0,
        transform: step >= 3 ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.5s ease",
        display: "flex", gap: "clamp(20px, 5vw, 48px)",
        marginTop: isVictory ? 0 : 16,
        marginBottom: 20,
      }}>
        {score !== undefined && (
          <StatChip label="SCORE" value={score.toLocaleString("en-US")} color={COLORS.gold} />
        )}
        {survived !== undefined && total !== undefined && (
          <StatChip label="SURVIVORS" value={`${survived}/${total}`} color={COLORS.teal} />
        )}
        {survived !== undefined && total === undefined && (
          <StatChip label="SURVIVED" value={`${survived} ROUNDS`} color={COLORS.white} />
        )}
        {played !== undefined && (
          <StatChip label="GAMES" value={played} color={COLORS.white} />
        )}
        {timeBonus !== undefined && timeBonus > 0 && (
          <StatChip label="TIME BONUS" value={`+${timeBonus.toLocaleString()}`} color={COLORS.teal} />
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        opacity: step >= 4 ? 1 : 0,
        transform: step >= 4 ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.5s ease",
        display: "flex", gap: 14,
        pointerEvents: step >= 4 ? "auto" : "none",
      }}>
        {onTryAgain && (
          <ResultButton
            label={isVictory ? "PLAY AGAIN" : "TRY AGAIN"}
            accent={accent}
            filled={isVictory}
            onClick={onTryAgain}
            testId="result-try-again"
          />
        )}
        {onMenu && (
          <ResultButton
            label="← MENU"
            accent={isVictory ? "rgba(255,255,255,0.5)" : COLORS.pink}
            filled={false}
            onClick={onMenu}
            testId="result-menu"
          />
        )}
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes result-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes result-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-14px) rotate(3deg); }
          66% { transform: translateY(-6px) rotate(-2deg); }
        }
        @keyframes result-particle-rise {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-250px) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

/* ─── button helper ────────────────────────────────────────────────────── */

function ResultButton({ label, accent, filled, onClick, testId }: {
  label: string; accent: string; filled: boolean; onClick: () => void; testId: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 24px",
        fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)",
        fontSize: 14, letterSpacing: "0.22em", fontWeight: 700,
        textTransform: "uppercase",
        cursor: "pointer",
        borderRadius: 6,
        border: `1px solid ${accent}`,
        background: filled
          ? (hovered ? accent : `${accent}DD`)
          : (hovered ? `${accent}20` : "transparent"),
        color: filled ? "#000" : accent,
        boxShadow: filled ? `0 0 20px ${accent}50` : "none",
        transition: "all 180ms ease",
      }}
    >
      {label}
    </button>
  );
}