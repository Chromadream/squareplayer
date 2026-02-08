import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import KeyEvent from 'react-native-keyevent';
import TrackPlayer, { RepeatMode, State } from 'react-native-track-player';
import { usePlayerStore } from '../store/playerStore';
import { updateFolderAlbumExperience, getFolderById } from '../services/database';
import type { TrackRow } from '../services/database';

// Android KeyEvent keycodes — D-pad
const KEYCODE_DPAD_UP = 19;
const KEYCODE_DPAD_DOWN = 20;
const KEYCODE_DPAD_LEFT = 21;
const KEYCODE_DPAD_RIGHT = 22;
const KEYCODE_DPAD_CENTER = 23;

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
const REPEAT_MODES = [RepeatMode.Track, RepeatMode.Queue, RepeatMode.Off];
const REPEAT_MODE_NAMES = ['Repeat Track', 'Repeat Queue', 'Repeat Off'];

function isTrackRow(item: any): item is TrackRow {
  return item && typeof item === 'object' && 'uri' in item && 'fileName' in item;
}

export function useGamepadInput(): void {
  useEffect(() => {
    const handleKeyDown = async (event: { keyCode: number }) => {
      const { keyCode } = event;
      const state = usePlayerStore.getState();

      // ── Track info overlay is open → A or B dismisses it ──
      if (state.inspectedTrack) {
        if (
          keyCode === KEYCODE_BUTTON_A ||
          keyCode === KEYCODE_DPAD_CENTER ||
          keyCode === KEYCODE_BUTTON_B
        ) {
          state.hideTrackInfo();
          return;
        }
        // Block all other input while overlay is open
        return;
      }

      // ── Select button → Settings from any screen ──
      if (keyCode === KEYCODE_BUTTON_SELECT) {
        if (state.currentScreen !== 'settings') {
          state.navigateToSettings();
        }
        return;
      }

      // ── Start button → toggle library ↔ now playing ──
      if (keyCode === KEYCODE_BUTTON_START) {
        if (state.currentScreen === 'nowplaying') {
          state.navigateToLibrary();
        } else if (state.currentScreen !== 'settings' && state.currentTrack) {
          state.navigateToNowPlaying();
        }
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

        // A / Center → play/pause
        if (keyCode === KEYCODE_DPAD_CENTER || keyCode === KEYCODE_BUTTON_A) {
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

        // Up/Down on now playing in Album Experience mode → skip tracks
        if (isAlbumExperience) {
          if (keyCode === KEYCODE_DPAD_UP) {
            try { await TrackPlayer.skipToPrevious(); } catch {}
            return;
          }
          if (keyCode === KEYCODE_DPAD_DOWN) {
            try { await TrackPlayer.skipToNext(); } catch {}
            return;
          }
        }

        // X → cycle repeat mode
        if (keyCode === KEYCODE_BUTTON_X) {
          await cycleRepeatMode();
          return;
        }

        // Y → show track info for current track
        if (keyCode === KEYCODE_BUTTON_Y) {
          if (state.currentTrack) {
            state.showTrackInfo(state.currentTrack);
          }
          return;
        }

        // L1 → skip to previous track
        if (keyCode === KEYCODE_BUTTON_L1) {
          try { await TrackPlayer.skipToPrevious(); } catch {}
          return;
        }

        // R1 → skip to next track
        if (keyCode === KEYCODE_BUTTON_R1) {
          try { await TrackPlayer.skipToNext(); } catch {}
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
          // C → toggle shuffle (not yet implemented in track player, placeholder)
          if (keyCode === KEYCODE_BUTTON_C) {
            // Future: toggle shuffle mode
            return;
          }

          // Z → restart track from beginning
          if (keyCode === KEYCODE_BUTTON_Z) {
            await TrackPlayer.seekTo(0);
            return;
          }
        }

        return;
      }

      // ══════════════════════════════════════════
      // LIBRARY / FOLDER SCREENS
      // ══════════════════════════════════════════
      if (screen === 'library' || screen === 'folder') {
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

        // L2/R2 on list screens — currently unbound
        if (keyCode === KEYCODE_BUTTON_L2 || keyCode === KEYCODE_BUTTON_R2) {
          return;
        }

        // X on folder screen → toggle Album Experience
        if (keyCode === KEYCODE_BUTTON_X) {
          if (screen === 'folder' && state.currentFolder) {
            const folder = state.currentFolder;
            const newValue = folder.isAlbumExperience !== 1;
            updateFolderAlbumExperience(folder.id, newValue);
            // Refresh the folder in the store so UI updates immediately
            const updatedFolder = getFolderById(folder.id);
            if (updatedFolder) {
              usePlayerStore.setState({
                currentFolder: updatedFolder,
                currentFolderTracks: state.currentFolderTracks.map(t => ({
                  ...t,
                  isAlbumExperience: newValue ? 1 : 0,
                })),
              });
            }
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

        // D-pad and A/Center are handled by RN focus system + FocusablePressable onPress
        return;
      }

      // ══════════════════════════════════════════
      // SETTINGS SCREEN
      // ══════════════════════════════════════════
      if (screen === 'settings') {
        // D-pad and A/Center are handled by focus system + FocusablePressable
        // B is handled above
        return;
      }
    };

    KeyEvent.onKeyDownListener(handleKeyDown);

    return () => {
      KeyEvent.removeKeyDownListener();
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
  const currentIndex = REPEAT_MODES.indexOf(current);
  const nextIndex = (currentIndex + 1) % REPEAT_MODES.length;
  await TrackPlayer.setRepeatMode(REPEAT_MODES[nextIndex]);
  // Could show a toast here: REPEAT_MODE_NAMES[nextIndex]
}
