// src/hooks/useAmbientAudio.ts

"use client";

import { useEffect, useRef } from "react";
import { audioEventBus } from "../lib/audio/AudioEventBus";
import { useSoundManager } from "./useSoundManager";
import { useGameStore, selectRuntimePhase } from "../store/gameStore";
import type { SoundId } from "../managers/SoundManager";

// ─── Layered ambient config per phase ─────────────────────────────────────────
// Each phase defines a base layer (always on while in that phase) and an
// optional tension layer (fades in on red light, fades out on green).

interface LayerConfig {
  base:    SoundId[];   // loops that start when entering the phase
  fadeIn:  number;      // ms
  fadeOut: number;      // ms
}

const PHASE_LAYERS: Partial<Record<string, LayerConfig>> = {
  idle:    { base: ["room_tone"],               fadeIn: 1200, fadeOut: 800  },
  playing: { base: ["drone_root", "room_tone"], fadeIn:  800, fadeOut: 600  },
  paused:  { base: ["room_tone"],               fadeIn:  400, fadeOut: 400  },
};

// ─── useAmbientAudio ─────────────────────────────────────────────────────────

export function useAmbientAudio(): void {
  const sm          = useSoundManager();
  const phase       = useGameStore(selectRuntimePhase);
  const prevPhaseRef= useRef<string | null>(null);
  const activeLayers= useRef<SoundId[]>([]);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const config    = PHASE_LAYERS[phase];

    // Stop layers from the previous phase that aren't in the new phase
    const nextBase  = config?.base ?? [];
    for (const id of activeLayers.current) {
      if (!nextBase.includes(id)) {
        const prevConfig = prevPhase ? PHASE_LAYERS[prevPhase] : null;
        // FIXED: Routing to stopLoop to support the fadeOut parameter
        sm.stopLoop(id, prevConfig?.fadeOut ?? 600);
      }
    }

    // Start new layers
    if (config) {
      for (const id of config.base) {
        sm.loop(id);
      }
      activeLayers.current = [...config.base];
    } else {
      activeLayers.current = [];
    }

    prevPhaseRef.current = phase;
  }, [phase, sm]);

  useEffect(() => {
    return () => {
      // FIXED: Routing to stopLoop to support the fadeOut parameter
      for (const id of activeLayers.current) sm.stopLoop(id, 400);
    };
  }, [sm]);
}

// ─── useAudioSubscriptions ────────────────────────────────────────────────────
// Red light phase adds scan_tone tension layer.
// Green light phase removes it and restores the base ambient.

export function useAudioSubscriptions() {
  const sm = useSoundManager();

  useEffect(() => {
    const onGreenLight = () => {
      // Tension layer out — resume base ambient movement
      // FIXED: Routing to stopLoop to support the fadeOut parameter
      sm.stopLoop("scan_tone",  300);
      sm.stopLoop("heartbeat",  300);
      sm.loop("drone_root");
      sm.loop("room_tone");
    };

    const onRedLight = () => {
      // Add scan tone tension over the existing drone layers
      sm.loop("scan_tone");
      sm.play("heartbeat");
    };
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onElimination = (_id: string) => {
      sm.play("player_eliminated");
    };

    audioEventBus.on("greenLightActivated", onGreenLight);
    audioEventBus.on("redLightActivated",   onRedLight);
    audioEventBus.on("playerEliminated",    onElimination);

    return () => {
      audioEventBus.off("greenLightActivated", onGreenLight);
      audioEventBus.off("redLightActivated",   onRedLight);
      audioEventBus.off("playerEliminated",    onElimination);
    };
  }, [sm]);
}

// ─── useGameAudio ─────────────────────────────────────────────────────────────

export function useGameAudio() {
  const sm = useSoundManager();

  return {
    // Green/Red light music is now strictly handled by RLGLAudioController.
    // We leave these as safe empty stubs just in case other files still call them.
    onGreenLight:    () => { 
      if (typeof sm.setHeartbeat === 'function') sm.setHeartbeat(0); 
      else sm.stopLoop("heartbeat", 300); // FIXED
    },
    
    onRedLight:      () => { 
      if (typeof sm.setHeartbeat === 'function') sm.setHeartbeat(0.6); 
    },
    
    onDollTurn:      () => sm.play("doll_turn",          80),
    onStep:          () => sm.play("player_step",        40, 0.15),
    onJump:          () => sm.play("player_jump",        80, 0.08),
    onLand:          () => sm.play("player_land",        60, 0.1),
    
    onEliminated:    () => { 
      sm.play("player_eliminated", 0); 
      sm.play("crowd_gasp", 200); 
      if (typeof sm.setHeartbeat === 'function') sm.setHeartbeat(0); 
      else sm.stopLoop("heartbeat", 300); // FIXED
    },
    
    onVictory:       () => { 
      sm.play("player_victory", 0); 
      sm.play("crowd_cheer", 300); 
      if (typeof sm.setHeartbeat === 'function') sm.setHeartbeat(0); 
      else sm.stopLoop("heartbeat", 300); // FIXED
    },
    
    onCountdownBeep: () => sm.play("countdown_beep",     50),
    onCountdownGo:   () => sm.play("countdown_go",        0),
    
    // Legacy stub to prevent crashes if called
    onCombo:         () => { /* combo_hit removed */ },
    
    setDangerLevel:  (v: number) => {
      if (typeof sm.setHeartbeat === 'function') sm.setHeartbeat(v);
    },
    
    stopHeartbeat:   () => sm.stopLoop("heartbeat", 400), // FIXED
    
    // Preload strictly valid SoundIds
    preloadGame:     () => sm.preload([
      "player_step", "player_jump",
      "player_land", "player_eliminated", "player_victory",
      "countdown_beep", "countdown_go", "doll_turn",
      "crowd_gasp", "crowd_cheer", "heartbeat",
      "drone_root", "room_tone", "scan_tone",
    ]),
    sm,
  };
}