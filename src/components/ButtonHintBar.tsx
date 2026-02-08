import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import type { ControllerLayout, ScreenName } from '../store/playerStore';

interface HintItem {
  button: string;
  action: string;
}

function getHints(screen: ScreenName, layout: ControllerLayout): HintItem[] {
  switch (screen) {
    case 'nowplaying': {
      const base: HintItem[] = [
        { button: 'A', action: 'Play/Pause' },
        { button: 'B', action: 'Back' },
        { button: 'X', action: 'Repeat' },
        { button: 'Y', action: 'Track Info' },
        { button: 'L1', action: 'Prev' },
        { button: 'R1', action: 'Next' },
        { button: 'L2', action: 'Seek−' },
        { button: 'R2', action: 'Seek+' },
      ];
      if (layout === 'sixbutton') {
        base.push(
          { button: 'C', action: 'Shuffle' },
          { button: 'Z', action: 'Restart' },
        );
      }
      return base;
    }
    case 'library': {
      const base: HintItem[] = [
        { button: 'A', action: 'Select' },
        { button: 'B', action: 'Back' },
        { button: 'Y', action: 'Track Info' },
        { button: 'L1', action: 'Page↑' },
        { button: 'R1', action: 'Page↓' },
      ];
      if (layout === 'sixbutton') {
        base.push({ button: 'C', action: 'Track Info' });
      }
      return base;
    }
    case 'folder': {
      const base: HintItem[] = [
        { button: 'A', action: 'Select' },
        { button: 'B', action: 'Back' },
        { button: 'X', action: 'Continuous Play' },
        { button: 'Y', action: 'Track Info' },
        { button: 'L1', action: 'Page↑' },
        { button: 'R1', action: 'Page↓' },
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

  if (!showButtonHints) return null;

  const hints = getHints(currentScreen, controllerLayout);
  if (hints.length === 0) return null;

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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 2,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  buttonBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    minWidth: 22,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: '700',
  },
  actionText: {
    color: '#888',
    fontSize: 10,
  },
  separator: {
    color: '#444',
    fontSize: 10,
    marginHorizontal: 4,
  },
});
