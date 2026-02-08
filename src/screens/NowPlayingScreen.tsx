import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ImageBackground,
  LayoutChangeEvent,
} from 'react-native';
import { useProgress, useActiveTrack } from 'react-native-track-player';
import { usePlayerStore } from '../store/playerStore';
import { stripAudioExtension, getFormatLabel } from '../utils/audio';

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
  const progress = useProgress(200);
  const activeTrack = useActiveTrack();
  const { currentTrack, isAlbumExperience, queueLength, currentQueueIndex } = usePlayerStore();

  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  const artworkUri = currentTrack?.coverArtUri ?? activeTrack?.artwork;

  const title =
    currentTrack?.title ??
    (currentTrack?.fileName ? stripAudioExtension(currentTrack.fileName) : null) ??
    activeTrack?.title ??
    'No Track';

  const artist = currentTrack?.artist ?? '';

  const bitrateInfo = formatBitrate(currentTrack);

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerLayout({ width, height });
  }, []);

  useEffect(() => {
    if (artworkUri) {
      Image.getSize(
        artworkUri,
        (w, h) => setImageNaturalSize({ width: w, height: h }),
        () => setImageNaturalSize({ width: 0, height: 0 }),
      );
    } else {
      setImageNaturalSize({ width: 0, height: 0 });
    }
  }, [artworkUri]);

  const artRect = useMemo(() => {
    const cw = containerLayout.width;
    const ch = containerLayout.height;
    const iw = imageNaturalSize.width;
    const ih = imageNaturalSize.height;
    if (!cw || !ch || !iw || !ih) return null;

    const imageAspect = iw / ih;
    const containerAspect = cw / ch;
    let rw: number, rh: number, ox: number, oy: number;

    if (imageAspect > containerAspect) {
      rw = cw;
      rh = cw / imageAspect;
      ox = 0;
      oy = (ch - rh) / 2;
    } else {
      rh = ch;
      rw = ch * imageAspect;
      ox = (cw - rw) / 2;
      oy = 0;
    }
    return { left: ox, top: oy, width: rw, height: rh };
  }, [containerLayout, imageNaturalSize]);

  const overlayPosition = artRect
    ? {
        left: artRect.left + 24,
        bottom: containerLayout.height - (artRect.top + artRect.height) + 32,
        maxWidth: artRect.width - 48,
      }
    : {
        left: 24,
        bottom: 32,
      };

  return (
    <View style={styles.container}>
      {/* Blurred background */}
      {artworkUri ? (
        <ImageBackground
          source={{ uri: artworkUri }}
          style={styles.blurredBackground}
          blurRadius={50}
          resizeMode="cover"
        />
      ) : null}

      {/* Cover Art - centered, full screen */}
      <View style={styles.artworkContainer} onLayout={handleContainerLayout}>
        {artworkUri ? (
          <Image
            source={{ uri: artworkUri }}
            style={styles.artwork}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.noArtwork}>
            <Text style={styles.noArtworkText}>♪</Text>
          </View>
        )}
      </View>

      {/* Info overlay */}
      <View style={[styles.infoOverlayAnchor, overlayPosition]}>
        <View style={styles.infoOverlay}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {title}
          </Text>

          {/* Artist */}
          {artist ? (
            <Text style={styles.artistText} numberOfLines={1} ellipsizeMode="tail">
              {artist}
            </Text>
          ) : null}

          {/* Bitrate info */}
          {bitrateInfo ? (
            <Text style={styles.bitrateText}>
              {currentTrack?.fileName ? getFormatLabel(currentTrack.fileName) : ''}{' '}
              {bitrateInfo}
            </Text>
          ) : null}

          {/* Track count (album experience only) */}
          {isAlbumExperience && queueLength > 0 ? (
            <Text style={styles.timeText}>
              Track {currentQueueIndex + 1} / {queueLength}
            </Text>
          ) : null}

          {/* Time */}
          <Text style={styles.timeText}>
            {formatTime(progress.position)} / {formatTime(progress.duration)}
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
  },
  blurredBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  artworkContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  noArtwork: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noArtworkText: {
    fontSize: 120,
    color: '#333',
  },
  infoOverlayAnchor: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
  infoOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    alignSelf: 'flex-start',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  artistText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bitrateText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
