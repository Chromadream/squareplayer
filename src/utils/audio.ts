/** Regex matching supported audio file extensions (FLAC and MP3). */
export const AUDIO_FILE_REGEX = /\.(flac|mp3)$/i;

/** Strip the audio file extension from a filename for display purposes. */
export function stripAudioExtension(name: string): string {
  return name.replace(AUDIO_FILE_REGEX, '');
}

/** Return a format label based on the file extension: "LOSSLESS" for FLAC, "LOSSY" for MP3. */
export function getFormatLabel(fileName: string): string {
  if (/\.flac$/i.test(fileName)) return 'LOSSLESS';
  if (/\.mp3$/i.test(fileName)) return 'LOSSY';
  return '';
}
