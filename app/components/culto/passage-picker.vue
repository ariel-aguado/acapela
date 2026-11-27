<script lang="ts" setup>
import type { ReferenceChoice } from "~/composables/use-reference-suggestions";
import type { BibleBook } from "~~/lib/bible";

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
const emit = defineEmits<{
  /** Enter on a complete passage. */
  done: [];
}>();
const model = defineModel<string>({ required: true });
const bible = useBibleStore();
const open = ref(false);

// ------------------------------------------------------------ what was understood
// Under the field, while typing, every passage it can be (see
// useReferenceSuggestions). ↑↓ choose, Enter or Tab writes it in full and
// the text is read again from there.
const field = useReferenceSuggestions(model, () => props.versionId);
const { choices, chosen, active, unknown } = field;
const listId = useId();

/** Another book for what was typed, keeping its chapter and verses. */
function useBook(name: string) {
  const { tail } = splitBookPart(model.value);
  model.value = tail
    ? `${name} ${tail}`
    : `${name} `;
}

/** A reading, written in full: a book waits for its chapter. */
function choose(s: ReferenceChoice) {
  model.value = s.isBook
    ? `${s.label} `
    : s.label;
  active.value = 0;
}

/**
 * ↑↓ among the readings; Enter or Tab writes the one chosen. Enter on a
 * passage, or on one already written in full, also says it is done, so
 * whoever holds the field can move on (correcting live: to the button that
 * applies it).
 */
async function onKeydown(event: KeyboardEvent) {
  const isEnter = event.key === "Enter";
  const isTab = event.key === "Tab" && !event.shiftKey;
  const isArrow = event.key === "ArrowDown" || event.key === "ArrowUp";
  if (!isEnter && !isTab && !isArrow)
    return;
  if ((isEnter || isArrow) && (choices.value.length || model.value.trim()))
    event.preventDefault();
  if (!isTab)
    await field.refresh();
  if (isEnter && !choices.value.length) {
    if (chosen.value)
      emit("done");
    return;
  }
  if (isArrow) {
    field.move(event.key === "ArrowDown"
      ? 1
      : -1);
    return;
  }
  const s = choices.value[active.value];
  if (!s)
    return;
  event.preventDefault();
  choose(s);
  if (isEnter && !s.isBook)
    emit("done");
}

/** The ✕ in the field: empty, ready to type another. */
const input = useTemplateRef<{ inputRef: HTMLInputElement | null }>("input");
function clear() {
  model.value = "";
  input.value?.inputRef?.focus();
}

/** Into the field with what it holds selected: typing replaces it. */
function focus() {
  const el = input.value?.inputRef;
  el?.focus();
  el?.select();
}
defineExpose({ focus });

const books = shallowRef<BibleBook[]>([]);
const failed = ref(false);
const filter = ref("");
const bookId = ref<number | null>(null);
const chapter = ref<number | null>(null);
const start = ref<number | null>(null);
const end = ref<number | null>(null);

const book = computed(() => books.value.find(b => b.id === bookId.value) ?? null);

// The search in «Elegir» understands the same as the field: a book ("jn" →
// Juan, Jonás…) narrows the books; a reference ("jn123", "sal23 1-3") lists
// its passages above the columns, and Enter uses the highlighted one.
const search = useReferenceSuggestions(filter, () => props.versionId);
const searchListId = useId();
const searchPassages = computed(() => search.choices.value.filter(s => !s.isBook));
const searchActive = ref(0);
watch(searchPassages, () => {
  searchActive.value = 0;
});
const visibleBooks = computed(() => {
  const q = normalizeText(filter.value.trim());
  if (!q)
    return books.value;
  // The books the search understood, in its order, then those whose name
  // simply contains the text.
  const ids = [
    ...new Set(search.suggestions.value.map(s => s.bookId)),
  ];
  const understood = ids.map(id => books.value.find(b => b.id === id)).filter((b): b is BibleBook => !!b);
  const contains = books.value.filter(b => !ids.includes(b.id)
    && (normalizeText(b.name).includes(q) || normalizeText(b.abbreviation).startsWith(q)));
  return [
    ...understood,
    ...contains,
  ];
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
  emit("done");
}

/**
 * A passage from the search: shown in the columns, or, with Enter, used
 * straight away. A list of verses ("2:1-3,5") does not fit the columns and
 * is written as it is.
 */
async function pickPassage(s: ReferenceChoice, now: boolean) {
  const parsed = await bible.parse(s.label, props.versionId || undefined).catch(() => null);
  const b = books.value.find(x => x.id === (parsed?.book?.id ?? s.bookId));
  if (!parsed?.chapter || !b || parsed.verses?.length) {
    model.value = s.label;
    open.value = false;
    emit("done");
    return;
  }
  bookId.value = b.id;
  chapter.value = parsed.chapter;
  start.value = parsed.verseStart ?? null;
  end.value = parsed.verseEnd ?? null;
  if (now) {
    use();
    return;
  }
  await nextTick();
  document.querySelector("[data-picker-book][aria-pressed='true']")?.scrollIntoView({ block: "nearest" });
}

/** ↑↓ through the passages found; Enter uses one, or the first book found. */
async function onSearchKeydown(event: KeyboardEvent) {
  const isEnter = event.key === "Enter";
  const isArrow = event.key === "ArrowDown" || event.key === "ArrowUp";
  if (!isEnter && !isArrow)
    return;
  event.preventDefault();
  await search.refresh();
  const list = searchPassages.value;
  if (isArrow) {
    if (list.length) {
      const step = event.key === "ArrowDown"
        ? 1
        : -1;
      searchActive.value = (searchActive.value + step + list.length) % list.length;
    }
    return;
  }
  const s = list[searchActive.value];
  if (s) {
    await pickPassage(s, true);
    return;
  }
  // Just a book: pick it and go on with the chapter.
  const first = visibleBooks.value[0];
  if (first) {
    pickBook(first);
    if (chapter.value)
      use();
  }
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex gap-2">
      <UInput
        ref="input"
        v-model="model"
        size="lg"
        class="flex-1 min-w-0"
        autocomplete="off"
        :placeholder="placeholder ?? 'Sal 46:1-7, jn 3:16, 1co 11:23-26…'"
        role="combobox"
        :aria-expanded="choices.length > 0"
        :aria-controls="listId"
        :aria-activedescendant="choices.length ? `${listId}-${active}` : undefined"
        :ui="{ trailing: 'pe-1' }"
        @keydown="onKeydown"
      >
        <template v-if="model" #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-tabler-x"
            aria-label="Borrar la cita"
            title="Borrar la cita"
            @click="clear"
          />
        </template>
      </UInput>
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
            <div v-if="!failed" class="flex flex-col gap-1.5">
              <UInput
                v-model="filter"
                size="md"
                icon="i-tabler-search"
                placeholder="Libro o cita: jn, jn 3:16, sal23 1-3…"
                autocomplete="off"
                aria-label="Buscar un libro o una cita"
                role="combobox"
                :aria-expanded="searchPassages.length > 0"
                :aria-controls="searchListId"
                :aria-activedescendant="searchPassages.length ? `${searchListId}-${searchActive}` : undefined"
                autofocus
                @keydown="onSearchKeydown"
              />
              <CultoReferenceSuggestions
                v-if="searchPassages.length"
                :id="searchListId"
                v-model:active="searchActive"
                :choices="searchPassages"
                @choose="pickPassage($event, true)"
              />
              <p v-else-if="search.unknown.value?.length" class="px-1 text-xs text-warning">
                No reconozco ese libro. ¿Quisiste decir {{ search.unknown.value.join(', ') }}?
              </p>
            </div>
            <div v-if="!failed" class="grid grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 h-80">
              <!-- Books -->
              <div class="flex flex-col gap-2 min-h-0">
                <p class="text-xs font-bold uppercase tracking-wider text-muted">
                  Libro
                </p>
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
      <CultoReferenceSuggestions
        v-else-if="choices.length"
        :id="listId"
        v-model:active="active"
        :choices="choices"
        @choose="choose"
      />
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
