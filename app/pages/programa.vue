<script lang="ts" setup>
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { Program } from "~/utils/culto/program";
import type { Screen } from "~/utils/culto/screens";
import type { CultoItem } from "~~/lib/culto";

import { cultoWhen } from "~/stores/culto";
import { decodeProgram, passageKey } from "~/utils/culto/program";
import { blocksOf } from "~/utils/culto/sections";
import { DEFAULT_THEME } from "~~/lib/culto";

// A service's program, received as a link from the church's group: the
// order, and each element as text to read (the hymn's lyric, the reading,
// what the screens say) or as the screens themselves, as projected. Kept on
// the phone and readable offline; opening a newer link of the same service
// replaces it.
useHead({ title: "Programa del culto" });

const route = useRoute();
const router = useRouter();
const programs = useProgramsStore();
const songStore = useSongStore();
const fontStore = useFontStore();
const { fontSize } = storeToRefs(fontStore);
const { show: toast } = useUndoToast();

const failed = ref(false);
const receiving = ref(false);

async function receiveFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#v"))
    return;
  receiving.value = true;
  const program = await decodeProgram(hash);
  receiving.value = false;
  if (!program) {
    failed.value = true;
    return;
  }
  const { program: kept, replaced, stale } = programs.receive(program);
  // The program is kept: the link's data leaves the address bar.
  await router.replace({
    path: "/programa",
    query: { id: kept.id },
  });
  if (stale)
    toast("Ya tenías una versión más nueva de este programa.");
  else if (replaced)
    toast("Programa actualizado.");
}

const program = computed<Program | null>(() => {
  const id = typeof route.query.id === "string"
    ? route.query.id
    : "";
  return (id && programs.byId(id)) || programs.featured?.program || programs.sorted[0] || null;
});
const others = computed(() => programs.sorted.filter(p => p.id !== program.value?.id));

const items = computed(() => program.value?.items ?? []);
const { entries } = useCultoScreens(items, {
  theme: () => program.value?.theme ?? DEFAULT_THEME,
  passages: () => program.value?.passages ?? {},
});
const byId = computed(() => new Map(entries.value.map(e => [e.item.id, e])));
const blocks = computed(() => blocksOf(items.value, program.value?.sections ?? []));

/** Text to read or the screens as projected; kept for next time. */
const view = useLocalStorage<"text" | "screens">("programView", "text");

/** A hymn's chorus is projected after every stanza: read once. */
function textScreens(entry: ItemScreens): Screen[] {
  const seen = new Set<string>();
  return entry.screens.filter((s) => {
    if (s.type !== "lyric")
      return true;
    if (seen.has(s.slide.html))
      return false;
    seen.add(s.slide.html);
    return true;
  });
}

/** A reading reads as one text, verse by verse, as it came with the program. */
function passageOf(item: CultoItem) {
  return item.kind === "reading"
    ? program.value?.passages[passageKey(item.reference, item.versionId || undefined)] ?? null
    : null;
}

function jump(id: string) {
  document.getElementById(`p-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function removeProgram(p: Program) {
  const copy = JSON.parse(JSON.stringify(p)) as Program;
  programs.remove(p.id);
  toast(`Se quitó «${p.title}».`, {
    label: "Deshacer",
    run: () => programs.receive(copy),
  });
}

onMounted(() => {
  songStore.getSongs();
  receiveFromHash();
});
</script>

<template>
  <div class="page-scroll">
    <div class="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-4">
      <div v-if="receiving" class="flex justify-center py-16">
        <UIcon name="i-tabler-loader-2" class="size-10 animate-spin text-primary" aria-label="Abriendo el programa" />
      </div>

      <div v-else-if="failed && !program" class="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <AppEmptyIllustration class="w-36" />
        <p class="text-lg font-bold">
          Este enlace no se pudo abrir
        </p>
        <p class="text-muted">
          Puede que se haya cortado al copiarlo. Pide que lo compartan de nuevo.
        </p>
      </div>

      <div v-else-if="!program" class="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <AppEmptyIllustration class="w-36" />
        <p class="text-lg font-bold">
          Aún no tienes el programa de un culto
        </p>
        <p class="max-w-md text-muted">
          Cuando tu iglesia comparta el enlace del programa en el grupo, ábrelo: aparecerá aquí y podrás seguir el culto desde el teléfono, también sin conexión.
        </p>
      </div>

      <template v-else>
        <header class="program-head rounded-3xl px-5 py-5 text-white">
          <p v-if="program.theme.churchName" class="text-sm font-semibold text-[#f4b740]">
            {{ program.theme.churchName }}
          </p>
          <h1 class="font-lyric text-[1.75rem] leading-tight font-bold">
            {{ program.title }}
          </h1>
          <p class="text-white/75 first-letter:uppercase">
            {{ cultoWhen(program) }}
          </p>
          <p class="mt-1 text-sm text-white/60">
            {{ items.length }} {{ items.length === 1 ? "elemento" : "elementos" }}
          </p>
        </header>

        <div class="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-(--app-canvas)/90 px-4 py-2 backdrop-blur">
          <div class="flex rounded-full bg-elevated p-1" role="tablist" aria-label="Cómo verlo">
            <button
              v-for="v in [{ id: 'text', label: 'Texto', icon: 'i-tabler-align-left' }, { id: 'screens', label: 'Pantallas', icon: 'i-tabler-presentation' }]"
              :key="v.id"
              type="button"
              role="tab"
              class="flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition-colors"
              :class="view === v.id ? 'bg-default text-highlighted shadow-sm' : 'text-muted'"
              :aria-selected="view === v.id"
              @click="view = v.id as 'text' | 'screens'"
            >
              <UIcon :name="v.icon" class="size-4" />
              {{ v.label }}
            </button>
          </div>
          <nav class="program-map flex gap-1.5 overflow-x-auto pb-1" aria-label="Orden del culto">
            <button
              v-for="entry in entries"
              :key="`m-${entry.item.id}`"
              type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-full bg-elevated py-1 ps-1 pe-3 text-sm font-medium"
              @click="jump(entry.item.id)"
            >
              <CultoMomentTile :item="entry.item" size="sm" />
              <span class="max-w-40 truncate">{{ entry.item.kind === 'hymn' ? entry.item.songId : entry.label }}</span>
            </button>
          </nav>
        </div>

        <template v-for="block in blocks" :key="block.kind === 'section' ? block.section.id : block.item.id">
          <h2 v-if="block.kind === 'section'" class="-mb-2 px-1 text-sm font-bold text-muted">
            {{ block.section.title }}
          </h2>
          <template v-for="item in block.kind === 'section' ? block.items : [block.item]" :key="item.id">
            <article
              v-if="byId.get(item.id)"
              :id="`p-${item.id}`"
              class="program-item scroll-mt-28 rounded-3xl bg-default p-4 shadow-card"
              :data-program-item="item.kind"
            >
              <header class="mb-3 flex items-center gap-3">
                <CultoMomentTile :item="item" />
                <div class="min-w-0 flex-1">
                  <h3 class="truncate font-semibold text-highlighted">
                    {{ byId.get(item.id)!.label }}
                  </h3>
                  <p v-if="passageOf(item)?.version" class="text-xs text-muted">
                    {{ passageOf(item)!.version }}
                  </p>
                </div>
              </header>

              <div v-if="byId.get(item.id)!.status === 'loading' && !byId.get(item.id)!.screens.length" class="flex justify-center py-6">
                <UIcon name="i-tabler-loader-2" class="size-6 animate-spin text-primary" aria-label="Cargando" />
              </div>
              <p v-else-if="byId.get(item.id)!.status === 'error'" class="text-sm text-muted">
                {{ item.kind === 'reading' ? 'Búscalo en tu Biblia: el texto no vino con el programa.' : byId.get(item.id)!.error }}
              </p>

              <!-- As text -->
              <div
                v-else-if="view === 'text'"
                class="program-text font-lyric"
                :style="{ fontSize: `${Math.max(16, Math.round(fontSize * 0.9))}px` }"
              >
                <p v-if="passageOf(item)" class="program-verses">
                  <span v-for="v in passageOf(item)!.verses.filter(r => r.text.trim())" :key="`${v.chapter}:${v.verse}`">
                    <sup>{{ v.verseRangeEnd ? `${v.verse}-${v.verseRangeEnd}` : v.verse }}</sup>{{ v.text }}
                  </span>
                </p>
                <template v-else>
                  <div v-for="(screen, i) in textScreens(byId.get(item.id)!)" :key="i" class="program-piece">
                    <template v-if="screen.type === 'lyric'">
                      <p class="program-label">
                        {{ screen.slide.label }}
                      </p>
                      <div v-html="screen.slide.html" />
                    </template>
                    <template v-else-if="screen.type === 'page'">
                      <p v-if="screen.eyebrow" class="program-label">
                        {{ screen.eyebrow }}
                      </p>
                      <p v-if="screen.title" class="font-bold">
                        {{ screen.title }}
                      </p>
                      <div v-if="screen.html" class="program-verses" v-html="screen.html" />
                      <p v-if="screen.reference" class="program-label">
                        {{ screen.reference }}
                      </p>
                    </template>
                    <p v-else class="text-sm text-muted">
                      Diapositiva {{ i + 1 }}: se ve en la pantalla del templo.
                    </p>
                  </div>
                </template>
              </div>

              <!-- As projected -->
              <div v-else class="grid gap-2">
                <template v-for="(screen, i) in byId.get(item.id)!.screens" :key="i">
                  <div v-if="screen.type === 'image'" class="grid aspect-video place-items-center rounded-xl bg-elevated text-center text-sm text-muted">
                    Diapositiva {{ i + 1 }}: se ve en la pantalla del templo.
                  </div>
                  <div v-else class="overflow-hidden rounded-xl">
                    <CultoScreen :screen="screen" />
                  </div>
                </template>
              </div>
            </article>
          </template>
        </template>

        <section v-if="others.length" class="flex flex-col gap-2 pt-4" aria-labelledby="p-others">
          <h2 id="p-others" class="px-1 text-sm font-bold text-muted">
            Otros programas
          </h2>
          <div
            v-for="p in others"
            :key="p.id"
            class="flex items-center gap-2 rounded-2xl bg-default py-2 ps-4 pe-2 shadow-card"
          >
            <NuxtLink :to="{ path: '/programa', query: { id: p.id } }" class="min-w-0 flex-1">
              <span class="block truncate font-semibold">{{ p.title }}</span>
              <span class="block truncate text-sm text-muted first-letter:uppercase">{{ cultoWhen(p) }}</span>
            </NuxtLink>
            <UButton
              color="neutral"
              variant="ghost"
              square
              icon="i-tabler-trash"
              :aria-label="`Quitar «${p.title}»`"
              @click="removeProgram(p)"
            />
          </div>
        </section>
        <p class="px-1 pb-2 text-center text-xs text-muted">
          Los programas se guardan en este teléfono y se borran solos dos semanas después del culto.
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.program-head {
  background: #17142b;
}
.program-map {
  scrollbar-width: none;
}
.program-text {
  line-height: var(--reading-line-height, 1.6);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.program-label {
  font-family: var(--font-display, sans-serif);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ui-primary);
  margin-bottom: 0.15rem;
}
.program-verses :deep(sup) {
  font-family: var(--font-display, sans-serif);
  font-size: 0.65em;
  font-weight: 700;
  color: var(--ui-primary);
  margin-inline-end: 0.2em;
}
.program-verses :deep(p) + :deep(p) {
  margin-top: 0.5em;
}
</style>
