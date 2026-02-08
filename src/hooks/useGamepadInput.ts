import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import KeyEvent from 'react-native-keyevent';
import TrackPlayer, { RepeatMode, State } from 'react-native-track-player';
import { usePlayerStore } from '../store/playerStore';
import { updateFolderAlbumExperience, getFolderById } from '../services/database';
import type { TrackRow, FolderRow } from '../services/database';

// Android KeyEvent keycodes — D-pad
const KEYCODE_DPAD_UP = 19;
const KEYCODE_DPAD_DOWN = 20;
const KEYCODE_DPAD_LEFT = 21;
const KEYCODE_DPAD_RIGHT = 22;

// Face buttons (standard 4-button / SNES-style)
const KEYCODE_BUTTON_A = 96;
const KEYCODE_BUTTON_B = 97;
const KEYCODE_BUTTON_X = 99;
const KEYCODE_BUTTON_Y = 100;

// Face buttons (6-button / Sega Saturn-style extras)
const KEYCODE_BUTTON_C = 98;
const KEYCODE_BUTTON_Z = 101;

// Shoulder / trigger buttons
const KEYCODE_BUTTON_L1 = 102;
const KEYCODE_BUTTON_R1 = 103;
const KEYCODE_BUTTON_L2 = 104;
const KEYCODE_BUTTON_R2 = 105;

// Menu buttons
const KEYCODE_BUTTON_START = 108;
const KEYCODE_BUTTON_SELECT = 109;

// Media buttons
const KEYCODE_MEDIA_PLAY_PAUSE = 85;
const KEYCODE_MEDIA_PLAY = 126;
const KEYCODE_MEDIA_PAUSE = 127;
const KEYCODE_MEDIA_NEXT = 87;
const KEYCODE_MEDIA_PREVIOUS = 88;

// Repeat mode cycle order
const REPEAT_MODES = [
  { mode: RepeatMode.Track, name: 'Repeat Track' },
  { mode: RepeatMode.Queue, name: 'Repeat Queue' },
];

function isTrackRow(item: any): item is TrackRow {
  return item && typeof item === 'object' && 'uri' in item && 'fileName' in item;
}

function isFolderRow(item: any): item is FolderRow {
  return item && typeof item === 'object' && 'name' in item && 'trackCount' in item && !('fileName' in item);
}

export function useGamepadInput(): void {
  const selectHeldRef = useRef(false);
  const selectUsedInComboRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = async (event: { keyCode: number }) => {
      const { keyCode } = event;
      const state = usePlayerStore.getState();

      // ── Track Select held state ──
      if (keyCode === KEYCODE_BUTTON_SELECT) {
        selectHeldRef.current = true;
        selectUsedInComboRef.current = false;
        return;
      }

      // ── Track info overlay is open → A or B dismisses it ──
      if (state.inspectedTrack) {
        if (
          keyCode === KEYCODE_BUTTON_A ||
          keyCode === KEYCODE_BUTTON_B
        ) {
          state.hideTrackInfo();
          return;
        }
        // Block all other input while overlay is open
        return;
      }

      // ── always go to now playing ──
      if (keyCode === KEYCODE_BUTTON_START) {
        state.navigateToNowPlaying();
        return;
      }

      // ── Global media buttons ──
      if (
        keyCode === KEYCODE_MEDIA_PLAY_PAUSE ||
        keyCode === KEYCODE_MEDIA_PLAY ||
        keyCode === KEYCODE_MEDIA_PAUSE
      ) {
        await togglePlayPause();
        return;
      }
      if (keyCode === KEYCODE_MEDIA_NEXT) {
        try { await TrackPlayer.skipToNext(); } catch {}
        return;
      }
      if (keyCode === KEYCODE_MEDIA_PREVIOUS) {
        try { await TrackPlayer.skipToPrevious(); } catch {}
        return;
      }

      // ── B button → go back (all screens) ──
      if (keyCode === KEYCODE_BUTTON_B) {
        if (state.currentScreen === 'nowplaying') {
          state.navigateToLibrary();
        } else if (state.currentScreen === 'folder') {
          state.goBack();
        } else if (state.currentScreen === 'settings') {
          state.goBack();
        }
        // On library screen, B does nothing (root)
        return;
      }

      const screen = state.currentScreen;

      // ══════════════════════════════════════════
      // NOW PLAYING SCREEN
      // ══════════════════════════════════════════
      if (screen === 'nowplaying') {
        const { seekAmount, largeSeekAmount, isAlbumExperience, controllerLayout } = state;

        // A → play/pause
        if (keyCode === KEYCODE_BUTTON_A) {
          await togglePlayPause();
          return;
        }

        // D-pad left/right → seek ± seekAmount
        if (keyCode === KEYCODE_DPAD_LEFT) {
          const pos = (await TrackPlayer.getProgress()).position;
          await TrackPlayer.seekTo(Math.max(0, pos - seekAmount));
          return;
        }
        if (keyCode === KEYCODE_DPAD_RIGHT) {
          const { position, duration } = await TrackPlayer.getProgress();
          await TrackPlayer.seekTo(Math.min(duration, position + seekAmount));
          return;
        }

        // D-pad Up/Down, L1/R1 → skip tracks
        if (
          keyCode === KEYCODE_DPAD_UP || keyCode === KEYCODE_BUTTON_L1
        ) {
          await skipToPrev(state);
          return;
        }
        if (
          keyCode === KEYCODE_DPAD_DOWN || keyCode === KEYCODE_BUTTON_R1
        ) {
          await skipToNext(state);
          return;
        }

        // X → depends on standardXAction setting (standard mode)
        // In six-button mode, X is always Favorite
        // Select+X always cycles repeat mode as a combo override
        if (keyCode === KEYCODE_BUTTON_X) {
          if (selectHeldRef.current) {
            // Select+X combo → always cycle repeat
            selectUsedInComboRef.current = true;
            await cycleRepeatMode();
            return;
          }
          if (controllerLayout === 'sixbutton' || state.standardXAction === 'favorite') {
            if (state.currentTrack) {
              state.toggleFavorite(state.currentTrack.id);
            }
          } else {
            await cycleRepeatMode();
          }
          return;
        }

        // Y → show track info for current track
        if (keyCode === KEYCODE_BUTTON_Y) {
          if (state.currentTrack) {
            state.showTrackInfo(state.currentTrack);
          }
          return;
        }

        // L2 → large seek backward
        if (keyCode === KEYCODE_BUTTON_L2) {
          const pos = (await TrackPlayer.getProgress()).position;
          await TrackPlayer.seekTo(Math.max(0, pos - largeSeekAmount));
          return;
        }

        // R2 → large seek forward
        if (keyCode === KEYCODE_BUTTON_R2) {
          const { position, duration } = await TrackPlayer.getProgress();
          await TrackPlayer.seekTo(Math.min(duration, position + largeSeekAmount));
          return;
        }

        // 6-button extras
        if (controllerLayout === 'sixbutton') {
          // C → restart track from beginning
          if (keyCode === KEYCODE_BUTTON_C) {
            await TrackPlayer.seekTo(0);
            return;
          }

          // Z → cycle repeat mode
          if (keyCode === KEYCODE_BUTTON_Z) {
            await cycleRepeatMode();
            return;
          }
        }

        return;
      }

      // ══════════════════════════════════════════
      // LIBRARY / FOLDER SCREENS
      // ══════════════════════════════════════════
      if (screen === 'library' || screen === 'folder') {
        // A → select (open folder or play track)
        if (keyCode === KEYCODE_BUTTON_A) {
          const focused = state.focusedItem;
          if (focused) {
            if (isFolderRow(focused)) {
              state.openFolder(focused);
            } else if (isTrackRow(focused)) {
              // If the focused track is already playing, go to now-playing screen
              if (state.currentTrack && state.currentTrack.id === focused.id) {
                state.navigateToNowPlaying();
              } else if (screen === 'folder') {
                state.playTrack(focused, state.currentFolderTracks);
              } else {
                state.playTrack(focused);
              }
            }
          }
          return;
        }

        // Y → show track info for focused item
        if (keyCode === KEYCODE_BUTTON_Y) {
          const focused = state.focusedItem;
          if (focused && isTrackRow(focused)) {
            state.showTrackInfo(focused);
          }
          return;
        }

        // L1 → page scroll up
        if (keyCode === KEYCODE_BUTTON_L1) {
          state.requestPageScroll('pageUp');
          return;
        }

        // R1 → page scroll down
        if (keyCode === KEYCODE_BUTTON_R1) {
          state.requestPageScroll('pageDown');
          return;
        }

        // L2 on list screens — unbound
        if (keyCode === KEYCODE_BUTTON_L2) {
          return;
        }

        // R2 → toggle Album Experience
        if (keyCode === KEYCODE_BUTTON_R2) {
          if (screen === 'folder' && state.currentFolder) {
            // Don't allow Album Experience toggle on the virtual Favorites folder
            if (state.currentFolder.id === -1 && state.currentFolder.name === 'Favorites') {
              return;
            }
            const folder = state.currentFolder;
            const newValue = folder.isAlbumExperience !== 1;
            updateFolderAlbumExperience(folder.id, newValue);
            const updatedFolder = getFolderById(folder.id);
            if (updatedFolder) {
              usePlayerStore.setState({
                currentFolder: updatedFolder,
                currentFolderTracks: state.currentFolderTracks.map(t => ({
                  ...t,
                  isAlbumExperience: newValue ? 1 : 0,
                })),
                folders: state.folders.map(f =>
                  f.id === folder.id ? updatedFolder : f,
                ),
              });
              state.showStatus(
                newValue ? '💿 Album Experience ON' : '📁 Album Experience OFF',
              );
            }
          } else if (screen === 'library') {
            const focused = state.focusedItem;
            if (focused && isFolderRow(focused)) {
              const newValue = focused.isAlbumExperience !== 1;
              updateFolderAlbumExperience(focused.id, newValue);
              const updatedFolder = getFolderById(focused.id);
              if (updatedFolder) {
                usePlayerStore.setState({
                  folders: state.folders.map(f =>
                    f.id === focused.id ? updatedFolder : f,
                  ),
                  focusedItem: updatedFolder,
                });
                state.showStatus(
                  newValue ? '💿 Album Experience ON' : '📁 Album Experience OFF',
                );
              }
            }
          }
          return;
        }

        // X → toggle favorite on focused track
        if (keyCode === KEYCODE_BUTTON_X) {
          const focused = state.focusedItem;
          if (focused && isTrackRow(focused)) {
            state.toggleFavorite(focused.id);
          }
          return;
        }

        // 6-button extras on list screens
        if (state.controllerLayout === 'sixbutton') {
          // C → show track info for the currently focused item
          if (keyCode === KEYCODE_BUTTON_C) {
            const focused = state.focusedItem;
            if (focused && isTrackRow(focused)) {
              state.showTrackInfo(focused);
            }
            return;
          }

          // Z → unbound
          if (keyCode === KEYCODE_BUTTON_Z) {
            return;
          }
        }

        // D-pad navigation is handled by RN focus system
        return;
      }

      // ══════════════════════════════════════════
      // SETTINGS SCREEN
      // ══════════════════════════════════════════
      if (screen === 'settings') {
        // A → trigger the focused setting action
        // Since react-native-keyevent intercepts before FocusablePressable,
        // we need to manually trigger the focused item's callback
        if (keyCode === KEYCODE_BUTTON_A) {
          const focused = state.focusedSettingAction;
          if (focused) {
            focused();
          }
          return;
        }
        // D-pad is handled by RN focus system
        // B is handled above
        return;
      }
    };

    KeyEvent.onKeyDownListener(handleKeyDown);

    const handleKeyUp = (event: { keyCode: number }) => {
      if (event.keyCode === KEYCODE_BUTTON_SELECT) {
        // If Select was released without being used in a combo, fire solo action
        if (!selectUsedInComboRef.current) {
          const state = usePlayerStore.getState();
          if (state.currentScreen !== 'settings') {
            state.navigateToSettings();
          }
        }
        selectHeldRef.current = false;
        selectUsedInComboRef.current = false;
      }
    };

    KeyEvent.onKeyUpListener(handleKeyUp);

    return () => {
      KeyEvent.removeKeyDownListener();
      KeyEvent.removeKeyUpListener();
    };
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    const handleBack = () => {
      const state = usePlayerStore.getState();
      const screen = state.currentScreen;

      if (state.inspectedTrack) {
        state.hideTrackInfo();
        return true;
      }

      if (screen === 'nowplaying') {
        state.navigateToLibrary();
        return true;
      }
      if (screen === 'folder') {
        state.goBack();
        return true;
      }
      if (screen === 'settings') {
        state.goBack();
        return true;
      }
      return false; // Let default behavior (exit app) happen on library root
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, []);
}

async function togglePlayPause(): Promise<void> {
  const playbackState = await TrackPlayer.getPlaybackState();
  if (playbackState.state === State.Playing) {
    await TrackPlayer.pause();
    usePlayerStore.getState().setIsPlaying(false);
  } else {
    await TrackPlayer.play();
    usePlayerStore.getState().setIsPlaying(true);
  }
}

async function cycleRepeatMode(): Promise<void> {
  const current = await TrackPlayer.getRepeatMode();
  const currentIndex = REPEAT_MODES.findIndex(r => r.mode === current);
  const nextIndex = (currentIndex + 1) % REPEAT_MODES.length;
  const next = REPEAT_MODES[nextIndex];
  await TrackPlayer.setRepeatMode(next.mode);
  usePlayerStore.getState().showStatus(next.name);
}

async function skipToPrev(state: ReturnType<typeof usePlayerStore.getState>): Promise<void> {
  if (state.isAlbumExperience) {
    try { await TrackPlayer.skipToPrevious(); } catch {}
  } else if (state.queueTracks.length > 1) {
    const prevIndex = state.currentQueueIndex - 1;
    if (prevIndex >= 0) {
      await state.playTrack(state.queueTracks[prevIndex], state.queueTracks);
    }
  }
}

async function skipToNext(state: ReturnType<typeof usePlayerStore.getState>): Promise<void> {
  if (state.isAlbumExperience) {
    try { await TrackPlayer.skipToNext(); } catch {}
  } else if (state.queueTracks.length > 1) {
    const nextIndex = state.currentQueueIndex + 1;
    if (nextIndex < state.queueTracks.length) {
      await state.playTrack(state.queueTracks[nextIndex], state.queueTracks);
    }
  }
}
