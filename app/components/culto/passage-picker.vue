<script lang="ts" setup>
import type { ReferenceSuggestion } from "~/utils/bible/predict-reference";
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
// As SúperBiblia's search bar (its predictive "Ir a"; NN/g, visibility of
// system status and recognition rather than recall): under the field, while
// typing, every passage what is typed can be, each checked against the real
// chapters and verses ("jn123" → Juan 1:23 · Juan 12:3; "jn" → Juan, Jonás,
// Joel…), with how many verses and how it starts. ↑↓ choose, Enter or Tab
// writes it in full, and the text is read again from there. Once the field
// holds one of them exactly, only that one stays. For an unknown book,
// "¿Quisiste decir…?".
type Suggestion = ReferenceSuggestion & { count?: number; snippet?: string };
const suggestions = ref<Suggestion[]>([]);
const active = ref(0);
const unknown = ref<string[] | null>(null);
const listId = useId();

function snippetOf(text: string) {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > 80
    ? `${plain.slice(0, 80).replace(/\s\S*$/, "")}…`
    : plain;
}

function sameReference(a: string, b: string) {
  return normalizeText(a.trim()) === normalizeText(b.trim());
}

/** The field already holds one of the readings, written in full. */
const chosen = computed(() => suggestions.value.find(s => !s.isBook && sameReference(s.label, model.value)) ?? null);
/** The readings to choose from; none once one is written. */
const choices = computed(() => (chosen.value
  ? []
  : suggestions.value));

watchDebounced(model, async (value) => {
  const typed = value.trim();
  if (!typed) {
    suggestions.value = [];
    unknown.value = null;
    return;
  }
  const versionId = props.versionId || undefined;
  const list = await bible.predict(typed, versionId).catch(() => null);
  if (model.value.trim() !== typed || !list)
    return;
  if (!list.length) {
    suggestions.value = [];
    const books = await fetchBooks(versionId || bible.currentId).catch(() => []);
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
    const passage = await bible.passage(s.label, versionId).catch(() => null);
    if (model.value.trim() !== typed || suggestions.value[i]?.key !== s.key || !passage?.verses.length)
      return;
    suggestions.value[i] = {
      ...s,
      count: passage.verses.length,
      snippet: snippetOf(passage.verses[0]!.text),
    };
  }));
}, { debounce: 150 });

/** Another book for what was typed, keeping its chapter and verses. */
function useBook(name: string) {
  const { tail } = splitBookPart(model.value);
  model.value = tail
    ? `${name} ${tail}`
    : `${name} `;
}

/** A reading, written in full: a book waits for its chapter. */
function choose(s: Suggestion) {
  model.value = s.isBook
    ? `${s.label} `
    : s.label;
  active.value = 0;
}

/** ↑↓ among the readings; Enter or Tab writes the one chosen. */
function onKeydown(event: KeyboardEvent) {
  const list = choices.value;
  if (!list.length)
    return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown"
      ? 1
      : -1;
    active.value = (active.value + step + list.length) % list.length;
  }
  else if ((event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) && list[active.value]) {
    event.preventDefault();
    choose(list[active.value]!);
  }
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
        role="combobox"
        :aria-expanded="choices.length > 0"
        :aria-controls="listId"
        :aria-activedescendant="choices.length ? `${listId}-${active}` : undefined"
        @keydown="onKeydown"
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
      <p v-if="chosen" class="truncate">
        <UIcon name="i-tabler-arrow-right" class="size-3.5 align-[-2px] text-primary" />
        <b class="font-semibold text-highlighted">{{ chosen.label }}</b>
        <template v-if="chosen.count">
          · {{ chosen.count }} {{ chosen.count === 1 ? 'versículo' : 'versículos' }}
        </template>
        <span v-if="chosen.snippet" class="font-lyric italic"> — {{ chosen.snippet }}</span>
      </p>
      <ul
        v-else-if="choices.length"
        :id="listId"
        role="listbox"
        aria-label="Citas posibles"
        class="-mx-1 flex flex-col"
      >
        <li
          v-for="(s, i) in choices"
          :id="`${listId}-${i}`"
          :key="s.key"
          role="option"
          :aria-selected="i === active"
          class="flex min-w-0 cursor-pointer items-baseline gap-1.5 rounded-md px-1.5 py-1"
          :class="i === active ? 'bg-primary/10' : 'hover:bg-elevated'"
          @mousedown.prevent
          @mouseenter="active = i"
          @click="choose(s)"
        >
          <UIcon
            :name="s.isBook ? 'i-tabler-book-2' : 'i-tabler-arrow-right'"
            class="size-3.5 shrink-0 self-center"
            :class="i === active ? 'text-primary' : 'opacity-50'"
          />
          <b class="shrink-0 font-semibold text-highlighted">{{ s.label }}</b>
          <span v-if="s.isBook" class="truncate">· escribe el capítulo y, si quieres, los versículos</span>
          <span v-else class="min-w-0 truncate">
            <template v-if="s.count">· {{ s.count }} {{ s.count === 1 ? 'versículo' : 'versículos' }}</template>
            <span v-if="s.snippet" class="font-lyric italic"> — {{ s.snippet }}</span>
          </span>
          <kbd v-if="i === active" class="ms-auto shrink-0 self-center rounded border border-default px-1 text-[0.65rem] font-sans not-italic">
            Enter
          </kbd>
        </li>
      </ul>
      <p v-else-if="unknown" class="text-warning">
        <template v-if="unknown.length">
          No reconozco ese libro. ¿Quisiste decir
          <template v-for="(name, i) in unknown" :key="name">
            <button type="button" class="font-semibold underline hover:no-underline" @click="useBook(name)">
              {{ name }}
            </button>{{ i < unknown.length - 1 ? ', ' : '' }}
          </template>?
        </template>
        <template v-else>
          No reconozco esa cita. Prueba «Juan 3:16» o elige con «Elegir».
        </template>
      </p>
    </div>
  </div>
</template>
