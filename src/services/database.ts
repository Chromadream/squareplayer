import { open, type DB } from '@op-engineering/op-sqlite';

let db: DB | null = null;

export function getDatabase(): DB {
  if (!db) {
    db = open({ name: 'squareplayer.db' });
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(database: DB): void {
  database.executeSync(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS folders (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      uri                 TEXT NOT NULL UNIQUE,
      name                TEXT NOT NULL,
      isAlbumExperience   INTEGER NOT NULL DEFAULT 0,
      coverArtUri         TEXT,
      trackCount          INTEGER NOT NULL DEFAULT 0
    );
  `);

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS tracks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      uri           TEXT NOT NULL UNIQUE,
      fileName      TEXT NOT NULL,
      title         TEXT,
      artist        TEXT,
      album         TEXT,
      trackNumber   INTEGER NOT NULL DEFAULT 0,
      duration      REAL NOT NULL DEFAULT 0,
      bitrate       INTEGER NOT NULL DEFAULT 0,
      sampleRate    INTEGER NOT NULL DEFAULT 0,
      bitDepth      INTEGER NOT NULL DEFAULT 0,
      fileSize      INTEGER NOT NULL DEFAULT 0,
      coverArtUri   TEXT,
      folderId      INTEGER NOT NULL,
      isAlbumExperience INTEGER NOT NULL DEFAULT 0,
      lastModified  INTEGER NOT NULL DEFAULT 0,
      metadataParsed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (folderId) REFERENCES folders(id) ON DELETE CASCADE
    );
  `);

  database.executeSync(`
    CREATE INDEX IF NOT EXISTS idx_tracks_folderId ON tracks(folderId);
  `);

  database.executeSync(`
    CREATE INDEX IF NOT EXISTS idx_tracks_metadataParsed ON tracks(metadataParsed);
  `);

  // Migration: add albumArtist column if it doesn't exist
  try {
    database.executeSync(`ALTER TABLE tracks ADD COLUMN albumArtist TEXT`);
  } catch (e) {
    // Column already exists, ignore
    console.debug('Migration: albumArtist column already exists or migration failed:', e);
  }

  // Migration: add discNumber column if it doesn't exist
  try {
    database.executeSync(`ALTER TABLE tracks ADD COLUMN discNumber INTEGER NOT NULL DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
    console.debug('Migration: discNumber column already exists or migration failed:', e);
  }

  // Migration: rename isDjSet → isAlbumExperience
  try {
    database.executeSync(`ALTER TABLE folders RENAME COLUMN isDjSet TO isAlbumExperience`);
  } catch (e) {
    // Column already renamed or doesn't exist, ignore
    console.debug('Migration: folders.isDjSet column already renamed or doesnt exist:', e);
  }
  try {
    database.executeSync(`ALTER TABLE tracks RENAME COLUMN isDjSet TO isAlbumExperience`);
  } catch (e) {
    // Column already renamed or doesn't exist, ignore
    console.debug('Migration: tracks.isDjSet column already renamed or doesnt exist:', e);
  }

  // Migration: add isFavorite column if it doesn't exist
  try {
    database.executeSync(`ALTER TABLE tracks ADD COLUMN isFavorite INTEGER NOT NULL DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
    console.debug('Migration: isFavorite column already exists or migration failed:', e);
  }
}

// --- Config helpers ---

export function getConfig(key: string): string | null {
  const result = getDatabase().executeSync(
    'SELECT value FROM config WHERE key = ?',
    [key],
  );
  if (result.rows && result.rows.length > 0) {
    return result.rows[0].value as string;
  }
  return null;
}

export function setConfig(key: string, value: string): void {
  getDatabase().executeSync(
    'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
    [key, value],
  );
}

// --- Folder helpers ---

export interface FolderRow {
  id: number;
  uri: string;
  name: string;
  isAlbumExperience: number;
  coverArtUri: string | null;
  trackCount: number;
}

export function upsertFolder(
  uri: string,
  name: string,
  coverArtUri: string | null,
): number {
  const db = getDatabase();
  db.executeSync(
    `INSERT INTO folders (uri, name, coverArtUri, trackCount)
     VALUES (?, ?, ?, 0)
     ON CONFLICT(uri) DO UPDATE SET
       name = excluded.name,
       coverArtUri = excluded.coverArtUri`,
    [uri, name, coverArtUri],
  );
  const result = db.executeSync('SELECT id FROM folders WHERE uri = ?', [uri]);
  return result.rows![0].id as number;
}

export function getAllFolders(): FolderRow[] {
  const result = getDatabase().executeSync(
    'SELECT * FROM folders ORDER BY name COLLATE NOCASE ASC',
  );
  return (result.rows ?? []) as unknown as FolderRow[];
}

export function deleteFolder(folderId: number): void {
  const db = getDatabase();
  db.executeSync('DELETE FROM tracks WHERE folderId = ?', [folderId]);
  db.executeSync('DELETE FROM folders WHERE id = ?', [folderId]);
}

export function deleteFoldersByUris(uris: string[]): void {
  if (uris.length === 0) return;
  const db = getDatabase();
  const placeholders = uris.map(() => '?').join(',');
  // Delete tracks belonging to these folders first
  db.executeSync(
    `DELETE FROM tracks WHERE folderId IN (SELECT id FROM folders WHERE uri IN (${placeholders}))`,
    uris,
  );
  db.executeSync(`DELETE FROM folders WHERE uri IN (${placeholders})`, uris);
}

export function updateFolderTrackCount(folderId: number): void {
  getDatabase().executeSync(
    'UPDATE folders SET trackCount = (SELECT COUNT(*) FROM tracks WHERE folderId = ?) WHERE id = ?',
    [folderId, folderId],
  );
}

export function updateFolderCoverArt(
  folderId: number,
  coverArtUri: string | null,
): void {
  getDatabase().executeSync('UPDATE folders SET coverArtUri = ? WHERE id = ?', [
    coverArtUri,
    folderId,
  ]);
}

// --- Track helpers ---

export interface TrackRow {
  id: number;
  uri: string;
  fileName: string;
  title: string | null;
  artist: string | null;
  albumArtist: string | null;
  album: string | null;
  trackNumber: number;
  discNumber: number;
  duration: number;
  bitrate: number;
  sampleRate: number;
  bitDepth: number;
  fileSize: number;
  coverArtUri: string | null;
  folderId: number;
  isAlbumExperience: number;
  isFavorite: number;
  lastModified: number;
  metadataParsed: number;
}

export function upsertTrack(
  uri: string,
  fileName: string,
  fileSize: number,
  lastModified: number,
  folderId: number,
  discNumber: number = 0,
): void {
  getDatabase().executeSync(
    `INSERT INTO tracks (uri, fileName, fileSize, lastModified, folderId, discNumber, metadataParsed)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(uri) DO UPDATE SET
       fileName = excluded.fileName,
       fileSize = excluded.fileSize,
       lastModified = excluded.lastModified,
       folderId = excluded.folderId,
       discNumber = excluded.discNumber,
       metadataParsed = 0`,
    [uri, fileName, fileSize, lastModified, folderId, discNumber],
  );
}

export function updateTrackMetadata(
  uri: string,
  metadata: {
    title: string | null;
    artist: string | null;
    albumArtist: string | null;
    album: string | null;
    trackNumber: number;
    discNumber: number;
    duration: number;
    bitrate: number;
    sampleRate: number;
    bitDepth: number;
  },
  coverArtUri: string | null,
): void {
  getDatabase().executeSync(
    `UPDATE tracks SET
       title = ?, artist = ?, albumArtist = ?, album = ?, trackNumber = ?,
       discNumber = ?, duration = ?, bitrate = ?, sampleRate = ?, bitDepth = ?,
       coverArtUri = ?, metadataParsed = 1
     WHERE uri = ?`,
    [
      metadata.title,
      metadata.artist,
      metadata.albumArtist,
      metadata.album,
      metadata.trackNumber,
      metadata.discNumber,
      metadata.duration,
      metadata.bitrate,
      metadata.sampleRate,
      metadata.bitDepth,
      coverArtUri,
      uri,
    ],
  );
}

export function getTracksByFolder(folderId: number): TrackRow[] {
  const result = getDatabase().executeSync(
    'SELECT * FROM tracks WHERE folderId = ? ORDER BY discNumber ASC, trackNumber ASC, fileName COLLATE NOCASE ASC',
    [folderId],
  );
  return (result.rows ?? []) as unknown as TrackRow[];
}

export function getRootTracks(rootFolderId: number): TrackRow[] {
  return getTracksByFolder(rootFolderId);
}

export function getUnparsedTracks(limit: number): TrackRow[] {
  const result = getDatabase().executeSync(
    'SELECT * FROM tracks WHERE metadataParsed = 0 LIMIT ?',
    [limit],
  );
  return (result.rows ?? []) as unknown as TrackRow[];
}

export function getUnparsedTrackCount(): number {
  const result = getDatabase().executeSync(
    'SELECT COUNT(*) as cnt FROM tracks WHERE metadataParsed = 0',
  );
  const row = (result.rows ?? [])[0] as unknown as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

export function getTrackByUri(uri: string): TrackRow | null {
  const result = getDatabase().executeSync('SELECT * FROM tracks WHERE uri = ?', [
    uri,
  ]);
  if (result.rows && result.rows.length > 0) {
    return result.rows[0] as unknown as TrackRow;
  }
  return null;
}

export function getTracksByFolderUri(folderUri: string): TrackRow[] {
  const result = getDatabase().executeSync(
    `SELECT t.* FROM tracks t
     JOIN folders f ON t.folderId = f.id
     WHERE f.uri = ?
     ORDER BY t.discNumber ASC, t.trackNumber ASC, t.fileName COLLATE NOCASE ASC`,
    [folderUri],
  );
  return (result.rows ?? []) as unknown as TrackRow[];
}

export function deleteTracksByUris(uris: string[]): void {
  if (uris.length === 0) return;
  const placeholders = uris.map(() => '?').join(',');
  getDatabase().executeSync(
    `DELETE FROM tracks WHERE uri IN (${placeholders})`,
    uris,
  );
}

export function markTrackForRescan(uri: string): void {
  getDatabase().executeSync(
    'UPDATE tracks SET metadataParsed = 0 WHERE uri = ?',
    [uri],
  );
}

export function getAllTracksInLibrary(): TrackRow[] {
  const result = getDatabase().executeSync(
    'SELECT * FROM tracks ORDER BY fileName COLLATE NOCASE ASC',
  );
  return (result.rows ?? []) as unknown as TrackRow[];
}

export function updateFolderAlbumExperience(
  folderId: number,
  isAlbumExperience: boolean,
): void {
  const db = getDatabase();
  const value = isAlbumExperience ? 1 : 0;
  db.executeSync('UPDATE folders SET isAlbumExperience = ? WHERE id = ?', [
    value,
    folderId,
  ]);
  db.executeSync(
    'UPDATE tracks SET isAlbumExperience = ? WHERE folderId = ?',
    [value, folderId],
  );
}

export function getFolderById(id: number): FolderRow | null {
  const result = getDatabase().executeSync('SELECT * FROM folders WHERE id = ?', [
    id,
  ]);
  if (result.rows && result.rows.length > 0) {
    return result.rows[0] as unknown as FolderRow;
  }
  return null;
}

export function toggleFavorite(trackId: number): boolean {
  const db = getDatabase();
  const result = db.executeSync('SELECT isFavorite FROM tracks WHERE id = ?', [trackId]);
  const current = (result.rows?.[0] as unknown as { isFavorite: number })?.isFavorite ?? 0;
  const newValue = current === 1 ? 0 : 1;
  db.executeSync('UPDATE tracks SET isFavorite = ? WHERE id = ?', [newValue, trackId]);
  return newValue === 1;
}

export function getFavoriteTracks(): TrackRow[] {
  const result = getDatabase().executeSync(
    'SELECT * FROM tracks WHERE isFavorite = 1 ORDER BY rowid DESC',
  );
  return (result.rows ?? []) as unknown as TrackRow[];
}

export function clearAllData(): void {
  const db = getDatabase();
  db.executeSync('DELETE FROM tracks');
  db.executeSync('DELETE FROM folders');
  db.executeSync('DELETE FROM config');
}
