"use client";
import { useState } from "react";

const palette = {
  // Core identity
  voidBlack: "#060608",
  charcoal: "#111116",
  deepSurface: "#0d0d14",
  surface: "#14141e",
  surfaceHigh: "#1c1c28",
  // Neon accents
  neonPink: "#ed1b76",
  neonPinkDim: "rgba(237,27,118,0.18)",
  neonGreen: "#00e87a",
  neonGreenDim: "rgba(0,232,122,0.15)",
  bloodRed: "#ff2d2d",
  bloodRedDim: "rgba(255,45,45,0.18)",
  amber: "#ffd60a",
  amberDim: "rgba(255,214,10,0.15)",
  // Neutral
  coldWhite: "#f5f5f5",
  mutedText: "rgba(245,245,245,0.45)",
  border: "rgba(255,255,255,0.08)",
  borderMid: "rgba(255,255,255,0.15)",
};

const geo = { circle: "●", triangle: "▲", square: "■" };

const tabs = [
  "Overview", "Colors", "Typography", "Components", "Screens", "Motion"
];

const fontStack = {
  display: "var(--font-display), 'Rajdhani', 'Barlow Condensed', 'Impact', sans-serif",
  mono: "var(--font-mono), 'JetBrains Mono', 'Fira Mono', monospace",
  body: "'DM Sans', 'IBM Plex Sans', sans-serif",
};

export default function DesignSystemPage() {
  const [active, setActive] = useState("Overview");
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [demoLight, setDemoLight] = useState("green");

  const S: Record<string, React.CSSProperties | ((...args: any[]) => React.CSSProperties)> = {
    root: {
      background: palette.voidBlack,
      color: palette.coldWhite,
      fontFamily: fontStack.body,
      minHeight: "100vh",
      lineHeight: 1.6,
      overflow: "auto",
    },
    topBar: {
      background: palette.charcoal,
      borderBottom: `1px solid ${palette.border}`,
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      gap: 0,
      position: "sticky" as const,
      top: 0,
      zIndex: 100,
      backdropFilter: "blur(12px)",
    },
    logo: {
      fontFamily: fontStack.display,
      fontWeight: 700,
      fontSize: 15,
      letterSpacing: "0.3em",
      color: palette.neonPink,
      textTransform: "uppercase" as const,
      padding: "16px 24px 16px 0",
      borderRight: `1px solid ${palette.border}`,
      marginRight: 24,
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    page: { padding: "40px 32px", maxWidth: 900, margin: "0 auto" },
    h1: {
      fontFamily: fontStack.display,
      fontSize: "clamp(2rem, 5vw, 3.5rem)",
      fontWeight: 800,
      letterSpacing: "0.05em",
      lineHeight: 0.95,
      textTransform: "uppercase" as const,
      margin: "0 0 8px",
    },
    h2: {
      fontFamily: fontStack.display,
      fontSize: "clamp(1.1rem, 2.5vw, 1.6rem)",
      fontWeight: 700,
      letterSpacing: "0.15em",
      textTransform: "uppercase" as const,
      color: palette.neonPink,
      margin: "40px 0 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    h3: {
      fontFamily: fontStack.mono,
      fontSize: 12,
      fontWeight: 400,
      letterSpacing: "0.25em",
      color: palette.mutedText,
      textTransform: "uppercase" as const,
      margin: "0 0 12px",
    },
    card: {
      background: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: 4,
      padding: "20px 24px",
      marginBottom: 16,
    },
    grid2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
    },
    grid3: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 12,
    },
    label: {
      fontFamily: fontStack.mono,
      fontSize: 11,
      letterSpacing: "0.2em",
      color: palette.mutedText,
      textTransform: "uppercase" as const,
      display: "block",
      marginBottom: 6,
    },
    divider: {
      borderColor: palette.border,
      margin: "24px 0",
    },
  };

  const tab = (t: string): React.CSSProperties => ({
    padding: "16px 18px",
    cursor: "pointer",
    fontFamily: fontStack.mono,
    fontSize: 12,
    letterSpacing: "0.12em",
    color: active === t ? palette.neonPink : palette.mutedText,
    background: "none",
    border: "none",
    borderBottom: active === t ? `2px solid ${palette.neonPink}` : "2px solid transparent",
    textTransform: "uppercase",
    transition: "color 0.2s",
  });

  const chip = (color: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: 2,
    fontFamily: fontStack.mono,
    fontSize: 11,
    letterSpacing: "0.15em",
    color: color,
    border: `1px solid ${color}`,
    textTransform: "uppercase",
  });

  return (
    <div style={S.root as React.CSSProperties}>
      {/* Top navigation */}
      <div style={S.topBar as React.CSSProperties}>
        <div style={S.logo as React.CSSProperties}>
          <span style={{ color: palette.neonPink }}>▲</span>
          Extreme RXN
        </div>
        {tabs.map(t => (
          <button key={t} style={tab(t)} onClick={() => setActive(t)}>
            {t}
          </button>
        ))}
      </div>

      <div style={S.page as React.CSSProperties}>

        {/* ═══ OVERVIEW ═══ */}
        {active === "Overview" && (
          <div>
            <p style={{ ...(S.label as React.CSSProperties), marginBottom: 12 }}>UI Design System — Squid Game Theme</p>
            <h1 style={S.h1 as React.CSSProperties}>
              <span style={{ color: palette.neonPink }}>Extreme</span>{" "}
              <span style={{ color: palette.coldWhite }}>RXN</span>
            </h1>
            <p style={{ color: palette.neonGreen, fontFamily: fontStack.mono, fontSize: 13, letterSpacing: "0.2em", marginBottom: 32, marginTop: 8 }}>
              SURVIVE. OR DON&apos;T. — Visual Identity Playbook
            </p>

            <div style={{ background: palette.deepSurface, border: `1px solid ${palette.border}`, borderLeft: `4px solid ${palette.neonPink}`, padding: "20px 24px", borderRadius: 4, marginBottom: 32 }}>
              <p style={{ fontFamily: fontStack.mono, fontSize: 13, color: palette.coldWhite, margin: 0, lineHeight: 1.8 }}>
                This system defines the visual language for Extreme RXN: a cinematic, industrial survival UI built entirely on Squid Game aesthetics — geometric surveillance, brutal contrast, neon tension, and mechanical precision.
              </p>
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.triangle}</span> Design Pillars</h2>
            <div style={S.grid3 as React.CSSProperties}>
              {[
                { sym: geo.circle, title: "Tension", desc: "Every element creates psychological pressure. High contrast, minimal clutter, maximum dread.", color: palette.bloodRed },
                { sym: geo.triangle, title: "Geometry", desc: "Circle, triangle, square govern all shapes. No organic curves. Hard corners. Industrial grids.", color: palette.neonPink },
                { sym: geo.square, title: "Surveillance", desc: "Institutional coldness. CCTV framing. Numbered identities. Corporate brutalism.", color: palette.neonGreen },
              ].map(p => (
                <div key={p.title} style={{ ...(S.card as React.CSSProperties), borderTop: `3px solid ${p.color}` }}>
                  <div style={{ fontSize: 28, color: p.color, marginBottom: 10, fontFamily: fontStack.display }}>{p.sym}</div>
                  <div style={{ fontFamily: fontStack.display, fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.coldWhite, marginBottom: 6 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: palette.mutedText, lineHeight: 1.6 }}>{p.desc}</div>
                </div>
              ))}
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.circle}</span> Theme Essence</h2>
            <div style={S.grid2 as React.CSSProperties}>
              <div style={S.card as React.CSSProperties}>
                <div style={{ ...(S.h3 as React.CSSProperties), marginBottom: 16 }}>Visual Archetype</div>
                {["Dark, institutional spaces", "Neon-lit under surveillance cameras", "Numbered player identities", "Guard uniforms: geometric masks", "Game sets: clinical, theatrical, lethal"].map(i => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontFamily: fontStack.mono, fontSize: 12, color: palette.mutedText }}>
                    <span style={{ color: palette.neonPink, flexShrink: 0 }}>▶</span>{i}
                  </div>
                ))}
              </div>
              <div style={S.card as React.CSSProperties}>
                <div style={{ ...(S.h3 as React.CSSProperties), marginBottom: 16 }}>Emotional Register</div>
                {["Dread ↔ Hope oscillation", "Collective vs. individual survival", "Ritual and ceremony in violence", "Beauty in brutality", "Clean aesthetics masking danger"].map(i => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontFamily: fontStack.mono, fontSize: 12, color: palette.mutedText }}>
                    <span style={{ color: palette.amber, flexShrink: 0 }}>▶</span>{i}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ COLORS ═══ */}
        {active === "Colors" && (
          <div>
            <p style={S.label as React.CSSProperties}>Foundation</p>
            <h1 style={{ ...(S.h1 as React.CSSProperties), fontSize: "2rem" }}>Color Palette</h1>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.square}</span> Primary Brand Colors</h2>
            <div style={S.grid2 as React.CSSProperties}>
              {[
                { name: "Neon Pink", hex: "#ED1B76", role: "Primary CTA, danger, highlight, guard uniform", color: palette.neonPink },
                { name: "Neon Green", hex: "#00E87A", role: "Safe, go, victory, progress indicators", color: palette.neonGreen },
                { name: "Blood Red", hex: "#FF2D2D", role: "Elimination, health, critical alerts", color: palette.bloodRed },
                { name: "Amber", hex: "#FFD60A", role: "Warning, timer, countdown, coin rewards", color: palette.amber },
              ].map(c => (
                <div key={c.name} style={{ ...(S.card as React.CSSProperties), display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ width: 56, height: 56, background: c.color, borderRadius: 4, flexShrink: 0, border: `1px solid rgba(255,255,255,0.1)` }} />
                  <div>
                    <div style={{ fontFamily: fontStack.display, fontSize: 16, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.name}</div>
                    <div style={{ fontFamily: fontStack.mono, fontSize: 13, color: palette.coldWhite, marginBottom: 4 }}>{c.hex}</div>
                    <div style={{ fontSize: 12, color: palette.mutedText }}>{c.role}</div>
                  </div>
                </div>
              ))}
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.triangle}</span> Background &amp; Surface Scale</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { name: "Void", hex: "#060608", bg: "#060608" },
                { name: "Charcoal", hex: "#111116", bg: "#111116" },
                { name: "Deep Surface", hex: "#0D0D14", bg: "#0D0D14" },
                { name: "Surface", hex: "#14141E", bg: "#14141E" },
                { name: "Surface High", hex: "#1C1C28", bg: "#1C1C28" },
                { name: "Border", hex: "rgba(255,255,255,0.08)", bg: "rgba(255,255,255,0.08)" },
              ].map(s => (
                <div key={s.name} style={{ flex: "1 1 130px", minWidth: 130 }}>
                  <div style={{ height: 52, background: s.bg, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", marginBottom: 6 }} />
                  <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: palette.coldWhite, letterSpacing: "0.08em" }}>{s.name}</div>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: palette.mutedText }}>{s.hex}</div>
                </div>
              ))}
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.circle}</span> Semantic Usage Rules</h2>
            <div style={S.card as React.CSSProperties}>
              {[
                { token: "Elimination / Loss / Health Critical", color: palette.bloodRed, hex: "#FF2D2D" },
                { token: "Primary Action / Danger / Guard", color: palette.neonPink, hex: "#ED1B76" },
                { token: "Safe / Victory / Progress / Go", color: palette.neonGreen, hex: "#00E87A" },
                { token: "Warning / Timer / Countdown / Coins", color: palette.amber, hex: "#FFD60A" },
                { token: "Cold White — Primary Text", color: palette.coldWhite, hex: "#F5F5F5" },
                { token: "Muted — Secondary Text / Hints", color: palette.mutedText, hex: "rgba(245,245,245,0.45)" },
              ].map(r => (
                <div key={r.token} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", borderBottom: `1px solid ${palette.border}` }}>
                  <div style={{ width: 20, height: 20, background: r.color, borderRadius: 3, flexShrink: 0 }} />
                  <div style={{ fontFamily: fontStack.mono, fontSize: 12, color: r.hex, minWidth: 90 }}>{r.hex}</div>
                  <div style={{ fontSize: 13, color: palette.mutedText }}>{r.token}</div>
                </div>
              ))}
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.square}</span> Glow / Dim Variants</h2>
            <p style={{ fontSize: 13, color: palette.mutedText, marginBottom: 16 }}>Use at 15–20% opacity for background fills, panel glows, and hover states. Never use full-saturation colors on large background areas.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "Pink Glow", bg: palette.neonPinkDim, border: palette.neonPink },
                { label: "Green Glow", bg: palette.neonGreenDim, border: palette.neonGreen },
                { label: "Red Glow", bg: palette.bloodRedDim, border: palette.bloodRed },
                { label: "Amber Glow", bg: palette.amberDim, border: palette.amber },
              ].map(g => (
                <div key={g.label} style={{ flex: "1 1 160px", height: 64, background: g.bg, border: `1px solid ${g.border}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 11, color: g.border, letterSpacing: "0.15em" }}>{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TYPOGRAPHY ═══ */}
        {active === "Typography" && (
          <div>
            <p style={S.label as React.CSSProperties}>Type System</p>
            <h1 style={{ ...(S.h1 as React.CSSProperties), fontSize: "2rem" }}>Typography</h1>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.triangle}</span> Font Families</h2>
            <div style={S.grid3 as React.CSSProperties}>
              {[
                { name: "Display / Rajdhani", stack: "Rajdhani, Barlow Condensed", use: "Headers, game titles, countdown timers, score values", sample: "SURVIVE", family: fontStack.display, weight: 800, size: 32 },
                { name: "Mono / JetBrains", stack: "JetBrains Mono, Fira Mono", use: "HUD values, player IDs, system logs, coordinates, time", sample: "#0456", family: fontStack.mono, weight: 400, size: 24 },
                { name: "Body / DM Sans", stack: "DM Sans, IBM Plex Sans", use: "Descriptions, menus, settings, secondary UI text", sample: "Choose carefully.", family: fontStack.body, weight: 400, size: 18 },
              ].map(f => (
                <div key={f.name} style={S.card as React.CSSProperties}>
                  <div style={{ ...(S.h3 as React.CSSProperties), marginBottom: 16 }}>{f.name}</div>
                  <div style={{ fontFamily: f.family, fontWeight: f.weight, fontSize: f.size, color: palette.coldWhite, marginBottom: 12, lineHeight: 1 }}>{f.sample}</div>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: palette.mutedText, marginBottom: 8 }}>{f.stack}</div>
                  <hr style={S.divider as React.CSSProperties} />
                  <div style={{ fontSize: 12, color: palette.mutedText, lineHeight: 1.6 }}>{f.use}</div>
                </div>
              ))}
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.circle}</span> Scale &amp; Hierarchy</h2>
            <div style={S.card as React.CSSProperties}>
              {[
                { role: "Game Title", family: fontStack.display, size: "4–9rem", weight: 900, note: "Letter-spacing: -0.02em, uppercase, hero use only" },
                { role: "Section Header", family: fontStack.display, size: "1.8–2.5rem", weight: 700, note: "Letter-spacing: 0.15em, uppercase, red/pink accent" },
                { role: "HUD Score / Timer", family: fontStack.mono, size: "1.5–2.2rem", weight: 700, note: "Tabular nums, monospaced, critical info" },
                { role: "Player ID Badge", family: fontStack.mono, size: "0.7–0.9rem", weight: 400, note: "Letter-spacing: 0.2em, always zero-padded (###)" },
                { role: "Card Title", family: fontStack.display, size: "1.1–1.4rem", weight: 700, note: "Uppercase, tight tracking" },
                { role: "Body / Description", family: fontStack.body, size: "0.875–1rem", weight: 400, note: "Line-height: 1.6, max-width: 65ch" },
                { role: "Label / Tag", family: fontStack.mono, size: "0.65–0.75rem", weight: 400, note: "Letter-spacing: 0.25em, all caps, muted color" },
                { role: "Micro / Legal", family: fontStack.mono, size: "0.6rem", weight: 400, note: "Sparse use only. Muted. Never smaller." },
              ].map(r => (
                <div key={r.role} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: `1px solid ${palette.border}`, alignItems: "flex-start" }}>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: palette.neonPink, minWidth: 160, letterSpacing: "0.1em" }}>{r.role}</div>
                  <div style={{ minWidth: 70, fontFamily: fontStack.mono, fontSize: 11, color: palette.amber }}>{r.size}</div>
                  <div style={{ fontSize: 12, color: palette.mutedText, flex: 1 }}>{r.note}</div>
                </div>
              ))}
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.square}</span> Live Type Samples</h2>
            <div style={S.card as React.CSSProperties}>
              <div style={{ fontFamily: fontStack.display, fontWeight: 900, fontSize: "3rem", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 0.9, marginBottom: 16 }}>
                <span style={{ color: palette.neonPink }}>GAME</span>
                <span style={{ color: palette.coldWhite }}> 3</span>
              </div>
              <div style={{ fontFamily: fontStack.display, fontSize: "1.4rem", fontWeight: 700, color: palette.amber, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>
                ▲ TUG OF WAR
              </div>
              <div style={{ fontFamily: fontStack.mono, fontSize: "1.6rem", color: palette.neonGreen, letterSpacing: "0.05em", marginBottom: 8 }}>
                04:32
              </div>
              <div style={{ fontFamily: fontStack.mono, fontSize: "0.75rem", color: palette.mutedText, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 16 }}>
                PLAYER 456 — TEAM ALPHA
              </div>
              <div style={{ fontFamily: fontStack.body, fontSize: "0.9rem", color: palette.mutedText, lineHeight: 1.7, maxWidth: "55ch" }}>
                Choose your side. The weakest team falls into the void. There are no second chances in this game.
              </div>
            </div>
          </div>
        )}

        {/* ═══ COMPONENTS ═══ */}
        {active === "Components" && (
          <div>
            <p style={S.label as React.CSSProperties}>Reusable System</p>
            <h1 style={{ ...(S.h1 as React.CSSProperties), fontSize: "2rem" }}>Components</h1>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.triangle}</span> Buttons</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              {/* Primary */}
              <div>
                <div style={S.h3 as React.CSSProperties}>Primary CTA</div>
                <button
                  onMouseEnter={() => setHoveredBtn("p")}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    background: hoveredBtn === "p" ? palette.neonPink : "transparent",
                    border: `2px solid ${palette.neonPink}`,
                    color: hoveredBtn === "p" ? "#000" : palette.neonPink,
                    fontFamily: fontStack.display,
                    fontSize: "1rem",
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    padding: "12px 28px",
                    borderRadius: 0,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {geo.circle} ENTER GAME
                </button>
              </div>
              {/* Danger */}
              <div>
                <div style={S.h3 as React.CSSProperties}>Danger</div>
                <button
                  onMouseEnter={() => setHoveredBtn("d")}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    background: hoveredBtn === "d" ? palette.bloodRed : palette.bloodRedDim,
                    border: `2px solid ${palette.bloodRed}`,
                    color: palette.coldWhite,
                    fontFamily: fontStack.display,
                    fontSize: "1rem",
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    padding: "12px 28px",
                    borderRadius: 0,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {geo.square} ELIMINATE
                </button>
              </div>
              {/* Ghost */}
              <div>
                <div style={S.h3 as React.CSSProperties}>Ghost / Secondary</div>
                <button
                  onMouseEnter={() => setHoveredBtn("g")}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    background: hoveredBtn === "g" ? palette.surfaceHigh : "transparent",
                    border: `1px solid ${palette.borderMid}`,
                    color: palette.coldWhite,
                    fontFamily: fontStack.mono,
                    fontSize: "0.75rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    padding: "12px 24px",
                    borderRadius: 0,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  ← BACK TO MENU
                </button>
              </div>
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.circle}</span> Player Badge</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              {[{ num: "456", alive: true }, { num: "218", alive: true }, { num: "067", alive: false }].map(p => (
                <div key={p.num} style={{
                  background: p.alive ? palette.neonGreenDim : palette.bloodRedDim,
                  border: `1px solid ${p.alive ? palette.neonGreen : palette.bloodRed}`,
                  borderRadius: 2,
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: p.alive ? palette.neonGreen : palette.bloodRed,
                  }} />
                  <span style={{ fontFamily: fontStack.mono, fontSize: 16, fontWeight: 700, color: palette.coldWhite, letterSpacing: "0.1em" }}>#{p.num}</span>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 10, color: p.alive ? palette.neonGreen : palette.bloodRed, letterSpacing: "0.2em" }}>{p.alive ? "ALIVE" : "ELIMINATED"}</span>
                </div>
              ))}
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.square}</span> HUD Components</h2>
            <div style={S.grid2 as React.CSSProperties}>
              {/* Health bar */}
              <div style={S.card as React.CSSProperties}>
                <div style={S.h3 as React.CSSProperties}>Health Bar</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 11, color: palette.mutedText, letterSpacing: "0.15em" }}>HP</span>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 11, color: palette.bloodRed }}>72 / 100</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", height: 6, borderRadius: 0 }}>
                  <div style={{ width: "72%", height: "100%", background: `linear-gradient(90deg, ${palette.bloodRed}, ${palette.neonPink})`, transition: "width 0.3s" }} />
                </div>
              </div>
              {/* Timer */}
              <div style={S.card as React.CSSProperties}>
                <div style={S.h3 as React.CSSProperties}>Countdown Timer</div>
                <div style={{ fontFamily: fontStack.mono, fontSize: "2.2rem", fontWeight: 700, color: palette.amber, letterSpacing: "0.05em", lineHeight: 1 }}>
                  04:32
                </div>
                <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: palette.mutedText, letterSpacing: "0.2em", marginTop: 4 }}>TIME REMAINING</div>
              </div>
              {/* Progress bar */}
              <div style={S.card as React.CSSProperties}>
                <div style={S.h3 as React.CSSProperties}>Progress to Finish</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 11, color: palette.mutedText }}>START</span>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 11, color: palette.neonGreen }}>FINISH</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", height: 8, borderRadius: 0, position: "relative" }}>
                  <div style={{ width: "63%", height: "100%", background: palette.neonGreen }} />
                  <div style={{ position: "absolute", top: -4, left: "63%", transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", background: palette.amber, border: `2px solid ${palette.voidBlack}` }} />
                </div>
              </div>
              {/* Score */}
              <div style={S.card as React.CSSProperties}>
                <div style={S.h3 as React.CSSProperties}>Score Panel</div>
                <div style={{ fontFamily: fontStack.display, fontSize: "2rem", fontWeight: 800, color: palette.coldWhite, letterSpacing: "0.04em", lineHeight: 1 }}>0,024,800</div>
                <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: palette.mutedText, letterSpacing: "0.15em", marginTop: 4 }}>
                  BEST <span style={{ color: palette.amber }}>0,031,200</span>
                </div>
              </div>
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.triangle}</span> Light State Toggle (Demo)</h2>
            <div style={S.card as React.CSSProperties}>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {(["green", "warning", "red"] as const).map(l => (
                  <button key={l} onClick={() => setDemoLight(l)} style={{
                    padding: "8px 20px",
                    background: demoLight === l ? { green: palette.neonGreen, warning: palette.amber, red: palette.bloodRed }[l] : "transparent",
                    border: `1px solid ${{ green: palette.neonGreen, warning: palette.amber, red: palette.bloodRed }[l]}`,
                    color: demoLight === l ? "#000" : { green: palette.neonGreen, warning: palette.amber, red: palette.bloodRed }[l],
                    fontFamily: fontStack.mono,
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    borderRadius: 0,
                    transition: "all 0.2s",
                  }}>
                    {l === "green" ? "● Green" : l === "warning" ? "◉ Warning" : "● Red"}
                  </button>
                ))}
              </div>
              <div style={{
                background: {
                  green: palette.neonGreenDim,
                  warning: palette.amberDim,
                  red: palette.bloodRedDim,
                }[demoLight],
                border: `1px solid ${{ green: palette.neonGreen, warning: palette.amber, red: palette.bloodRed }[demoLight]}`,
                borderRadius: 4,
                padding: "20px 24px",
                transition: "all 0.3s",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontFamily: fontStack.display, fontWeight: 700, fontSize: "1.2rem", letterSpacing: "0.2em", color: { green: palette.neonGreen, warning: palette.amber, red: palette.bloodRed }[demoLight], textTransform: "uppercase" }}>
                    {demoLight === "green" ? "● GREEN LIGHT" : demoLight === "warning" ? "◉ WARNING" : "● RED LIGHT"}
                  </div>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 12, color: palette.mutedText, marginTop: 4 }}>
                    {demoLight === "green" ? "Movement permitted" : demoLight === "warning" ? "Decelerate now" : "ALL MOVEMENT FORBIDDEN"}
                  </div>
                </div>
                <div style={{ fontFamily: fontStack.mono, fontSize: "1.8rem", fontWeight: 700, color: { green: palette.neonGreen, warning: palette.amber, red: palette.bloodRed }[demoLight] }}>
                  04:32
                </div>
              </div>
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.circle}</span> Geometric Symbol System</h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { sym: "●", name: "Circle", use: "Player markers, safe indicators, staff workers", color: palette.neonPink },
                { sym: "▲", name: "Triangle", use: "Soldiers / guards, navigation, direction", color: palette.neonPink },
                { sym: "■", name: "Square", use: "Managers / leads, achievements, containers", color: palette.neonPink },
              ].map(s => (
                <div key={s.name} style={{ ...(S.card as React.CSSProperties), flex: "1 1 220px", textAlign: "center" }}>
                  <div style={{ fontSize: 48, color: s.color, marginBottom: 8, lineHeight: 1 }}>{s.sym}</div>
                  <div style={{ fontFamily: fontStack.display, fontWeight: 700, fontSize: 16, letterSpacing: "0.15em", textTransform: "uppercase", color: palette.coldWhite, marginBottom: 6 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: palette.mutedText }}>{s.use}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SCREENS ═══ */}
        {active === "Screens" && (
          <div>
            <p style={S.label as React.CSSProperties}>Screen-by-Screen</p>
            <h1 style={{ ...(S.h1 as React.CSSProperties), fontSize: "2rem" }}>UI Blueprints</h1>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.square}</span> Main Menu</h2>
            <div style={{ ...(S.card as React.CSSProperties), minHeight: 280, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(255,255,255,0.02) 60px), repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(255,255,255,0.02) 60px)" }} />
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 8, padding: 20 }}>
                <div style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: "0.4em", color: palette.mutedText, textTransform: "uppercase" }}>BROADCAST · EPISODE SELECT</div>
                <div style={{ fontFamily: fontStack.display, fontWeight: 900, fontSize: "3.5rem", lineHeight: 0.85, letterSpacing: "-0.01em", textTransform: "uppercase", marginBottom: 20 }}>
                  <div style={{ color: palette.coldWhite }}>EXTREME</div>
                  <div style={{ color: palette.neonPink }}>RXN</div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {[{ e: "01", t: "Red Light", col: palette.bloodRed }, { e: "03", t: "Dalgona", col: palette.amber }, { e: "05", t: "Glass Bridge", col: palette.neonGreen }].map(g => (
                    <div key={g.t} style={{ background: palette.surface, border: `1px solid ${g.col}`, borderTop: `3px solid ${g.col}`, borderRadius: 4, padding: "14px 16px", flex: 1, cursor: "pointer" }}>
                      <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: g.col, letterSpacing: "0.3em", marginBottom: 6 }}>EP.{g.e}</div>
                      <div style={{ fontFamily: fontStack.display, fontWeight: 700, fontSize: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>{g.t}</div>
                      <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: palette.mutedText, marginTop: 8, letterSpacing: "0.15em" }}>ENTER →</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: palette.mutedText, marginTop: 10, lineHeight: 1.7 }}>
              Key layout rules: full-bleed dark background with faint grid overlay. Title uses max-size display font, split across two lines for drama. Game cards use accent-top-border treatment. No rounded corners except subtle 4px.
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.triangle}</span> In-Game HUD</h2>
            <div style={{ ...(S.card as React.CSSProperties), minHeight: 200, position: "relative", padding: 0, overflow: "hidden" }}>
              <div style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: `1px solid ${palette.border}` }}>
                <div>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: palette.mutedText, letterSpacing: "0.2em" }}>HP</div>
                  <div style={{ background: "rgba(255,255,255,0.06)", width: 160, height: 5, marginTop: 4 }}>
                    <div style={{ width: "68%", height: "100%", background: palette.bloodRed }} />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {[1, 2, 3].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i <= 2 ? palette.neonPink : "rgba(255,255,255,0.1)" }} />)}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: fontStack.mono, fontSize: "1.8rem", fontWeight: 700, color: palette.amber, letterSpacing: "0.05em", lineHeight: 1 }}>03:47</div>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 9, color: palette.mutedText, letterSpacing: "0.2em" }}>● GREEN LIGHT</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: fontStack.display, fontSize: "1.4rem", fontWeight: 700, color: palette.coldWhite }}>0,024,800</div>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 9, color: palette.mutedText, letterSpacing: "0.15em" }}>ALIVE 12 / 16</div>
                </div>
              </div>
              <div style={{ padding: 20, fontFamily: fontStack.mono, fontSize: 12, color: palette.mutedText, textAlign: "center" }}>
                [ game canvas ]
              </div>
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.circle}</span> Loading Screen</h2>
            <div style={{ ...(S.card as React.CSSProperties), textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 56, color: palette.neonPink, marginBottom: 16, fontFamily: fontStack.display, fontWeight: 900, lineHeight: 1 }}>
                {geo.triangle}
              </div>
              <div style={{ fontFamily: fontStack.mono, fontSize: 13, letterSpacing: "0.4em", color: palette.mutedText, textTransform: "uppercase", marginBottom: 24 }}>
                LOADING SYSTEM...
              </div>
              <div style={{ background: "rgba(255,255,255,0.06)", height: 4, borderRadius: 0, maxWidth: 300, margin: "0 auto" }}>
                <div style={{ width: "62%", height: "100%", background: palette.neonPink, transition: "width 1s linear" }} />
              </div>
              <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: palette.mutedText, marginTop: 10, letterSpacing: "0.2em" }}>62%</div>
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.square}</span> Elimination Screen</h2>
            <div style={{ ...(S.card as React.CSSProperties), textAlign: "center", padding: "36px 24px", background: palette.bloodRedDim, border: `1px solid ${palette.bloodRed}` }}>
              <div style={{ fontFamily: fontStack.display, fontWeight: 900, fontSize: "3rem", letterSpacing: "0.2em", color: palette.bloodRed, textTransform: "uppercase", lineHeight: 1, marginBottom: 12 }}>ELIMINATED</div>
              <div style={{ fontFamily: fontStack.mono, fontSize: 13, color: "rgba(255,45,45,0.7)", letterSpacing: "0.15em", marginBottom: 24 }}>PLAYER 218 · PANEL 11 OF 18</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button style={{ background: "transparent", border: `2px solid ${palette.coldWhite}`, color: palette.coldWhite, fontFamily: fontStack.mono, fontSize: 12, letterSpacing: "0.2em", padding: "10px 24px", cursor: "pointer" }}>TRY AGAIN</button>
                <button style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.3)`, color: palette.mutedText, fontFamily: fontStack.mono, fontSize: 12, letterSpacing: "0.2em", padding: "10px 24px", cursor: "pointer" }}>← MENU</button>
              </div>
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.triangle}</span> Victory Screen</h2>
            <div style={{ ...(S.card as React.CSSProperties), textAlign: "center", padding: "36px 24px", background: palette.neonGreenDim, border: `1px solid ${palette.neonGreen}` }}>
              <div style={{ fontFamily: fontStack.display, fontWeight: 900, fontSize: "3rem", letterSpacing: "0.2em", color: palette.neonGreen, textTransform: "uppercase", lineHeight: 1, marginBottom: 12 }}>SURVIVED</div>
              <div style={{ fontFamily: fontStack.display, fontWeight: 700, fontSize: "2rem", color: palette.amber, letterSpacing: "0.04em", marginBottom: 6 }}>0,031,200</div>
              <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: palette.mutedText, letterSpacing: "0.2em", marginBottom: 24 }}>NEW HIGH SCORE · TIME: 3:47</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button style={{ background: palette.neonGreen, border: `2px solid ${palette.neonGreen}`, color: "#000", fontFamily: fontStack.display, fontWeight: 700, fontSize: 14, letterSpacing: "0.2em", padding: "12px 28px", cursor: "pointer", textTransform: "uppercase" }}>PLAY AGAIN</button>
                <button style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.3)`, color: palette.mutedText, fontFamily: fontStack.mono, fontSize: 12, letterSpacing: "0.2em", padding: "12px 24px", cursor: "pointer" }}>← MENU</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MOTION ═══ */}
        {active === "Motion" && (
          <div>
            <p style={S.label as React.CSSProperties}>Animation Language</p>
            <h1 style={{ ...(S.h1 as React.CSSProperties), fontSize: "2rem" }}>Motion Design</h1>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.circle}</span> Core Principles</h2>
            <div style={S.grid2 as React.CSSProperties}>
              {[
                { title: "Mechanical", desc: "No spring physics. No bounce. Motion is sharp, purposeful, industrial. Use ease-in-out or cubic-bezier(0.4, 0, 0.2, 1) for most transitions.", color: palette.neonPink },
                { title: "Telegraphed Dread", desc: "Slow reveals build tension. Fast cuts signal elimination. The rhythm mirrors the show: long silence → sudden violence.", color: palette.bloodRed },
                { title: "State-Driven", desc: "Every animation is semantically meaningful. Color changes signal state changes (green → amber → red) with short 200ms transitions.", color: palette.neonGreen },
                { title: "Minimal Decoration", desc: "No idle animations except subtle breathing effects on critical UI. Every moving element has a game-logic purpose.", color: palette.amber },
              ].map(p => (
                <div key={p.title} style={{ ...(S.card as React.CSSProperties), borderLeft: `3px solid ${p.color}` }}>
                  <div style={{ fontFamily: fontStack.display, fontWeight: 700, fontSize: 16, letterSpacing: "0.1em", textTransform: "uppercase", color: p.color, marginBottom: 8 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: palette.mutedText, lineHeight: 1.7 }}>{p.desc}</div>
                </div>
              ))}
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.square}</span> Timing &amp; Easing</h2>
            <div style={S.card as React.CSSProperties}>
              {[
                { name: "Ultra Fast", value: "80ms", use: "Button press feedback, icon swaps" },
                { name: "Fast", value: "150ms", use: "Hover states, indicator color changes" },
                { name: "Standard", value: "220ms", use: "Card reveals, HUD value updates" },
                { name: "Medium", value: "350ms", use: "Panel entrances, modal opening" },
                { name: "Dramatic", value: "600ms", use: "Scene transitions, elimination reveals" },
                { name: "Cinematic", value: "1200ms+", use: "Loading, countdown, lethal game reveals" },
              ].map(t => (
                <div key={t.name} style={{ display: "flex", gap: 20, padding: "10px 0", borderBottom: `1px solid ${palette.border}`, alignItems: "center" }}>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 12, color: palette.neonPink, minWidth: 110 }}>{t.name}</div>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 14, fontWeight: 700, color: palette.coldWhite, minWidth: 70 }}>{t.value}</div>
                  <div style={{ fontSize: 12, color: palette.mutedText }}>{t.use}</div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: "14px 16px", background: palette.deepSurface, borderRadius: 4 }}>
                <div style={{ ...(S.h3 as React.CSSProperties), marginBottom: 8 }}>Primary Easing</div>
                <div style={{ fontFamily: fontStack.mono, fontSize: 13, color: palette.neonGreen }}>cubic-bezier(0.4, 0, 0.2, 1)</div>
                <div style={{ fontSize: 12, color: palette.mutedText, marginTop: 4 }}>Mechanical in, sharp out. Default for all state changes.</div>
              </div>
            </div>

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.triangle}</span> Key Animation Sequences</h2>
            {[
              {
                title: "Red Light Activation",
                steps: ["200ms — Screen flushes red tint (rgba(220,30,30,0.15))", "300ms — Doll angle rotates 180° with sharp ease", "100ms — HUD label snaps to '● RED LIGHT' in blood red", "0ms — STOP warning appears (immediate, no fade)", "HOLD — Heartbeat loop begins at 60bpm, increases with velocity"],
                color: palette.bloodRed,
              },
              {
                title: "Elimination Sequence",
                steps: ["0ms — Full-screen red flash (180ms duration)", "180ms — Letterbox bars slide in from top/bottom (500ms)", "600ms — ELIMINATED card fades in (400ms ease-in)", "2000ms — Hold for 1 second", "2400ms — Fade to black (400ms)", "2800ms — Route to game-over screen"],
                color: palette.neonPink,
              },
              {
                title: "Victory Reveal",
                steps: ["0ms — Gold flash (rgba(255,214,10,0.35)) 250ms", "250ms — SURVIVED card fades in from scale(0.85) → scale(1)", "900ms — Score value counts up from 0 to final (800ms)", "1400ms — CTAs slide in from below (300ms)"],
                color: palette.neonGreen,
              },
              {
                title: "Menu Card Hover",
                steps: ["0ms — translateY(-3px) scale(1.012) (220ms mechanical)", "0ms — Box-shadow spreads accent glow (220ms)", "0ms — CTA letter-spacing increases 0.25em → 0.35em"],
                color: palette.amber,
              },
            ].map(a => (
              <div key={a.title} style={{ ...(S.card as React.CSSProperties), borderTop: `3px solid ${a.color}`, marginBottom: 16 }}>
                <div style={{ fontFamily: fontStack.display, fontWeight: 700, fontSize: 16, letterSpacing: "0.1em", textTransform: "uppercase", color: a.color, marginBottom: 12 }}>{a.title}</div>
                {a.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: `1px solid ${palette.border}` }}>
                    <span style={{ fontFamily: fontStack.mono, fontSize: 10, color: a.color, minWidth: 24 }}>{i + 1}.</span>
                    <span style={{ fontFamily: fontStack.mono, fontSize: 12, color: palette.mutedText, lineHeight: 1.6 }}>{s}</span>
                  </div>
                ))}
              </div>
            ))}

            <h2 style={S.h2 as React.CSSProperties}><span>{geo.circle}</span> Layout &amp; Spacing Rules</h2>
            <div style={S.grid2 as React.CSSProperties}>
              <div style={S.card as React.CSSProperties}>
                <div style={S.h3 as React.CSSProperties}>Spacing Scale</div>
                {([["xs", "4px", "Icon gaps, tight labels"], ["sm", "8px", "Internal component spacing"], ["md", "16px", "Card padding, between items"], ["lg", "24px", "Section gaps"], ["xl", "40px+", "Page-level breathing room"]] as const).map(([n, v, d]) => (
                  <div key={n} style={{ display: "flex", gap: 12, padding: "6px 0", fontSize: 12, borderBottom: `1px solid ${palette.border}` }}>
                    <span style={{ fontFamily: fontStack.mono, color: palette.neonPink, minWidth: 24 }}>{n}</span>
                    <span style={{ fontFamily: fontStack.mono, color: palette.coldWhite, minWidth: 50 }}>{v}</span>
                    <span style={{ color: palette.mutedText }}>{d}</span>
                  </div>
                ))}
              </div>
              <div style={S.card as React.CSSProperties}>
                <div style={S.h3 as React.CSSProperties}>Corner Radius Rules</div>
                {([["0px", "Buttons, tags, critical UI — NO rounding"], ["2px", "Minimal softening for badges only"], ["4px", "Cards, panels, menus"], ["Never", "Circular buttons, pill shapes — breaks theme"]] as const).map(([r, d]) => (
                  <div key={r} style={{ display: "flex", gap: 12, padding: "6px 0", fontSize: 12, borderBottom: `1px solid ${palette.border}` }}>
                    <span style={{ fontFamily: fontStack.mono, color: palette.neonPink, minWidth: 60 }}>{r}</span>
                    <span style={{ color: palette.mutedText }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
