"use client";

import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useGameStore, selectIsTransitioning, type GameId } from "@/store/gameStore";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import GameShell from "@/components/GameShell";
import GameMenu from "@/components/ui/GameMenu";

const DalgonaCandy = lazy(() => import("@/components/games/DalgonaCandy"));
const GlassBridge = lazy(() => import("@/components/games/GlassBridge"));
const RedLightGreenLight = lazy(() => import("@/components/games/RedLightGreenLight"));

export default function GameRouter() {
  const activeGame = useGameStore((s) => s.activeGame);
  const setActiveGame = useGameStore((s) => s.setActiveGame);
  const runtimePhase = useGameStore((s) => s.runtimePhase);
  
  usePlatformDetection();

  const handleExit = () => setActiveGame("menu");
  // P2-4: Transition curtain orchestration.
// Drives: "idle" → "entering" → "active" → "leaving" → "idle"
// on every activeGame change. Total budget: 500ms (200 in + 100 hold + 200 out).
// GameShell's TransitionCurtain reads this value via the `transition` prop.
const [transitionState, setTransitionState] = useState("idle");
const prevGameRef = useRef(activeGame);

useEffect(() => {
  // Skip the very first render — no previous game to transition from.
  if (prevGameRef.current === activeGame) return;
  prevGameRef.current = activeGame;

  // Step 1: curtain sweeps in
  setTransitionState("entering");

  const t1 = setTimeout(() => {
    // Step 2: fully opaque — safe moment to swap scene (React already did it)
    setTransitionState("active");
  }, 200);

  const t2 = setTimeout(() => {
    // Step 3: curtain sweeps out
    setTransitionState("leaving");
  }, 300);

  const t3 = setTimeout(() => {
    // Step 4: curtain gone, interaction restored
    setTransitionState("idle");
  }, 500);

  return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
}, [activeGame]);

  return (
    <div className="game-router-root" data-game={activeGame} style={{ width: "100%", height: "100%" }}>
      <div
        className="transition-curtain"
        aria-hidden="true"
        data-state={runtimePhase}
      />

      <Suspense fallback={<LoadingScreen />}>
        {/* Explicitly typed 'id: string' to fix Error 7006 */}
        {activeGame === "menu" && (
          <GameMenu onLaunch={(id: GameId) => setActiveGame(id)} />
        )}
        
        // AFTER:
{activeGame === "glass-bridge" && (
  <SceneWrapper key="glass-bridge" transition={transitionState}>
    <GlassBridge onExit={handleExit} />
  </SceneWrapper>
)}

{activeGame === "red-light-green-light" && (
  <SceneWrapper key="red-light-green-light" transition={transitionState}>
    <RedLightGreenLight onExit={handleExit} />
  </SceneWrapper>
)}

{activeGame === "dalgona" && (
  <GameShell key="dalgona" worldW={390} worldH={844} transition={transitionState}>
    <DalgonaCandy onExit={handleExit} />
  </GameShell>
)}
      </Suspense>
    </div>
  );
}

function SceneWrapper({
  children,
  transition = "idle",
}: {
  children: React.ReactNode;
  transition?: string;
}) {
  return (
    <GameShell worldW={1280} worldH={720} transition={transition}>
      {children}
    </GameShell>
  );
}


function LoadingScreen() {
  return (
    <div style={{ color: "white", display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#000" }}>
      <span style={{ fontFamily: "monospace", letterSpacing: "2px" }}>LOADING SYSTEM...</span>
    </div>
  );
}