"use client";

import { useEffect, useRef } from "react";
import { audioEventBus } from "../lib/audio/AudioEventBus";
import { useSoundManager } from "./useSoundManager";
import { useGameStore, selectPhase } from "../store/gameStore";
import type { SoundId } from "../managers/SoundManager";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmbientConfig {
  /** Sound to loop while in this phase */
  soundId:  SoundId;
  /** Fade-in duration ms */
  fadeIn?:  number;
  /** Fade-out duration ms */
  fadeOut?: number;
}

// ─── Phase → ambient mapping ──────────────────────────────────────────────────

const PHASE_AMBIENT: Partial<Record<string, AmbientConfig>> = {
  menu:    { soundId: "ambient_bg",  fadeIn: 1200, fadeOut: 800 },
  playing: { soundId: "ambient_bg",  fadeIn:  800, fadeOut: 600 },
  paused:  { soundId: "ambient_bg",  fadeIn:  400, fadeOut: 400 },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAmbientAudio
 *
 * Subscribes to Zustand game phase and automatically manages ambient
 * music fading. Handles transitions cleanly — old ambient fades out
 * before new one fades in.
 */
export function useAmbientAudio(): void {
  const sm          = useSoundManager();
  const phase       = useGameStore(selectPhase);
  const prevPhaseRef= useRef<string | null>(null);
  const prevSoundRef= useRef<SoundId | null>(null);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const prevSound = prevSoundRef.current;
    const config    = PHASE_AMBIENT[phase];

    // Stop previous ambient if different sound
    if (prevSound && prevSound !== config?.soundId) {
      const prevConfig = prevPhase ? PHASE_AMBIENT[prevPhase] : null;
      sm.stop(prevSound, prevConfig?.fadeOut ?? 600);
    }

    // Start new ambient
    if (config) {
      sm.loop(config.soundId);
      prevSoundRef.current = config.soundId;
    } else {
      prevSoundRef.current = null;
    }

    prevPhaseRef.current = phase;
  }, [phase, sm]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const active = prevSoundRef.current;
      if (active) sm.stop(active, 400);
    };
  }, [sm]);
}

export function useAudioSubscriptions() {
  const sm = useSoundManager();

  useEffect(() => {
    const onGreenLight = () => {
      // Tension releases — fade out sting, resume ambient movement track.
      sm.stop("heartbeat", 300);
      sm.loop("ambient_bg");
    };

    const onRedLight = () => {
      // Hard cut: silence movement audio, play freeze/tension sting.
      sm.stop("ambient_bg", 150);
      sm.play("heartbeat");
    };

    const onElimination = (_id: string) => {
      // payload is string (player ID) per AudioEvents type definition.
      sm.play("player_eliminated");
    };

    audioEventBus.on("greenLightActivated", onGreenLight);
    audioEventBus.on("redLightActivated", onRedLight);
    audioEventBus.on("playerEliminated", onElimination);

    return () => {
      audioEventBus.off("greenLightActivated", onGreenLight);
      audioEventBus.off("redLightActivated", onRedLight);
      audioEventBus.off("playerEliminated", onElimination);
    };
  }, [sm]); 
} // [] — subscribe once on mount, clean up on unmount
// ─── useGameAudio: per-game event sound helper ────────────────────────────────

/**
 * Returns imperative sound trigger functions for use inside a game component.
 * All calls are safe to make from RAF loops via the stable sm handle.
 */
export function useGameAudio() {
  const sm = useSoundManager();

  return {
    onGreenLight:  ()          => {
      sm.play("green_light", 100);
      sm.setHeartbeat(0);
    },
    onRedLight:    ()          => {
      sm.play("red_light", 100);
      sm.setHeartbeat(0.6);
    },
    onDollTurn:    ()          => sm.play("doll_turn",          80),
    onStep:        ()          => sm.play("player_step",        40, 0.15),
    onJump:        ()          => sm.play("player_jump",        80, 0.08),
    onLand:        ()          => sm.play("player_land",        60, 0.1),
    onEliminated:  ()          => {
      sm.play("player_eliminated", 0);
      sm.play("crowd_gasp", 200);
      sm.setHeartbeat(0);
    },
    onVictory:     ()          => {
      sm.play("player_victory", 0);
      sm.play("crowd_cheer",    300);
      sm.setHeartbeat(0);
    },
    onCountdownBeep: ()        => sm.play("countdown_beep",     50),
    onCountdownGo:   ()        => sm.play("countdown_go",        0),
    onCombo:         ()        => sm.play("combo_hit",           80, 0.12),
    setDangerLevel:  (v: number) => sm.setHeartbeat(v),
    stopHeartbeat:   ()        => sm.stop("heartbeat", 400),
    preloadGame:     ()        => sm.preload([
      "green_light", "red_light", "player_step", "player_jump",
      "player_land", "player_eliminated", "player_victory",
      "countdown_beep", "countdown_go", "doll_turn",
      "crowd_gasp", "crowd_cheer", "heartbeat",
    ]),
    sm,
  };
}