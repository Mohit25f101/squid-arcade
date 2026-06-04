// src/managers/MusicManager.ts

import { Howl } from "howler";
import { SoundManager } from "./SoundManager";

export type MusicTrackId = "menu" | "rlgl_green" | "rlgl_red";

// src/managers/MusicManager.ts
// PATHS: files must exist at /public root (verified: backsong.mp3, doll_song.mp3)
// src/managers/MusicManager.ts
// src/managers/MusicManager.ts
const MUSIC_DEFS: Record<MusicTrackId, { src: string[]; loop?: boolean; volume?: number }> = {
  menu:       { src: ["/audio/music/backsong.mp3"],   loop: true,  volume: 0.6 },
  rlgl_green: { src: ["/audio/stingers/doll_song.mp3"], loop: true,  volume: 1.0 },
  rlgl_red:   { src: ["/audio/stingers/exhale-texture.mp3"], loop: false, volume: 1.7 },
};
// Exporting the class directly allows useBackgroundMusic.ts to use it as a Type 
// AND access static methods like MusicManager.getInstance()
export class MusicManager {
  private static _instance: MusicManager;
  private _currentId: MusicTrackId | null = null;
  private _howls: Map<MusicTrackId, Howl> = new Map();
  // RC-2 FIX: unlock queue — mirrors SoundManager's pattern
  private _unlocked: boolean = false;
  private _pendingPlay: { id: MusicTrackId; fadeMs: number } | null = null;

  private constructor() {
    if (typeof window !== "undefined") {
      const unlock = (): void => {
        this._unlocked = true;
        if (this._pendingPlay) {
          const { id, fadeMs } = this._pendingPlay;
          this._pendingPlay = null;
          this.play(id, fadeMs);
        }
      };
      const opts = { once: true, capture: true, passive: true } as const;
      (["pointerdown", "touchstart", "mousedown", "keydown", "click"] as const)
        .forEach((ev) => window.addEventListener(ev, unlock, opts));
    }
  }

  public static getInstance(): MusicManager {
    if (!MusicManager._instance) {
      MusicManager._instance = new MusicManager();
    }
    return MusicManager._instance;
  }

  public play(id: MusicTrackId, fadeMs: number = 0): void {
    // RC-2 FIX: defer until user gesture unlocks AudioContext
    if (!this._unlocked) {
      this._pendingPlay = { id, fadeMs };
      return;
    }
    if (this._currentId === id) return;
    this.stop(fadeMs); // Enforce single-track playback

    const def = MUSIC_DEFS[id];
    if (!def) return;

    let howl = this._howls.get(id);
    if (!howl) {
      howl = new Howl({
        src: def.src,
        loop: def.loop ?? false,
        volume: 0, 
        preload: true,
      });
      this._howls.set(id, howl);
    }

    this._currentId = id;
    const targetVol = (def.volume ?? 1) * SoundManager.getInstance().musicVolume * SoundManager.getInstance().masterVolume;
    
    howl.play();
    if (fadeMs > 0) {
      howl.fade(0, targetVol, fadeMs);
    } else {
      howl.volume(targetVol);
    }
  }

  public stop(fadeMs: number = 0): void {
    if (!this._currentId) return;
    const howl = this._howls.get(this._currentId);
    
    if (howl && howl.playing()) {
      if (fadeMs > 0) {
        howl.fade(howl.volume(), 0, fadeMs);
        setTimeout(() => howl.stop(), fadeMs + 50);
      } else {
        howl.stop();
      }
    }
    this._currentId = null;
  }
  
  public setPlaybackRate(rate: number): void {
      if(!this._currentId) return;
      const howl = this._howls.get(this._currentId);
      if(howl) howl.rate(rate);
  }
}

// Exporting the instance allows RedLightGreenLight.tsx and useMenuAudio.ts 
// to import { musicManager } directly without instantiation errors
export const musicManager = MusicManager.getInstance();