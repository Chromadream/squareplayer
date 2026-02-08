import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { useThemedStyles } from '../theme/ThemeProvider';

export default function StatusOverlay(): React.JSX.Element | null {
  const statusMessage = usePlayerStore(s => s.statusMessage);
  const styles = useThemedStyles(createStyles);

  if (!statusMessage) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{statusMessage}</Text>
    </View>
  );
}

const createStyles = (c: import('../theme/colors').ThemeColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 32,
    alignSelf: 'center',
    backgroundColor: c.overlayMedium,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    zIndex: 100,
  },
  text: {
    color: c.npTextPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
});
