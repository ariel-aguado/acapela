<script lang="ts" setup>
import type { ShortcutGroup } from "~/components/app/shortcuts-help.vue";
import type { ProjectorState } from "~/composables/use-projector-channel";

import { PROJECTOR_WINDOW_NAME } from "~/composables/use-projector-channel";
import { SCALE_MAX, SCALE_MIN, SCALE_STEP } from "~/stores/presentation";

// Operator console. The person projecting sees what is live, what comes next
// and the service list; the congregation sees only the slide, either in a
// separate projector window (synced over BroadcastChannel) or on this screen
// in full screen.
definePageMeta({ bare: true });
useHead({ title: "Proyección · Acapela" });

const songStore = useSongStore();
const presentation = usePresentationStore();
const songbookStore = useSongbookStore();
const { songs, songId, currentSong } = storeToRefs(songStore);
const { currentSongbook } = storeToRefs(songbookStore);
const { status } = useSongbookWorker();
const { show: toast } = useUndoToast();

const slides = computed(() => buildSlides(currentSong.value));
const slideIndex = ref(0);
const black = ref(false);
const overflow = ref(false);
const showGoTo = ref(false);
const showHelp = ref(false);

const total = computed(() => songs.value.length);
const current = computed(() => Number(songId.value) || 1);
const liveSlide = computed(() => slides.value[slideIndex.value] ?? null);
const nextSlide = computed(() => slides.value[slideIndex.value + 1] ?? null);
const scale = computed(() => presentation.scaleFor(current.value));

watch(current, () => {
  slideIndex.value = 0;
  overflow.value = false;
});

// ------------------------------------------------------------ projector
const liveState = computed<ProjectorState>(() => ({
  slide: liveSlide.value,
  number: currentSong.value?.songId ?? null,
  title: currentSong.value?.title ?? "",
  black: black.value,
  scale: scale.value,
}));
const { connected } = useProjectorSender(liveState);

function openProjector() {
  const win = window.open("/projector", PROJECTOR_WINDOW_NAME, "popup,width=1280,height=720");
  if (!win)
    toast("El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.", undefined, 8000);
  else
    win.focus();
}

const liveWrapRef = shallowRef<HTMLElement | null>(null);
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(liveWrapRef);

// ------------------------------------------------------------ navigation
function goSlide(i: number) {
  if (i >= 0 && i < slides.value.length)
    slideIndex.value = i;
}
function nextStep() {
  goSlide(slideIndex.value + 1);
}
function prevStep() {
  goSlide(slideIndex.value - 1);
}

function loadHymn(id: number | null) {
  if (id && id >= 1 && id <= total.value)
    songId.value = id;
}
// In the list → its neighbour; otherwise the next / previous number.
function nextHymn() {
  loadHymn(presentation.neighbour(current.value, 1) ?? (presentation.has(current.value) ? null : current.value + 1));
}
function prevHymn() {
  loadHymn(presentation.neighbour(current.value, -1) ?? (presentation.has(current.value) ? null : current.value - 1));
}

function changeScale(delta: number) {
  presentation.setScale(current.value, scale.value + delta);
}

const atEnd = computed(() => slides.value.length > 0 && slideIndex.value === slides.value.length - 1);
const nextHymnId = computed(() => presentation.neighbour(current.value, 1));

// ------------------------------------------------------------ setlist
const setlistSongs = computed(() =>
  presentation.items.map(id => ({ id, title: songs.value[id - 1]?.title ?? "" })),
);

function addCurrent() {
  presentation.add(current.value);
}

// ------------------------------------------------------------ keyboard
function blocked(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  return typing || showGoTo.value || showHelp.value || e.ctrlKey || e.metaKey || e.altKey;
}

function keys(list: string[], run: () => void) {
  onKeyStroke(list, (e) => {
    if (blocked(e))
      return;
    e.preventDefault();
    run();
  }, { dedupe: true });
}

keys(["ArrowRight", "PageDown", " "], nextStep);
keys(["ArrowLeft", "PageUp"], prevStep);
keys(["Home"], () => goSlide(0));
keys(["End"], () => goSlide(slides.value.length - 1));
keys(["n", "N"], nextHymn);
keys(["p", "P"], prevHymn);
keys(["g", "G"], () => (showGoTo.value = true));
keys(["b", "B", "."], () => (black.value = !black.value));
keys(["+", "="], () => changeScale(SCALE_STEP));
keys(["-", "_"], () => changeScale(-SCALE_STEP));
keys(["0"], () => presentation.setScale(current.value, 1));
keys(["f", "F"], () => toggleFullscreen());
keys(["?"], () => (showHelp.value = true));

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Estrofas",
    items: [
      { keys: ["→", "Espacio"], label: "Siguiente estrofa (también el control remoto)" },
      { keys: ["←"], label: "Estrofa anterior" },
      { keys: ["Inicio", "Fin"], label: "Primera / última estrofa" },
    ],
  },
  {
    title: "Himnos",
    items: [
      { keys: ["N"], label: "Siguiente himno de la lista (o el número siguiente)" },
      { keys: ["P"], label: "Himno anterior" },
      { keys: ["G"], label: "Ir a un himno por número" },
    ],
  },
  {
    title: "Pantalla",
    items: [
      { keys: ["B"], label: "Pantalla en negro / volver" },
      { keys: ["+", "−"], label: "Agrandar / achicar el texto de este himno" },
      { keys: ["0"], label: "Tamaño automático" },
      { keys: ["F"], label: "Presentar en esta pantalla" },
      { keys: ["?"], label: "Ver estos atajos" },
    ],
  },
];

onMounted(() => songStore.getSongs());
</script>

<template>
  <div class="console min-h-dvh flex flex-col bg-base-200 text-base-content">
    <!-- Top bar -->
    <header class="flex flex-wrap items-center gap-2 px-3 py-2 bg-base-100 border-b border-base-300">
      <NuxtLink to="/" class="btn btn-ghost btn-sm h-10 gap-1">
        <Icon name="tabler:arrow-left" size="18" />
        Volver a la lectura
      </NuxtLink>
      <h1 class="text-lg font-bold px-1">
        Proyección
      </h1>
      <span v-if="currentSongbook" class="badge badge-ghost">{{ currentSongbook.name }}</span>
      <span class="flex-1" />
      <span
        class="inline-flex items-center gap-1.5 text-sm font-semibold"
        :class="connected ? 'text-error' : 'opacity-60'"
        role="status"
      >
        <span class="h-2.5 w-2.5 rounded-full" :class="connected ? 'bg-error animate-pulse' : 'bg-base-content/40'" />
        {{ connected ? 'Proyector conectado' : 'Proyector sin conectar' }}
      </span>
      <button type="button" class="btn btn-sm h-10" @click="openProjector">
        <Icon name="tabler:device-desktop-share" size="18" />
        Abrir ventana del proyector
      </button>
      <button type="button" class="btn btn-sm h-10" @click="toggleFullscreen()">
        <Icon name="tabler:maximize" size="18" />
        Presentar aquí <kbd class="kbd kbd-xs">F</kbd>
      </button>
      <button type="button" class="btn btn-primary btn-sm h-10" @click="showGoTo = true">
        <Icon name="tabler:hash" size="18" />
        Ir al himno <kbd class="kbd kbd-xs text-base-content">G</kbd>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square h-10 w-10"
        aria-label="Atajos de teclado"
        @click="showHelp = true"
      >
        <Icon name="tabler:keyboard" size="20" />
      </button>
    </header>

    <div v-if="status === 'loading' || !currentSong" class="flex-1 grid place-items-center">
      <span class="loading loading-spinner loading-xl" aria-label="Cargando" />
    </div>

    <main v-else class="flex-1 grid gap-3 p-3 lg:grid-cols-[15rem_minmax(0,1fr)_17rem] min-h-0">
      <!-- Slides of the current hymn -->
      <section class="flex flex-col gap-2 min-w-0 order-2 lg:order-1" aria-labelledby="c-slides">
        <h2 id="c-slides" class="text-xs font-bold uppercase tracking-wider opacity-70">
          {{ currentSong.songId }}. {{ currentSong.title }}
        </h2>
        <ol class="flex flex-col gap-1.5 overflow-y-auto">
          <li v-for="(s, i) in slides" :key="i">
            <button
              type="button"
              class="w-full text-start rounded-box border-2 bg-base-100 px-3 py-2 text-sm leading-snug transition-colors"
              :class="[
                i === slideIndex ? 'border-error' : i === slideIndex + 1 ? 'border-primary border-dashed' : 'border-transparent hover:border-base-300',
              ]"
              :aria-current="i === slideIndex ? 'step' : undefined"
              @click="goSlide(i)"
            >
              <span class="block text-xs font-bold opacity-70">{{ s.label }}</span>
              <span class="block truncate" :class="{ italic: s.kind === 'chorus' }">{{ s.preview }}</span>
            </button>
          </li>
        </ol>
      </section>

      <!-- Live -->
      <section class="flex flex-col gap-2 min-w-0 order-1 lg:order-2" aria-labelledby="c-live">
        <div class="flex items-center justify-between gap-2">
          <h2 id="c-live" class="text-xs font-bold uppercase tracking-wider opacity-70">
            En pantalla · {{ liveSlide?.label }} · {{ slideIndex + 1 }} de {{ slides.length }}
          </h2>
          <span v-if="overflow" class="badge badge-warning gap-1">
            <Icon name="tabler:alert-triangle" size="14" />
            El texto no entra: achícalo con −
          </span>
        </div>
        <div
          ref="liveWrapRef"
          class="live-wrap rounded-box overflow-hidden ring-2"
          :class="black ? 'ring-base-content/40' : 'ring-error'"
          @click="isFullscreen && nextStep()"
        >
          <ProjectionSlide
            :slide="liveSlide"
            :number="currentSong.songId"
            :title="currentSong.title"
            :black="black"
            :scale="scale"
            @overflow="overflow = $event"
          />
          <div v-if="black && !isFullscreen" class="absolute inset-0 grid place-items-center text-white/80 text-sm font-semibold pointer-events-none">
            Pantalla en negro · B para volver
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn h-11"
            :disabled="slideIndex === 0"
            @click="prevStep"
          >
            <Icon name="tabler:chevron-left" size="20" />
            Anterior
          </button>
          <button
            type="button"
            class="btn btn-primary h-11 flex-1 min-w-40"
            :disabled="atEnd"
            @click="nextStep"
          >
            Siguiente estrofa
            <Icon name="tabler:chevron-right" size="20" />
          </button>
          <button
            type="button"
            class="btn h-11"
            :class="black ? 'btn-neutral' : ''"
            :aria-pressed="black"
            @click="black = !black"
          >
            <Icon name="tabler:screen-share-off" size="20" />
            {{ black ? 'Mostrar' : 'Negro' }}
            <kbd class="kbd kbd-xs text-base-content">B</kbd>
          </button>
          <div class="join" role="group" aria-label="Tamaño del texto de este himno">
            <button
              type="button"
              class="btn join-item h-11"
              aria-label="Achicar texto"
              :disabled="scale <= SCALE_MIN"
              @click="changeScale(-SCALE_STEP)"
            >
              −
            </button>
            <button
              type="button"
              class="btn join-item h-11 tabular-nums min-w-16"
              :title="scale === 1 ? 'Tamaño automático' : 'Volver al tamaño automático'"
              @click="presentation.setScale(current, 1)"
            >
              {{ Math.round(scale * 100) }}%
            </button>
            <button
              type="button"
              class="btn join-item h-11"
              aria-label="Agrandar texto"
              :disabled="scale >= SCALE_MAX"
              @click="changeScale(SCALE_STEP)"
            >
              +
            </button>
          </div>
        </div>
        <p v-if="atEnd" class="text-sm opacity-80">
          Fin del himno.
          <template v-if="nextHymnId">
            <kbd class="kbd kbd-xs">N</kbd> pasa al {{ nextHymnId }} de la lista.
          </template>
          <template v-else>
            <kbd class="kbd kbd-xs">N</kbd> pasa al siguiente.
          </template>
        </p>
      </section>

      <!-- Next + service list -->
      <aside class="flex flex-col gap-3 min-w-0 order-3" aria-label="Siguiente y lista del culto">
        <div class="flex flex-col gap-1">
          <h2 class="text-xs font-bold uppercase tracking-wider opacity-70">
            Siguiente
          </h2>
          <div class="rounded-box overflow-hidden">
            <ProjectionSlide
              v-if="nextSlide"
              :slide="nextSlide"
              :number="currentSong.songId"
              :title="currentSong.title"
              :scale="scale"
              :badge="nextSlide.label"
            />
            <div v-else class="aspect-video grid place-items-center bg-base-300 text-sm opacity-70 px-3 text-center">
              {{ nextHymnId ? `Después: himno ${nextHymnId}` : 'Última estrofa' }}
            </div>
          </div>
        </div>

        <section class="flex flex-col gap-1 min-h-0" aria-labelledby="c-list">
          <div class="flex items-center justify-between">
            <h2 id="c-list" class="text-xs font-bold uppercase tracking-wider opacity-70 truncate">
              {{ presentation.title }}
            </h2>
            <NuxtLink to="/favorites?tab=lista" class="btn btn-link btn-xs px-0">
              Editar
            </NuxtLink>
          </div>
          <ol v-if="setlistSongs.length" class="flex flex-col rounded-box bg-base-100 divide-y divide-base-200 overflow-y-auto">
            <li v-for="item in setlistSongs" :key="item.id">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-3 py-2 text-start text-sm hover:bg-base-200"
                :class="{ 'font-bold bg-primary/10': item.id === current }"
                :aria-current="item.id === current ? 'true' : undefined"
                @click="loadHymn(item.id)"
              >
                <span class="w-8 text-end font-semibold text-primary tabular-nums">{{ item.id }}</span>
                <span class="flex-1 truncate">{{ item.title }}</span>
              </button>
            </li>
          </ol>
          <p v-else class="text-sm opacity-70 rounded-box bg-base-100 px-3 py-3">
            Aún no hay himnos en la lista. Agrega el actual o prepárala desde Favoritos.
          </p>
          <button
            v-if="!presentation.has(current)"
            type="button"
            class="btn btn-ghost btn-sm justify-start"
            @click="addCurrent"
          >
            <Icon name="tabler:playlist-add" size="18" />
            Agregar el {{ current }} a la lista
          </button>
        </section>
      </aside>
    </main>

    <footer class="hidden lg:flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs opacity-75 border-t border-base-300 bg-base-100">
      <span><kbd class="kbd kbd-xs">←</kbd> <kbd class="kbd kbd-xs">→</kbd> estrofa</span>
      <span><kbd class="kbd kbd-xs">N</kbd> <kbd class="kbd kbd-xs">P</kbd> himno</span>
      <span><kbd class="kbd kbd-xs">B</kbd> negro</span>
      <span><kbd class="kbd kbd-xs">+</kbd> <kbd class="kbd kbd-xs">−</kbd> tamaño ({{ Math.round(scale * 100) }}%)</span>
      <span class="flex-1" />
      <span><kbd class="kbd kbd-xs">?</kbd> todos los atajos</span>
    </footer>

    <AppGoToHymn v-model:open="showGoTo" @go="loadHymn" />
    <AppShortcutsHelp v-model:open="showHelp" :groups="shortcutGroups" />
  </div>
</template>

<style>
.live-wrap {
  position: relative;
}
.live-wrap:fullscreen {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 0;
  cursor: none;
}
.live-wrap:fullscreen .projection-frame {
  width: min(100vw, calc(100vh * 16 / 9));
}
</style>
