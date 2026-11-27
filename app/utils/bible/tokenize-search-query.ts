/**
 * Tokenización compartida por búsqueda FTS5 (buildFtsMatchQuery.ts) y
 * resaltado de resultados (useMark.ts) — misma fuente de verdad para "qué
 * cuenta como palabra de búsqueda", así ambos coinciden sobre qué se buscó
 * y qué se resalta, en vez de tener normalizaciones independientes que
 * puedan divergir (ver items 6-7 del backlog: el highlight debe encontrar
 * las mismas palabras que encontró la búsqueda, aunque el texto original
 * tenga puntuación distinta a la de la consulta).
 */
export function tokenizeSearchQuery(rawQuery: string): string[] {
  return rawQuery
    .trim()
    .split(/\s+/)
    .map(token => token.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(token => token.length > 0);
}
