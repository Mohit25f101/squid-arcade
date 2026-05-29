// src/hooks/useMenuAudio.ts
//
// Wraps Howler.js for the main menu audio system.
// Sources all sounds from the repository's /public/audio/ folder.
// Respects the master/sfx/music volume settings from gameStore.

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";

type SoundName = "hover" | "click" | "open" | "transition" | "exit";

interface MenuAudioController {
  play:    (name: SoundName) => void;
  startBg: () => void;
  stopBg:  () => void;
}

export function useMenuAudio(): MenuAudioController {
  const bgRef    = useRef<import("howler").Howl | null>(null);
  const sfxRef   = useRef<Record<SoundName, import("howler").Howl | null>>({
    hover:      null,
    click:      null,
    open:       null,
    transition: null,
    exit:       null,
  });
  const readyRef  = useRef(false);
  const settings  = useGameStore((s) => s.settings);

  // Lazy-load Howler only on client
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readyRef.current) return;

    import("howler").then(({ Howl }) => {
      // Background ambient loop — music-box doll theme
      bgRef.current = new Howl({
        src:    ["/audio/melodic/Back Song.mp3"],
        loop:   true,
        volume: settings.musicVolume * settings.masterVolume * 0.55,
        preload: true,
      });

      // SFX
      sfxRef.current.hover = new Howl({
        src:    ["/audio/stingers/servo-click.webm"],
        volume: settings.sfxVolume * settings.masterVolume * 0.45,
        preload: true,
      });

      sfxRef.current.click = new Howl({
        src:    ["/audio/stingers/sub-hit.webm"],
        volume: settings.sfxVolume * settings.masterVolume * 0.6,
        preload: true,
      });

      sfxRef.current.open = new Howl({
        src:    ["/audio/stingers/riser-micro.webm"],
        volume: settings.sfxVolume * settings.masterVolume * 0.5,
        preload: true,
      });

      sfxRef.current.transition = new Howl({
        src:    ["/audio/stingers/riser-standard.webm"],
        volume: settings.sfxVolume * settings.masterVolume * 0.6,
        preload: true,
      });

      sfxRef.current.exit = new Howl({
        src:    ["/audio/sfx/elimination.webm"],
        volume: settings.sfxVolume * settings.masterVolume * 0.4,
        preload: true,
      });

      readyRef.current = true;
    });

    return () => {
      bgRef.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep bg volume in sync with settings
  useEffect(() => {
    if (!bgRef.current) return;
    bgRef.current.volume(settings.musicVolume * settings.masterVolume * 0.55);
  }, [settings.musicVolume, settings.masterVolume]);

  const play = useCallback((name: SoundName) => {
    if (!readyRef.current) return;
    try {
      sfxRef.current[name]?.play();
    } catch {
      // Audio context not ready — fail silently
    }
  }, []);

  const startBg = useCallback(() => {
    if (!readyRef.current || !bgRef.current) return;
    if (!bgRef.current.playing()) {
      bgRef.current.fade(0, settings.musicVolume * settings.masterVolume * 0.55, 2000);
      bgRef.current.play();
    }
  }, [settings.musicVolume, settings.masterVolume]);

  const stopBg = useCallback(() => {
    if (!bgRef.current) return;
    bgRef.current.fade(bgRef.current.volume() as number, 0, 800);
    setTimeout(() => bgRef.current?.stop(), 900);
  }, []);

  return { play, startBg, stopBg };
}