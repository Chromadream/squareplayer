import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { usePlayerStore } from './src/store/playerStore';
import { useGamepadInput } from './src/hooks/useGamepadInput';
import { setupPlayer } from './src/services/playback';
import {
  hasLibrary,
  pickMusicFolder,
  scanLibrary,
} from './src/services/scanner';
import {
  startMetadataParsing,
  stopMetadataParsing,
} from './src/services/metadataParser';
import MetadataProgressNotification from './src/native/MetadataProgress';
import NotificationPermission from './src/native/NotificationPermission';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import FolderScreen from './src/screens/FolderScreen';
import SetupScreen from './src/screens/SetupScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TrackInfoOverlay from './src/components/TrackInfoOverlay';
import ButtonHintBar from './src/components/ButtonHintBar';
import StatusOverlay from './src/components/StatusOverlay';
import { Event, useTrackPlayerEvents } from 'react-native-track-player';

function App(): React.JSX.Element {
  const [isReady, setIsReady] = useState(false);
  const [hasLib, setHasLib] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const {
    currentScreen,
    refreshLibrary,
    setScanning,
    setMetadataProgress,
    setIsPlaying,
    hydrateSettings,
  } = usePlayerStore();

  // Set up gamepad input globally
  useGamepadInput();

  // Track playback state changes
  useTrackPlayerEvents(
    [Event.PlaybackState],
    async event => {
      if (event.type === Event.PlaybackState) {
        const playing = event.state === 'playing';
        setIsPlaying(playing);
      }
    },
  );

  // Track changes in Album Experience mode
  useTrackPlayerEvents(
    [Event.PlaybackActiveTrackChanged],
    async event => {
      if (event.type === Event.PlaybackActiveTrackChanged && event.track) {
        const store = usePlayerStore.getState();
        if (store.isAlbumExperience) {
          // Update queue index and resolve the correct TrackRow for display
          const index = event.index ?? 0;
          const matchedTrack = store.queueTracks[index];
          usePlayerStore.setState({
            currentQueueIndex: index,
            ...(matchedTrack ? { currentTrack: matchedTrack } : {}),
          });
        }
      }
    },
  );

  // Initialize on mount
  useEffect(() => {
    (async () => {
      await setupPlayer();

      // Request notification permission on Android 13+
      try {
        await NotificationPermission.requestPermission();
      } catch (error) {
        console.warn('Failed to request notification permission:', error);
      }

      // Hydrate persisted settings (controller layout, seek amounts, etc.)
      hydrateSettings();

      const lib = hasLibrary();
      setHasLib(lib);

      if (lib) {
        // Run incremental scan
        setScanning(true, 'Scanning library...');
        // Show native notification so Android keeps us alive in background
        MetadataProgressNotification.show(0).catch(() => {});
        try {
          await scanLibrary(progress => {
            if (progress.phase === 'done') {
              setScanning(false);
              refreshLibrary();
              // Start background metadata parsing
              startMetadataParsing(mp => {
                if (mp.total === 0) {
                  setMetadataProgress('');
                  refreshLibrary(); // Final refresh when all metadata is done
                } else {
                  setMetadataProgress(
                    `Parsing metadata: ${mp.currentTrack ?? '...'}`,
                  );
                  refreshLibrary(); // Refresh to show updated titles
                }
              });
            } else {
              const label = `${progress.phase}: ${progress.currentName ?? ''} (${progress.current}/${progress.total})`;
              setScanning(true, label);
              MetadataProgressNotification.update(progress.current, 0, label).catch(() => {});
            }
          });
        } catch (error) {
          console.error('Scan error during app initialization:', error);
          console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
          setScanning(false);
          MetadataProgressNotification.dismiss().catch(() => {});
        }
      }

      setIsReady(true);
    })();

    return () => {
      stopMetadataParsing();
    };
  }, []);

  const handlePickFolder = useCallback(async () => {
    setIsPicking(true);
    const uri = await pickMusicFolder();
    setIsPicking(false);

    if (uri) {
      setHasLib(true);
      setScanning(true, 'Scanning library...');
      // Show native notification so Android keeps us alive in background
      MetadataProgressNotification.show(0).catch(() => {});

      try {
        await scanLibrary(progress => {
          if (progress.phase === 'done') {
            setScanning(false);
            refreshLibrary();
            startMetadataParsing(mp => {
              if (mp.total === 0) {
                setMetadataProgress('');
                refreshLibrary();
              } else {
                setMetadataProgress(
                  `Parsing metadata: ${mp.currentTrack ?? '...'}`,
                );
                refreshLibrary();
              }
            });
          } else {
            const label = `${progress.phase}: ${progress.currentName ?? ''} (${progress.current}/${progress.total})`;
            setScanning(true, label);
            MetadataProgressNotification.update(progress.current, 0, label).catch(() => {});
          }
        });
      } catch (error) {
        console.error('Scan error during folder pick:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
        setScanning(false);
        MetadataProgressNotification.dismiss().catch(() => {});
      }
    }
  }, [refreshLibrary, setScanning, setMetadataProgress]);

  if (!isReady) {
    return <View style={styles.container} />;
  }

  if (!hasLib) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <SetupScreen onPickFolder={handlePickFolder} isPicking={isPicking} />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000"
        translucent={currentScreen === 'nowplaying'}
      />
      {currentScreen === 'nowplaying' && <NowPlayingScreen />}
      {currentScreen === 'library' && <LibraryScreen />}
      {currentScreen === 'folder' && <FolderScreen />}
      {currentScreen === 'settings' && <SettingsScreen />}
      <StatusOverlay />
      <TrackInfoOverlay />
      <ButtonHintBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});

export default App;
