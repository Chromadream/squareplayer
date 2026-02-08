import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FocusablePressable from '../components/FocusablePressable';
import AppHeader from '../components/AppHeader';
import { useThemedStyles } from '../theme/ThemeProvider';

interface SetupScreenProps {
  onPickFolder: () => void;
  isPicking: boolean;
}

export default function SetupScreen({
  onPickFolder,
  isPicking,
}: SetupScreenProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <AppHeader />

      <FocusablePressable
        onPress={onPickFolder}
        disabled={isPicking}
        style={[styles.button, isPicking && styles.buttonDisabled]}
        focusedStyle={styles.buttonFocused}
      >
        <Text style={styles.buttonText}>
          {isPicking ? 'Selecting...' : 'Select Music Folder'}
        </Text>
      </FocusablePressable>

      <Text style={styles.hint}>
        Choose a folder containing your FLAC files
      </Text>
    </View>
  );
}

const createStyles = (c: import('../theme/colors').ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  button: {
    backgroundColor: c.surfaceVariant,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.border,
  },
  buttonFocused: {
    borderColor: c.accentPrimary,
    backgroundColor: c.accentPrimaryMuted,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: c.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: c.textFaint,
    fontSize: 13,
    marginTop: 20,
  },
});
