/**
 * PHASE 2 — AUDIO ENGINE CONSOLIDATION
 * src/lib/audioEngine.ts
 *
 * Changes from Phase 1 (audioEngine.ts):
 *  - All asset paths: .webm → .mp3 / .wav (format priority: .mp3 first, .wav fallback)
 *  - Three-bus architecture: ambientBus | tensionBus | sfxBus
 *    (was: single musicGain + sfxGain)
 *  - setTensionLevel(0–1): dynamically crossfades ambientBus ↔ tensionBus
 *    so the Dalgona candy integrity model can drive audio stress reactively
 *  - New SFX preloads: candy_scrape | candy_microcrack | candy_snap
 *  - setGameState() now routes music to the correct bus (ambient vs tension)
 *  - Everything else preserved: iOS unlock, crossfade, SFX pool, singleton export
 *
 * BUS DESIGN:
 *   masterGain
 *   ├── ambientBus  (idle/green-light music — calm layers)
 *   ├── tensionBus  (red-light drone / countdown / dalgona stress layer)
 *   └── sfxBus      (all one-shot SFX, unaffected by tension crossfade)
 *
 *   setTensionLevel(t):
 *     ambientBus.gain → lerp(1 → 0, t)
 *     tensionBus.gain → lerp(0 → 1, t)
 *   This lets the Dalgona candy integrity value (0–1) drive the mix in real time
 *   without interrupting playback on either bus.
 *
 * BPM DESIGN (unchanged from Phase 1):
 *   Idle/menu:   84 BPM  — tense but breathable
 *   Green phase: 120 BPM — energetic, driving
 *   Red phase:   music STOPS → tensionBus drone takes over
 *   Final 10s:   140 BPM — frantic escalation
 *   Victory:     Joyful 4-bar swell then silence
 *   Death:       Music cuts instantly; 1.5 s reverb tail only
 *
 * FORMAT PRIORITY:
 *   Music tracks : .mp3  (best compression for looped stems)
 *   SFX          : .wav  (zero-latency, no decode delay on trigger)
 *   All paths now live under /audio/music/*.mp3 and /audio/sfx/*.wav
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AudioState =
  | "idle"
  | "green_light"
  | "red_light"
  | "countdown"
  | "victory"
  | "eliminated";

export type SfxId =
  // Glass Bridge
  | "footstep"
  | "footstep_glass"
  | "glass_safe"
  | "glass_shatter"
  | "fall_scream"
  // Red Light / Green Light
  | "green_light_bell"
  | "red_light_alarm"
  | "gunshot"
  // Dalgona — Phase 2 additions
  | "candy_scrape"
  | "candy_microcrack"
  | "candy_snap"
  // UI / shared
  | "ui_click"
  | "ui_hover"
  | "countdown_tick"
  | "victory_fanfare"
  | "game_over";

// Which bus a music track belongs to
type MusicBus = "ambient" | "tension";

interface TrackDef {
  key: string;   // buffers Map key, e.g. "music_idle_loop"
  bus: MusicBus;
  loop: boolean;
}

// ── Bus-level gain targets ────────────────────────────────────────────────────
// Used by setTensionLevel — separated so the math is auditable in one place.
const TENSION_RAMP_SEC = 0.15; // fast enough to feel reactive, slow enough not to click

// ── AudioEngine class ─────────────────────────────────────────────────────────

export class AudioEngine {
  // ── Web Audio graph ──────────────────────────────────────────────────────

  private ctx: AudioContext | null = null;

  // Master output
  private masterGain: GainNode | null = null;

  // Three buses (replaces Phase 1's single musicGain / sfxGain)
  private ambientBus: GainNode | null = null;  // calm layers: idle, green light
  private tensionBus: GainNode | null = null;  // stress layers: red light, countdown, dalgona
  private sfxBus: GainNode | null = null;      // all one-shots — unaffected by tension mix

  // ── Playback state ───────────────────────────────────────────────────────

  private buffers = new Map<string, AudioBuffer>();
  private activeMusicNode: AudioBufferSourceNode | null = null;
  private activeMusicBus: MusicBus | null = null;      // which bus the current track is on

  private currentState: AudioState = "idle";
  private currentTensionLevel = 0;             // 0 = full ambient, 1 = full tension

  // ── Lifecycle ────────────────────────────────────────────────────────────

  private isUnlocked = false;
  private loadPromise: Promise<void> | null = null;

  // ── Initialization ────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.ctx) return;

    this.ctx = new AudioContext();

    // ── Build the graph ──────────────────────────────────────────────────
    //
    //   ambientBus ──┐
    //   tensionBus ──┼── masterGain ── destination
    //   sfxBus     ──┘
    //
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;

    this.ambientBus = this.ctx.createGain();
    this.ambientBus.gain.value = 1;          // starts at full ambient

    this.tensionBus = this.ctx.createGain();
    this.tensionBus.gain.value = 0;          // starts silent; raised by setTensionLevel

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1;

    this.ambientBus.connect(this.masterGain);
    this.tensionBus.connect(this.masterGain);
    this.sfxBus.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    await this.ensureUnlocked();
    await this.preloadAll();
  }

  // ── iOS Safari unlock ─────────────────────────────────────────────────────

  private async ensureUnlocked(): Promise<void> {
    if (!this.ctx || this.isUnlocked) return;
    if (this.ctx.state === "running") {
      this.isUnlocked = true;
      return;
    }
    await this.ctx.resume();
    this.isUnlocked = true;
  }

  /** Call from any user-gesture handler (tap / click) before playing anything. */
  async unlockOnGesture(): Promise<void> {
    if (!this.ctx) await this.init();
    await this.ensureUnlocked();
  }

  // ── Asset manifest ────────────────────────────────────────────────────────
  //
  //  Phase 1 used .webm for everything.
  //  Phase 2: music → .mp3 (better loop compression), SFX → .wav (zero decode latency).
  //  Paths are relative to the Next.js /public directory.

  private readonly MUSIC_TRACKS: TrackDef[] = [
    // Ambient bus — calm / energetic layers
    { key: "music_idle_loop",        bus: "ambient", loop: true  },
    { key: "music_green_light_loop", bus: "ambient", loop: true  },
    { key: "music_victory_swell",    bus: "ambient", loop: false },

    // Tension bus — dread / stress layers
    { key: "music_tension_drone",    bus: "tension", loop: true  },
    { key: "music_countdown_loop",   bus: "tension", loop: true  },
  ];

  private readonly SFX_LIST: SfxId[] = [
    // Glass Bridge
    "footstep",
    "footstep_glass",
    "glass_safe",
    "glass_shatter",
    "fall_scream",
    // Red Light / Green Light
    "green_light_bell",
    "red_light_alarm",
    "gunshot",
    // Dalgona — Phase 2 additions
    "candy_scrape",
    "candy_microcrack",
    "candy_snap",
    // Shared UI
    "ui_click",
    "ui_hover",
    "countdown_tick",
    "victory_fanfare",
    "game_over",
  ];

  // ── Preloading ────────────────────────────────────────────────────────────

  private async preloadAll(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = Promise.all([
      // Music tracks: .mp3
      ...this.MUSIC_TRACKS.map((def) =>
        this.loadBuffer(`/audio/music/${def.key.replace("music_", "")}.mp3`, def.key)
      ),
      // SFX: .wav
      ...this.SFX_LIST.map((id) =>
        this.loadBuffer(`/audio/sfx/${id}.wav`, `sfx_${id}`)
      ),
    ]).then(() => {});

    return this.loadPromise;
  }

  private async loadBuffer(url: string, key: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch(url);
      if (!res.ok) return; // Missing assets fail silently during stub phase
      const raw = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(raw);
      this.buffers.set(key, buf);
    } catch {
      // Silently skip — audio stubs not yet generated
    }
  }

  // ── Volume controls ───────────────────────────────────────────────────────

  setMasterVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = clamp01(v);
  }

  /** Controls the entire ambient bus (idle/green-light music). */
  setAmbientVolume(v: number): void {
    if (this.ambientBus) this.ambientBus.gain.value = clamp01(v);
  }

  /** Controls the entire tension bus (drone/countdown). */
  setTensionVolume(v: number): void {
    if (this.tensionBus) this.tensionBus.gain.value = clamp01(v);
  }

  setSfxVolume(v: number): void {
    if (this.sfxBus) this.sfxBus.gain.value = clamp01(v);
  }

  // ── setTensionLevel — the new Phase 2 core feature ───────────────────────
  //
  //  tension = 0  → ambientBus at full volume, tensionBus silent
  //  tension = 1  → ambientBus silent, tensionBus at full volume
  //  tension = 0.5 → both buses at 0.5 (equal blend)
  //
  //  DalgonaCandy drives this with its candy integrity value:
  //    audioEngine.setTensionLevel(1 - candyIntegrity);
  //
  //  The ramp is applied as a linearRampToValueAtTime so it can be called
  //  every animation frame without clicks or glitches.

  setTensionLevel(tension: number): void {
    if (!this.ctx || !this.ambientBus || !this.tensionBus) return;

    const t = clamp01(tension);
    if (t === this.currentTensionLevel) return;
    this.currentTensionLevel = t;

    const now = this.ctx.currentTime;
    const end = now + TENSION_RAMP_SEC;

    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setValueAtTime(this.ambientBus.gain.value, now);
    this.ambientBus.gain.linearRampToValueAtTime(1 - t, end);

    this.tensionBus.gain.cancelScheduledValues(now);
    this.tensionBus.gain.setValueAtTime(this.tensionBus.gain.value, now);
    this.tensionBus.gain.linearRampToValueAtTime(t, end);
  }

  /** Convenience: snap tension back to zero instantly (e.g. on victory / elimination). */
  resetTensionLevel(rampSec = TENSION_RAMP_SEC): void {
    if (!this.ctx || !this.ambientBus || !this.tensionBus) return;
    const now = this.ctx.currentTime;
    const end = now + rampSec;

    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setValueAtTime(this.ambientBus.gain.value, now);
    this.ambientBus.gain.linearRampToValueAtTime(1, end);

    this.tensionBus.gain.cancelScheduledValues(now);
    this.tensionBus.gain.setValueAtTime(this.tensionBus.gain.value, now);
    this.tensionBus.gain.linearRampToValueAtTime(0, end);

    this.currentTensionLevel = 0;
  }

  // ── Game state transitions ────────────────────────────────────────────────
  //
  //  State → Bus mapping (Phase 2):
  //
  //    idle        → ambientBus  (idle_loop, 84 BPM)
  //    green_light → ambientBus  (green_light_loop, 120 BPM)
  //    red_light   → tensionBus  (tension_drone, no pulse)
  //    countdown   → tensionBus  (countdown_loop, 140 BPM)
  //    victory     → ambientBus  (victory_swell, one-shot)
  //    eliminated  → silence     (fade out, reset tension)

  async setGameState(state: AudioState): Promise<void> {
    if (state === this.currentState) return;
    this.currentState = state;

    switch (state) {
      case "idle":
        this.resetTensionLevel(1.5);
        await this.crossfadeMusic("music_idle_loop", 1.5, true, "ambient");
        break;

      case "green_light":
        this.resetTensionLevel(0.4);
        await this.crossfadeMusic("music_green_light_loop", 0.4, true, "ambient");
        break;

      case "red_light":
        // Let setTensionLevel calls from game logic handle the blend;
        // we just start the tension track if it isn't already running.
        await this.crossfadeMusic("music_tension_drone", 0.2, true, "tension");
        break;

      case "countdown":
        await this.crossfadeMusic("music_countdown_loop", 0.3, true, "tension");
        break;

      case "victory":
        this.resetTensionLevel(0.5);
        await this.crossfadeMusic("music_victory_swell", 0.5, false, "ambient");
        this.playSfx("victory_fanfare");
        break;

      case "eliminated":
        this.resetTensionLevel(0.4);
        await this.fadeOutMusic(0.4);
        this.playSfx("game_over");
        break;
    }
  }

  // ── Crossfade ─────────────────────────────────────────────────────────────
  //
  //  Phase 2 addition: `targetBus` parameter — determines which GainNode the
  //  new track connects to. The outgoing track disconnects from whichever bus
  //  it was on; no cross-bus bleed.

  private async crossfadeMusic(
    key: string,
    fadeDurationSec: number,
    loop: boolean,
    targetBus: MusicBus
  ): Promise<void> {
    if (!this.ctx) return;

    const destinationBus = targetBus === "ambient" ? this.ambientBus : this.tensionBus;
    if (!destinationBus) return;

    const buf = this.buffers.get(key);
    if (!buf) return;

    const now = this.ctx.currentTime;

    // ── Fade out the old track ──────────────────────────────────────────
    if (this.activeMusicNode) {
      const oldNode = this.activeMusicNode;
      const oldBusNode =
        this.activeMusicBus === "ambient" ? this.ambientBus : this.tensionBus;

      // Insert a per-node gain shim so we don't touch the bus master gain
      const oldFader = this.ctx.createGain();
      oldFader.gain.setValueAtTime(1, now);
      oldFader.gain.linearRampToValueAtTime(0, now + fadeDurationSec);

      if (oldBusNode) {
        try { oldNode.disconnect(oldBusNode); } catch {}
        oldNode.connect(oldFader);
        oldFader.connect(oldBusNode);
      }

      setTimeout(() => {
        try { oldNode.stop(); oldNode.disconnect(); oldFader.disconnect(); } catch {}
      }, fadeDurationSec * 1000 + 50);
    }

    // ── Fade in the new track ───────────────────────────────────────────
    const newFader = this.ctx.createGain();
    newFader.gain.setValueAtTime(0, now);
    newFader.gain.linearRampToValueAtTime(1, now + fadeDurationSec);
    newFader.connect(destinationBus);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.connect(newFader);
    src.start(now);

    this.activeMusicNode = src;
    this.activeMusicBus = targetBus;

    // Remove the per-node fader shim once the fade completes
    setTimeout(() => {
      try {
        src.disconnect(newFader);
        src.connect(destinationBus);
        newFader.disconnect();
      } catch {}
    }, fadeDurationSec * 1000 + 100);
  }

  private async fadeOutMusic(fadeDurationSec: number): Promise<void> {
    if (!this.ctx || !this.activeMusicNode) return;

    const oldNode = this.activeMusicNode;
    const oldBusNode =
      this.activeMusicBus === "ambient" ? this.ambientBus : this.tensionBus;

    if (oldBusNode) {
      const now = this.ctx.currentTime;
      const fader = this.ctx.createGain();
      fader.gain.setValueAtTime(1, now);
      fader.gain.linearRampToValueAtTime(0, now + fadeDurationSec);

      try { oldNode.disconnect(oldBusNode); } catch {}
      oldNode.connect(fader);
      fader.connect(oldBusNode);

      setTimeout(() => {
        try { oldNode.stop(); oldNode.disconnect(); fader.disconnect(); } catch {}
      }, fadeDurationSec * 1000 + 50);
    }

    this.activeMusicNode = null;
    this.activeMusicBus = null;
  }

  // ── SFX playback ──────────────────────────────────────────────────────────
  //
  //  All SFX route through sfxBus regardless of game state.
  //  sfxBus is not affected by setTensionLevel, so candy crunch sounds remain
  //  at their authored volume even when the music is fully tension-crossfaded.

  playSfx(
    id: SfxId,
    opts: { volume?: number; pitch?: number; delay?: number } = {}
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const buf = this.buffers.get(`sfx_${id}`);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.pitch ?? 1;

    if (opts.volume !== undefined && opts.volume !== 1) {
      const g = this.ctx.createGain();
      g.gain.value = clamp01(opts.volume);
      src.connect(g);
      g.connect(this.sfxBus);
    } else {
      src.connect(this.sfxBus);
    }

    src.start(this.ctx.currentTime + (opts.delay ?? 0));
    src.onended = () => { try { src.disconnect(); } catch {} };
  }

  /**
   * Footstep with slight pitch randomisation for naturalness.
   * Call on every player step event.
   */
  playFootstep(surface: "ground" | "glass" = "ground"): void {
    this.playSfx(surface === "glass" ? "footstep_glass" : "footstep", {
      pitch: 0.9 + Math.random() * 0.2,   // ±10 % pitch variation
      volume: 0.6 + Math.random() * 0.2,  // slight volume variation
    });
  }

  // ── Dalgona-specific helpers ──────────────────────────────────────────────
  //
  //  These wrap the generic playSfx with game-appropriate defaults so
  //  DalgonaCandy.tsx doesn't have to know about pitch randomisation tuning.

  /**
   * Call on each scraping motion. `intensity` maps to pitch / volume so
   * lighter scrapes sound more delicate.
   * @param intensity 0 (barely touching) → 1 (full pressure scrape)
   */
  playCandyScrape(intensity: number): void {
    const t = clamp01(intensity);
    this.playSfx("candy_scrape", {
      pitch: 0.85 + t * 0.3,    // 0.85 → 1.15
      volume: 0.4 + t * 0.5,    // 0.4 → 0.9
    });
  }

  /**
   * Call when edgeStress crosses a fracture threshold.
   * Pitch rises with crack severity.
   * @param severity 0 (hairline) → 1 (major fracture)
   */
  playCandyMicrocrack(severity: number): void {
    const t = clamp01(severity);
    this.playSfx("candy_microcrack", {
      pitch: 1.0 + t * 0.4,    // higher pitch = worse crack
      volume: 0.6 + t * 0.35,
    });
  }

  /** Call when totalIntegrity reaches 0 — the candy snaps. */
  playCandySnap(): void {
    this.playSfx("candy_snap", { pitch: 1.0, volume: 1.0 });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  suspend(): void { this.ctx?.suspend(); }
  resume(): void  { this.ctx?.resume(); }

  destroy(): void {
    try {
      this.activeMusicNode?.stop();
      this.ctx?.close();
    } catch {}
    this.ctx = null;
    this.buffers.clear();
    this.activeMusicNode = null;
    this.activeMusicBus = null;
    this.currentTensionLevel = 0;
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const audioEngine = new AudioEngine();