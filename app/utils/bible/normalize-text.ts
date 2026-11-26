const COMBINING_DIACRITICAL_MARKS = /[\u0300-\u036F]/g;

/** minúsculas + sin tilde/diacríticos + sin espacios de más — para comparaciones case/accent-insensitive. */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICAL_MARKS, "").toLowerCase().trim();
}
