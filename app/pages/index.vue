<script setup lang="ts">
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/vue";
// Swiper styles
import "swiper/css";
import "swiper/css/navigation";

// Swiper navigation module
const swiperModules = [Navigation];

// Song store
const songStore = useSongStore();
const { songs, songId } = storeToRefs(songStore);

// Worker state (single source of truth for the songbook loading state)
const { status } = useSongbookWorker();

// Font store
const fontStore = useFontStore();
const { fontSize } = storeToRefs(fontStore);

// "Ir al himno" sheet and keyboard help
const showGoTo = ref(false);
const showHelp = ref(false);

// Swiper reference
const swiper = shallowRef<any>(null);
let _ignoreNextActiveChange = false;

const total = computed(() => songs.value.length);
const current = computed(() => Number(songId.value) || 1);
const hasPrev = computed(() => current.value > 1);
const hasNext = computed(() => current.value < total.value);

// Init swiper instance
function onSwiper(instance: any) {
  swiper.value = instance;
  // Prevent the initial active-index-change event from overwriting the persisted songId
  _ignoreNextActiveChange = true;
  instance.slideTo(current.value - 1, 0);
};

function getSwiper() {
  if (!swiper.value) {
    const el = document.querySelector(".swiper") as any;
    if (el && el.swiper)
      swiper.value = el.swiper;
  }
  return swiper.value;
}

function goToSong(id: number) {
  getSwiper()?.slideTo(id - 1, 0);
}

function goPrev() {
  if (hasPrev.value)
    getSwiper()?.slidePrev();
}

function goNext() {
  if (hasNext.value)
    getSwiper()?.slideNext();
}

// Remember opened hymns (Buscar shows them as "Recientes").
watch(
  () => [songId.value, songs.value.length] as const,
  ([id, len]) => {
    if (len > 0)
      songStore.pushRecent(Number(id));
  },
  { immediate: true },
);

// Opening a hymn from a lyric search hit: bring that stanza into view and
// mark it briefly so the eye lands on it.
const { pendingBlock } = storeToRefs(songStore);
async function revealPendingBlock() {
  const target = pendingBlock.value;
  if (!target || target.songId !== current.value || status.value === "loading")
    return;
  pendingBlock.value = null;
  await nextTick();
  await new Promise(r => setTimeout(r, 120));
  const el = document.querySelector<HTMLElement>(`article[data-song="${target.songId}"] [data-block="${target.blockIndex}"]`);
  if (!el)
    return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  el.classList.add("hymn-block--found");
  setTimeout(() => el.classList.remove("hymn-block--found"), 2200);
}
watch([pendingBlock, current, status], revealPendingBlock);
onMounted(revealPendingBlock);

// Keyboard (computers): ← → change hymn, G jumps to a number, ? shows help.
function keyBlocked(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  return typing || showGoTo.value || showHelp.value || e.ctrlKey || e.metaKey || e.altKey;
}
function readerKey(keys: string[], run: () => void) {
  onKeyStroke(keys, (e) => {
    if (keyBlocked(e))
      return;
    e.preventDefault();
    run();
  }, { dedupe: true });
}
readerKey(["ArrowLeft"], goPrev);
readerKey(["ArrowRight"], goNext);
readerKey(["g", "G"], () => (showGoTo.value = true));
readerKey(["?"], () => (showHelp.value = true));

const shortcutGroups = [
  {
    title: "Lectura",
    items: [
      { keys: ["←", "→"], label: "Himno anterior / siguiente" },
      { keys: ["G"], label: "Ir a un himno por número" },
      { keys: ["?"], label: "Ver estos atajos" },
    ],
  },
];

async function onActiveIndexChange(instance: any) {
  setTimeout(() => {
    // If we set the slide programmatically during init, ignore the first event
    if (_ignoreNextActiveChange) {
      _ignoreNextActiveChange = false;
      return;
    }

    // Update the current song index (coerce to number)
    songId.value = Number(instance.activeIndex) + 1;
  }, 50);
}

onMounted(async () => {
  // Only fetch songs if:
  // 1. Songs are not yet loaded (empty array)
  // 2. Arriving via page refresh (no navigation state)
  // 3. Not coming from internal search pages
  const router = useRouter();
  const fromInternalPage = router.options.history.state.back;
  const fromPath = typeof fromInternalPage === "string" ? fromInternalPage : "";
  const isFromSearchPages = fromPath
    && (fromPath.includes("/search") || fromPath.includes("/fully-search"));

  // Fetch songs only if they're empty OR if we're NOT coming from search pages
  if (songs.value.length === 0 || !isFromSearchPages) {
    await songStore.getSongs();
  }
});
</script>

<template>
  <div class="flex-1 flex min-h-0">
    <ReaderAside class="hidden lg:flex" :current="current" @go="goToSong" />
    <div class="flex-1 flex flex-col justify-center items-center relative min-w-0">
      <div v-if="status === 'loading'">
        <span class="loading loading-spinner loading-xl" />
      </div>
      <div v-else class="w-full">
        <Swiper
          class="swiper"
          :modules="swiperModules"
          :slides-per-view="1"
          :space-between="0"
          :navigation="true"
          :threshold="24"
          @active-index-change="onActiveIndexChange"
          @swiper="onSwiper"
        >
          <SwiperSlide
            v-for="song in songs"
            :key="song.id"
          >
            <article
              v-if="song"
              class="hymn reader-scroll flex flex-col w-full overflow-y-auto"
              :data-song="song.songId"
              :aria-labelledby="`hymn-title-${song.songId}`"
            >
              <header
                class="sticky top-0 z-10 mx-2 sm:mx-3 rounded-2xl bg-base-100 shadow-[0_8px_20px_-14px_rgb(20_12_60/0.5)] px-3 pt-2.5 pb-2"
              >
                <div class="mx-auto w-full max-w-[38rem]">
                  <h2
                    :id="`hymn-title-${song.songId}`"
                    class="font-lyric font-semibold text-balance"
                    :style="{ fontSize: `${Math.round(fontSize * 1.25)}px`, lineHeight: 1.25 }"
                  >
                    <span class="text-primary tabular-nums">{{ song.songId }}.</span>
                    {{ song.title }}
                  </h2>
                  <p
                    v-for="(cite, ci) in song.blocks.filter(b => b.kind === 'citation')"
                    :key="`cite-${ci}`"
                    class="text-sm opacity-70 mt-0.5"
                  >
                    {{ cite.text.join(" ") }}
                  </p>
                </div>
              </header>
              <div
                class="mx-auto w-full max-w-[40rem] font-lyric px-4 pt-4 flex flex-col gap-5"
                :style="{ fontSize: `${fontSize}px`, lineHeight: 1.55 }"
              >
                <template v-for="(block, bi) in song.blocks" :key="`b-${song.songId}-${bi}`">
                  <section
                    v-if="block.kind !== 'citation'"
                    class="hymn-block"
                    :class="block.kind === 'chorus' ? 'hymn-block--chorus' : 'hymn-block--stanza'"
                    :data-block="bi"
                    :aria-label="blockLabel(block) || undefined"
                  >
                    <span class="hymn-block__label" aria-hidden="true">
                      {{ block.kind === 'chorus' ? 'Coro' : block.number }}
                    </span>
                    <div class="hymn-block__text min-w-0" v-html="block.html" />
                  </section>
                </template>
              </div>
            </article>
          </SwiperSlide>
        </Swiper>
      </div>

      <!-- Reading pager: visible prev / go-to / next, so changing hymn does
         not depend on a hidden swipe gesture. -->
      <nav
        v-if="status !== 'loading' && total > 0"
        class="glass reader-pager absolute left-1/2 -translate-x-1/2 z-20 w-[calc(100%-1.5rem)] max-w-md h-[var(--pager-h)] rounded-full flex items-center gap-1 px-1.5"
        aria-label="Cambiar de himno"
      >
        <button
          type="button"
          class="btn btn-ghost h-11 min-w-0 flex-1 justify-start gap-1 px-3 rounded-full"
          :disabled="!hasPrev"
          :aria-label="hasPrev ? `Himno anterior, ${current - 1}` : 'No hay himno anterior'"
          @click="goPrev"
        >
          <Icon name="tabler:chevron-left" size="24" />
          <span v-if="hasPrev" class="tabular-nums">{{ current - 1 }}</span>
        </button>
        <button
          type="button"
          class="btn btn-primary h-11 rounded-full px-5 flex-none gap-2"
          @click="showGoTo = true"
        >
          <Icon name="tabler:hash" size="20" />
          <span class="flex flex-col items-start leading-tight">
            <span>Ir al himno</span>
            <span class="text-[11px] font-normal opacity-85 tabular-nums">{{ current }} de {{ total }}</span>
          </span>
        </button>
        <button
          type="button"
          class="btn btn-ghost h-11 min-w-0 flex-1 justify-end gap-1 px-3 rounded-full"
          :disabled="!hasNext"
          :aria-label="hasNext ? `Himno siguiente, ${current + 1}` : 'No hay himno siguiente'"
          @click="goNext"
        >
          <span v-if="hasNext" class="tabular-nums">{{ current + 1 }}</span>
          <Icon name="tabler:chevron-right" size="24" />
        </button>
      </nav>

      <AppGoToHymn v-model:open="showGoTo" @go="goToSong" />
      <AppShortcutsHelp v-model:open="showHelp" :groups="shortcutGroups" />
    </div>
  </div>
</template>

<style>
/* Each hymn scrolls under the floating header, the pager and the nav. */
.reader-scroll {
  height: 100dvh;
  padding-top: var(--bar-top);
  padding-bottom: calc(var(--bar-bottom) + var(--pager-h) + 1.5rem);
}
.reader-pager {
  bottom: calc(var(--bar-bottom) - 2px);
}

.swiper {
  width: 100%;
  height: 100%;
  flex: 1 1 0%;
  display: flex;
  flex-direction: column;
}

.swiper-button-prev,
.swiper-button-next {
  display: none;
}

/* Stanza number in the margin; the chorus as a tinted block with its label. */
.hymn-block {
  display: grid;
  grid-template-columns: 1.75em minmax(0, 1fr);
  column-gap: 0.5em;
  border-radius: var(--radius-box);
  transition: background-color 0.6s ease;
}
.hymn-block__label {
  font-family: var(--font-display);
  font-size: 0.7em;
  font-weight: 700;
  line-height: 2.2;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
  font-variant-numeric: tabular-nums;
}
.hymn-block--chorus {
  grid-template-columns: minmax(0, 1fr);
  background: color-mix(in oklab, var(--color-primary) 9%, transparent);
  padding: 0.6em 0.9em 0.7em;
}
.hymn-block--chorus .hymn-block__label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1.6;
  color: var(--color-primary);
}
.hymn-block--chorus .hymn-block__text {
  font-style: italic;
}
.hymn-block__text p {
  margin: 0;
}
.hymn-block__text table {
  width: 100%;
  font-size: 0.9em;
}
.hymn-block__text td,
.hymn-block__text th {
  text-align: start;
  vertical-align: top;
  padding: 0 0.5rem 0 0;
}
.hymn-block--found {
  background: color-mix(in oklab, var(--color-warning) 30%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .hymn-block {
    transition: none;
  }
}
</style>
