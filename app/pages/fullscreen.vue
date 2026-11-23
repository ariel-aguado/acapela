<script lang="ts" setup>
import type { ShortcutGroup } from "~/components/app/shortcuts-help.vue";
import type { ProjectorState } from "~/composables/use-projector-channel";

import { PROJECTOR_WINDOW_NAME } from "~/composables/use-projector-channel";
import { SCALE_MAX, SCALE_MIN, SCALE_STEP } from "~/stores/presentation";

// Operator console. The person projecting sees what is live and what comes
// next; the congregation sees only the slide, either in a
// separate projector window (synced over BroadcastChannel) or on this screen
// in full screen.
definePageMeta({ bare: true });
useHead({ title: "Proyección" });

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
function nextHymn() {
  loadHymn(current.value + 1);
}
function prevHymn() {
  loadHymn(current.value - 1);
}

function changeScale(delta: number) {
  presentation.setScale(current.value, scale.value + delta);
}

const atEnd = computed(() => slides.value.length > 0 && slideIndex.value === slides.value.length - 1);
const nextHymnId = computed(() => (current.value < total.value
  ? current.value + 1
  : null));

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
      {
        keys: ["→", "Espacio"],
        label: "Siguiente estrofa (también el control remoto)",
      },
      {
        keys: ["←"],
        label: "Estrofa anterior",
      },
      {
        keys: ["Inicio", "Fin"],
        label: "Primera / última estrofa",
      },
    ],
  },
  {
    title: "Himnos",
    items: [
      {
        keys: ["N"],
        label: "Himno siguiente",
      },
      {
        keys: ["P"],
        label: "Himno anterior",
      },
      {
        keys: ["G"],
        label: "Ir a un himno por número",
      },
    ],
  },
  {
    title: "Pantalla",
    items: [
      {
        keys: ["B"],
        label: "Pantalla en negro / volver",
      },
      {
        keys: ["+", "−"],
        label: "Agrandar / achicar el texto de este himno",
      },
      {
        keys: ["0"],
        label: "Tamaño automático",
      },
      {
        keys: ["F"],
        label: "Presentar en esta pantalla",
      },
      {
        keys: ["?"],
        label: "Ver estos atajos",
      },
    ],
  },
];

onMounted(() => songStore.getSongs());
</script>

<template>
  <div class="console min-h-dvh flex flex-col bg-muted text-default">
    <!-- Top bar -->
    <header class="flex flex-wrap items-center gap-2 px-3 py-2 bg-default border-b border-default">
      <UButton
        to="/cantar"
        color="neutral"
        variant="ghost"
        size="lg"
        icon="i-tabler-arrow-left"
        label="Volver a la lectura"
      />
      <h1 class="text-lg font-bold px-1">
        Proyección
      </h1>
      <UBadge
        v-if="currentSongbook"
        color="neutral"
        variant="soft"
        :label="currentSongbook.name"
      />
      <span class="flex-1" />
      <span
        class="inline-flex items-center gap-1.5 text-sm font-semibold"
        :class="connected ? 'text-error' : 'opacity-60'"
        role="status"
      >
        <span class="h-2.5 w-2.5 rounded-full" :class="connected ? 'bg-error animate-pulse' : 'bg-inverted/40'" />
        {{ connected ? 'Proyector conectado' : 'Proyector sin conectar' }}
      </span>
      <UButton
        color="neutral"
        variant="outline"
        size="lg"
        icon="i-tabler-device-desktop-share"
        label="Abrir ventana del proyector"
        @click="openProjector"
      />
      <UButton
        color="neutral"
        variant="outline"
        size="lg"
        icon="i-tabler-maximize"
        @click="toggleFullscreen()"
      >
        Presentar aquí <UKbd value="F" />
      </UButton>
      <UButton size="lg" icon="i-tabler-hash" @click="showGoTo = true">
        Ir al himno <UKbd value="G" />
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        icon="i-tabler-keyboard"
        square
        aria-label="Atajos de teclado"
        @click="showHelp = true"
      />
    </header>

    <div v-if="status === 'loading' || !currentSong" class="flex-1 grid place-items-center">
      <UIcon name="i-tabler-loader-2" class="size-10 animate-spin text-primary" aria-label="Cargando" />
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
              class="w-full text-start rounded-2xl border-2 bg-default px-3 py-2 text-sm leading-snug transition-colors"
              :class="[
                i === slideIndex ? 'border-error' : i === slideIndex + 1 ? 'border-primary border-dashed' : 'border-transparent hover:border-default',
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
          <UBadge
            v-if="overflow"
            color="warning"
            variant="subtle"
            icon="i-tabler-alert-triangle"
            label="El texto no entra: achícalo con −"
          />
        </div>
        <div
          ref="liveWrapRef"
          class="live-wrap rounded-2xl overflow-hidden ring-2"
          :class="black ? 'ring-inverted/40' : 'ring-error'"
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
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            class="h-11"
            icon="i-tabler-chevron-left"
            label="Anterior"
            :disabled="slideIndex === 0"
            @click="prevStep"
          />
          <UButton
            size="xl"
            class="h-11 flex-1 min-w-40 justify-center"
            trailing-icon="i-tabler-chevron-right"
            label="Siguiente estrofa"
            :disabled="atEnd"
            @click="nextStep"
          />
          <UButton
            color="neutral"
            :variant="black ? 'solid' : 'outline'"
            size="xl"
            class="h-11"
            icon="i-tabler-screen-share-off"
            :aria-pressed="black"
            @click="black = !black"
          >
            {{ black ? 'Mostrar' : 'Negro' }}
            <UKbd value="B" />
          </UButton>
          <UFieldGroup role="group" aria-label="Tamaño del texto de este himno">
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              class="h-11"
              label="−"
              aria-label="Achicar texto"
              :disabled="scale <= SCALE_MIN"
              @click="changeScale(-SCALE_STEP)"
            />
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              class="h-11 tabular-nums min-w-16 justify-center"
              :title="scale === 1 ? 'Tamaño automático' : 'Volver al tamaño automático'"
              :label="`${Math.round(scale * 100)}%`"
              @click="presentation.setScale(current, 1)"
            />
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              class="h-11"
              label="+"
              aria-label="Agrandar texto"
              :disabled="scale >= SCALE_MAX"
              @click="changeScale(SCALE_STEP)"
            />
          </UFieldGroup>
        </div>
        <p v-if="atEnd" class="text-sm opacity-80">
          Fin del himno.
          <template v-if="nextHymnId">
            <UKbd value="N" /> pasa al {{ nextHymnId }}.
          </template>
        </p>
      </section>

      <!-- Next -->
      <aside class="flex flex-col gap-3 min-w-0 order-3" aria-label="Siguiente">
        <div class="flex flex-col gap-1">
          <h2 class="text-xs font-bold uppercase tracking-wider opacity-70">
            Siguiente
          </h2>
          <div class="rounded-2xl overflow-hidden">
            <ProjectionSlide
              v-if="nextSlide"
              :slide="nextSlide"
              :number="currentSong.songId"
              :title="currentSong.title"
              :scale="scale"
              :badge="nextSlide.label"
            />
            <div v-else class="aspect-video grid place-items-center bg-accented text-sm opacity-70 px-3 text-center">
              {{ nextHymnId ? `Después: himno ${nextHymnId}` : 'Última estrofa' }}
            </div>
          </div>
        </div>
      </aside>
    </main>

    <footer class="hidden lg:flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs opacity-75 border-t border-default bg-default">
      <span><UKbd value="←" /> <UKbd value="→" /> estrofa</span>
      <span><UKbd value="N" /> <UKbd value="P" /> himno</span>
      <span><UKbd value="B" /> negro</span>
      <span><UKbd value="+" /> <UKbd value="−" /> tamaño ({{ Math.round(scale * 100) }}%)</span>
      <span class="flex-1" />
      <span><UKbd value="?" /> todos los atajos</span>
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
