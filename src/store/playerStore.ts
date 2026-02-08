import { create } from 'zustand';
import TrackPlayer, { RepeatMode, type Track } from 'react-native-track-player';
import {
  getAllFolders,
  getTracksByFolder,
  getRootTracks,
  getFolderById,
  getConfig,
  setConfig,
  toggleFavorite as dbToggleFavorite,
  getFavoriteTracks,
  type FolderRow,
  type TrackRow,
} from '../services/database';

import { encodeContentUri } from '../utils/uri';
import { stripAudioExtension } from '../utils/audio';

const ROOT_FOLDER_NAME = '__root__';

export type ControllerLayout = 'standard' | 'sixbutton';
export type StandardXAction = 'favorite' | 'repeat';
export type ScreenName = 'library' | 'folder' | 'nowplaying' | 'settings';

export interface PlayerState {
  // Library
  folders: FolderRow[];
  rootTracks: TrackRow[];
  favoriteTracks: TrackRow[];
  currentFolderTracks: TrackRow[];
  currentFolder: FolderRow | null;
  isScanning: boolean;
  scanProgress: string;
  metadataProgress: string;

  // Playback
  currentTrack: TrackRow | null;
  isPlaying: boolean;
  isAlbumExperience: boolean;
  queueTracks: TrackRow[];
  queueLength: number;
  currentQueueIndex: number;

  // Navigation
  currentScreen: ScreenName;
  previousScreen: ScreenName | null;

  // Settings
  controllerLayout: ControllerLayout;
  standardXAction: StandardXAction;
  seekAmount: number;
  largeSeekAmount: number;
  showButtonHints: boolean;

  // UI state
  pendingScrollAction: 'pageUp' | 'pageDown' | null;
  focusedItem: TrackRow | FolderRow | null;
  focusedSettingAction: (() => void) | null;
  inspectedTrack: TrackRow | null;
  statusMessage: string | null;

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
  loadFavorites: () => void;
  toggleFavorite: (trackId: number) => void;

  // Settings actions
  setControllerLayout: (layout: ControllerLayout) => void;
  setStandardXAction: (action: StandardXAction) => void;
  setSeekAmount: (amount: number) => void;
  setLargeSeekAmount: (amount: number) => void;
  setShowButtonHints: (show: boolean) => void;

  // UI actions
  requestPageScroll: (direction: 'pageUp' | 'pageDown') => void;
  clearPageScroll: () => void;
  setFocusedItem: (item: TrackRow | FolderRow | null) => void;
  setFocusedSettingAction: (action: (() => void) | null) => void;
  showTrackInfo: (track: TrackRow) => void;
  hideTrackInfo: () => void;
  showStatus: (message: string, durationMs?: number) => void;
  hydrateSettings: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Library state
  folders: [],
  rootTracks: [],
  favoriteTracks: [],
  currentFolderTracks: [],
  currentFolder: null,
  isScanning: false,
  scanProgress: '',
  metadataProgress: '',

  // Playback state
  currentTrack: null,
  isPlaying: false,
  isAlbumExperience: false,
  queueTracks: [],
  queueLength: 0,
  currentQueueIndex: 0,

  // Navigation
  currentScreen: 'library',
  previousScreen: null,

  // Settings
  controllerLayout: 'standard',
  standardXAction: 'favorite',
  seekAmount: 10,
  largeSeekAmount: 30,
  showButtonHints: false,

  // UI state
  pendingScrollAction: null,
  focusedItem: null,
  focusedSettingAction: null,
  inspectedTrack: null,
  statusMessage: null,

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
      favoriteTracks: getFavoriteTracks(),
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
    // Handle virtual Favorites folder
    if (folder.id === -1 && folder.name === 'Favorites') {
      const tracks = getFavoriteTracks();
      set({
        currentFolder: folder,
        currentFolderTracks: tracks,
        currentScreen: 'folder',
      });
      return;
    }
    // Re-fetch from DB to ensure isAlbumExperience is always fresh
    const freshFolder = getFolderById(folder.id) ?? folder;
    const tracks = getTracksByFolder(freshFolder.id);
    set({
      currentFolder: freshFolder,
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
    console.log('[playTrack] Starting playTrack');
    console.log('[playTrack] Track:', track.fileName, 'ID:', track.id);
    console.log('[playTrack] track.isAlbumExperience:', track.isAlbumExperience);
    console.log('[playTrack] folderTracks provided:', !!folderTracks);
    console.log('[playTrack] folderTracks length:', folderTracks?.length ?? 0);
    
    const treeRootUri = getConfig('library_uri');
    const isAlbumExp = track.isAlbumExperience === 1;
    console.log('[playTrack] isAlbumExp evaluated to:', isAlbumExp);

    if (isAlbumExp && folderTracks && folderTracks.length > 0) {
      // Album Experience mode: load all folder tracks as queue
      const queue: Track[] = folderTracks.map(t => ({
        id: t.id.toString(),
        url: encodeContentUri(t.uri, treeRootUri),
        title: t.title ?? stripAudioExtension(t.fileName),
        artist: t.artist ?? 'Unknown Artist',
        album: t.album ?? '',
        duration: t.duration || undefined,
        artwork: t.coverArtUri ? encodeContentUri(t.coverArtUri, treeRootUri) : undefined,
      }));

      const selectedIndex = folderTracks.findIndex(t => t.uri === track.uri);

      await TrackPlayer.setQueue(queue);
      if (selectedIndex >= 0) {
        await TrackPlayer.skip(selectedIndex);
      }
      await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      await TrackPlayer.play();

      console.log('[playTrack] Album mode - setting state with queueTracks length:', folderTracks.length);
      console.log('[playTrack] Album mode - selectedIndex:', selectedIndex);
      
      set({
        currentTrack: track,
        isPlaying: true,
        isAlbumExperience: true,
        queueTracks: folderTracks,
        queueLength: folderTracks.length,
        currentQueueIndex: selectedIndex >= 0 ? selectedIndex : 0,
        currentScreen: 'nowplaying',
      });
    } else {
      // Single track mode: repeat one
      const playerTrack: Track = {
        id: track.id.toString(),
        url: encodeContentUri(track.uri, treeRootUri),
        title: track.title ?? stripAudioExtension(track.fileName),
        artist: track.artist ?? 'Unknown Artist',
        album: track.album ?? '',
        duration: track.duration || undefined,
        artwork: track.coverArtUri ? encodeContentUri(track.coverArtUri, treeRootUri) : undefined,
      };

      await TrackPlayer.setQueue([playerTrack]);
      await TrackPlayer.setRepeatMode(RepeatMode.Track);
      await TrackPlayer.play();

      // Store folder tracks for d-pad navigation even in single-track mode
      const sourceIndex = folderTracks ? folderTracks.findIndex(t => t.uri === track.uri) : -1;
      
      console.log('[playTrack] NON-Album mode - folderTracks:', folderTracks?.length ?? 0);
      console.log('[playTrack] NON-Album mode - sourceIndex:', sourceIndex);
      console.log('[playTrack] NON-Album mode - storing queueTracks length:', folderTracks?.length ?? 0);

      set({
        currentTrack: track,
        isPlaying: true,
        isAlbumExperience: false,
        queueTracks: folderTracks ?? [],
        queueLength: 1,
        currentQueueIndex: sourceIndex >= 0 ? sourceIndex : 0,
        currentScreen: 'nowplaying',
      });
      
      console.log('[playTrack] NON-Album mode - State set. Check store queueTracks after this.');
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

  loadFavorites: () => {
    set({ favoriteTracks: getFavoriteTracks() });
  },

  toggleFavorite: (trackId) => {
    const isFav = dbToggleFavorite(trackId);
    const favTracks = getFavoriteTracks();
    const state = get();

    const updates: Partial<PlayerState> = { favoriteTracks: favTracks };

    // If viewing the favorites virtual folder, refresh its track list
    if (state.currentFolder?.id === -1 && state.currentFolder?.name === 'Favorites') {
      updates.currentFolderTracks = favTracks;
    } else if (state.currentFolder) {
      // Update isFavorite flag on tracks in current folder view
      updates.currentFolderTracks = state.currentFolderTracks.map(t =>
        t.id === trackId ? { ...t, isFavorite: isFav ? 1 : 0 } : t,
      );
    }

    // Update rootTracks if applicable
    updates.rootTracks = state.rootTracks.map(t =>
      t.id === trackId ? { ...t, isFavorite: isFav ? 1 : 0 } : t,
    );

    // Update currentTrack if it's the one being toggled
    if (state.currentTrack?.id === trackId) {
      updates.currentTrack = { ...state.currentTrack, isFavorite: isFav ? 1 : 0 };
    }

    set(updates);
    state.showStatus(isFav ? '⭐ Added to Favorites' : 'Removed from Favorites');
  },

  // Settings actions
  setControllerLayout: (layout) => {
    set({ controllerLayout: layout });
    setConfig('controller_layout', layout);
  },
  setStandardXAction: (action) => {
    set({ standardXAction: action });
    setConfig('standard_x_action', action);
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
  setFocusedSettingAction: (action) => set({ focusedSettingAction: action }),
  showTrackInfo: (track) => set({ inspectedTrack: track }),
  hideTrackInfo: () => set({ inspectedTrack: null }),
  showStatus: (message, durationMs = 1000) => {
    set({ statusMessage: message });
    setTimeout(() => set({ statusMessage: null }), durationMs);
  },
  hydrateSettings: () => {
    const layout = getConfig('controller_layout');
    const xAction = getConfig('standard_x_action');
    const seek = getConfig('seek_amount');
    const largeSeek = getConfig('large_seek_amount');
    const hints = getConfig('show_button_hints');
    set({
      controllerLayout: (layout === 'sixbutton' ? 'sixbutton' : 'standard') as ControllerLayout,
      standardXAction: (xAction === 'repeat' ? 'repeat' : 'favorite') as StandardXAction,
      seekAmount: seek ? parseInt(seek, 10) || 10 : 10,
      largeSeekAmount: largeSeek ? parseInt(largeSeek, 10) || 30 : 30,
      showButtonHints: hints === '1',
    });
  },
}));
