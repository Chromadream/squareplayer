import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import type { ControllerLayout, ScreenName, StandardXAction } from '../store/playerStore';
import { useThemedStyles } from '../theme/ThemeProvider';

interface HintItem {
  button: string;
  action: string;
}

function getHints(screen: ScreenName, layout: ControllerLayout, xAction: StandardXAction): HintItem[] {
  switch (screen) {
    case 'nowplaying': {
      const xLabel =
        layout === 'sixbutton'
          ? 'Favorite'
          : xAction === 'favorite'
            ? 'Favorite'
            : 'Repeat';
      const base: HintItem[] = [
        { button: 'X', action: xLabel },
        { button: 'Y', action: 'Track Info' },
        { button: 'L1', action: 'Prev' },
        { button: 'R1', action: 'Next' },
        { button: 'L2', action: 'Seek−' },
        { button: 'R2', action: 'Seek+' },
      ];
      if (layout === 'sixbutton') {
        base.push(
          { button: 'C', action: 'Restart' },
          { button: 'Z', action: 'Repeat' },
        );
      }
      return base;
    }
    case 'library': {
      const base: HintItem[] = [
        { button: 'X', action: 'Favorite' },
        { button: 'Y', action: 'Track Info' },
        { button: 'L1', action: 'Page↑' },
        { button: 'R1', action: 'Page↓' },
        { button: 'R2', action: 'Album Exp.' },
      ];
      if (layout === 'sixbutton') {
        base.push({ button: 'C', action: 'Track Info' });
      }
      return base;
    }
    case 'folder': {
      const base: HintItem[] = [
        { button: 'X', action: 'Favorite' },
        { button: 'Y', action: 'Track Info' },
        { button: 'L1', action: 'Page↑' },
        { button: 'R1', action: 'Page↓' },
        { button: 'R2', action: 'Album Exp.' },
      ];
      if (layout === 'sixbutton') {
        base.push({ button: 'C', action: 'Track Info' });
      }
      return base;
    }
    case 'settings':
      return [
        { button: 'A', action: 'Change' },
        { button: 'B', action: 'Back' },
      ];
    default:
      return [];
  }
}

export default function ButtonHintBar(): React.JSX.Element | null {
  const showButtonHints = usePlayerStore(s => s.showButtonHints);
  const currentScreen = usePlayerStore(s => s.currentScreen);
  const controllerLayout = usePlayerStore(s => s.controllerLayout);
  const standardXAction = usePlayerStore(s => s.standardXAction);

  if (!showButtonHints) return null;

  const hints = getHints(currentScreen, controllerLayout, standardXAction);
  if (hints.length === 0) return null;

  return <ButtonHintBarInner hints={hints} />;
}

function ButtonHintBarInner({ hints }: { hints: HintItem[] }): React.JSX.Element {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {hints.map((hint, i) => (
        <View key={hint.button} style={styles.hintItem}>
          <View style={styles.buttonBadge}>
            <Text style={styles.buttonText}>{hint.button}</Text>
          </View>
          <Text style={styles.actionText}>{hint.action}</Text>
          {i < hints.length - 1 && <Text style={styles.separator}>·</Text>}
        </View>
      ))}
    </View>
  );
}

const createStyles = (c: import('../theme/colors').ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    backgroundColor: c.overlayHeavy,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonBadge: {
    backgroundColor: c.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  buttonText: {
    color: c.background,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionText: {
    color: c.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  separator: {
    color: c.textTertiary,
    fontSize: 12,
    marginHorizontal: 6,
  },
});
