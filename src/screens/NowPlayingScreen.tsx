import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useProgress, useActiveTrack } from 'react-native-track-player';
import { usePlayerStore } from '../store/playerStore';
import { getConfig } from '../services/database';
import { encodeOptionalUri } from '../utils/uri';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatBitrate(track: ReturnType<typeof usePlayerStore.getState>['currentTrack']): string {
  if (!track) return '';
  const parts: string[] = [];

  if (track.bitrate > 0) {
    parts.push(`${track.bitrate} kbps`);
  }

  if (track.sampleRate > 0) {
    const sr = track.sampleRate >= 1000
      ? `${(track.sampleRate / 1000).toFixed(1)} kHz`
      : `${track.sampleRate} Hz`;
    parts.push(sr);
  }

  if (track.bitDepth > 0) {
    parts.push(`${track.bitDepth}-bit`);
  }

  return parts.join(' · ');
}

export default function NowPlayingScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const progress = useProgress(200);
  const activeTrack = useActiveTrack();
  const { currentTrack, isAlbumExperience, queueLength, currentQueueIndex } =
    usePlayerStore();

  const artworkSize = Math.min(width, height);
  const treeRootUri = getConfig('library_uri');
  const artworkUri = encodeOptionalUri(currentTrack?.coverArtUri, treeRootUri) ?? activeTrack?.artwork;

  const title =
    currentTrack?.title ??
    currentTrack?.fileName?.replace(/\.flac$/i, '') ??
    activeTrack?.title ??
    'No Track';

  const bitrateInfo = formatBitrate(currentTrack);

  return (
    <View style={styles.container}>
      {/* Cover Art - full bleed */}
      <View style={[styles.artworkContainer, { width: artworkSize, height: artworkSize }]}>
        {artworkUri ? (
          <Image
            source={{ uri: artworkUri }}
            style={[styles.artwork, { width: artworkSize, height: artworkSize }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.noArtwork, { width: artworkSize, height: artworkSize }]}>
            <Text style={styles.noArtworkText}>♪</Text>
          </View>
        )}
      </View>

      {/* Bottom overlay */}
      <View style={styles.overlay}>
        {/* Album Experience badge */}
        {isAlbumExperience && (
          <View style={styles.albumExpBadgeRow}>
            <View style={styles.albumExpBadge}>
              <Text style={styles.albumExpBadgeText}>Album Experience</Text>
            </View>
            <Text style={styles.queueIndicator}>
              Track {currentQueueIndex + 1} / {queueLength}
            </Text>
          </View>
        )}

        {/* Title */}
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>

        {/* Bitrate info */}
        {bitrateInfo ? (
          <Text style={styles.bitrateText}>{bitrateInfo}</Text>
        ) : null}

        {/* Time progress */}
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {formatTime(progress.position)}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    progress.duration > 0
                      ? `${(progress.position / progress.duration) * 100}%`
                      : '0%',
                },
              ]}
            />
          </View>
          <Text style={styles.timeText}>
            {formatTime(progress.duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  artwork: {
    flex: 1,
  },
  noArtwork: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noArtworkText: {
    fontSize: 120,
    color: '#333',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  albumExpBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  albumExpBadge: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 10,
  },
  albumExpBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  queueIndicator: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  bitrateText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
});
