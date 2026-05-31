// src/hooks/useAmbientAudio.ts
// Full file replacement.

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
        sm.stop(id, prevConfig?.fadeOut ?? 600);
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
      for (const id of activeLayers.current) sm.stop(id, 400);
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
      sm.stop("scan_tone",  300);
      sm.stop("heartbeat",  300);
      sm.loop("drone_root");
      sm.loop("room_tone");
    };

    const onRedLight = () => {
      // Add scan tone tension over the existing drone layers
      sm.loop("scan_tone");
      sm.play("heartbeat");
    };

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
    onGreenLight:    () => { sm.play("green_light", 100); sm.setHeartbeat(0); },
    onRedLight:      () => { sm.play("red_light",   100); sm.setHeartbeat(0.6); },
    onDollTurn:      () => sm.play("doll_turn",          80),
    onStep:          () => sm.play("player_step",        40, 0.15),
    onJump:          () => sm.play("player_jump",        80, 0.08),
    onLand:          () => sm.play("player_land",        60, 0.1),
    onEliminated:    () => { sm.play("player_eliminated", 0); sm.play("crowd_gasp", 200); sm.setHeartbeat(0); },
    onVictory:       () => { sm.play("player_victory", 0); sm.play("crowd_cheer", 300); sm.setHeartbeat(0); },
    onCountdownBeep: () => sm.play("countdown_beep",     50),
    onCountdownGo:   () => sm.play("countdown_go",        0),
    onCombo:         () => sm.play("combo_hit",           80, 0.12),
    setDangerLevel:  (v: number) => sm.setHeartbeat(v),
    stopHeartbeat:   () => sm.stop("heartbeat", 400),
    preloadGame:     () => sm.preload([
      "green_light", "red_light", "player_step", "player_jump",
      "player_land", "player_eliminated", "player_victory",
      "countdown_beep", "countdown_go", "doll_turn",
      "crowd_gasp", "crowd_cheer", "heartbeat",
      "drone_root", "room_tone", "scan_tone",
    ]),
    sm,
  };
}