// src/components/games/DalgonaCandy.tsx
"use client";

import React, { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { SoundManager } from "@/managers/SoundManager";

interface DalgonaCandyProps {
  onExit?: () => void;
  onComplete?: (score: number, outcome: "victory" | "eliminated") => void;
}

export default function DalgonaCandy({ onExit, onComplete }: DalgonaCandyProps) {
  const triggerElimination = useGameStore((s) => s.triggerElimination);
  const setRuntimePhase    = useGameStore((s) => s.setRuntimePhase);
  const difficulty         = useGameStore((s) => s.settings.difficulty);
  const dalgonaLevel       = useGameStore((s) => s.dalgonaLevel);

  const timeLimit = difficulty === "easy" ? 60 : difficulty === "hard" ? 30 : 45;
  const timerRef = React.useRef(timeLimit);
  const eliminatedFiredRef = React.useRef(false);

  useEffect(() => {
    useGameStore.setState({ hud: { ...useGameStore.getState().hud, time: timeLimit } });
    
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      if (state.runtimePhase !== "playing" || eliminatedFiredRef.current) return;
      
      timerRef.current -= 1;
      useGameStore.setState({ hud: { ...state.hud, time: Math.max(0, timerRef.current) } });
      
      if (timerRef.current <= 0) {
        eliminatedFiredRef.current = true;
        triggerElimination({ sourceGame: "dalgona", reason: "TIME OUT" });
        if (onComplete) onComplete(0, "eliminated");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLimit, triggerElimination, onComplete]);

  useEffect(() => {
    return () => {
      SoundManager.getInstance().stopAll(0);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data.type !== 'string') return;
      
      switch (e.data.type) {
        case 'DALGONA_SUCCESS':
          if (eliminatedFiredRef.current) return;
          setRuntimePhase("victory");
          useGameStore.getState().incrementDalgonaLevel();
          if (onComplete) onComplete(Math.floor((timerRef.current / timeLimit) * 15000), "victory");
          break;
        case 'DALGONA_ELIMINATED':
          if (eliminatedFiredRef.current) return;
          eliminatedFiredRef.current = true;
          triggerElimination({ sourceGame: "dalgona", reason: e.data.reason || "candy-snapped" });
          if (onComplete) onComplete(0, "eliminated");
          break;
        case 'DALGONA_MENU':
          SoundManager.getInstance().play("back");
          if (onExit) onExit();
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onExit, onComplete, triggerElimination, setRuntimePhase]);

  return (
    <div style={{ width: "100%", height: "100%", background: "#080401", position: "relative" }}>

      <iframe 
        src={`/dalgona.html?diff=${difficulty}&level=${dalgonaLevel}`} 
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Dalgona Candy"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}