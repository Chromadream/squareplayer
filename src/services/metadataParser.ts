import { InteractionManager } from 'react-native';
import MetadataExtractor from '../native/MetadataExtractor';
import MetadataProgressNotification from '../native/MetadataProgress';
import {
  getUnparsedTracks,
  getUnparsedTrackCount,
  updateTrackMetadata,
  getFolderById,
  updateFolderCoverArt,
  getConfig,
  type TrackRow,
} from './database';
import { encodeContentUri } from '../utils/uri';
import { stripAudioExtension } from '../utils/audio';

const BATCH_SIZE = 5;

export type MetadataProgress = {
  total: number;
  parsed: number;
  currentTrack?: string;
};

type MetadataProgressCallback = (progress: MetadataProgress) => void;

let isRunning = false;
let totalAtStart = 0;
let parsedSoFar = 0;

/**
 * Start background metadata parsing for all unparsed tracks.
 * Processes in batches with setTimeout yielding to keep UI responsive.
 * Shows a native Android progress notification while running.
 */
export function startMetadataParsing(
  onProgress?: MetadataProgressCallback,
): void {
  if (isRunning) return;
  isRunning = true;
  parsedSoFar = 0;
  totalAtStart = getUnparsedTrackCount();

  if (totalAtStart > 0) {
    MetadataProgressNotification.show(totalAtStart).catch(() => {});
  }

  // Wait for any pending interactions (navigation animations, etc.)
  InteractionManager.runAfterInteractions(() => {
    processNextBatch(onProgress);
  });
}

export function stopMetadataParsing(): void {
  isRunning = false;
  MetadataProgressNotification.dismiss().catch(() => {});
}

async function processNextBatch(
  onProgress?: MetadataProgressCallback,
): Promise<void> {
  if (!isRunning) return;

  const unparsed = getUnparsedTracks(BATCH_SIZE);
  if (unparsed.length === 0) {
    isRunning = false;
    MetadataProgressNotification.dismiss().catch(() => {});
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
  parsedSoFar += parsed;

  // Update native notification
  MetadataProgressNotification.update(
    parsedSoFar,
    totalAtStart,
    unparsed[0]?.fileName ?? null,
  ).catch(() => {});

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
    const treeRootUri = getConfig('library_uri');
    const encodedTrackUri = encodeContentUri(track.uri, treeRootUri);
    const metadata = await MetadataExtractor.extract(encodedTrackUri);

    // Determine cover art — priority chain:
    //   1. Embedded art from the audio file
    //   2. Folder cover art (cover.jpg → disc cover.jpg → first image → disc first image)
    let coverArtUri: string | null = null;
    const folder = getFolderById(track.folderId);

    // Priority 1: Embedded art
    try {
      const embeddedArt = await MetadataExtractor.extractCoverArt(encodedTrackUri);
      if (embeddedArt) {
        coverArtUri = embeddedArt;
        // Also update the folder's cover art for folder-level display
        if (folder && !folder.coverArtUri) {
          updateFolderCoverArt(folder.id, embeddedArt);
        }
      }
    } catch {
      // Cover art extraction failed, not critical
    }

    // Priority 2: Folder cover art (resolved during scanning)
    if (!coverArtUri && folder?.coverArtUri) {
      if (folder.coverArtUri.startsWith('file://')) {
        // Already cached locally (from a previous track in this folder)
        coverArtUri = folder.coverArtUri;
      } else {
        // SAF content:// URI — encode before passing to native ContentResolver
        try {
          const encodedCoverUri = encodeContentUri(folder.coverArtUri, treeRootUri);
          const cachedPath = await MetadataExtractor.cacheSafFile(encodedCoverUri);
          coverArtUri = cachedPath;
          // Update folder so subsequent tracks skip the caching step
          updateFolderCoverArt(folder.id, cachedPath);
        } catch {
          // Caching failed, continue without cover art
          coverArtUri = null;
        }
      }
    }

    // Use metadata disc number, falling back to folder-name-derived disc number
    // that was stored during scanning (e.g. from "Disc 2" subfolder)
    const discNumber = metadata.discNumber > 0 ? metadata.discNumber : track.discNumber;

    updateTrackMetadata(
      track.uri,
      {
        title: metadata.title,
        artist: metadata.artist,
        albumArtist: metadata.albumArtist,
        album: metadata.album,
        trackNumber: metadata.trackNumber,
        discNumber,
        duration: metadata.duration,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
        bitDepth: metadata.bitDepth,
      },
      coverArtUri,
    );
  } catch (error) {
    // If metadata extraction fails, still mark as parsed with filename as title
    console.warn('Metadata extraction failed for:', track.uri, error);
    console.warn('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    updateTrackMetadata(
      track.uri,
      {
        title: stripAudioExtension(track.fileName),
        artist: null,
        albumArtist: null,
        album: null,
        trackNumber: 0,
        discNumber: track.discNumber,  // preserve folder-derived disc number
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        bitDepth: 0,
      },
      null,
    );
  }
}
