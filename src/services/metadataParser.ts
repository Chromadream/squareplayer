import { InteractionManager } from 'react-native';
import MetadataExtractor from '../native/MetadataExtractor';
import {
  getUnparsedTracks,
  updateTrackMetadata,
  getFolderById,
  updateFolderCoverArt,
  type TrackRow,
} from './database';

const BATCH_SIZE = 5;

export type MetadataProgress = {
  total: number;
  parsed: number;
  currentTrack?: string;
};

type MetadataProgressCallback = (progress: MetadataProgress) => void;

let isRunning = false;

/**
 * Start background metadata parsing for all unparsed tracks.
 * Processes in batches with setTimeout yielding to keep UI responsive.
 */
export function startMetadataParsing(
  onProgress?: MetadataProgressCallback,
): void {
  if (isRunning) return;
  isRunning = true;

  // Wait for any pending interactions (navigation animations, etc.)
  InteractionManager.runAfterInteractions(() => {
    processNextBatch(onProgress);
  });
}

export function stopMetadataParsing(): void {
  isRunning = false;
}

async function processNextBatch(
  onProgress?: MetadataProgressCallback,
): Promise<void> {
  if (!isRunning) return;

  const unparsed = getUnparsedTracks(BATCH_SIZE);
  if (unparsed.length === 0) {
    isRunning = false;
    onProgress?.({ total: 0, parsed: 0 });
    return;
  }

  // Get total remaining for progress reporting
  const totalRemaining = unparsed.length; // approximate - we only fetched a batch

  // Process the batch in parallel on native threads
  const results = await Promise.allSettled(
    unparsed.map(track => extractAndSave(track)),
  );

  const parsed = results.filter(r => r.status === 'fulfilled').length;
  onProgress?.({
    total: totalRemaining,
    parsed,
    currentTrack: unparsed[0]?.fileName,
  });

  // Yield to the UI thread, then continue with next batch
  if (isRunning) {
    setTimeout(() => processNextBatch(onProgress), 0);
  }
}

async function extractAndSave(track: TrackRow): Promise<void> {
  try {
    const metadata = await MetadataExtractor.extract(track.uri);

    // Determine cover art: folder's cover.jpg/png has priority
    let coverArtUri: string | null = null;
    const folder = getFolderById(track.folderId);

    if (folder?.coverArtUri) {
      // Folder has a cover.jpg/cover.png - use it
      coverArtUri = folder.coverArtUri;
    } else {
      // Fallback: try to extract embedded cover art
      try {
        const embeddedArt = await MetadataExtractor.extractCoverArt(track.uri);
        if (embeddedArt) {
          coverArtUri = embeddedArt;
          // Also update the folder's cover art so other tracks in the same folder benefit
          if (folder && !folder.coverArtUri) {
            updateFolderCoverArt(folder.id, embeddedArt);
          }
        }
      } catch {
        // Cover art extraction failed, not critical
      }
    }

    updateTrackMetadata(
      track.uri,
      {
        title: metadata.title,
        artist: metadata.artist,
        albumArtist: metadata.albumArtist,
        album: metadata.album,
        trackNumber: metadata.trackNumber,
        duration: metadata.duration,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
        bitDepth: metadata.bitDepth,
      },
      coverArtUri,
    );
  } catch (error) {
    // If metadata extraction fails, still mark as parsed with filename as title
    updateTrackMetadata(
      track.uri,
      {
        title: track.fileName.replace(/\.flac$/i, ''),
        artist: null,
        albumArtist: null,
        album: null,
        trackNumber: 0,
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        bitDepth: 0,
      },
      null,
    );
  }
}
