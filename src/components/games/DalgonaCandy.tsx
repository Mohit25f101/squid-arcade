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
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/*
        The iframe's own ◀ MENU button now sends DALGONA_MENU via postMessage,
        so no React overlay button is needed. The bridge above handles routing.
      */}
      <iframe
        ref={iframeRef}
        src="/dalgona.html"
        style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
        title="Dalgona Candy Game"
        allow="autoplay"
      />
    </div>
  );
}