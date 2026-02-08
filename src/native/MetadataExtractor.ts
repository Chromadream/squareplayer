import { NativeModules } from 'react-native';

export interface TrackMetadata {
  title: string | null;
  artist: string | null;
  albumArtist: string | null;
  album: string | null;
  duration: number; // seconds
  bitrate: number; // kbps
  sampleRate: number; // Hz
  bitDepth: number;
  trackNumber: number;
}

interface MetadataExtractorInterface {
  extract(uri: string): Promise<TrackMetadata>;
  extractCoverArt(uri: string): Promise<string | null>;
}

const { MetadataExtractor } = NativeModules;

export default MetadataExtractor as MetadataExtractorInterface;
