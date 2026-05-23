// src/components/layout/GameRouter.tsx

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

  const [transitionState, setTransitionState] = useState("idle");
  const prevGameRef = useRef(activeGame);

  useEffect(() => {
    if (prevGameRef.current === activeGame) return;
    prevGameRef.current = activeGame;

    setTransitionState("entering");

    const t1 = setTimeout(() => setTransitionState("active"),  200);
    const t2 = setTimeout(() => setTransitionState("leaving"), 300);
    const t3 = setTimeout(() => setTransitionState("idle"),    500);

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
        {activeGame === "menu" && (
          <GameMenu onLaunch={(id: GameId) => setActiveGame(id)} />
        )}

       // In the JSX — add showGlobalHUD={false} to the two games with native HUDs:
        {activeGame === "glass-bridge" && (
          <SceneWrapper key="glass-bridge" transition={transitionState} showGlobalHUD={false}>
            <GlassBridge onExit={handleExit} />
          </SceneWrapper>
        )}

        {activeGame === "red-light-green-light" && (
          <SceneWrapper key="red-light-green-light" transition={transitionState} showGlobalHUD={false}>
            <RedLightGreenLight onExit={handleExit} />
          </SceneWrapper>
        )}

        {/* DalgonaCandy uses GameShell directly — showGlobalHUD defaults to true */}
        {activeGame === "dalgona" && (
          <GameShell key="dalgona" worldW={390} worldH={844} transition={transitionState}>
            <DalgonaCandy onExit={handleExit} />
          </GameShell>
        )}
      </Suspense>
    </div>
  );
}

// Replace the SceneWrapper helper at the bottom of the file:
function SceneWrapper({
  children,
  transition = "idle",
  showGlobalHUD = true,
}: {
  children: React.ReactNode;
  transition?: string;
  showGlobalHUD?: boolean;
}) {
  return (
    <GameShell worldW={1280} worldH={720} transition={transition} showGlobalHUD={showGlobalHUD}>
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