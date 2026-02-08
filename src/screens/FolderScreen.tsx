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
import { useThemedStyles } from '../theme/ThemeProvider';

type FolderListItem =
  | { type: 'disc-header'; discNumber: number; key: string }
  | { type: 'track'; data: TrackRow; trackIndexInDisc: number; key: string };

export default function FolderScreen(): React.JSX.Element {
  const { currentFolder, currentFolderTracks, playTrack, goBack, pendingScrollAction, clearPageScroll, navigateToNowPlaying } =
    usePlayerStore();
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const flatListRef = useRef<FlatList>(null);
  const [scrollIndex, setScrollIndex] = useState(0);
  const styles = useThemedStyles(createStyles);

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
      console.log('[FolderScreen] autoFocusIndex:', autoFocusIndex, 'nowPlayingIndex:', nowPlayingIndex);
      console.log('[FolderScreen] Item at autoFocusIndex:', listItems[autoFocusIndex]);
      // Delay to ensure FlatList has completed layout, then scroll
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: autoFocusIndex,
          animated: false,
          viewPosition: 0.3,
        });
        console.log('[FolderScreen] Scrolled to index', autoFocusIndex);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [autoFocusIndex, listItems.length, nowPlayingIndex, listItems]);

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
      // Always pass folder tracks so d-pad navigation works in all modes
      playTrack(track, currentFolderTracks);
    },
    [currentFolderTracks, playTrack],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FolderListItem; index: number }) => {
      if (item.type === 'disc-header' && !isFavoritesFolder) {
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

      if (item.type !== 'track') return null;

      const track = item.data;
      const title = track.title ?? stripAudioExtension(track.fileName);
      const subtitle = track.artist ?? '';
      const isNowPlaying = currentTrack?.id === track.id;

      return (
        <FocusablePressable
          onPress={isNowPlaying ? navigateToNowPlaying : () => handlePlayTrack(track)}
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
          {!isFavoritesFolder && track.isFavorite === 1 && (
            <Text style={styles.favoriteIcon}>⭐</Text>
          )}
          {track.duration > 0 && (
            <Text style={styles.duration}>
              {formatDuration(track.duration)}
            </Text>
          )}
        </FocusablePressable>
      );
    },
    [handlePlayTrack, isAlbumExperience, isFavoritesFolder, autoFocusIndex, currentTrack, navigateToNowPlaying],
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
        maxToRenderPerBatch={10}
        windowSize={21}
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

const createStyles = (c: import('../theme/colors').ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    alignItems: 'center',
  },
  headerArt: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 16,
    backgroundColor: c.surface,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: c.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  albumExpBadge: {
    backgroundColor: c.accentBadge,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  albumExpBadgeText: {
    color: c.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: c.textSecondary,
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
    backgroundColor: c.borderSubtle,
  },
  discHeaderText: {
    color: c.textTertiary,
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
    backgroundColor: c.overlayLight,
    borderWidth: 2,
    borderColor: c.accentPrimary,
  },
  trackNumber: {
    color: c.textMuted,
    fontSize: 14,
    width: 30,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
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
  duration: {
    color: c.textMuted,
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
    backgroundColor: c.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoritesHeaderIconText: {
    fontSize: 36,
  },
});
