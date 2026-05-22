'use client';

/**
 * components/GameLoader.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dynamic lazy-loads the selected game component with:
 *   - Cinematic loading screen (matches menu aesthetic)
 *   - Error boundary with recovery
 *   - Smooth mount/unmount transitions
 *   - Back-to-menu button always accessible
 *
 * Place at: src/components/GameLoader.tsx
 */

import React, {
  Suspense,
  lazy,
  useEffect,
  useCallback,
  useRef,
  useState,
  Component,
  type ReactNode,
  type ErrorInfo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type GameId, GAME_REGISTRY, useGameStore } from '../lib/gameStore';

// ─── Dynamic imports — add new games here ─────────────────────────────────────

const GAME_COMPONENTS: Record<GameId, React.LazyExoticComponent<React.ComponentType>> = {
  'red-light-green-light': lazy(() =>
    import('./games/RedLightGreenLight').catch(() => ({
      default: () => <GameLoadError message="RedLightGreenLight component not found at src/components/games/RedLightGreenLight.tsx" />,
    }))
  ),
  'glass-bridge': lazy(() =>
    import('./games/GlassBridge').catch(() => ({
      default: () => <GameLoadError message="GlassBridge component not found at src/components/games/GlassBridge.tsx" />,
    }))
  ),
};

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen({ gameId }: { gameId: GameId }) {
  const game   = GAME_REGISTRY.find((g) => g.id === gameId);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);

  // Animated progress bar — fake but cinematic
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 18;
      if (p > 92) { p = 92; clearInterval(id); }
      setProgress(p);
    }, 180);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{   opacity: 0, transition: { duration: 0.2 } }}
      style={{
        position:       'fixed',
        inset:          0,
        background:     '#040202',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         200,
      }}
    >
      {/* Scanlines */}
      <div style={{
        position:   'absolute',
        inset:      0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)',
        pointerEvents: 'none',
      }} />

      {/* Symbol */}
      <motion.div
        animate={{
          opacity:  [0.3, 1, 0.3],
          scale:    [0.95, 1.05, 0.95],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          fontSize:   80,
          color:      game?.accentColor ?? '#ff6b7a',
          marginBottom: 32,
          filter:     `drop-shadow(0 0 32px ${game?.accentColor ?? '#ff6b7a'})`,
        }}
      >
        {game?.symbol ?? '○'}
      </motion.div>

      {/* Game title */}
      <div style={{
        fontFamily:    '"Impact", sans-serif',
        fontSize:      'clamp(28px, 5vw, 48px)',
        color:         '#fff',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        textAlign:     'center',
        marginBottom:  8,
      }}>
        {game?.title} {game?.subtitle}
      </div>

      {/* Loading text */}
      <div style={{
        fontFamily:    'monospace',
        fontSize:      11,
        color:         'rgba(255,255,255,0.3)',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        marginBottom:  32,
        minWidth:      '10ch',
      }}>
        LOADING{dots}
      </div>

      {/* Progress bar */}
      <div style={{
        width:        'min(360px, 80vw)',
        height:       2,
        background:   'rgba(255,255,255,0.08)',
        borderRadius: 2,
        overflow:     'hidden',
      }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          style={{
            height:     '100%',
            background: game?.accentColor ?? '#ff6b7a',
            borderRadius: 2,
          }}
          transition={{ ease: 'easeOut' }}
        />
      </div>

      {/* Case number */}
      <div style={{
        fontFamily:    'monospace',
        fontSize:      9,
        color:         'rgba(255,255,255,0.12)',
        letterSpacing: '0.3em',
        marginTop:     20,
        textTransform: 'uppercase',
      }}>
        CASE NO. {game?.cardNumber}
      </div>
    </motion.div>
  );
}

// ─── Game-specific load error (inline) ───────────────────────────────────────

function GameLoadError({ message }: { message: string }) {
  const { clearError, returnToMenu } = useGameStore();
  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     '#040202',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
      color:          '#fff',
      fontFamily:     'monospace',
      padding:        32,
    }}>
      <div style={{ fontSize: 48, color: '#ff2244' }}>✕</div>
      <div style={{
        fontSize:      14,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color:         '#ff6b7a',
      }}>
        GAME FAILED TO LOAD
      </div>
      <div style={{
        fontSize:   11,
        color:      'rgba(255,255,255,0.3)',
        maxWidth:   480,
        textAlign:  'center',
        lineHeight: 1.7,
      }}>
        {message}
      </div>
      <button
        onClick={() => { clearError(); returnToMenu(); }}
        style={{
          marginTop:     16,
          padding:       '11px 32px',
          border:        '1.5px solid rgba(255,107,122,0.5)',
          borderRadius:  3,
          background:    'transparent',
          color:         '#ff6b7a',
          fontFamily:    '"Impact", monospace',
          fontSize:       13,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          cursor:        'pointer',
        }}
      >
        ← Return to Menu
      </button>
    </div>
  );
}

// ─── Error Boundary class component ──────────────────────────────────────────

interface BoundaryProps  { children: ReactNode; gameId: GameId; onError: (msg: string) => void; }
interface BoundaryState  { hasError: boolean; message: string; }

class GameErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): BoundaryState {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[GameErrorBoundary]', err, info);
    this.props.onError(err.message);
  }

  render() {
    if (this.state.hasError) {
      return <GameLoadError message={this.state.message || 'An unexpected error occurred.'} />;
    }
    return this.props.children;
  }
}

// ─── Back to menu button (always rendered over the game) ──────────────────────

function BackButton({ onBack }: { onBack: () => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show after 1s, hide on game focus, re-show on mouse movement
  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(true), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleMouseMove = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-btn"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0   }}
          exit={{   opacity: 0, x: -10  }}
          transition={{ duration: 0.2 }}
          onClick={onBack}
          style={{
            position:      'fixed',
            top:           16,
            left:          16,
            zIndex:        9999,
            padding:       '8px 16px',
            background:    'rgba(4, 2, 2, 0.85)',
            border:        '1px solid rgba(255,107,122,0.35)',
            borderRadius:  3,
            color:         'rgba(255,107,122,0.8)',
            fontFamily:    '"Impact", monospace',
            fontSize:       11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor:        'pointer',
            backdropFilter:'blur(8px)',
          }}
        >
          ← MENU
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ─── Main GameLoader export ───────────────────────────────────────────────────

interface GameLoaderProps {
  gameId:  GameId;
  onBack:  () => void;
}

export default function GameLoader({ gameId, onBack }: GameLoaderProps) {
  const { setLoadingDone, setError, recordGamePlay } = useGameStore();
  const [mounted, setMounted] = useState(false);

  // Give Suspense time to settle before marking done
  useEffect(() => {
    const id = setTimeout(() => {
      setMounted(true);
      setLoadingDone();
      recordGamePlay(gameId);
    }, 600);
    return () => clearTimeout(id);
  }, [gameId, setLoadingDone, recordGamePlay]);

  const GameComponent = GAME_COMPONENTS[gameId];

  if (!GameComponent) {
    return (
      <GameLoadError
        message={`No component registered for game ID: "${gameId}". Add it to GAME_COMPONENTS in GameLoader.tsx.`}
      />
    );
  }

  return (
    <>
      <BackButton onBack={onBack} />

      <AnimatePresence>
        {!mounted && <LoadingScreen key="loader" gameId={gameId} />}
      </AnimatePresence>

      <GameErrorBoundary gameId={gameId} onError={setError}>
        <Suspense fallback={<LoadingScreen gameId={gameId} />}>
          <motion.div
            key={gameId}
            initial={{ opacity: 0 }}
            animate={{ opacity: mounted ? 1 : 0 }}
            exit={{   opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'fixed', inset: 0 }}
          >
            <GameComponent />
          </motion.div>
        </Suspense>
      </GameErrorBoundary>
    </>
  );
}