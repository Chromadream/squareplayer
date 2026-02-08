import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, AppState, type AppStateStatus } from 'react-native';
import MaterialYouColors, { type MaterialYouPalette } from '../native/MaterialYouColors';
import { mapPaletteToTheme, type ThemeColors } from './colors';
import { usePlayerStore } from '../store/playerStore';

export type ThemeMode = 'system' | 'dark' | 'light';

const ThemeContext = createContext<ThemeColors | null>(null);

/**
 * Resolves the effective mode: 'system' queries Appearance, otherwise uses the override.
 */
function resolveMode(themeMode: ThemeMode): 'dark' | 'light' {
  if (themeMode === 'system') {
    return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  }
  return themeMode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const themeMode = usePlayerStore(s => s.themeMode);
  const [palette, setPalette] = useState<MaterialYouPalette>(
    () => MaterialYouColors.palette,
  );
  const [systemScheme, setSystemScheme] = useState<'dark' | 'light'>(
    () => (Appearance.getColorScheme() === 'light' ? 'light' : 'dark'),
  );

  // Listen for system dark/light mode changes
  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => listener.remove();
  }, []);

  // Re-read palette when app comes back to foreground (wallpaper may have changed)
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        MaterialYouColors.getPalette()
          .then(setPalette)
          .catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  const effectiveMode = useMemo(
    () => (themeMode === 'system' ? systemScheme : themeMode),
    [themeMode, systemScheme],
  );

  const colors = useMemo(
    () => mapPaletteToTheme(palette, effectiveMode),
    [palette, effectiveMode],
  );

  return (
    <ThemeContext.Provider value={colors}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Access the current resolved theme colors.
 */
export function useTheme(): ThemeColors {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

/**
 * Memoized dynamic stylesheet helper.
 * Recreates the stylesheet only when the theme colors object identity changes
 * (i.e. on wallpaper change or dark/light toggle).
 *
 * Usage:
 *   const styles = useThemedStyles(colors => StyleSheet.create({ ... }));
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useTheme();
  return useMemo(() => factory(colors), [colors]);
}
