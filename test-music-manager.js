// test-music-manager.js
const { EventEmitter } = require('events');

class MockHowl extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this._playing = false;
  }
  play() {
    this._playing = true;
    console.log('[Howl] play called');
    // simulate audio ending after 100ms
    setTimeout(() => {
      if (this._playing) {
        console.log('[Howl] audio ended natively, firing "end"');
        this._playing = false;
        this.emit('end');
      }
    }, 100);
  }
  stop() {
    console.log('[Howl] stop called');
    this._playing = false;
    this.removeAllListeners('end');
  }
  volume() {}
  fade() {}
  playing() { return this._playing; }
  off(event) { this.removeAllListeners(event); }
}

const MUSIC_DEFS = {
  rlgl_green: { src: ["song.mp3"], loop: false, volume: 1.0 },
};

class MusicManager {
  constructor() {
    this._currentId = null;
    this._howls = new Map();
    this._unlocked = true;
  }

  static getInstance() {
    if (!this._instance) this._instance = new MusicManager();
    return this._instance;
  }

  play(id, fadeMs = 0, onEnd) {
    console.log(`\n[MusicManager] play called with id=${id}`);
    
    if (this._currentId === id) {
       console.log(`[MusicManager] early return! _currentId === id (${id})`);
       const currentHowl = this._howls.get(id);
       if (currentHowl) {
           currentHowl.off("end");
           if (onEnd) currentHowl.on("end", onEnd);
           // BUG: We DO NOT call currentHowl.play() here!
       }
       return;
    }

    this.stop(fadeMs);

    const def = MUSIC_DEFS[id];
    let howl = this._howls.get(id);
    if (!howl) {
      howl = new MockHowl(def);
      this._howls.set(id, howl);
    }

    howl.off("end");
    if (onEnd) {
      howl.on("end", onEnd);
    }

    this._currentId = id;
    
    howl.play();
  }

  stop(fadeMs = 0) {
    if (!this._currentId) return;
    const howl = this._howls.get(this._currentId);
    if (howl && howl.playing()) {
      howl.stop();
    }
    this._currentId = null;
  }
}

// SIMULATE GAME FLOW
console.log("=== STARTING GAME ===");
const mm = MusicManager.getInstance();

console.log("\n--- CYCLE 1: GREEN LIGHT ---");
mm.play("rlgl_green", 0, () => {
  console.log("\n!!! handleDollSongEnd Callback Fired! !!!");
  console.log("Switching to WARNING -> RED -> Then back to GREEN");
  
  // Simulate Red Light Phase finishing after 200ms
  setTimeout(() => {
    console.log("\n--- CYCLE 2: RED -> GREEN LIGHT ---");
    console.log("Calling startDollSong() again...");
    mm.play("rlgl_green", 0, () => {
      console.log("\n!!! handleDollSongEnd Callback Fired (CYCLE 2)! !!!");
    });
  }, 200);
});
