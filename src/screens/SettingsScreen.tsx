import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import type { ControllerLayout, StandardXAction, ThemeMode } from '../store/playerStore';
import FocusablePressable from '../components/FocusablePressable';
import { useThemedStyles } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/colors';
import { scanLibrary } from '../services/scanner';
import { startMetadataParsing } from '../services/metadataParser';
import MetadataProgressNotification from '../native/MetadataProgress';
import NotificationPermission from '../native/NotificationPermission';

const SEEK_OPTIONS = [5, 10, 15, 30];
const LARGE_SEEK_OPTIONS = [15, 30, 60];

// ─── Controller Diagram Components ──────────────────────────

function ShoulderButtons({ largeSeek, ds }: { largeSeek: number; ds: ReturnType<typeof createDiagramStyles> }): React.JSX.Element {
  return (
    <View style={ds.shoulderRow}>
      <View style={ds.shoulderGroup}>
        <View style={ds.triggerButton}>
          <Text style={ds.triggerLabel}>L2</Text>
        </View>
        <View style={ds.shoulderButton}>
          <Text style={ds.shoulderLabel}>L1</Text>
        </View>
        <Text style={ds.shoulderAction}>Prev Track</Text>
      </View>
      <View style={ds.shoulderGroup}>
        <Text style={ds.shoulderAction}>Next Track</Text>
        <View style={ds.shoulderButton}>
          <Text style={ds.shoulderLabel}>R1</Text>
        </View>
        <View style={ds.triggerButton}>
          <Text style={ds.triggerLabel}>R2</Text>
        </View>
      </View>
    </View>
  );
}

function TriggerLabels({ largeSeek, ds }: { largeSeek: number; ds: ReturnType<typeof createDiagramStyles> }): React.JSX.Element {
  return (
    <View style={ds.triggerLabelRow}>
      <Text style={ds.triggerActionText}>Seek −{largeSeek}s</Text>
      <Text style={ds.triggerActionText}>Seek +{largeSeek}s</Text>
    </View>
  );
}

/** SNES-style diamond: X top, Y left, A right, B bottom */
function SNESDiagram({ xAction, ds }: { xAction: StandardXAction; ds: ReturnType<typeof createDiagramStyles> }): React.JSX.Element {
  return (
    <View style={ds.faceContainer}>
      {/* Top: X */}
      <View style={ds.diamondRow}>
        <View style={ds.diamondSideLabel} />
        <View style={ds.diamondButtonArea}>
          <View style={ds.faceButton}>
            <Text style={ds.faceLabel}>X</Text>
          </View>
        </View>
        <View style={ds.diamondSideLabel}>
          <Text style={ds.diamondLabelText}>
            {xAction === 'favorite' ? 'Favorite' : 'Repeat'}
          </Text>
        </View>
      </View>
      {/* Middle: Y left, A right */}
      <View style={ds.diamondRow}>
        <View style={ds.diamondSideLabel}>
          <Text style={[ds.diamondLabelText, ds.diamondLabelTextRight]}>Track Info</Text>
        </View>
        <View style={ds.diamondButtonArea}>
          <View style={ds.diamondMiddleButtons}>
            <View style={ds.faceButton}>
              <Text style={ds.faceLabel}>Y</Text>
            </View>
            <View style={ds.diamondGap} />
            <View style={ds.faceButton}>
              <Text style={ds.faceLabel}>A</Text>
            </View>
          </View>
        </View>
        <View style={ds.diamondSideLabel}>
          <Text style={ds.diamondLabelText}>Play/Pause</Text>
        </View>
      </View>
      {/* Bottom: B */}
      <View style={ds.diamondRow}>
        <View style={ds.diamondSideLabel} />
        <View style={ds.diamondButtonArea}>
          <View style={ds.faceButton}>
            <Text style={ds.faceLabel}>B</Text>
          </View>
        </View>
        <View style={ds.diamondSideLabel}>
          <Text style={ds.diamondLabelText}>Back</Text>
        </View>
      </View>
    </View>
  );
}

/** Sega Saturn-style 2×3 grid: top row X Y Z, bottom row A B C */
function SaturnDiagram({ ds }: { ds: ReturnType<typeof createDiagramStyles> }): React.JSX.Element {
  return (
    <View style={ds.faceContainer}>
      {/* Top row: X Y Z */}
      <View style={ds.saturnRow}>
        <View style={ds.saturnButtonGroup}>
          <View style={ds.saturnButton}>
            <Text style={ds.faceLabel}>X</Text>
          </View>
          <Text style={ds.saturnAction}>Favorite</Text>
        </View>
        <View style={ds.saturnButtonGroup}>
          <View style={ds.saturnButton}>
            <Text style={ds.faceLabel}>Y</Text>
          </View>
          <Text style={ds.saturnAction}>Track Info</Text>
        </View>
        <View style={ds.saturnButtonGroup}>
          <View style={ds.saturnButton}>
            <Text style={ds.faceLabel}>Z</Text>
          </View>
          <Text style={ds.saturnAction}>Repeat</Text>
        </View>
      </View>
      {/* Bottom row: A B C */}
      <View style={ds.saturnRow}>
        <View style={ds.saturnButtonGroup}>
          <View style={ds.saturnButton}>
            <Text style={ds.faceLabel}>A</Text>
          </View>
          <Text style={ds.saturnAction}>Play/Pause</Text>
        </View>
        <View style={ds.saturnButtonGroup}>
          <View style={ds.saturnButton}>
            <Text style={ds.faceLabel}>B</Text>
          </View>
          <Text style={ds.saturnAction}>Back</Text>
        </View>
        <View style={ds.saturnButtonGroup}>
          <View style={ds.saturnButton}>
            <Text style={ds.faceLabel}>C</Text>
          </View>
          <Text style={ds.saturnAction}>Restart</Text>
        </View>
      </View>
    </View>
  );
}

function ControllerDiagram({
  layout,
  largeSeek,
  xAction,
  ds,
}: {
  layout: ControllerLayout;
  largeSeek: number;
  xAction: StandardXAction;
  ds: ReturnType<typeof createDiagramStyles>;
}): React.JSX.Element {
  return (
    <View style={ds.container}>
      <Text style={ds.title}>
        {layout === 'standard' ? 'Standard Layout' : '6 Button Layout'} — Now Playing Controls
      </Text>
      <TriggerLabels largeSeek={largeSeek} ds={ds} />
      <ShoulderButtons largeSeek={largeSeek} ds={ds} />
      <View style={ds.bodyArea}>
        {/* D-pad on left */}
        <View style={ds.dpadContainer}>
          <View style={ds.dpadRow}>
            <View style={ds.dpadEmpty} />
            <View style={ds.dpadButton}>
              <Text style={ds.dpadLabel}>▲</Text>
            </View>
            <View style={ds.dpadEmpty} />
          </View>
          <View style={ds.dpadRow}>
            <View style={ds.dpadButton}>
              <Text style={ds.dpadLabel}>◄</Text>
            </View>
            <View style={ds.dpadCenter} />
            <View style={ds.dpadButton}>
              <Text style={ds.dpadLabel}>►</Text>
            </View>
          </View>
          <View style={ds.dpadRow}>
            <View style={ds.dpadEmpty} />
            <View style={ds.dpadButton}>
              <Text style={ds.dpadLabel}>▼</Text>
            </View>
            <View style={ds.dpadEmpty} />
          </View>
          <Text style={ds.dpadAction}>Seek / Skip</Text>
        </View>
        {/* Face buttons on right */}
        {layout === 'standard' ? <SNESDiagram xAction={xAction} ds={ds} /> : <SaturnDiagram ds={ds} />}
      </View>
      {/* Menu buttons */}
      <View style={ds.menuRow}>
        <View style={ds.menuButtonGroup}>
          <View style={ds.menuButton}>
            <Text style={ds.menuLabel}>Select</Text>
          </View>
          <Text style={ds.menuAction}>Settings</Text>
        </View>
        <View style={ds.menuButtonGroup}>
          <View style={ds.menuButton}>
            <Text style={ds.menuLabel}>Start</Text>
          </View>
          <Text style={ds.menuAction}>Now Playing</Text>
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
    themeMode,
    setControllerLayout,
    setStandardXAction,
    setSeekAmount,
    setLargeSeekAmount,
    setShowButtonHints,
    setThemeMode,
  } = usePlayerStore();

  const styles = useThemedStyles(createStyles);
  const diagramStyles = useThemedStyles(createDiagramStyles);

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

  const cycleTheme = useCallback(() => {
    const modes: ThemeMode[] = ['system', 'dark', 'light'];
    const idx = modes.indexOf(themeMode);
    setThemeMode(modes[(idx + 1) % modes.length]);
  }, [themeMode, setThemeMode]);

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
          autoFocus
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
                ? 'Standard'
                : '6-Button'}
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
        <ControllerDiagram layout={controllerLayout} largeSeek={largeSeekAmount} xAction={standardXAction} ds={diagramStyles} />

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
          onPress={cycleTheme}
          style={styles.optionRow}
          focusedStyle={styles.optionFocused}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>Theme Mode</Text>
            <Text style={styles.optionValue}>
              {themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light'}
            </Text>
          </View>
          <Text style={styles.optionChevron}>⟳</Text>
        </FocusablePressable>

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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerTitle: {
    color: c.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: c.textTertiary,
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
    backgroundColor: c.surfaceDim,
  },
  optionFocused: {
    backgroundColor: c.overlayLight,
    borderWidth: 2,
    borderColor: c.accentPrimary,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  optionValue: {
    color: c.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  optionChevron: {
    color: c.textMuted,
    fontSize: 18,
    marginLeft: 8,
  },
});

// ─── Controller Diagram Styles ──────────────────────────────

const createDiagramStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: c.surfaceDim,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  title: {
    color: c.diagramAction,
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
    backgroundColor: c.diagramChrome,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shoulderLabel: {
    color: c.diagramLabel,
    fontSize: 11,
    fontWeight: '700',
  },
  triggerButton: {
    backgroundColor: c.diagramChromeDim,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  triggerLabel: {
    color: c.diagramLabelDim,
    fontSize: 10,
    fontWeight: '700',
  },
  shoulderAction: {
    color: c.diagramAction,
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
    color: c.diagramAction,
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
    backgroundColor: c.diagramChrome,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadCenter: {
    width: 30,
    height: 30,
    backgroundColor: c.diagramChromeDim,
  },
  dpadEmpty: {
    width: 30,
    height: 30,
  },
  dpadLabel: {
    color: c.diagramLabelDim,
    fontSize: 12,
  },
  dpadAction: {
    color: c.diagramAction,
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
    marginVertical: 1,
  },
  diamondButtonArea: {
    width: 84, // 34 (Y) + 16 (gap) + 34 (A)
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondMiddleButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diamondGap: {
    width: 16,
  },
  diamondSideLabel: {
    width: 70,
    paddingHorizontal: 6,
  },
  diamondLabelText: {
    color: c.diagramAction,
    fontSize: 10,
  },
  diamondLabelTextRight: {
    textAlign: 'right',
  },
  faceButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.diagramChrome,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceLabel: {
    color: c.textPrimary,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.diagramChrome,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saturnAction: {
    color: c.diagramAction,
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
    backgroundColor: c.diagramChromeDim,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  menuLabel: {
    color: c.diagramLabelDim,
    fontSize: 10,
    fontWeight: '600',
  },
  menuAction: {
    color: c.diagramAction,
    fontSize: 9,
    marginTop: 3,
  },
});
