"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { ResultScreen } from "../ui/ResultScreen";

interface DalgonaCandyProps {
  onExit?: () => void;
}

type DalgonaMessageData =
  | { type: "DALGONA_ELIMINATED"; reason?: string }
  | { type: "DALGONA_SUCCESS" }
  | { type: "DALGONA_MENU" };

function isDalgonaMessage(data: unknown): data is DalgonaMessageData {
  if (!data || typeof data !== "object") return false;
  const t = (data as Record<string, unknown>).type;
  return (
    t === "DALGONA_ELIMINATED" ||
    t === "DALGONA_SUCCESS" ||
    t === "DALGONA_MENU"
  );
}

export default function DalgonaCandy({ onExit }: DalgonaCandyProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Local state for the Result Screen overlay
  const [resultState, setResultState] = useState<null | "victory" | "eliminated">(null);

  const triggerElimination = useGameStore((s) => s.triggerElimination);
  const setRuntimePhase    = useGameStore((s) => s.setRuntimePhase);
  const setActiveGame      = useGameStore((s) => s.setActiveGame);

  const handleMenuExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      setActiveGame("menu");
    }
  }, [onExit, setActiveGame]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isDalgonaMessage(event.data)) return;

      switch (event.data.type) {
        case "DALGONA_ELIMINATED":
          setResultState("eliminated");
          triggerElimination({
            sourceGame: "dalgona",
            reason: event.data.reason ?? "candy-snapped",
          });
          break;
        case "DALGONA_SUCCESS":
          setResultState("victory");
          setRuntimePhase("victory");
          break;
        case "DALGONA_MENU":
          handleMenuExit();
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [triggerElimination, setRuntimePhase, handleMenuExit]);

  return (
    <div style={{ 
      position: "relative", 
      width: "100%", 
      height: "100%",
      background: "radial-gradient(circle at 50% 40%, #2a1608 0%, #050507 80%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        boxShadow: "inset 0 0 150px rgba(0,0,0,0.95)",
        zIndex: 10
      }} />
      
      <iframe
        ref={iframeRef}
        src="/dalgona.html"
        style={{ 
          width: "100%", 
          height: "100%", 
          border: "none", 
          display: "block",
          filter: "contrast(1.1) sepia(0.2) saturate(1.2)"
        }}
        title="Dalgona Candy Game"
        allow="autoplay"
      />

      {/* Render the unified Result Screen over the iframe when the game ends */}
      {resultState !== null && (
        <div style={{ position: "absolute", inset: 0, zIndex: 100 }}>
          <ResultScreen 
            outcome={resultState}
            statLine={resultState === "victory" ? "DALGONA COMPLETED" : "CANDY BROKEN"} 
            prize={resultState === "victory" ? 45600000000 : undefined}
            onTryAgain={() => { 
              setResultState(null); 
              if (iframeRef.current && iframeRef.current.contentWindow) {
                  iframeRef.current.contentWindow.location.reload(); 
              }
            }} 
            onMenu={handleMenuExit} 
          />
        </div>
      )}
    </div>
  );
}