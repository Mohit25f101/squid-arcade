"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback } from "react";
import { AnimatePresence } from "framer-motion";

import { useGameStore, type GameId } from "@/store/gameStore";
import GameBriefing    from "@/components/ui/GameBriefing";
import SessionSummary  from "@/components/ui/SessionSummary";
import Leaderboard     from "@/components/ui/Leaderboard";

const GameMenu = dynamic(() => import("@/components/ui/GameMenu"), { ssr: false });

// Safely map the ResultScreen named export to the default export expected by dynamic()
const ResultScreen = dynamic(() => import("@/components/ui/ResultScreen").then(m => ({ default: m.ResultScreen })), { ssr: false });

const RedLightGreenLight = dynamic(() => import("@/components/games/RedLightGreenLight"), { ssr: false });
const GlassBridge = dynamic(() => import("@/components/games/GlassBridge"), { ssr: false });
const DalgonaCandy = dynamic(() => import("@/components/games/DalgonaCandy"), { ssr: false });

const GAME_ORDER: GameId[] = [
  "red-light-green-light",
  "dalgona",
  "glass-bridge",
];

function getNextGame(current: GameId): GameId | null {
  const idx = GAME_ORDER.indexOf(current);
  return idx === -1 || idx === GAME_ORDER.length - 1 ? null : GAME_ORDER[idx + 1];
}

function GameLoader() {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#07080f", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.32em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
        Loading…
      </div>
    </div>
  );
}

export default function GameRouter() {
  const currentView    = useGameStore((s) => s.currentView);
  const activeGameId   = useGameStore((s) => s.activeGame);
  const sessionHistory = useGameStore((s) => s.sessionHistory);
  const sessionId      = useGameStore((s) => s.sessionId);

  const setActiveGame          = useGameStore((s) => s.setActiveGame);
  const clearActiveGame        = useGameStore((s) => s.clearActiveGame);
  const setView                = useGameStore((s) => s.setView);
  const recordGameCompletion   = useGameStore((s) => s.recordGameCompletion);
  const startNewSession        = useGameStore((s) => s.startNewSession);

  const handleGameSelect = useCallback((id: GameId) => {
    setActiveGame(id);
  }, [setActiveGame]);

  const handleBriefingBegin = useCallback(() => {
    setView("game");
  }, [setView]);

  const handleBriefingBack = useCallback(() => {
    clearActiveGame();
  }, [clearActiveGame]);

  const handleGameBack = useCallback(() => {
    clearActiveGame();
  }, [clearActiveGame]);

  const handleGameComplete = useCallback(
    (score: number, outcome: "victory" | "eliminated") => {
      if (!activeGameId || activeGameId === "menu") return;

      recordGameCompletion({
        gameId:    activeGameId,
        outcome,
        score,
        timestamp: Date.now(),
      });
    },
    [activeGameId, recordGameCompletion]
  );

  const handleResultContinue = useCallback(() => {
    if (!activeGameId || activeGameId === "menu") return;
    const lastOutcome = sessionHistory[sessionHistory.length - 1]?.outcome;

    if (lastOutcome === "eliminated") {
      clearActiveGame();
      setView("session-end");
      return;
    }

    const next = getNextGame(activeGameId);
    if (!next) {
      clearActiveGame();
      setView("session-end");
      return;
    }
    setActiveGame(next);
  }, [activeGameId, sessionHistory, clearActiveGame, setView, setActiveGame]);

  const handleResultReplay = useCallback(() => {
    if (!activeGameId || activeGameId === "menu") return;
    setActiveGame(activeGameId);
  }, [activeGameId, setActiveGame]);

  const handleResultMenu = useCallback(() => {
    clearActiveGame();
  }, [clearActiveGame]);

  const handleNewSession = useCallback(() => {
    startNewSession();
  }, [startNewSession]);

  const handleViewLeaderboard = useCallback(() => {
    setView("leaderboard");
  }, [setView]);

  const handleLeaderboardBack = useCallback(() => {
    const hasSummary = sessionHistory.length > 0;
    setView(hasSummary ? "session-end" : "menu");
  }, [sessionHistory.length, setView]);

  function renderGame() {
    if (!activeGameId || activeGameId === "menu") return null;
    
    // Cast sharedProps to any to satisfy older component prop signatures
    // while injecting the new Phase 7 handlers
    const sharedProps: any = {
      onComplete: handleGameComplete,
      onBack:     handleGameBack,
      onExit:     handleGameBack,
    };
    
    switch (activeGameId) {
      case "red-light-green-light":
        return <RedLightGreenLight {...sharedProps} />;
      case "glass-bridge":
        return <GlassBridge {...sharedProps} />;
      case "dalgona":
        return <DalgonaCandy {...sharedProps} />;
      default:
        clearActiveGame();
        return null;
    }
  }

  // Casting components as `any` in JSX bypasses TS strict checks 
  // on dynamically imported components that have changing prop signatures
  const MenuComp: any = GameMenu;
  const ResultComp: any = ResultScreen;

  return (
    <Suspense fallback={<GameLoader />}>
      <AnimatePresence mode="wait">

        {currentView === "menu" && (
          <MenuComp
            key="menu"
            onLaunch={handleGameSelect}
            onHighScores={handleViewLeaderboard}
          />
        )}

        {currentView === "briefing" && activeGameId && activeGameId !== "menu" && (
          <GameBriefing
            key={`briefing-${activeGameId}`}
            gameId={activeGameId}
            onBegin={handleBriefingBegin}
            onBack={handleBriefingBack}
          />
        )}

        {currentView === "game" && activeGameId && activeGameId !== "menu" && (
          <div key={`game-${activeGameId}`} style={{ position: "fixed", inset: 0 }}>
            {renderGame()}
          </div>
        )}

        {currentView === "result" && activeGameId && activeGameId !== "menu" && (
          <ResultComp
            key={`result-${activeGameId}`}
            outcome={sessionHistory[sessionHistory.length - 1]?.outcome ?? "eliminated"}
            statLine={`SCORE: ${sessionHistory[sessionHistory.length - 1]?.score ?? 0}`}
            onTryAgain={handleResultReplay}
            onMenu={handleResultMenu}
            onContinue={handleResultContinue}
          />
        )}

        {currentView === "session-end" && (
          <SessionSummary
            key="session-end"
            onNewSession={handleNewSession}
            onViewLeaderboard={handleViewLeaderboard}
          />
        )}

        {currentView === "leaderboard" && (
          <Leaderboard
            key="leaderboard"
            onBack={handleLeaderboardBack}
            highlightSession={sessionId}
          />
        )}

      </AnimatePresence>
    </Suspense>
  );
}