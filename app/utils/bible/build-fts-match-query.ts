import { tokenizeSearchQuery } from "./tokenize-search-query";

/**
 * Convierte el texto libre que escribe el usuario en una expresión segura
 * para `... WHERE verse_fts MATCH ?`. Cada palabra se reduce a sus
 * caracteres alfanuméricos vía tokenizeSearchQuery() (misma tokenización
 * que usa el highlighting en useMark.ts — tolera puntuación/espacios
 * distintos entre query y texto almacenado; el tokenizer `unicode61` ya
 * normaliza tildes) y todas se unen en UNA sola frase literal FTS5
 * (`"tok1 tok2 tok3"*`), con el comodín de prefijo solo en el último
 * término: esto exige que los tokens aparezcan adyacentes y en el mismo
 * orden que escribió el usuario (en vez de la semántica AND-en-cualquier-
 * orden de términos sueltos), y de paso evita que el usuario inyecte
 * sintaxis de query FTS5 (NEAR, OR, columnas, etc.) ya que todo el input
 * queda envuelto en un único literal entrecomillado.
 *
 * Devuelve `null` si no queda ningún token útil (query vacía o solo
 * espacios/símbolos), para que el caller decida no ejecutar la búsqueda.
 */
export function buildFtsMatchQuery(rawQuery: string): string | null {
  const tokens = tokenizeSearchQuery(rawQuery);

  if (tokens.length === 0)
    return null;

  return `"${tokens.join(" ")}"*`;
}
