Now I have full clarity. Let me build the 3D RLGL component. I'll create a new file `RedLightGreenLight3D.tsx` that replaces the 2D one in the router.
Action: {"type": "mcp_tool", "tool_name": "mcp_view_bulk", "tool_arguments": {"paths": ["/tmp/squid-arcade/src/hooks/useSoundManager.ts", "/tmp/squid-arcade/src/managers/InputManager.ts"]}}
Observation: ===FILE: /tmp/squid-arcade/src/hooks/useSoundManager.ts
/tmp/squid-arcade/src/hooks/useSoundManager.ts:
1|"use client";
2|
3|import { useEffect, useRef, useCallback } from "react";
4|import { SoundManager, type SoundId } from "../managers/SoundManager";
5|import { useGameStore, selectVolumes } from "../store/gameStore";
6|
7|// ─── Hook ─────────────────────────────────────────────────────────────────────
8|
9|export interface SoundManagerHandle {
10|  play:    (id: SoundId, cooldownMs?: number, rateJitter?: number, exactRate?: number | null) => void;
11|  loop:    (id: SoundId) => void;
12|  stop:    (id: SoundId, fadeMs?: number) => void;
13|  stopAll: () => void;
14|  fadeTo:  (id: SoundId, vol: number, ms: number) => void;
15|  setHeartbeat: (level: number) => void;
16|  preload: (ids: SoundId[]) => void;
17|  unlock:  () => void;
18|  manager: () => SoundManager;
19|}
20|
21|export function useSoundManager(): SoundManagerHandle {
22|  const master = useGameStore((s) => s.settings.masterVolume);
23|  const sfx = useGameStore((s) => s.settings.sfxVolume);
24|  const music = useGameStore((s) => s.settings.musicVolume);
25|  const muted = master === 0;
26|
27|  const smRef = useRef<SoundManager>(
28|    SoundManager.getInstance({
29|      masterVolume: master,
30|      sfxVolume: sfx,
31|      musicVolume: music,
32|      muted,
33|    })
34|  );
35|
36|  useEffect(() => {
37|    const sm = smRef.current;
38|    sm.setMasterVolume(master);
39|    sm.setSFXVolume(sfx);
40|    sm.setMusicVolume(music);
41|  }, [master, sfx, music]);
42|
43|  useEffect(() => {
44|    smRef.current.setMuted(muted);
45|  }, [muted]);
46|
47|  useEffect(() => {
48|    const handler = () => {
49|      smRef.current.unlock();
50|    };
51|    window.addEventListener("click",      handler, { once: true, passive: true });
52|    window.addEventListener("touchstart", handler, { once: true, passive: true });
53|    window.addEventListener("keydown",    handler, { once: true, passive: true });
54|    return () => {
55|      window.removeEventListener("click",      handler);
56|      window.removeEventListener("touchstart", handler);
57|      window.removeEventListener("keydown",    handler);
58|    };
59|  }, []);
60|
61|  const handleRef = useRef<SoundManagerHandle>({
62|    play:    (id, cdMs = 0, jitter = 0, exactRate = null) => smRef.current.play(id, cdMs, jitter, exactRate),
63|    loop:    (id)               => smRef.current.loop(id),
64|    stop:    (id, ms = 600)     => smRef.current.stopLoop(id, ms),
65|    stopAll: ()                 => smRef.current.stopAll(),
66|    fadeTo:  (id, vol, ms)      => smRef.current.fadeTo(id, vol, ms),
67|    setHeartbeat: (level)       => smRef.current.setHeartbeatIntensity(level),
68|    preload: (ids)              => smRef.current.preload(ids),
69|    unlock:  ()                 => smRef.current.unlock(),
70|    manager: ()                 => smRef.current,
71|  });
72|
73|  return handleRef.current;
74|}
75|
76|// ─── Convenience: useUISound ──────────────────────────────────────────────────
77|
78|export function useUISound() {
79|  const sm = useSoundManager();
80|
81|  const onClick  = useCallback(() => sm.play("ui_click",  80),  [sm]);
82|  const onHover  = useCallback(() => sm.play("ui_hover",  60),  [sm]);
83|  const onConfirm= useCallback(() => sm.play("ui_confirm", 200), [sm]);
84|  const onBack   = useCallback(() => sm.play("ui_back",    200), [sm]);
85|
86|  return { onClick, onHover, onConfirm, onBack };
87|}

===END

===FILE: /tmp/squid-arcade/src/managers/InputManager.ts
/tmp/squid-arcade/src/managers/InputManager.ts:
1|/**
2| * src/lib/inputManager.ts
3| *
4| * UNIFIED INPUT MANAGER — Phase 1
5| *
6| * Abstracts mouse, touch, and keyboard events into a single `UnifiedInput`
7| * snapshot that any game can read each frame without touching the DOM.
8| *
9| * KEY DESIGN DECISIONS:
10| *
11| *  1. Framework-agnostic — zero React imports. Instantiate once, attach to
12| *     window/canvas, read from anywhere (game loops, Zustand subscribers,
13| *     audio engine callbacks).
14| *
15| *  2. Stability metric — a rolling variance of pointer-delta magnitudes over
16| *     a configurable time window (default 300 ms). Outputs a 0–1 scalar:
17| *       1.0 = perfectly still / rock-steady
18| *       0.0 = maximum detected jitter / tremor
19| *     DalgonaCandy uses this to scale fracture risk. RLGL uses it to detect
20| *     illegal movement during Red Light. GlassBridge ignores it (discrete
21| *     input only).
22| *
23| *  3. Zero-allocation hot path — the rolling sample buffer is pre-allocated
24| *     as a fixed-length Float32Array. No GC pressure during gameplay.
25| *
26| *  4. Pointer Events API first — falls back to legacy mouse/touch events only
27| *     when Pointer Events are unavailable (very old iOS Safari).
28| *
29| *  5. Multi-touch aware — tracks up to MAX_TOUCHES simultaneous contacts.
30| *     The primary pointer (first finger / mouse) drives `UnifiedInput`.
31| *     Secondary touches are available via `getTouches()` for games that
32| *     need raw multi-touch (pinch-zoom, two-button layouts, etc.).
33| *
34| *  6. Discrete left/right intents — latched on press, consumed by calling
35| *     `consumeIntent()`. This prevents the same keypress from triggering
36| *     two jumps if the game loop runs twice before the key-up fires.
37| *
38| * USAGE:
39| *
40| *   // Instantiate once (e.g. in GameShell.tsx)
41| *   const input = new InputManager({ stabilityWindowMs: 300 });
42| *   input.attach(canvasElement);
43| *
44| *   // In game loop:
45| *   const snap = input.snapshot();
46| *   if (snap.left) { ... }
47| *   input.consumeIntent("left");
48| *
49| *   // Cleanup on unmount:
50| *   input.detach();
51| *
52| * SINGLETON EXPORT:
53| *   For convenience a singleton `inputManager` is exported. GameShell calls
54| *   attach() on mount and detach() on unmount. Games import the singleton
55| *   and call snapshot() — no prop drilling needed.
56| */
57|
58|// ─────────────────────────────────────────────────────────────────────────────
59|// SECTION 1 — PUBLIC TYPES
60|// ─────────────────────────────────────────────────────────────────────────────
61|
62|/**
63| * A point-in-time snapshot of all input state.
64| * Read this once per game-tick; do not hold a reference between frames
65| * because the manager mutates its internal state in place.
66| */
67|export interface UnifiedInput {
68|  // ── Pointer position ───────────────────────────────────────────────────────
69|  /** X in logical canvas pixels (already divided by the CSS scale factor) */
70|  x: number;
71|  /** Y in logical canvas pixels */
72|  y: number;
73|  /** X normalized to [0, 1] relative to the attached element's width */
74|  nx: number;
75|  /** Y normalized to [0, 1] relative to the attached element's height */
76|  ny: number;
77|
78|  // ── Button / touch state ───────────────────────────────────────────────────
79|  /** True while the primary pointer is pressed / finger is down */
80|  isDown: boolean;
81|  /** True on the exact frame the pointer was pressed (single-frame) */
82|  justPressed: boolean;
83|  /** True on the exact frame the pointer was released (single-frame) */
84|  justReleased: boolean;
85|
86|  // ── Discrete directional intents (latched until consumed) ─────────────────
87|  /**
88|   * Left intent — true when ArrowLeft / A / left-side tap is detected.
89|   * Stays true until consumeIntent("left") is called.
90|   */
91|  left: boolean;
92|  /**
93|   * Right intent — true when ArrowRight / D / right-side tap is detected.
94|   * Stays true until consumeIntent("right") is called.
95|   */
96|  right: boolean;
97|  /**
98|   * Up intent — ArrowUp / W / swipe-up.
99|   * Available for games that need vertical discrete input.
100|   */
101|  up: boolean;
102|  /**
103|   * Down intent — ArrowDown / S / swipe-down.
104|   */
105|  down: boolean;
106|  /**
107|   * Action intent — Space / Enter / tap center.
108|   * Generic confirm / jump / cut button.
109|   */
110|  action: boolean;
111|
112|  // ── Movement delta ─────────────────────────────────────────────────────────
113|  /** Raw pointer movement since the last frame, in logical canvas pixels */
114|  dx: number;
115|  dy: number;
116|  /** Euclidean magnitude of (dx, dy) */
117|  deltaMagnitude: number;
118|
119|  // ── Stability metric ───────────────────────────────────────────────────────
120|  /**
121|   * Rolling stability score over the configured time window.
122|   *
123|   * Derivation:
124|   *   1. Every pointermove event appends |Δ| (delta magnitude) to a circular
125|   *      sample buffer together with the event timestamp.
126|   *   2. Samples older than `stabilityWindowMs` are expired.
127|   *   3. Variance of the remaining magnitudes is computed.
128|   *   4. Variance is mapped through a sigmoid-like curve and inverted:
129|   *        stability = 1 / (1 + variance / VARIANCE_SCALE)
130|   *      so high variance → low stability, steady hand → stability ≈ 1.
131|   *
132|   * Range: [0, 1]
133|   *   1.0 — no movement detected in the window (or perfectly uniform motion)
134|   *   0.0 — extreme jitter / rapid chaotic movement
135|   *
136|   * DalgonaCandy usage:
137|   *   fractureRisk += (1 - stability) * JITTER_FRACTURE_COEFFICIENT * dt
138|   */
139|  stability: number;
140|
141|  // ── Touch pressure ────────────────────────────────────────────────────────
142|  /**
143|   * Pressure from the Pointer Events API (0–1).
144|   * Mouse events always report 0.5. Falls back to 1.0 if unavailable.
145|   * DalgonaCandy: heavy pressure increases edge stress on the candy.
146|   */
147|  pressure: number;
148|
149|  // ── Keyboard ──────────────────────────────────────────────────────────────
150|  /** Set of currently held keys (KeyboardEvent.code values) */
151|  heldKeys: ReadonlySet<string>;
152|
153|  // ── Metadata ──────────────────────────────────────────────────────────────
154|  /** performance.now() of the most recent input event that mutated state */
155|  timestamp: number;
156|  /** True if the last input came from a touch screen (not mouse/keyboard) */
157|  isTouchSource: boolean;
158|}
159|
160|/** Which discrete intent to consume after reading it */
161|export type IntentKey = "left" | "right" | "up" | "down" | "action";
162|
163|/** Active touch contact exposed by getTouches() */
164|export interface TouchContact {
165|  pointerId: number;
166|  x: number;
167|  y: number;
168|  nx: number;
169|  ny: number;
170|  pressure: number;
171|}
172|
173|export interface InputManagerOptions {
174|  /**
175|   * Rolling window for stability calculation in milliseconds.
176|   * Longer → smoother but more latent stability reading.
177|   * Default: 300
178|   */
179|  stabilityWindowMs?: number;
180|  /**
181|   * Controls how aggressively variance maps to low stability.
182|   * Higher → gentler curve (small jitter doesn't tank stability).
183|   * Tune per-game; DalgonaCandy uses a low value for sensitivity.
184|   * Default: 120
185|   */
186|  varianceScale?: number;
187|  /**
188|   * Maximum number of simultaneous touch contacts tracked.
189|   * Default: 4
190|   */
191|  maxTouches?: number;
192|  /**
193|   * Logical world width. Used to normalize pointer X and to classify
194|   * left/right-side taps. Must match the game's WORLD_W constant.
195|   * Default: 1280
196|   */
197|  worldW?: number;
198|  /**
199|   * Logical world height.
200|   * Default: 720
201|   */
202|  worldH?: number;
203|  /**
204|   * CSS scale factor applied to the canvas by GameShell's ResizeObserver.
205|   * Pointer coords are divided by this to convert from CSS px → world px.
206|   * You can update this at runtime via setScale() as the window resizes.
207|   * Default: 1
208|   */
209|  initialScale?: number;
210|}
211|
212|// ─────────────────────────────────────────────────────────────────────────────
213|// SECTION 2 — INTERNAL CONSTANTS
214|// ─────────────────────────────────────────────────────────────────────────────
215|
216|/** Pre-allocated sample buffer size. At 60fps over 300ms = ~18 samples max. */
217|const SAMPLE_BUFFER_SIZE = 64;
218|
219|/**
220| * Swipe recognition: minimum pointer travel distance (logical px) to register
221| * as a directional intent on touch devices.
222| */
223|const SWIPE_THRESHOLD_PX = 30;
224|
225|/**
226| * Left-side tap zone boundary — taps with nx < this are "left" intents.
227| * Right-side is implicitly nx >= LEFT_ZONE_BOUNDARY.
228| */
229|const LEFT_ZONE_BOUNDARY = 0.5;
230|
231|// ─────────────────────────────────────────────────────────────────────────────
232|// SECTION 3 — STABILITY RING BUFFER
233|// ─────────────────────────────────────────────────────────────────────────────
234|
235|/**
236| * Pre-allocated circular buffer for stability samples.
237| * Avoids any heap allocation in the hot path.
238| */
239|class StabilityBuffer {
240|  private magnitudes: Float32Array;
241|  private timestamps: Float64Array;
242|  private head = 0;
243|  private count = 0;
244|  private readonly capacity: number;
245|
246|  constructor(capacity: number) {
247|    this.capacity = capacity;
248|    this.magnitudes = new Float32Array(capacity);
249|    this.timestamps = new Float64Array(capacity);
250|  }
251|
252|  push(magnitude: number, ts: number): void {
253|    this.magnitudes[this.head] = magnitude;
254|    this.timestamps[this.head] = ts;
255|    this.head = (this.head + 1) % this.capacity;
256|    if (this.count < this.capacity) this.count++;
257|  }
258|
259|  /**
260|   * Compute variance of magnitudes for samples within [now - windowMs, now].
261|   * Expired samples are skipped without mutation (lazy expiry).
262|   * Returns 0 if fewer than 2 live samples exist.
263|   */
264|  variance(now: number, windowMs: number): number {
265|    if (this.count === 0) return 0;
266|
267|    const cutoff = now - windowMs;
268|    let sum = 0;
269|    let n = 0;
270|
271|    // Two-pass: first compute mean of live samples
272|    for (let i = 0; i < this.count; i++) {
273|      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
274|      if (this.timestamps[idx] < cutoff) continue;
275|      sum += this.magnitudes[idx];
276|      n++;
277|    }
278|
279|    if (n < 2) return 0;
280|    const mean = sum / n;
281|
282|    // Second pass: compute variance
283|    let sumSq = 0;
284|    for (let i = 0; i < this.count; i++) {
285|      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
286|      if (this.timestamps[idx] < cutoff) continue;
287|      const diff = this.magnitudes[idx] - mean;
288|      sumSq += diff * diff;
289|    }
290|
291|    return sumSq / n;
292|  }
293|
294|  reset(): void {
295|    this.head = 0;
296|    this.count = 0;
297|    // No need to zero the typed arrays — count guards access
298|  }
299|}
300|
301|// ─────────────────────────────────────────────────────────────────────────────
302|// SECTION 4 — INPUT MANAGER CLASS
303|// ─────────────────────────────────────────────────────────────────────────────
304|
305|export class InputManager {
306|  // ── Config ────────────────────────────────────────────────────────────────
307|  private readonly stabilityWindowMs: number;
308|  private readonly varianceScale: number;
309|  private readonly maxTouches: number;
310|  private worldW: number;
311|  private worldH: number;
312|  private scale: number;
313|
314|  // ── DOM attachment ────────────────────────────────────────────────────────
315|  private target: HTMLElement | Window | null = null;
316|  private usePointerEvents = false;
317|
318|  // ── Pointer state ──────────────────────────────────────────────────────────
319|  private _x = 0;
320|  private _y = 0;
321|  private _prevX = 0;
322|  private _prevY = 0;
323|  private _isDown = false;
324|  private _justPressed = false;
325|  private _justReleased = false;
326|  private _pressure = 1;
327|  private _isTouchSource = false;
328|  private _timestamp = 0;
329|
330|  // Touch tracking (up to maxTouches simultaneous contacts)
331|  private touches = new Map<number, TouchContact>();
332|
333|  // Swipe gesture tracking
334|  private swipeStartX = 0;
335|  private swipeStartY = 0;
336|  private swipeActive = false;
337|
338|  // ── Discrete intents (latched) ─────────────────────────────────────────────
339|  private _left = false;
340|  private _right = false;
341|  private _up = false;
342|  private _down = false;
343|  private _action = false;
344|
345|  // ── Keyboard ──────────────────────────────────────────────────────────────
346|  private _heldKeys = new Set<string>();
347|
348|  // ── Stability ─────────────────────────────────────────────────────────────
349|  private stabilityBuffer: StabilityBuffer;
350|  private _stability = 1;
351|
352|  // ── Bound handler references (for clean removeEventListener) ──────────────
353|  private readonly _onPointerDown: (e: PointerEvent) => void;
354|  private readonly _onPointerMove: (e: PointerEvent) => void;
355|  private readonly _onPointerUp: (e: PointerEvent) => void;
356|  private readonly _onPointerCancel: (e: PointerEvent) => void;
357|  private readonly _onMouseDown: (e: MouseEvent) => void;
358|  private readonly _onMouseMove: (e: MouseEvent) => void;
359|  private readonly _onMouseUp: (e: MouseEvent) => void;
360|  private readonly _onTouchStart: (e: TouchEvent) => void;
361|  private readonly _onTouchMove: (e: TouchEvent) => void;
362|  private readonly _onTouchEnd: (e: TouchEvent) => void;
363|  private readonly _onKeyDown: (e: KeyboardEvent) => void;
364|  private readonly _onKeyUp: (e: KeyboardEvent) => void;
365|
366|  // ── Frame-boundary bookkeeping ────────────────────────────────────────────
367|  /**
368|   * Call endFrame() at the END of each game tick to clear single-frame flags.
369|   * GameShell calls this automatically when wrapping a game loop; standalone
370|   * games can call it manually.
371|   */
372|  private _frameCleared = false;
373|
374|  // ─────────────────────────────────────────────────────────────────────────
375|  // CONSTRUCTOR
376|  // ─────────────────────────────────────────────────────────────────────────
377|
378|  constructor(opts: InputManagerOptions = {}) {
379|    this.stabilityWindowMs = opts.stabilityWindowMs ?? 300;
380|    this.varianceScale = opts.varianceScale ?? 120;
381|    this.maxTouches = opts.maxTouches ?? 4;
382|    this.worldW = opts.worldW ?? 1280;
383|    this.worldH = opts.worldH ?? 720;
384|    this.scale = opts.initialScale ?? 1;
385|
386|    this.stabilityBuffer = new StabilityBuffer(SAMPLE_BUFFER_SIZE);
387|
388|    // Bind all handlers once so we can removeEventListener cleanly
389|    this._onPointerDown = this.handlePointerDown.bind(this);
390|    this._onPointerMove = this.handlePointerMove.bind(this);
391|    this._onPointerUp = this.handlePointerUp.bind(this);
392|    this._onPointerCancel = this.handlePointerCancel.bind(this);
393|    this._onMouseDown = this.handleMouseDown.bind(this);
394|    this._onMouseMove = this.handleMouseMove.bind(this);
395|    this._onMouseUp = this.handleMouseUp.bind(this);
396|    this._onTouchStart = this.handleTouchStart.bind(this);
397|    this._onTouchMove = this.handleTouchMove.bind(this);
398|    this._onTouchEnd = this.handleTouchEnd.bind(this);
399|    this._onKeyDown = this.handleKeyDown.bind(this);
400|    this._onKeyUp = this.handleKeyUp.bind(this);
401|  }
402|
403|  // ─────────────────────────────────────────────────────────────────────────
404|  // PUBLIC API — LIFECYCLE
405|  // ─────────────────────────────────────────────────────────────────────────
406|
407|  /**
408|   * Attach event listeners to a canvas or container element.
409|   * Keyboard listeners are always attached to `window`.
410|   * Safe to call multiple times — detaches previous target first.
411|   */
412|  attach(element: HTMLElement): void {
413|    this.detach();
414|    this.target = element;
415|    this.usePointerEvents = "onpointerdown" in element;
416|
417|    if (this.usePointerEvents) {
418|      element.addEventListener("pointerdown", this._onPointerDown);
419|      element.addEventListener("pointermove", this._onPointerMove);
420|      element.addEventListener("pointerup", this._onPointerUp);
421|      element.addEventListener("pointercancel", this._onPointerCancel);
422|    } else {
423|      // Legacy fallback for older iOS Safari
424|      element.addEventListener("mousedown", this._onMouseDown);
425|      element.addEventListener("mousemove", this._onMouseMove);
426|      window.addEventListener("mouseup", this._onMouseUp);
427|      element.addEventListener("touchstart", this._onTouchStart, { passive: false });
428|      element.addEventListener("touchmove", this._onTouchMove, { passive: false });
429|      element.addEventListener("touchend", this._onTouchEnd);
430|    }
431|
432|    window.addEventListener("keydown", this._onKeyDown);
433|    window.addEventListener("keyup", this._onKeyUp);
434|  }
435|
436|  /**
437|   * Remove all event listeners. Call on component unmount.
438|   */
439|  detach(): void {
440|    const el = this.target as HTMLElement | null;
441|    if (el) {
442|      if (this.usePointerEvents) {
443|        el.removeEventListener("pointerdown", this._onPointerDown);
444|        el.removeEventListener("pointermove", this._onPointerMove);
445|        el.removeEventListener("pointerup", this._onPointerUp);
446|        el.removeEventListener("pointercancel", this._onPointerCancel);
447|      } else {
448|        el.removeEventListener("mousedown", this._onMouseDown);
449|        el.removeEventListener("mousemove", this._onMouseMove);
450|        window.removeEventListener("mouseup", this._onMouseUp);
451|        el.removeEventListener("touchstart", this._onTouchStart);
452|        el.removeEventListener("touchmove", this._onTouchMove);
453|        el.removeEventListener("touchend", this._onTouchEnd);
454|      }
455|    }
456|    window.removeEventListener("keydown", this._onKeyDown);
457|    window.removeEventListener("keyup", this._onKeyUp);
458|
459|    this.target = null;
460|    this.reset();
461|  }
462|
463|  /**
464|   * Update the CSS→world scale factor when the window resizes.
465|   * GameShell calls this from its ResizeObserver callback.
466|   */
467|  setScale(scale: number): void {
468|    this.scale = scale > 0 ? scale : 1;
469|  }
470|
471|  /**
472|   * Update logical world dimensions (call if your game changes WORLD_W/H).
473|   */
474|  setWorldSize(w: number, h: number): void {
475|    this.worldW = w;
476|    this.worldH = h;
477|  }
478|
479|  // ─────────────────────────────────────────────────────────────────────────
480|  // PUBLIC API — READ STATE
481|  // ─────────────────────────────────────────────────────────────────────────
482|
483|  /**
484|   * Returns a frozen snapshot of the current input state.
485|   * Call once per frame at the top of your game tick.
486|   *
487|   * The returned object is a plain struct — no methods, no refs.
488|   * Spread or destructure freely; it won't mutate.
489|   */
490|  snapshot(): UnifiedInput {
491|    // Recompute stability on every snapshot call (lazy, not event-driven)
492|    // so that decay happens even when the pointer is stationary.
493|    const now = performance.now();
494|    const variance = this.stabilityBuffer.variance(now, this.stabilityWindowMs);
495|    this._stability = 1 / (1 + variance / this.varianceScale);
496|
497|    const dx = this._x - this._prevX;
498|    const dy = this._y - this._prevY;
499|
500|    return {
501|      x: this._x,
502|      y: this._y,
503|      nx: this._x / this.worldW,
504|      ny: this._y / this.worldH,
505|      isDown: this._isDown,
506|      justPressed: this._justPressed,
507|      justReleased: this._justReleased,
508|      left: this._left,
509|      right: this._right,
510|      up: this._up,
511|      down: this._down,
512|      action: this._action,
513|      dx,
514|      dy,
515|      deltaMagnitude: Math.sqrt(dx * dx + dy * dy),
516|      stability: this._stability,
517|      pressure: this._pressure,
518|      heldKeys: this._heldKeys as ReadonlySet<string>,
519|      timestamp: this._timestamp,
520|      isTouchSource: this._isTouchSource,
521|    };
522|  }
523|
524|  /**
525|   * Consume one or more discrete intents so they don't fire again next frame.
526|   * Call immediately after acting on an intent in your game tick.
527|   *
528|   * Example:
529|   *   if (snap.left) { startJump("left"); input.consumeIntent("left"); }
530|   */
531|  consumeIntent(...keys: IntentKey[]): void {
532|    for (const key of keys) {
533|      switch (key) {
534|        case "left":   this._left = false;   break;
535|        case "right":  this._right = false;  break;
536|        case "up":     this._up = false;     break;
537|        case "down":   this._down = false;   break;
538|        case "action": this._action = false; break;
539|      }
540|    }
541|  }
542|
543|  /**
544|   * Call at the END of each game tick to clear single-frame flags.
545|   * (justPressed, justReleased). Also updates prevX/prevY for dx/dy.
546|   *
547|   * GameShell wraps this automatically. Only call manually if you're
548|   * running a game loop outside of GameShell.
549|   */
550|  endFrame(): void {
551|    this._justPressed = false;
552|    this._justReleased = false;
553|    this._prevX = this._x;
554|    this._prevY = this._y;
555|    this._frameCleared = true;
556|  }
557|
558|  /**
559|   * Returns all currently active touch contacts, keyed by pointerId.
560|   * Useful for multi-touch layouts (e.g. two-button mobile overlays).
561|   */
562|  getTouches(): ReadonlyMap<number, TouchContact> {
563|    return this.touches;
564|  }
565|
566|  /**
567|   * Direct stability accessor (no full snapshot allocation).
568|   * Use this in hot paths that only need the stability number.
569|   */
570|  getStability(): number {
571|    return this._stability;
572|  }
573|
574|  /**
575|   * True if ANY pointer is currently down (mouse or touch).
576|   * Avoids a full snapshot() call in simple polling scenarios.
577|   */
578|  isDown(): boolean {
579|    return this._isDown;
580|  }
581|
582|  // ─────────────────────────────────────────────────────────────────────────
583|  // PUBLIC API — RESET
584|  // ─────────────────────────────────────────────────────────────────────────
585|
586|  /**
587|   * Reset all state to defaults. Called automatically on detach().
588|   * Also call when transitioning between game scenes to clear stale input.
589|   */
590|  reset(): void {
591|    this._x = 0;
592|    this._y = 0;
593|    this._prevX = 0;
594|    this._prevY = 0;
595|    this._isDown = false;
596|    this._justPressed = false;
597|    this._justReleased = false;
598|    this._pressure = 1;
599|    this._isTouchSource = false;
600|    this._left = false;
601|    this._right = false;
602|    this._up = false;
603|    this._down = false;
604|    this._action = false;
605|    this._heldKeys.clear();
606|    this.touches.clear();
607|    this.stabilityBuffer.reset();
608|    this._stability = 1;
609|    this.swipeActive = false;
610|    this._timestamp = 0;
611|  }
612|
613|  // ─────────────────────────────────────────────────────────────────────────
614|  // SECTION 5 — POINTER EVENTS HANDLERS
615|  // ─────────────────────────────────────────────────────────────────────────
616|
617|  private toWorldCoords(clientX: number, clientY: number): { x: number; y: number } {
618|    const el = this.target as HTMLElement | null;
619|    if (!el || el === window as unknown) {
620|      return { x: clientX / this.scale, y: clientY / this.scale };
621|    }
622|    const rect = (el as HTMLElement).getBoundingClientRect();
623|    return {
624|      x: (clientX - rect.left) / this.scale,
625|      y: (clientY - rect.top) / this.scale,
626|    };
627|  }
628|
629|  private handlePointerDown(e: PointerEvent): void {
630|    // Only track up to maxTouches contacts
631|    if (this.touches.size >= this.maxTouches) return;
632|
633|    const { x, y } = this.toWorldCoords(e.clientX, e.clientY);
634|    const nx = x / this.worldW;
635|    const ny = y / this.worldH;
636|
637|    this.touches.set(e.pointerId, {
638|      pointerId: e.pointerId,
639|      x, y, nx, ny,
640|      pressure: e.pressure > 0 ? e.pressure : 0.5,
641|    });
642|
643|    // Primary pointer drives the main state
644|    if (!this._isDown) {
645|      this._isDown = true;
646|      this._justPressed = true;
647|      this._x = x;
648|      this._y = y;
649|      this._pressure = e.pressure > 0 ? e.pressure : 0.5;
650|      this._isTouchSource = e.pointerType === "touch";
651|      this._timestamp = e.timeStamp;
652|
653|      // Classify as left/right intent based on which half of screen was tapped
654|      if (nx < LEFT_ZONE_BOUNDARY) {
655|        this._left = true;
656|      } else {
657|        this._right = true;
658|      }
659|
660|      // Action intent for center-ish taps (within middle third)
661|      if (nx >= 0.33 && nx <= 0.66) {
662|        this._action = true;
663|      }
664|
665|      // Start swipe tracking
666|      this.swipeStartX = x;
667|      this.swipeStartY = y;
668|      this.swipeActive = true;
669|    }
670|
671|    // Capture pointer so we receive events outside the element
672|    if (e.pointerType !== "touch") {
673|      try { (e.target as HTMLElement)?.setPointerCapture(e.pointerId); } catch {}
674|    }
675|  }
676|
677|  private handlePointerMove(e: PointerEvent): void {
678|    const { x, y } = this.toWorldCoords(e.clientX, e.clientY);
679|    const nx = x / this.worldW;
680|    const ny = y / this.worldH;
681|
682|    // Update touch contact record
683|    if (this.touches.has(e.pointerId)) {
684|      this.touches.set(e.pointerId, {
685|        pointerId: e.pointerId,
686|        x, y, nx, ny,
687|        pressure: e.pressure > 0 ? e.pressure : 0.5,
688|      });
689|    }
690|
691|    // Only update main state from the primary pointer (first one down)
692|    if (this._isDown && this.touches.has(e.pointerId)) {
693|      const dx = x - this._x;
694|      const dy = y - this._y;
695|      const mag = Math.sqrt(dx * dx + dy * dy);
696|
697|      // Push to stability ring buffer — this is the core of the metric
698|      this.stabilityBuffer.push(mag, e.timeStamp);
699|
700|      this._x = x;
701|      this._y = y;
702|      this._pressure = e.pressure > 0 ? e.pressure : 0.5;
703|      this._isTouchSource = e.pointerType === "touch";
704|      this._timestamp = e.timeStamp;
705|    } else if (!this._isDown) {
706|      // Hovering mouse — still track position and stability
707|      const dx = x - this._x;
708|      const dy = y - this._y;
709|      const mag = Math.sqrt(dx * dx + dy * dy);
710|      this.stabilityBuffer.push(mag, e.timeStamp);
711|      this._x = x;
712|      this._y = y;
713|      this._timestamp = e.timeStamp;
714|    }
715|
716|    // Swipe detection on touch
717|    if (this.swipeActive && e.pointerType === "touch") {
718|      const totalDx = x - this.swipeStartX;
719|      const totalDy = y - this.swipeStartY;
720|      const dist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
721|
722|      if (dist >= SWIPE_THRESHOLD_PX) {
723|        const angle = Math.atan2(totalDy, totalDx); // -π to π
724|        const absAngle = Math.abs(angle);
725|
726|        if (absAngle < Math.PI / 4) {
727|          this._right = true;
728|        } else if (absAngle > (3 * Math.PI) / 4) {
729|          this._left = true;
730|        } else if (angle < 0) {
731|          this._up = true;
732|        } else {
733|          this._down = true;
734|        }
735|
736|        this.swipeActive = false; // Consume the swipe — require lift to re-arm
737|      }
738|    }
739|  }
740|
741|  private handlePointerUp(e: PointerEvent): void {
742|    this.touches.delete(e.pointerId);
743|
744|    if (this._isDown && this.touches.size === 0) {
745|      this._isDown = false;
746|      this._justReleased = true;
747|      this._timestamp = e.timeStamp;
748|      this.swipeActive = false;
749|    }
750|  }
751|
752|  private handlePointerCancel(e: PointerEvent): void {
753|    this.touches.delete(e.pointerId);
754|    if (this.touches.size === 0) {
755|      this._isDown = false;
756|      this._justReleased = true;
757|      this.swipeActive = false;
758|    }
759|  }
760|
761|  // ─────────────────────────────────────────────────────────────────────────
762|  // SECTION 6 — LEGACY FALLBACK HANDLERS (non-Pointer Events browsers)
763|  // ─────────────────────────────────────────────────────────────────────────
764|
765|  private handleMouseDown(e: MouseEvent): void {
766|    const { x, y } = this.toWorldCoords(e.clientX, e.clientY);
767|    const nx = x / this.worldW;
768|
769|    this._isDown = true;
770|    this._justPressed = true;
771|    this._x = x;
772|    this._y = y;
773|    this._pressure = 0.5;
774|    this._isTouchSource = false;
775|    this._timestamp = e.timeStamp;
776|
777|    if (nx < LEFT_ZONE_BOUNDARY) this._left = true;
778|    else this._right = true;
779|    if (nx >= 0.33 && nx <= 0.66) this._action = true;
780|
781|    this.swipeStartX = x;
782|    this.swipeStartY = y;
783|    this.swipeActive = true;
784|  }
785|
786|  private handleMouseMove(e: MouseEvent): void {
787|    const { x, y } = this.toWorldCoords(e.clientX, e.clientY);
788|    const dx = x - this._x;
789|    const dy = y - this._y;
790|    const mag = Math.sqrt(dx * dx + dy * dy);
791|    this.stabilityBuffer.push(mag, e.timeStamp);
792|    this._x = x;
793|    this._y = y;
794|    this._isTouchSource = false;
795|    this._timestamp = e.timeStamp;
796|  }
797|
798|  private handleMouseUp(_e: MouseEvent): void {
799|    this._isDown = false;
800|    this._justReleased = true;
801|    this.swipeActive = false;
802|  }
803|
804|  private handleTouchStart(e: TouchEvent): void {
805|    e.preventDefault(); // Prevent scroll / zoom
806|    const t = e.changedTouches[0];
807|    if (!t) return;
808|    const { x, y } = this.toWorldCoords(t.clientX, t.clientY);
809|    const nx = x / this.worldW;
810|
811|    this._isDown = true;
812|    this._justPressed = true;
813|    this._x = x;
814|    this._y = y;
815|    this._pressure = (t as unknown as { force?: number }).force ?? 1;
816|    this._isTouchSource = true;
817|    this._timestamp = e.timeStamp;
818|
819|    if (nx < LEFT_ZONE_BOUNDARY) this._left = true;
820|    else this._right = true;
821|    if (nx >= 0.33 && nx <= 0.66) this._action = true;
822|
823|    this.swipeStartX = x;
824|    this.swipeStartY = y;
825|    this.swipeActive = true;
826|  }
827|
828|  private handleTouchMove(e: TouchEvent): void {
829|    e.preventDefault();
830|    const t = e.changedTouches[0];
831|    if (!t) return;
832|    const { x, y } = this.toWorldCoords(t.clientX, t.clientY);
833|    const dx = x - this._x;
834|    const dy = y - this._y;
835|    const mag = Math.sqrt(dx * dx + dy * dy);
836|    this.stabilityBuffer.push(mag, e.timeStamp);
837|    this._x = x;
838|    this._y = y;
839|    this._isTouchSource = true;
840|    this._timestamp = e.timeStamp;
841|
842|    // Swipe detection
843|    if (this.swipeActive) {
844|      const totalDx = x - this.swipeStartX;
845|      const totalDy = y - this.swipeStartY;
846|      const dist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
847|      if (dist >= SWIPE_THRESHOLD_PX) {
848|        const angle = Math.atan2(totalDy, totalDx);
849|        const absAngle = Math.abs(angle);
850|        if (absAngle < Math.PI / 4) this._right = true;
851|        else if (absAngle > (3 * Math.PI) / 4) this._left = true;
852|        else if (angle < 0) this._up = true;
853|        else this._down = true;
854|        this.swipeActive = false;
855|      }
856|    }
857|  }
858|
859|  private handleTouchEnd(_e: TouchEvent): void {
860|    this._isDown = false;
861|    this._justReleased = true;
862|    this.swipeActive = false;
863|  }
864|
865|  // ─────────────────────────────────────────────────────────────────────────
866|  // SECTION 7 — KEYBOARD HANDLERS
867|  // ─────────────────────────────────────────────────────────────────────────
868|
869|  /**
870|   * Key → Intent mapping.
871|   * Multiple keys can map to the same intent (e.g. ArrowLeft and A both → left).
872|   */
873|  private static readonly KEY_MAP: Record<string, IntentKey> = {
874|    ArrowLeft:  "left",
875|    KeyA:       "left",
876|    ArrowRight: "right",
877|    KeyD:       "right",
878|    ArrowUp:    "up",
879|    KeyW:       "up",
880|    ArrowDown:  "down",
881|    KeyS:       "down",
882|    Space:      "action",
883|    Enter:      "action",
884|    NumpadEnter:"action",
885|  };
886|
887|  private handleKeyDown(e: KeyboardEvent): void {
888|    // Don't interfere with browser shortcuts or form inputs
889|    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
890|    if (e.repeat) return; // Hold-to-repeat — ignore, intents are latched
891|
892|    this._heldKeys.add(e.code);
893|    this._timestamp = e.timeStamp;
894|    this._isTouchSource = false;
895|
896|    const intent = InputManager.KEY_MAP[e.code];
897|    if (!intent) return;
898|
899|    // Prevent arrow keys from scrolling the page during gameplay
900|    e.preventDefault();
901|
902|    switch (intent) {
903|      case "left":   this._left = true;   break;
904|      case "right":  this._right = true;  break;
905|      case "up":     this._up = true;     break;
906|      case "down":   this._down = true;   break;
907|      case "action": this._action = true; break;
908|    }
909|  }
910|
911|  private handleKeyUp(e: KeyboardEvent): void {
912|    this._heldKeys.delete(e.code);
913|    this._timestamp = e.timeStamp;
914|  }
915|}
916|
917|// ─────────────────────────────────────────────────────────────────────────────
918|// SECTION 8 — SINGLETON EXPORT
919|// ─────────────────────────────────────────────────────────────────────────────
920|
921|/**
922| * Global singleton instance.
923| *
924| * GameShell calls inputManager.attach(canvasEl) on mount and
925| * inputManager.detach() on unmount. Games import this singleton and
926| * call inputManager.snapshot() each tick — no prop drilling, no context.
927| *
928| * Options are set to sensible defaults for the Squid Arcade world size.
929| * DalgonaCandy will call inputManager.setScale(shell.scale) after mount
930| * to ensure pointer coordinates are correctly mapped.
931| *
932| * Override options at construction time if you need a custom world size:
933| *   const inputManager = new InputManager({ worldW: 1920, worldH: 1080 });
934| */
935|export const inputManager = new InputManager({
936|  stabilityWindowMs: 300,
937|  varianceScale: 120,
938|  maxTouches: 4,
939|  worldW: 1280,
940|  worldH: 720,
941|  initialScale: 1,
942|});

===END