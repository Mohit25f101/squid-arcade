// src/components/layout/GameRouter.tsx

"use client";

import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useGameStore, selectIsTransitioning, type GameId } from "@/store/gameStore";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import GameShell from "@/components/GameShell";
import GameMenu from "@/components/ui/GameMenu";
import { useViewport } from "@/hooks/useViewport";

const DalgonaCandy = lazy(() => import("@/components/games/DalgonaCandy"));
const GlassBridge = lazy(() => import("@/components/games/GlassBridge"));
const RedLightGreenLight = lazy(() => import("@/components/games/RedLightGreenLight"));

export default function GameRouter() {
   useViewport(); 
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

        {activeGame === "glass-bridge" && (
          // showGlobalHUD=false: GlassBridge has its own canvas-rendered HUD.
          // onExit is NOT passed here yet — GlassBridge manages its own back button
          // because it runs outside GameShell's ResizeObserver context (Priority 3).
          <SceneWrapper key="glass-bridge" transition={transitionState} showGlobalHUD={false}>
            <GlassBridge onExit={handleExit} />
          </SceneWrapper>
        )}

        {activeGame === "red-light-green-light" && (
          // showGlobalHUD=false: RLGL has its own canvas-rendered HUD.
          // onExit is NOT passed here yet — same reason as GlassBridge (Priority 3).
          <SceneWrapper key="red-light-green-light" transition={transitionState} showGlobalHUD={false}>
            <RedLightGreenLight onExit={handleExit} />
          </SceneWrapper>
        )}

        {activeGame === "dalgona" && (
          // DalgonaCandy IS fully wrapped in GameShell. Pass onExit here so
          // GameShell renders GameNav at z:300, and DalgonaCandy's inline back
          // button can be removed (see Change 3 below).
          <GameShell
            key="dalgona"
            worldW={390}
            worldH={844}
            transition={transitionState}
            onExit={handleExit}
          >
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
  showGlobalHUD = true,
  onExit,
}: {
  children: React.ReactNode;
  transition?: string;
  showGlobalHUD?: boolean;
  onExit?: () => void;
}) {
  return (
    <GameShell
      worldW={1280}
      worldH={720}
      transition={transition}
      showGlobalHUD={showGlobalHUD}
      onExit={onExit}
    >
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