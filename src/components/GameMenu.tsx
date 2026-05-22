'use client';

/**
 * components/GameMenu.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Cinematic horror game selection screen.
 * Aesthetic: Korean surveillance-industrial — deep black, sickly coral
 * dossier cards, harsh stencil type, Squid Game geometric symbols.
 *
 * Place at: src/components/GameMenu.tsx
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { type GameId, useGameStore } from '../store/gameStore';

// ─── Game Registry & Types ────────────────────────────────────────────────────

export interface GameDefinition {
  id: GameId;
  title: string;
  subtitle: string;
  description: string;
  symbol: string;
  accentColor: string;
  difficulty: 'Moderate' | 'Lethal' | 'Extreme';
  playerCount: number;
  tags: string[];
  cardNumber: number;
  isNew?: boolean;
}

export const GAME_REGISTRY: GameDefinition[] = [
  {
    id: 'glass-bridge',
    title: 'Glass',
    subtitle: 'Bridge',
    description: 'Cross a bridge of tempered and normal glass. One wrong step means elimination.',
    symbol: '△',
    accentColor: '#00ff88',
    difficulty: 'Lethal',
    playerCount: 100,
    tags: ['SURVIVAL', 'PUZZLE', 'PRECISION'],
    cardNumber: 1,
  },
  {
    id: 'red-light-green-light',
    title: 'Red Light',
    subtitle: 'Green Light',
    description: 'Move when the doll looks away. Get caught moving and face elimination.',
    symbol: '○',
    accentColor: '#ff2d55',
    difficulty: 'Lethal',
    playerCount: 456,
    tags: ['REFLEX', 'TIMING', 'SUSPENSE'],
    cardNumber: 2,
  },
  {
    id: 'dalgona',
    title: 'Dalgona',
    subtitle: 'Candy',
    description: 'Carve out the shape without breaking. Precision and patience are required.',
    symbol: '□',
    accentColor: '#ffd60a',
    difficulty: 'Moderate',
    playerCount: 218,
    tags: ['PATIENCE', 'PRECISION', 'PUZZLE'],
    cardNumber: 3,
    isNew: true,
  },
];

// ─── Canvas background — floating symbols + scanlines ────────────────────────

function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    interface Sym {
      x: number; y: number; vy: number;
      size: number; alpha: number; char: string; rot: number; rotV: number;
    }
    const CHARS = ['○', '△', '□'];
    const syms: Sym[] = Array.from({ length: 28 }, () => ({
      x:    Math.random() * window.innerWidth,
      y:    Math.random() * window.innerHeight,
      vy:   0.12 + Math.random() * 0.25,
      size: 14 + Math.random() * 32,
      alpha: 0.03 + Math.random() * 0.07,
      char: CHARS[Math.floor(Math.random() * 3)],
      rot:  Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.003,
    }));

    let t = 0;
    const draw = () => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      // Deep background gradient
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, h * 0.9);
      bg.addColorStop(0, 'rgba(18, 6, 6, 1)');
      bg.addColorStop(1, 'rgba(4, 2, 2, 1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Floating symbols
      syms.forEach((s) => {
        s.y   += s.vy;
        s.rot += s.rotV;
        if (s.y > h + 60) { s.y = -60; s.x = Math.random() * w; }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.globalAlpha = s.alpha * (0.7 + 0.3 * Math.sin(t * 0.8 + s.x));
        ctx.font        = `${s.size}px serif`;
        ctx.fillStyle   = '#ff6b7a';
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'middle';
        ctx.fillText(s.char, 0, 0);
        ctx.restore();
      });

      // Scanlines overlay
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, y, w, 1);
      }

      // Subtle horizontal vignette bands
      const vg = ctx.createLinearGradient(0, 0, 0, h);
      vg.addColorStop(0,   'rgba(0,0,0,0.6)');
      vg.addColorStop(0.3, 'rgba(0,0,0,0)');
      vg.addColorStop(0.7, 'rgba(0,0,0,0)');
      vg.addColorStop(1,   'rgba(0,0,0,0.7)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  );
}

// ─── Glitch text effect ───────────────────────────────────────────────────────

function GlitchText({ text, className = '' }: { text: string; className?: string }) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 120);
    }, 3500 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        position: 'relative',
        transform: glitching ? `translate(${(Math.random()-0.5)*4}px, ${(Math.random()-0.5)*2}px)` : 'none',
        transition: 'transform 0.05s',
      }}
    >
      {text}
      {glitching && (
        <>
          <span style={{
            position: 'absolute', inset: 0,
            color: '#00ffcc', clipPath: 'inset(30% 0 50% 0)',
            transform: 'translateX(3px)', opacity: 0.7,
          }}>{text}</span>
          <span style={{
            position: 'absolute', inset: 0,
            color: '#ff3d5a', clipPath: 'inset(60% 0 20% 0)',
            transform: 'translateX(-3px)', opacity: 0.7,
          }}>{text}</span>
        </>
      )}
    </span>
  );
}

// ─── Tilt card wrapper ────────────────────────────────────────────────────────

function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x   = useMotionValue(0);
  const y   = useMotionValue(0);
  const rotX = useTransform(y, [-0.5, 0.5], [6, -6]);
  const rotY = useTransform(x, [-0.5, 0.5], [-6, 6]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(((e.clientX - rect.left) / rect.width  - 0.5));
    y.set(((e.clientY - rect.top)  / rect.height - 0.5));
  }, [x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0); y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d', perspective: 800 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

// ─── Individual game card ─────────────────────────────────────────────────────

interface GameCardProps {
  game:    GameDefinition;
  index:   number;
  onLaunch: (id: GameId) => void;
  gamesPlayed: number;
  highScore:   number;
}

function GameCard({ game, index, onLaunch, gamesPlayed, highScore }: GameCardProps) {
  const [hovered, setHovered]   = useState(false);
  const [pressing, setPressing] = useState(false);

  const difficultyColor = {
    Moderate: '#ffd700',
    Lethal:   '#ff6b35',
    Extreme:  '#ff2244',
  }[game.difficulty as 'Moderate' | 'Lethal' | 'Extreme'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotateX: -15 }}
      animate={{ opacity: 1, y: 0,  rotateX: 0   }}
      transition={{
        delay:    0.3 + index * 0.15,
        duration: 0.7,
        ease:     [0.16, 1, 0.3, 1],
      }}
    >
      <TiltCard>
        <motion.div
          onHoverStart={() => setHovered(true)}
          onHoverEnd={()   => setHovered(false)}
          onTapStart={() => setPressing(true)}
          onTap={() => { setPressing(false); onLaunch(game.id); }}
          onTapCancel={() => setPressing(false)}
          animate={{
            scale:     pressing ? 0.97 : 1,
            boxShadow: hovered
              ? `0 0 0 1px ${game.accentColor}55, 0 24px 64px rgba(0,0,0,0.7), 0 0 80px ${game.accentColor}22`
              : '0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.5)',
          }}
          transition={{ duration: 0.2 }}
          style={{
            position:     'relative',
            width:        '100%',
            background:   'rgba(8, 3, 3, 0.92)',
            border:       `1px solid rgba(255,255,255,0.07)`,
            borderRadius: 4,
            overflow:     'hidden',
            cursor:       'pointer',
            userSelect:   'none',
          }}
        >
          {/* Top accent bar */}
          <motion.div
            animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
            initial={{ scaleX: 0 }}
            style={{
              position:       'absolute',
              top:            0, left: 0, right: 0,
              height:         2,
              background:     game.accentColor,
              transformOrigin:'left',
            }}
          />

          {/* Card number + symbol header */}
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            padding:        '20px 24px 0',
          }}>
            <div style={{
              fontFamily:    'var(--font-mono, "Courier New", monospace)',
              fontSize:      11,
              letterSpacing: '0.25em',
              color:         'rgba(255,255,255,0.25)',
              textTransform: 'uppercase',
            }}>
              CASE NO. {game.cardNumber}
            </div>
            <motion.div
              animate={{
                color:     hovered ? game.accentColor : 'rgba(255,255,255,0.15)',
                textShadow: hovered ? `0 0 24px ${game.accentColor}` : 'none',
                scale:      hovered ? 1.15 : 1,
              }}
              style={{
                fontSize: 28,
                lineHeight: 1,
                transition: 'all 0.3s',
              }}
            >
              {game.symbol}
            </motion.div>
          </div>

          {/* NEW badge */}
          {game.isNew && (
            <div style={{
              position:      'absolute',
              top:           16, left:  24,
              background:    game.accentColor,
              color:         '#000',
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: '0.2em',
              padding:       '2px 7px',
              borderRadius:  2,
              fontFamily:    'var(--font-mono, monospace)',
            }}>
              NEW
            </div>
          )}

          {/* Main content */}
          <div style={{ padding: '16px 24px 24px' }}>
            {/* Title */}
            <div style={{ marginBottom: 4 }}>
              <div style={{
                fontFamily:    '"Impact", "Anton", "Oswald", sans-serif',
                fontSize:      'clamp(28px, 4vw, 42px)',
                fontWeight:    900,
                color:         '#fff',
                letterSpacing: '0.04em',
                lineHeight:    1.0,
                textTransform: 'uppercase',
              }}>
                {game.title}
              </div>
              <div style={{
                fontFamily:    '"Impact", "Anton", "Oswald", sans-serif',
                fontSize:      'clamp(28px, 4vw, 42px)',
                fontWeight:    900,
                letterSpacing: '0.04em',
                lineHeight:    1.0,
                textTransform: 'uppercase',
                color:         game.accentColor,
              }}>
                {game.subtitle}
              </div>
            </div>

            {/* Divider */}
            <motion.div
              animate={{ width: hovered ? '100%' : '32px' }}
              style={{
                height:     1,
                background: `linear-gradient(90deg, ${game.accentColor}, transparent)`,
                margin:     '14px 0',
              }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Description */}
            <p style={{
              fontFamily:  '"Georgia", serif',
              fontSize:    13,
              lineHeight:  1.65,
              color:       'rgba(255,255,255,0.45)',
              margin:      '0 0 20px',
              fontStyle:   'italic',
            }}>
              {game.description}
            </p>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {game.tags.map((tag: string) => (
                <span key={tag} style={{
                  fontFamily:    'var(--font-mono, monospace)',
                  fontSize:      9,
                  letterSpacing: '0.18em',
                  color:         'rgba(255,255,255,0.3)',
                  border:        '1px solid rgba(255,255,255,0.1)',
                  padding:       '3px 8px',
                  borderRadius:  2,
                  textTransform: 'uppercase',
                }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Stats row */}
            <div style={{
              display:       'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap:           1,
              background:    'rgba(255,255,255,0.04)',
              borderRadius:  3,
              overflow:      'hidden',
              marginBottom:  20,
            }}>
              {[
                { label: 'PLAYERS',    value: game.playerCount },
                { label: 'DIFFICULTY', value: game.difficulty,  color: difficultyColor },
                { label: 'PLAYED',     value: gamesPlayed > 0 ? `${gamesPlayed}×` : '—' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  padding:   '10px 12px',
                  background:'rgba(255,255,255,0.03)',
                }}>
                  <div style={{
                    fontFamily:    'var(--font-mono, monospace)',
                    fontSize:      8,
                    letterSpacing: '0.2em',
                    color:         'rgba(255,255,255,0.25)',
                    marginBottom:  4,
                    textTransform: 'uppercase',
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontFamily: '"Impact", sans-serif',
                    fontSize:   13,
                    color:      color ?? 'rgba(255,255,255,0.65)',
                    fontWeight: 700,
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* High score (if played) */}
            {highScore > 0 && (
              <div style={{
                fontFamily:    'var(--font-mono, monospace)',
                fontSize:      10,
                letterSpacing: '0.15em',
                color:         'rgba(255,255,255,0.2)',
                marginBottom:  16,
              }}>
                BEST: <span style={{ color: game.accentColor }}>{highScore.toLocaleString()}</span>
              </div>
            )}

            {/* Launch button */}
            <motion.button
              animate={{
                background: hovered
                  ? game.accentColor
                  : 'transparent',
                color:      hovered ? '#000' : game.accentColor,
                borderColor: game.accentColor,
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onLaunch(game.id)}
              style={{
                width:         '100%',
                padding:       '13px 0',
                border:        `1.5px solid`,
                borderRadius:  3,
                cursor:        'pointer',
                fontFamily:    '"Impact", "Oswald", sans-serif',
                fontSize:      14,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                transition:    'all 0.2s',
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                gap:           8,
              }}
            >
              <span>{game.symbol}</span>
              <span>Enter Arena</span>
            </motion.button>
          </div>

          {/* Corner accents */}
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 32, height: 32,
            borderRight: `1px solid ${game.accentColor}44`,
            borderBottom:`1px solid ${game.accentColor}44`,
            borderRadius:'0 0 4px 0',
            opacity: hovered ? 1 : 0.3,
            transition: 'opacity 0.3s',
          }} />
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: 32, height: 32,
            borderLeft:  `1px solid ${game.accentColor}44`,
            borderTop:   `1px solid ${game.accentColor}44`,
            borderRadius:'4px 0 0 0',
            opacity: hovered ? 1 : 0.3,
            transition: 'opacity 0.3s',
          }} />
        </motion.div>
      </TiltCard>
    </motion.div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function MenuHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y:   0  }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ textAlign: 'center', marginBottom: 'clamp(40px, 6vh, 72px)' }}
    >
      {/* Eyebrow */}
      <motion.div
        initial={{ opacity: 0, letterSpacing: '0.6em' }}
        animate={{ opacity: 1, letterSpacing: '0.35em' }}
        transition={{ delay: 0.2, duration: 0.9 }}
        style={{
          fontFamily:    'var(--font-mono, monospace)',
          fontSize:      10,
          color:         'rgba(255,107,122,0.55)',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          marginBottom:  20,
        }}
      >
        ◈ &nbsp; SQUID ARCADE SYSTEM &nbsp; ◈
      </motion.div>

      {/* Main title */}
      <h1 style={{
        fontFamily:    '"Impact", "Anton", "Bebas Neue", sans-serif',
        fontSize:      'clamp(52px, 10vw, 108px)',
        fontWeight:    900,
        color:         '#fff',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        lineHeight:    0.9,
        margin:        0,
      }}>
        <GlitchText text="SELECT" />
        <br />
        <span style={{ color: 'hsl(350, 85%, 58%)', WebkitTextStroke: '0px' }}>
          GAME
        </span>
      </h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        style={{
          fontFamily:  '"Georgia", "Times New Roman", serif',
          fontSize:    13,
          fontStyle:   'italic',
          color:       'rgba(255,255,255,0.25)',
          marginTop:   20,
          letterSpacing:'0.05em',
        }}
      >
        Choose your trial. All participants are expected to comply.
      </motion.p>

      {/* Decorative rule */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{
          height:         1,
          background:     'linear-gradient(90deg, transparent, rgba(255,107,122,0.4), transparent)',
          margin:         '24px auto 0',
          maxWidth:       400,
          transformOrigin:'center',
        }}
      />
    </motion.div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function MenuFooter() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8, duration: 0.6 }}
      style={{
        textAlign:     'center',
        marginTop:     'clamp(32px, 5vh, 56px)',
        fontFamily:    'var(--font-mono, monospace)',
        fontSize:      10,
        color:         'rgba(255,255,255,0.12)',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
      }}
    >
      <div>WASD / ← → · Move &nbsp;|&nbsp; SPACE · Jump &nbsp;|&nbsp; ESC · Exit</div>
      <div style={{ marginTop: 8, color: 'rgba(255,107,122,0.2)' }}>
        ○ △ □ &nbsp; ALL GAMES REQUIRE COMPLIANCE &nbsp; □ △ ○
      </div>
    </motion.div>
  );
}

// ─── Main GameMenu export ─────────────────────────────────────────────────────

interface GameMenuProps {
  onLaunch: (id: GameId) => void;
}

export default function GameMenu({ onLaunch }: GameMenuProps) {
  // Default game stats (gamesPlayed and highScores not in GameStoreState)
  const defaultStats: Record<GameId, { played: number; highScore: number }> = {
    'menu': { played: 0, highScore: 0 },
    'glass-bridge': { played: 0, highScore: 0 },
    'red-light-green-light': { played: 0, highScore: 0 },
    'dalgona': { played: 0, highScore: 0 },
  };

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      overflow:       'auto',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        'clamp(24px, 5vw, 64px) clamp(16px, 4vw, 48px)',
      zIndex:         10,
    }}>
      <AmbientCanvas />

      <div style={{
        position:  'relative',
        zIndex:    1,
        width:     '100%',
        maxWidth:  1100,
        margin:    'auto',
      }}>
        <MenuHeader />

        {/* Card grid */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap:                 'clamp(16px, 3vw, 32px)',
        }}>
          {GAME_REGISTRY.map((game: GameDefinition, i: number) => (
            <GameCard
              key={game.id}
              game={game}
              index={i}
              onLaunch={onLaunch}
              gamesPlayed={defaultStats[game.id]?.played ?? 0}
              highScore={defaultStats[game.id]?.highScore ?? 0}
            />
          ))}
        </div>

        <MenuFooter />
      </div>
    </div>
  );
}