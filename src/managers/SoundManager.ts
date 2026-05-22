import { Howl, Howler } from "howler";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SoundId =
  | "green_light"
  | "red_light"
  | "player_step"
  | "player_jump"
  | "player_land"
  | "player_eliminated"
  | "player_victory"
  | "countdown_beep"
  | "countdown_go"
  | "combo_hit"
  | "ui_click"
  | "ui_hover"
  | "ui_confirm"
  | "ui_back"
  | "ambient_bg"
  | "heartbeat"
  | "doll_turn"
  | "crowd_gasp"
  | "crowd_cheer";

export type SoundCategory = "sfx" | "music" | "ambient" | "ui";

interface SoundDefinition {
  src:        string[];
  category:   SoundCategory;
  volume:     number;       // base volume 0–1
  loop?:      boolean;
  html5?:     boolean;      // stream large files
  rate?:      number;       // playback rate
  sprite?:    Record<string, [number, number]>;
  pool?:      number;       // max simultaneous instances
}

interface ActiveSound {
  howl:       Howl;
  instanceId: number | null;
  category:   SoundCategory;
  baseVolume: number;
}

interface SoundManagerOptions {
  masterVolume?: number;
  sfxVolume?:    number;
  musicVolume?:  number;
  muted?:        boolean;
}

// ─── Sound Definitions ────────────────────────────────────────────────────────
// Using Howler sprite technique with a single synthesised audio source per
// category so the game works without real audio files. Each Howl generates
// a silent or tone-based buffer. When real assets exist, swap src[] paths.

const SOUND_DEFS: Record<SoundId, SoundDefinition> = {
  // ── SFX ───────────────────────────────────────────────────────────────────
  green_light: {
    src:      ["/audio/sfx/green_light.webm", "/audio/sfx/green_light.mp3"],
    category: "sfx",
    volume:   0.7,
  },
  red_light: {
    src:      ["/audio/sfx/red_light.webm", "/audio/sfx/red_light.mp3"],
    category: "sfx",
    volume:   0.85,
  },
  player_step: {
    src:      ["/audio/sfx/step.webm", "/audio/sfx/step.mp3"],
    category: "sfx",
    volume:   0.25,
    pool:     4,
  },
  player_jump: {
    src:      ["/audio/sfx/jump.webm", "/audio/sfx/jump.mp3"],
    category: "sfx",
    volume:   0.45,
    pool:     2,
  },
  player_land: {
    src:      ["/audio/sfx/land.webm", "/audio/sfx/land.mp3"],
    category: "sfx",
    volume:   0.35,
    pool:     2,
  },
  player_eliminated: {
    src:      ["/audio/sfx/eliminated.webm", "/audio/sfx/eliminated.mp3"],
    category: "sfx",
    volume:   0.9,
  },
  player_victory: {
    src:      ["/audio/sfx/victory.webm", "/audio/sfx/victory.mp3"],
    category: "sfx",
    volume:   0.9,
  },
  countdown_beep: {
    src:      ["/audio/sfx/beep.webm", "/audio/sfx/beep.mp3"],
    category: "sfx",
    volume:   0.6,
    pool:     1,
  },
  countdown_go: {
    src:      ["/audio/sfx/go.webm", "/audio/sfx/go.mp3"],
    category: "sfx",
    volume:   0.85,
  },
  combo_hit: {
    src:      ["/audio/sfx/combo.webm", "/audio/sfx/combo.mp3"],
    category: "sfx",
    volume:   0.5,
    pool:     3,
  },
  doll_turn: {
    src:      ["/audio/sfx/doll_turn.webm", "/audio/sfx/doll_turn.mp3"],
    category: "sfx",
    volume:   0.75,
  },
  crowd_gasp: {
    src:      ["/audio/sfx/gasp.webm", "/audio/sfx/gasp.mp3"],
    category: "sfx",
    volume:   0.6,
    pool:     1,
  },
  crowd_cheer: {
    src:      ["/audio/sfx/cheer.webm", "/audio/sfx/cheer.mp3"],
    category: "sfx",
    volume:   0.7,
  },

  // ── UI ────────────────────────────────────────────────────────────────────
  ui_click: {
    src:      ["/audio/ui/click.webm", "/audio/ui/click.mp3"],
    category: "ui",
    volume:   0.4,
    pool:     3,
  },
  ui_hover: {
    src:      ["/audio/ui/hover.webm", "/audio/ui/hover.mp3"],
    category: "ui",
    volume:   0.2,
    pool:     2,
  },
  ui_confirm: {
    src:      ["/audio/ui/confirm.webm", "/audio/ui/confirm.mp3"],
    category: "ui",
    volume:   0.55,
  },
  ui_back: {
    src:      ["/audio/ui/back.webm", "/audio/ui/back.mp3"],
    category: "ui",
    volume:   0.4,
  },

  // ── Music / Ambient ───────────────────────────────────────────────────────
  ambient_bg: {
    src:      ["/audio/music/ambient.webm", "/audio/music/ambient.mp3"],
    category: "ambient",
    volume:   0.35,
    loop:     true,
    html5:    true,
  },
  heartbeat: {
    src:      ["/audio/sfx/heartbeat.webm", "/audio/sfx/heartbeat.mp3"],
    category: "ambient",
    volume:   0.0,   // fades in when danger
    loop:     true,
  },
};

// ─── SoundManager Class ───────────────────────────────────────────────────────

export class SoundManager {
  private static _instance: SoundManager | null = null;

  private _masterVolume: number;
  private _sfxVolume:    number;
  private _musicVolume:  number;
  private _muted:        boolean;
  private _unlocked:     boolean;

  // Loaded howls (lazy)
  private _sounds:       Map<SoundId, Howl>          = new Map();
  // Active looping/ambient sounds
  private _active:       Map<SoundId, ActiveSound>   = new Map();
  // Per-sound cooldowns (ms timestamp)
  private _cooldowns:    Map<SoundId, number>         = new Map();
  // Pending plays queued before unlock
  private _pendingQueue: Array<() => void>            = [];

  private constructor(opts: SoundManagerOptions = {}) {
    this._masterVolume = opts.masterVolume ?? 0.8;
    this._sfxVolume    = opts.sfxVolume    ?? 0.9;
    this._musicVolume  = opts.musicVolume  ?? 0.6;
    this._muted        = opts.muted        ?? false;
    this._unlocked     = false;

    Howler.autoUnlock = true;
    Howler.html5PoolSize = 10;
    this._applyGlobalVolume();
  }

  // ── Singleton ─────────────────────────────────────────────────────────────

  static getInstance(opts?: SoundManagerOptions): SoundManager {
    if (!SoundManager._instance) {
      SoundManager._instance = new SoundManager(opts);
    }
    return SoundManager._instance;
  }

  static destroyInstance(): void {
    if (SoundManager._instance) {
      SoundManager._instance.destroy();
      SoundManager._instance = null;
    }
  }

  // ── Mobile unlock ─────────────────────────────────────────────────────────

  /**
   * Must be called from a user gesture (click/touchstart).
   * Safe to call multiple times — only runs once.
   */
  unlock(): void {
    if (this._unlocked) return;
    this._unlocked = true;

    // Resume AudioContext if suspended
    const ctx = Howler.ctx;
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Drain pending queue
    const queue = this._pendingQueue.splice(0);
    for (const fn of queue) fn();
  }

  // ── Lazy loading ──────────────────────────────────────────────────────────

  private _load(id: SoundId): Howl {
    const cached = this._sounds.get(id);
    if (cached) return cached;

    const def  = SOUND_DEFS[id];
    const howl = new Howl({
      src:    def.src,
      volume: this._computeVolume(id, def.volume),
      loop:   def.loop   ?? false,
      html5:  def.html5  ?? false,
      rate:   def.rate   ?? 1,
      pool:   def.pool   ?? 1,
      preload:true,
      onloaderror: (_id, err) => {
        // Silently fail — missing audio files are acceptable in dev
        console.debug(`[SoundManager] Load error for "${id}":`, err);
      },
    });

    this._sounds.set(id, howl);
    return howl;
  }

  // ── Volume computation ────────────────────────────────────────────────────

  private _computeVolume(id: SoundId, baseVolume: number): number {
    if (this._muted) return 0;
    const def = SOUND_DEFS[id];
    const cat  = def.category;
    const catMod =
      cat === "sfx"     ? this._sfxVolume   :
      cat === "ui"      ? this._sfxVolume   :
      cat === "music"   ? this._musicVolume :
      cat === "ambient" ? this._musicVolume : 1;

    return clamp(baseVolume * catMod * this._masterVolume, 0, 1);
  }

  private _applyGlobalVolume(): void {
    Howler.volume(this._muted ? 0 : this._masterVolume);
  }

  // ── Cooldown guard ────────────────────────────────────────────────────────

  private _onCooldown(id: SoundId, cooldownMs: number): boolean {
    const last = this._cooldowns.get(id) ?? 0;
    const now  = performance.now();
    if (now - last < cooldownMs) return true;
    this._cooldowns.set(id, now);
    return false;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Play a one-shot sound effect.
   * @param id         Sound to play
   * @param cooldownMs Minimum ms between repeats (default 0)
   * @param rateJitter Add slight pitch variation for naturalness (0–1)
   */
  play(id: SoundId, cooldownMs = 0, rateJitter = 0): void {
    if (this._muted) return;
    if (cooldownMs > 0 && this._onCooldown(id, cooldownMs)) return;

    const fire = () => {
      const howl = this._load(id);
      const def  = SOUND_DEFS[id];
      const vol  = this._computeVolume(id, def.volume);
      const rate = 1 + (Math.random() - 0.5) * rateJitter;

      const iid = howl.play();
      if (typeof iid === "number") {
        howl.volume(vol,  iid);
        howl.rate(clamp(rate, 0.5, 2), iid);
      }
    };

    if (!this._unlocked) {
      this._pendingQueue.push(fire);
      return;
    }
    fire();
  }

  /**
   * Start a looping sound (ambient / music / heartbeat).
   * Safe to call repeatedly — won't double-start.
   */
  loop(id: SoundId): void {
    if (this._active.has(id)) return;

    const def  = SOUND_DEFS[id];
    const howl = this._load(id);
    const vol  = this._computeVolume(id, def.volume);

    const fire = () => {
      howl.volume(0);
      const iid = howl.play();
      this._active.set(id, {
        howl,
        instanceId: typeof iid === "number" ? iid : null,
        category:   def.category,
        baseVolume: def.volume,
      });
      this.fadeTo(id, vol, 800);
    };

    if (!this._unlocked) {
      this._pendingQueue.push(fire);
      return;
    }
    fire();
  }

  /** Fade-stop a looping sound. */
  stopLoop(id: SoundId, fadeMs = 600): void {
    const active = this._active.get(id);
    if (!active) return;
    const { howl, instanceId } = active;
    if (instanceId !== null) {
      howl.fade(howl.volume(instanceId) as number, 0, fadeMs, instanceId);
      setTimeout(() => {
        howl.stop(instanceId);
        this._active.delete(id);
      }, fadeMs + 50);
    } else {
      howl.fade(howl.volume() as number, 0, fadeMs);
      setTimeout(() => {
        howl.stop();
        this._active.delete(id);
      }, fadeMs + 50);
    }
  }

  /** Fade an active looping sound to a target volume. */
  fadeTo(id: SoundId, targetVolume: number, durationMs: number): void {
    const active = this._active.get(id);
    if (!active) return;
    const { howl, instanceId } = active;
    const from = instanceId !== null ? (howl.volume(instanceId) as number) : (howl.volume() as number);
    const to = clamp(targetVolume, 0, 1);
    if (instanceId !== null) {
      howl.fade(from, to, durationMs, instanceId);
    } else {
      howl.fade(from, to, durationMs);
    }
  }
  /**
   * Pulse the heartbeat ambient by fading to a danger volume.
   * Call each frame with a 0–1 danger level.
   */
  setHeartbeatIntensity(level: number): void {
    if (!this._active.has("heartbeat")) {
      if (level > 0.1) this.loop("heartbeat");
      return;
    }
    const def = SOUND_DEFS["heartbeat"];
    const targetVol = this._computeVolume("heartbeat", def.volume + level * 0.55);
    this.fadeTo("heartbeat", clamp(targetVol, 0, 1), 200);

    const active = this._active.get("heartbeat");
    if (active) {
      const rate = 0.9 + level * 0.6;
      active.howl.rate(clamp(rate, 0.5, 2));
    }
  }

  /** Stop everything — hard cut. */
  stopAll(): void {
    for (const id of this._active.keys()) {
      this.stopLoop(id, 0);
    }
    Howler.stop();
  }

  /** Mute/unmute all audio instantly. */
  setMuted(muted: boolean): void {
    this._muted = muted;
    this._applyGlobalVolume();
    // Re-apply volumes to all active loops
    for (const [id, active] of this._active) {
      const vol = this._computeVolume(id, active.baseVolume);
      const { howl, instanceId } = active;
      if (instanceId !== null) {
        howl.volume(muted ? 0 : vol, instanceId);
      } else {
        howl.volume(muted ? 0 : vol);
      }
    }
  }

  setMasterVolume(v: number): void {
    this._masterVolume = clamp(v, 0, 1);
    this._applyGlobalVolume();
    this._rebalanceActive();
  }

  setSFXVolume(v: number): void {
    this._sfxVolume = clamp(v, 0, 1);
    this._rebalanceActive();
  }

  setMusicVolume(v: number): void {
    this._musicVolume = clamp(v, 0, 1);
    this._rebalanceActive();
  }

  private _rebalanceActive(): void {
    for (const [id, active] of this._active) {
      const vol = this._computeVolume(id, active.baseVolume);
      const { howl, instanceId } = active;
      if (instanceId !== null) {
        howl.fade(howl.volume(instanceId) as number, vol, 150, instanceId);
      } else {
        howl.fade(howl.volume() as number, vol, 150);
      }
    }
  }

  get isMuted():       boolean { return this._muted;        }
  get masterVolume():  number  { return this._masterVolume; }
  get sfxVolume():     number  { return this._sfxVolume;    }
  get musicVolume():   number  { return this._musicVolume;  }
  get isUnlocked():    boolean { return this._unlocked;     }

  /** Preload a set of sounds ahead of time. */
  preload(ids: SoundId[]): void {
    for (const id of ids) this._load(id);
  }

  /** Release a specific sound from memory. */
  unload(id: SoundId): void {
    this.stopLoop(id, 0);
    const howl = this._sounds.get(id);
    if (howl) {
      howl.unload();
      this._sounds.delete(id);
    }
  }

  /** Full teardown. */
  destroy(): void {
    this.stopAll();
    for (const howl of this._sounds.values()) howl.unload();
    this._sounds.clear();
    this._active.clear();
    this._cooldowns.clear();
    this._pendingQueue.length = 0;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}