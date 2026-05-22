"use client";

import { useEffect, useRef, useCallback } from "react";
import { SoundManager, type SoundId } from "../managers/SoundManager";
import { useGameStore, selectVolumes } from "../store/gameStore";

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useSoundManager
 *
 * Provides access to the SoundManager singleton, keeps it in sync with
 * Zustand volume/mute settings, and handles mobile unlock via the first
 * user interaction.
 *
 * Returns a stable object of helper methods — safe to call from RAF loops
 * inside useRef closures without stale closure risk.
 */

export interface SoundManagerHandle {
  play:    (id: SoundId, cooldownMs?: number, rateJitter?: number) => void;
  loop:    (id: SoundId) => void;
  stop:    (id: SoundId, fadeMs?: number) => void;
  stopAll: () => void;
  fadeTo:  (id: SoundId, vol: number, ms: number) => void;
  setHeartbeat: (level: number) => void;
  preload: (ids: SoundId[]) => void;
  unlock:  () => void;
  manager: () => SoundManager;
}

export function useSoundManager(): SoundManagerHandle {
  // Grab primitive numbers directly to prevent infinite re-renders
  const master = useGameStore((s) => s.settings.masterVolume);
  const sfx = useGameStore((s) => s.settings.sfxVolume);
  const music = useGameStore((s) => s.settings.musicVolume);
  const muted = master === 0;

  // Initialise singleton on first render
  const smRef = useRef<SoundManager>(
    SoundManager.getInstance({
      masterVolume: master,
      sfxVolume: sfx,
      musicVolume: music,
      muted,
    })
  );

  // ── Sync Zustand volumes → SoundManager ──────────────────────────────────
  useEffect(() => {
    const sm = smRef.current;
    sm.setMasterVolume(master);
    sm.setSFXVolume(sfx);
    sm.setMusicVolume(music);
  }, [master, sfx, music]);

  useEffect(() => {
    smRef.current.setMuted(muted);
  }, [muted]);

  // ── Mobile unlock on first gesture ───────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      smRef.current.unlock();
    };
    window.addEventListener("click",      handler, { once: true, passive: true });
    window.addEventListener("touchstart", handler, { once: true, passive: true });
    window.addEventListener("keydown",    handler, { once: true, passive: true });
    return () => {
      window.removeEventListener("click",      handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown",    handler);
    };
  }, []);

  // ── Stable handle (object identity never changes) ─────────────────────────
  const handleRef = useRef<SoundManagerHandle>({
    play:    (id, cdMs = 0, jitter = 0) => smRef.current.play(id, cdMs, jitter),
    loop:    (id)               => smRef.current.loop(id),
    stop:    (id, ms = 600)     => smRef.current.stopLoop(id, ms),
    stopAll: ()                 => smRef.current.stopAll(),
    fadeTo:  (id, vol, ms)      => smRef.current.fadeTo(id, vol, ms),
    setHeartbeat: (level)       => smRef.current.setHeartbeatIntensity(level),
    preload: (ids)              => smRef.current.preload(ids),
    unlock:  ()                 => smRef.current.unlock(),
    manager: ()                 => smRef.current,
  });

  return handleRef.current;
}

// ─── Convenience: useUISound ──────────────────────────────────────────────────

/**
 * Lightweight hook for menu / button sounds.
 * Returns click and hover handlers ready for JSX event props.
 */
export function useUISound() {
  const sm = useSoundManager();

  const onClick  = useCallback(() => sm.play("ui_click",  80),  [sm]);
  const onHover  = useCallback(() => sm.play("ui_hover",  60),  [sm]);
  const onConfirm= useCallback(() => sm.play("ui_confirm", 200), [sm]);
  const onBack   = useCallback(() => sm.play("ui_back",    200), [sm]);

  return { onClick, onHover, onConfirm, onBack };
}