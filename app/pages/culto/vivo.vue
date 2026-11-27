<script lang="ts" setup>
import type { ShortcutGroup } from "~/components/app/shortcuts-help.vue";
import type { InsertWhere } from "~/components/culto/insert-dialog.vue";
import type { ProjectorState } from "~/composables/use-projector-channel";
import type { Screen } from "~/utils/culto/screens";
import type { CultoItem, ScreenTransition } from "~~/lib/culto";

import { QUICK_POSITION_KEY } from "~/composables/use-project-hymn";
import { PROJECTOR_WINDOW_NAME } from "~/composables/use-projector-channel";
import { cultoWhen } from "~/stores/culto";
import { SCALE_MAX, SCALE_MIN, SCALE_STEP } from "~/stores/presentation";
import { resolveLook } from "~/utils/culto/look";
import { momentTone } from "~/utils/culto/moment";
import { blocksOf } from "~/utils/culto/sections";
import { DEFAULT_TRANSITIONS } from "~~/lib/culto";

// The live console of a service: every screen of every element in order,
// so → goes from the last verse of a hymn to the next reading without
// looking for anything. The projector window (or this screen in full
// screen) shows only the live screen. Anything can be inserted while live.
//
// It is the only projection console. /culto/vivo projects the service being
// prepared; /culto/vivo?libre the free projection ("Proyectar himno": hymns
// one after the other, no service prepared), which says so on top and can
// be saved as a service. N and P go to the next and previous hymn there.
definePageMeta({ bare: true });

const route = useRoute();
const router = useRouter();
const culto = useCultoStore();
const songStore = useSongStore();
const songbookStore = useSongbookStore();
const presentation = usePresentationStore();
const bible = useBibleStore();
const { current, quickCulto } = storeToRefs(culto);
const { songs } = storeToRefs(songStore);
const { show: toast } = useUndoToast();

/** The free projection instead of the prepared service. */
const quick = computed(() => route.query.libre !== undefined);
const liveCulto = computed(() => (quick.value
  ? quickCulto.value
  : current.value));
useHead(() => ({
  title: quick.value
    ? "Proyección libre"
    : "Culto en vivo",
}));

const items = computed<CultoItem[]>(() => liveCulto.value?.items ?? []);
const { entries, flat } = useCultoScreens(items);

/** The order on the right, with its sections as headings. */
const orderBlocks = computed(() => blocksOf(
  entries.value.map((entry, index) => ({
    id: entry.item.id,
    sectionId: entry.item.sectionId,
    entry,
    index,
  })),
  liveCulto.value?.sections,
));

// ------------------------------------------------------------ position
// Kept as "element + screen", not as a number: inserting or re-flowing
// before it must not move what is on screen. One for the service and one
// for the free projection, so going from one to the other keeps both.
type Position = { itemId: string; key: string } | null;
const servicePosition = useSessionStorage<Position>("cultoLivePosition2", null);
const quickPosition = useSessionStorage<Position>(QUICK_POSITION_KEY, null);
const position = computed<Position>({
  get: () => (quick.value
    ? quickPosition
    : servicePosition).value,
  set: (value) => {
    (quick.value
      ? quickPosition
      : servicePosition).value = value;
  },
});
const black = ref(false);
/** The church's logo instead of the live screen (L). */
const showLogo = ref(false);
/** After something inserted "now", where to come back to. */
const returnTo = ref<{ itemId: string; key: string; afterItemId: string } | null>(null);
/** What stays on the projector after «Aplicar al pasar», until moving on. */
const frozen = ref<{ itemId: string; screen: Screen | null; key: string } | null>(null);

// While the element in position has no screens yet (inserted a moment ago,
// still being measured), the previous screen stays.
let lastLive = { itemId: "", key: "" };
const liveIndex = computed(() => {
  const list = flat.value;
  if (!list.length)
    return -1;
  const pos = position.value;
  if (!pos)
    return 0;
  const sameItem = list.filter(s => s.itemId === pos.itemId);
  // An empty key: its first screen (just inserted).
  const exact = pos.key
    ? list.findIndex(s => s.itemId === pos.itemId && s.screenKey === pos.key)
    : list.indexOf(sameItem[0]!);
  // Otherwise the element got fewer screens (re-flow, hidden): its last one.
  const found = exact >= 0
    ? exact
    : sameItem.length
      ? list.indexOf(sameItem.at(-1)!)
      : list.findIndex(s => s.itemId === lastLive.itemId && s.screenKey === lastLive.key);
  const index = Math.max(0, found);
  lastLive = { itemId: list[index]!.itemId, key: list[index]!.screenKey };
  return index;
});
const live = computed(() => flat.value[liveIndex.value] ?? null);
const liveEntry = computed(() => entries.value.find(e => e.item.id === live.value?.itemId) ?? null);
function goTo(index: number) {
  frozen.value = null;
  const target = flat.value[index];
  if (target)
    position.value = { itemId: target.itemId, key: target.screenKey };
}

/**
 * The screen that comes after `index`: the next one, except at the end of
 * an element inserted "now", which goes back to where the service was.
 */
function nextIndexOf(index: number): number {
  const list = flat.value;
  const back = returnTo.value;
  if (back && list[index]?.itemId === back.afterItemId && list[index + 1]?.itemId !== back.afterItemId) {
    const target = list.findIndex(s => s.itemId === back.itemId && s.screenKey === back.key);
    if (target >= 0)
      return target;
  }
  return index + 1;
}

/** The live element's screens, with their place in the service (for the strip). */
const liveStrip = computed(() => {
  const id = live.value?.itemId;
  return flat.value.map((s, at) => ({ s, at })).filter(x => x.s.itemId === id);
});

/** The next screens in the order they will be shown. */
const upcoming = computed(() => {
  const list: { s: (typeof flat.value)[number]; at: number }[] = [];
  let i = liveIndex.value;
  const pending = frozen.value?.itemId;
  if (pending) {
    const first = flat.value.findIndex(s => s.itemId === pending);
    if (first >= 0) {
      list.push({ s: flat.value[first]!, at: first });
      i = first;
    }
  }
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

/** What → shows next: the first of `upcoming`. */
const nextUp = computed(() => upcoming.value[0] ?? null);
const nextAt = computed(() => nextUp.value?.at ?? -1);

function next() {
  if (showLogo.value) {
    showLogo.value = false;
    return;
  }
  // After «Aplicar al pasar»: the corrected element, from its start.
  if (frozen.value) {
    const itemId = frozen.value.itemId;
    frozen.value = null;
    position.value = { itemId, key: "" };
    return;
  }
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
      ? { itemId: after.itemId, key: after.screenKey, afterItemId: item.id }
      : null;
  }
  // Inserted during a section (the Lord's supper), it belongs to it.
  const liveSection = list[currentItemIndex]?.sectionId;
  if (where !== "end" && liveSection)
    item.sectionId = liveSection;
  culto.addItem(item, index, liveCulto.value?.id);
  if (where === "now") {
    position.value = { itemId: item.id, key: "" };
  }
  else {
    toast(where === "end"
      ? "Se agregó al final del culto."
      : "Se agregó después de este elemento.");
  }
}

function insertHymn(songId: number) {
  if (quick.value) {
    // The free projection is just the hymns in the order they were shown.
    const item = culto.projectQuick(songbookStore.currentId, songId);
    returnTo.value = null;
    position.value = { itemId: item.id, key: "" };
    return;
  }
  insert(culto.newHymn(songbookStore.currentId, songId, { inserted: true }), "now");
}

/** Free projection: the hymn after or before the one on screen (N, P). */
const liveHymn = computed(() => {
  const item = liveEntry.value?.item;
  return item?.kind === "hymn" && item.songbookId === songbookStore.currentId
    ? item
    : null;
});
function stepHymn(step: number) {
  const id = (liveHymn.value?.songId ?? 0) + step;
  if (quick.value && liveHymn.value && id >= 1 && id <= songs.value.length)
    insertHymn(id);
}

// ------------------------------------------------------------ text size

const liveScale = computed(() => {
  const screen = live.value?.screen;
  return screen && screen.type !== "image"
    ? screen.scale
    : 1;
});
function changeScale(delta: number) {
  const item = liveEntry.value?.item;
  if (!item)
    return;
  const value = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, liveScale.value + delta)) * 10) / 10;
  if (item.kind === "hymn" && item.scale === undefined)
    presentation.setScale(item.songId, value);
  else
    culto.updateItem(item.id, { scale: value }, liveCulto.value?.id);
}

// ------------------------------------------------------------ projector

// The church's logo screen, on and off with L (before starting, between parts).
const logoScreen = computed<Screen>(() => ({
  type: "page",
  layout: "logo",
  eyebrow: "",
  title: culto.theme.churchName,
  reference: "",
  html: "",
  footer: "",
  counter: "",
  scale: 1,
  mediaId: culto.theme.logoId,
  look: resolveLook(culto.theme),
}));
const onAir = computed(() => showLogo.value
  ? logoScreen.value
  : frozen.value
    ? frozen.value.screen
    : live.value?.screen ?? null);

// The transition of each change: the element's own, or the theme's between
// its screens or when a new element begins; the logo, a short fade.
const onAirKey = computed(() => (showLogo.value
  ? "logo"
  : frozen.value
    ? frozen.value.key
    : live.value
      ? `${live.value.itemId}:${live.value.screenKey}`
      : ""));
const onAirTransition = ref<ScreenTransition>(DEFAULT_TRANSITIONS.screen);
let lastItemId = "";
let lastWasLogo = false;
watch(onAirKey, (key) => {
  const itemId = live.value?.itemId ?? "";
  const own = liveEntry.value?.item.transition;
  const theme = culto.theme.transitions ?? DEFAULT_TRANSITIONS;
  onAirTransition.value = key === "logo" || lastWasLogo
    ? { kind: "fade", speed: "fast" }
    : own ?? (itemId !== lastItemId
      ? theme.element
      : theme.screen);
  lastWasLogo = key === "logo";
  if (key !== "logo")
    lastItemId = itemId;
}, { flush: "sync", immediate: true });
/** The operator asked for less motion: the console cuts (the projector does not). */
const reducedMotion = usePreferredReducedMotion();

// ------------------------------------------------------------ correcting a passage
// A wrong passage is corrected right here (C, or the pencil in the order).
// On air, «Aplicar y mostrar» shows its first corrected screen at once;
// «Aplicar al pasar» keeps the screen the congregation sees until → (which
// then shows the corrected element from its start).
const fixingId = ref<string | null>(null);
const showFix = computed({
  get: () => !!fixingId.value,
  set: (value: boolean) => {
    if (!value)
      fixingId.value = null;
  },
});
const fixEntry = computed(() => entries.value.find(e => e.item.id === fixingId.value) ?? null);
/** It has a passage or a reference to correct. */
function canFix(item: CultoItem | undefined) {
  return item?.kind === "reading" || (item?.kind === "screen" && !!item.reference.trim());
}
function fix(itemId: string | undefined) {
  if (itemId && canFix(entries.value.find(e => e.item.id === itemId)?.item))
    fixingId.value = itemId;
}
function applyFix(changes: Partial<CultoItem>, show: "now" | "later" | "none") {
  const item = fixEntry.value?.item;
  if (!item)
    return;
  const before = Object.fromEntries(Object.keys(changes).map(k => [k, (item as Record<string, unknown>)[k]])) as Partial<CultoItem>;
  if (show === "later")
    frozen.value = { itemId: item.id, screen: onAir.value, key: onAirKey.value };
  culto.updateItem(item.id, changes, liveCulto.value?.id);
  if (show === "now")
    position.value = { itemId: item.id, key: "" };
  toast(show === "later"
    ? "Se corrigió la cita: se verá al pasar."
    : "Se corrigió la cita.", {
    label: "Deshacer",
    run: () => culto.updateItem(item.id, before, liveCulto.value?.id),
  });
}

const liveState = computed<ProjectorState>(() => ({
  screen: onAir.value,
  black: black.value,
  key: onAirKey.value,
  transition: onAirTransition.value,
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
const serviceStartedAt = useSessionStorage<number>("cultoLiveStartedAt", 0);
const quickStartedAt = useSessionStorage<number>("cultoLiveStartedAtLibre", 0);
const startedAt = computed<number>({
  get: () => (quick.value
    ? quickStartedAt
    : serviceStartedAt).value,
  set: (value) => {
    (quick.value
      ? quickStartedAt
      : serviceStartedAt).value = value;
  },
});
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
  return typing || showInsert.value || showGoTo.value || showHelp.value || showFix.value || e.ctrlKey || e.metaKey || e.altKey;
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
keys(["l", "L"], () => (showLogo.value = !showLogo.value));
keys(["g", "G"], () => (showGoTo.value = true));
keys(["n", "N"], () => stepHymn(1));
keys(["p", "P"], () => stepHymn(-1));
keys(["+", "="], () => changeScale(SCALE_STEP));
keys(["-", "_"], () => changeScale(-SCALE_STEP));
keys(["f", "F"], () => toggleFullscreen());
keys(["?"], () => (showHelp.value = true));
keys(["c", "C"], () => fix(live.value?.itemId));

const serviceShortcuts: ShortcutGroup[] = [
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
      {
        keys: ["C"],
        label: "Corregir la cita de lo que está en pantalla",
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
        keys: ["L"],
        label: "Logo de la iglesia / volver",
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
const shortcutGroups = computed<ShortcutGroup[]>(() => (quick.value
  ? [
      serviceShortcuts[0]!,
      {
        title: "Himnos",
        items: [
          {
            keys: ["N", "P"],
            label: "Himno siguiente / anterior",
          },
          {
            keys: ["G"],
            label: "Proyectar un himno por número",
          },
          {
            keys: ["I"],
            label: "Insertar un himno, una cita o un texto",
          },
        ],
      },
      serviceShortcuts[2]!,
    ]
  : serviceShortcuts));

onMounted(() => {
  songStore.getSongs();
  if (!bible.loaded)
    bible.refresh();
  if (!startedAt.value)
    startedAt.value = Date.now();
});

function leave() {
  if (window.history.state?.back)
    router.back();
  else
    navigateTo("/cantar");
}

function endService() {
  const wasQuick = quick.value;
  position.value = null;
  startedAt.value = 0;
  returnTo.value = null;
  if (wasQuick)
    leave();
  else
    navigateTo("/culto");
}

/** The free projection becomes a service and the console stays on it. */
function saveAsService() {
  const at = quickPosition.value;
  const since = quickStartedAt.value;
  const saved = culto.saveQuick();
  if (!saved)
    return;
  servicePosition.value = at;
  serviceStartedAt.value = since || Date.now();
  quickPosition.value = null;
  quickStartedAt.value = 0;
  router.replace({ path: "/culto/vivo" });
  toast(`Guardado como el culto «${saved.title}». Puedes editarlo en Culto.`);
}
</script>

<template>
  <div class="min-h-dvh lg:h-dvh lg:overflow-hidden flex flex-col bg-muted text-default">
    <!-- On a computer everything fits the window, without scrolling (NN/g:
      visibility of system status; what is below the fold is barely seen):
      what is on air, what comes next, where the service is. -->
    <header class="flex flex-wrap items-center gap-2 px-3 py-2 bg-default border-b border-default">
      <UButton
        v-if="quick"
        color="neutral"
        variant="ghost"
        size="lg"
        icon="i-tabler-arrow-left"
        label="Volver"
        @click="leave"
      />
      <UButton
        v-else
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
      <!-- What is being projected, in words: the service or the free projection. -->
      <div class="min-w-0 px-1 flex flex-col leading-tight">
        <h1 class="text-lg font-bold truncate">
          {{ quick ? 'Proyección libre' : (liveCulto?.title ?? 'Culto') }}
        </h1>
        <span class="text-xs text-muted truncate">
          {{ quick ? 'Himnos sueltos, sin culto preparado' : (liveCulto ? cultoWhen(liveCulto) : 'Culto preparado') }}
        </span>
      </div>
      <UButton
        v-if="quick && items.length"
        color="neutral"
        variant="soft"
        size="lg"
        icon="i-tabler-device-floppy"
        label="Guardar como culto"
        @click="saveAsService"
      />
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
      <!-- Free projection: going to a hymn is the usual step, as it was in
        the old hymn console. -->
      <UButton
        v-if="quick"
        size="lg"
        icon="i-tabler-hash"
        @click="showGoTo = true"
      >
        Ir al himno <UKbd value="G" />
      </UButton>
      <UButton
        size="lg"
        icon="i-tabler-plus"
        :color="quick ? 'neutral' : 'primary'"
        :variant="quick ? 'outline' : 'solid'"
        @click="showInsert = true"
      >
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
        <template v-else-if="quick">
          <p class="font-semibold">
            Elige un himno para proyectar.
          </p>
          <UButton icon="i-tabler-hash" @click="showGoTo = true">
            Ir al himno <UKbd value="G" />
          </UButton>
        </template>
        <template v-else>
          <p class="font-semibold">
            Este culto todavía no tiene pantallas.
          </p>
          <UButton to="/culto" label="Prepararlo" />
        </template>
      </div>
    </div>

    <main v-else class="flex-1 grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_20rem] min-h-0 lg:overflow-hidden">
      <div class="flex flex-col gap-3 min-w-0 min-h-0">
        <CultoPanel
          title="En pantalla"
          icon="i-tabler-broadcast"
          head-id="v-live"
          class="lg:flex-1 lg:min-h-0"
          body-class="flex flex-col gap-3 p-3 lg:flex-1 lg:min-h-0"
        >
          <template #meta>
            <span class="inline-flex items-center gap-1.5">
              <CultoMomentTile v-if="liveEntry" :item="liveEntry.item" size="sm" />
              <span class="font-semibold text-default">{{ liveEntry?.item.kind === 'hymn' ? liveEntry.label.replace(`${liveEntry.item.songId} · `, '') : liveEntry?.label }}</span>
              <template v-if="(liveEntry?.screens.length ?? 0) > 1">
                · {{ (live?.index ?? 0) + 1 }} de {{ liveEntry?.screens.length }}
              </template>
            </span>
          </template>
          <template #actions>
            <UBadge
              v-if="frozen"
              color="warning"
              variant="soft"
              icon="i-tabler-clock-pause"
              label="Corregida: se verá al pasar"
            />
            <UButton
              v-if="canFix(liveEntry?.item)"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-tabler-pencil"
              @click="fix(liveEntry?.item.id)"
            >
              Corregir cita <UKbd value="C" size="sm" />
            </UButton>
          </template>
          <!-- As large as the room left allows, always 16:9. -->
          <div class="live-fit-box lg:flex-1 lg:min-h-0 flex items-center justify-center">
            <div
              ref="liveWrapRef"
              class="live-wrap live-fit rounded-2xl overflow-hidden ring-2"
              :class="black ? 'ring-inverted/40' : 'ring-error'"
              @click="isFullscreen && next()"
            >
              <CultoLiveScreen
                :screen="onAir"
                :black="black"
                :screen-key="onAirKey"
                :transition="onAirTransition"
                :animate="reducedMotion !== 'reduce'"
              />
              <div v-if="black && !isFullscreen" class="absolute inset-0 grid place-items-center text-white/80 text-sm font-semibold pointer-events-none">
                Pantalla en negro · B para volver
              </div>
            </div>
          </div>

          <template #footer>
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
              <UButton
                color="neutral"
                :variant="showLogo ? 'solid' : 'outline'"
                size="xl"
                class="h-11"
                icon="i-tabler-building-church"
                :aria-pressed="showLogo"
                @click="showLogo = !showLogo"
              >
                Logo <UKbd value="L" />
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
          </template>
        </CultoPanel>

        <!-- The element on air, screen by screen (on air in red, the next one
          dashed, the ones shown dimmed), the count, and what → shows next,
          even when it is another element or the way back after an insert. -->
        <CultoPanel title="Pantallas del elemento" icon="i-tabler-layout-cards" body-class="px-3 py-2">
          <template #meta>
            {{ (live?.index ?? 0) + 1 }} de {{ liveEntry?.screens.length ?? 0 }}
          </template>
          <div class="flex items-center gap-3 min-w-0">
            <ol
              v-scroll-fade-x
              class="flex-1 min-w-0 flex gap-2 overflow-x-auto px-1 py-1.5 [scrollbar-width:none]"
              aria-label="Pantallas del elemento al aire"
            >
              <li v-for="{ s, at } in liveStrip" :key="s.key" class="shrink-0">
                <button
                  type="button"
                  class="relative block w-28 rounded-lg overflow-hidden transition-opacity"
                  :class="at === liveIndex ? 'ring-2 ring-error' : at === nextAt ? 'outline-2 outline-dashed outline-offset-1 outline-primary' : at < liveIndex ? 'opacity-45 hover:opacity-80' : 'opacity-80 hover:opacity-100'"
                  :data-live-strip="at === liveIndex ? 'on' : undefined"
                  :aria-current="at === liveIndex ? 'true' : undefined"
                  :aria-label="`Proyectar la pantalla ${s.index + 1}`"
                  @click="goTo(at)"
                >
                  <span class="pointer-events-none block"><CultoScreen :screen="s.screen" /></span>
                  <span
                    class="absolute bottom-1 left-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.68rem] font-bold tabular-nums"
                    :class="at === liveIndex ? 'bg-error text-white' : 'bg-black/70 text-white'"
                    aria-hidden="true"
                  >{{ s.index + 1 }}</span>
                </button>
              </li>
            </ol>
            <span class="sr-only" aria-live="polite">
              {{ (live?.index ?? 0) + 1 }} / {{ liveEntry?.screens.length ?? 0 }}
            </span>
            <button
              v-if="nextUp"
              type="button"
              class="shrink-0 flex max-w-72 items-center gap-2.5 rounded-xl bg-elevated/60 py-1.5 ps-1.5 pe-3 text-start ring-1 ring-default hover:ring-primary"
              :aria-label="`Lo que sigue: ${nextUp.s.itemId !== live?.itemId ? entries[nextUp.s.itemIndex]?.label : `pantalla ${nextUp.s.index + 1}`}`"
              @click="next"
            >
              <span class="w-24 shrink-0 overflow-hidden rounded-md outline-2 outline-dashed outline-offset-1 outline-primary"><CultoScreen :screen="nextUp.s.screen" /></span>
              <span class="min-w-0">
                <span class="block text-[0.68rem] font-semibold uppercase tracking-wider opacity-60 whitespace-nowrap">Lo que sigue <UKbd value="→" size="sm" /></span>
                <span class="flex items-center gap-1.5 text-sm font-semibold">
                  <template v-if="nextUp.s.itemId !== live?.itemId">
                    <CultoMomentTile v-if="entries[nextUp.s.itemIndex]" :item="entries[nextUp.s.itemIndex]!.item" size="sm" />
                    <span class="truncate">{{ entries[nextUp.s.itemIndex]?.label }}</span>
                  </template>
                  <span v-else>Pantalla {{ nextUp.s.index + 1 }}</span>
                </span>
              </span>
            </button>
            <p v-else class="shrink-0 text-sm opacity-70">
              Es la última pantalla del culto.
            </p>
          </div>
        </CultoPanel>
      </div>

      <aside class="flex flex-col gap-3 min-w-0 min-h-0 lg:overflow-y-auto soft-scrollbar" aria-label="Culto">
        <CultoPanel title="Hora" icon="i-tabler-clock" body-class="flex items-baseline justify-between gap-3 px-4 py-3">
          <span class="text-4xl font-semibold tabular-nums leading-none">{{ clock }}</span>
          <span class="text-sm text-muted">{{ elapsed }}</span>
        </CultoPanel>

        <CultoPanel
          v-if="liveEntry?.item.notes"
          title="Notas para quien dirige"
          icon="i-tabler-notes"
          body-class="px-4 py-3"
        >
          <p class="border-s-2 border-primary ps-3 text-lg leading-snug whitespace-pre-line">
            {{ liveEntry.item.notes }}
          </p>
        </CultoPanel>

        <CultoPanel
          :title="quick ? 'Proyectados' : 'Orden del culto'"
          icon="i-tabler-list-numbers"
          class="lg:flex-1 lg:min-h-0"
          body-class="p-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto soft-scrollbar"
        >
          <template #meta>
            {{ (live?.itemIndex ?? 0) + 1 }} de {{ entries.length }}
          </template>
          <nav aria-label="Orden del culto" class="flex flex-col gap-1">
            <template v-for="block in orderBlocks" :key="block.kind === 'item' ? block.item.id : `s:${block.section.id}`">
              <p v-if="block.kind === 'section'" class="mt-2 px-3 text-[0.7rem] font-bold uppercase tracking-wider text-(--m-label)" :class="`moment--${momentTone(block.section.moment)}`">
                {{ block.section.title }}
              </p>
              <div :class="block.kind === 'section' ? ['ms-2 border-s-2 border-(--m-seg) ps-1 flex flex-col gap-1', `moment--${momentTone(block.section.moment)}`] : 'contents'">
                <div
                  v-for="{ entry, index: i } in (block.kind === 'item' ? [block.item] : block.items)"
                  :key="entry.item.id"
                  class="order-fix-row group relative"
                >
                  <button
                    type="button"
                    class="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-start text-sm"
                    :class="[
                      entry.item.id === live?.itemId ? 'bg-primary/15 font-semibold' : 'hover:bg-elevated',
                      i < (live?.itemIndex ?? 0) ? 'opacity-55' : '',
                    ]"
                    :aria-current="entry.item.id === live?.itemId ? 'step' : undefined"
                    :disabled="!entry.screens.length"
                    @click="goToItem(entry.item.id)"
                  >
                    <span class="w-5 text-xs tabular-nums opacity-60">{{ i + 1 }}</span>
                    <CultoMomentTile :item="entry.item" size="sm" />
                    <span class="flex-1 min-w-0 truncate">{{ entry.item.kind === 'hymn' ? entry.label.replace(`${entry.item.songId} · `, '') : entry.label }}</span>
                    <UIcon
                      v-if="entry.status === 'error'"
                      name="i-tabler-alert-triangle"
                      class="size-4 text-warning"
                      :aria-label="entry.error"
                    />
                    <span v-else class="text-xs opacity-60">{{ entry.item.inserted && !quick ? 'insertado' : entry.screens.length }}</span>
                  </button>
                  <UButton
                    v-if="canFix(entry.item)"
                    color="neutral"
                    variant="soft"
                    size="xs"
                    square
                    icon="i-tabler-pencil"
                    class="order-fix absolute end-1.5 top-1/2 -translate-y-1/2"
                    :aria-label="`Corregir la cita de ${entry.label}`"
                    title="Corregir la cita"
                    @click="fix(entry.item.id)"
                  />
                </div>
              </div>
            </template>
          </nav>
          <template #footer>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-tabler-player-stop"
              :label="quick ? 'Terminar la proyección' : 'Terminar el culto'"
              class="-mx-2"
              @click="endService"
            />
          </template>
        </CultoPanel>
      </aside>
    </main>

    <CultoInsertDialog v-model:open="showInsert" @insert="insert" />
    <CultoFixReference
      v-model:open="showFix"
      :entry="fixEntry"
      :on-air="!!fixEntry && fixEntry.item.id === live?.itemId && !showLogo"
      @apply="applyFix"
    />
    <AppGoToHymn
      v-model:open="showGoTo"
      :heading="quick ? 'Proyectar un himno' : 'Proyectar un himno ahora'"
      action-label="Proyectar"
      @go="insertHymn"
    />
    <AppShortcutsHelp v-model:open="showHelp" :groups="shortcutGroups" />
  </div>
</template>

<style>
/* The pencil of a row in the order: shown on hover or focus, always on touch. */
@media (hover: hover) {
  .order-fix-row .order-fix {
    opacity: 0;
  }
  .order-fix-row:hover .order-fix,
  .order-fix-row:focus-within .order-fix {
    opacity: 1;
  }
}
.live-wrap {
  position: relative;
}
/* The live screen as large as the room left allows, always 16:9. */
.live-fit {
  width: 100%;
}
@media (min-width: 1024px) {
  .live-fit-box {
    container-type: size;
  }
  .live-fit {
    width: min(100cqw, 100cqh * 16 / 9);
  }
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
