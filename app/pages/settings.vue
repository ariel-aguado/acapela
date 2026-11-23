<script lang="ts" setup>
const songbookStore = useSongbookStore();
const { manifest, currentId } = storeToRefs(songbookStore);
const { status } = useSongbookWorker();
const { canInstall, install, isInstalled } = usePwaInstall();

// Favorites are kept per songbook; read the stored map directly so each
// songbook shows its own count, not the current one's.
const favoritesBySongbook = useLocalStorage<Record<string, number[]>>("favoritesBySongbook", {});

const isIos = import.meta.client && /iphone|ipad|ipod/i.test(navigator.userAgent);

async function choose(id: string) {
  if (id === currentId.value || status.value === "loading")
    return;
  await songbookStore.selectSongbook(id);
}

function favCount(id: string) {
  return favoritesBySongbook.value[id]?.length ?? 0;
}
</script>

<template>
  <div class="page-scroll">
    <div class="w-full max-w-2xl mx-auto px-4 py-4 flex flex-col gap-8">
      <!-- Himnario -->
      <fieldset class="flex flex-col gap-2">
        <legend class="font-medium mb-2">
          Himnario
        </legend>
        <div class="rounded-box border border-base-300 divide-y divide-base-300 overflow-hidden" role="radiogroup">
          <label
            v-for="sb in manifest"
            :key="sb.id"
            class="flex items-center gap-3 px-4 min-h-16 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:-outline-offset-2"
            :class="{ 'bg-primary/5': sb.id === currentId }"
          >
            <input
              type="radio"
              name="songbook"
              class="radio radio-primary"
              :value="sb.id"
              :checked="sb.id === currentId"
              :disabled="status === 'loading'"
              @change="choose(sb.id)"
            >
            <span class="flex-1 flex flex-col">
              <span class="font-semibold">{{ sb.name }}</span>
              <span class="text-sm opacity-70">
                <template v-if="sb.count">{{ sb.count }} himnos</template>
                <template v-if="favCount(sb.id)"> · {{ favCount(sb.id) }} {{ favCount(sb.id) === 1 ? 'favorito' : 'favoritos' }}</template>
              </span>
            </span>
            <span v-if="status === 'loading' && sb.id === currentId" class="loading loading-spinner loading-sm" aria-label="Cargando" />
          </label>
        </div>
        <p class="text-sm opacity-70">
          Tus favoritos y el último himno abierto se guardan por separado en cada himnario.
        </p>
      </fieldset>

      <!-- Apariencia: the same two controls as the reading view's panel -->
      <section class="flex flex-col gap-4" aria-labelledby="s-appearance">
        <h2 id="s-appearance" class="font-medium">
          Apariencia
        </h2>
        <div class="rounded-box border border-base-300 p-4 flex flex-col gap-6">
          <AppFontSizeControl />
          <AppThemeControl />
        </div>
      </section>

      <!-- App -->
      <section class="flex flex-col gap-2" aria-labelledby="s-app">
        <h2 id="s-app" class="font-medium">
          Aplicación
        </h2>
        <div class="rounded-box border border-base-300 divide-y divide-base-300 overflow-hidden">
          <div class="flex items-center gap-3 px-4 min-h-16 py-3">
            <Icon
              name="tabler:download"
              size="22"
              class="opacity-70 shrink-0"
              aria-hidden="true"
            />
            <div class="flex-1 flex flex-col">
              <span class="font-semibold">Instalar en este dispositivo</span>
              <span class="text-sm opacity-70">
                <template v-if="isInstalled">Ya está instalada. Funciona sin conexión.</template>
                <template v-else-if="canInstall">Abre más rápido y funciona sin conexión.</template>
                <template v-else-if="isIos">En Safari, toca <em>Compartir</em> y luego <em>Agregar a pantalla de inicio</em>.</template>
                <template v-else>Abre el menú del navegador y elige <em>Instalar app</em> o <em>Agregar a la pantalla de inicio</em>.</template>
              </span>
            </div>
            <button
              v-if="canInstall && !isInstalled"
              type="button"
              class="btn btn-primary btn-sm h-10"
              @click="install"
            >
              Instalar
            </button>
          </div>
          <NuxtLink to="/about" class="flex items-center gap-3 px-4 min-h-14 hover:bg-base-200">
            <Icon
              name="tabler:info-circle"
              size="22"
              class="opacity-70 shrink-0"
              aria-hidden="true"
            />
            <span class="flex-1 font-semibold">Acerca de Acapela</span>
            <Icon
              name="tabler:chevron-right"
              size="20"
              class="opacity-50"
              aria-hidden="true"
            />
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
