import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { type TrackRow, getConfig } from '../services/database';
import { encodeContentUri } from '../utils/uri';
import FocusablePressable from '../components/FocusablePressable';
import { stripAudioExtension } from '../utils/audio';

type FolderListItem =
  | { type: 'disc-header'; discNumber: number; key: string }
  | { type: 'track'; data: TrackRow; trackIndexInDisc: number; key: string };

export default function FolderScreen(): React.JSX.Element {
  const { currentFolder, currentFolderTracks, playTrack, goBack, pendingScrollAction, clearPageScroll } =
    usePlayerStore();
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const flatListRef = useRef<FlatList>(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  const isAlbumExperience = currentFolder?.isAlbumExperience === 1;
  const isFavoritesFolder = currentFolder?.id === -1 && currentFolder?.name === 'Favorites';

  // Determine if multi-disc: has more than one distinct discNumber > 0
  const isMultiDisc = useMemo(() => {
    const discNumbers = new Set(currentFolderTracks.map(t => t.discNumber));
    // Multi-disc if there are 2+ distinct disc numbers, or exactly one disc > 1
    return discNumbers.size > 1 || (discNumbers.size === 1 && !discNumbers.has(0) && Math.max(...discNumbers) > 1);
  }, [currentFolderTracks]);

  // Build flat list items with disc headers inserted for multi-disc folders
  const listItems: FolderListItem[] = useMemo(() => {
    if (!isMultiDisc) {
      return currentFolderTracks.map((track, idx) => ({
        type: 'track' as const,
        data: track,
        trackIndexInDisc: idx,
        key: `track-${track.id}`,
      }));
    }

    const items: FolderListItem[] = [];
    let lastDisc = -1;
    let discTrackIdx = 0;
    for (const track of currentFolderTracks) {
      if (track.discNumber !== lastDisc) {
        lastDisc = track.discNumber;
        discTrackIdx = 0;
        items.push({
          type: 'disc-header',
          discNumber: track.discNumber,
          key: `disc-${track.discNumber}`,
        });
      }
      items.push({
        type: 'track',
        data: track,
        trackIndexInDisc: discTrackIdx,
        key: `track-${track.id}`,
      });
      discTrackIdx++;
    }
    return items;
  }, [currentFolderTracks, isMultiDisc]);

  // Index of the now-playing track in the list
  const nowPlayingIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return listItems.findIndex(
      item => item.type === 'track' && item.data.id === currentTrack.id,
    );
  }, [currentTrack, listItems]);

  // The item that should receive autoFocus: now-playing track if any, otherwise first track
  const autoFocusIndex = nowPlayingIndex >= 0
    ? nowPlayingIndex
    : listItems[0]?.type === 'disc-header' ? 1 : 0;

  // Scroll to the now-playing track when the screen mounts
  useEffect(() => {
    if (autoFocusIndex > 0 && listItems.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: autoFocusIndex,
          animated: false,
          viewPosition: 0.3,
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocusIndex, listItems.length]);

  // Page scroll via store action (L1/R1)
  useEffect(() => {
    if (!pendingScrollAction || listItems.length === 0) return;
    const pageSize = 10;
    let nextIndex = scrollIndex;
    if (pendingScrollAction === 'pageUp') {
      nextIndex = Math.max(0, scrollIndex - pageSize);
    } else {
      nextIndex = Math.min(listItems.length - 1, scrollIndex + pageSize);
    }
    setScrollIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true, viewPosition: 0 });
    clearPageScroll();
  }, [pendingScrollAction, listItems.length, scrollIndex, clearPageScroll]);

  const handlePlayTrack = useCallback(
    (track: TrackRow) => {
      console.log('[FolderScreen] handlePlayTrack called');
      console.log('[FolderScreen] Track:', track.fileName, 'ID:', track.id);
      console.log('[FolderScreen] isAlbumExperience:', track.isAlbumExperience);
      console.log('[FolderScreen] currentFolderTracks length:', currentFolderTracks.length);
      console.log('[FolderScreen] First 3 tracks:', currentFolderTracks.slice(0, 3).map(t => ({ id: t.id, fileName: t.fileName })));
      // Always pass folder tracks so d-pad navigation works in all modes
      playTrack(track, currentFolderTracks);
    },
    [currentFolderTracks, playTrack],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FolderListItem; index: number }) => {
      if (item.type === 'disc-header') {
        return (
          <View style={styles.discHeader}>
            <View style={styles.discHeaderLine} />
            <Text style={styles.discHeaderText}>
              Disc {item.discNumber || '?'}
            </Text>
            <View style={styles.discHeaderLine} />
          </View>
        );
      }

      const track = item.data;
      const title = track.title ?? stripAudioExtension(track.fileName);
      const subtitle = track.artist ?? '';
      const isNowPlaying = currentTrack?.id === track.id;

      return (
        <FocusablePressable
          onPress={() => handlePlayTrack(track)}
          style={styles.item}
          focusedStyle={styles.itemFocused}
          focusData={track}
          autoFocus={index === autoFocusIndex}
          isNowPlaying={isNowPlaying}
        >
          {isAlbumExperience && (
            <Text style={styles.trackNumber}>
              {track.trackNumber > 0 ? track.trackNumber : item.trackIndexInDisc + 1}
            </Text>
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
          {track.duration > 0 && (
            <Text style={styles.duration}>
              {formatDuration(track.duration)}
            </Text>
          )}
          {!isFavoritesFolder && track.isFavorite === 1 && (
            <Text style={styles.favoriteIcon}>⭐</Text>
          )}
        </FocusablePressable>
      );
    },
    [handlePlayTrack, isAlbumExperience, isFavoritesFolder, listItems, currentTrack],
  );

  const keyExtractor = useCallback(
    (item: FolderListItem) => item.key,
    [],
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
      flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.3 });
      }, 100);
    },
    [],
  );

  return (
    <View style={styles.container}>
      {/* Header with cover art */}
      <View style={styles.header}>
        {isFavoritesFolder ? (
          <View style={styles.favoritesHeaderIcon}>
            <Text style={styles.favoritesHeaderIconText}>⭐</Text>
          </View>
        ) : currentFolder?.coverArtUri ? (
          <Image
            source={{ uri: encodeContentUri(currentFolder.coverArtUri, getConfig('library_uri')) }}
            style={styles.headerArt}
          />
        ) : null}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {currentFolder?.name ?? 'Folder'}
          </Text>
          {!isFavoritesFolder && isAlbumExperience && (
            <View style={styles.albumExpBadge}>
              <Text style={styles.albumExpBadgeText}>Album Experience</Text>
            </View>
          )}
          <Text style={styles.headerSubtitle}>
            {currentFolderTracks.length} track
            {currentFolderTracks.length !== 1 ? 's' : ''}
            {isMultiDisc
              ? ` · ${new Set(currentFolderTracks.map(t => t.discNumber)).size} discs`
              : ''}
          </Text>
        </View>
      </View>

      {/* Track list */}
      <FlatList
        ref={flatListRef}
        data={listItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        initialNumToRender={20}
        onScrollToIndexFailed={onScrollToIndexFailed}
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
  discHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    marginHorizontal: 8,
  },
  discHeaderLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#333',
  },
  discHeaderText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: 12,
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
  favoriteIcon: {
    fontSize: 14,
    marginLeft: 8,
  },
  favoritesHeaderIcon: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 16,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoritesHeaderIconText: {
    fontSize: 36,
  },
});
