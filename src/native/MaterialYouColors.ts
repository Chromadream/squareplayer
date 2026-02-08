import { NativeModules } from 'react-native';

export interface MaterialYouPalette {
  system_accent1: string[];  // 13 shades: [0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
  system_accent2: string[];
  system_accent3: string[];
  system_neutral1: string[];
  system_neutral2: string[];
}

interface MaterialYouColorsInterface {
  /** Synchronous palette available via getConstants() at startup */
  palette: MaterialYouPalette;
  /** Async re-read (e.g. after wallpaper change) */
  getPalette(): Promise<MaterialYouPalette>;
}

const { MaterialYouColors } = NativeModules;

/**
 * Access to the initial palette is synchronous via .palette (populated at module load).
 * Call getPalette() to re-read after a wallpaper change.
 */
export default MaterialYouColors as MaterialYouColorsInterface;
