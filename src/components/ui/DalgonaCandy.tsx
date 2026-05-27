"use client";

import React, { useEffect, useState } from "react";
import ResultScreen from "./ResultScreen";
import { useMenuAudio } from "@/hooks/useMenuAudio";

interface DalgonaCandyProps {
  onMenu?: () => void;
  onExit?: () => void;
}

export default function DalgonaCandy({ onMenu, onExit }: DalgonaCandyProps) {
  const handleMenu = onMenu ?? onExit;
  const [result, setResult] = useState<{ outcome: "victory" | "eliminated"; prize: number } | null>(null);
  const audio = useMenuAudio();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "DALGONA_RESULT") return;
      const { outcome, prize = 0 } = e.data;
      setResult({ outcome, prize });
      audio.stopBg();
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [audio]);

  const handleRestart = () => {
    setResult(null);
    audio.play("transition");
    // Force iframe reload to restart the game
    const iframe = document.getElementById("dalgona-frame") as HTMLIFrameElement;
    if (iframe) iframe.src = iframe.src;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* ── Escape hatch ── */}
      {handleMenu && !result && (
        <button
          onClick={handleMenu}
          style={{
            position: "absolute", top: 16, left: 16, zIndex: 50,
            padding: "10px 20px", background: "rgba(0,0,0,0.70)",
            color: "#fff", border: "1px solid rgba(255,0,102,0.55)",
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14,
            letterSpacing: "0.18em", cursor: "pointer",
            backdropFilter: "blur(6px)", textTransform: "uppercase",
          }}
        >
          ◀ MENU
        </button>
      )}

      <iframe
        id="dalgona-frame"
        src="/dalgona.html"
        style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
        title="Dalgona Candy Game"
      />

      {/* ── Result Screen Overlay ── */}
      {result && (
        <ResultScreen
          outcome={result.outcome}
          prize={result.prize}
          statLine="DALGONA"
          onTryAgain={handleRestart}
          onMenu={handleMenu ?? (() => {})}
          onMount={() => audio.play(result.outcome === "victory" ? "open" : "exit")}
        />
      )}
    </div>
  );
}