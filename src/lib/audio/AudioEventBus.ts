// lib/audio/AudioEventBus.ts

export type AudioEvents = {
  'greenLightActivated': void;
  'redLightActivated': void;
  'motionDetected': void;
  'scanCleared': void;
  'playerEliminated': string; // Pass player ID
  'playerCountUpdate': number;
  'countdownStart': number;
  'roundComplete': void;
  'playerVelocityUpdate': number;
  'gameOver': boolean; // true for win, false for loss
};

class EventBus {
  private listeners: { [K in keyof AudioEvents]?: Function[] } = {};

  on<K extends keyof AudioEvents>(event: K, callback: (payload: AudioEvents[K]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(callback);
  }

  // P2-1 FIX: removal method so useEffect cleanups can unsubscribe without
  // accumulating duplicate listeners across hook remounts.
  off<K extends keyof AudioEvents>(event: K, callback: (payload: AudioEvents[K]) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event]!.filter(cb => cb !== callback);
  }

  emit<K extends keyof AudioEvents>(event: K, payload?: AudioEvents[K]) {
    if (this.listeners[event]) {
      this.listeners[event]!.forEach(cb => cb(payload as AudioEvents[K]));
    }
  }
}

export const audioEventBus = new EventBus();