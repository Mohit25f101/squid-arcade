// lib/audio/AudioEventBus.ts

// These are the exact events Claude outlined in the state machine
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

  emit<K extends keyof AudioEvents>(event: K, payload?: AudioEvents[K]) {
    if (this.listeners[event]) {
      this.listeners[event]!.forEach(cb => cb(payload as AudioEvents[K]));
    }
  }
}

export const audioEventBus = new EventBus();