"use client";

import { useEffect, useRef, useCallback } from "react";
import { SoundManager, type SoundId } from "../managers/SoundManager";
import { useGameStore, selectVolumes } from "../store/gameStore";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface SoundManagerHandle {
  play:    (id: SoundId, cooldownMs?: number, rateJitter?: number, exactRate?: number | null) => void;
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
  const master = useGameStore((s) => s.settings.masterVolume);
  const sfx = useGameStore((s) => s.settings.sfxVolume);
  const music = useGameStore((s) => s.settings.musicVolume);
  const muted = master === 0;

  const smRef = useRef<SoundManager>(SoundManager.getInstance());

  useEffect(() => {
    const sm = smRef.current;
    sm.setMasterVolume(master);
    sm.setSFXVolume(sfx);
    sm.setMusicVolume(music);
  }, [master, sfx, music]);

  useEffect(() => {
    smRef.current.setMuted(muted);
  }, [muted]);

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

  const handleRef = useRef<SoundManagerHandle>({
    play:    (id, cdMs = 0, jitter = 0, exactRate = null) => smRef.current.play(id, cdMs, jitter, exactRate),
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

export function useUISound() {
  const sm = useSoundManager();

  const onClick  = useCallback(() => sm.play("ui_click",  80),  [sm]);
  const onHover  = useCallback(() => sm.play("ui_hover",  60),  [sm]);
  const onConfirm= useCallback(() => sm.play("ui_confirm", 200), [sm]);
  const onBack   = useCallback(() => sm.play("ui_back",    200), [sm]);

  return { onClick, onHover, onConfirm, onBack };
}