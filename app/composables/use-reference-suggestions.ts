import type { MaybeRefOrGetter, Ref } from "vue";

import type { ReferenceSuggestion } from "~/utils/bible/predict-reference";

import { bookPartOf, searchBooks } from "~/utils/bible/book-search";
import { fetchBooks } from "~/utils/bible/books";
import { normalizeText } from "~/utils/bible/normalize-text";

// As SúperBiblia's search bar (its predictive "Ir a"; NN/g, visibility of
// system status and recognition rather than recall): while a reference is
// typed, every passage it can be, each checked against the real chapters
// and verses ("jn123" → Juan 1:23 · Juan 12:3; "jn" → Juan, Jonás, Joel…),
// with how many verses and how it starts. Once the text is one of them
// exactly, only that one stays. For an unknown book, the closest names.
// One for each field that takes a reference (the passage field, the search
// in «Elegir»), so both understand the same.

export type ReferenceChoice = ReferenceSuggestion & { count?: number; snippet?: string };

function snippetOf(text: string) {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > 80
    ? `${plain.slice(0, 80).replace(/\s\S*$/, "")}…`
    : plain;
}

export function sameReference(a: string, b: string) {
  return normalizeText(a.trim()) === normalizeText(b.trim());
}

export function useReferenceSuggestions(text: Ref<string>, versionId: MaybeRefOrGetter<string | undefined>) {
  const bible = useBibleStore();
  const suggestions = ref<ReferenceChoice[]>([]);
  const active = ref(0);
  /** Book names close to an unknown one; null when the book is known. */
  const unknown = ref<string[] | null>(null);
  /** What the readings shown were worked out for. */
  const predictedFor = ref("");

  /** The text already holds one of the readings, written in full. */
  const chosen = computed(() => suggestions.value.find(s => !s.isBook && sameReference(s.label, text.value)) ?? null);
  /** The readings to choose from; none once one is written. */
  const choices = computed(() => (chosen.value
    ? []
    : suggestions.value));

  async function predict(typed: string) {
    if (!typed) {
      suggestions.value = [];
      unknown.value = null;
      predictedFor.value = "";
      return;
    }
    const id = toValue(versionId) || undefined;
    const list = await bible.predict(typed, id).catch(() => null);
    if (text.value.trim() !== typed || !list)
      return;
    predictedFor.value = typed;
    if (!list.length) {
      suggestions.value = [];
      const books = await fetchBooks(id || bible.currentId).catch(() => []);
      const part = bookPartOf(typed);
      unknown.value = part
        ? searchBooks(books, part).slice(0, 3).map(r => r.book.name)
        : [];
      return;
    }
    unknown.value = null;
    // Keep the one chosen with the arrows if it is still there.
    const previous = suggestions.value[active.value]?.label;
    suggestions.value = list;
    active.value = Math.max(0, list.findIndex(s => s.label === previous));
    // Each passage: how many verses and how it starts.
    await Promise.all(list.map(async (s, i) => {
      if (s.isBook)
        return;
      const passage = await bible.passage(s.label, id).catch(() => null);
      if (text.value.trim() !== typed || suggestions.value[i]?.key !== s.key || !passage?.verses.length)
        return;
      suggestions.value[i] = {
        ...s,
        count: passage.verses.length,
        snippet: snippetOf(passage.verses[0]!.text),
      };
    }));
  }
  watchDebounced(text, value => predict(value.trim()), { debounce: 150 });

  /** Typed faster than the readings: work them out now, for a key that picks one. */
  async function refresh() {
    if (text.value.trim() !== predictedFor.value)
      await predict(text.value.trim());
  }

  function move(step: number) {
    const n = choices.value.length;
    if (n)
      active.value = (active.value + step + n) % n;
  }

  return {
    suggestions,
    choices,
    chosen,
    active,
    unknown,
    refresh,
    move,
  };
}
