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

// "Ir al himno" sheet
const showGoTo = ref(false);

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
  <div class="flex-1 flex flex-col justify-center items-center relative">
    <div v-if="status === 'loading'">
      <span class="loading loading-spinner loading-xl" />
    </div>
    <div v-else class="max-w-screen">
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
          <div v-if="song" class="flex flex-col max-w-[calc(100dvw)] h-[calc(100dvh-64px-52px)] overflow-y-auto">
            <h2
              class="sticky top-0 z-10 bg-(--root-bg) text-left md:text-center px-4 pt-4"
              :style="{ fontSize: `${fontSize * 1.5}px`, lineHeight: `${fontSize * 1.5 * 1.2}px` }"
            >
              <strong :style="{ fontSize: `${fontSize * 2}px`, lineHeight: `${fontSize * 2 * 1.1}px` }">{{ song.songId }}.</strong> {{ song.title }}
            </h2>
            <div
              class="[&>p]:my-4 [&>p:has(em)]:flex [&>p:has(em)]:justify-center [&>p:has(em)]:text-sm [&>p:has(em)]:leading-5! [&>p:has(em)]:mt-4 [&>p:has(em)]:-mb-2 text-left md:text-center mt-6 px-4 pb-20"
              :style="{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.6}px` }"
              v-html="song.lyricParsed.body"
            />
          </div>
        </SwiperSlide>
      </Swiper>
    </div>

    <!-- Reading pager: visible prev / go-to / next, so changing hymn does
         not depend on a hidden swipe gesture. -->
    <nav
      v-if="status !== 'loading' && total > 0"
      class="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 px-2 py-2 bg-base-100/95 backdrop-blur-sm border-t border-base-300"
      aria-label="Cambiar de himno"
    >
      <button
        type="button"
        class="btn btn-ghost h-11 min-w-0 flex-1 justify-start gap-1 px-2"
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
        class="btn btn-ghost h-11 min-w-0 flex-1 justify-end gap-1 px-2"
        :disabled="!hasNext"
        :aria-label="hasNext ? `Himno siguiente, ${current + 1}` : 'No hay himno siguiente'"
        @click="goNext"
      >
        <span v-if="hasNext" class="tabular-nums">{{ current + 1 }}</span>
        <Icon name="tabler:chevron-right" size="24" />
      </button>
    </nav>

    <AppGoToHymn v-model:open="showGoTo" @go="goToSong" />
  </div>
</template>

<style>
td {
  text-align: start;
  vertical-align: top;
}

table th,
table td {
  padding: 0 0.5rem;
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
</style>
