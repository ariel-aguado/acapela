import type { VerseRow } from "~~/lib/bible";

import { escapeHtml } from "./escape-html";

/**
 * Utilidades puras para la selección de versículos en la vista de lectura
 * (tocar el texto de un versículo lo agrega/saca de la selección, ver
 * useVerseSelection.ts) — la selección es un CONJUNTO de números de
 * versículo, no un rango start/end, porque se arma tocando versículos uno
 * por uno y puede terminar no contigua (ej. "Juan 3:16-18,20-25").
 */

/**
 * Agrupa corridas consecutivas de `verses` (se ordena acá adentro, no hace
 * falta que venga ordenado) en su forma canónica "N" o "A-B", unidas por
 * coma — ej. [16,17,18,20,21,22,23,24,25] -> "16-18,20-25". Es la pieza que
 * arma tanto el título del diálogo de acciones (BibleVerseActionsDrawer)
 * como el texto/hash de compartir (BibleShareActions).
 */
export function formatVerseRanges(verses: number[]): string {
  if (verses.length === 0)
    return "";

  const sorted = [
    ...new Set(verses),
  ].sort((a, b) => a - b);
  const groups: string[] = [];
  let start = sorted[0]!;
  let end = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    if (current === end + 1) {
      end = current;
      continue;
    }
    groups.push(start === end
      ? `${start}`
      : `${start}-${end}`);
    start = current;
    end = current;
  }
  groups.push(start === end
    ? `${start}`
    : `${start}-${end}`);

  return groups.join(",");
}

/**
 * Inversa de formatVerseRanges — "16-18,20-25" o "10,15" -> lista de
 * versículos ordenada y sin duplicados. Usada por el hash de navegación
 * (#v..., ver useVerseNavigation.ts/[chapter].vue) para poder representar
 * una selección o una lista de versículos puntuales, no solo un único rango
 * contiguo (#vA-B) como antes. Segmentos que no son "N" ni "A-B" se
 * ignoran (hash armado a mano/corrupto) en vez de tirar una excepción.
 */
export function parseVerseRanges(input: string): number[] {
  const verses = new Set<number>();
  for (const segment of input.split(",")) {
    const trimmed = segment.trim();
    const rangeMatch = /^(\d+)-(\d+)$/.exec(trimmed);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      for (let v = Math.min(start, end); v <= Math.max(start, end); v++)
        verses.add(v);
      continue;
    }
    if (/^\d+$/.test(trimmed))
      verses.add(Number(trimmed));
  }
  return [...verses].sort((a, b) => a - b);
}

/**
 * `verses` filtrado y ordenado según `selectedVerses` — paso compartido por
 * selectionPlainText/selectionRichHtml de abajo, así ambas arman la misma
 * lista de filas exactamente igual. Descarta filas con texto vacío (versículo
 * tragado por una fusión de la traducción, ver VerseRow.verseRangeEnd, o
 * genuinamente ausente en ella) — nunca hay nada útil que copiar ahí, la fila
 * que sí tiene texto (la dueña de la fusión) ya trae el contenido completo.
 * Exportada para que BibleCompareVersionsScreen.vue arme el mismo filtrado
 * por cada versión comparada (cada una puede fusionar/tragar versículos
 * distinto, ver VerseRow.verseRangeEnd).
 */
export function selectedVerseRows(verses: VerseRow[], selectedVerses: number[]): VerseRow[] {
  return selectedVerses
    .map(number => verses.find(v => v.verse === number))
    .filter((v): v is VerseRow => v != null && v.text.trim() !== "");
}

/**
 * Expande cada número de `selected` que sea DUEÑO de una fusión (ver
 * VerseRow.verseRangeEnd) a TODO el rango que cubre, antes de deduplicar/
 * ordenar — solo para armar la ETIQUETA con formatVerseRanges (para que
 * seleccionar/enfocar el 17 se lea "17-18"), nunca para decidir qué filas de
 * texto copiar (eso lo resuelve selectedVerseRows arriba, filtrando texto
 * vacío en vez de expandir).
 */
export function expandMergedSelection(verses: VerseRow[], selected: number[]): number[] {
  const expanded = new Set<number>();
  for (const number of selected) {
    expanded.add(number);
    const owner = verses.find(v => v.verse === number);
    if (owner?.verseRangeEnd != null) {
      for (let v = owner.verse; v <= owner.verseRangeEnd; v++)
        expanded.add(v);
    }
  }
  return [...expanded].sort((a, b) => a - b);
}

/**
 * Texto plano de la selección actual, "número + texto" por línea, con el
 * título (referencia) como primera línea — mismo formato que ya arma el
 * botón "Copiar" del drawer de acciones (BibleVerseActionsDrawer), extraído
 * acá para que el botón de copiado rápido del header (ChapterReader.vue)
 * arme EXACTAMENTE el mismo contenido sin duplicar la lógica.
 */
export function selectionPlainText(title: string, verses: VerseRow[], selectedVerses: number[]): string {
  return [
    title,
    ...selectedVerseRows(verses, selectedVerses).map(v => `${v.verse} ${v.text}`),
  ].join("\n");
}

/** Contraparte HTML de selectionPlainText, sin el título (ver BibleShareActions.richHtml, que le antepone su propio `<h1>`) — VerseRow.text no trae HTML propio, hay que escaparlo. */
export function selectionRichHtml(verses: VerseRow[], selectedVerses: number[]): string {
  return selectedVerseRows(verses, selectedVerses).map(v => `<p><sup>${v.verse}</sup> ${escapeHtml(v.text)}</p>`).join("\n");
}

/** Número de un versículo como se ve en la lectura: "17-18" si la traducción lo fusiona (ver VerseRow.verseRangeEnd). */
function verseNumberLabel(v: VerseRow): string {
  return v.verseRangeEnd != null
    ? `${v.verse}-${v.verseRangeEnd}`
    : String(v.verse);
}

/**
 * Pasaje como se ve en la lectura, en Markdown: la referencia como título y
 * cada versículo en su párrafo con el número en superíndice (<sup>, que los
 * editores Markdown — GitHub, Obsidian, Typora — muestran igual que la
 * app). Para "Copiar texto" de la vista de rango (ChapterReader.vue).
 */
export function passageMarkdown(title: string, verses: VerseRow[]): string {
  return [
    `## ${title}`,
    ...verses.map(v => `<sup>${verseNumberLabel(v)}</sup> ${v.text}`),
  ].join("\n\n");
}

/** Contraparte HTML de passageMarkdown, para quien pegue en un editor de texto enriquecido. */
export function passageHtml(title: string, verses: VerseRow[]): string {
  return [
    `<h2>${escapeHtml(title)}</h2>`,
    ...verses.map(v => `<p><sup>${verseNumberLabel(v)}</sup> ${escapeHtml(v.text)}</p>`),
  ].join("\n");
}
