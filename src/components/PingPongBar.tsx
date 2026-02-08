import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface PingPongBarProps {
  width?: number;
  height?: number;
  color?: string;
  trackColor?: string;
}

export default function PingPongBar({
  width = 200,
  height = 4,
  color = '#4a9eff',
  trackColor = '#1a1a2e',
}: PingPongBarProps): React.JSX.Element {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const barWidth = width * 0.35;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - barWidth],
  });

  return (
    <View style={[styles.track, { width, height, borderRadius: height / 2, backgroundColor: trackColor }]}>
      <Animated.View
        style={[
          styles.bar,
          {
            width: barWidth,
            height,
            borderRadius: height / 2,
            backgroundColor: color,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
