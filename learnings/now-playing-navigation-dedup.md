# Now-Playing Navigation Dedup & Folder Scroll Fix (Feb 2026)

## Problem

Two related bugs on the FolderScreen:

1. **Scroll kept resetting**: The FlatList would snap back to the now-playing track whenever the playing track changed (e.g., album experience auto-advancing). This made it impossible to browse the track list while music was playing.
2. **"Navigate to now-playing" logic was duplicated and broken**: Both the `onPress` handlers in screen components (FolderScreen, LibraryScreen) and the gamepad A-button handler in `useGamepadInput` had their own `isNowPlaying ? navigateToNowPlaying : play` logic. The gamepad hook's version didn't have the check, so pressing A on a playing track would restart playback instead of navigating to the now-playing screen.

## Root Cause

### Scroll issue
The scroll-to-now-playing `useEffect` in FolderScreen had `nowPlayingIndex` and `listItems` in its dependency array. When the current track changed (auto-advance), `nowPlayingIndex` updated → the effect re-fired → the list snapped back to the playing item and re-triggered `autoFocus`, stealing focus from wherever the user had scrolled to.

### Duplicated navigation logic
The `onPress` prop on `FocusablePressable` is used for touch/click, but gamepad input goes through `useGamepadInput` → `focusedItem` → `playTrack()`. The screen-level `onPress` with `isNowPlaying` conditional was never reached by the gamepad path, so the two diverged.

## Fix

### Scroll: one-shot initial scroll
Added a `hasInitialScrolled` ref to gate the scroll effect so it fires **once** on mount only. Removed `nowPlayingIndex` and `listItems` (the reference) from the dependency array.

### Navigation: now-playing check in both `useGamepadInput` and screen `onPress`
- Added the `isNowPlaying` check into the gamepad hook's A-button handler for library/folder screens: if `state.currentTrack.id === focused.id`, call `navigateToNowPlaying()` instead of `playTrack()`.
- **Kept** the `isNowPlaying ? navigateToNowPlaying : onPress` conditionals in `FolderScreen`, `LibraryScreen` (`FolderItem`, `TrackItem`) — these are still needed for **touch input**, which goes through `onPress` directly and bypasses the gamepad hook.

## Architecture Principle

**The `isNowPlaying` → `navigateToNowPlaying` check must exist in two places:**
1. `useGamepadInput` — for gamepad A-button presses (routed via `focusedItem` store state)
2. Screen component `onPress` handlers — for touch/tap input (goes directly through React Native's Pressable)

Both paths need the guard independently because they are separate input channels.

## Files Changed

- `src/hooks/useGamepadInput.ts` — Added `currentTrack.id === focused.id` check before `playTrack()` on A-button
- `src/screens/FolderScreen.tsx` — Removed `navigateToNowPlaying` from store destructuring and `onPress`; added `hasInitialScrolled` ref to gate scroll effect
- `src/screens/LibraryScreen.tsx` — Removed `navigateToNowPlaying` from `FolderItem` and `TrackItem` sub-components
