<script lang="ts" setup>
import type { Program } from "~/utils/culto/program";
import type { RelayNow, RemoteCommand, RemotePrivate } from "~/utils/culto/relay";

import { decodeProgram } from "~/utils/culto/program";
import { fetchRoomProgram, followRemote, followRoom, NotPairedError, sendCommand, unseal } from "~/utils/culto/relay";
import { DEFAULT_THEME } from "~~/lib/culto";

// The presenter's phone as the live console's remote control: what is on
// air and what comes next (as projected), the notes of the element on air
// (encrypted, only this phone reads them), and large buttons: next, back,
// black, logo, the QR, and any element of the order. Paired by the QR of
// «Mando» in the console; the key stays on this phone.
definePageMeta({ bare: true });
useHead({ title: "Mando del culto" });

const route = useRoute();
const router = useRouter();
const songStore = useSongStore();

/** Paired rooms on this phone: code → key. */
const paired = useLocalStorage<Record<string, string>>("mandos", {});
const code = ref("");
const key = computed(() => paired.value[code.value] ?? "");
const unpaired = ref(false);

const program = ref<Program | null>(null);
const onAir = ref<RelayNow | null>(null);
const secret = ref<RemotePrivate | null>(null);
const connected = ref(false);
const loading = ref(true);

const items = computed(() => program.value?.items ?? []);
const { entries, flat } = useCultoScreens(items, {
  theme: () => program.value?.theme ?? DEFAULT_THEME,
  passages: () => program.value?.passages ?? {},
});

const at = computed(() => onAir.value
  ? flat.value.findIndex(f => f.key === onAir.value!.key)
  : -1);
const current = computed(() => flat.value[at.value] ?? null);
const upcoming = computed(() => flat.value[at.value + 1] ?? null);
const logo = computed(() => !!secret.value?.logo);
const black = computed(() => !!onAir.value?.black);
const qrOn = computed(() => !!secret.value?.qr);

function labelOf(itemId: string | undefined) {
  return entries.value.find(e => e.item.id === itemId)?.label ?? "";
}
function screensOf(itemId: string | undefined) {
  return entries.value.find(e => e.item.id === itemId)?.screens.length ?? 0;
}
const notes = computed(() => secret.value && secret.value.itemId === current.value?.itemId
  ? secret.value.notes
  : "");

async function loadProgram() {
  try {
    const found = await fetchRoomProgram(code.value);
    const decoded = found
      ? await decodeProgram(`#${found.program}`)
      : null;
    if (decoded)
      program.value = decoded;
  }
  catch {}
}

const sending = ref<RemoteCommand | null>(null);
async function command(cmd: RemoteCommand, itemId = "") {
  if (!key.value)
    return;
  navigator.vibrate?.(12);
  sending.value = cmd;
  try {
    await sendCommand(code.value, key.value, cmd, itemId);
  }
  catch (err) {
    if (err instanceof NotPairedError)
      unpaired.value = true;
  }
  finally {
    sending.value = null;
  }
}

const showOrder = ref(false);
function goto(itemId: string) {
  showOrder.value = false;
  command("goto", itemId);
}

// The screen stays on while the remote is in use.
let wakeLock: { release: () => Promise<void> } | null = null;
async function keepAwake() {
  try {
    wakeLock = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
  }
  catch {}
}
useEventListener(document, "visibilitychange", () => {
  if (document.visibilityState === "visible") {
    keepAwake();
    command("hello");
  }
});

let stops: (() => void)[] = [];
useIntervalFn(() => {
  if (document.visibilityState === "visible")
    command("hello");
}, 20000);

onMounted(async () => {
  songStore.getSongs();
  const sala = typeof route.query.sala === "string" && /^[A-Z2-9]{6}$/.test(route.query.sala)
    ? route.query.sala
    : "";
  const fromHash = /^#k=(\S{16,128})$/.exec(window.location.hash)?.[1];
  code.value = sala;
  if (sala && fromHash) {
    paired.value = { ...paired.value, [sala]: fromHash };
    // The key leaves the address bar (and the history).
    await router.replace({
      path: "/mando",
      query: { sala },
    });
  }
  if (!code.value || !key.value) {
    loading.value = false;
    return;
  }
  await loadProgram();
  loading.value = false;
  stops = [
    followRoom(code.value, {
      status: value => (connected.value = value),
      now: now => (onAir.value = now),
      program: (rev) => {
        if (!program.value || rev > program.value.rev)
          loadProgram();
      },
    }),
    followRemote(code.value, {
      sealed: async (sealed) => {
        const opened = await unseal<RemotePrivate>(key.value, sealed);
        if (opened)
          secret.value = opened;
      },
      reset: () => (unpaired.value = true),
    }),
  ];
  keepAwake();
  command("hello");
});
onBeforeUnmount(() => {
  stops.forEach(stop => stop());
  wakeLock?.release().catch(() => {});
});
</script>

<template>
  <div class="mando flex min-h-dvh flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] text-white">
    <header class="flex items-center gap-3">
      <AppBrandMark class="size-8 shrink-0 text-[#b9aeff]" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-[#f4b740]">
          Mando del culto
        </p>
        <p class="truncate font-semibold">
          {{ program?.title ?? "Acapela" }}
        </p>
      </div>
      <span
        v-if="key && !unpaired"
        class="inline-flex items-center gap-1.5 text-xs font-semibold"
        :class="connected ? 'text-[#7ee2a8]' : 'text-white/50'"
        role="status"
        data-mando-status
      >
        <span class="size-2 rounded-full" :class="connected ? 'bg-[#7ee2a8]' : 'bg-white/40'" />
        {{ connected ? "Conectado" : "Sin conexión" }}
      </span>
    </header>

    <div v-if="loading" class="grid flex-1 place-items-center">
      <UIcon name="i-tabler-loader-2" class="size-10 animate-spin text-[#b9aeff]" aria-label="Conectando" />
    </div>

    <div v-else-if="!key || unpaired" class="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center" data-mando-unpaired>
      <UIcon name="i-tabler-device-mobile-off" class="size-12 text-[#b9aeff]" />
      <p class="text-lg font-bold">
        {{ unpaired ? "Este teléfono ya no es el mando" : "Este teléfono no es un mando" }}
      </p>
      <p class="max-w-sm text-white/70">
        En la consola en vivo, toca el botón del mando (el teléfono con el engranaje) y escanea el código con este teléfono.
      </p>
    </div>

    <template v-else>
      <!-- On air -->
      <section aria-label="Al aire" class="flex flex-col gap-2">
        <p class="flex min-w-0 items-center gap-2 text-sm">
          <span class="shrink-0 rounded-full bg-[#e5484d] px-2 py-0.5 text-[0.7rem] font-bold">AL AIRE</span>
          <template v-if="current && !black && !logo">
            <span class="truncate font-semibold">{{ labelOf(current.itemId) }}</span>
            <span class="shrink-0 text-white/60">{{ current.index + 1 }}/{{ screensOf(current.itemId) }}</span>
          </template>
        </p>
        <div class="relative overflow-hidden rounded-2xl ring-2 ring-[#e5484d]" data-mando-live>
          <CultoScreen v-if="current && !black && !logo" :screen="current.screen" />
          <div v-else class="grid aspect-video place-items-center bg-black text-sm font-semibold text-white/70">
            {{ black ? "Pantalla en negro" : logo ? "Logo de la iglesia" : "Esperando que empiece el culto" }}
          </div>
        </div>
      </section>

      <!-- Next -->
      <section v-if="upcoming" aria-label="Siguiente" class="flex items-center gap-3 rounded-2xl bg-white/6 p-2">
        <div class="w-32 shrink-0 overflow-hidden rounded-lg">
          <CultoScreen :screen="upcoming.screen" />
        </div>
        <div class="min-w-0 text-sm">
          <p class="text-xs font-semibold text-white/60">
            Siguiente
          </p>
          <p class="line-clamp-2 font-semibold">
            {{ labelOf(upcoming.itemId) }}
          </p>
        </div>
      </section>

      <!-- Notes -->
      <section
        v-if="notes"
        aria-label="Notas"
        class="rounded-2xl bg-[#f4b740]/12 px-4 py-3 text-sm"
        data-mando-notes
      >
        <p class="mb-1 text-xs font-bold text-[#f4b740]">
          Tus notas
        </p>
        <p class="whitespace-pre-line">
          {{ notes }}
        </p>
      </section>

      <div class="flex-1" />

      <div class="grid grid-cols-4 gap-2">
        <button
          type="button"
          class="mando-key"
          :class="{ 'mando-key--on': black }"
          :aria-pressed="black"
          @click="command('black')"
        >
          <UIcon name="i-tabler-device-desktop-off" class="size-5" />Negro
        </button>
        <button
          type="button"
          class="mando-key"
          :class="{ 'mando-key--on': logo }"
          :aria-pressed="logo"
          @click="command('logo')"
        >
          <UIcon name="i-tabler-building-church" class="size-5" />Logo
        </button>
        <button
          type="button"
          class="mando-key"
          :class="{ 'mando-key--on': qrOn }"
          :aria-pressed="qrOn"
          @click="command('qr')"
        >
          <UIcon name="i-tabler-qrcode" class="size-5" />QR
        </button>
        <button type="button" class="mando-key" @click="showOrder = true">
          <UIcon name="i-tabler-list-numbers" class="size-5" />Ir a…
        </button>
      </div>
      <div class="grid grid-cols-[1fr_2fr] gap-2">
        <button
          type="button"
          class="mando-big mando-big--back"
          aria-label="Pantalla anterior"
          @click="command('prev')"
        >
          <UIcon name="i-tabler-arrow-left" class="size-7" />
        </button>
        <button
          type="button"
          class="mando-big mando-big--next"
          aria-label="Siguiente pantalla"
          data-mando-next
          @click="command('next')"
        >
          Siguiente
          <UIcon name="i-tabler-arrow-right" class="size-7" />
        </button>
      </div>
    </template>

    <UModal v-model:open="showOrder" title="Ir a un elemento" :ui="{ content: 'max-h-[85dvh]' }">
      <template #body>
        <ul class="flex flex-col gap-1">
          <li v-for="(entry, i) in entries" :key="entry.item.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start hover:bg-elevated"
              :class="{ 'bg-primary/10': entry.item.id === current?.itemId }"
              @click="goto(entry.item.id)"
            >
              <span class="w-5 text-end text-sm text-muted tabular-nums">{{ i + 1 }}</span>
              <CultoMomentTile :item="entry.item" size="sm" />
              <span class="min-w-0 flex-1 truncate font-medium">{{ entry.label }}</span>
              <span v-if="entry.item.id === current?.itemId" class="text-xs font-bold text-primary">Al aire</span>
            </button>
          </li>
        </ul>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.mando {
  background: #17142b;
}
.mando-key {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.25rem;
  border-radius: 1rem;
  background: rgb(255 255 255 / 0.08);
  font-size: 0.8rem;
  font-weight: 600;
  min-height: 4rem;
}
.mando-key--on {
  background: #f4b740;
  color: #17142b;
}
.mando-big {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 6rem;
  border-radius: 1.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.08s;
}
.mando-big:active,
.mando-key:active {
  transform: scale(0.97);
}
.mando-big--back {
  background: rgb(255 255 255 / 0.1);
}
.mando-big--next {
  background: #4b36c4;
}
</style>
