import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme/ThemeProvider';

export default function AppHeader(): React.JSX.Element {
  const styles = useThemedStyles(createStyles);

  return (
    <>
      <Text style={styles.appTitle}>squareplayer</Text>
      <Text style={styles.subtitle}>
        Opinionated Music Player for Retroid Pocket Classic/Ayaneo Pocket DMG
      </Text>
    </>
  );
}

const createStyles = (c: import('../theme/colors').ThemeColors) => StyleSheet.create({
  appTitle: {
    color: c.textPrimary,
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: c.textTertiary,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 48,
    textAlign: 'center',
  },
});
