"use client";

import React, { useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore, selectHUD, selectSettings } from "../../store/gameStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HUDProps {
  showFPS?: boolean;
  currentFPS?: number;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const TOKEN = {
  fontMono:    "'JetBrains Mono', 'Fira Mono', monospace",
  fontDisplay: "'Rajdhani', 'Oswald', sans-serif",
  colorAccent: "#00f5c4",
  colorDanger: "#ff3d5a",
  colorWarn:   "#ffb800",
  colorMuted:  "rgba(255,255,255,0.35)",
  colorPanel:  "rgba(0,0,0,0.52)",
  colorBorder: "rgba(255,255,255,0.08)",
  blur:        "blur(10px)",
} as const;

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatScore(n: number): string {
  return n.toLocaleString("en-US", { minimumIntegerDigits: 7, useGrouping: true });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// ── Health Bar ────────────────────────────────────────────────────────────────

const HealthBar = memo(function HealthBar({
  health,
  maxHealth,
}: {
  health: number;
  maxHealth: number;
}) {
  const pct        = Math.max(0, Math.min(1, health / maxHealth));
  const isLow      = pct < 0.3;
  const isCritical = pct < 0.15;

  const barColor = isCritical
    ? TOKEN.colorDanger
    : isLow
      ? TOKEN.colorWarn
      : TOKEN.colorAccent;

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        gap:           4,
        minWidth:      160,
      }}
    >
      {/* Label row */}
      <div
        style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
        }}
      >
        <span
          style={{
            fontFamily:    TOKEN.fontDisplay,
            fontSize:      11,
            letterSpacing: "0.12em",
            color:         TOKEN.colorMuted,
            textTransform: "uppercase",
          }}
        >
          HP
        </span>
        <motion.span
          key={health}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            fontFamily: TOKEN.fontMono,
            fontSize:   12,
            color:      barColor,
            transition: "color 0.3s",
          }}
        >
          {health}
          <span style={{ color: TOKEN.colorMuted, fontSize: 10 }}>
            /{maxHealth}
          </span>
        </motion.span>
      </div>

      {/* Track */}
      <div
        style={{
          position:     "relative",
          height:       6,
          borderRadius: 3,
          background:   "rgba(255,255,255,0.08)",
          overflow:     "hidden",
        }}
      >
        {/* Fill */}
        <motion.div
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            position:     "absolute",
            inset:        0,
            borderRadius: 3,
            background:   barColor,
            boxShadow:    `0 0 8px ${barColor}99`,
          }}
        />

        {/* Critical pulse */}
        <AnimatePresence>
          {isCritical && (
            <motion.div
              key="critical-pulse"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              style={{
                position:   "absolute",
                inset:      0,
                borderRadius: 3,
                background: `${TOKEN.colorDanger}55`,
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

// ── Lives Display ─────────────────────────────────────────────────────────────

const LivesDisplay = memo(function LivesDisplay({ lives }: { lives: number }) {
  const MAX_DISPLAY = 5;

  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {Array.from({ length: MAX_DISPLAY }).map((_, i) => {
        const filled = i < lives;
        return (
          <motion.div
            key={i}
            initial={false}
            animate={{
              scale:   filled ? 1 : 0.7,
              opacity: filled ? 1 : 0.2,
            }}
            transition={{ duration: 0.2, ease: "backOut" }}
          >
            <HeartIcon filled={filled} />
          </motion.div>
        );
      })}
      {lives > MAX_DISPLAY && (
        <span
          style={{
            fontFamily: TOKEN.fontMono,
            fontSize:   11,
            color:      TOKEN.colorAccent,
          }}
        >
          +{lives - MAX_DISPLAY}
        </span>
      )}
    </div>
  );
});

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
      <path
        d="M7 12S1 8 1 4.5A3.5 3.5 0 017 2a3.5 3.5 0 016 2.5C13 8 7 12 7 12z"
        fill={filled ? TOKEN.colorDanger : "transparent"}
        stroke={filled ? TOKEN.colorDanger : "rgba(255,255,255,0.25)"}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Score Panel ───────────────────────────────────────────────────────────────

const ScorePanel = memo(function ScorePanel({
  score,
  highScore,
}: {
  score: number;
  highScore: number;
}) {
  const isNewBest = score > 0 && score >= highScore;

  return (
    <div style={{ textAlign: "center" }}>
      {/* High score */}
      <div
        style={{
          fontFamily:    TOKEN.fontMono,
          fontSize:      10,
          color:         TOKEN.colorMuted,
          letterSpacing: "0.1em",
          marginBottom:  2,
        }}
      >
        BEST{" "}
        <span style={{ color: isNewBest ? TOKEN.colorWarn : TOKEN.colorMuted }}>
          {formatScore(highScore)}
        </span>
      </div>

      {/* Current score */}
      <motion.div
        key={Math.floor(score / 100)}
        initial={{ y: -6, opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{
          fontFamily:    TOKEN.fontDisplay,
          fontSize:      26,
          fontWeight:    700,
          letterSpacing: "0.04em",
          color:         "#fff",
          lineHeight:    1,
        }}
      >
        {formatScore(score)}
      </motion.div>
    </div>
  );
});

// ── Combo Indicator ───────────────────────────────────────────────────────────

const ComboIndicator = memo(function ComboIndicator({
  combo,
}: {
  combo: number;
}) {
  if (combo < 2) return null;

  const tier =
    combo >= 20 ? "legendary" :
    combo >= 10 ? "epic"      :
    combo >= 5  ? "rare"      : "common";

  const tierColor = {
    common:    TOKEN.colorAccent,
    rare:      "#a78bfa",
    epic:      "#f59e0b",
    legendary: TOKEN.colorDanger,
  }[tier];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`combo-${combo}`}
        initial={{ scale: 1.4, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        exit={{   scale: 0.8,  opacity: 0 }}
        transition={{ duration: 0.18, ease: "backOut" }}
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          gap:            2,
        }}
      >
        <span
          style={{
            fontFamily:    TOKEN.fontDisplay,
            fontSize:      28,
            fontWeight:    700,
            color:         tierColor,
            lineHeight:    1,
            textShadow:    `0 0 16px ${tierColor}99`,
            letterSpacing: "0.02em",
          }}
        >
          {combo}
          <span style={{ fontSize: 14, marginLeft: 2 }}>×</span>
        </span>
        <span
          style={{
            fontFamily:    TOKEN.fontMono,
            fontSize:      9,
            color:         tierColor,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            opacity:       0.8,
          }}
        >
          combo
        </span>
      </motion.div>
    </AnimatePresence>
  );
});

// ── Level Badge ───────────────────────────────────────────────────────────────

const LevelBadge = memo(function LevelBadge({ level }: { level: number }) {
  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            1,
      }}
    >
      <span
        style={{
          fontFamily:    TOKEN.fontMono,
          fontSize:      9,
          color:         TOKEN.colorMuted,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Level
      </span>
      <motion.span
        key={level}
        initial={{ scale: 1.5, color: TOKEN.colorAccent }}
        animate={{ scale: 1,   color: "#ffffff" }}
        transition={{ duration: 0.35, ease: "backOut" }}
        style={{
          fontFamily:  TOKEN.fontDisplay,
          fontSize:    22,
          fontWeight:  700,
          lineHeight:  1,
        }}
      >
        {String(level).padStart(2, "0")}
      </motion.span>
    </div>
  );
});

// ── Coin Counter ──────────────────────────────────────────────────────────────

const CoinCounter = memo(function CoinCounter({ coins }: { coins: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <CoinIcon />
      <motion.span
        key={coins}
        initial={{ y: -4, opacity: 0.5 }}
        animate={{ y: 0,  opacity: 1   }}
        transition={{ duration: 0.15 }}
        style={{
          fontFamily:    TOKEN.fontMono,
          fontSize:      13,
          color:         TOKEN.colorWarn,
          letterSpacing: "0.04em",
        }}
      >
        {coins.toLocaleString()}
      </motion.span>
    </div>
  );
});

function CoinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" fill={TOKEN.colorWarn} opacity="0.9" />
      <circle cx="7" cy="7" r="4" fill="#b45309" opacity="0.6" />
      <text
        x="7" y="10.5"
        textAnchor="middle"
        fontSize="7"
        fill={TOKEN.colorWarn}
        fontFamily="serif"
        fontWeight="bold"
      >
        ¢
      </text>
    </svg>
  );
}

// ── Timer ─────────────────────────────────────────────────────────────────────

const Timer = memo(function Timer({ time }: { time: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <ClockIcon />
      <span
        style={{
          fontFamily:    TOKEN.fontMono,
          fontSize:      13,
          color:         "#fff",
          letterSpacing: "0.08em",
        }}
      >
        {formatTime(time)}
      </span>
    </div>
  );
});

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
      <line x1="6" y1="6" x2="6" y2="2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6" y1="6" x2="8.5" y2="6" stroke={TOKEN.colorAccent} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ── FPS Counter ───────────────────────────────────────────────────────────────

const FPSCounter = memo(function FPSCounter({ fps }: { fps: number }) {
  const isLow = fps < 30;
  const isMid = fps < 50;

  const color = isLow ? TOKEN.colorDanger : isMid ? TOKEN.colorWarn : TOKEN.colorAccent;

  return (
    <div
      style={{
        fontFamily:    TOKEN.fontMono,
        fontSize:      10,
        color,
        letterSpacing: "0.1em",
        textAlign:     "right",
      }}
    >
      {Math.round(fps)}
      <span style={{ color: TOKEN.colorMuted }}> fps</span>
    </div>
  );
});

// ── Glass Panel wrapper ───────────────────────────────────────────────────────

function GlassPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background:   TOKEN.colorPanel,
        backdropFilter: TOKEN.blur,
        WebkitBackdropFilter: TOKEN.blur,
        border:       `1px solid ${TOKEN.colorBorder}`,
        borderRadius: 10,
        padding:      "8px 14px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Main HUD ─────────────────────────────────────────────────────────────────

const HUD = memo(function HUD({ showFPS = false, currentFPS = 0 }: HUDProps) {
  const hud      = useGameStore(selectHUD);
  const settings = useGameStore(selectSettings);

  const shouldShowFPS = showFPS || settings.showFPS;

  return (
    <div
      aria-label="Game HUD"
      style={{
        position:      "absolute",
        inset:         0,
        pointerEvents: "none",
        zIndex:        50,
        fontFamily:    TOKEN.fontDisplay,
      }}
    >
      {/* ── TOP LEFT: Health + Lives ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0   }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          position: "absolute",
          top:      14,
          left:     14,
        }}
      >
        <GlassPanel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <HealthBar health={hud.health} maxHealth={hud.maxHealth} />
            <LivesDisplay lives={hud.lives} />
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── TOP CENTER: Score ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0   }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{
          position:  "absolute",
          top:       14,
          left:      "50%",
          transform: "translateX(-50%)",
        }}
      >
        <GlassPanel>
          <ScorePanel score={hud.score} highScore={hud.highScore} />
        </GlassPanel>
      </motion.div>

      {/* ── TOP RIGHT: Level + Timer + Coins ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0  }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          position: "absolute",
          top:      14,
          right:    14,
        }}
      >
        <GlassPanel>
          <div
            style={{
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "flex-end",
              gap:            8,
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Timer time={hud.time} />
              <LevelBadge level={hud.level} />
            </div>
            <CoinCounter coins={hud.coins} />
            {shouldShowFPS && <FPSCounter fps={currentFPS} />}
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── BOTTOM CENTER: Combo ──────────────────────────────────────────── */}
      <AnimatePresence>
        {hud.combo >= 2 && (
          <motion.div
            key="combo-panel"
            initial={{ opacity: 0, y: 20,  scale: 0.9 }}
            animate={{ opacity: 1, y: 0,   scale: 1   }}
            exit={{   opacity: 0, y: 10,  scale: 0.85 }}
            transition={{ duration: 0.25, ease: "backOut" }}
            style={{
              position:  "absolute",
              bottom:    24,
              left:      "50%",
              transform: "translateX(-50%)",
            }}
          >
            <GlassPanel style={{ padding: "10px 20px" }}>
              <ComboIndicator combo={hud.combo} />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default HUD;