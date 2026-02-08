import { listFiles, openDocumentTree } from 'react-native-saf-x';
import {
  setConfig,
  getConfig,
  upsertFolder,
  upsertTrack,
  getAllFolders,
  getTracksByFolder,
  deleteTracksByUris,
  deleteFoldersByUris,
  updateFolderTrackCount,
  updateFolderCoverArt,
  updateFolderAlbumExperience,
  type FolderRow,
} from './database';
import { AUDIO_FILE_REGEX } from '../utils/audio';

export interface ScanProgress {
  phase: 'folders' | 'tracks' | 'done';
  total: number;
  current: number;
  currentName?: string;
}

type ProgressCallback = (progress: ScanProgress) => void;

const COVER_ART_REGEX = /^cover\.(jpg|jpeg|png)$/i;
const IMAGE_FILE_REGEX = /\.(jpg|jpeg|png)$/i;
const DISC_FOLDER_REGEX = /^(disc|cd|disk)\s*\d+$/i;

type FileEntry = { type: string; name: string; uri: string };

/**
 * Find cover art across a folder and its disc subfolders.
 * Priority chain:
 *   1. cover.jpg/jpeg/png in the folder
 *   2. cover.jpg/jpeg/png in the first disc subfolder that has one
 *   3. First JPEG/PNG in the folder
 *   4. First JPEG/PNG in the first disc subfolder that has one
 */
function findCoverArt(
  entries: FileEntry[],
  discFolderEntries?: FileEntry[][],
): FileEntry | undefined {
  // 1. cover.* in the folder itself
  const folderCover = entries.find(
    e => e.type === 'file' && COVER_ART_REGEX.test(e.name),
  );
  if (folderCover) return folderCover;

  // 2. cover.* in a disc subfolder
  if (discFolderEntries) {
    for (const discEntries of discFolderEntries) {
      const discCover = discEntries.find(
        e => e.type === 'file' && COVER_ART_REGEX.test(e.name),
      );
      if (discCover) return discCover;
    }
  }

  // 3. First image file in the folder
  const folderImage = entries.find(
    e => e.type === 'file' && IMAGE_FILE_REGEX.test(e.name),
  );
  if (folderImage) return folderImage;

  // 4. First image file in a disc subfolder
  if (discFolderEntries) {
    for (const discEntries of discFolderEntries) {
      const discImage = discEntries.find(
        e => e.type === 'file' && IMAGE_FILE_REGEX.test(e.name),
      );
      if (discImage) return discImage;
    }
  }

  return undefined;
}

// Root folder virtual name
const ROOT_FOLDER_NAME = '__root__';

/**
 * Open the SAF folder picker and persist the selected URI
 */
export async function pickMusicFolder(): Promise<string | null> {
  try {
    const result = await openDocumentTree(true);
    if (result?.uri) {
      setConfig('library_uri', result.uri);
      setConfig('library_name', result.name ?? 'Music');
      return result.uri;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the currently configured library URI
 */
export function getLibraryUri(): string | null {
  return getConfig('library_uri');
}

/**
 * Scan the library folder, performing incremental updates where possible.
 * Structure: root can contain audio files (.flac, .mp3) and 1-level-deep subfolders.
 * @param onProgress Optional callback to report scan progress
 * @param fullRescan If true, forces all tracks to be rescanned even if unchanged
 */
export async function scanLibrary(
  onProgress?: ProgressCallback,
  fullRescan?: boolean,
): Promise<void> {
  const rootUri = getConfig('library_uri');
  if (!rootUri) {
    throw new Error('No library folder configured');
  }

  // Phase 1: List root directory
  onProgress?.({ phase: 'folders', total: 0, current: 0, currentName: 'Scanning root...' });

  const rootEntries = await listFiles(rootUri);

  // Separate into files and directories
  const rootAudioFiles = rootEntries.filter(
    e => e.type === 'file' && AUDIO_FILE_REGEX.test(e.name),
  );
  const rootCoverArt = findCoverArt(rootEntries);
  const subDirectories = rootEntries.filter(e => e.type === 'directory');

  // Upsert root virtual folder
  const rootFolderId = upsertFolder(
    rootUri,
    ROOT_FOLDER_NAME,
    rootCoverArt?.uri ?? null,
  );

  // Track which folder URIs we see in the current scan
  const seenFolderUris = new Set<string>([rootUri]);

  // Phase 2: Scan subfolders
  const totalFolders = subDirectories.length;
  const folderScanResults: Array<{
    folderId: number;
    uri: string;
    files: Array<{ uri: string; name: string; size: number; lastModified: number; discNumber: number }>;
    coverArtUri: string | null;
  }> = [];

  for (let i = 0; i < subDirectories.length; i++) {
    const dir = subDirectories[i];
    onProgress?.({
      phase: 'folders',
      total: totalFolders,
      current: i + 1,
      currentName: dir.name,
    });

    seenFolderUris.add(dir.uri);

    // List files inside the subfolder
    const subEntries = await listFiles(dir.uri);
    const subAudioFiles = subEntries.filter(
      e => e.type === 'file' && AUDIO_FILE_REGEX.test(e.name),
    );
    // Check for disc subfolders (e.g. "Disc 1", "CD 2", "Disk 3")
    const discSubDirs = subEntries.filter(
      e => e.type === 'directory' && DISC_FOLDER_REGEX.test(e.name),
    );

    // Collect all audio files: direct files + files from disc subfolders
    let allAudioFiles = subAudioFiles.map(f => ({
      uri: f.uri,
      name: f.name,
      size: f.size ?? 0,
      lastModified: f.lastModified ?? 0,
      discNumber: 0,
    }));

    // Also collect disc folder entries for cover art lookup
    const allDiscEntries: FileEntry[][] = [];

    for (const discDir of discSubDirs) {
      // Extract disc number from folder name (e.g. "Disc 1" → 1, "CD 2" → 2)
      const discMatch = discDir.name.match(/\d+/);
      const folderDiscNumber = discMatch ? parseInt(discMatch[0], 10) : 0;

      const discEntries = await listFiles(discDir.uri);
      allDiscEntries.push(discEntries);
      const discAudioFiles = discEntries.filter(
        e => e.type === 'file' && AUDIO_FILE_REGEX.test(e.name),
      );
      allAudioFiles = allAudioFiles.concat(
        discAudioFiles.map(f => ({
          uri: f.uri,
          name: f.name,
          size: f.size ?? 0,
          lastModified: f.lastModified ?? 0,
          discNumber: folderDiscNumber,
        })),
      );
    }

    // Find cover art across folder and disc subfolders
    const subCoverArt = findCoverArt(subEntries, allDiscEntries);

    const folderId = upsertFolder(
      dir.uri,
      dir.name,
      subCoverArt?.uri ?? null,
    );

    // Sync Album Experience with .album marker file presence
    const hasAlbumMarker = subEntries.some(
      e => e.type === 'file' && e.name === '.album',
    );
    updateFolderAlbumExperience(folderId, hasAlbumMarker);

    folderScanResults.push({
      folderId,
      uri: dir.uri,
      files: allAudioFiles,
      coverArtUri: subCoverArt?.uri ?? null,
    });
  }

  // Phase 3: Remove folders that no longer exist
  const existingFolders = getAllFolders();
  const deletedFolderUris = existingFolders
    .filter(f => !seenFolderUris.has(f.uri))
    .map(f => f.uri);
  if (deletedFolderUris.length > 0) {
    deleteFoldersByUris(deletedFolderUris);
  }

  // Phase 4: Incremental track sync for root folder
  onProgress?.({ phase: 'tracks', total: 0, current: 0, currentName: 'Syncing root tracks...' });

  await syncTracksForFolder(
    rootFolderId,
    rootAudioFiles.map(f => ({
      uri: f.uri,
      name: f.name,
      size: f.size ?? 0,
      lastModified: f.lastModified ?? 0,
      discNumber: 0,
    })),
    fullRescan,
  );
  updateFolderTrackCount(rootFolderId);

  // Phase 5: Incremental track sync for each subfolder
  const totalTrackFolders = folderScanResults.length;
  for (let i = 0; i < folderScanResults.length; i++) {
    const folder = folderScanResults[i];
    onProgress?.({
      phase: 'tracks',
      total: totalTrackFolders,
      current: i + 1,
      currentName: folder.uri,
    });

    await syncTracksForFolder(folder.folderId, folder.files, fullRescan);
    updateFolderTrackCount(folder.folderId);
  }

  setConfig('last_scan_at', new Date().toISOString());
  onProgress?.({ phase: 'done', total: 0, current: 0 });
}

/**
 * Sync tracks for a single folder: diff filesystem vs DB,
 * insert new, mark changed for rescan, delete removed.
 * @param fullRescan If true, forces all tracks to be re-inserted even if unchanged
 */
function syncTracksForFolder(
  folderId: number,
  currentFiles: Array<{
    uri: string;
    name: string;
    size: number;
    lastModified: number;
    discNumber: number;
  }>,
  fullRescan?: boolean,
): void {
  const existingTracks = getTracksByFolder(folderId);
  const existingMap = new Map(existingTracks.map(t => [t.uri, t]));
  const seenUris = new Set<string>();

  for (const file of currentFiles) {
    seenUris.add(file.uri);
    const existing = existingMap.get(file.uri);

    if (!existing) {
      // New file
      upsertTrack(
        file.uri,
        file.name,
        file.size,
        file.lastModified,
        folderId,
        file.discNumber,
      );
    } else if (
      fullRescan ||
      existing.lastModified !== file.lastModified ||
      existing.fileSize !== file.size
    ) {
      // Changed file or full rescan - re-insert triggers metadataParsed = 0
      upsertTrack(
        file.uri,
        file.name,
        file.size,
        file.lastModified,
        folderId,
        file.discNumber,
      );
    }
    // else: unchanged, skip
  }

  // Delete tracks that no longer exist on disk
  const deletedUris = existingTracks
    .filter(t => !seenUris.has(t.uri))
    .map(t => t.uri);
  if (deletedUris.length > 0) {
    deleteTracksByUris(deletedUris);
  }
}

/**
 * Check if a library is configured
 */
export function hasLibrary(): boolean {
  return getConfig('library_uri') !== null;
}

/**
 * Get the root folder name
 */
export function getRootFolderName(): string {
  return ROOT_FOLDER_NAME;
}
