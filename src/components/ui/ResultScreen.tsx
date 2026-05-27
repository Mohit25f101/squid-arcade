"use client";

// src/components/ui/ResultScreen.tsx
//
// Shared result-state overlay used by every game mode.
// Renders either ELIMINATED or SURVIVOR depending on `outcome`.
// Provides "TRY AGAIN" (instant restart, same mode) and "◀ MENU" (lobby).
// Plays audio through the shared useMenuAudio hook.

import React, { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResultOutcome = "victory" | "eliminated";

export interface ResultScreenProps {
  outcome: ResultOutcome;
  /** Prize amount added this round (shown on victory only). */
  prize?: number;
  /** Stat label shown beneath the main title, e.g. "PANEL 6 OF 18" or "TIME: 43s". */
  statLine?: string;
  /** Restart the same game mode instantly. */
  onTryAgain: () => void;
  /** Return cleanly to the main menu / lobby. */
  onMenu: () => void;
  /** Called once when the screen mounts — use to play entry audio. */
  onMount?: () => void;
}

// ─── Squid Game design tokens (match squid-menu.css :root) ───────────────────

const SQ = {
  pink:   "#FF0066",
  teal:   "#00FFB2",
  gold:   "#FFD700",
  red:    "#FF3333",
  darker: "#050508",
} as const;

// ─── Reusable arcade button ───────────────────────────────────────────────────

interface ArcadeButtonProps {
  onClick: () => void;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}

const ArcadeButton: React.FC<ArcadeButtonProps> = ({
  onClick, color, size = "md", className = "", children,
}) => {
  const padding = { sm: "10px 24px", md: "14px 40px", lg: "16px 52px" }[size];
  const fontSize = { sm: 13, md: 15, lg: 18 }[size];

  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`font-bebas tracking-widest border transition-all duration-200 ${className}`}
      style={{
        padding,
        fontSize,
        fontFamily: "'Bebas Neue', sans-serif",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        cursor: "pointer",
        borderColor: `${color}60`,
        color: color,
        background: hovered ? `${color}20` : `${color}08`,
        boxShadow: hovered
          ? `0 0 28px ${color}55, 0 0 6px ${color}30`
          : `0 0 15px ${color}22`,
        transform: hovered ? "translateX(4px)" : "translateX(0)",
        transition: "all 0.18s ease",
      }}
    >
      {children}
    </button>
  );
};

// ─── SymbolTrio (○ △ □) ──────────────────────────────────────────────────────

const SymbolTrio: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    className="flex items-center gap-3 justify-center"
    style={{ opacity: 0.55 }}
  >
    {/* Circle */}
    <div
      style={{
        width: size, height: size,
        borderRadius: "50%",
        border: `2px solid ${SQ.teal}`,
        boxShadow: `0 0 8px ${SQ.teal}80`,
      }}
    />
    {/* Triangle */}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polygon
        points="12,2 22,22 2,22"
        stroke={SQ.pink}
        strokeWidth="2"
        fill="none"
        style={{ filter: `drop-shadow(0 0 4px ${SQ.pink}80)` }}
      />
    </svg>
    {/* Square */}
    <div
      style={{
        width: size, height: size,
        border: `2px solid ${SQ.gold}`,
        boxShadow: `0 0 8px ${SQ.gold}80`,
      }}
    />
  </div>
);

// ─── Main ResultScreen ────────────────────────────────────────────────────────

export const ResultScreen: React.FC<ResultScreenProps> = ({
  outcome,
  prize,
  statLine,
  onTryAgain,
  onMenu,
  onMount,
}) => {
  const isVictory = outcome === "victory";
  const accentColor = isVictory ? SQ.gold : SQ.red;
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      onMount?.();
    }
  }, [onMount]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50 scanlines anim-result-enter"
      style={{ background: "rgba(0,0,0,0.92)" }}
    >
      <div className="text-center" style={{ maxWidth: 480, width: "90%" }}>

        {/* ── Main title ── */}
        <div
          className={`font-bebas mb-3 ${isVictory ? "anim-victory" : "anim-eliminated"}`}
          style={{
            fontSize: "clamp(56px, 14vw, 112px)",
            color: accentColor,
            textShadow: `0 0 40px ${accentColor}, 0 0 80px ${accentColor}50`,
            lineHeight: 1,
          }}
        >
          {isVictory ? "SURVIVOR" : "ELIMINATED"}
        </div>

        {/* ── Korean subtitle ── */}
        <p className="font-korean text-white/50 mb-2" style={{ fontSize: 15 }}>
          {isVictory ? "생존자" : "탈락"}
        </p>

        {/* ── Stat line ── */}
        {statLine && (
          <p
            className="font-mono-sq text-white/30 text-xs tracking-widest mb-4"
            style={{ letterSpacing: "0.2em" }}
          >
            {statLine}
          </p>
        )}

        {/* ── Prize card (victory only) ── */}
        {isVictory && prize != null && (
          <div
            className="glass rounded-xl px-8 py-4 my-5 border mx-auto inline-block"
            style={{ borderColor: `${SQ.gold}30` }}
          >
            <p className="font-mono-sq text-xs text-white/40 mb-1">PRIZE ADDED</p>
            <p className="font-bebas text-4xl" style={{ color: SQ.gold }}>
              ₩ {prize.toLocaleString()}
            </p>
          </div>
        )}

        {/* ── Symbols ── */}
        <div className="flex justify-center my-5">
          <SymbolTrio size={isVictory ? 22 : 18} />
        </div>

        {/* ── Section divider ── */}
        <div className="section-divider mb-7" />

        {/* ── Action buttons ── */}
        <div className="flex flex-col items-center gap-4">
          <ArcadeButton
            onClick={onTryAgain}
            color={accentColor}
            size="lg"
            className="anim-btn-ready-1"
          >
            ▶ TRY AGAIN
          </ArcadeButton>

          <ArcadeButton
            onClick={onMenu}
            color={SQ.pink}
            size="sm"
            className="anim-btn-ready-2"
          >
            ◀ MENU
          </ArcadeButton>
        </div>

        {/* ── Footer label ── */}
        <p
          className="font-mono-sq text-white/15 text-xs mt-8 tracking-widest"
          style={{ letterSpacing: "0.25em" }}
        >
          456 — 오징어 게임
        </p>

      </div>
    </div>
  );
};

export default ResultScreen;
