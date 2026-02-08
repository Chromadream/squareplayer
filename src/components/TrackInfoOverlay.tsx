import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePlayerStore } from '../store/playerStore';

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

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function TrackInfoOverlay(): React.JSX.Element | null {
  const inspectedTrack = usePlayerStore(s => s.inspectedTrack);

  if (!inspectedTrack) return null;

  const title = inspectedTrack.title
    ?? inspectedTrack.fileName.replace(/\.flac$/i, '');

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Track Info</Text>
        <Text style={styles.dismiss}>Press A or B to dismiss</Text>

        <View style={styles.divider} />

        <InfoRow label="Title" value={title} />
        <InfoRow
          label="Artist"
          value={inspectedTrack.artist ?? '—'}
        />
        {inspectedTrack.albumArtist && (
          <InfoRow
            label="Album Artist"
            value={inspectedTrack.albumArtist}
          />
        )}
        <InfoRow
          label="Album"
          value={inspectedTrack.album ?? '—'}
        />
        {inspectedTrack.trackNumber > 0 && (
          <InfoRow
            label="Track #"
            value={inspectedTrack.trackNumber.toString()}
          />
        )}
        <InfoRow
          label="Duration"
          value={formatDuration(inspectedTrack.duration)}
        />

        <View style={styles.divider} />

        {inspectedTrack.bitrate > 0 && (
          <InfoRow
            label="Bitrate"
            value={`${inspectedTrack.bitrate} kbps`}
          />
        )}
        {inspectedTrack.sampleRate > 0 && (
          <InfoRow
            label="Sample Rate"
            value={formatSampleRate(inspectedTrack.sampleRate)}
          />
        )}
        {inspectedTrack.bitDepth > 0 && (
          <InfoRow
            label="Bit Depth"
            value={`${inspectedTrack.bitDepth}-bit`}
          />
        )}
        {inspectedTrack.fileSize > 0 && (
          <InfoRow
            label="File Size"
            value={formatFileSize(inspectedTrack.fileSize)}
          />
        )}

        <View style={styles.divider} />

        <InfoRow label="File Name" value={inspectedTrack.fileName} />
        {inspectedTrack.isAlbumExperience === 1 && (
          <View style={styles.albumExpBadge}>
            <Text style={styles.albumExpBadgeText}>Album Experience</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 420,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#333',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  dismiss: {
    color: '#555',
    fontSize: 12,
    marginBottom: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#333',
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  infoLabel: {
    color: '#777',
    fontSize: 13,
    width: 100,
    fontWeight: '500',
  },
  infoValue: {
    color: '#ddd',
    fontSize: 13,
    flex: 1,
  },
  albumExpBadge: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  albumExpBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
