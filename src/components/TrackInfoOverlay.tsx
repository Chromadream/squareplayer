import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { stripAudioExtension } from '../utils/audio';
import { useThemedStyles } from '../theme/ThemeProvider';

function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function formatSampleRate(hz: number): string {
  if (!hz || hz <= 0) return '—';
  return hz >= 1000
    ? `${(hz / 1000).toFixed(1)} kHz`
    : `${hz} Hz`;
}

function InfoRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function TrackInfoOverlay(): React.JSX.Element | null {
  const inspectedTrack = usePlayerStore(s => s.inspectedTrack);
  const styles = useThemedStyles(createStyles);

  if (!inspectedTrack) return null;

  const title = inspectedTrack.title
    ?? stripAudioExtension(inspectedTrack.fileName);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Track Info</Text>
        <Text style={styles.dismiss}>Press A or B to dismiss</Text>

        <View style={styles.divider} />

        <InfoRow label="Title" value={title} styles={styles} />
        <InfoRow
          label="Artist"
          value={inspectedTrack.artist ?? '—'}
          styles={styles}
        />
        {inspectedTrack.albumArtist && (
          <InfoRow
            label="Album Artist"
            value={inspectedTrack.albumArtist}
            styles={styles}
          />
        )}
        <InfoRow
          label="Album"
          value={inspectedTrack.album ?? '—'}
          styles={styles}
        />
        {inspectedTrack.trackNumber > 0 && (
          <InfoRow
            label="Track #"
            value={inspectedTrack.trackNumber.toString()}
            styles={styles}
          />
        )}
        {inspectedTrack.discNumber > 0 && (
          <InfoRow
            label="Disc #"
            value={inspectedTrack.discNumber.toString()}
            styles={styles}
          />
        )}
        <InfoRow
          label="Duration"
          value={formatDuration(inspectedTrack.duration)}
          styles={styles}
        />

        <View style={styles.divider} />

        {inspectedTrack.bitrate > 0 && (
          <InfoRow
            label="Bitrate"
            value={`${inspectedTrack.bitrate} kbps`}
            styles={styles}
          />
        )}
        {inspectedTrack.sampleRate > 0 && (
          <InfoRow
            label="Sample Rate"
            value={formatSampleRate(inspectedTrack.sampleRate)}
            styles={styles}
          />
        )}
        {inspectedTrack.bitDepth > 0 && (
          <InfoRow
            label="Bit Depth"
            value={`${inspectedTrack.bitDepth}-bit`}
            styles={styles}
          />
        )}
        {inspectedTrack.fileSize > 0 && (
          <InfoRow
            label="File Size"
            value={formatFileSize(inspectedTrack.fileSize)}
            styles={styles}
          />
        )}

        <View style={styles.divider} />

        <InfoRow label="File Name" value={inspectedTrack.fileName} styles={styles} />
        {inspectedTrack.isAlbumExperience === 1 && (
          <View style={styles.albumExpBadge}>
            <Text style={styles.albumExpBadgeText}>Album Experience</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (c: import('../theme/colors').ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.overlayHeavy,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 420,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: c.border,
  },
  cardTitle: {
    color: c.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  dismiss: {
    color: c.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderSubtle,
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  infoLabel: {
    color: c.textSecondary,
    fontSize: 13,
    width: 100,
    fontWeight: '500',
  },
  infoValue: {
    color: c.textPrimary,
    fontSize: 13,
    flex: 1,
  },
  albumExpBadge: {
    backgroundColor: c.accentBadge,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  albumExpBadgeText: {
    color: c.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
