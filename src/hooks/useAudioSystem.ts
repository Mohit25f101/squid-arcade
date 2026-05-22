import { useEffect, useState } from 'react';
import { gameAudioManager } from '../lib/audio/AudioManager';

export function useAudioSystem() {
  const [isAudioReady, setIsAudioReady] = useState(false);

  const initAudio = async () => {
    try {
      await gameAudioManager.initialize();
      if (gameAudioManager['ctx']?.state === 'suspended') {
        await gameAudioManager['ctx'].resume();
      }
      setIsAudioReady(true);
    } catch (err) {
      console.error("Failed to initialize audio:", err);
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        gameAudioManager.suspend();
      } else {
        gameAudioManager.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return { initAudio, isAudioReady };
}