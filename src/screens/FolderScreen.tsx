import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { type TrackRow, getConfig } from '../services/database';
import FocusablePressable from '../components/FocusablePressable';
import { encodeOptionalUri } from '../utils/uri';

export default function FolderScreen(): React.JSX.Element {
  const { currentFolder, currentFolderTracks, playTrack, goBack, pendingScrollAction, clearPageScroll } =
    usePlayerStore();
  const flatListRef = useRef<FlatList>(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  const isAlbumExperience = currentFolder?.isAlbumExperience === 1;

  // Page scroll via store action (L1/R1)
  useEffect(() => {
    if (!pendingScrollAction || currentFolderTracks.length === 0) return;
    const pageSize = 10;
    let nextIndex = scrollIndex;
    if (pendingScrollAction === 'pageUp') {
      nextIndex = Math.max(0, scrollIndex - pageSize);
    } else {
      nextIndex = Math.min(currentFolderTracks.length - 1, scrollIndex + pageSize);
    }
    setScrollIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true, viewPosition: 0 });
    clearPageScroll();
  }, [pendingScrollAction, currentFolderTracks.length, scrollIndex, clearPageScroll]);

  const handlePlayTrack = useCallback(
    (track: TrackRow) => {
      if (isAlbumExperience) {
        // Album Experience: pass all folder tracks so queue gets filled
        playTrack(track, currentFolderTracks);
      } else {
        // Regular folder: single track repeat
        playTrack(track);
      }
    },
    [isAlbumExperience, currentFolderTracks, playTrack],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: TrackRow; index: number }) => {
      const title = item.title ?? item.fileName.replace(/\.flac$/i, '');
      const subtitle = item.artist ?? '';

      return (
        <FocusablePressable
          onPress={() => handlePlayTrack(item)}
          style={styles.item}
          focusedStyle={styles.itemFocused}
          focusData={item}
        >
          {isAlbumExperience && (
            <Text style={styles.trackNumber}>{index + 1}</Text>
          )}
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {item.duration > 0 && (
            <Text style={styles.duration}>
              {formatDuration(item.duration)}
            </Text>
          )}
        </FocusablePressable>
      );
    },
    [handlePlayTrack, isAlbumExperience],
  );

  const keyExtractor = useCallback(
    (item: TrackRow) => `track-${item.id}`,
    [],
  );

  return (
    <View style={styles.container}>
      {/* Header with cover art */}
      <View style={styles.header}>
        {currentFolder?.coverArtUri && (
          <Image
            source={{ uri: encodeOptionalUri(currentFolder.coverArtUri, getConfig('library_uri'))! }}
            style={styles.headerArt}
          />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {currentFolder?.name ?? 'Folder'}
          </Text>
          {isAlbumExperience && (
            <View style={styles.albumExpBadge}>
              <Text style={styles.albumExpBadgeText}>Album Experience</Text>
            </View>
          )}
          <Text style={styles.headerSubtitle}>
            {currentFolderTracks.length} track
            {currentFolderTracks.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Track list */}
      <FlatList
        ref={flatListRef}
        data={currentFolderTracks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        initialNumToRender={20}
      />
    </View>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
    alignItems: 'center',
  },
  headerArt: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 16,
    backgroundColor: '#1a1a1a',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  albumExpBadge: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  albumExpBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: '#777',
    fontSize: 13,
    marginTop: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  itemFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: '#4a9eff',
  },
  trackNumber: {
    color: '#555',
    fontSize: 14,
    width: 30,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  itemSubtitle: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
  },
  duration: {
    color: '#555',
    fontSize: 13,
    marginLeft: 12,
    fontVariant: ['tabular-nums'],
  },
});
