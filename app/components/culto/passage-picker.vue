<script lang="ts" setup>
import type { BibleBook } from "~~/lib/bible";

import { bookPartOf, searchBooks } from "~/utils/bible/book-search";
import { fetchBooks } from "~/utils/bible/books";
import { normalizeText } from "~/utils/bible/normalize-text";
import { splitBookPart } from "~/utils/bible/parse-bible-reference";

// A Bible reference, typed ("1 Co 11:23-26") or picked as in SúperBiblia's
// passage picker: book, chapter and, if wanted, a verse or a range in three
// columns (first tap the start, second tap the end). Whatever is picked is
// written in the field, so it can still be corrected by hand. The passage
// is split into screens wherever it is used (readings, a moment's passages).
const props = defineProps<{
  /** Version whose books and verse counts are shown; the chosen one by default. */
  versionId?: string;
  placeholder?: string;
}>();
const model = defineModel<string>({ required: true });

const bible = useBibleStore();
const open = ref(false);

// ------------------------------------------------------------ what was understood
// As SúperBiblia's search bar (NN/g, visibility of system status): under the
// field, while typing, the passage understood ("→ 1 Corintios 11:23-26 ·
// 4 versículos") and the start of its first verse; for an ambiguous book
// ("jn": Juan, Jonás…) the books to choose from; for an unknown one,
// "¿Quisiste decir…?". Tab writes the understood reference in full.
type Understood
  = | { kind: "passage"; label: string; count?: number; snippet?: string; choices: string[] }
    | { kind: "book"; label: string; choices: string[] }
    | { kind: "unknown"; suggestions: string[] };
const understood = ref<Understood | null>(null);

function snippetOf(text: string) {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > 80
    ? `${plain.slice(0, 80).replace(/\s\S*$/, "")}…`
    : plain;
}

watchDebounced(model, async (value) => {
  const typed = value.trim();
  if (!typed) {
    understood.value = null;
    return;
  }
  const versionId = props.versionId || undefined;
  const parsed = await bible.parse(typed, versionId).catch(() => null);
  if (model.value.trim() !== typed)
    return;
  if (!parsed) {
    understood.value = null;
    return;
  }
  const book = parsed.book ?? parsed.bookCandidates?.[parsed.activeCandidateIndex];
  if (parsed.status === "invalid" || parsed.status === "idle" || !book) {
    const books = await fetchBooks(versionId || bible.currentId).catch(() => []);
    const part = bookPartOf(typed);
    understood.value = {
      kind: "unknown",
      suggestions: part
        ? searchBooks(books, part).slice(0, 3).map(r => r.book.name)
        : [],
    };
    return;
  }
  const choices = parsed.status === "ambiguous"
    ? (parsed.bookCandidates ?? []).slice(0, 4).map(c => c.name)
    : [];
  if (!parsed.chapter) {
    understood.value = { kind: "book", label: book.name, choices };
    return;
  }
  const label = parsed.canonicalLabel ?? `${book.name} ${parsed.chapter}`;
  understood.value = { kind: "passage", label, choices };
  // The passage itself: how many verses and how it starts.
  const passage = await bible.passage(typed, versionId).catch(() => null);
  if (model.value.trim() !== typed || understood.value?.kind !== "passage")
    return;
  if (passage?.verses.length) {
    understood.value = {
      ...understood.value,
      label: passage.label,
      count: passage.verses.length,
      snippet: snippetOf(passage.verses[0]!.text),
    };
  }
}, { debounce: 200 });

/** Another book for what was typed, keeping its chapter and verses. */
function useBook(name: string) {
  const { tail } = splitBookPart(model.value);
  model.value = tail
    ? `${name} ${tail}`
    : `${name} `;
}

/** Tab: the understood reference, written in full. */
function complete(event: KeyboardEvent) {
  const u = understood.value;
  if (!u || u.kind === "unknown" || model.value.trim() === u.label)
    return;
  event.preventDefault();
  model.value = u.kind === "book"
    ? `${u.label} `
    : u.label;
}
const books = shallowRef<BibleBook[]>([]);
const failed = ref(false);
const filter = ref("");
const bookId = ref<number | null>(null);
const chapter = ref<number | null>(null);
const start = ref<number | null>(null);
const end = ref<number | null>(null);

const book = computed(() => books.value.find(b => b.id === bookId.value) ?? null);
const visibleBooks = computed(() => {
  const q = normalizeText(filter.value.trim());
  return q
    ? books.value.filter(b => normalizeText(b.name).includes(q) || normalizeText(b.abbreviation).startsWith(q))
    : books.value;
});
const verseCount = computed(() => (book.value && chapter.value
  ? book.value.versesPerChapter[chapter.value - 1] ?? 0
  : 0));

/** The reference picked so far: "Juan", "Juan 3", "Juan 3:16", "Juan 3:16-18". */
const picked = computed(() => {
  if (!book.value)
    return "";
  let text = book.value.name;
  if (chapter.value) {
    text += ` ${chapter.value}`;
    if (start.value) {
      text += `:${start.value}`;
      if (end.value && end.value !== start.value)
        text += `-${end.value}`;
    }
  }
  return text;
});

// Opens on the reference already written, if it is understood.
watch(open, async (isOpen) => {
  if (!isOpen)
    return;
  filter.value = "";
  failed.value = false;
  try {
    books.value = await fetchBooks(props.versionId || bible.currentId);
  }
  catch {
    failed.value = true;
    return;
  }
  const parsed = model.value.trim()
    ? await bible.parse(model.value, props.versionId || undefined).catch(() => null)
    : null;
  bookId.value = parsed?.book?.id ?? null;
  chapter.value = parsed?.chapter ?? null;
  start.value = parsed?.verseStart ?? null;
  end.value = parsed?.verseEnd ?? null;
  await nextTick();
  document.querySelector("[data-picker-book][aria-pressed='true']")?.scrollIntoView({ block: "center" });
});

function pickBook(b: BibleBook) {
  bookId.value = b.id;
  chapter.value = b.chapterCount === 1
    ? 1
    : null;
  start.value = null;
  end.value = null;
}

function pickChapter(c: number) {
  chapter.value = c;
  start.value = null;
  end.value = null;
}

/** First tap: the start; second: the end (either order); a third starts again. */
function pickVerse(v: number) {
  if (start.value === null || end.value !== null) {
    start.value = v;
    end.value = null;
  }
  else if (v < start.value) {
    end.value = start.value;
    start.value = v;
  }
  else {
    end.value = v;
  }
}

function inRange(v: number) {
  if (start.value === null)
    return false;
  return v >= start.value && v <= (end.value ?? start.value);
}

function use() {
  if (!chapter.value)
    return;
  model.value = picked.value;
  open.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex gap-2">
      <UInput
        v-model="model"
        size="lg"
        class="flex-1 min-w-0"
        autocomplete="off"
        :placeholder="placeholder ?? 'Sal 46:1-7, jn 3:16, 1co 11:23-26…'"
        @keydown.tab="complete"
      />
      <UPopover v-model:open="open" :content="{ align: 'end', sideOffset: 6 }">
        <UButton
          color="neutral"
          variant="outline"
          size="lg"
          icon="i-tabler-book-2"
          label="Elegir"
          aria-haspopup="dialog"
        />
        <template #content>
          <div class="w-[42rem] max-w-[calc(100vw-2rem)] p-3 flex flex-col gap-3" role="dialog" aria-label="Elegir un pasaje">
            <p v-if="failed" class="p-4 text-sm text-muted">
              No se pudieron leer los libros de esta versión. Escribe la cita en el campo.
            </p>
            <div v-else class="grid grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 h-80">
              <!-- Books -->
              <div class="flex flex-col gap-2 min-h-0">
                <UInput
                  v-model="filter"
                  size="sm"
                  icon="i-tabler-filter"
                  placeholder="Libro"
                  autocomplete="off"
                  aria-label="Filtrar libros"
                />
                <ul class="soft-scrollbar flex-1 overflow-y-auto -mx-1 px-1" aria-label="Libros">
                  <li v-for="b in visibleBooks" :key="b.id">
                    <button
                      type="button"
                      data-picker-book
                      class="w-full text-start rounded-lg px-2.5 py-1.5 text-sm"
                      :class="b.id === bookId ? 'bg-primary text-inverted font-semibold' : 'hover:bg-elevated'"
                      :aria-pressed="b.id === bookId"
                      @click="pickBook(b)"
                    >
                      {{ b.name }}
                    </button>
                  </li>
                </ul>
              </div>

              <!-- Chapters -->
              <div class="flex flex-col gap-2 min-h-0">
                <p class="text-xs font-bold uppercase tracking-wider text-muted">
                  Capítulo
                </p>
                <div
                  v-if="book"
                  class="soft-scrollbar overflow-y-auto grid grid-cols-5 gap-1 content-start"
                  role="group"
                  aria-label="Capítulos"
                >
                  <button
                    v-for="c in book.chapterCount"
                    :key="c"
                    type="button"
                    class="h-9 rounded-lg text-sm tabular-nums"
                    :class="c === chapter ? 'bg-primary text-inverted font-semibold' : 'hover:bg-elevated'"
                    :aria-pressed="c === chapter"
                    @click="pickChapter(c)"
                  >
                    {{ c }}
                  </button>
                </div>
                <p v-else class="text-sm text-muted">
                  Elige un libro.
                </p>
              </div>

              <!-- Verses: a range with two taps -->
              <div class="flex flex-col gap-2 min-h-0">
                <p class="text-xs font-bold uppercase tracking-wider text-muted">
                  Versículos <span class="normal-case font-normal tracking-normal">· opcional</span>
                </p>
                <div
                  v-if="verseCount"
                  class="soft-scrollbar overflow-y-auto grid grid-cols-5 gap-1 content-start"
                  role="group"
                  aria-label="Versículos: toca el primero y el último"
                >
                  <button
                    v-for="v in verseCount"
                    :key="v"
                    type="button"
                    class="h-9 rounded-lg text-sm tabular-nums"
                    :class="v === start || v === end ? 'bg-primary text-inverted font-semibold' : inRange(v) ? 'bg-primary/15 text-highlighted' : 'hover:bg-elevated'"
                    :aria-pressed="inRange(v)"
                    @click="pickVerse(v)"
                  >
                    {{ v }}
                  </button>
                </div>
                <p v-else class="text-sm text-muted">
                  {{ book ? 'Elige un capítulo.' : '' }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 border-t border-muted pt-3">
              <p class="flex-1 min-w-0 text-sm" aria-live="polite">
                <span v-if="picked" class="font-semibold text-highlighted">{{ picked }}</span>
                <span v-if="verseCount" class="text-muted">
                  {{ start === null ? ' · toca el primer versículo y luego el último, o usa el capítulo entero' : end === null ? ' · ahora el último versículo' : '' }}
                </span>
              </p>
              <UButton
                color="neutral"
                variant="ghost"
                label="Cancelar"
                @click="open = false"
              />
              <UButton
                :disabled="!chapter"
                icon="i-tabler-check"
                label="Usar"
                @click="use"
              />
            </div>
          </div>
        </template>
      </UPopover>
    </div>

    <!-- What was understood -->
    <div class="min-h-5 px-1 text-xs text-muted" aria-live="polite">
      <p v-if="understood?.kind === 'passage'" class="truncate">
        <UIcon name="i-tabler-arrow-right" class="size-3.5 align-[-2px] text-primary" />
        <b class="font-semibold text-highlighted">{{ understood.label }}</b>
        <template v-if="understood.count">
          · {{ understood.count }} {{ understood.count === 1 ? 'versículo' : 'versículos' }}
        </template>
        <span v-if="understood.snippet" class="font-lyric italic"> — {{ understood.snippet }}</span>
        <span v-if="model.trim() !== understood.label"> · Tab para completar</span>
      </p>
      <p v-else-if="understood?.kind === 'book'">
        <UIcon name="i-tabler-arrow-right" class="size-3.5 align-[-2px] text-primary" />
        <b class="font-semibold text-highlighted">{{ understood.label }}</b> · escribe el capítulo y, si quieres, los versículos
      </p>
      <p v-else-if="understood?.kind === 'unknown'" class="text-warning">
        <template v-if="understood.suggestions.length">
          No reconozco ese libro. ¿Quisiste decir
          <template v-for="(name, i) in understood.suggestions" :key="name">
            <button type="button" class="font-semibold underline hover:no-underline" @click="useBook(name)">
              {{ name }}
            </button>{{ i < understood.suggestions.length - 1 ? ', ' : '' }}
          </template>?
        </template>
        <template v-else>
          No reconozco esa cita. Prueba «Juan 3:16» o elige con «Elegir».
        </template>
      </p>
      <div v-if="understood && understood.kind !== 'unknown' && understood.choices.length > 1" class="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span>¿Qué libro?</span>
        <UButton
          v-for="(name, i) in understood.choices"
          :key="name"
          :label="name"
          size="xs"
          color="neutral"
          :variant="i === 0 ? 'solid' : 'soft'"
          class="rounded-full"
          @click="useBook(name)"
        />
      </div>
    </div>
  </div>
</template>
