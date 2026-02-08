import { create } from 'zustand';
import TrackPlayer, { RepeatMode, type Track } from 'react-native-track-player';
import {
  getAllFolders,
  getTracksByFolder,
  getRootTracks,
  getConfig,
  setConfig,
  type FolderRow,
  type TrackRow,
} from '../services/database';

import { encodeContentUri, encodeOptionalUri } from '../utils/uri';

const ROOT_FOLDER_NAME = '__root__';

export type ControllerLayout = 'standard' | 'sixbutton';
export type ScreenName = 'library' | 'folder' | 'nowplaying' | 'settings';

export interface PlayerState {
  // Library
  folders: FolderRow[];
  rootTracks: TrackRow[];
  currentFolderTracks: TrackRow[];
  currentFolder: FolderRow | null;
  isScanning: boolean;
  scanProgress: string;
  metadataProgress: string;

  // Playback
  currentTrack: TrackRow | null;
  isPlaying: boolean;
  isAlbumExperience: boolean;
  queueLength: number;
  currentQueueIndex: number;

  // Navigation
  currentScreen: ScreenName;
  previousScreen: ScreenName | null;

  // Settings
  controllerLayout: ControllerLayout;
  seekAmount: number;
  largeSeekAmount: number;
  showButtonHints: boolean;

  // UI state
  pendingScrollAction: 'pageUp' | 'pageDown' | null;
  focusedItem: TrackRow | FolderRow | null;
  inspectedTrack: TrackRow | null;

  // Actions
  refreshLibrary: () => void;
  setScanning: (scanning: boolean, progress?: string) => void;
  setMetadataProgress: (progress: string) => void;
  openFolder: (folder: FolderRow) => void;
  goBack: () => void;
  playTrack: (track: TrackRow, folderTracks?: TrackRow[]) => Promise<void>;
  setIsPlaying: (playing: boolean) => void;
  navigateToNowPlaying: () => void;
  navigateToLibrary: () => void;
  navigateToSettings: () => void;
  setCurrentScreen: (screen: ScreenName) => void;

  // Settings actions
  setControllerLayout: (layout: ControllerLayout) => void;
  setSeekAmount: (amount: number) => void;
  setLargeSeekAmount: (amount: number) => void;
  setShowButtonHints: (show: boolean) => void;

  // UI actions
  requestPageScroll: (direction: 'pageUp' | 'pageDown') => void;
  clearPageScroll: () => void;
  setFocusedItem: (item: TrackRow | FolderRow | null) => void;
  showTrackInfo: (track: TrackRow) => void;
  hideTrackInfo: () => void;
  hydrateSettings: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Library state
  folders: [],
  rootTracks: [],
  currentFolderTracks: [],
  currentFolder: null,
  isScanning: false,
  scanProgress: '',
  metadataProgress: '',

  // Playback state
  currentTrack: null,
  isPlaying: false,
  isAlbumExperience: false,
  queueLength: 0,
  currentQueueIndex: 0,

  // Navigation
  currentScreen: 'library',
  previousScreen: null,

  // Settings
  controllerLayout: 'standard',
  seekAmount: 10,
  largeSeekAmount: 30,
  showButtonHints: false,

  // UI state
  pendingScrollAction: null,
  focusedItem: null,
  inspectedTrack: null,

  // Actions
  refreshLibrary: () => {
    const allFolders = getAllFolders();
    // Separate root virtual folder from real subfolders
    const rootFolder = allFolders.find(f => f.name === ROOT_FOLDER_NAME);
    const subFolders = allFolders
      .filter(f => f.name !== ROOT_FOLDER_NAME)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const rootTracksList = rootFolder ? getRootTracks(rootFolder.id) : [];

    set({
      folders: subFolders,
      rootTracks: rootTracksList,
    });

    // If currently viewing a folder, refresh its tracks too
    const currentFolder = get().currentFolder;
    if (currentFolder) {
      const tracks = getTracksByFolder(currentFolder.id);
      set({ currentFolderTracks: tracks });
    }
  },

  setScanning: (scanning, progress) =>
    set({ isScanning: scanning, scanProgress: progress ?? '' }),

  setMetadataProgress: (progress) =>
    set({ metadataProgress: progress }),

  openFolder: (folder) => {
    const tracks = getTracksByFolder(folder.id);
    set({
      currentFolder: folder,
      currentFolderTracks: tracks,
      currentScreen: 'folder',
    });
  },

  goBack: () => {
    const screen = get().currentScreen;
    if (screen === 'folder') {
      set({
        currentFolder: null,
        currentFolderTracks: [],
        currentScreen: 'library',
      });
    } else if (screen === 'nowplaying') {
      // Go back to wherever we came from
      const folder = get().currentFolder;
      set({ currentScreen: folder ? 'folder' : 'library' });
    } else if (screen === 'settings') {
      const prev = get().previousScreen;
      set({
        currentScreen: prev ?? 'library',
        previousScreen: null,
      });
    }
  },

  playTrack: async (track, folderTracks) => {
    const treeRootUri = getConfig('library_uri');
    const isAlbumExp = track.isAlbumExperience === 1;

    if (isAlbumExp && folderTracks && folderTracks.length > 0) {
      // Album Experience mode: load all folder tracks as queue
      const queue: Track[] = folderTracks.map(t => ({
        id: t.id.toString(),
        url: encodeContentUri(t.uri, treeRootUri),
        title: t.title ?? t.fileName.replace(/\.flac$/i, ''),
        artist: t.artist ?? 'Unknown Artist',
        album: t.album ?? '',
        duration: t.duration || undefined,
        artwork: encodeOptionalUri(t.coverArtUri, treeRootUri),
      }));

      const selectedIndex = folderTracks.findIndex(t => t.uri === track.uri);

      await TrackPlayer.setQueue(queue);
      if (selectedIndex >= 0) {
        await TrackPlayer.skip(selectedIndex);
      }
      await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      await TrackPlayer.play();

      set({
        currentTrack: track,
        isPlaying: true,
        isAlbumExperience: true,
        queueLength: folderTracks.length,
        currentQueueIndex: selectedIndex >= 0 ? selectedIndex : 0,
        currentScreen: 'nowplaying',
      });
    } else {
      // Single track mode: repeat one
      const playerTrack: Track = {
        id: track.id.toString(),
        url: encodeContentUri(track.uri, treeRootUri),
        title: track.title ?? track.fileName.replace(/\.flac$/i, ''),
        artist: track.artist ?? 'Unknown Artist',
        album: track.album ?? '',
        duration: track.duration || undefined,
        artwork: encodeOptionalUri(track.coverArtUri, treeRootUri),
      };

      await TrackPlayer.setQueue([playerTrack]);
      await TrackPlayer.setRepeatMode(RepeatMode.Track);
      await TrackPlayer.play();

      set({
        currentTrack: track,
        isPlaying: true,
        isAlbumExperience: false,
        queueLength: 1,
        currentQueueIndex: 0,
        currentScreen: 'nowplaying',
      });
    }
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  navigateToNowPlaying: () => set({ currentScreen: 'nowplaying' }),
  navigateToLibrary: () => {
    const folder = get().currentFolder;
    set({ currentScreen: folder ? 'folder' : 'library' });
  },
  navigateToSettings: () => {
    const current = get().currentScreen;
    set({ previousScreen: current, currentScreen: 'settings' });
  },

  setCurrentScreen: (screen) => set({ currentScreen: screen }),

  // Settings actions
  setControllerLayout: (layout) => {
    set({ controllerLayout: layout });
    setConfig('controller_layout', layout);
  },
  setSeekAmount: (amount) => {
    set({ seekAmount: amount });
    setConfig('seek_amount', amount.toString());
  },
  setLargeSeekAmount: (amount) => {
    set({ largeSeekAmount: amount });
    setConfig('large_seek_amount', amount.toString());
  },
  setShowButtonHints: (show) => {
    set({ showButtonHints: show });
    setConfig('show_button_hints', show ? '1' : '0');
  },

  // UI actions
  requestPageScroll: (direction) => set({ pendingScrollAction: direction }),
  clearPageScroll: () => set({ pendingScrollAction: null }),
  setFocusedItem: (item) => set({ focusedItem: item }),
  showTrackInfo: (track) => set({ inspectedTrack: track }),
  hideTrackInfo: () => set({ inspectedTrack: null }),
  hydrateSettings: () => {
    const layout = getConfig('controller_layout');
    const seek = getConfig('seek_amount');
    const largeSeek = getConfig('large_seek_amount');
    const hints = getConfig('show_button_hints');
    set({
      controllerLayout: (layout === 'sixbutton' ? 'sixbutton' : 'standard') as ControllerLayout,
      seekAmount: seek ? parseInt(seek, 10) || 10 : 10,
      largeSeekAmount: largeSeek ? parseInt(largeSeek, 10) || 30 : 30,
      showButtonHints: hints === '1',
    });
  },
}));
