import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

/**
 * An absolutely-positioned animated overlay that cycles through
 * iridescent colors to indicate the currently playing item.
 * Place as the first child of a positioned container.
 */
export default function NowPlayingGlow(): React.JSX.Element {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
    outputRange: [
      'rgba(148, 103, 255, 0.10)',
      'rgba(80, 170, 255, 0.10)',
      'rgba(80, 255, 200, 0.10)',
      'rgba(255, 200, 80, 0.10)',
      'rgba(255, 100, 180, 0.10)',
      'rgba(148, 103, 255, 0.10)',
    ],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
    outputRange: [
      'rgba(148, 103, 255, 0.55)',
      'rgba(80, 170, 255, 0.55)',
      'rgba(80, 255, 200, 0.55)',
      'rgba(255, 200, 80, 0.55)',
      'rgba(255, 100, 180, 0.55)',
      'rgba(148, 103, 255, 0.55)',
    ],
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.glow, { backgroundColor, borderColor }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    borderWidth: 1.5,
    borderRadius: 8,
  },
});
