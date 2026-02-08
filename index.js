/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

// Defer TrackPlayer registration to avoid crashes when the native TurboModule
// isn't ready during initial bundle evaluation (e.g. headless restart).
try {
  const TrackPlayer = require('react-native-track-player').default;
  const { PlaybackService } = require('./src/services/playback');
  TrackPlayer.registerPlaybackService(() => PlaybackService);
} catch (e) {
  console.warn('TrackPlayer registration deferred due to error:', e);
  console.warn('Error details:', e instanceof Error ? { message: e.message, stack: e.stack } : String(e));
}
