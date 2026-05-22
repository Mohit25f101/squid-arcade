// lib/audio/AudioManager.ts
import { audioEventBus } from './AudioEventBus';

export class AudioManager {
  private ctx: AudioContext | null = null;
  public isInitialized = false;

  public async initialize() {
    if (this.isInitialized) return;
    if (typeof window === 'undefined') return; // Prevent SSR crashes in Next.js

    // 1. Create the Audio Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // 2. Setup Event Listeners
    this.setupSubscriptions();

    this.isInitialized = true;
    console.log("🔊 Audio Manager Initialized! Context state:", this.ctx.state);
  }

  private setupSubscriptions() {
    // Listen for Game Events and fire audio logic
    audioEventBus.on('greenLightActivated', () => {
      console.log("🎵 Audio State: GREEN_LIGHT_ACTIVE");
      // Future: Crossfade to green light mix
    });

    audioEventBus.on('redLightActivated', () => {
      console.log("🛑 Audio State: RED_LIGHT_TRIGGER - HARD CUT AUDIO");
      // Future: Mute all music, fire servo-click stinger
    });

    audioEventBus.on('playerEliminated', (id) => {
      console.log(`💀 Audio State: PLAYER_ELIMINATED (Player ${id}) - Fire Stinger`);
      // Future: Play sub-hit + piano cluster
    });
  }

  public suspend() {
    this.ctx?.suspend();
  }

  public resume() {
    this.ctx?.resume();
  }
}

// Export a single instance to be used globally
export const gameAudioManager = new AudioManager();