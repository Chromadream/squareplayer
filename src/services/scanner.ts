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
  type FolderRow,
} from './database';

export interface ScanProgress {
  phase: 'folders' | 'tracks' | 'done';
  total: number;
  current: number;
  currentName?: string;
}

type ProgressCallback = (progress: ScanProgress) => void;

const COVER_ART_REGEX = /^cover\.(jpg|jpeg|png)$/i;
const FLAC_REGEX = /\.flac$/i;
const DISC_FOLDER_REGEX = /^(disc|cd|disk)\s*\d+$/i;

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
 * Structure: root can contain .flac files and 1-level-deep subfolders.
 */
export async function scanLibrary(
  onProgress?: ProgressCallback,
): Promise<void> {
  const rootUri = getConfig('library_uri');
  if (!rootUri) {
    throw new Error('No library folder configured');
  }

  // Phase 1: List root directory
  onProgress?.({ phase: 'folders', total: 0, current: 0, currentName: 'Scanning root...' });

  const rootEntries = await listFiles(rootUri);

  // Separate into files and directories
  const rootFlacFiles = rootEntries.filter(
    e => e.type === 'file' && FLAC_REGEX.test(e.name),
  );
  const rootCoverArt = rootEntries.find(
    e => e.type === 'file' && COVER_ART_REGEX.test(e.name),
  );
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
    files: Array<{ uri: string; name: string; size: number; lastModified: number }>;
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
    const subFlacFiles = subEntries.filter(
      e => e.type === 'file' && FLAC_REGEX.test(e.name),
    );
    const subCoverArt = subEntries.find(
      e => e.type === 'file' && COVER_ART_REGEX.test(e.name),
    );

    // Check for disc subfolders (e.g. "Disc 1", "CD 2", "Disk 3")
    const discSubDirs = subEntries.filter(
      e => e.type === 'directory' && DISC_FOLDER_REGEX.test(e.name),
    );

    // Collect all flac files: direct files + files from disc subfolders
    let allFlacFiles = subFlacFiles.map(f => ({
      uri: f.uri,
      name: f.name,
      size: f.size ?? 0,
      lastModified: f.lastModified ?? 0,
    }));

    for (const discDir of discSubDirs) {
      const discEntries = await listFiles(discDir.uri);
      const discFlacFiles = discEntries.filter(
        e => e.type === 'file' && FLAC_REGEX.test(e.name),
      );
      allFlacFiles = allFlacFiles.concat(
        discFlacFiles.map(f => ({
          uri: f.uri,
          name: f.name,
          size: f.size ?? 0,
          lastModified: f.lastModified ?? 0,
        })),
      );
    }

    const folderId = upsertFolder(
      dir.uri,
      dir.name,
      subCoverArt?.uri ?? null,
    );

    folderScanResults.push({
      folderId,
      uri: dir.uri,
      files: allFlacFiles,
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
    rootFlacFiles.map(f => ({
      uri: f.uri,
      name: f.name,
      size: f.size ?? 0,
      lastModified: f.lastModified ?? 0,
    })),
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

    await syncTracksForFolder(folder.folderId, folder.files);
    updateFolderTrackCount(folder.folderId);
  }

  setConfig('last_scan_at', new Date().toISOString());
  onProgress?.({ phase: 'done', total: 0, current: 0 });
}

/**
 * Sync tracks for a single folder: diff filesystem vs DB,
 * insert new, mark changed for rescan, delete removed.
 */
function syncTracksForFolder(
  folderId: number,
  currentFiles: Array<{
    uri: string;
    name: string;
    size: number;
    lastModified: number;
  }>,
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
      );
    } else if (
      existing.lastModified !== file.lastModified ||
      existing.fileSize !== file.size
    ) {
      // Changed file - re-insert triggers metadataParsed = 0
      upsertTrack(
        file.uri,
        file.name,
        file.size,
        file.lastModified,
        folderId,
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
