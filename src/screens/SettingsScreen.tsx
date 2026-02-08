import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import type { ControllerLayout, StandardXAction } from '../store/playerStore';
import FocusablePressable from '../components/FocusablePressable';
import { scanLibrary } from '../services/scanner';
import { startMetadataParsing } from '../services/metadataParser';
import MetadataProgressNotification from '../native/MetadataProgress';
import NotificationPermission from '../native/NotificationPermission';

const SEEK_OPTIONS = [5, 10, 15, 30];
const LARGE_SEEK_OPTIONS = [15, 30, 60];

// ─── Controller Diagram Components ──────────────────────────

function ShoulderButtons({ largeSeek }: { largeSeek: number }): React.JSX.Element {
  return (
    <View style={diagramStyles.shoulderRow}>
      <View style={diagramStyles.shoulderGroup}>
        <View style={diagramStyles.triggerButton}>
          <Text style={diagramStyles.triggerLabel}>L2</Text>
        </View>
        <View style={diagramStyles.shoulderButton}>
          <Text style={diagramStyles.shoulderLabel}>L1</Text>
        </View>
        <Text style={diagramStyles.shoulderAction}>Prev Track</Text>
      </View>
      <View style={diagramStyles.shoulderGroup}>
        <Text style={diagramStyles.shoulderAction}>Next Track</Text>
        <View style={diagramStyles.shoulderButton}>
          <Text style={diagramStyles.shoulderLabel}>R1</Text>
        </View>
        <View style={diagramStyles.triggerButton}>
          <Text style={diagramStyles.triggerLabel}>R2</Text>
        </View>
      </View>
    </View>
  );
}

function TriggerLabels({ largeSeek }: { largeSeek: number }): React.JSX.Element {
  return (
    <View style={diagramStyles.triggerLabelRow}>
      <Text style={diagramStyles.triggerActionText}>Seek −{largeSeek}s</Text>
      <Text style={diagramStyles.triggerActionText}>Seek +{largeSeek}s</Text>
    </View>
  );
}

/** SNES-style diamond: X top, Y left, A right, B bottom */
function SNESDiagram({ xAction }: { xAction: StandardXAction }): React.JSX.Element {
  return (
    <View style={diagramStyles.faceContainer}>
      {/* Top: X */}
      <View style={diagramStyles.diamondRow}>
        <View style={diagramStyles.diamondActionLeft} />
        <View style={[diagramStyles.faceButton, { backgroundColor: '#4a7ccc' }]}>
          <Text style={diagramStyles.faceLabel}>X</Text>
        </View>
        <Text style={diagramStyles.diamondActionRight}>
          {xAction === 'favorite' ? 'Favorite' : 'Repeat'}
        </Text>
      </View>
      {/* Middle: Y left, A right */}
      <View style={diagramStyles.diamondMiddle}>
        <Text style={diagramStyles.diamondActionFarLeft}>Track Info</Text>
        <View style={[diagramStyles.faceButton, { backgroundColor: '#5aa655' }]}>
          <Text style={diagramStyles.faceLabel}>Y</Text>
        </View>
        <View style={diagramStyles.diamondCenter} />
        <View style={[diagramStyles.faceButton, { backgroundColor: '#cc4a4a' }]}>
          <Text style={diagramStyles.faceLabel}>A</Text>
        </View>
        <Text style={diagramStyles.diamondActionFarRight}>Play/Pause</Text>
      </View>
      {/* Bottom: B */}
      <View style={diagramStyles.diamondRow}>
        <View style={diagramStyles.diamondActionLeft} />
        <View style={[diagramStyles.faceButton, { backgroundColor: '#ccb044' }]}>
          <Text style={diagramStyles.faceLabel}>B</Text>
        </View>
        <Text style={diagramStyles.diamondActionRight}>Back</Text>
      </View>
    </View>
  );
}

/** Sega Saturn-style 2×3 grid: top row X Y Z, bottom row A B C */
function SaturnDiagram(): React.JSX.Element {
  return (
    <View style={diagramStyles.faceContainer}>
      {/* Top row: X Y Z */}
      <View style={diagramStyles.saturnRow}>
        <View style={diagramStyles.saturnButtonGroup}>
          <View style={[diagramStyles.saturnButton, { backgroundColor: '#4a7ccc' }]}>
            <Text style={diagramStyles.faceLabel}>X</Text>
          </View>
          <Text style={diagramStyles.saturnAction}>Favorite</Text>
        </View>
        <View style={diagramStyles.saturnButtonGroup}>
          <View style={[diagramStyles.saturnButton, { backgroundColor: '#5aa655' }]}>
            <Text style={diagramStyles.faceLabel}>Y</Text>
          </View>
          <Text style={diagramStyles.saturnAction}>Track Info</Text>
        </View>
        <View style={diagramStyles.saturnButtonGroup}>
          <View style={[diagramStyles.saturnButton, { backgroundColor: '#8855aa' }]}>
            <Text style={diagramStyles.faceLabel}>Z</Text>
          </View>
          <Text style={diagramStyles.saturnAction}>Repeat</Text>
        </View>
      </View>
      {/* Bottom row: A B C */}
      <View style={diagramStyles.saturnRow}>
        <View style={diagramStyles.saturnButtonGroup}>
          <View style={[diagramStyles.saturnButton, { backgroundColor: '#cc4a4a' }]}>
            <Text style={diagramStyles.faceLabel}>A</Text>
          </View>
          <Text style={diagramStyles.saturnAction}>Play/Pause</Text>
        </View>
        <View style={diagramStyles.saturnButtonGroup}>
          <View style={[diagramStyles.saturnButton, { backgroundColor: '#ccb044' }]}>
            <Text style={diagramStyles.faceLabel}>B</Text>
          </View>
          <Text style={diagramStyles.saturnAction}>Back</Text>
        </View>
        <View style={diagramStyles.saturnButtonGroup}>
          <View style={[diagramStyles.saturnButton, { backgroundColor: '#cc7a33' }]}>
            <Text style={diagramStyles.faceLabel}>C</Text>
          </View>
          <Text style={diagramStyles.saturnAction}>Restart</Text>
        </View>
      </View>
    </View>
  );
}

function ControllerDiagram({
  layout,
  largeSeek,
  xAction,
}: {
  layout: ControllerLayout;
  largeSeek: number;
  xAction: StandardXAction;
}): React.JSX.Element {
  return (
    <View style={diagramStyles.container}>
      <Text style={diagramStyles.title}>
        {layout === 'standard' ? 'SNES Layout' : 'Saturn Layout'} — Now Playing Controls
      </Text>
      <TriggerLabels largeSeek={largeSeek} />
      <ShoulderButtons largeSeek={largeSeek} />
      <View style={diagramStyles.bodyArea}>
        {/* D-pad on left */}
        <View style={diagramStyles.dpadContainer}>
          <View style={diagramStyles.dpadRow}>
            <View style={diagramStyles.dpadEmpty} />
            <View style={diagramStyles.dpadButton}>
              <Text style={diagramStyles.dpadLabel}>▲</Text>
            </View>
            <View style={diagramStyles.dpadEmpty} />
          </View>
          <View style={diagramStyles.dpadRow}>
            <View style={diagramStyles.dpadButton}>
              <Text style={diagramStyles.dpadLabel}>◄</Text>
            </View>
            <View style={diagramStyles.dpadCenter} />
            <View style={diagramStyles.dpadButton}>
              <Text style={diagramStyles.dpadLabel}>►</Text>
            </View>
          </View>
          <View style={diagramStyles.dpadRow}>
            <View style={diagramStyles.dpadEmpty} />
            <View style={diagramStyles.dpadButton}>
              <Text style={diagramStyles.dpadLabel}>▼</Text>
            </View>
            <View style={diagramStyles.dpadEmpty} />
          </View>
          <Text style={diagramStyles.dpadAction}>Seek / Skip</Text>
        </View>
        {/* Face buttons on right */}
        {layout === 'standard' ? <SNESDiagram xAction={xAction} /> : <SaturnDiagram />}
      </View>
      {/* Menu buttons */}
      <View style={diagramStyles.menuRow}>
        <View style={diagramStyles.menuButtonGroup}>
          <View style={diagramStyles.menuButton}>
            <Text style={diagramStyles.menuLabel}>Select</Text>
          </View>
          <Text style={diagramStyles.menuAction}>Settings</Text>
        </View>
        <View style={diagramStyles.menuButtonGroup}>
          <View style={diagramStyles.menuButton}>
            <Text style={diagramStyles.menuLabel}>Start</Text>
          </View>
          <Text style={diagramStyles.menuAction}>Now Playing</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Settings Screen ────────────────────────────────────────

export default function SettingsScreen(): React.JSX.Element {
  const {
    controllerLayout,
    standardXAction,
    seekAmount,
    largeSeekAmount,
    showButtonHints,
    setControllerLayout,
    setStandardXAction,
    setSeekAmount,
    setLargeSeekAmount,
    setShowButtonHints,
  } = usePlayerStore();

  const [isScanning, setIsScanning] = useState(false);

  const cycleLayout = useCallback(() => {
    setControllerLayout(controllerLayout === 'standard' ? 'sixbutton' : 'standard');
  }, [controllerLayout, setControllerLayout]);

  const cycleXAction = useCallback(() => {
    setStandardXAction(standardXAction === 'favorite' ? 'repeat' : 'favorite');
  }, [standardXAction, setStandardXAction]);

  const cycleSeek = useCallback(() => {
    const idx = SEEK_OPTIONS.indexOf(seekAmount);
    const next = SEEK_OPTIONS[(idx + 1) % SEEK_OPTIONS.length];
    setSeekAmount(next);
  }, [seekAmount, setSeekAmount]);

  const cycleLargeSeek = useCallback(() => {
    const idx = LARGE_SEEK_OPTIONS.indexOf(largeSeekAmount);
    const next = LARGE_SEEK_OPTIONS[(idx + 1) % LARGE_SEEK_OPTIONS.length];
    setLargeSeekAmount(next);
  }, [largeSeekAmount, setLargeSeekAmount]);

  const toggleHints = useCallback(() => {
    setShowButtonHints(!showButtonHints);
  }, [showButtonHints, setShowButtonHints]);

  const handleRescanLibrary = useCallback(async () => {
    // Request notification permission first
    try {
      await NotificationPermission.requestPermission();
    } catch (error) {
      console.warn('Failed to request notification permission:', error);
    }
    
    setIsScanning(true);
    // Show native notification so Android keeps us alive in background
    MetadataProgressNotification.show(0).catch(() => {});
    try {
      await scanLibrary(progress => {
        if (progress.phase !== 'done') {
          const label = `${progress.phase}: ${progress.currentName ?? ''} (${progress.current}/${progress.total})`;
          MetadataProgressNotification.update(progress.current, 0, label).catch(() => {});
        }
      }, true);
      // Start background metadata parsing with native progress notification
      startMetadataParsing();
      Alert.alert('Scan Complete', 'Library has been rescanned. Metadata is loading in the background.');
    } catch (error) {
      MetadataProgressNotification.dismiss().catch(() => {});
      Alert.alert(
        'Scan Failed',
        error instanceof Error ? error.message : 'Failed to scan library',
      );
    } finally {
      setIsScanning(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Press B to go back</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Library */}
        <Text style={styles.sectionTitle}>Library</Text>

        <FocusablePressable
          onPress={handleRescanLibrary}
          style={styles.optionRow}
          focusedStyle={styles.optionFocused}
          disabled={isScanning}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>Rescan Library</Text>
            <Text style={styles.optionValue}>
              {isScanning ? 'Scanning...' : 'Update music collection'}
            </Text>
          </View>
          <Text style={styles.optionChevron}>↻</Text>
        </FocusablePressable>

        {/* Controller Layout */}
        <Text style={styles.sectionTitle}>Controller</Text>

        <FocusablePressable
          onPress={cycleLayout}
          style={styles.optionRow}
          focusedStyle={styles.optionFocused}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>Controller Layout</Text>
            <Text style={styles.optionValue}>
              {controllerLayout === 'standard'
                ? 'Standard (4-button / SNES)'
                : '6-Button (Sega Saturn)'}
            </Text>
          </View>
          <Text style={styles.optionChevron}>⟳</Text>
        </FocusablePressable>

        {controllerLayout === 'standard' && (
          <FocusablePressable
            onPress={cycleXAction}
            style={styles.optionRow}
            focusedStyle={styles.optionFocused}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>X Button (Now Playing)</Text>
              <Text style={styles.optionValue}>
                {standardXAction === 'favorite' ? 'Favorite' : 'Repeat'}
              </Text>
            </View>
            <Text style={styles.optionChevron}>⟳</Text>
          </FocusablePressable>
        )}

        {/* Controller Diagram */}
        <ControllerDiagram layout={controllerLayout} largeSeek={largeSeekAmount} xAction={standardXAction} />

        {/* Seek Settings */}
        <Text style={styles.sectionTitle}>Seek</Text>

        <FocusablePressable
          onPress={cycleSeek}
          style={styles.optionRow}
          focusedStyle={styles.optionFocused}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>Seek Amount (D-pad)</Text>
            <Text style={styles.optionValue}>{seekAmount} seconds</Text>
          </View>
          <Text style={styles.optionChevron}>⟳</Text>
        </FocusablePressable>

        <FocusablePressable
          onPress={cycleLargeSeek}
          style={styles.optionRow}
          focusedStyle={styles.optionFocused}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>Large Seek Amount (L2/R2)</Text>
            <Text style={styles.optionValue}>{largeSeekAmount} seconds</Text>
          </View>
          <Text style={styles.optionChevron}>⟳</Text>
        </FocusablePressable>

        {/* Display */}
        <Text style={styles.sectionTitle}>Display</Text>

        <FocusablePressable
          onPress={toggleHints}
          style={styles.optionRow}
          focusedStyle={styles.optionFocused}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>Show Button Hints</Text>
            <Text style={styles.optionValue}>
              {showButtonHints ? 'On' : 'Off'}
            </Text>
          </View>
          <Text style={styles.optionChevron}>⟳</Text>
        </FocusablePressable>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#555',
    fontSize: 13,
    marginTop: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionFocused: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: '#4a9eff',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  optionValue: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  optionChevron: {
    color: '#555',
    fontSize: 18,
    marginLeft: 8,
  },
});

// ─── Controller Diagram Styles ──────────────────────────────

const diagramStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  title: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  // Shoulder buttons
  shoulderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  shoulderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shoulderButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shoulderLabel: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '700',
  },
  triggerButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  triggerLabel: {
    color: '#999',
    fontSize: 10,
    fontWeight: '700',
  },
  shoulderAction: {
    color: '#777',
    fontSize: 10,
  },
  triggerLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  triggerActionText: {
    color: '#666',
    fontSize: 10,
  },
  // Body (d-pad + face buttons)
  bodyArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  // D-pad
  dpadContainer: {
    alignItems: 'center',
  },
  dpadRow: {
    flexDirection: 'row',
  },
  dpadButton: {
    width: 30,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadCenter: {
    width: 30,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dpadEmpty: {
    width: 30,
    height: 30,
  },
  dpadLabel: {
    color: '#999',
    fontSize: 12,
  },
  dpadAction: {
    color: '#777',
    fontSize: 10,
    marginTop: 6,
  },
  // Face buttons - SNES diamond
  faceContainer: {
    alignItems: 'center',
  },
  diamondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  diamondCenter: {
    width: 16,
  },
  diamondActionLeft: {
    width: 60,
  },
  diamondActionRight: {
    color: '#777',
    fontSize: 10,
    width: 70,
    marginLeft: 6,
  },
  diamondActionFarLeft: {
    color: '#777',
    fontSize: 10,
    width: 60,
    textAlign: 'right',
    marginRight: 6,
  },
  diamondActionFarRight: {
    color: '#777',
    fontSize: 10,
    width: 70,
    marginLeft: 6,
  },
  faceButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Saturn 2×3 grid
  saturnRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 3,
  },
  saturnButtonGroup: {
    alignItems: 'center',
    width: 64,
  },
  saturnButton: {
    width: 36,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saturnAction: {
    color: '#777',
    fontSize: 9,
    marginTop: 3,
  },
  // Menu buttons
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  menuButtonGroup: {
    alignItems: 'center',
  },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  menuLabel: {
    color: '#999',
    fontSize: 10,
    fontWeight: '600',
  },
  menuAction: {
    color: '#666',
    fontSize: 9,
    marginTop: 3,
  },
});
