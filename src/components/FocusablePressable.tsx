import React, { useCallback, useState } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';

interface FocusablePressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  focusData?: any;
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
  children,
  ...rest
}: FocusablePressableProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      if (focusData !== undefined) {
        usePlayerStore.getState().setFocusedItem(focusData);
      }
      onFocus?.(e);
    },
    [onFocus, focusData],
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
      style={[style, isFocused && focusedStyle]}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
