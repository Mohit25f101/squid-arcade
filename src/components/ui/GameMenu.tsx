Now I have everything I need. The `squid_game_doll_song.mp3` is exactly 8 seconds — perfect for driving the green-light phase. Let me build the 3D RLGL game.
Action: {"type": "mcp_tool", "tool_name": "mcp_view_bulk", "tool_arguments": {"paths": ["/tmp/squid-arcade/src/components/ui/GameMenu.tsx"]}}
Observation: ===FILE: /tmp/squid-arcade/src/components/ui/GameMenu.tsx
/tmp/squid-arcade/src/components/ui/GameMenu.tsx:
1|"use client";
2|
3|/**
4| * src/components/GameMenu.tsx
5| *
6| * Part 1 Refactor — Navigation & UI
7| *
8| * Changes from original:
9| * - "select" MenuState removed; clicking a game icon launches immediately.
10| * - SelectCard component removed.
11| * - handleShowSelect / handleBackToMain removed.
12| * - Nav list (PLAY GAME / SETTINGS / EXIT) replaced by ControlsHUD
13| * (fixed bottom-right ⚙ gear + ↩ exit icon buttons).
14| * - SettingsOverlay dynamic import replaced by inline SettingsPanel that
15| * reads and writes gameStore directly — settings now persist correctly.
16| * - handleExitConfirm: window.close() replaced with resetHUD() +
17| * setActiveGame("menu"), which atomically resets runtimePhase → "idle"
18| * and clears eliminationPayload.
19| */
20|
21|import React, { useState, useEffect, useRef, useCallback } from "react";
22|import { useGameStore, type GameId, type Difficulty } from "@/store/gameStore";
23|import { SymbolTrio, CircleSymbol, TriangleSymbol, SquareSymbol } from "./SquidSymbols";
24|import { useMenuAudio } from "@/hooks/useMenuAudio";
25|
26|// ─────────────────────────────────────────────────────────────────────────────
27|// TYPES
28|// ─────────────────────────────────────────────────────────────────────────────
29|
30|interface GameMenuProps {
31|  onLaunch?: (id: GameId) => void;
32|}
33|
34|// "select" removed — icon tap launches directly.
35|type MenuState = "intro" | "main" | "settings" | "exit-confirm";
36|
37|interface GameMode {
38|  id:         GameId;
39|  icon:       string;
40|  label:      string;
41|  sub:        string;
42|  color:      string;
43|  badge:      string;
44|  episode:    number;
45|  desc:       string;
46|  difficulty: number;
47|}
48|
49|// ─────────────────────────────────────────────────────────────────────────────
50|// DATA
51|// ─────────────────────────────────────────────────────────────────────────────
52|
53|const GAME_MODES: GameMode[] = [
54|  { id: "red-light-green-light", icon: "/RedLightGreenLight.ico", label: "RED LIGHT\nGREEN LIGHT", sub: "RED LIGHT GREEN LIGHT", color: "#FF0066", badge: "GAME 01", episode: 1, desc: "Run. Freeze. Survive 60 seconds. One false move ends everything.", difficulty: 3 },
55|  { id: "glass-bridge",          icon: "/GlassBridge.ico",        label: "GLASS\nBRIDGE",           sub: "GLASS BRIDGE",          color: "#00FFB2", badge: "GAME 02", episode: 2, desc: "Two panes. One safe. Sixteen rows to cross. No second chances.",   difficulty: 4 },
56|  { id: "dalgona",               icon: "/DalgonaCandy.ico",        label: "DALGONA",                 sub: "DALGONA",               color: "#FFD700", badge: "GAME 03", episode: 3, desc: "Carve the shape without breaking the candy. Steady hands survive.", difficulty: 3 },
57|];
58|
59|// ─────────────────────────────────────────────────────────────────────────────
60|// SETTINGS PANEL — style tokens (defined at module scope, not recreated per render)
61|// ─────────────────────────────────────────────────────────────────────────────
62|
63|const SP = {
64|  sectionWrap: {
65|    marginBottom: "1.2rem",
66|    padding: "0.75rem 0.9rem",
67|    background: "rgba(255,255,255,0.025)",
68|    border: "1px solid rgba(255,255,255,0.07)",
69|    borderRadius: 3,
70|  } as React.CSSProperties,
71|  sectionHead: {
72|    fontFamily: "var(--font-mono-sq)",
73|    fontSize: "0.6rem",
74|    letterSpacing: "0.22em",
75|    color: "rgba(255,0,102,0.65)",
76|    marginBottom: "0.7rem",
77|  } as React.CSSProperties,
78|  sliderRow: {
79|    display: "flex",
80|    alignItems: "center",
81|    gap: "0.65rem",
82|    marginBottom: "0.52rem",
83|  } as React.CSSProperties,
84|  sliderLabel: {
85|    fontFamily: "var(--font-mono-sq)",
86|    fontSize: "0.62rem",
87|    letterSpacing: "0.12em",
88|    color: "rgba(255,255,255,0.35)",
89|    width: "5.2rem",
90|    flexShrink: 0,
91|  } as React.CSSProperties,
92|  sliderPct: {
93|    fontFamily: "var(--font-mono-sq)",
94|    fontSize: "0.65rem",
95|    color: "#FF0066",
96|    width: "2.4rem",
97|    textAlign: "right",
98|  } as React.CSSProperties,
99|  toggleRow: {
100|    all: "unset",
101|    display: "flex",
102|    alignItems: "center",
103|    justifyContent: "space-between",
104|    width: "100%",
105|    cursor: "pointer",
106|    padding: "0.38rem 0",
107|    borderBottom: "1px solid rgba(255,255,255,0.04)",
108|  } as React.CSSProperties,
109|  toggleLabel: {
110|    fontFamily: "var(--font-mono-sq)",
111|    fontSize: "0.65rem",
112|    letterSpacing: "0.12em",
113|    color: "rgba(255,255,255,0.5)",
114|  } as React.CSSProperties,
115|};
116|
117|// ─────────────────────────────────────────────────────────────────────────────
118|// BACKGROUND CANVAS (unchanged from original)
119|// ─────────────────────────────────────────────────────────────────────────────
120|
121|function BackgroundCanvas() {
122|  const canvasRef = useRef<HTMLCanvasElement>(null);
123|  useEffect(() => {
124|    const canvas = canvasRef.current;
125|    if (!canvas) return;
126|    const ctx = canvas.getContext("2d")!;
127|    let raf: number;
128|    const COLORS = ["rgba(255,0,102,0.10)","rgba(255,0,102,0.05)","rgba(180,0,60,0.07)","rgba(0,255,178,0.04)","rgba(255,255,255,0.025)"];
129|    type Streak = { x:number; y:number; length:number; speed:number; alpha:number; color:string };
130|    let streaks: Streak[] = [];
131|    function resize() { canvas!.width = canvas!.offsetWidth; canvas!.height = canvas!.offsetHeight; }
132|    function spawn(): Streak { return { x: Math.random()*canvas!.width, y: Math.random()*canvas!.height, length: 80+Math.random()*220, speed: 3+Math.random()*10, alpha: 0.3+Math.random()*0.7, color: COLORS[Math.floor(Math.random()*COLORS.length)] }; }
133|    resize();
134|    window.addEventListener("resize", resize);
135|    for (let i = 0; i < 28; i++) streaks.push(spawn());
136|    function draw() {
137|      ctx.clearRect(0,0,canvas!.width,canvas!.height);
138|      for (const s of streaks) {
139|        ctx.save(); ctx.globalAlpha = s.alpha;
140|        const g = ctx.createLinearGradient(s.x,s.y,s.x+s.length,s.y);
141|        g.addColorStop(0,"transparent"); g.addColorStop(1,s.color);
142|        ctx.fillStyle = g; ctx.fillRect(s.x,s.y,s.length,1.5); ctx.restore();
143|        s.x += s.speed;
144|        if (s.x > canvas!.width + s.length) { s.x = -s.length; s.y = Math.random()*canvas!.height; }
145|      }
146|      raf = requestAnimationFrame(draw);
147|    }
148|    draw();
149|    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
150|  }, []);
151|  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} aria-hidden />;
152|}
153|
154|// ─────────────────────────────────────────────────────────────────────────────
155|// GAME ICON CARD
156|// Simplified: onClick always fires the launch handler directly.
157|// aria-label updated to "Play …" (was "Select …") since one tap now launches.
158|// ─────────────────────────────────────────────────────────────────────────────
159|
160|function GameIconCard({
161|  mode,
162|  onHover,
163|  onClick,
164|  delay,
165|}: {
166|  mode:    GameMode;
167|  onHover: () => void;
168|  onClick: (id: GameId) => void;
169|  delay:   number;
170|}) {
171|  const lines    = mode.label.split("\n");
172|  const colorKey = mode.color === "#FF0066" ? "pink" : mode.color === "#00FFB2" ? "teal" : "gold";
173|  return (
174|    <button
175|      className="sq-icon-card"
176|      data-color={colorKey}
177|      style={{ animationDelay: `${delay}s` }}
178|      onMouseEnter={onHover}
179|      onClick={() => onClick(mode.id)}
180|      aria-label={`Play ${mode.sub}`}
181|    >
182|      <span className="sq-icon-badge" style={{ color: mode.color, background: `${mode.color}12`, border: `1px solid ${mode.color}30` }}>
183|        {mode.badge}
184|      </span>
185|      <img src={mode.icon} alt={mode.sub} className="sq-icon-img" style={{ color: mode.color }} />
186|      <span className="sq-icon-label" style={{ color: mode.color }}>
187|        {lines.map((l, i) => (
188|          <React.Fragment key={i}>{l}{i < lines.length - 1 && <br />}</React.Fragment>
189|        ))}
190|      </span>
191|      {/* FIX 1.5 / Menu Polish — render desc field below the label */}
192|      <span
193|        className="sq-icon-desc"
194|        style={{
195|          fontFamily: "var(--font-mono-sq, 'JetBrains Mono', monospace)",
196|          fontSize: "clamp(9px, 1.6vw, 11px)",
197|          letterSpacing: "0.08em",
198|          color: "rgba(255,255,255,0.42)",
199|          lineHeight: 1.55,
200|          textAlign: "center",
201|          marginTop: 6,
202|          padding: "0 8px",
203|          maxWidth: 160,
204|          display: "block",
205|        }}
206|      >
207|        {mode.desc}
208|      </span>
209|    </button>
210|  );
211|}
212|
213|// ─────────────────────────────────────────────────────────────────────────────
214|// CONTROLS HUD
215|// Fixed bottom-right: gear (settings) and log-out (exit) icon buttons.
216|// — 44 × 44 px minimum touch targets per WCAG 2.5.5
217|// — env(safe-area-inset-*) keeps buttons clear of iPhone notch/home bar
218|// — Feather-style SVGs: stroke-based, scale-independent
219|// ─────────────────────────────────────────────────────────────────────────────
220|
221|const CTRL_BASE: React.CSSProperties = {
222|  width: 44, height: 44, minWidth: 44, minHeight: 44,
223|  display: "flex", alignItems: "center", justifyContent: "center",
224|  background: "rgba(8,8,14,0.78)",
225|  border: "1px solid rgba(255,255,255,0.14)",
226|  borderRadius: 4,
227|  cursor: "pointer",
228|  color: "rgba(255,255,255,0.55)",
229|  backdropFilter: "blur(12px)",
230|  WebkitBackdropFilter: "blur(12px)",
231|  transition: "border-color 140ms, background 140ms, color 140ms",
232|};
233|
234|function ControlsHUD({
235|  onSettings,
236|  onExit,
237|  onHover,
238|}: {
239|  onSettings: () => void;
240|  onExit:     () => void;
241|  onHover:    () => void;
242|}) {
243|  const applyHover = (accentColor: string) => ({
244|    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
245|      onHover();
246|      const el = e.currentTarget;
247|      el.style.borderColor = `${accentColor}80`;
248|      el.style.background  = `${accentColor}18`;
249|      el.style.color       = accentColor;
250|    },
251|    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
252|      const el = e.currentTarget;
253|      el.style.borderColor = "rgba(255,255,255,0.14)";
254|      el.style.background  = "rgba(8,8,14,0.78)";
255|      el.style.color       = "rgba(255,255,255,0.55)";
256|    },
257|  });
258|
259|  return (
260|    <div
261|      style={{
262|        position: "absolute",
263|        right:    "max(20px, calc(env(safe-area-inset-right, 0px) + 16px))",
264|        bottom:   "max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px))",
265|        display:  "flex",
266|        flexDirection: "column",
267|        gap: 8,
268|        zIndex: 50,
269|      }}
270|    >
271|      {/* Settings — gear icon */}
272|      <button aria-label="Open settings" style={CTRL_BASE} onClick={onSettings} {...applyHover("#FF0066")}>
273|        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
274|          <circle cx="12" cy="12" r="3" />
275|          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
276|        </svg>
277|      </button>
278|
279|      {/* Exit — log-out icon */}
280|      <button aria-label="Return to menu" style={CTRL_BASE} onClick={onExit} {...applyHover("#FF5050")}>
281|        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
282|          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
283|          <polyline points="16 17 21 12 16 7" />
284|          <line x1="21" y1="12" x2="9" y2="12" />
285|        </svg>
286|      </button>
287|    </div>
288|  );
289|}
290|
291|// ─────────────────────────────────────────────────────────────────────────────
292|// SETTINGS PANEL
293|// Inline replacement for the old SettingsOverlay dynamic import.
294|// Reads and writes gameStore directly — every change persists to localStorage
295|// immediately via updateSettings() (see gameStore.ts § updateSettings).
296|// ─────────────────────────────────────────────────────────────────────────────
297|
298|function SettingsPanel({
299|  onClose,
300|  onHover,
301|  onClick,
302|}: {
303|  onClose:  () => void;
304|  onHover:  () => void;
305|  onClick:  () => void;
306|}) {
307|  const settings       = useGameStore(s => s.settings);
308|  const updateSettings = useGameStore(s => s.updateSettings);
309|
310|  return (
311|    <div
312|      className="sq-overlay-backdrop"
313|      onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}
314|    >
315|      <div
316|        className="sq-overlay-panel"
317|        style={{ maxWidth: 420, width: "min(420px, 90vw)", maxHeight: "85dvh", overflowY: "auto", overscrollBehavior: "contain" }}
318|      >
319|        <div style={{ display:"flex", justifyContent:"center", marginBottom:"0.9rem" }}>
320|          <SymbolTrio size={14} gap={10} />
321|        </div>
322|        <h2
323|          className="sq-overlay-title"
324|          style={{ textAlign:"center", fontSize:"clamp(1.6rem,3vw,2.2rem)", marginBottom:"1.4rem", letterSpacing:"0.2em" }}
325|        >
326|          SETTINGS
327|        </h2>
328|
329|        {/* ── AUDIO ─────────────────────────────────────────────────────── */}
330|        <div style={SP.sectionWrap}>
331|          <div style={SP.sectionHead}>◉  AUDIO</div>
332|
333|          <div style={SP.sliderRow}>
334|            <span style={SP.sliderLabel}>MASTER</span>
335|            <input type="range" min={0} max={1} step={0.05}
336|              value={settings.masterVolume}
337|              onChange={e => updateSettings({ masterVolume: parseFloat(e.target.value) })}
338|              style={{ flex:1, accentColor:"#FF0066", cursor:"pointer" }}
339|              aria-label="Master Volume"
340|            />
341|            <span style={SP.sliderPct}>{Math.round(settings.masterVolume * 100)}%</span>
342|          </div>
343|
344|          <div style={SP.sliderRow}>
345|            <span style={SP.sliderLabel}>MUSIC</span>
346|            <input type="range" min={0} max={1} step={0.05}
347|              value={settings.musicVolume}
348|              onChange={e => updateSettings({ musicVolume: parseFloat(e.target.value) })}
349|              style={{ flex:1, accentColor:"#FF0066", cursor:"pointer" }}
350|              aria-label="Music Volume"
351|            />
352|            <span style={SP.sliderPct}>{Math.round(settings.musicVolume * 100)}%</span>
353|          </div>
354|
355|          <div style={{ ...SP.sliderRow, marginBottom: 0 }}>
356|            <span style={SP.sliderLabel}>SFX</span>
357|            <input type="range" min={0} max={1} step={0.05}
358|              value={settings.sfxVolume}
359|              onChange={e => updateSettings({ sfxVolume: parseFloat(e.target.value) })}
360|              style={{ flex:1, accentColor:"#FF0066", cursor:"pointer" }}
361|              aria-label="SFX Volume"
362|            />
363|            <span style={SP.sliderPct}>{Math.round(settings.sfxVolume * 100)}%</span>
364|          </div>
365|        </div>
366|
367|        {/* ── GAMEPLAY ──────────────────────────────────────────────────── */}
368|        <div style={SP.sectionWrap}>
369|          <div style={SP.sectionHead}>⬡  GAMEPLAY</div>
370|
371|          <button style={SP.toggleRow} onMouseEnter={onHover} onClick={() => { onClick(); updateSettings({ screenShake: !settings.screenShake }); }}>
372|            <span style={SP.toggleLabel}>SCREEN SHAKE</span>
373|            <span style={{ fontFamily:"var(--font-mono-sq)", fontSize:"0.65rem", letterSpacing:"0.14em", color: settings.screenShake ? "#00FFB2" : "rgba(255,255,255,0.22)", transition:"color 160ms" }}>
374|              {settings.screenShake ? "ON" : "OFF"}
375|            </span>
376|          </button>
377|
378|          <button style={SP.toggleRow} onMouseEnter={onHover} onClick={() => { onClick(); updateSettings({ particlesEnabled: !settings.particlesEnabled }); }}>
379|            <span style={SP.toggleLabel}>PARTICLES</span>
380|            <span style={{ fontFamily:"var(--font-mono-sq)", fontSize:"0.65rem", letterSpacing:"0.14em", color: settings.particlesEnabled ? "#00FFB2" : "rgba(255,255,255,0.22)", transition:"color 160ms" }}>
381|              {settings.particlesEnabled ? "ON" : "OFF"}
382|            </span>
383|          </button>
384|
385|          <button style={{ ...SP.toggleRow, borderBottom:"none" }} onMouseEnter={onHover} onClick={() => { onClick(); updateSettings({ showFPS: !settings.showFPS }); }}>
386|            <span style={SP.toggleLabel}>SHOW FPS</span>
387|            <span style={{ fontFamily:"var(--font-mono-sq)", fontSize:"0.65rem", letterSpacing:"0.14em", color: settings.showFPS ? "#00FFB2" : "rgba(255,255,255,0.22)", transition:"color 160ms" }}>
388|              {settings.showFPS ? "ON" : "OFF"}
389|            </span>
390|          </button>
391|        </div>
392|
393|        {/* ── DIFFICULTY ────────────────────────────────────────────────── */}
394|        <div style={SP.sectionWrap}>
395|          <div style={SP.sectionHead}>△  DIFFICULTY</div>
396|          <div style={{ display:"flex", gap:8 }}>
397|            {(["easy", "normal", "hard"] as Difficulty[]).map(d => {
398|              const active = settings.difficulty === d;
399|              const col    = d === "easy" ? "#00FFB2" : d === "hard" ? "#FF0066" : "#FFD700";
400|              return (
401|                <button
402|                  key={d}
403|                  onMouseEnter={onHover}
404|                  onClick={() => { onClick(); updateSettings({ difficulty: d }); }}
405|                  style={{
406|                    all: "unset",
407|                    flex: 1,
408|                    textAlign: "center",
409|                    fontFamily: "var(--font-mono-sq)",
410|                    fontSize: "0.65rem",
411|                    letterSpacing: "0.18em",
412|                    padding: "0.5rem 0",
413|                    cursor: "pointer",
414|                    borderRadius: 3,
415|                    transition: "all 140ms",
416|                    border: `1px solid ${active ? col : "rgba(255,255,255,0.1)"}`,
417|                    background: active ? `${col}18` : "transparent",
418|                    color: active ? col : "rgba(255,255,255,0.35)",
419|                  }}
420|                >
421|                  {d.toUpperCase()}
422|                </button>
423|              );
424|            })}
425|          </div>
426|        </div>
427|
428|        <div style={{ display:"flex", justifyContent:"center", marginTop:"0.4rem" }}>
429|          <button className="sq-btn sq-btn-cancel" onMouseEnter={onHover} onClick={onClose}>
430|            CLOSE
431|          </button>
432|        </div>
433|      </div>
434|    </div>
435|  );
436|}
437|
438|// ─────────────────────────────────────────────────────────────────────────────
439|// EXIT CONFIRM
440|// Text updated: "RETURN TO MENU?" instead of "EXIT GAME?"
441|// Confirm action: resetHUD + setActiveGame("menu") (in parent handler)
442|// ─────────────────────────────────────────────────────────────────────────────
443|
444|function ExitConfirm({
445|  onCancel,
446|  onConfirm,
447|}: {
448|  onCancel:  () => void;
449|  onConfirm: () => void;
450|}) {
451|  return (
452|    <div
453|      className="sq-overlay-backdrop"
454|      onPointerDown={e => { if (e.target === e.currentTarget) onCancel(); }}
455|    >
456|      <div className="sq-overlay-panel" style={{ textAlign:"center", maxWidth:380, width: "min(380px, 90vw)" }}>
457|        <div style={{ display:"flex", justifyContent:"center", marginBottom:"1rem" }}>
458|          <SymbolTrio size={18} gap={10} />
459|        </div>
460|        <h2
461|          className="sq-overlay-title"
462|          style={{ fontSize:"clamp(1.8rem,4vw,2.6rem)", marginBottom:"0.5rem" }}
463|        >
464|          RETURN TO MENU?
465|        </h2>
466|        <p
467|          style={{
468|            fontFamily: "var(--font-mono-sq)",
469|            fontSize: "0.72rem",
470|            letterSpacing: "0.15em",
471|            color: "rgba(255,255,255,0.4)",
472|            marginBottom: "1.5rem",
473|            lineHeight: 1.6,
474|          }}
475|        >
476|          Your current progress will be lost.<br />
477|          Return to game selection?
478|        </p>
479|        <div className="sq-confirm-row">
480|          <button className="sq-btn sq-btn-cancel"  onClick={onCancel}>CANCEL</button>
481|          <button className="sq-btn sq-btn-confirm" onClick={onConfirm}>CONFIRM</button>
482|        </div>
483|      </div>
484|    </div>
485|  );
486|}
487|
488|// ─────────────────────────────────────────────────────────────────────────────
489|// GAME MENU
490|// ─────────────────────────────────────────────────────────────────────────────
491|
492|export default function GameMenu({ onLaunch }: GameMenuProps = {}) {
493|  const [menuState,    setMenuState]    = useState<MenuState>("intro");
494|  const [curtainOpen,  setCurtainOpen]  = useState(false);
495|  const [playerCount,  setPlayerCount]  = useState(456);
496|  const [countTick,    setCountTick]    = useState(false);
497|  const [countdownSec, setCountdownSec] = useState(30);
498|
499|  const setActiveGame = useGameStore(s => s.setActiveGame);
500|  const resetHUD      = useGameStore(s => s.resetHUD);
501|  const audio         = useMenuAudio();
502|  const settings       = useGameStore(s => s.settings);
503|  const updateSettings = useGameStore(s => s.updateSettings);
504|
505|  // ── Intro sequence ────────────────────────────────────────────────────────
506|  useEffect(() => {
507|    const t1 = setTimeout(() => setCurtainOpen(true),                       600);
508|    const t2 = setTimeout(() => { setMenuState("main"); audio.startBg(); }, 1800);
509|    return () => { clearTimeout(t1); clearTimeout(t2); };
510|  }, []); // eslint-disable-line react-hooks/exhaustive-deps
511|
512|  // ── Player count ticker ───────────────────────────────────────────────────
513|  useEffect(() => {
514|    const id = setInterval(() => {
515|      setPlayerCount(p => { const n = p - Math.floor(Math.random() * 3); return n < 1 ? 456 : n; });
516|      setCountTick(t => !t);
517|    }, 2200);
518|    return () => clearInterval(id);
519|  }, []);
520|
521|  // ── Countdown ─────────────────────────────────────────────────────────────
522|  useEffect(() => {
523|    const id = setInterval(() => setCountdownSec(s => (s <= 0 ? 30 : s - 1)), 1000);
524|    return () => clearInterval(id);
525|  }, []);
526|
527|  // ── Audio helpers ─────────────────────────────────────────────────────────
528|  const handleHover = useCallback(() => audio.play("hover"), [audio]);
529|  const handleClick = useCallback(() => audio.play("click"), [audio]);
530|
531|  // ── Launch ────────────────────────────────────────────────────────────────
532|  // Guard: only launch when main is the active state. This prevents accidental
533|  // triggers from icon cards that remain visible behind overlay backdrops.
534|  const handleLaunch = useCallback((id: GameId) => {
535|    if (menuState !== "main") return;
536|    audio.play("transition");
537|    audio.stopBg();
538|    setTimeout(() => { onLaunch?.(id); setActiveGame(id); }, 350);
539|  }, [audio, menuState, onLaunch, setActiveGame]);
540|
541|  // ── Settings ──────────────────────────────────────────────────────────────
542|  const handleOpenSettings  = useCallback(() => { audio.play("open");  setMenuState("settings"); }, [audio]);
543|  const handleCloseSettings = useCallback(() => { audio.play("click"); setMenuState("main");     }, [audio]);
544|
545|  // ── Exit ──────────────────────────────────────────────────────────────────
546|  const handleExitRequest = useCallback(() => { audio.play("open"); setMenuState("exit-confirm"); }, [audio]);
547|
548|  const handleExitConfirm = useCallback(() => {
549|    audio.play("exit");
550|    audio.stopBg();
551|    // Reset HUD state, then atomically reset activeGame + runtimePhase via store.
552|    // setActiveGame("menu") sets runtimePhase → "idle" and clears eliminationPayload.
553|    resetHUD();
554|    setActiveGame("menu");
555|    setTimeout(() => setMenuState("main"), 500);
556|  }, [audio, resetHUD, setActiveGame]);
557|
558|  // ── Render ────────────────────────────────────────────────────────────────
559|  return (
560|    <div className="sq-menu-root sq-scanlines">
561|      <BackgroundCanvas />
562|      <div className="sq-grid-bg"       aria-hidden />
563|      <div className="sq-scanline-sweep" aria-hidden />
564|
565|      {/* Ambient glow shapes */}
566|      <div className="sq-ambient-shape pink" aria-hidden style={{ width:"80vmin", height:"80vmin", top:"-15%",  left:"-10%" }} />
567|      <div className="sq-ambient-shape teal" aria-hidden style={{ width:"60vmin", height:"60vmin", bottom:"-10%", right:"-8%", animationDelay:"3s" }} />
568|
569|      {/* Geometric rings */}
570|      <div className="sq-geo-circle spin" aria-hidden style={{ width:"70vmin", height:"70vmin", top:"-15vmin",  right:"-15vmin", borderColor:"rgba(255,0,102,0.08)" }} />
571|      <div className="sq-geo-circle"      aria-hidden style={{ width:"90vmin", height:"90vmin", bottom:"-25vmin", left:"-25vmin", borderColor:"rgba(0,255,178,0.04)", animation:"sq-spin-slow 40s linear reverse infinite" }} />
572|
573|      {/* Decorative symbols */}
574|      <CircleSymbol   size={70} color="#FF0066" glow animate style={{ position:"absolute", top:"12%",    left:"6%",   opacity:0.15 }} />
575|      <TriangleSymbol size={50} color="#00FFB2" glow animate style={{ position:"absolute", top:"20%",    right:"8%",  opacity:0.15 }} />
576|      <SquareSymbol   size={40} color="#FFD700" glow animate style={{ position:"absolute", bottom:"25%", left:"10%",  opacity:0.12 }} />
577|      <CircleSymbol   size={30} color="#00FFB2" glow animate style={{ position:"absolute", bottom:"18%", right:"6%",  opacity:0.12 }} />
578|
579|      {/* Curtain */}
580|      <div className={`sq-curtain${curtainOpen ? " open" : ""}`} aria-hidden />
581|
582|      {/* ── Main content ────────────────────────────────────────────────── */}
583|      <div
584|        className="sq-menu-content"
585|        style={{ opacity: menuState === "intro" ? 0 : 1, transition: "opacity 0.5s ease" }}
586|      >
587|        {/* Title */}
588|        <div className="sq-title-block">
589|          <span className="sq-korean-label sq-font-korean">오징어 게임</span>
590|          <h1 className="sq-main-title sq-font-bebas">SQUID GAME</h1>
591|          <div className="sq-title-divider">
592|            <div className="sq-title-divider-line pink-right" />
593|            <CircleSymbol   size={7} color="#FF0066" glow />
594|            <TriangleSymbol size={7} color="#00FFB2" glow />
595|            <SquareSymbol   size={7} color="#FF0066" glow />
596|            <div className="sq-title-divider-line pink-left" />
597|          </div>
598|        </div>
599|
600|        {/* Game icons — always visible; one tap launches directly */}
601|        <div className="sq-icons-row">
602|          {GAME_MODES.map((mode, i) => (
603|            <GameIconCard
604|              key={mode.id}
605|              mode={mode}
606|              onHover={handleHover}
607|              onClick={handleLaunch}
608|              delay={0.65 + i * 0.12}
609|            />
610|          ))}
611|        </div>
612|
613|        {/* Live status pill — shown in main state */}
614|        {menuState === "main" && (
615|          <div className="sq-status-pill">
616|            <div className="sq-status-item">
617|              <span className="sq-status-label sq-font-mono">PLAYERS</span>
618|              <span
619|                className="sq-status-val sq-font-bebas sq-neon-teal"
620|                style={{ color:"#00FFB2", transform: countTick ? "scale(1.08)" : "scale(1)", transition:"transform 0.4s" }}
621|              >
622|                {playerCount}
623|              </span>
624|            </div>
625|            <div className="sq-status-divider" aria-hidden />
626|            <div className="sq-status-item">
627|              <span className="sq-status-label sq-font-mono">PRIZE</span>
628|              <span className="sq-status-val sq-font-bebas sq-neon-gold" style={{ color:"#FFD700" }}>₩45.6B</span>
629|            </div>
630|            <div className="sq-status-divider" aria-hidden />
631|            <div className="sq-status-item">
632|              <span className="sq-status-label sq-font-mono">GAMES</span>
633|              <span
634|                className="sq-status-val sq-font-bebas sq-neon-pink"
635|                style={{ color:"#FF0066", fontSize:"1.4rem" }}
636|              >
637|                3
638|              </span>
639|            </div>
640|          </div>
641|        )}
642|
643|        {/* Footer symbols */}
644|        <div style={{ opacity:0.22, animation:"sq-fade-in 0.8s ease 1.6s both" }}>
645|          <SymbolTrio size={10} gap={8} glow={false} />
646|        </div>
647|      </div>
648|
649|      {/* ── Bottom-right controls (visible in main state only) ─────────── */}
650|      {menuState === "main" && (
651|        <ControlsHUD
652|          onSettings={handleOpenSettings}
653|          onExit={handleExitRequest}
654|          onHover={handleHover}
655|        />
656|      )}
657|
658|      {/* ── NEW: Custom Play/Pause Music Toggle ─────────── */}
659|      {menuState === "main" && (
660|        <button
661|          aria-label="Toggle Music"
662|          onClick={(e) => {
663|            e.stopPropagation(); // Prevents clicks from triggering anything behind it
664|            handleClick(); // Plays your UI click sound
665|            // Toggle the global music volume between 1 (100%) and 0 (Muted)
666|            updateSettings({ musicVolume: settings.musicVolume > 0 ? 0 : 1 });
667|          }}
668|          onMouseEnter={(e) => {
669|            handleHover();
670|            e.currentTarget.style.borderColor = "#00FFB280";
671|            e.currentTarget.style.background = "#00FFB218";
672|            e.currentTarget.style.color = "#00FFB2";
673|          }}
674|          onMouseLeave={(e) => {
675|            e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
676|            e.currentTarget.style.background = "rgba(8,8,14,0.78)";
677|            e.currentTarget.style.color = "rgba(255,255,255,0.55)";
678|          }}
679|          style={{
680|            position: "absolute",
681|            left: "max(20px, calc(env(safe-area-inset-left, 0px) + 16px))",
682|            bottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px))",
683|            width: 44, height: 44, minWidth: 44, minHeight: 44,
684|            display: "flex", alignItems: "center", justifyContent: "center",
685|            background: "rgba(8,8,14,0.78)",
686|            border: "1px solid rgba(255,255,255,0.14)",
687|            borderRadius: 4,
688|            cursor: "pointer",
689|            color: "rgba(255,255,255,0.55)",
690|            backdropFilter: "blur(12px)",
691|            WebkitBackdropFilter: "blur(12px)",
692|            transition: "border-color 140ms, background 140ms, color 140ms",
693|            zIndex: 50,
694|          }}
695|        >
696|          {settings.musicVolume > 0 ? (
697|            /* Playing Icon (Speaker with waves) */
698|            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
699|              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
700|              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
701|            </svg>
702|          ) : (
703|            /* Muted Icon (Speaker with an X) */
704|            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
705|              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
706|              <line x1="23" y1="9" x2="17" y2="15" />
707|              <line x1="17" y1="9" x2="23" y2="15" />
708|            </svg>
709|          )}
710|        </button>
711|      )}
712|      {menuState === "settings" && (
713|        <SettingsPanel
714|          onClose={handleCloseSettings}
715|          onHover={handleHover}
716|          onClick={handleClick}
717|        />
718|      )}
719|
720|      {menuState === "exit-confirm" && (
721|        <ExitConfirm
722|          onCancel={() => { handleClick(); setMenuState("main"); }}
723|          onConfirm={handleExitConfirm}
724|        />
725|      )}
726|
727|      {/* Portrait warning */}
728|      <div className="portrait-warning" role="alert">
729|        <div className="portrait-warning-icon">📱</div>
730|        <p style={{ fontFamily:"var(--font-mono-sq)", letterSpacing:"0.1em" }}>ROTATE YOUR DEVICE</p>
731|      </div>
732|    </div>
733|  );
734|}
735|

===END