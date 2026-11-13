import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Keeps a screen up to date: runs `refresh` when the screen opens, when the
 * person comes back to the app or browser tab, and every 20 seconds while
 * it's open. So a new time or a cancellation shows up without reloading.
 */
export function useLiveRefresh(refresh: () => unknown, everyMs = 20_000) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useFocusEffect(
    useCallback(() => {
      latest.current();
      const timer = setInterval(() => latest.current(), everyMs);
      return () => clearInterval(timer);
    }, [everyMs]),
  );

  useEffect(() => {
    const onBack = () => latest.current();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisible = () => document.visibilityState === 'visible' && onBack();
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onBack);
      return () => {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onBack);
      };
    }
    const sub = AppState.addEventListener('change', (s) => s === 'active' && onBack());
    return () => sub.remove();
  }, []);
}
