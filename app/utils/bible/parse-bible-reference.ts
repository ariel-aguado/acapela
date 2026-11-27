import { normalizeText } from "./normalize-text";
import { formatVerseRanges } from "./verse-selection";

export type ParsedReferenceStatus = "idle" | "valid" | "ambiguous" | "invalid";

export type BookAliasMatch = {
  id: number;
  name: string;
  matchedAlias: string;
  score: number;
  isExactPrefix: boolean;
};

/**
 * Estructura real de un libro — capítulos y versículos por capítulo, usada
 * para desambiguar/validar en vez de aceptar cualquier número (ver
 * resolveNumericReference). `versesPerChapter[i]` = cantidad de versículos
 * del capítulo i+1.
 */
export type BookStructure = {
  chapterCount: number;
  versesPerChapter: number[];
};

export type ParsedBibleReference = {
  raw: string;
  status: ParsedReferenceStatus;
  book?: { id: number; name: string; matchedAlias: string };
  bookCandidates?: BookAliasMatch[];
  /** índice del candidato "activo" dentro de bookCandidates (ver useBibleReference para el ciclo con flechas). */
  activeCandidateIndex: number;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  /**
   * Lista de versículos PUNTUALES no contiguos ("versículo 10 y versículo
   * 15" — ver tryParseVerseList), ordenada y sin duplicados. Presente SOLO
   * en ese caso — un rango normal ("16-18") sigue representándose con
   * verseStart/verseEnd nada más, `verses` sería redundante ahí. Cuando
   * está presente, `verseStart` igual queda seteado al primero de la lista
   * (compatibilidad con lectores que solo miran verseStart, ej. vista
   * previa del versículo en SearchBar.vue) pero `verseEnd` NO se setea
   * (evita que algo que solo mira verseStart/verseEnd asuma erróneamente un
   * rango contiguo 10-15, que incluiría el 11-14 que nunca se pidió).
   */
  verses?: number[];
  /** "Juan 3:16" / "Juan 3" / "Juan" — construido contra el candidato activo, incluso en estado 'ambiguous'. */
  canonicalLabel?: string;
  /**
   * Lectura alternativa PURAMENTE informativa de los mismos dígitos — ver
   * el comentario grande donde se calcula, en parseBibleReference(). Solo
   * aparece cuando un capítulo de 1 dígito + un remanente de EXACTAMENTE 2
   * dígitos ya resolvió como un único versículo (ej. "jn316" -> capítulo 3,
   * versículo 16) Y esos mismos 2 dígitos leídos por separado en orden
   * ascendente forman un rango válido en el mismo capítulo ("16" -> "1-6").
   * A pedido del usuario, esto NO cambia a dónde navega Enter (sigue siendo
   * `canonicalLabel`/chapter/verseStart/verseEnd de siempre) — el consumidor
   * (ver hint del buscador en SearchBar.vue) lo agrega solo como texto al
   * lado, nunca lo usa para resolver/navegar.
   */
  alternateCanonicalLabel?: string;
  /**
   * true solo cuando `raw` es literalmente un prefijo de `canonicalLabel`
   * (case/diacritics-insensitive) — ej. usuario tipeó "Jua" y falta "n".
   * La mayoría de los alias reales ("jn" -> "Juan", "1 cor" -> "1 Corintios")
   * NO son prefijos literales, así que el overlay ghost no puede limitarse a
   * concatenar caracteres sueltos ahí: el componente debe mostrar
   * `canonicalLabel` completo como sugerencia en esos casos, no `ghostSuffix`.
   */
  isPrefixContinuation: boolean;
  /** solo tiene sentido cuando isPrefixContinuation === true. */
  ghostSuffix?: string;
};

// [:\s]+ (un solo cuantificador) en vez de \s*[:\s]\s* — la versión anterior
// tenía dos \s* independientes solapando con la propia clase [:\s], lo que
// dispara backtracking polinomial en inputs patológicos (regexp/no-super-linear-backtracking).
//
// (?<![\d-]) al inicio: sin esto, para algo como "jn110-12" (sin separador
// antes de "110") el regex igual "encontraba" un match degenerado tomando
// solo el último dígito ("2") o los últimos dos ("12") como si fueran un
// capítulo suelto — \s* no exige que lo anterior sea espacio, así que
// probaba arrancar en cualquier posición y terminaba ignorando silenciosamente
// el "jn110-1" que quedaba antes. El lookbehind bloquea arrancar el match
// justo después de un dígito o un guion, para que ESTE regex directamente
// no matchee nada acá y el fallback de rango compacto
// (TRAILING_GLUED_RANGE_TAIL) sea quien lo resuelva bien.
const TRAILING_NUMERIC_TAIL = /(?<![\d-])\s*(\d{1,3})(?:[:\s]+(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?\s*$/;

// Fallback SOLO cuando TRAILING_NUMERIC_TAIL no matcheó nada: cubre rangos
// compactos sin separador antes del primer número ("jn110-12" -> capítulo+
// versículo inicial pegados, "-12" como versículo final explícito). No
// puede confundirse con "3:16-18" porque esa forma YA matchea el regex de
// arriba (tiene ":") y nunca llega a intentarse esta — ver parseBibleReference.
const TRAILING_GLUED_RANGE_TAIL = /\s*(\d{2,6})\s*-\s*(\d{1,3})\s*$/;

/**
 * Traduce marcadores de lenguaje natural al separador canónico ":" ANTES de
 * separar libro de capítulo/versículo, para no tener que duplicar cada
 * alias de libro en variantes "con punto"/"sin punto" (ver
 * bookAliasOverrides.ts): "Heb." se normaliza a "heb" acá mismo, no hace
 * falta una alias aparte para el punto.
 *
 *   "capítulo"/"cap"/plural "capítulos" -> se eliminan (el número que sigue ya es el capítulo)
 *   "versículo"/"vers"/"verso"/"ver", singular o plural -> ":"
 *   "c" pegado a un número ("c11") -> se elimina
 *   "v" pegado a un número ("v1") -> ":"
 *   punto entre dígitos ("2.9") -> ":" (ANTES de borrar el resto de los puntos)
 *   coma entre dígitos ("11,1") -> ":"
 *   dos puntos colgante al final ("HB 1:", sin nada después) -> se elimina,
 *     equivalente a no haber puesto separador (queda solo capítulo)
 *   puntos restantes (abreviatura con punto: "Heb.") -> se eliminan globalmente
 *   guion en (–)/em (—) entre dígitos ("16–18") -> "-" (guion normal, el único
 *     que entiende TRAILING_NUMERIC_TAIL más abajo)
 *   "del" antes de un número ("del 5") -> se elimina — palabra de relleno de
 *     variantes como "versículo del 5 hasta el 10", el número que sigue ya
 *     es el versículo inicial
 *   " a "/" al "/" hasta "/" hasta el " entre dígitos ("16 a 18", "5 al 10",
 *     "5 hasta 10", "5 hasta el 10") -> "-" (rango en palabras)
 *   guion colgante al final ("jn212-", todavía escribiendo el rango) -> se
 *     elimina, igual que el ":" colgante — evita mostrar "no se encontró"
 *     mientras el usuario está en medio de tipear el versículo final
 *   conector de rango colgante al final ("jn c5 v3 al", "jn c5 v3 h" — el
 *     usuario todavía está tipeando "al"/"hasta" y no llegó al número final)
 *     -> se elimina, mismo criterio que el guion colgante: cualquier PREFIJO
 *     de "a"/"al"/"hasta"/"hasta el" pegado al final, después de un número,
 *     se trata como "todavía sin terminar de tipear" en vez de inválido
 *   frase de relleno al inicio ("quiero ir a Juan 3 16", "busca Juan 3 16" —
 *     dictado por voz, el usuario suele envolver la referencia en una frase
 *     de pedido) -> se elimina, solo la PRIMERA — ver LEADING_FILLER_PHRASE
 *   "?"/"!" colgantes al final -> se eliminan (dictado por voz puede agregar
 *     signos de interrogación/exclamación por la entonación de la frase)
 *   orden invertido ("capítulo 3 de Juan", "libro de Juan") -> se reescribe
 *     al orden de siempre ANTES de lo demás — ver reorderNaturalLanguage
 */

// Frases de pedido que un dictado por voz suele anteponer a la referencia
// real ("quiero ir a Juan 3 16", "busca 1 Corintios 13") — lista acotada a
// propósito, no un intento de cubrir cualquier frase posible; se amplía con
// casos reales a medida que aparezcan. Ninguna coincide con el inicio de un
// nombre de libro real (ver bookAliasOverrides.ts), así que no hay riesgo de
// comerse parte de un libro que empiece parecido.
// "ir a"/"ir al" ("al" = "a el", contracción): al? cubre ambas formas con la
// misma alternativa, igual que ya hace el conector de rango más abajo — así
// "quiero ir al capítulo 3 de Juan" también se limpia bien (el "al" entero
// se descarta acá; lo que necesita reorderNaturalLanguage, "capítulo 3 de
// Juan", no necesita ningún "el" propio porque nunca lo tuvo).
// "de" también entra en la lista, pero SOLO delante de "capítulo"/"versículo"
// (lookahead, no consume esas palabras) — dictado por voz a veces antepone
// un "de" suelto sin sentido propio ("de capítulo 4 de los hechos..."). Sin
// acotar con el lookahead, cualquier "de <nombre real>" (que nunca es lo que
// se quiere acá, un libro siempre precede a "de" en las formas invertidas de
// abajo, nunca lo sigue) se comería la primera palabra del libro.
// b[uú]sca(?:me|r)? en vez de buscar? (versión anterior): cubre además
// "buscame"/"búscame" (con y sin tilde) — "busca(r)?" solo tapaba "busca"/
// "buscar", no la forma con pronombre pegado, muy común en pedidos por voz
// ("búscame Romanos 5 8"). visualiza(?:me)? es la misma idea para "visualiza"/
// "visualízame".
const LEADING_FILLER_PHRASE = /^(?:por favor,?\s+)?(?:quiero\s+)?(?:ir\s+al?|ve\s+al?|vamos\s+al?|ll[eé]vame\s+al?|b[uú]sca(?:me|r)?|visualiza(?:me)?|mu[eé]stra(?:me)?|mostrar|abr(?:e|ir)|dame|leer|de(?=\s+cap[ií]tulos?\b|\s+vers[ií]culos?\b))\s+/i;

// "capítulo 3 de Juan"/"el capítulo 3 de Juan"/"versículo 16 de Juan 3"/"los
// versículos 16 al 18 de Juan 3" — orden natural invertido (marcador+número
// ANTES del libro) en vez del orden que el resto del pipeline asume (libro
// primero). Se reescribe al orden de siempre ("Juan capítulo 3", "Juan 3
// versículo 16", "Juan 3 versículos 16 al 18") ANTES de que nada más toque
// la cadena, así el resto de normalizeReferenceMarkers no necesita saber que
// existe esta variante. Ancla ^...$ a propósito: si no calza la forma
// EXACTA "(el/los/las )?<marcador> <número(s)> de <resto>", no toca nada
// (ej. "Juan versículo 16", sin capítulo, no tiene "de <resto>" y queda
// intacto para seguir siendo inválido como corresponde).
// (\S.*) en vez de (.+): \s+ justo antes y .+ pueden "intercambiarse" ambos
// caracteres de espacio si el resto también empezara con espacio, lo que
// dispara backtracking polinomial en inputs patológicos
// (regexp/no-super-linear-backtracking) — exigir que el resto arranque con
// un no-espacio elimina la ambigüedad sin cambiar qué matchea en la práctica
// (el resto real, un libro, nunca empieza con espacio).
// El conector antes del libro también acepta "del libro de" ("capítulo 3
// del libro de Isaías" — variante con "libro" de por medio, misma idea que
// REVERSED_BOOK_ONLY pero con capítulo/versículo presente además) — probado
// ANTES que "de" solo dentro de la alternancia porque si no, "de" ya
// matchearía las primeras 2 letras de "del" y el resto ("l libro de
// Isaías") quedaría pegado al nombre del libro.
// (?:en\s+)? al frente: "búscame EN el capítulo 5 de Romanos" — "en" como
// muletilla de ubicación antes del marcador, ADEMÁS del artículo opcional
// que ya se aceptaba (el/los/las). Puramente aditivo (grupo opcional al
// principio) — cualquier input que ya matcheaba sigue matcheando igual,
// consumiendo cero caracteres ahí.
//
// El marcador de versículo acepta además las formas cortas "vers"/"verso(s)"/
// "ver"/"vs" (ej. "vers 5 de mt 6" -> Mateo 6:5, "vs 5 de mt 6" -> lo mismo)
// — mismos alias que ya reconoce normalizeReferenceMarkers más abajo para
// el orden directo (ver su .replace de vers(?:[ií]culos?)?/versos?/ver) y
// LEADING_ORDINAL_VERSE_COUNT/LEADING_LAST_N_VERSES para "vs"; sin esto acá,
// esa forma corta en orden INVERTIDO nunca llegaba a reordenarse
// (reorderNaturalLanguage no la reconocía) y el .replace general la
// convertía a ":" en el lugar equivocado (antes del libro, no después),
// dejando un string que el resto del pipeline no sabe leer.
const REVERSED_NATURAL_LANGUAGE = /^(?:en\s+)?(?:(?:el|los|las)\s+)?(cap[ií]tulos?|vers(?:[ií]culos?)?|versos?|ver|vs)\s+(\d+(?:\s*(?:al?|hasta(?:\s+el)?)\s*\d+)?)\s+(?:del\s+libro\s+de|de)\s+(\S.*)$/i;

// "capítulo 4 de los hechos, muéstrame los versículos del 3 al 10" —
// variante con el SEGUNDO marcador DESPUÉS del libro en vez de en el mismo
// bloque inicial que REVERSED_DUAL_MARKER espera (ahí ambos marcadores van
// juntos, antes de "de <resto>"; acá el segundo llega recién después del
// nombre del libro, típico de un pedido en dos partes dictado por voz: "andá
// al capítulo N de <libro>" + "mostrame los versículos A al B").
//
// Resuelto en DOS pasos en vez de una sola regex con `(\S.*?)` (rest
// perezoso) porque un `.*?` seguido de `\s*` (el separador opcional antes
// del verbo/artículo/marcador) puede "intercambiar" caracteres de espacio
// entre ambos cuantificadores — backtracking polinomial en inputs
// patológicos (regexp/no-super-linear-backtracking), el mismo motivo
// documentado arriba para preferir `(\S.*)` (codicioso) en
// REVERSED_NATURAL_LANGUAGE.
// 1. TRAILING_VERSE_CLAUSE encuentra y separa la cola "..., mostrame los
//    versículos A al B" DESDE EL FINAL (ancla solo en `$`, sin `.*?`
//    intermedio — cada hueco opcional es literal-o-nada, no un comodín).
// 2. Lo que queda ANTES de esa cola se prueba tal cual contra
//    REVERSED_NATURAL_LANGUAGE (ya sabe leer "capítulo N de <libro>") — cero
//    gramática nueva para esa mitad.
//
// El conector entre el nombre del libro y el segundo marcador es opcional y
// está acotado a los mismos verbos de "mostrar/pedir" que ya reconoce
// LEADING_FILLER_PHRASE (no cualquier palabra), así una coincidencia
// accidental de "versículos" en medio de una consulta ya válida (ver tests)
// no dispara este camino. El "del"/"de" opcional antes del número final
// cubre la misma muletilla que normalizeReferenceMarkers ya limpia más abajo
// para rangos ("versículo del 5 hasta el 10") — acá hace falta repetirlo
// porque esta regex corre ANTES que esa limpieza.
const TRAILING_VERSE_CLAUSE = /[,\s]*(?:(?:mu[eé]stra(?:me)?|mostrar|ens[eé][ñn]a(?:me)?|dame|dime)\s+)?(?:(?:el|los|las)\s+)?(vers[ií]culos?)\s+(?:del?\s+)?(\d+(?:\s*(?:al?|hasta(?:\s+el)?)\s*\d+)?)\s*$/i;

// "versículo 16, capítulo 3 de Juan"/"capítulo 3, versículo 16 de Juan" — la
// misma idea de arriba pero con AMBOS marcadores presentes, en cualquier
// orden entre sí, separados por coma. Se prueba ANTES que el de un solo
// marcador (si matchea acá, el de un solo marcador ni se intenta). Misma
// pieza "(?:(?:el|los|las)\s+)?<marcador literal>" duplicada para el segundo
// marcador — sigue segura para regexp/no-super-linear-backtracking porque
// cada \s*/\s+ está pegado a una alternancia literal obligatoria, nunca a
// otro cuantificador opcional; la "," entre ambos también es literal
// obligatoria, mismo principio que ya usan los rangos "\s*-\s*".
//
// Separador entre cláusulas: "," O "del" ("versículos 1 al 3 DEL capítulo 5
// del libro de romanos" — la forma que sale de rewriteLeadingOrdinalVerseCount
// más abajo encadena las dos cláusulas con "del", no con coma, igual que
// alguien narrando en voz alta "los tres primeros versículos DEL capítulo 5
// DEL libro de romanos"). Conector final antes del libro: "del libro de" O
// "de", misma alternancia que ya usa REVERSED_NATURAL_LANGUAGE (antes esta
// regex solo aceptaba "de" suelto, así que "capítulo 5, versículo 3 del
// libro de Juan" quedaba sin resolver).
// (?:en\s+)? al frente, mismo motivo/misma seguridad que en
// REVERSED_NATURAL_LANGUAGE — "en el capítulo 5, el versículo 8 de Romanos".
// Mismos alias cortos de versículo que REVERSED_NATURAL_LANGUAGE ("vers"/
// "verso(s)"/"ver"/"vs", ver su comentario) en los DOS marcadores — "cap 5,
// vs 8 de Romanos" también tiene que reordenar bien.
const REVERSED_DUAL_MARKER = /^(?:en\s+)?(?:(?:el|los|las)\s+)?(cap[ií]tulos?|vers(?:[ií]culos?)?|versos?|ver|vs)\s+(\d+(?:\s*(?:al?|hasta(?:\s+el)?)\s*\d+)?)\s*(?:,|del)\s*(?:(?:el|los|las)\s+)?(cap[ií]tulos?|vers(?:[ií]culos?)?|versos?|ver|vs)\s+(\d+(?:\s*(?:al?|hasta(?:\s+el)?)\s*\d+)?)\s+(?:del\s+libro\s+de|de)\s+(\S.*)$/i;

// "libro de Juan"/"el libro de Juan" -> "Juan": caso más simple que el de
// arriba, sin capítulo/versículo — libro solo, en orden invertido.
const REVERSED_BOOK_ONLY = /^(?:el\s+)?libro\s+de\s+(\S.*)$/i;

// "el libro de Romanos, en el capítulo 5..." (orden YA directo — libro
// primero — pero envuelto en "el libro de" en vez de solo el nombre) -> se
// pela el envoltorio ANTES que nada más toque la cadena, dejando lo de
// siempre ("Romanos, en el capítulo 5..."). Distinto de REVERSED_BOOK_ONLY
// (esa exige que la cadena ENTERA sea "el libro de <libro>", sin nada más
// después) — acá alcanza con que el envoltorio esté al principio, haya o no
// capítulo/versículo a continuación.
const LEADING_BOOK_OF_FILLER = /^(?:el\s+)?libro\s+de\s+/i;

// Cardinales en palabras, 1-20 — para "los N primeros versículos" (ver
// rewriteLeadingOrdinalVerseCount). Nombran CUÁNTOS versículos, no el
// ORDINAL de la frase ("primeros" ya lo dice: el primero siempre es el 1).
// Acotado a lo que alguien realmente dictaría así ("los veintitrés primeros
// versículos" ya se tipea en dígitos en la práctica) — se amplía si aparece
// un caso real más alto.
const CARDINAL_NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
};

// "los tres primeros versículos"/"los 3 primeros versículos" (orden viejo,
// artículo+cantidad+"primeros") O "primeros 3 versículos"/"primeros tres
// versos"/"primeros 5 vs" (orden pedido después, "primeros" adelante de la
// cantidad, sin artículo) al INICIO -> se reescribe a la forma de RANGO que
// el resto del pipeline ya entiende ("versículos 1 al N"), ANTES de
// reorderNaturalLanguage — así, si además viene envuelto en "del capítulo N
// del libro de <libro>" o "de <libro> capítulo N", REVERSED_DUAL_MARKER/
// REVERSED_NATURAL_LANGUAGE terminan de resolverlo como cualquier otro rango
// reversado, sin gramática nueva para esa parte. Ancla solo al inicio (sin
// ejemplos reales de esta frase en medio de la oración) — si no matchea, no
// toca nada. "versos"/"vs" (además de "versículos") como marcador porque así
// lo piden los ejemplos reales ("primeros 3 versos de mateo capítulo 5",
// "primeros 5 vs de mt 4") — mismos alias que ya reconoce el resto del
// archivo (ver el .replace de versos?/ver/vs más abajo).
const LEADING_ORDINAL_VERSE_COUNT = /^(?:(?:(?:el|los)\s+)?(\d+|[a-zñáéíóú]+)\s+primeros?|primeros?\s+(\d+|[a-zñáéíóú]+))\s+(?:vers[ií]culos?|versos?|vs)\b\s*/i;

function resolveCardinal(token: string): number | null {
  if (/^\d+$/.test(token))
    return Number(token);
  return CARDINAL_NUMBER_WORDS[token.toLowerCase()] ?? null;
}

function rewriteLeadingOrdinalVerseCount(value: string): string {
  const match = LEADING_ORDINAL_VERSE_COUNT.exec(value);
  if (!match)
    return value;
  // Grupo 1 = cantidad en el orden viejo ("los N primeros"), grupo 2 =
  // cantidad en el orden nuevo ("primeros N") — solo uno de los dos matchea
  // según qué rama de la alternancia ganó, nunca los dos a la vez.
  const count = resolveCardinal(match[1] ?? match[2] ?? "");
  if (count == null)
    return value;
  // Siempre "versículos" como marcador de salida, sin importar si el grupo 3
  // matcheó "versículo(s)" o "verso(s)" — REVERSED_NATURAL_LANGUAGE (que
  // reordena "de <libro> capítulo N" después de esto) solo reconoce
  // "vers[ií]culos?" literal, no el alias "versos?"; reusar el marcador tal
  // cual como se tipeó ("versos 1 al 3 de mateo 5") lo dejaba sin reordenar.
  return `versículos 1 al ${count} ${value.slice(match[0].length)}`;
}

function isChapterMarker(marker: string): boolean {
  return /^cap/i.test(marker);
}

function reorderNaturalLanguage(value: string): string {
  const trimmed = value.trim();
  const trailingVerseMatch = TRAILING_VERSE_CLAUSE.exec(trimmed);
  if (trailingVerseMatch) {
    const [, verseMarker, verseNumber] = trailingVerseMatch;
    const prefix = trimmed.slice(0, trailingVerseMatch.index).trim();
    const prefixMatch = REVERSED_NATURAL_LANGUAGE.exec(prefix);
    // Sin match del prefijo (ej. "Juan 3 versículos 5 al 10", ya en orden
    // directo — ver tests) esta cola no era el caso que se quiere resolver
    // acá: se sigue de largo, sin tocar `value`, para que el resto de
    // reorderNaturalLanguage (o ninguno) lo maneje como corresponda.
    if (prefixMatch) {
      const [, chapterMarker, chapterNumber, rest] = prefixMatch;
      return `${rest} ${chapterMarker} ${chapterNumber} ${verseMarker} ${verseNumber}`;
    }
  }
  const dualMatch = REVERSED_DUAL_MARKER.exec(trimmed);
  if (dualMatch) {
    const [, marker1, number1, marker2, number2, rest] = dualMatch;
    // Uno de cada tipo únicamente — "capítulo 3, capítulo 5 de Juan" (mismo
    // tipo repetido) no tiene una lectura razonable, se deja sin reordenar
    // (sigue inválido más adelante, como corresponde a una entrada sin sentido).
    if (isChapterMarker(marker1!) === isChapterMarker(marker2!))
      return value;
    // Capítulo SIEMPRE antes que versículo en la salida, sin importar en qué
    // orden los escribió el usuario — el resto del pipeline (normalizeReferenceMarkers)
    // interpreta la posición para armar "capítulo:versículo", no el tipo de marcador.
    const [chapterMarker, chapterNumber, verseMarker, verseNumber] = isChapterMarker(marker1!)
      ? [marker1, number1, marker2, number2]
      : [marker2, number2, marker1, number1];
    return `${rest} ${chapterMarker} ${chapterNumber} ${verseMarker} ${verseNumber}`;
  }
  const match = REVERSED_NATURAL_LANGUAGE.exec(trimmed);
  if (match) {
    const [, marker, number, rest] = match;
    return `${rest} ${marker} ${number}`;
  }
  const bookOnlyMatch = REVERSED_BOOK_ONLY.exec(trimmed);
  if (bookOnlyMatch?.[1] != null)
    return bookOnlyMatch[1];
  return value;
}

export function normalizeReferenceMarkers(value: string): string {
  // reorderNaturalLanguage necesita ver las palabras "capítulo"/"versículo"
  // tal cual, así que corre antes que cualquier .replace() de acá abajo las
  // toque — pero después de LEADING_FILLER_PHRASE, para que "quiero ir a
  // capítulo 3 de Juan" también reordene bien.
  return reorderNaturalLanguage(
    rewriteLeadingOrdinalVerseCount(
      value.replace(LEADING_FILLER_PHRASE, "").replace(LEADING_BOOK_OF_FILLER, ""),
    ),
  )
    // Artículo suelto al inicio ("los Hechos", producido por
    // REVERSED_CHAPTER_THEN_TRAILING_VERSE/REVERSED_BOOK_ONLY cuando el
    // nombre real del libro se dice con artículo — "los Hechos", "las
    // Lamentaciones") -> se elimina: a esta altura el libro SIEMPRE arranca
    // el string (reorderNaturalLanguage ya lo puso primero), así que un
    // artículo ahí nunca es parte del nombre real de ningún libro del canon,
    // solo ruido que el matcher de libros (Fuse) no tolera bien pegado
    // adelante (bajaría el score por longitud/prefijo, ver useBookAutocomplete.ts).
    .replace(/^(?:el|los|las|la)\s+/i, "")
    .replace(/(\d)\s*\.\s*(\d)/g, "$1:$2")
    .replace(/\./g, "")
    .replace(/[?!]+\s*$/g, "")
    // Artículo/"en" sueltos justo ANTES de "capítulo"/"versículo" ("en el
    // capítulo 5", "el versículo 8") -> se eliminan (lookahead, no consume
    // el marcador) — pedidos en varias cláusulas ("Romanos, en el capítulo
    // 5, el versículo 8") repiten el artículo delante de cada marcador,
    // mismo criterio de "ruido de conector" que "del" antes de un dígito
    // más abajo.
    .replace(/\b(?:en\s+)?(?:el|los|las|la)\s+(?=cap[ií]tulos?\b)/gi, "")
    .replace(/\b(?:en\s+)?(?:el|los|las|la)\s+(?=vers[ií]culos?\b)/gi, "")
    // El límite final ya NO es \b: \b de JS es ASCII-only, así que no cuenta
    // una vocal acentuada como "letra" — para "versículoS" (plural), \b
    // decidía que la palabra ya había terminado justo ANTES de la "í" (salto
    // falso de límite ahí mismo), matcheaba solo "vers" y dejaba "ículos"
    // pegado al resto ("Juan 3 versículos 16" -> "Juan 3 :ículos 16",
    // basura). El lookahead de abajo excluye explícitamente letras
    // acentuadas además de lo que \b ya cubría (letra/dígito/guion bajo),
    // y de paso reconoce el plural ("capítulos"/"versículos").
    .replace(/\bcap(?:[ií]tulos?)?(?![\wáéíóúñ])\s*/gi, "")
    .replace(/\bvers(?:[ií]culos?)?(?![\wáéíóúñ])\s*/gi, ":")
    // "vs" (alias corto agregado para "primeros/últimos N vs de <libro>",
    // ver LEADING_ORDINAL_VERSE_COUNT/LEADING_LAST_N_VERSES) también tiene
    // que reconocerse ACÁ — reorderNaturalLanguage (más arriba) mueve el
    // marcador literal tal cual lo escribió el usuario en el orden
    // invertido ("vs 5 de mt 6" -> "mt 6 vs 5"), pero sin este .replace
    // "vs" nunca se convertía a ":", dejando el string sin poder leerse.
    .replace(/\b(?:versos?|ver|vs)(?![\wáéíóúñ])\s*/gi, ":")
    .replace(/\bv(?=\d)/gi, ":")
    .replace(/\bc(?=\d)/gi, "")
    .replace(/(\d)\s*,\s*(\d)/g, "$1:$2")
    // Coma restante (ya no pegada a dígitos a ambos lados, si no la línea de
    // arriba la habría consumido) -> espacio: separador de cláusula sobrante
    // ("Romanos,  5,  :8" a esta altura, ver los dos .replace() de arriba) en
    // vez de basura que rompa el extractor de cola numérica (extractReferenceTail
    // no entiende comas, solo ":"/espacio entre capítulo y versículo).
    .replace(/,/g, " ")
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
    .replace(/\bdel\s+(?=\d)/gi, "")
    .replace(/(\d)\s+(?:al?|hasta(?:\s+el)?)\s+(\d)/gi, "$1-$2")
    .replace(/(?<=\d)\s+(?:al?|h(?:a(?:s(?:t(?:a(?:\s+el?)?)?)?)?)?)\s*$/gi, "")
    .replace(/:\s*$/, "")
    .replace(/-\s*$/, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type ReferenceTail = {
  /** todo lo que quedó antes de la cola numérica — todavía sin resolver contra ningún libro. */
  bookPart: string;
  /** dígitos sueltos con separador explícito o ninguno todavía (ver TRAILING_NUMERIC_TAIL) — capítulo, o capítulo+versículo pegados a resolver contra la estructura real (ver resolveNumericReference). */
  chapterDigits?: string;
  verseStart?: number;
  verseEnd?: number;
  /**
   * Forma cruda (sin convertir a Number) de `verseEnd` — "02" y "2" dan el
   * mismo `verseEnd` numérico pero distinto prefijo. Solo la usa la vista
   * predictiva de "Ir a" (goToPredictor.ts) cuando `verseEnd` no valida como
   * cierre de rango completo, para ofrecer un listado de candidatos cuyo
   * número empieza con estos dígitos en vez de "no encontrado" (ver
   * findVerseEndCandidates) — parseBibleReference no la usa, ahí un rango
   * que no valida sigue siendo 'invalid' sin más (navegación directa con
   * Enter necesita una única respuesta, no un listado).
   */
  verseEndDigits?: string;
  /** presente solo cuando vino del fallback de rango compacto ("jn110-12") — ver TRAILING_GLUED_RANGE_TAIL/resolveGluedRange. */
  gluedRangeDigits?: string;
};

/**
 * Separa la cola numérica (capítulo/versículo/rango, en cualquiera de sus
 * formas ya normalizadas) del resto del input — extraído de parseBibleReference
 * para que la búsqueda predictiva de "Ir a" (goToPredictor.ts) pueda partir
 * del mismo punto exacto en vez de reimplementar esta detección.
 */
export function extractReferenceTail(normalized: string): ReferenceTail {
  const tailMatch = TRAILING_NUMERIC_TAIL.exec(normalized);
  if (tailMatch) {
    return {
      bookPart: normalized.slice(0, tailMatch.index).trim(),
      chapterDigits: tailMatch[1],
      verseStart: tailMatch[2] != null
        ? Number(tailMatch[2])
        : undefined,
      verseEnd: tailMatch[3] != null
        ? Number(tailMatch[3])
        : undefined,
      verseEndDigits: tailMatch[3],
    };
  }
  const gluedMatch = TRAILING_GLUED_RANGE_TAIL.exec(normalized);
  if (gluedMatch) {
    return {
      bookPart: normalized.slice(0, gluedMatch.index).trim(),
      gluedRangeDigits: gluedMatch[1],
      verseEnd: Number(gluedMatch[2]),
      verseEndDigits: gluedMatch[2],
    };
  }
  // .trim() acá también (como en los dos casos de arriba): sin esto, un
  // marcador colgante sin nada después ("Juan capítulo", "Juan cap") deja un
  // espacio suelto al final del bookPart ("Juan " en vez de "Juan") — un
  // matcher real (Fuse, tolerante a ruido) lo disimula, pero cualquier
  // matcher exacto (como los fakeMatcher de los tests) lo trata como que
  // "Juan " no es un libro y invalida algo que debería resolver bien.
  return {
    bookPart: normalized.trim(),
  };
}

function buildCanonicalLabel(bookName: string, chapter?: number, verseStart?: number, verseEnd?: number): string {
  let label = bookName;
  if (chapter != null)
    label += ` ${chapter}`;
  if (verseStart != null) {
    label += `:${verseStart}`;
    if (verseEnd != null)
      label += `-${verseEnd}`;
  }
  return label;
}

export type NumericResolution = {
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  /** false = el capítulo resuelto no existe en el libro (y ningún split alternativo tampoco) — la referencia entera es inválida. */
  valid: boolean;
};

/**
 * Prueba a partir `digits` en capítulo+versículo en TODOS los puntos de
 * corte posibles, de izquierda a derecha (para "123" prueba 1:23 y luego
 * 12:3), y devuelve cada corte que valide contra la estructura real — no
 * solo el primero. Usado por goToPredictor.ts para ofrecer TODAS las
 * lecturas ambiguas de dígitos pegados como resultados separados ("jn123"
 * -> Juan 1:23 Y Juan 12:3), en vez de que parseBibleReference se quede
 * con una sola (ver findValidChapterVerseSplit más abajo, que sí se queda
 * con la primera — la usada para navegación directa/Enter). Si se pasa
 * `verseEnd`, también exige que ese versículo exista en el capítulo
 * resuelto y sea >= al versículo inicial (usado por resolveGluedRange
 * para "jn110-12" -> Juan 1:10-12: acá "110" es el capítulo+versículo
 * inicial pegados, y el corte tiene que ser compatible con el "-12" ya
 * explícito).
 */
export function findAllValidChapterVerseSplits(
  digits: string,
  structure: BookStructure,
  verseEnd?: number,
): Array<{ chapter: number; verseStart: number }> {
  const splits: Array<{ chapter: number; verseStart: number }> = [];
  for (let splitAt = 1; splitAt < digits.length; splitAt++) {
    const splitChapter = Number(digits.slice(0, splitAt));
    const splitVerse = Number(digits.slice(splitAt));
    const versesInChapter = structure.versesPerChapter[splitChapter - 1];
    const chapterOk = splitChapter >= 1 && splitChapter <= structure.chapterCount;
    const verseOk = versesInChapter != null && splitVerse >= 1 && splitVerse <= versesInChapter;
    const endOk = verseEnd == null || (versesInChapter != null && verseEnd >= splitVerse && verseEnd <= versesInChapter);
    if (chapterOk && verseOk && endOk) {
      splits.push({ chapter: splitChapter, verseStart: splitVerse });
    }
  }
  return splits;
}

/**
 * Igual que findAllValidChapterVerseSplits pero se queda solo con el
 * primer corte válido (regla de precedencia de resolveNumericReference:
 * para "119" gana 1:19 sobre 11:9) — la lectura única que usa
 * parseBibleReference para navegación directa. Para ofrecer TODAS las
 * lecturas ambiguas (vista predictiva de "Ir a"), ver findAllValidChapterVerseSplits.
 */
export function findValidChapterVerseSplit(
  digits: string,
  structure: BookStructure,
  verseEnd?: number,
): { chapter: number; verseStart: number } | null {
  return findAllValidChapterVerseSplits(digits, structure, verseEnd)[0] ?? null;
}

/**
 * Descompone `digits` en una secuencia ASCENDENTE de números de 1 a 3
 * dígitos, todos versículos válidos del capítulo (1..versesInChapter),
 * que consuma TODOS los dígitos — ej. "67" en un capítulo de 47
 * versículos no vale como un solo verso (67 > 47) pero sí como la cadena
 * [6, 7]. Búsqueda greedy: en cada posición prueba primero el token más
 * corto (1 dígito), después 2, después 3 — mismo criterio de "preferir
 * lo más chico primero" que ya usa findAllValidChapterVerseSplits para el
 * punto de corte de capítulo. Devuelve null si no hay ninguna
 * descomposición válida, o si la única encontrada tiene un solo número
 * (eso ya lo cubre findValidChapterVerseSplit, no es una "cadena").
 * Usado por findChainedChapterVerseSplit para resolver secuencias como
 * "jn567" -> Juan 5:6-7 (rango real, no una lista) cuando el remanente
 * tras el capítulo no valida como un único versículo.
 */
export function findVerseChain(digits: string, versesInChapter: number): number[] | null {
  function helper(pos: number, prev: number): number[] | null {
    if (pos === digits.length)
      return [];
    for (const width of [1, 2, 3]) {
      if (pos + width > digits.length)
        continue;
      const value = Number(digits.slice(pos, pos + width));
      if (value <= prev || value < 1 || value > versesInChapter)
        continue;
      const rest = helper(pos + width, value);
      if (rest != null)
        return [value, ...rest];
    }
    return null;
  }
  const chain = helper(0, 0);
  return chain && chain.length >= 2
    ? chain
    : null;
}

/**
 * Fallback de findValidChapterVerseSplit para cuando NINGÚN punto de corte
 * de capítulo+un-solo-versículo valida (ver findVerseChain) — mismo orden
 * de búsqueda (capítulo con menos dígitos primero), pero acepta como
 * versículo final una CADENA ascendente en vez de exigir un solo número.
 * Solo se llama cuando findValidChapterVerseSplit ya devolvió null, así
 * que no cambia ningún caso que hoy resuelve.
 */
export function findChainedChapterVerseSplit(
  digits: string,
  structure: BookStructure,
): { chapter: number; verseStart: number; verseEnd: number } | null {
  for (let splitAt = 1; splitAt < digits.length; splitAt++) {
    const splitChapter = Number(digits.slice(0, splitAt));
    if (splitChapter < 1 || splitChapter > structure.chapterCount)
      continue;
    const versesInChapter = structure.versesPerChapter[splitChapter - 1];
    if (versesInChapter == null)
      continue;
    const chain = findVerseChain(digits.slice(splitAt), versesInChapter);
    if (chain) {
      return {
        chapter: splitChapter,
        verseStart: chain[0]!,
        verseEnd: chain.at(-1)!,
      };
    }
  }
  return null;
}

/**
 * Versículos candidatos a cierre de rango cuando los dígitos tipeados después
 * del guion ("-2" en "jn123-2") no alcanzan a formar un rango completo válido
 * con `verseStart` — típicamente porque el usuario todavía no terminó de
 * tipearlo. En vez de "no encontrado", se ofrece cada versículo del capítulo
 * MAYOR a `verseStart` cuyo número (como texto) empieza con esos dígitos —
 * "jn123-2" en Juan 1 (versículo inicial 23) da [24..29]: todos los que
 * arrancan con "2" y son mayores a 23; en Juan 12 (versículo inicial 3) da
 * [20..29], ya el prefijo "2" solo excluye 2 (que ya es menor a 3). Solo la
 * usa la vista predictiva de "Ir a" (goToPredictor.ts) — ver comentario en
 * ReferenceTail.verseEndDigits.
 */
export function findVerseEndCandidates(
  endDigits: string,
  verseStart: number,
  versesInChapter: number,
): number[] {
  const candidates: number[] = [];
  for (let verse = verseStart + 1; verse <= versesInChapter; verse++) {
    if (String(verse).startsWith(endDigits))
      candidates.push(verse);
  }
  return candidates;
}

/**
 * Resuelve capítulo/versículo contra la estructura real del libro (ver
 * BookStructure) en vez de aceptar cualquier número tal cual salió de la
 * regex. Dos casos:
 *
 *  1. Ya había un separador explícito entre capítulo y versículo (":", " ",
 *     coma o punto entre dígitos, todos normalizados a ":" antes de esta
 *     función) -> se usa tal cual; solo se valida que el capítulo exista
 *     (un versículo fuera de rango con separador explícito no se toca, el
 *     usuario fue explícito).
 *
 *  2. No había separador (dígitos pegados: "HB29", o "HB 29" con el 29
 *     interpretado como capítulo único) -> si ESE número no es un capítulo
 *     válido, se prueba a partirlo en capítulo+versículo en cada punto de
 *     corte posible, de izquierda a derecha (regla de precedencia
 *     determinista y documentada acá: para "119" se prueba primero 1:19,
 *     luego 11:9), y se usa el primer corte que valide contra la
 *     estructura real. Si el número completo YA es un capítulo válido, esa
 *     lectura gana siempre — no se intenta partir (ver tabla en el archivo
 *     de test: "HB 29" en un libro hipotético con 29 capítulos da "Libro 29").
 */
export function resolveNumericReference(
  chapterDigits: string | undefined,
  verseStart: number | undefined,
  verseEnd: number | undefined,
  structure: BookStructure | undefined,
): NumericResolution {
  if (chapterDigits == null)
    return { valid: true };

  const chapter = Number(chapterDigits);

  // Sin estructura disponible todavía (ej. books.json no cargó) -> no bloquear,
  // degradar a aceptar el número tal cual salió de la regex.
  if (!structure) {
    return {
      chapter,
      verseStart,
      verseEnd,
      valid: true,
    };
  }

  if (verseStart != null) {
    const chapterValid = chapter >= 1 && chapter <= structure.chapterCount;
    if (!chapterValid) {
      return {
        chapter,
        verseStart,
        verseEnd,
        valid: false,
      };
    }

    // Un solo versículo con separador explícito no se valida en sí (el
    // usuario fue explícito, ver comentario de la función) — solo el
    // capítulo, ya chequeado arriba.
    if (verseEnd == null)
      return { chapter, verseStart, valid: true };

    // Rango explícito ("3:16-18"): acá sí se valida contra la estructura
    // real (existencia de ambos extremos + orden) — un rango que no existe
    // no debería aceptarse silenciosamente (item 4 del backlog de rangos).
    const versesInChapter = structure.versesPerChapter[chapter - 1];
    const verseStartValid = versesInChapter != null && verseStart >= 1 && verseStart <= versesInChapter;
    const verseEndValid = versesInChapter != null && verseEnd >= 1 && verseEnd <= versesInChapter;
    const orderValid = verseStart <= verseEnd;
    return {
      chapter,
      verseStart,
      verseEnd,
      valid: verseStartValid && verseEndValid && orderValid,
    };
  }

  if (chapter >= 1 && chapter <= structure.chapterCount) {
    return { chapter, valid: true };
  }

  if (chapterDigits.length >= 2) {
    const split = findValidChapterVerseSplit(chapterDigits, structure);
    if (split)
      return { ...split, valid: true };
    // Ningún corte capítulo+UN-SOLO-versículo validó (ej. "567": ni
    // capítulo 5/verso 67 ni capítulo 56/verso 7 existen) — antes de darse
    // por vencido, se prueba si el remanente de cada corte descompone en
    // una cadena ascendente de versículos (ver findVerseChain), ej.
    // capítulo 5 + cadena [6,7] -> "Juan 5:6-7". Fallback puro, solo se
    // llega acá si lo de arriba ya falló.
    const chained = findChainedChapterVerseSplit(chapterDigits, structure);
    if (chained)
      return { ...chained, valid: true };
  }

  return { chapter, valid: false };
}

/**
 * Rango compacto sin separador antes del versículo inicial ("jn110-12"):
 * `digits` ("110") es capítulo+versículo inicial pegados — hay que partirlo
 * (ver findValidChapterVerseSplit) — y `verseEnd` (12) ya es explícito por
 * el guion. Sin estructura real no hay forma principled de elegir el corte
 * correcto, así que se marca inválido en vez de adivinar (a diferencia de
 * resolveNumericReference, que sí degrada sin estructura porque ahí el
 * número solo, sin partir, sigue siendo una lectura razonable).
 */
export function resolveGluedRange(digits: string, verseEnd: number, structure: BookStructure | undefined): NumericResolution {
  if (!structure)
    return { valid: false };
  const split = findValidChapterVerseSplit(digits, structure, verseEnd);
  if (!split)
    return { valid: false };
  return {
    chapter: split.chapter,
    verseStart: split.verseStart,
    verseEnd,
    valid: true,
  };
}

/**
 * Separa "parte de libro" del "resto" (capítulo/versículo tal como lo
 * escribió el usuario, ya normalizado pero SIN resolver contra ningún
 * libro) — usado por applySuggestion() en SearchBar.vue para poder
 * reemplazar SOLO la parte de libro por el nombre canónico sugerido
 * cuando no se reconoció ninguno ("¿Quisiste decir Hebreos?"), preservando
 * el capítulo/versículo que ya había tipeado en vez de borrar todo el
 * input (bug: sin esto, aceptar la sugerencia dejaba el input en solo el
 * nombre del libro, sin capítulo, y Enter ya no tenía nada que navegar).
 */
export function splitBookPart(input: string): { bookPart: string; tail: string } {
  const normalized = normalizeReferenceMarkers(input.trim());
  const tailMatch = TRAILING_NUMERIC_TAIL.exec(normalized) ?? TRAILING_GLUED_RANGE_TAIL.exec(normalized);
  if (!tailMatch) {
    return { bookPart: normalized, tail: "" };
  }
  return {
    bookPart: normalized.slice(0, tailMatch.index).trim(),
    tail: normalized.slice(tailMatch.index).trim(),
  };
}

// "varios versículos"/"algunos versículos" sueltos al inicio, SIN número
// después (si hubiera uno, sería "los N primeros versículos" u otra forma
// con sentido propio, ver LEADING_ORDINAL_VERSE_COUNT) -> se eliminan: ruido
// de "quiero ver por ahí algunos versículos" que antecede a la referencia
// real (dictado por voz), típicamente delante de un capítulo reversado
// ("varios versículos del capítulo 3 del libro de los hechos...").
const LEADING_VAGUE_VERSE_FILLER = /^(?:varios|algunos)\s+vers[ií]culos?\s+/i;

// "...versículo 10 y versículo 15" / "...versículos 10 y 15" / "...versículo
// 10, 12 y 15" al FINAL — lista de versículos PUNTUALES (no un rango), unidos
// por "y" (con comas opcionales para 3+). El marcador puede repetirse antes
// de cada número o no ("10 y versículo 15" / "10 y 15"), por eso es opcional
// en cada repetición. El `+` final exige AL MENOS una repetición después del
// primer número — un solo versículo ("versículo 8") no matchea acá, lo
// resuelve el resto del pipeline como siempre (ver tryParseVerseList).
// Sin \s* colgando antes de la alternancia (regexp/no-super-linear-backtracking:
// un \s* pegado a un \s+ adentro de la rama siguiente puede "intercambiar"
// espacios entre los dos cuantificadores) — cada rama ya trae su propio
// separador obligatorio (","/"y") antes de cualquier espacio opcional. La
// puntuación colgante ("...versículo 15?") se pela ANTES de probar esta
// regex (ver tryParseVerseList), no acá adentro — un "\s*[.?!]*\s*$" tenía
// el mismo problema de cuantificadores que se pisan (dos \s* separados solo
// por algo que puede matchear vacío).
const TRAILING_VERSE_LIST_CLAUSE = /vers[ií]culos?\s+(\d+(?:(?:,\s*(?:vers[ií]culos?\s+)?|\s+y\s+(?:vers[ií]culos?\s+)?)\d+)+)\s*$/i;

// Extrae todos los números sueltos de `text`, expandiendo cada "N-M"
// encontrado a todos los enteros entre N y M (inclusive) — usada tanto para
// listas de versículos puntuales (nunca traen "-", ver
// TRAILING_VERSE_LIST_CLAUSE) como para el grupo pegado por coma/punto y
// coma (GLUED_VERSE_GROUP_TAIL/_SEMICOLON), donde CADA segmento puede ser un
// rango propio (ej. "1-3,5,8-13,15,17-18"). Los `\d+` acá son deliberadamente
// sin tope de dígitos (a diferencia de los `\d{1,3}` de los regex que
// producen este texto) porque esta función no valida estructura, solo
// extrae/expande — la validación contra la Biblia real ocurre después, en el
// caller (ver tryParseGluedVerseGroupWith).
function extractVerseListNumbers(text: string): number[] {
  const numbers = new Set<number>();
  for (const match of text.matchAll(/(\d+)(?:\s*-\s*(\d+))?/g)) {
    const start = Number(match[1]);
    const end = match[2] != null
      ? Number(match[2])
      : start;
    for (let v = start; v <= end; v++)
      numbers.add(v);
  }
  return [...numbers].sort((a, b) => a - b);
}

/**
 * Camino APARTE para "libro [capítulo] versículo A y versículo B" (lista de
 * versículos puntuales, no contigua) — el resto de parseBibleReference está
 * profundamente afinado para UN rango contiguo (verseStart/verseEnd
 * únicamente, ver resolveNumericReference/extractReferenceTail), forzar una
 * lista a pasar por esa gramática habría significado reescribir buena parte
 * de ella. Se prueba PRIMERO, sin tocar nada más: si no matchea (la inmensa
 * mayoría de los inputs, cualquiera sin la palabra "versículo(s)" repetida
 * con un "y"/coma de por medio) devuelve null enseguida y el resto de
 * parseBibleReference sigue exactamente como antes.
 *
 * Acepta tanto orden directo ("Romanos 5 versículos 10 y 15") como el libro
 * en orden invertido con capítulo reversado ("del capítulo 3 del libro de
 * los Hechos versículo 10 y versículo 15" — REVERSED_NATURAL_LANGUAGE ya
 * sabe leer esa forma, con un "del " colgante extra al principio que ese
 * regex no espera por sí solo, ver reversedPrefix). No arma isPrefixContinuation/
 * ghostSuffix (sin ghost-text para esta forma, caso más raro) — solo importa
 * para el overlay de autocompletado del input, no para resolver/navegar.
 */
function tryParseVerseList(
  trimmed: string,
  matchBook: (query: string) => BookAliasMatch[],
  getStructure: (bookId: number) => BookStructure | undefined,
  options: { activeCandidateIndex?: number },
): ParsedBibleReference | null {
  const cleaned = trimmed
    .replace(LEADING_FILLER_PHRASE, "")
    .replace(LEADING_BOOK_OF_FILLER, "")
    .replace(LEADING_VAGUE_VERSE_FILLER, "")
    .replace(/[.?!]+\s*$/, "");

  const listMatch = TRAILING_VERSE_LIST_CLAUSE.exec(cleaned);
  if (!listMatch)
    return null;

  const verses = extractVerseListNumbers(listMatch[1]!);
  if (verses.length < 2)
    return null;

  const prefix = cleaned.slice(0, listMatch.index).trim();
  const reversedMatch = REVERSED_NATURAL_LANGUAGE.exec(prefix.replace(/^del\s+/i, ""));
  const bookAndChapterRaw = reversedMatch
    ? `${reversedMatch[3]} ${reversedMatch[1]} ${reversedMatch[2]}`
    : prefix;

  const { bookPart, chapterDigits } = extractReferenceTail(normalizeReferenceMarkers(bookAndChapterRaw));
  if (bookPart === "")
    return null;

  const candidates = matchBook(bookPart);
  if (candidates.length === 0)
    return null;

  const exactPrefixMatches = candidates.filter(c => c.isExactPrefix);
  const isConfidentSingle = candidates.length === 1 || exactPrefixMatches.length === 1;
  const activeCandidateIndex = clamp(options.activeCandidateIndex ?? 0, 0, candidates.length - 1);
  const resolvedIndex = isConfidentSingle
    ? candidates.findIndex(c => exactPrefixMatches.length === 1
        ? c.isExactPrefix
        : true)
    : activeCandidateIndex;
  const activeBook = candidates[resolvedIndex] ?? candidates[0];
  if (!activeBook)
    return null;

  const structure = getStructure(activeBook.id);
  const numeric = resolveNumericReference(chapterDigits, undefined, undefined, structure);
  if (!numeric.valid || numeric.chapter == null)
    return null;
  const chapter = numeric.chapter;

  // Validar cada versículo de la lista contra la estructura real, si hay
  // (sin estructura, degrada a aceptar tal cual — mismo criterio que
  // resolveNumericReference para capítulo/versículo solos).
  if (structure) {
    const versesInChapter = structure.versesPerChapter[chapter - 1];
    const allValid = versesInChapter != null && verses.every(v => v >= 1 && v <= versesInChapter);
    if (!allValid)
      return null;
  }

  const canonicalLabel = `${activeBook.name} ${chapter}:${verses.join(",")}`;
  const base = {
    raw: trimmed,
    activeCandidateIndex: resolvedIndex,
    chapter,
    verses,
    verseStart: verses[0],
    canonicalLabel,
    isPrefixContinuation: false as const,
  };
  return isConfidentSingle
    ? {
        ...base,
        status: "valid",
        book: { id: activeBook.id, name: activeBook.name, matchedAlias: activeBook.matchedAlias },
      }
    : { ...base, status: "ambiguous", bookCandidates: candidates };
}

// "últimos N versículos/versos de <libro>[ capítulo M]" ("últimos 3 versos de
// jn10", "últimos 3 versículos del libro de Juan capítulo 10") — a diferencia
// de "primeros N versículos" (LEADING_ORDINAL_VERSE_COUNT/rewriteLeadingOrdinalVerseCount,
// siempre rango 1..N, no necesita saber cuántos versículos tiene el
// capítulo), "últimos" SÍ depende de la estructura real (dónde termina el
// capítulo) para saber dónde arranca el rango — no se puede resolver con una
// reescritura de texto pura ANTES de conocer el libro/capítulo, necesita su
// propio camino con matchBook/getStructure, igual que tryParseVerseList.
const LEADING_LAST_N_VERSES = /^[uú]ltimos?\s+(\d+|[a-zñáéíóú]+)\s+(?:vers(?:[ií]culos?|os?)|vs)\s+(?:del\s+libro\s+de|de)\s+(\S.*)$/i;

/** Resultado estructural de matchLastNVersesTail — sin resolver todavía contra ninguna estructura de libro (ver resolveLastNVerses). */
export type LastNVersesTailMatch = {
  count: number;
  bookPart: string;
  chapterDigits: string | undefined;
};

/**
 * Paso 1 (sin estructura/matchBook) de tryParseLastNVerses: separado para
 * que goToPredictor.ts (vista predictiva de "Ir a") pueda reusarlo tal cual
 * — mismo motivo/mismo patrón que matchGluedVerseGroupTail/resolveGluedVerseGroupVerses:
 * necesita resolver la MISMA frase contra la estructura de CADA libro
 * candidato por separado, así que el corte de texto (estructura-
 * independiente) y la resolución numérica (estructura-dependiente, ver
 * resolveLastNVerses) tienen que poder llamarse por separado. Sin esto,
 * goToPredictor nunca se entera de esta frase (sigue llamando a
 * normalizeReferenceMarkers directo) y la vista predictiva de "Ir a" queda
 * sin cards aunque el label de arriba ya resuelva bien — mismo bug que
 * "rango con guion + coma" de una ronda anterior.
 */
export function matchLastNVersesTail(trimmed: string): LastNVersesTailMatch | null {
  const cleaned = trimmed.replace(LEADING_FILLER_PHRASE, "");
  const match = LEADING_LAST_N_VERSES.exec(cleaned);
  if (!match)
    return null;

  const count = resolveCardinal(match[1]!);
  if (count == null || count < 1)
    return null;

  const { bookPart, chapterDigits } = extractReferenceTail(normalizeReferenceMarkers(match[2]!));
  if (bookPart === "")
    return null;

  return { count, bookPart, chapterDigits };
}

/**
 * Paso 2 (contra la estructura de UN libro) de tryParseLastNVerses — ver
 * comentario de matchLastNVersesTail sobre por qué está separado. Sin
 * estructura real no hay forma de saber dónde termina el capítulo (a
 * diferencia de otros caminos de este archivo, acá no hay una degradación
 * razonable que ofrecer) — inválido en vez de adivinar.
 */
export function resolveLastNVerses(
  count: number,
  chapterDigits: string | undefined,
  structure: BookStructure | undefined,
): { chapter: number; verseStart: number; verseEnd: number } | null {
  if (!structure)
    return null;

  const numeric = resolveNumericReference(chapterDigits, undefined, undefined, structure);
  if (!numeric.valid || numeric.chapter == null)
    return null;
  const chapter = numeric.chapter;

  const versesInChapter = structure.versesPerChapter[chapter - 1];
  if (versesInChapter == null || count > versesInChapter)
    return null;
  const verseEnd = versesInChapter;
  const verseStart = verseEnd - count + 1;

  return { chapter, verseStart, verseEnd };
}

/**
 * Camino APARTE para "últimos N versículos de <libro>[ capítulo M]" — ver
 * comentario de LEADING_LAST_N_VERSES sobre por qué no puede ser una simple
 * reescritura de texto. Se prueba junto con tryParseVerseList (antes de
 * normalizeReferenceMarkers del string completo): si no matchea la frase
 * "últimos N versículos de..." devuelve null enseguida, sin tocar nada más.
 */
function tryParseLastNVerses(
  trimmed: string,
  matchBook: (query: string) => BookAliasMatch[],
  getStructure: (bookId: number) => BookStructure | undefined,
  options: { activeCandidateIndex?: number },
): ParsedBibleReference | null {
  const tailMatch = matchLastNVersesTail(trimmed);
  if (!tailMatch)
    return null;

  const candidates = matchBook(tailMatch.bookPart);
  if (candidates.length === 0)
    return null;

  const exactPrefixMatches = candidates.filter(c => c.isExactPrefix);
  const isConfidentSingle = candidates.length === 1 || exactPrefixMatches.length === 1;
  const activeCandidateIndex = clamp(options.activeCandidateIndex ?? 0, 0, candidates.length - 1);
  const resolvedIndex = isConfidentSingle
    ? candidates.findIndex(c => exactPrefixMatches.length === 1
        ? c.isExactPrefix
        : true)
    : activeCandidateIndex;
  const activeBook = candidates[resolvedIndex] ?? candidates[0];
  if (!activeBook)
    return null;

  const structure = getStructure(activeBook.id);
  const resolved = resolveLastNVerses(tailMatch.count, tailMatch.chapterDigits, structure);
  if (!resolved)
    return null;
  const { chapter, verseStart, verseEnd } = resolved;

  const canonicalLabel = `${activeBook.name} ${chapter}:${verseStart}-${verseEnd}`;
  const base = {
    raw: trimmed,
    activeCandidateIndex: resolvedIndex,
    chapter,
    verseStart,
    verseEnd,
    canonicalLabel,
    isPrefixContinuation: false as const,
  };
  return isConfidentSingle
    ? {
        ...base,
        status: "valid",
        book: { id: activeBook.id, name: activeBook.name, matchedAlias: activeBook.matchedAlias },
      }
    : { ...base, status: "ambiguous", bookCandidates: candidates };
}

// "jn56,7,12,15" / "jn5:6,7,12,15" / "jn5,6,7,12,15": grupo de versículos
// separados por coma, SIN la palabra "versículo" (a diferencia de
// TRAILING_VERSE_LIST_CLAUSE/tryParseVerseList, que la exige) — el primer
// tramo (antes de la primera coma) es capítulo solo, capítulo+versículo
// pegados (ver resolveNumericReference, incluye el fallback en cadena de
// findChainedChapterVerseSplit), o capítulo:versículo explícito; cada coma
// siguiente agrega OTRO versículo suelto al mismo capítulo.
//
// (?<![\d-]) al inicio: mismo motivo que TRAILING_NUMERIC_TAIL, evita
// arrancar el match en medio de un dígito. Cada \s* está pegado a un
// literal obligatorio (":", "-", "," o ";") a un lado, nunca a otro
// cuantificador — misma familia segura contra backtracking polinomial que
// el resto del archivo (regexp/no-super-linear-backtracking).
//
// El grupo ":versículo" admite además un rango con guion ("2:16-18,20") —
// necesario para no perder el rango cuando normalizeReferenceMarkers todavía
// no corrió (este camino se prueba ANTES, ver comentario de
// tryParseGluedVerseGroupWith más abajo): sin este soporte, "Mateo 2:16-18,20"
// nunca matcheaba acá y terminaba corrompido por el atajo global de coma->":"
// de normalizeReferenceMarkers ("2:16-18:20", imposible de resolver después).
//
// CADA segmento del grupo por coma/punto y coma admite a su vez su propio
// rango con guion ("2:1-3,5,8-13,15,17-18" -> {1,2,3,5,8,9,10,11,12,13,15,
// 17,18}), no solo el primer tramo — ver extractVerseListNumbers, que
// expande cada "N-M" encontrado en vez de quedarse solo con N y M sueltos.
//
// Además del ":versículo(-rango)?" explícito, el primer tramo admite un
// rango con guion SIN ":" cuando los dígitos vienen pegados al capítulo
// ("mt56-8,10" -> Mateo 5:6-8,10, "56" es capítulo+versículo inicial
// pegados, mismo mecanismo que "jn110-12" — ver resolveGluedRange) — de ahí
// el `(\d{1,6})` en vez de `(\d{1,3})` para el primer tramo, mismo rango de
// longitud que TRAILING_GLUED_RANGE_TAIL. Las dos formas (":versículo-fin" y
// "-fin" pegado) son mutuamente excluyentes por el "?:" alternado, nunca
// matchean las dos a la vez.
const GLUED_VERSE_GROUP_TAIL = /(?<![\d-])\s*(\d{1,6})(?::\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?|-\s*(\d{1,3}))?((?:\s*,\s*\d{1,3}(?:\s*-\s*\d{1,3})?)+)\s*$/;

// "jn35;6" -> Juan 3:5,6: misma idea que el grupo por coma de arriba, pero
// con ";" — a pedido del usuario, ";" NUNCA colapsa versículos consecutivos
// en un rango con guion (a diferencia de ","), aunque el conjunto resuelto
// sea el mismo ({5,6} en este ejemplo) — el separador elegido en el input
// decide el formato de salida, ver tryParseGluedVerseGroupWith(collapse). Un
// "-" DENTRO de un segmento (ej. "jn3:5-7;10") sigue siendo un rango de
// entrada normal, independiente de esa regla de salida.
// Sin el problema de colisión que tiene "," (nunca hubo un atajo previo con
// ";"), así que se activa con UNA sola ocurrencia, no hace falta 2+.
const GLUED_VERSE_GROUP_TAIL_SEMICOLON = /(?<![\d-])\s*(\d{1,6})(?::\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?|-\s*(\d{1,3}))?((?:\s*;\s*\d{1,3}(?:\s*-\s*\d{1,3})?)+)\s*$/;

/**
 * Camino APARTE para grupos de versículos por coma/punto y coma, SIN la
 * palabra "versículo" (ver GLUED_VERSE_GROUP_TAIL/_SEMICOLON) — corre ANTES
 * de normalizeReferenceMarkers a propósito, igual que tryParseVerseList: esa
 * función convierte CUALQUIER coma-entre-dígitos a ":" globalmente (atajo
 * ya existente "Juan 3,16" -> capítulo 3 : versículo 16), lo que con 2+
 * comas destruiría la lista entera antes de poder leerla.
 *
 * `requireMultipleWithoutColon` existe SOLO para el separador coma: para no
 * chocar con ese atajo de una sola coma, ese camino solo se activa con 2 o
 * más comas, o con ":" explícito antes de la primera (ahí no hay ambigüedad
 * posible: el atajo viejo nunca tiene ":"). ";" nunca tuvo un significado
 * previo, así que ese camino se activa con una sola ocurrencia.
 * `collapseConsecutive` decide el formato del label final (ver más abajo).
 * Sin soporte de orden invertido para esta forma — los ejemplos pedidos son
 * todos en orden directo (libro primero).
 */
/** Resultado estructural de matchGluedVerseGroupTail — sin resolver todavía contra ninguna estructura de libro (ver resolveGluedVerseGroupVerses). */
export type GluedVerseGroupTailMatch = {
  bookPart: string;
  firstDigits: string;
  colonVerseDigits: string | undefined;
  colonVerseRangeEnd: string | undefined;
  /** "-fin" pegado SIN ":" (ej. "56-8,10" -> Mateo 5:6-8,10) — excluyente con colonVerseDigits, nunca los dos a la vez (ver el regex). */
  bareRangeEnd: string | undefined;
  verseGroup: string;
};

/**
 * Paso 1 (sin estructura/matchBook) de tryParseGluedVerseGroupWith: separado
 * para que goToPredictor.ts (vista predictiva de "Ir a") pueda reusarlo tal
 * cual — necesita resolver la MISMA forma contra la estructura de CADA libro
 * candidato por separado (a diferencia de acá, que resuelve una sola vez
 * contra el libro activo), así que el corte bookPart/dígitos (estructura-
 * independiente) y la resolución numérica (estructura-dependiente, ver
 * resolveGluedVerseGroupVerses) tienen que poder llamarse por separado.
 */
export function matchGluedVerseGroupTail(
  trimmed: string,
  config: { tailRegex: RegExp; separator: "," | ";"; requireMultipleWithoutColon: boolean },
): GluedVerseGroupTailMatch | null {
  const cleaned = trimmed
    .replace(LEADING_FILLER_PHRASE, "")
    .replace(LEADING_BOOK_OF_FILLER, "");

  const match = config.tailRegex.exec(cleaned);
  if (!match)
    return null;

  const [, firstDigits, colonVerseDigits, colonVerseRangeEnd, bareRangeEnd, verseGroup] = match;
  const separatorCount = verseGroup!.split(config.separator).length - 1;
  // El atajo viejo de una sola coma ("Juan 3,16" -> capítulo 3:16) solo
  // compite con la lectura SIN ningún marcador de rango explícito — un
  // "-fin" pegado (bareRangeEnd) nunca tuvo un significado previo con el que
  // pueda chocar, así que también habilita una sola coma, igual que ":".
  if (colonVerseDigits == null && bareRangeEnd == null && config.requireMultipleWithoutColon && separatorCount < 2)
    return null;

  const bookPart = normalizeReferenceMarkers(cleaned.slice(0, match.index).trim());
  if (bookPart === "")
    return null;

  return {
    bookPart,
    firstDigits: firstDigits!,
    colonVerseDigits,
    colonVerseRangeEnd,
    bareRangeEnd,
    verseGroup: verseGroup!,
  };
}

/**
 * Paso 2 (contra la estructura de UN libro) de tryParseGluedVerseGroupWith —
 * ver comentario de matchGluedVerseGroupTail sobre por qué está separado.
 */
export function resolveGluedVerseGroupVerses(
  match: GluedVerseGroupTailMatch,
  structure: BookStructure | undefined,
): { chapter: number; verses: number[] } | null {
  const { firstDigits, colonVerseDigits, colonVerseRangeEnd, bareRangeEnd, verseGroup } = match;

  let chapter: number;
  const firstVerses: number[] = [];
  if (colonVerseDigits != null) {
    // ":" explícito -> capítulo y primer versículo ya vienen separados, sin
    // ambigüedad que resolver acá (no pasa por resolveNumericReference). Si
    // además trae un rango con guion ("2:16-18"), se expande a todos los
    // versículos del rango antes de sumar el resto del grupo por coma/punto
    // y coma.
    chapter = Number(firstDigits);
    if (structure && (chapter < 1 || chapter > structure.chapterCount))
      return null;
    const rangeStart = Number(colonVerseDigits);
    const rangeEnd = colonVerseRangeEnd != null
      ? Number(colonVerseRangeEnd)
      : rangeStart;
    for (let v = rangeStart; v <= rangeEnd; v++)
      firstVerses.push(v);
  }
  else if (bareRangeEnd != null) {
    // "-fin" pegado SIN ":" ("56-8,10" -> capítulo+versículo inicial
    // pegados, "-8" cierra el rango) — mismo mecanismo que "jn110-12" (ver
    // resolveGluedRange/findValidChapterVerseSplit): sin estructura real no
    // hay forma de elegir el corte correcto, así que sin `structure` esta
    // lectura es inválida (a diferencia de la rama de abajo, que si degrada
    // sin estructura porque ahí el número solo, sin partir, sigue siendo
    // razonable).
    const numeric = resolveGluedRange(firstDigits, Number(bareRangeEnd), structure);
    if (!numeric.valid || numeric.chapter == null || numeric.verseStart == null)
      return null;
    chapter = numeric.chapter;
    const end = numeric.verseEnd ?? numeric.verseStart;
    for (let v = numeric.verseStart; v <= end; v++)
      firstVerses.push(v);
  }
  else {
    // Sin ":" -> mismo camino que tryParseVerseList para el primer tramo:
    // puede ser un capítulo solo ("5,6,7,..." -> todos los versículos
    // vienen del grupo) o capítulo+versículo(s) pegados ("56,7,..." ->
    // capítulo 5, versículo 6 — o incluso un rango si el remanente lo pide,
    // ver findChainedChapterVerseSplit dentro de resolveNumericReference).
    const numeric = resolveNumericReference(firstDigits, undefined, undefined, structure);
    if (!numeric.valid || numeric.chapter == null)
      return null;
    chapter = numeric.chapter;
    if (numeric.verseStart != null) {
      const end = numeric.verseEnd ?? numeric.verseStart;
      for (let v = numeric.verseStart; v <= end; v++)
        firstVerses.push(v);
    }
  }

  const verses = extractVerseListNumbers(`${firstVerses.join(" ")} ${verseGroup}`);
  if (verses.length === 0)
    return null;

  // Validar cada versículo del grupo contra la estructura real, si hay —
  // todo o nada (mismo criterio que tryParseVerseList): uno solo fuera de
  // rango invalida el grupo entero, no se acepta parcialmente.
  if (structure) {
    const versesInChapter = structure.versesPerChapter[chapter - 1];
    const allValid = versesInChapter != null && verses.every(v => v >= 1 && v <= versesInChapter);
    if (!allValid)
      return null;
  }

  return { chapter, verses };
}

function tryParseGluedVerseGroupWith(
  trimmed: string,
  matchBook: (query: string) => BookAliasMatch[],
  getStructure: (bookId: number) => BookStructure | undefined,
  options: { activeCandidateIndex?: number },
  config: { tailRegex: RegExp; separator: "," | ";"; requireMultipleWithoutColon: boolean; collapseConsecutive: boolean },
): ParsedBibleReference | null {
  const tailMatch = matchGluedVerseGroupTail(trimmed, config);
  if (!tailMatch)
    return null;

  const candidates = matchBook(tailMatch.bookPart);
  if (candidates.length === 0)
    return null;

  const exactPrefixMatches = candidates.filter(c => c.isExactPrefix);
  const isConfidentSingle = candidates.length === 1 || exactPrefixMatches.length === 1;
  const activeCandidateIndex = clamp(options.activeCandidateIndex ?? 0, 0, candidates.length - 1);
  const resolvedIndex = isConfidentSingle
    ? candidates.findIndex(c => exactPrefixMatches.length === 1
        ? c.isExactPrefix
        : true)
    : activeCandidateIndex;
  const activeBook = candidates[resolvedIndex] ?? candidates[0];
  if (!activeBook)
    return null;

  const structure = getStructure(activeBook.id);
  const resolved = resolveGluedVerseGroupVerses(tailMatch, structure);
  if (!resolved)
    return null;
  const { chapter, verses } = resolved;

  // formatVerseRanges colapsa [6,7,12,15] en "6-7,12,15" (separador coma);
  // verses.join(',') deja cada versículo suelto tal cual, sin colapsar
  // consecutivos (separador punto y coma) — ver collapseConsecutive en el
  // comentario grande de la función.
  const canonicalLabel = `${activeBook.name} ${chapter}:${config.collapseConsecutive
    ? formatVerseRanges(verses)
    : verses.join(",")}`;
  const base = {
    raw: trimmed,
    activeCandidateIndex: resolvedIndex,
    chapter,
    verses,
    verseStart: verses[0],
    canonicalLabel,
    isPrefixContinuation: false as const,
  };
  return isConfidentSingle
    ? {
        ...base,
        status: "valid",
        book: { id: activeBook.id, name: activeBook.name, matchedAlias: activeBook.matchedAlias },
      }
    : { ...base, status: "ambiguous", bookCandidates: candidates };
}

function tryParseGluedVerseGroup(
  trimmed: string,
  matchBook: (query: string) => BookAliasMatch[],
  getStructure: (bookId: number) => BookStructure | undefined,
  options: { activeCandidateIndex?: number },
): ParsedBibleReference | null {
  return tryParseGluedVerseGroupWith(trimmed, matchBook, getStructure, options, {
    tailRegex: GLUED_VERSE_GROUP_TAIL,
    separator: ",",
    requireMultipleWithoutColon: true,
    collapseConsecutive: true,
  });
}

function tryParseSemicolonVerseGroup(
  trimmed: string,
  matchBook: (query: string) => BookAliasMatch[],
  getStructure: (bookId: number) => BookStructure | undefined,
  options: { activeCandidateIndex?: number },
): ParsedBibleReference | null {
  return tryParseGluedVerseGroupWith(trimmed, matchBook, getStructure, options, {
    tailRegex: GLUED_VERSE_GROUP_TAIL_SEMICOLON,
    separator: ";",
    requireMultipleWithoutColon: false,
    collapseConsecutive: false,
  });
}

/**
 * Igual que tryParseGluedVerseGroup/tryParseSemicolonVerseGroup (coma
 * primero, después ";", mismo orden que parseBibleReference), pero solo el
 * paso 1 (estructura-independiente) — para goToPredictor.ts, que necesita
 * resolver la lista contra CADA libro candidato por separado (ver
 * matchGluedVerseGroupTail).
 */
export function matchAnyGluedVerseGroupTail(trimmed: string): GluedVerseGroupTailMatch | null {
  return (
    matchGluedVerseGroupTail(trimmed, { tailRegex: GLUED_VERSE_GROUP_TAIL, separator: ",", requireMultipleWithoutColon: true })
    ?? matchGluedVerseGroupTail(trimmed, { tailRegex: GLUED_VERSE_GROUP_TAIL_SEMICOLON, separator: ";", requireMultipleWithoutColon: false })
  );
}

/**
 * Parser puro (sin Vue/Fuse): recibe `matchBook` inyectado (normalmente
 * useBookAutocomplete().match) para poder testearse con un matcher fake, y
 * `getStructure` para validar capítulo/versículo contra la Biblia real (ver
 * resolveNumericReference).
 * Se llama de nuevo en cada keystroke — no tiene memoria propia; el ciclo
 * de candidatos con flechas arriba/abajo lo sostiene useBibleReference vía
 * `activeCandidateIndex`.
 */
export function parseBibleReference(
  input: string,
  matchBook: (query: string) => BookAliasMatch[],
  getStructure: (bookId: number) => BookStructure | undefined,
  options: { activeCandidateIndex?: number } = {},
): ParsedBibleReference {
  const raw = input;
  const trimmed = input.trim();

  if (trimmed === "") {
    return {
      raw,
      status: "idle",
      activeCandidateIndex: 0,
      isPrefixContinuation: false,
    };
  }

  const verseListResult = tryParseVerseList(trimmed, matchBook, getStructure, options);
  if (verseListResult)
    return { ...verseListResult, raw };

  const lastNVersesResult = tryParseLastNVerses(trimmed, matchBook, getStructure, options);
  if (lastNVersesResult)
    return { ...lastNVersesResult, raw };

  const gluedGroupResult = tryParseGluedVerseGroup(trimmed, matchBook, getStructure, options);
  if (gluedGroupResult)
    return { ...gluedGroupResult, raw };

  const semicolonGroupResult = tryParseSemicolonVerseGroup(trimmed, matchBook, getStructure, options);
  if (semicolonGroupResult)
    return { ...semicolonGroupResult, raw };

  // `raw`/`trimmed` se preservan intactos para el ghost-text (isPrefixContinuation
  // compara contra lo que el usuario tipeó literalmente); la normalización de
  // marcadores solo se usa para resolver libro/capítulo/versículo.
  const normalized = normalizeReferenceMarkers(trimmed);
  // `chapterDigits` puede ser un capítulo suelto o (sin separador) un
  // capítulo+versículo pegados a partir contra la estructura real — ver
  // resolveNumericReference. `gluedRangeDigits`, cuando está presente, es lo
  // mismo pero para el fallback de rango compacto ("jn110-12") — ver
  // resolveGluedRange.
  const { bookPart, chapterDigits, verseStart: rawVerseStart, verseEnd: rawVerseEnd, gluedRangeDigits } = extractReferenceTail(normalized);

  const candidates = bookPart === ""
    ? []
    : matchBook(bookPart);

  if (candidates.length === 0) {
    return {
      raw,
      status: "invalid",
      activeCandidateIndex: 0,
      isPrefixContinuation: false,
    };
  }

  // Único candidato, o exactamente un candidato con prefijo exacto y el resto no
  // (señal fuerte de intención clara) -> resuelto sin ambigüedad.
  const exactPrefixMatches = candidates.filter(c => c.isExactPrefix);
  const isConfidentSingle = candidates.length === 1 || exactPrefixMatches.length === 1;

  const activeCandidateIndex = clamp(options.activeCandidateIndex ?? 0, 0, candidates.length - 1);
  const resolvedIndex = isConfidentSingle
    ? candidates.findIndex(c => exactPrefixMatches.length === 1
        ? c.isExactPrefix
        : true)
    : activeCandidateIndex;
  const activeBook = candidates[resolvedIndex] ?? candidates[0];
  // candidates.length > 0 acá (ya se devolvió antes si estaba vacío), así que
  // esto es solo para que TS no se queje del acceso por índice — nunca debería
  // ejecutarse en la práctica, pero si pasa, tratamos como invalid en vez de crashear.
  if (!activeBook) {
    return {
      raw,
      status: "invalid",
      activeCandidateIndex: 0,
      isPrefixContinuation: false,
    };
  }

  const structure = getStructure(activeBook.id);
  const numeric = gluedRangeDigits != null
    ? resolveGluedRange(gluedRangeDigits, rawVerseEnd!, structure)
    : resolveNumericReference(chapterDigits, rawVerseStart, rawVerseEnd, structure);
  if (!numeric.valid) {
    return {
      raw,
      status: "invalid",
      activeCandidateIndex: 0,
      isPrefixContinuation: false,
    };
  }
  const { chapter, verseStart, verseEnd } = numeric;

  const canonicalLabel = buildCanonicalLabel(activeBook.name, chapter, verseStart, verseEnd);
  const normalizedRaw = normalizeText(raw);
  const normalizedCanonical = normalizeText(canonicalLabel);
  const isPrefixContinuation = normalizedCanonical.startsWith(normalizedRaw) && normalizedRaw.length > 0;
  const ghostSuffix = isPrefixContinuation
    ? canonicalLabel.slice(raw.length)
    : undefined;

  // Lectura alternativa PURAMENTE informativa (ver comentario grande en el
  // campo alternateCanonicalLabel de ParsedBibleReference) — SOLO cuando:
  // (a) esta lectura vino de dígitos pegados SIN separador explícito
  // (gluedRangeDigits/rawVerseStart ambos ausentes acá — con ":" u otro
  // separador explícito no hay ambigüedad de dígitos que ofrecer);
  // (b) el capítulo tomó 1 solo dígito y el remanente exactamente 2
  // (chapterDigits.length === 3) — el único tamaño que cubren los ejemplos
  // pedidos, no una regla general para cualquier cantidad de dígitos;
  // (c) verseEnd viene undefined -> esto YA descarta el camino de
  // findChainedChapterVerseSplit (que siempre trae los dos, ver "jn356" ->
  // 5-6): acá el remanente de 2 dígitos alcanzó a validar de una sola vez
  // como un ÚNICO versículo (ej. "16" -> versículo 16), sin necesitar cadena.
  //
  // Con esas 2 dígitos por separado (d1, d2): si van ascendentes (d1<=d2),
  // "16" -> "1-6" es una lectura de rango tan válida como "16" a secas ->
  // se ofrece como alternativa. Si van descendentes (d1>d2, ej. "21" ->
  // 2,1) NO existe ese rango (el inicio no puede ser mayor al fin) -> no
  // hay alternativa, se queda en el único resultado de siempre (ej.
  // "jn421" -> solo "Juan 4:21", sin cambios).
  let alternateCanonicalLabel: string | undefined;
  if (gluedRangeDigits == null && rawVerseStart == null && chapterDigits != null && chapterDigits.length === 3
    && chapter != null && verseStart != null && verseEnd == null && verseStart >= 10 && verseStart <= 99) {
    const d1 = Math.floor(verseStart / 10);
    const d2 = verseStart % 10;
    if (d1 <= d2) {
      const versesInChapter = structure?.versesPerChapter[chapter - 1];
      if (versesInChapter == null || (d1 >= 1 && d2 <= versesInChapter)) {
        alternateCanonicalLabel = d1 === d2
          ? buildCanonicalLabel(activeBook.name, chapter, d1)
          : buildCanonicalLabel(activeBook.name, chapter, d1, d2);
      }
    }
  }

  if (isConfidentSingle) {
    return {
      raw,
      status: "valid",
      book: { id: activeBook.id, name: activeBook.name, matchedAlias: activeBook.matchedAlias },
      activeCandidateIndex: resolvedIndex,
      chapter,
      verseStart,
      verseEnd,
      canonicalLabel,
      alternateCanonicalLabel,
      isPrefixContinuation,
      ghostSuffix,
    };
  }

  return {
    raw,
    status: "ambiguous",
    bookCandidates: candidates,
    activeCandidateIndex,
    chapter,
    verseStart,
    verseEnd,
    canonicalLabel,
    alternateCanonicalLabel,
    isPrefixContinuation,
    ghostSuffix,
  };
}
