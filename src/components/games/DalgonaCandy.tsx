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
          SoundManager.getInstance().play("victory");
          setRuntimePhase("victory");
          if (onComplete) onComplete(15000, "victory");
          break;
        case 'DALGONA_ELIMINATED':
          SoundManager.getInstance().play("eliminated");
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
      <style>{`
        .landscape-warning { display: none; }
        @media (orientation: landscape) and (max-height: 600px) {
          .landscape-warning { display: flex !important; }
        }
      `}</style>
      <iframe 
        src="/dalgona.html" 
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Dalgona Candy"
        sandbox="allow-scripts allow-same-origin"
      />
      {/* Landscape Warning Overlay */}
      <div 
        className="landscape-warning flex-col items-center justify-center text-center p-8 absolute inset-0 z-[99999] bg-[#050508]"
      >
        <div className="font-bebas text-5xl text-[#FF0066] mb-4 neon-pink">ROTATE DEVICE</div>
        <div className="font-mono-sq text-white/70 text-sm tracking-widest uppercase">
          Dalgona must be played in portrait mode
        </div>
        <div className="mt-12 text-[#FF0066] opacity-80" style={{ animation: 'rotate-shape 2s ease-in-out infinite alternate', fontSize: '4rem' }}>
          ↶📱
        </div>
      </div>
    </div>
  );
}