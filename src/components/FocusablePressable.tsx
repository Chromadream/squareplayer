import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { requestNativeFocus } from '../native/FocusHelper';
import NowPlayingGlow from './NowPlayingGlow';

interface FocusablePressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  focusData?: any;
  onPress?: () => void;
  /** When true, programmatically requests focus after mount (for gamepad nav). */
  autoFocus?: boolean;
  /** When true, renders an animated iridescent glow to indicate the now-playing item. */
  isNowPlaying?: boolean;
  children: React.ReactNode;
}

/**
 * A Pressable that tracks focus state via onFocus/onBlur,
 * applying a highlight style when focused (for gamepad/d-pad navigation).
 * Optionally reports the focused item to the global store via focusData.
 */
export default function FocusablePressable({
  style,
  focusedStyle,
  focusData,
  onFocus,
  onBlur,
  onPress,
  autoFocus,
  isNowPlaying,
  children,
  ...rest
}: FocusablePressableProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const pressableRef = useRef<View>(null);

  // Programmatically grab focus when autoFocus is set (e.g. first list item)
  useEffect(() => {
    if (autoFocus && pressableRef.current) {
      // Short delay lets the FlatList finish layout before requesting focus
      const timer = setTimeout(() => {
        requestNativeFocus(pressableRef);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      if (focusData !== undefined) {
        usePlayerStore.getState().setFocusedItem(focusData);
      }
      // For settings screen: register the onPress handler
      if (onPress) {
        usePlayerStore.getState().setFocusedSettingAction(onPress);
      }
      onFocus?.(e);
    },
    [onFocus, focusData, onPress],
  );

  const handleBlur = useCallback(
    (e: any) => {
      setIsFocused(false);
      // Intentionally NOT clearing focusedItem on blur —
      // Android may fire focus on new item before blur on old item
      onBlur?.(e);
    },
    [onBlur],
  );

  return (
    <Pressable
      ref={pressableRef}
      style={[style, isFocused && focusedStyle]}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onPress}
      {...rest}
    >
      {isNowPlaying && <NowPlayingGlow />}
      {children}
    </Pressable>
  );
}
