/**
 * src/components/ui/ResultScreen.tsx  —  Phase 7 additions
 *
 * DIFF vs Phase 6:
 *   + onContinue / onReplay / onMenu props aligned with GameRouter
 *   + "Survived X of 3" session counter (FIX 7.2)
 *   + Session progress bar (games played in current run)
 *   + Best score display uses bestScores from store
 *
 * NOTE: This file extends the Phase 4/6 ResultScreen. Only the NEW
 * additions are documented below — integrate the sections marked
 * [PHASE 7 ADD] into the existing component file.
 */

"use client";

import { motion } from "framer-motion";
import { useGameStore, selectSessionStats, type GameId } from "@/store/gameStore";

// ─── Prop interface (Phase 7 update) ─────────────────────────────────────────

export interface ResultScreenProps {
  gameId?:      GameId;
  onContinue?:  () => void;    // next game or session-end
  onReplay?:    () => void;    // play same game again
  onMenu?:      () => void;    // back to main menu (abandons session)
  // Legacy props for game components
  outcome?:     "victory" | "eliminated";
  statLine?:    string;
  prize?:       number;
  onTryAgain?:  () => void;
}

// ─── [PHASE 7 ADD] SessionProgressBar ────────────────────────────────────────
// Drop this sub-component into the ResultScreen JSX above the CTA buttons.

interface SessionProgressProps {
  survived: number;
  played:   number;
  total:    number;
}

export function SessionProgressBar({ survived, played, total }: SessionProgressProps) {
  const pct = (played / 3) * 100;

  return (
    <div style={spStyles.wrapper}>
      <div style={spStyles.labelRow}>
        <span style={spStyles.label}>SESSION PROGRESS</span>
        <span style={spStyles.count}>
          <span style={{ color: "#00FFB2" }}>{survived}</span>
          {" survived · "}
          <span style={{ color: "rgba(255,255,255,0.5)" }}>{played} of 3 played</span>
        </span>
      </div>
      <div style={spStyles.track}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          style={{
            ...spStyles.fill,
            background: survived === played
              ? "#00FFB2"     // all played games were victories
              : "#FF0066",    // at least one elimination
          }}
        />
      </div>
      {/* Game dots */}
      <div style={spStyles.dots}>
        {[0, 1, 2].map((i) => {
          const entry = useGameStore.getState().sessionHistory[i];
          const color = !entry
            ? "rgba(255,255,255,0.12)"
            : entry.outcome === "victory"
            ? "#00FFB2"
            : "#FF0066";
          return (
            <div key={i} style={{ ...spStyles.dot, background: color }} />
          );
        })}
      </div>
    </div>
  );
}

const spStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display:       "flex",
    flexDirection: "column",
    gap:           8,
    padding:       "16px 0",
    borderTop:     "1px solid rgba(255,255,255,0.06)",
  },
  labelRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "baseline",
  },
  label: {
    fontFamily:   "'DM Mono', monospace",
    fontSize:     8,
    letterSpacing: "0.28em",
    color:        "rgba(255,255,255,0.28)",
    textTransform: "uppercase",
  },
  count: {
    fontFamily:   "'DM Mono', monospace",
    fontSize:     10,
    letterSpacing: "0.1em",
  },
  track: {
    height:       4,
    background:   "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow:     "hidden",
  },
  fill: {
    height:       "100%",
    borderRadius: 2,
    minWidth:     4,
  },
  dots: {
    display: "flex",
    gap:     8,
    marginTop: 4,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: "50%",
    flexShrink:   0,
  },
};

// ─── [PHASE 7 ADD] Integration instructions ───────────────────────────────────
//
// 1. Replace the existing ResultScreenProps interface with the one above.
//
// 2. Inside the ResultScreen component body, add:
//
//      const { survived, total, played } = useGameStore(selectSessionStats);
//      const bestScores = useGameStore((s) => s.bestScores);
//
// 3. Render <SessionProgressBar> above the CTA button row:
//
//      <SessionProgressBar survived={survived} played={played} total={total} />
//
// 4. Replace the existing button wiring:
//      - "CONTINUE" → calls onContinue
//      - "PLAY AGAIN" → calls onReplay
//      - "MENU" → calls onMenu
//
// 5. Update best-score display:
//      bestScores[gameId] ?? 0  (instead of any local state)
//
// 6. The "CONTINUE" button label should contextualise based on session state:
//
//      const lastEntry = sessionHistory[sessionHistory.length - 1];
//      const isEliminated = lastEntry?.outcome === "eliminated";
//      const nextGame = getNextGame(gameId);   // import from GameRouter or inline
//
//      label = isEliminated
//        ? "END SESSION"
//        : nextGame
//        ? "NEXT GAME →"
//        : "FINISH SESSION";
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── ResultScreen Component ──────────────────────────────────────────────────

export function ResultScreen({
  gameId,
  onContinue,
  onReplay,
  onMenu,
  // Legacy props
  outcome,
  statLine,
  prize,
  onTryAgain,
}: ResultScreenProps) {
  // Determine if using new or legacy interface
  const isLegacy = outcome !== undefined;
  
  // Use legacy interface if provided
  if (isLegacy) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(5, 8, 16, 0.95)",
          backdropFilter: "blur(4px)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 200,
          fontFamily: "'DM Mono', monospace",
          padding: "40px 20px",
        }}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            textAlign: "center",
            maxWidth: 500,
          }}
        >
          {/* Outcome */}
          <div style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: "bold", color: outcome === "victory" ? "#00FFB2" : "#FF0066", marginBottom: 32, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {outcome}
          </div>

          {/* Stat Line */}
          {statLine && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${outcome === "victory" ? "#00FFB2" : "#FF0066"}`,
                borderRadius: 8,
                padding: "24px",
                marginBottom: 32,
                fontSize: 14,
                letterSpacing: "0.1em",
              }}
            >
              {statLine}
            </motion.div>
          )}

          {/* Prize if applicable */}
          {prize && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                fontSize: 12,
                color: "#FFD700",
                marginBottom: 32,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Prize: ₩{prize.toLocaleString()}
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 40,
              width: "100%",
            }}
          >
            <button
              onClick={onTryAgain}
              style={{
                background: outcome === "victory" ? "#00FFB2" : "#FF0066",
                color: "#050810",
                border: "none",
                padding: "14px 28px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 12,
                fontWeight: "bold",
                letterSpacing: "0.2em",
                cursor: "pointer",
                textTransform: "uppercase",
                borderRadius: 4,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "0.8";
                (e.target as HTMLButtonElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "1";
                (e.target as HTMLButtonElement).style.transform = "translateY(0)";
              }}
            >
              TRY AGAIN
            </button>

            <button
              onClick={onMenu}
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "14px 28px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.2em",
                cursor: "pointer",
                textTransform: "uppercase",
                borderRadius: 4,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.5)";
                (e.target as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
                (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
              }}
            >
              MENU
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  // New interface for session-level results
  const { survived, total, played } = useGameStore((s) => selectSessionStats(s));
  const sessionHistory = useGameStore((s) => s.sessionHistory);
  const bestScores = useGameStore((s) => s.bestScores);

  const lastEntry = sessionHistory[sessionHistory.length - 1];
  const isEliminated = lastEntry?.outcome === "eliminated";
  
  const GAME_LABELS: Record<GameId, string> = {
    "red-light-green-light": "Red Light, Green Light",
    "glass-bridge": "Glass Bridge",
    "dalgona": "Dalgona Candy",
    "glass-breaker": "Glass Breaker",
    "menu": "Menu"
  };

  const gameLabel = GAME_LABELS[gameId!] ?? "Unknown Game";
  const currentScore = lastEntry?.score ?? 0;
  const bestScore = bestScores[gameId!] ?? 0;

  const outcomeColor = isEliminated ? "#FF0066" : "#00FFB2";
  const outcomeText = isEliminated ? "ELIMINATED" : "VICTORY";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 8, 16, 0.95)",
        backdropFilter: "blur(4px)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        fontFamily: "'DM Mono', monospace",
        padding: "40px 20px",
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          textAlign: "center",
          maxWidth: 500,
        }}
      >
        {/* Game Title */}
        <div style={{ fontSize: 12, letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)", marginBottom: 24, textTransform: "uppercase" }}>
          {gameLabel}
        </div>

        {/* Outcome */}
        <div style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: "bold", color: outcomeColor, marginBottom: 32, letterSpacing: "0.1em" }}>
          {outcomeText}
        </div>

        {/* Score Display */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${outcomeColor}`,
            borderRadius: 8,
            padding: "24px",
            marginBottom: 32,
          }}
        >
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.2em", marginBottom: 8 }}>SCORE</div>
          <div style={{ fontSize: 28, fontWeight: "bold", color: outcomeColor, marginBottom: 16 }}>
            {currentScore}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>
            Best: <span style={{ color: outcomeColor }}>{bestScore}</span>
          </div>
        </motion.div>

        {/* Session Progress Bar */}
        <SessionProgressBar survived={survived} played={played} total={total} />

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 40,
            width: "100%",
          }}
        >
          <button
            onClick={onContinue}
            style={{
              background: outcomeColor,
              color: "#050810",
              border: "none",
              padding: "14px 28px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              fontWeight: "bold",
              letterSpacing: "0.2em",
              cursor: "pointer",
              textTransform: "uppercase",
              borderRadius: 4,
              transition: "all 0.2s ease",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.opacity = "0.8";
              (e.target as HTMLButtonElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.opacity = "1";
              (e.target as HTMLButtonElement).style.transform = "translateY(0)";
            }}
          >
            {isEliminated ? "END SESSION" : "CONTINUE →"}
          </button>

          <button
            onClick={onReplay}
            style={{
              background: "transparent",
              color: outcomeColor,
              border: `1px solid ${outcomeColor}`,
              padding: "14px 28px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.2em",
              cursor: "pointer",
              textTransform: "uppercase",
              borderRadius: 4,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = `${outcomeColor}20`;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = "transparent";
            }}
          >
            PLAY AGAIN
          </button>

          <button
            onClick={onMenu}
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "14px 28px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.2em",
              cursor: "pointer",
              textTransform: "uppercase",
              borderRadius: 4,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.5)";
              (e.target as HTMLButtonElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
              (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
            }}
          >
            MENU
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default ResultScreen;