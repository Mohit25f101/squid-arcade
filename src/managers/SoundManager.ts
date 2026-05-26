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
  | "doll_turn"
  | "crowd_gasp"
  | "crowd_cheer"
  | "ambient_bg"
  | "heartbeat"
  | "crowd_murmur"
  | "room_tone"
  | "sub_rumble"
  | "drone_root"
  | "drone_overtone"
  | "music_box"
  | "ostinato"
  | "metallic_sparse"
  | "metallic_dense"
  | "riser_standard"
  | "riser_micro"
  | "scan_tone"
  | "doll_theme_full"
  | "doll_theme_2note"
  | "heartbeat_loop"
  | "doll_song"
  | "red_light_stinger";

export type SoundCategory = "sfx" | "music" | "ambient" | "ui";

interface SoundDefinition {
  src:      string[];
  category: SoundCategory;
  volume:   number;
  loop?:    boolean;
  html5?:   boolean;
  rate?:    number;
  sprite?:  Record<string, [number, number]>;
  pool?:    number;
}

// RESTORED: Missing interfaces causing your errors
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

const SOUND_DEFS: Record<SoundId, SoundDefinition> = {
  green_light:       { src: ["/audio/sfx/green_light.mp3"],    category: "sfx",     volume: 0.7  },
  red_light:         { src: ["/audio/sfx/red_light.mp3"],      category: "sfx",     volume: 0.85 },
  player_step:       { src: ["/audio/sfx/step.mp3"],           category: "sfx",     volume: 0.25, pool: 4 },
  player_jump:       { src: ["/audio/sfx/jump.mp3"],           category: "sfx",     volume: 0.45, pool: 2 },
  player_land:       { src: ["/audio/sfx/land.mp3"],           category: "sfx",     volume: 0.35, pool: 2 },
  player_eliminated: { src: ["/audio/sfx/eliminated.mp3"],     category: "sfx",     volume: 0.9  },
  player_victory:    { src: ["/audio/sfx/victory.mp3"],        category: "sfx",     volume: 0.9  },
  countdown_beep:    { src: ["/audio/sfx/beep.mp3"],           category: "sfx",     volume: 0.6,  pool: 1 },
  countdown_go:      { src: ["/audio/sfx/go.mp3"],             category: "sfx",     volume: 0.85 },
  combo_hit:         { src: ["/audio/sfx/combo.mp3"],          category: "sfx",     volume: 0.5,  pool: 3 },
  doll_turn:         { src: ["/audio/sfx/doll_turn.mp3"],      category: "sfx",     volume: 0.75 },
  crowd_gasp:        { src: ["/audio/sfx/gasp.mp3"],           category: "sfx",     volume: 0.6,  pool: 1 },
  crowd_cheer:       { src: ["/audio/sfx/cheer.mp3"],          category: "sfx",     volume: 0.7  },
  ui_click:          { src: ["/audio/ui/click.mp3"],           category: "ui",      volume: 0.4,  pool: 3 },
  ui_hover:          { src: ["/audio/ui/hover.mp3"],           category: "ui",      volume: 0.2,  pool: 2 },
  ui_confirm:        { src: ["/audio/ui/confirm.mp3"],         category: "ui",      volume: 0.55 },
  ui_back:           { src: ["/audio/ui/back.mp3"],            category: "ui",      volume: 0.4  },
  ambient_bg:        { src: ["/audio/ambient/room-tone-loop.mp3"], category: "ambient", volume: 0.35, loop: true, html5: true },
  heartbeat:         { src: ["/audio/stingers/heartbeat-loop.mp3"], category: "ambient", volume: 0.0,  loop: true },
  crowd_murmur:      { src: ["/audio/ambient/crowd-murmur-loop.mp3"],   category: "ambient", volume: 0.28, loop: true, html5: true },
  room_tone:         { src: ["/audio/ambient/room-tone-loop.mp3"],       category: "ambient", volume: 0.30, loop: true, html5: true },
  sub_rumble:        { src: ["/audio/ambient/sub-rumble-loop.mp3"],      category: "ambient", volume: 0.22, loop: true, html5: true },
  drone_root:        { src: ["/audio/drone/drone-root-loop.mp3"],        category: "ambient", volume: 0.30, loop: true, html5: true },
  drone_overtone:    { src: ["/audio/drone/drone-overtone-loop.mp3"],    category: "ambient", volume: 0.18, loop: true, html5: true },
  music_box:         { src: ["/audio/melodic/music-box-theme.mp3"],      category: "music",   volume: 0.40, html5: true },
  ostinato:          { src: ["/audio/melodic/ostinato-7-8-loop.mp3"],    category: "music",   volume: 0.32, loop: true, html5: true },
  metallic_sparse:   { src: ["/audio/percussion/metallic-sparse-loop.mp3"],  category: "ambient", volume: 0.20, loop: true },
  metallic_dense:    { src: ["/audio/percussion/metallic-dense-loop.mp3"],   category: "ambient", volume: 0.25, loop: true },
  riser_standard:    { src: ["/audio/tension/riser-standard.mp3"],       category: "sfx",     volume: 0.60 },
  riser_micro:       { src: ["/audio/tension/riser-micro.mp3"],          category: "sfx",     volume: 0.45 },
  scan_tone:         { src: ["/audio/tension/scan-tone-loop.mp3"],       category: "ambient", volume: 0.22, loop: true },
  doll_theme_full:   { src: ["/audio/stingers/doll-theme-full.mp3"],     category: "sfx",     volume: 0.70 },
  doll_theme_2note:  { src: ["/audio/stingers/doll-theme-2note.mp3"],    category: "sfx",     volume: 0.65 },
  heartbeat_loop:    { src: ["/audio/stingers/heartbeat-loop.mp3"],      category: "ambient", volume: 0.0,  loop: true },
  doll_song:         { src: ["/audio/sfx/doll_song.mp3"],                category: "sfx",     volume: 1.0 },
  red_light_stinger: { src: ["/audio/sfx/red_light.mp3"],                category: "sfx",     volume: 0.85 },
};

// ─── SoundManager Class ───────────────────────────────────────────────────────

export class SoundManager {
  private static _instance: SoundManager | null = null;

  private _masterVolume: number;
  private _sfxVolume:    number;
  private _musicVolume:  number;
  private _muted:        boolean;
  private _unlocked:     boolean;

  private _sounds:       Map<SoundId, Howl>          = new Map();
  private _active:       Map<SoundId, ActiveSound>   = new Map();
  private _cooldowns:    Map<SoundId, number>        = new Map();
  private _pendingQueue: Array<() => void>           = [];

  private constructor(opts: SoundManagerOptions = {}) {
    this._masterVolume = opts.masterVolume ?? 0.8;
    this._sfxVolume    = opts.sfxVolume    ?? 0.9;
    this._musicVolume  = opts.musicVolume  ?? 0.6;
    this._muted        = opts.muted        ?? false;
    this._unlocked     = false;

    Howler.autoUnlock    = true;
    Howler.html5PoolSize = 10;
    this._applyGlobalVolume();
  }

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

  unlock(): void {
    if (this._unlocked) return;
    this._unlocked = true;
    const ctx = Howler.ctx;
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    const queue = this._pendingQueue.splice(0);
    for (const fn of queue) fn();
  }

  private _load(id: SoundId): Howl {
    const cached = this._sounds.get(id);
    if (cached) return cached;
    const def  = SOUND_DEFS[id];
    const howl = new Howl({
      src:     def.src,
      volume:  this._computeVolume(id, def.volume),
      loop:    def.loop   ?? false,
      html5:   def.html5  ?? false,
      rate:    def.rate   ?? 1,
      pool:    def.pool   ?? 1,
      preload: true,
      onloaderror: (_id, err) => {
        console.debug(`[SoundManager] Load error for "${id}":`, err);
      },
    });
    this._sounds.set(id, howl);
    return howl;
  }

  private _computeVolume(id: SoundId, baseVolume: number): number {
    if (this._muted) return 0;
    const def    = SOUND_DEFS[id];
    const catMod =
      def.category === "sfx"     ? this._sfxVolume   :
      def.category === "ui"      ? this._sfxVolume   :
      def.category === "music"   ? this._musicVolume :
      def.category === "ambient" ? this._musicVolume : 1;
    return clamp(baseVolume * catMod * this._masterVolume, 0, 1);
  }

  private _applyGlobalVolume(): void {
    Howler.volume(this._muted ? 0 : this._masterVolume);
  }

  private _onCooldown(id: SoundId, cooldownMs: number): boolean {
    const last = this._cooldowns.get(id) ?? 0;
    const now  = performance.now();
    if (now - last < cooldownMs) return true;
    this._cooldowns.set(id, now);
    return false;
  }

  play(id: SoundId, cooldownMs = 0, rateJitter = 0, exactRate: number | null = null): void {
    if (this._muted) return;
    if (cooldownMs > 0 && this._onCooldown(id, cooldownMs)) return;
    const fire = () => {
      const howl = this._load(id);
      const def  = SOUND_DEFS[id];
      const vol  = this._computeVolume(id, def.volume);
      const rate = exactRate !== null ? exactRate : 1 + (Math.random() - 0.5) * rateJitter;
      const iid  = howl.play();
      if (typeof iid === "number") {
        howl.volume(vol, iid);
        howl.rate(clamp(rate, 0.5, 4.0), iid);
      }
    };
    if (!this._unlocked) { this._pendingQueue.push(fire); return; }
    fire();
  }

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
    if (!this._unlocked) { this._pendingQueue.push(fire); return; }
    fire();
  }

  stopLoop(id: SoundId, fadeMs = 600): void {
    const active = this._active.get(id);
    if (!active) return;
    const { howl, instanceId } = active;
    if (instanceId !== null) {
      howl.fade(howl.volume(instanceId) as number, 0, fadeMs, instanceId);
      setTimeout(() => { howl.stop(instanceId); this._active.delete(id); }, fadeMs + 50);
    } else {
      howl.fade(howl.volume() as number, 0, fadeMs);
      setTimeout(() => { howl.stop(); this._active.delete(id); }, fadeMs + 50);
    }
  }

  fadeTo(id: SoundId, targetVolume: number, durationMs: number): void {
    const active = this._active.get(id);
    if (!active) return;
    const { howl, instanceId } = active;
    const from = instanceId !== null ? (howl.volume(instanceId) as number) : (howl.volume() as number);
    const to   = clamp(targetVolume, 0, 1);
    if (instanceId !== null) howl.fade(from, to, durationMs, instanceId);
    else howl.fade(from, to, durationMs);
  }

  setHeartbeatIntensity(level: number): void {
    if (!this._active.has("heartbeat")) {
      if (level > 0.1) this.loop("heartbeat");
      return;
    }
    const def       = SOUND_DEFS["heartbeat"];
    const targetVol = this._computeVolume("heartbeat", def.volume + level * 0.55);
    this.fadeTo("heartbeat", clamp(targetVol, 0, 1), 200);
    const active = this._active.get("heartbeat");
    if (active) active.howl.rate(clamp(0.9 + level * 0.6, 0.5, 2));
  }

  stopAll(): void {
    for (const id of this._active.keys()) this.stopLoop(id, 0);
    Howler.stop();
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this._applyGlobalVolume();
    for (const [id, active] of this._active) {
      const vol = this._computeVolume(id, active.baseVolume);
      const { howl, instanceId } = active;
      if (instanceId !== null) howl.volume(muted ? 0 : vol, instanceId);
      else howl.volume(muted ? 0 : vol);
    }
  }

  setMasterVolume(v: number): void { this._masterVolume = clamp(v, 0, 1); this._applyGlobalVolume(); this._rebalanceActive(); }
  setSFXVolume(v: number):    void { this._sfxVolume    = clamp(v, 0, 1); this._rebalanceActive(); }
  setMusicVolume(v: number):  void { this._musicVolume  = clamp(v, 0, 1); this._rebalanceActive(); }

  private _rebalanceActive(): void {
    for (const [id, active] of this._active) {
      const vol = this._computeVolume(id, active.baseVolume);
      const { howl, instanceId } = active;
      if (instanceId !== null) howl.fade(howl.volume(instanceId) as number, vol, 150, instanceId);
      else howl.fade(howl.volume() as number, vol, 150);
    }
  }

  get isMuted():      boolean { return this._muted;        }
  get masterVolume(): number  { return this._masterVolume; }
  get sfxVolume():    number  { return this._sfxVolume;    }
  get musicVolume():  number  { return this._musicVolume;  }
  get isUnlocked():   boolean { return this._unlocked;     }

  preload(ids: SoundId[]): void { for (const id of ids) this._load(id); }

  unload(id: SoundId): void {
    this.stopLoop(id, 0);
    const howl = this._sounds.get(id);
    if (howl) { howl.unload(); this._sounds.delete(id); }
  }

  destroy(): void {
    this.stopAll();
    for (const howl of this._sounds.values()) howl.unload();
    this._sounds.clear();
    this._active.clear();
    this._cooldowns.clear();
    this._pendingQueue.length = 0;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}