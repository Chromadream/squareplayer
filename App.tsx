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
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import FolderScreen from './src/screens/FolderScreen';
import SetupScreen from './src/screens/SetupScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TrackInfoOverlay from './src/components/TrackInfoOverlay';
import ButtonHintBar from './src/components/ButtonHintBar';
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
          // Update queue index
          const index = event.index ?? 0;
          usePlayerStore.setState({ currentQueueIndex: index });
        }
      }
    },
  );

  // Initialize on mount
  useEffect(() => {
    (async () => {
      await setupPlayer();

      // Hydrate persisted settings (controller layout, seek amounts, etc.)
      hydrateSettings();

      const lib = hasLibrary();
      setHasLib(lib);

      if (lib) {
        // Run incremental scan
        setScanning(true, 'Scanning library...');
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
              setScanning(
                true,
                `${progress.phase}: ${progress.currentName ?? ''} (${progress.current}/${progress.total})`,
              );
            }
          });
        } catch (error) {
          console.error('Scan error:', error);
          setScanning(false);
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
            setScanning(
              true,
              `${progress.phase}: ${progress.currentName ?? ''} (${progress.current}/${progress.total})`,
            );
          }
        });
      } catch (error) {
        console.error('Scan error:', error);
        setScanning(false);
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
