// Reading settings, ported from Superbiblia (useReadingPreferences): the
// lyric typeface, line spacing and margin, and the interface typeface.
// Line spacing and margin are a step 0–4 (not the CSS value), mapped to
// real values once in main.css ([data-reading-line-height] etc.), so the
// table is not repeated. The letter size stays in the font store (px):
// Acapela needs a wider range than a Bible reader, for singing at a
// distance.

export const READING_FONTS = [
  { value: "literata", label: "Literata", family: "'Literata', serif" },
  { value: "roboto-serif", label: "Roboto Serif", family: "'Roboto Serif', serif" },
  { value: "merriweather", label: "Merriweather", family: "'Merriweather', serif" },
  { value: "roboto", label: "Roboto", family: "'Roboto', sans-serif" },
  { value: "open-sans", label: "Open Sans", family: "'Open Sans', sans-serif" },
  { value: "figtree", label: "Figtree", family: "'Figtree', sans-serif" },
] as const;
export type ReadingFont = typeof READING_FONTS[number]["value"];

export const APP_FONTS = [
  { value: "inter", label: "Inter", family: "'Inter', sans-serif" },
  { value: "sistema", label: "Sistema", family: "ui-sans-serif, system-ui, sans-serif" },
  { value: "figtree", label: "Figtree", family: "'Figtree', sans-serif" },
  { value: "roboto", label: "Roboto", family: "'Roboto', sans-serif" },
  { value: "open-sans", label: "Open Sans", family: "'Open Sans', sans-serif" },
  { value: "atkinson", label: "Atkinson", family: "'Atkinson Hyperlegible', sans-serif" },
] as const;
export type AppFont = typeof APP_FONTS[number]["value"];

export const STEP_MIN = 0;
export const STEP_MAX = 4;
/** Same progressions as main.css. */
export const lineHeightFor = (step: number) => (1.3 + step * 0.2).toFixed(1);
export const marginFor = (step: number) => 8 + step * 8;

export function useReadingPreferences() {
  // Defaults = how Acapela looked before these settings existed: Literata,
  // ~1.5 line height, 16 px margin, Inter for the interface.
  const readingFont = useLocalStorage<ReadingFont>("acapela:reading-font", "literata");
  const lineHeightStep = useLocalStorage<number>("acapela:reading-line-height-step", 1);
  const marginStep = useLocalStorage<number>("acapela:reading-margin-step", 1);
  const appFont = useLocalStorage<AppFont>("acapela:app-font", "inter");
  return {
    readingFont,
    lineHeightStep,
    marginStep,
    appFont,
  };
}
