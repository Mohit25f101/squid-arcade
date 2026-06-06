import * as fs from 'fs';

// Mock Howler
class Howl {
    src: string[];
    loop: boolean;
    _playing: boolean;
    _volume: number;
    events: Record<string, Function[]>;
    
    constructor(opts: any) {
        this.src = opts.src;
        this.loop = opts.loop;
        this._playing = false;
        this._volume = opts.volume || 1;
        this.events = {};
        console.log(`[Howl] Created with loop: ${this.loop}`);
    }

    on(event: string, fn: Function) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(fn);
        console.log(`[Howl] onEnd callback registered. Listener count: ${this.events[event].length}`);
    }

    off(event: string) {
        this.events[event] = [];
        console.log(`[Howl] off(${event}) called. Listeners cleared.`);
    }

    play() {
        this._playing = true;
        console.log(`[Howl] play() called. playing = true`);
        // Simulate playback finishing if not looping
        if (!this.loop) {
            setTimeout(() => {
                this._playing = false;
                console.log(`[Howl] Track finished naturally. Firing 'end' event.`);
                const fns = this.events['end'] || [];
                fns.forEach(fn => fn());
            }, 50);
        }
    }

    pause() {
        this._playing = false;
        console.log(`[Howl] pause() called.`);
    }

    stop() {
        this._playing = false;
        console.log(`[Howl] stop() called.`);
    }

    playing() {
        return this._playing;
    }

    volume(v?: number) {
        if (v !== undefined) {
            this._volume = v;
            return this;
        }
        return this._volume;
    }

    fade(from: number, to: number, duration: number) {
        console.log(`[Howl] fade from ${from} to ${to} over ${duration}ms`);
        setTimeout(() => {
            this._volume = to;
            console.log(`[Howl] fade complete.`);
        }, duration);
    }
}

(global as any).Howl = Howl;

// Create dummy SoundManager
class SoundManager {
    static _instance = new SoundManager();
    musicVolume = 1;
    masterVolume = 1;
    static getInstance() { return SoundManager._instance; }
    play() {}
}
(global as any).SoundManager = SoundManager;

// We need to inline MusicManager since it has imports we can't easily resolve without a bundler,
// but actually we can just transpile it using ts-node or just copy the logic here.
const MUSIC_DEFS: any = {
  rlgl_green: { src: ["/audio/stingers/doll_song.mp3"], loop: false, volume: 1.0 },
};

class MusicManager {
  private static _instance: MusicManager = new MusicManager();
  private _currentId: string | null = null;
  private _howls: Map<string, Howl> = new Map();
  private _unlocked: boolean = true; // pretend unlocked

  public static getInstance(): MusicManager {
    return MusicManager._instance;
  }

  public play(id: string, fadeMs: number = 0, onEnd?: () => void): void {
    console.log(`\n[MusicManager] play('${id}') called.`);
    
    if (this._currentId === id) {
       console.log(`[MusicManager] Early return triggered because _currentId === '${id}'`);
       const currentHowl = this._howls.get(id);
       if (currentHowl) {
           currentHowl.off("end");
           if (onEnd) currentHowl.on("end", onEnd);
           console.log(`[MusicManager] checking if playing... ${currentHowl.playing()}`);
           if (!currentHowl.playing()) {
               currentHowl.play();
           }
       }
       return;
    }

    console.log(`[MusicManager] Calling stop(${fadeMs})`);
    this.stop(fadeMs);

    const def = MUSIC_DEFS[id];
    if (!def) return;

    let howl = this._howls.get(id);
    if (!howl) {
      howl = new Howl({
        src: def.src,
        loop: def.loop ?? false,
        volume: 0, 
      });
      this._howls.set(id, howl);
    }

    howl.off("end");
    if (onEnd) {
      howl.on("end", onEnd);
    }

    this._currentId = id;
    howl.play();
  }

  public stop(fadeMs: number = 0): void {
    if (!this._currentId) return;
    const howl = this._howls.get(this._currentId);
    
    if (howl && howl.playing()) {
      if (fadeMs > 0) {
        howl.fade(howl.volume(), 0, fadeMs);
        setTimeout(() => {
            howl.stop();
            howl.off("end");
        }, fadeMs + 50);
      } else {
        howl.stop();
        howl.off("end");
      }
    }
    console.log(`[MusicManager] Setting _currentId to null`);
    this._currentId = null;
  }
}

// ----------------------------------------------------
// Simulate RLGL Game Loop
// ----------------------------------------------------

let lp = "GREEN";
let cycleCount = 0;

function handleDollSongEnd() {
    console.log(`\n=> [Game] handleDollSongEnd EXECUTION. Phase changing to WARNING -> RED`);
    lp = "WARNING";
    
    // Simulate transitioning to RED and waiting, then transitioning back to GREEN
    setTimeout(() => {
        lp = "RED";
        console.log(`=> [Game] Phase is RED`);
        setTimeout(() => {
            lp = "GREEN";
            console.log(`=> [Game] Phase is GREEN. Calling startDollSong() again!`);
            startDollSong();
        }, 100);
    }, 10);
}

function startDollSong() {
    console.log(`\n=> [Game] startDollSong() fires.`);
    MusicManager.getInstance().play("rlgl_green", 0, handleDollSongEnd);
}

console.log("=== STARTING SIMULATION ===");
startDollSong();

setTimeout(() => {
    console.log("=== END OF SIMULATION ===");
}, 1000);
