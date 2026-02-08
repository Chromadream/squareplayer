import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FocusablePressable from '../components/FocusablePressable';

interface SetupScreenProps {
  onPickFolder: () => void;
  isPicking: boolean;
}

export default function SetupScreen({
  onPickFolder,
  isPicking,
}: SetupScreenProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>SquarePlayer</Text>
      <Text style={styles.subtitle}>FLAC Music Player</Text>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  appTitle: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
  },
  buttonFocused: {
    borderColor: '#4a9eff',
    backgroundColor: 'rgba(74, 158, 255, 0.15)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: '#444',
    fontSize: 13,
    marginTop: 20,
  },
});
