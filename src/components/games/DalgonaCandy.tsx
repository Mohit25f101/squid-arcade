"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";

interface DalgonaCandyProps {
  onExit?: () => void;
}

// ── Discriminated union for type-safe postMessage handling ─────────────────
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

// ── Component ──────────────────────────────────────────────────────────────
export default function DalgonaCandy({ onExit }: DalgonaCandyProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Zustand store actions — selected individually to avoid re-renders
  const triggerElimination = useGameStore((s) => s.triggerElimination);
  const setRuntimePhase    = useGameStore((s) => s.setRuntimePhase);
  const setActiveGame      = useGameStore((s) => s.setActiveGame);

  // Stable exit handler: prefer the caller's onExit, fall back to routing
  const handleMenuExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      setActiveGame("menu");
    }
  }, [onExit, setActiveGame]);

  // ── postMessage bridge ─────────────────────────────────────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only accept messages from the same origin — Next.js serves dalgona.html
      if (event.origin !== window.location.origin) return;
      if (!isDalgonaMessage(event.data)) return;

      switch (event.data.type) {
        // Candy broke — pipe into the global elimination pipeline
        case "DALGONA_ELIMINATED":
          triggerElimination({
            sourceGame: "dalgona",
            reason: event.data.reason ?? "candy-snapped",
          });
          break;

        // Player completed the shape — signal victory to the shell
        case "DALGONA_SUCCESS":
          setRuntimePhase("victory");
          break;

        // Back button pressed inside the iframe — route to menu
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
      /* Cinematic Wrapper: Warm amber spotlight effect */
      background: "radial-gradient(circle at 50% 40%, #2a1608 0%, #050507 80%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      {/* Vignette overlay directly on top of the iframe to simulate realistic 
        camera lens shadowing and blend the iframe edges seamlessly.
      */}
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
          height: "100dvh", 
          border: "none", 
          display: "block",
          /* Add a subtle sepia/contrast filter to unify the iframe's colors */
          filter: "contrast(1.1) sepia(0.2) saturate(1.2)"
        }}
        title="Dalgona Candy Game"
        allow="autoplay"
      />
    </div>
  );
}