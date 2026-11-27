<script lang="ts" setup>
import type { BibleBook } from "~~/lib/bible";

import { fetchBooks } from "~/utils/bible/books";
import { normalizeText } from "~/utils/bible/normalize-text";

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
  <div class="flex gap-2">
    <UInput
      v-model="model"
      size="lg"
      class="flex-1 min-w-0"
      autocomplete="off"
      :placeholder="placeholder ?? 'Sal 46:1-7, jn 3:16, 1co 11:23-26…'"
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
</template>
