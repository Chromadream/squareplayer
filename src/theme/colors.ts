import type { MaterialYouPalette } from '../native/MaterialYouColors';

/**
 * Shade indices into the 13-element tonal arrays.
 * Android tonal values: [0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
 *                index:  0   1   2    3     4     5     6     7     8     9    10    11    12
 *
 * Shade 0 = lightest (white), Shade 12 = darkest (black).
 */

export interface ThemeColors {
  // Backgrounds
  background: string;         // Main screen bg
  surface: string;            // Cards, elevated containers
  surfaceVariant: string;     // Slightly different surface (e.g. no-artwork, button bg)
  surfaceDim: string;         // Diagrams, subtle containers

  // Borders
  border: string;             // Header bottom borders, card borders, dividers
  borderSubtle: string;       // Lighter dividers (disc headers, diagram lines)

  // Text hierarchy
  textPrimary: string;        // Titles, headings
  textSecondary: string;      // Subtitles, option values
  textTertiary: string;       // Hints, section titles, scan text
  textMuted: string;          // Chevrons, dismiss text, track numbers, durations
  textFaint: string;          // Empty state subtext, very dim hints

  // Accent / Interactive
  accentPrimary: string;      // Focus borders, progress bars, primary accent
  accentPrimaryMuted: string; // Focus background, selection highlight
  accentBadge: string;        // Album Experience badge bg

  // Overlays (kept as rgba since they need transparency)
  overlayHeavy: string;       // TrackInfoOverlay backdrop, ButtonHintBar bg
  overlayMedium: string;      // NowPlaying info overlay, StatusOverlay bg
  overlayLight: string;       // Focused item background

  // Diagram-specific (controller diagram in SettingsScreen)
  diagramChrome: string;      // Shoulder/trigger/menu/face button bg
  diagramChromeDim: string;   // D-pad center, trigger buttons
  diagramLabel: string;       // Shoulder/trigger label text
  diagramLabelDim: string;    // D-pad arrows, trigger labels, menu labels
  diagramAction: string;      // Action description text

  // NowPlaying-specific (always dark, over artwork)
  npBackground: string;
  npOverlay: string;
  npTextPrimary: string;
  npTextSecondary: string;
  npTextInfo: string;
  npTextShadow: string;
  npNoArtworkBg: string;
  npNoArtworkText: string;

  // StatusBar
  statusBarBg: string;
  statusBarStyle: 'light-content' | 'dark-content';
}

/**
 * Map a Material You palette to semantic theme colors.
 *
 * Palette arrays are 13 elements, index 0 = lightest (shade 0), index 12 = darkest (shade 1000).
 *
 * Dark mode: use darker shades for bg, lighter for text.
 * Light mode: use lighter shades for bg, darker for text.
 */
export function mapPaletteToTheme(
  palette: MaterialYouPalette,
  mode: 'dark' | 'light',
): ThemeColors {
  const a1 = palette.system_accent1;
  const a2 = palette.system_accent2;
  const a3 = palette.system_accent3;
  const n1 = palette.system_neutral1;
  const n2 = palette.system_neutral2;

  if (mode === 'dark') {
    return {
      // Backgrounds — dark neutrals
      background: n1[12],       // shade 1000 (near-black)
      surface: n1[11],          // shade 900
      surfaceVariant: n2[11],   // shade 900
      surfaceDim: n1[12],       // shade 1000

      // Borders
      border: n2[10],           // shade 800
      borderSubtle: n2[9],      // shade 700

      // Text — lightest shades on dark
      textPrimary: n1[2],       // shade 50
      textSecondary: n2[5],     // shade 300
      textTertiary: n2[6],      // shade 400
      textMuted: n2[7],         // shade 500
      textFaint: n2[8],         // shade 600

      // Accent
      accentPrimary: a1[5],     // shade 300 (vibrant on dark)
      accentPrimaryMuted: withAlpha(a1[5], 0.15),
      accentBadge: a3[6],       // shade 400

      // Overlays
      overlayHeavy: 'rgba(0, 0, 0, 0.80)',
      overlayMedium: 'rgba(0, 0, 0, 0.60)',
      overlayLight: withAlpha(n1[2], 0.12),

      // Diagram chrome
      diagramChrome: withAlpha(n1[2], 0.12),
      diagramChromeDim: withAlpha(n1[2], 0.06),
      diagramLabel: n2[4],      // shade 200
      diagramLabelDim: n2[6],   // shade 400
      diagramAction: n2[7],     // shade 500

      // NowPlaying — always dark (displays over album art)
      npBackground: '#000',
      npOverlay: 'rgba(0, 0, 0, 0.5)',
      npTextPrimary: '#fff',
      npTextSecondary: 'rgba(255,255,255,0.8)',
      npTextInfo: 'rgba(255,255,255,0.9)',
      npTextShadow: 'rgba(0, 0, 0, 0.75)',
      npNoArtworkBg: n2[11],
      npNoArtworkText: n2[9],

      // StatusBar
      statusBarBg: n1[12],
      statusBarStyle: 'light-content',
    };
  }

  // ─── Light Mode ─────────────────────────────────────────
  return {
    // Backgrounds — light neutrals
    background: n1[1],          // shade 10 (near-white)
    surface: n1[2],             // shade 50
    surfaceVariant: n2[2],      // shade 50
    surfaceDim: n2[3],          // shade 100 (neutral2 for visible distinction from background)

    // Borders — light mode needs visible but subtle borders
    border: n2[4],              // shade 200
    borderSubtle: n2[3],        // shade 100

    // Text — dark shades on light (ensuring ≥4.5:1 contrast on shade-10 bg)
    textPrimary: n1[12],        // shade 1000 (~21:1 contrast)
    textSecondary: n1[9],       // shade 700 (~9:1 contrast)
    textTertiary: n1[8],        // shade 600 (~6.5:1 contrast)
    textMuted: n1[7],           // shade 500 (~4.6:1 contrast) — use n1 for warmth
    textFaint: n2[7],           // shade 500 (~4.5:1 contrast) — bumped from 400 for accessibility

    // Accent
    accentPrimary: a1[8],       // shade 600 (good contrast on light bg)
    accentPrimaryMuted: withAlpha(a1[4], 0.18),
    accentBadge: a3[7],         // shade 500

    // Overlays — lighter overlays for light mode
    overlayHeavy: 'rgba(0, 0, 0, 0.65)',
    overlayMedium: 'rgba(0, 0, 0, 0.45)',
    overlayLight: withAlpha(n1[12], 0.10),  // slightly stronger for visible focus on light bg

    // Diagram chrome
    diagramChrome: withAlpha(n1[12], 0.08),
    diagramChromeDim: withAlpha(n1[12], 0.04),
    diagramLabel: n2[8],        // shade 600
    diagramLabelDim: n2[7],     // shade 500
    diagramAction: n2[6],       // shade 400

    // NowPlaying — always dark regardless of mode (over album art)
    npBackground: '#000',
    npOverlay: 'rgba(0, 0, 0, 0.5)',
    npTextPrimary: '#fff',
    npTextSecondary: 'rgba(255,255,255,0.8)',
    npTextInfo: 'rgba(255,255,255,0.9)',
    npTextShadow: 'rgba(0, 0, 0, 0.75)',
    npNoArtworkBg: n2[11],
    npNoArtworkText: n2[9],

    // StatusBar
    statusBarBg: n1[1],
    statusBarStyle: 'dark-content',
  };
}

/** Convert a hex color string to rgba with the given alpha */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
