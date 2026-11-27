<script lang="ts" setup>
import type { ShortcutGroup } from "~/components/app/shortcuts-help.vue";
import type { InsertWhere } from "~/components/culto/insert-dialog.vue";
import type { ProjectorState } from "~/composables/use-projector-channel";
import type { CultoItem } from "~~/lib/culto";

import { PROJECTOR_WINDOW_NAME } from "~/composables/use-projector-channel";
import { SCALE_MAX, SCALE_MIN, SCALE_STEP } from "~/stores/presentation";

// The live console of a service: every screen of every element in order,
// so → goes from the last verse of a hymn to the next reading without
// looking for anything. The projector window (or this screen in full
// screen) shows only the live screen. Anything can be inserted while live.
definePageMeta({ bare: true });
useHead({ title: "Culto en vivo" });

const culto = useCultoStore();
const songStore = useSongStore();
const presentation = usePresentationStore();
const bible = useBibleStore();
const { current } = storeToRefs(culto);
const { show: toast } = useUndoToast();

const items = computed<CultoItem[]>(() => current.value?.items ?? []);
const { entries, flat } = useCultoScreens(items);

// ------------------------------------------------------------ position
// Kept as "element + screen", not as a number: inserting or re-flowing
// before it must not move what is on screen.
const position = useSessionStorage<{ itemId: string; index: number } | null>("cultoLivePosition", null);
const black = ref(false);
/** After something inserted "now", where to come back to. */
const returnTo = ref<{ itemId: string; index: number; afterItemId: string } | null>(null);

const liveIndex = computed(() => {
  const list = flat.value;
  if (!list.length)
    return -1;
  const pos = position.value;
  if (!pos)
    return 0;
  const exact = list.findIndex(s => s.itemId === pos.itemId && s.index === pos.index);
  if (exact >= 0)
    return exact;
  // The element got fewer screens (re-flow): its last one.
  const sameItem = list.filter(s => s.itemId === pos.itemId);
  if (sameItem.length)
    return list.indexOf(sameItem.at(-1)!);
  return 0;
});
const live = computed(() => flat.value[liveIndex.value] ?? null);
const liveEntry = computed(() => entries.value.find(e => e.item.id === live.value?.itemId) ?? null);
function goTo(index: number) {
  const target = flat.value[index];
  if (target)
    position.value = { itemId: target.itemId, index: target.index };
}

/**
 * The screen that comes after `index`: the next one, except at the end of
 * an element inserted "now", which goes back to where the service was.
 */
function nextIndexOf(index: number): number {
  const list = flat.value;
  const back = returnTo.value;
  if (back && list[index]?.itemId === back.afterItemId && list[index + 1]?.itemId !== back.afterItemId) {
    const target = list.findIndex(s => s.itemId === back.itemId && s.index === back.index);
    if (target >= 0)
      return target;
  }
  return index + 1;
}

/** The next screens in the order they will be shown. */
const upcoming = computed(() => {
  const list: { s: (typeof flat.value)[number]; at: number }[] = [];
  let i = liveIndex.value;
  while (list.length < 4) {
    const n = nextIndexOf(i);
    const s = flat.value[n];
    if (!s || list.some(x => x.at === n))
      break;
    list.push({ s, at: n });
    i = n;
  }
  return list;
});

function next() {
  const target = nextIndexOf(liveIndex.value);
  const back = returnTo.value;
  if (back && flat.value[liveIndex.value]?.itemId === back.afterItemId && flat.value[target]?.itemId !== back.afterItemId)
    returnTo.value = null;
  goTo(target);
}
function prev() {
  goTo(liveIndex.value - 1);
}
function goToItem(itemId: string) {
  goTo(flat.value.findIndex(s => s.itemId === itemId));
}

// ------------------------------------------------------------ inserting

const showInsert = ref(false);
const showGoTo = ref(false);
const showHelp = ref(false);

function insert(item: CultoItem, where: InsertWhere) {
  const list = items.value;
  const currentItemIndex = list.findIndex(i => i.id === live.value?.itemId);
  const index = where === "end" || currentItemIndex < 0
    ? list.length
    : currentItemIndex + 1;
  if (where === "now" && live.value) {
    // Come back to the screen that came next, inside the current element
    // or after it.
    const after = flat.value[liveIndex.value + 1];
    returnTo.value = after
      ? { itemId: after.itemId, index: after.index, afterItemId: item.id }
      : null;
  }
  culto.addItem(item, index);
  if (where === "now") {
    position.value = { itemId: item.id, index: 0 };
  }
  else {
    toast(where === "end"
      ? "Se agregó al final del culto."
      : "Se agregó después de este elemento.");
  }
}

function insertHymn(songId: number) {
  insert(culto.newHymn(useSongbookStore().currentId, songId, { inserted: true }), "now");
}

// ------------------------------------------------------------ text size

const liveScale = computed(() => {
  const screen = live.value?.screen;
  return screen?.scale ?? 1;
});
function changeScale(delta: number) {
  const item = liveEntry.value?.item;
  if (!item)
    return;
  const value = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, liveScale.value + delta)) * 10) / 10;
  if (item.kind === "hymn" && item.scale === undefined)
    presentation.setScale(item.songId, value);
  else
    culto.updateItem(item.id, { scale: value });
}

// ------------------------------------------------------------ projector

const liveState = computed<ProjectorState>(() => ({
  screen: live.value?.screen ?? null,
  black: black.value,
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

// ------------------------------------------------------------ clock

const now = useNow({ interval: 1000 });
const startedAt = useSessionStorage<number>("cultoLiveStartedAt", 0);
const clock = computed(() => now.value.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }));
const elapsed = computed(() => {
  if (!startedAt.value)
    return "";
  const minutes = Math.floor((now.value.getTime() - startedAt.value) / 60000);
  return minutes < 1
    ? "Empezó hace un momento"
    : `Empezó hace ${minutes} min`;
});

// ------------------------------------------------------------ keyboard

function blocked(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  return typing || showInsert.value || showGoTo.value || showHelp.value || e.ctrlKey || e.metaKey || e.altKey;
}
function keys(list: string[], run: () => void) {
  onKeyStroke(list, (e) => {
    if (blocked(e))
      return;
    e.preventDefault();
    run();
  }, { dedupe: true });
}

keys([
  "ArrowRight",
  "ArrowDown",
  "PageDown",
  " ",
], next);
keys(["ArrowLeft", "ArrowUp", "PageUp"], prev);
keys(["Home"], () => goTo(0));
keys(["End"], () => goTo(flat.value.length - 1));
keys(["b", "B", "."], () => (black.value = !black.value));
keys(["i", "I"], () => (showInsert.value = true));
keys(["g", "G"], () => (showGoTo.value = true));
keys(["+", "="], () => changeScale(SCALE_STEP));
keys(["-", "_"], () => changeScale(-SCALE_STEP));
keys(["f", "F"], () => toggleFullscreen());
keys(["?"], () => (showHelp.value = true));

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Avanzar",
    items: [
      {
        keys: ["→", "Espacio"],
        label: "Siguiente pantalla (también el control remoto)",
      },
      {
        keys: ["←"],
        label: "Pantalla anterior",
      },
      {
        keys: ["Inicio", "Fin"],
        label: "Primera / última pantalla del culto",
      },
    ],
  },
  {
    title: "Insertar",
    items: [
      {
        keys: ["I"],
        label: "Insertar un himno, una cita o un texto",
      },
      {
        keys: ["G"],
        label: "Proyectar ahora un himno por número",
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
        label: "Agrandar / achicar el texto de este elemento",
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

onMounted(() => {
  songStore.getSongs();
  if (!bible.loaded)
    bible.refresh();
  if (!startedAt.value)
    startedAt.value = Date.now();
});

function endService() {
  position.value = null;
  startedAt.value = 0;
  returnTo.value = null;
  navigateTo("/culto");
}
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-muted text-default">
    <header class="flex flex-wrap items-center gap-2 px-3 py-2 bg-default border-b border-default">
      <UButton
        to="/culto"
        color="neutral"
        variant="ghost"
        size="lg"
        icon="i-tabler-arrow-left"
        label="Editar"
      />
      <UBadge
        color="error"
        variant="soft"
        size="lg"
        class="font-bold tracking-wider"
      >
        <span class="size-2 rounded-full bg-error animate-pulse" aria-hidden="true" />
        EN VIVO
      </UBadge>
      <h1 class="text-lg font-bold px-1 truncate">
        {{ current?.title ?? 'Culto' }}
      </h1>
      <span class="flex-1" />
      <span
        class="inline-flex items-center gap-1.5 text-sm font-semibold"
        :class="connected ? 'text-success' : 'opacity-60'"
        role="status"
      >
        <span class="h-2.5 w-2.5 rounded-full" :class="connected ? 'bg-success' : 'bg-inverted/40'" />
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
      <UButton size="lg" icon="i-tabler-plus" @click="showInsert = true">
        Insertar <UKbd value="I" />
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

    <div v-if="!flat.length" class="flex-1 grid place-items-center p-6 text-center">
      <div class="flex flex-col items-center gap-3">
        <UIcon
          v-if="entries.some(e => e.status === 'loading')"
          name="i-tabler-loader-2"
          class="size-10 animate-spin text-primary"
          aria-label="Preparando"
        />
        <template v-else>
          <p class="font-semibold">
            Este culto todavía no tiene pantallas.
          </p>
          <UButton to="/culto" label="Prepararlo" />
        </template>
      </div>
    </div>

    <main v-else class="flex-1 grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_20rem] min-h-0">
      <section class="flex flex-col gap-3 min-w-0" aria-labelledby="v-live">
        <h2 id="v-live" class="text-xs font-bold uppercase tracking-wider opacity-70">
          En pantalla · {{ liveEntry?.label }}
          <template v-if="(liveEntry?.screens.length ?? 0) > 1">
            · {{ (live?.index ?? 0) + 1 }} de {{ liveEntry?.screens.length }}
          </template>
        </h2>
        <div
          ref="liveWrapRef"
          class="live-wrap rounded-2xl overflow-hidden ring-2"
          :class="black ? 'ring-inverted/40' : 'ring-error'"
          @click="isFullscreen && next()"
        >
          <CultoScreen :screen="live?.screen ?? null" :black="black" />
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
            :disabled="liveIndex <= 0"
            @click="prev"
          />
          <UButton
            size="xl"
            class="h-11 flex-1 min-w-40 justify-center"
            trailing-icon="i-tabler-chevron-right"
            label="Siguiente"
            :disabled="!upcoming.length"
            @click="next"
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
            {{ black ? 'Mostrar' : 'Negro' }} <UKbd value="B" />
          </UButton>
          <UFieldGroup role="group" aria-label="Tamaño del texto de este elemento">
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              class="h-11"
              label="−"
              aria-label="Achicar texto"
              @click="changeScale(-SCALE_STEP)"
            />
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              class="h-11 tabular-nums min-w-16 justify-center"
              :label="`${Math.round(liveScale * 100)}%`"
              disabled
            />
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              class="h-11"
              label="+"
              aria-label="Agrandar texto"
              @click="changeScale(SCALE_STEP)"
            />
          </UFieldGroup>
        </div>

        <div class="flex flex-col gap-2">
          <h2 class="text-xs font-bold uppercase tracking-wider opacity-70">
            A continuación
          </h2>
          <ol class="grid grid-cols-2 xl:grid-cols-4 gap-2">
            <li v-for="{ s, at } in upcoming" :key="s.key">
              <button
                type="button"
                class="w-full rounded-xl overflow-hidden ring-1 ring-default hover:ring-primary text-start"
                :aria-label="`Ir a ${entries[s.itemIndex]?.label}, pantalla ${s.index + 1}`"
                @click="goTo(at)"
              >
                <CultoScreen :screen="s.screen" :badge="s.itemId !== live?.itemId ? entries[s.itemIndex]?.label : ''" />
              </button>
            </li>
          </ol>
          <p v-if="!upcoming.length" class="text-sm opacity-70">
            Es la última pantalla del culto.
          </p>
        </div>
      </section>

      <aside class="flex flex-col gap-4 min-w-0" aria-label="Culto">
        <div class="flex flex-col gap-0.5">
          <span class="text-5xl font-semibold tabular-nums leading-none">{{ clock }}</span>
          <span class="text-sm opacity-70">{{ elapsed }}</span>
        </div>

        <div v-if="liveEntry?.item.notes" class="flex flex-col gap-2">
          <h2 class="text-xs font-bold uppercase tracking-wider opacity-70">
            Notas
          </h2>
          <p class="border-s-2 border-primary ps-3 text-lg leading-snug whitespace-pre-line">
            {{ liveEntry.item.notes }}
          </p>
        </div>

        <nav aria-label="Orden del culto" class="flex flex-col gap-1">
          <h2 class="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">
            Orden
          </h2>
          <button
            v-for="(entry, i) in entries"
            :key="entry.item.id"
            type="button"
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-start text-sm"
            :class="[
              entry.item.id === live?.itemId ? 'bg-primary/15 font-semibold' : 'hover:bg-default',
              i < (live?.itemIndex ?? 0) ? 'opacity-55' : '',
            ]"
            :aria-current="entry.item.id === live?.itemId ? 'step' : undefined"
            :disabled="!entry.screens.length"
            @click="goToItem(entry.item.id)"
          >
            <span class="w-5 text-xs tabular-nums opacity-60">{{ i + 1 }}</span>
            <span class="flex-1 min-w-0 truncate">{{ entry.label }}</span>
            <UIcon
              v-if="entry.status === 'error'"
              name="i-tabler-alert-triangle"
              class="size-4 text-warning"
              :aria-label="entry.error"
            />
            <span v-else class="text-xs opacity-60">{{ entry.item.inserted ? 'insertado' : entry.screens.length }}</span>
          </button>
        </nav>

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-tabler-player-stop"
          label="Terminar el culto"
          class="self-start"
          @click="endService"
        />
      </aside>
    </main>

    <CultoInsertDialog v-model:open="showInsert" @insert="insert" />
    <AppGoToHymn
      v-model:open="showGoTo"
      heading="Proyectar un himno ahora"
      action-label="Proyectar"
      @go="insertHymn"
    />
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
