/**
 * Desempate de los alias ambiguos («jn», «sm», «jun», ver
 * bookAliasOverrides.ts): primero el libro más leído (2026-11-23, a
 * pedido, propuesta «La concordancia»: con «jn 3» se abría Jonás antes que
 * Juan). Un orden aproximado de lectura habitual; los libros que no están
 * en la lista quedan después, en orden canónico.
 */
const MOST_READ = [
  43, // Juan
  19, // Salmos
  40, // Mateo
  45, // Romanos
  1, // Génesis
  20, // Proverbios
  42, // Lucas
  41, // Marcos
  44, // Hechos
  23, // Isaías
  49, // Efesios
  46, // 1 Corintios
  58, // Hebreos
  66, // Apocalipsis
  50, // Filipenses
  59, // Santiago
  48, // Gálatas
  62, // 1 Juan
  2, // Éxodo
  47, // 2 Corintios
  60, // 1 Pedro
  51, // Colosenses
  9, // 1 Samuel
  10, // 2 Samuel
] as const;

const RANK = new Map<number, number>(MOST_READ.map((id, index) => [id, index]));

/** Menor = más leído. */
export function bookPopularityRank(bookId: number): number {
  return RANK.get(bookId) ?? MOST_READ.length + bookId;
}
