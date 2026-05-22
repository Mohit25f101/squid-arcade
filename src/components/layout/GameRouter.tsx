"use client";

import { lazy, Suspense } from "react";
import { useGameStore, selectIsTransitioning, type GameId } from "@/store/gameStore";
import { usePlatformDetection } from "@/hooks/usePlatformDetection"
import GameShell from "@/components/GameShell";
// Make sure this points to your new cinematic menu!
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
        
        {activeGame === "glass-bridge" && (
          <SceneWrapper key="glass-bridge">
            <GlassBridge onExit={handleExit} />
          </SceneWrapper>
        )}
        
        {activeGame === "red-light-green-light" && (
          <SceneWrapper key="red-light-green-light">
            <RedLightGreenLight onExit={handleExit} />
          </SceneWrapper>
        )}

        {activeGame === "dalgona" && (
          <GameShell key="dalgona" worldW={390} worldH={844}>
            <DalgonaCandy onExit={handleExit} />
          </GameShell>
        )}
      </Suspense>
    </div>
  );
}

function SceneWrapper({ children }: { children: React.ReactNode }) {
  const runtimePhase = useGameStore((s) => s.runtimePhase);
  return (
    <div className="scene-wrapper" data-transition={runtimePhase} style={{ width: "100%", height: "100%" }}>
      {children}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ color: "white", display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#000" }}>
      <span style={{ fontFamily: "monospace", letterSpacing: "2px" }}>LOADING SYSTEM...</span>
    </div>
  );
}