import React, { useCallback, useEffect, useRef, useState } from 'react';
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

type LibraryItem =
  | { type: 'folder'; data: FolderRow }
  | { type: 'track'; data: TrackRow };

export default function LibraryScreen(): React.JSX.Element {
  const {
    folders,
    rootTracks,
    isScanning,
    scanProgress,
    metadataProgress,
    openFolder,
    playTrack,
    pendingScrollAction,
    clearPageScroll,
  } = usePlayerStore();

  const flatListRef = useRef<FlatList>(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  // Build combined list: folders first (alphabetical), then root tracks (alphabetical)
  const items: LibraryItem[] = [
    ...folders.map(f => ({ type: 'folder' as const, data: f })),
    ...rootTracks.map(t => ({ type: 'track' as const, data: t })),
  ];

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
    ({ item }: { item: LibraryItem }) => {
      if (item.type === 'folder') {
        return (
          <FolderItem
            folder={item.data}
            onPress={() => openFolder(item.data)}
          />
        );
      }
      return (
        <TrackItem
          track={item.data}
          onPress={() => playTrack(item.data)}
        />
      );
    },
    [openFolder, playTrack],
  );

  const keyExtractor = useCallback(
    (item: LibraryItem) =>
      item.type === 'folder'
        ? `folder-${item.data.id}`
        : `track-${item.data.id}`,
    [],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        {isScanning && (
          <View style={styles.scanRow}>
            <ActivityIndicator size="small" color="#888" />
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
        />
      )}
    </View>
  );
}

function FolderItem({
  folder,
  onPress,
}: {
  folder: FolderRow;
  onPress: () => void;
}): React.JSX.Element {
  const isAlbumExperience = folder.isAlbumExperience === 1;
  const icon = isAlbumExperience ? '💿' : '📁';

  return (
    <FocusablePressable
      onPress={onPress}
      style={styles.item}
      focusedStyle={styles.itemFocused}
      focusData={folder}
    >
      <Text style={styles.itemIcon}>{icon}</Text>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {folder.name}
        </Text>
        <Text style={styles.itemSubtitle}>
          {folder.trackCount} track{folder.trackCount !== 1 ? 's' : ''}
          {isAlbumExperience ? ' · Album Experience' : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </FocusablePressable>
  );
}

function TrackItem({
  track,
  onPress,
}: {
  track: TrackRow;
  onPress: () => void;
}): React.JSX.Element {
  const title = track.title ?? track.fileName.replace(/\.flac$/i, '');
  const subtitle = track.artist ?? '';

  return (
    <FocusablePressable
      onPress={onPress}
      style={styles.item}
      focusedStyle={styles.itemFocused}
      focusData={track}
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
    </FocusablePressable>
  );
}

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
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  scanText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
  },
  emptySubtext: {
    color: '#444',
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: '#4a9eff',
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
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  itemSubtitle: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: '#555',
    fontSize: 22,
    marginLeft: 8,
  },
});
