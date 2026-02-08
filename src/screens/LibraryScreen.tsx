import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { type FolderRow, type TrackRow } from '../services/database';
import FocusablePressable from '../components/FocusablePressable';
import { stripAudioExtension } from '../utils/audio';
import { useThemedStyles } from '../theme/ThemeProvider';

type LibraryItem =
  | { type: 'folder'; data: FolderRow }
  | { type: 'track'; data: TrackRow };

export default function LibraryScreen(): React.JSX.Element {
  const {
    folders,
    rootTracks,
    favoriteTracks,
    isScanning,
    scanProgress,
    metadataProgress,
    openFolder,
    playTrack,
    pendingScrollAction,
    clearPageScroll,
  } = usePlayerStore();
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const styles = useThemedStyles(createStyles);

  const flatListRef = useRef<FlatList>(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  // Build combined list: favorites folder first, then real folders, then root tracks
  const favoritesFolderItem: LibraryItem = {
    type: 'folder' as const,
    data: {
      id: -1,
      uri: '__favorites__',
      name: 'Favorites',
      isAlbumExperience: 0,
      coverArtUri: null,
      trackCount: favoriteTracks.length,
    },
  };

  const items: LibraryItem[] = [
    favoritesFolderItem,
    ...folders.map(f => ({ type: 'folder' as const, data: f })),
    ...rootTracks.map(t => ({ type: 'track' as const, data: t })),
  ];

  // Index of the now-playing item (folder containing track, or root track)
  const nowPlayingIndex = useMemo(() => {
    if (!currentTrack) return -1;
    const idx = items.findIndex(item => {
      if (item.type === 'folder') return item.data.id === currentTrack.folderId;
      return item.data.id === currentTrack.id;
    });
    return idx;
  }, [currentTrack, items]);

  // The item that should receive autoFocus: now-playing item if any, otherwise first
  const autoFocusIndex = nowPlayingIndex >= 0 ? nowPlayingIndex : 0;

  // Scroll to the now-playing item when the screen mounts / items change
  useEffect(() => {
    if (autoFocusIndex > 0 && items.length > 0) {
      console.log('[LibraryScreen] autoFocusIndex:', autoFocusIndex, 'nowPlayingIndex:', nowPlayingIndex);
      console.log('[LibraryScreen] Item at autoFocusIndex:', items[autoFocusIndex]);
      // Delay to ensure FlatList has completed layout, then scroll
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: autoFocusIndex,
          animated: false,
          viewPosition: 0.3,
        });
        console.log('[LibraryScreen] Scrolled to index', autoFocusIndex);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [autoFocusIndex, items.length, nowPlayingIndex, items]);

  // Page scroll via store action (L1/R1)
  useEffect(() => {
    if (!pendingScrollAction || items.length === 0) return;
    const pageSize = 10;
    let nextIndex = scrollIndex;
    if (pendingScrollAction === 'pageUp') {
      nextIndex = Math.max(0, scrollIndex - pageSize);
    } else {
      nextIndex = Math.min(items.length - 1, scrollIndex + pageSize);
    }
    setScrollIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true, viewPosition: 0 });
    clearPageScroll();
  }, [pendingScrollAction, items.length, scrollIndex, clearPageScroll]);

  const renderItem = useCallback(
    ({ item, index }: { item: LibraryItem; index: number }) => {
      if (item.type === 'folder') {
        return (
          <FolderItem
            folder={item.data}
            onPress={() => openFolder(item.data)}
            autoFocus={index === autoFocusIndex}
            isNowPlaying={currentTrack?.folderId === item.data.id}
            styles={styles}
          />
        );
      }
      return (
        <TrackItem
          track={item.data}
          onPress={() => playTrack(item.data)}
          autoFocus={index === autoFocusIndex}
          isNowPlaying={currentTrack?.id === item.data.id}
          styles={styles}
        />
      );
    },
    [openFolder, playTrack, currentTrack, autoFocusIndex],
  );

  const keyExtractor = useCallback(
    (item: LibraryItem) =>
      item.type === 'folder'
        ? `folder-${item.data.id}`
        : `track-${item.data.id}`,
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        {isScanning && (
          <View style={styles.scanRow}>
            <ActivityIndicator size="small" color={styles.scanText.color} />
            <Text style={styles.scanText}>{scanProgress}</Text>
          </View>
        )}
        {!!metadataProgress && !isScanning && (
          <Text style={styles.scanText}>{metadataProgress}</Text>
        )}
      </View>

      {items.length === 0 && !isScanning ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No music found</Text>
          <Text style={styles.emptySubtext}>
            Press Start to select a music folder
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={21}
          onScrollToIndexFailed={onScrollToIndexFailed}
        />
      )}
    </View>
  );
}

function FolderItem({
  folder,
  onPress,
  autoFocus,
  isNowPlaying,
  styles,
}: {
  folder: FolderRow;
  onPress: () => void;
  autoFocus?: boolean;
  isNowPlaying?: boolean;
  styles: ReturnType<typeof createStyles>;
}): React.JSX.Element {
  const isAlbumExperience = folder.isAlbumExperience === 1;
  const isFavorites = folder.id === -1 && folder.name === 'Favorites';
  const icon = isFavorites ? '⭐' : isAlbumExperience ? '💿' : '📁';
  const navigateToNowPlaying = usePlayerStore(s => s.navigateToNowPlaying);

  return (
    <FocusablePressable
      onPress={isNowPlaying ? navigateToNowPlaying : onPress}
      style={styles.item}
      focusedStyle={styles.itemFocused}
      focusData={folder}
      autoFocus={autoFocus}
      isNowPlaying={isNowPlaying}
    >
      <Text style={styles.itemIcon}>{icon}</Text>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {folder.name}
        </Text>
        <Text style={styles.itemSubtitle}>
          {folder.trackCount} track{folder.trackCount !== 1 ? 's' : ''}
          {!isFavorites && isAlbumExperience ? ' · Album Experience' : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </FocusablePressable>
  );
}

function TrackItem({
  track,
  onPress,
  autoFocus,
  isNowPlaying,
  styles,
}: {
  track: TrackRow;
  onPress: () => void;
  autoFocus?: boolean;
  isNowPlaying?: boolean;
  styles: ReturnType<typeof createStyles>;
}): React.JSX.Element {
  const title = track.title ?? stripAudioExtension(track.fileName);
  const subtitle = track.artist ?? '';
  const navigateToNowPlaying = usePlayerStore(s => s.navigateToNowPlaying);

  return (
    <FocusablePressable
      onPress={isNowPlaying ? navigateToNowPlaying : onPress}
      style={styles.item}
      focusedStyle={styles.itemFocused}
      focusData={track}
      autoFocus={autoFocus}
      isNowPlaying={isNowPlaying}
    >
      <Text style={styles.itemIcon}>🎵</Text>
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
      {track.isFavorite === 1 && (
        <Text style={styles.favoriteIcon}>⭐</Text>
      )}
    </FocusablePressable>
  );
}

const createStyles = (c: import('../theme/colors').ThemeColors) => StyleSheet.create({
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
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  scanText: {
    color: c.textTertiary,
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: c.textTertiary,
    fontSize: 18,
  },
  emptySubtext: {
    color: c.textFaint,
    fontSize: 14,
    marginTop: 8,
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
    backgroundColor: c.overlayLight,
    borderWidth: 2,
    borderColor: c.accentPrimary,
  },
  itemIcon: {
    fontSize: 20,
    marginRight: 14,
    width: 28,
    textAlign: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  itemSubtitle: {
    color: c.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: c.textMuted,
    fontSize: 22,
    marginLeft: 8,
  },
  favoriteIcon: {
    fontSize: 14,
    marginLeft: 8,
  },
});
