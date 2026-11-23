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

const songbookItems = computed(() => manifest.value.map((sb) => {
  const n = favCount(sb.id);
  const parts = [
    sb.count
      ? `${sb.count} himnos`
      : "",
    n
      ? `${n} ${n === 1
        ? "favorito"
        : "favoritos"}`
      : "",
  ].filter(Boolean);
  return {
    label: sb.name,
    value: sb.id,
    description: parts.join(" · "),
  };
}));
</script>

<template>
  <div class="page-scroll">
    <div class="w-full max-w-2xl mx-auto px-4 py-4 flex flex-col gap-8">
      <!-- Himnario -->
      <fieldset class="flex flex-col gap-2">
        <legend class="font-medium mb-2">
          Himnario
        </legend>
        <URadioGroup
          :model-value="currentId"
          :items="songbookItems"
          variant="table"
          size="lg"
          :disabled="status === 'loading'"
          :ui="{ item: 'min-h-16 items-center', label: 'font-semibold' }"
          @update:model-value="v => choose(String(v))"
        >
          <template #label="{ item }">
            <span class="inline-flex items-center gap-2">
              {{ item.label }}
              <UIcon
                v-if="status === 'loading' && item.value === currentId"
                name="i-tabler-loader-2"
                class="size-4 animate-spin"
                aria-label="Cargando"
              />
            </span>
          </template>
        </URadioGroup>
        <p class="text-sm opacity-70">
          Tus favoritos y el último himno abierto se guardan por separado en cada himnario.
        </p>
      </fieldset>

      <!-- Apariencia: the same two controls as the reading view's panel -->
      <section class="flex flex-col gap-4" aria-labelledby="s-appearance">
        <h2 id="s-appearance" class="font-medium">
          Apariencia
        </h2>
        <div class="rounded-2xl border border-default p-4 flex flex-col gap-6">
          <AppFontSizeControl />
          <AppThemeControl />
        </div>
      </section>

      <!-- App -->
      <section class="flex flex-col gap-2" aria-labelledby="s-app">
        <h2 id="s-app" class="font-medium">
          Aplicación
        </h2>
        <div class="rounded-2xl border border-default divide-y divide-default overflow-hidden">
          <div class="flex items-center gap-3 px-4 min-h-16 py-3">
            <AppIcon class="size-10" />
            <div class="flex-1 flex flex-col">
              <span class="font-semibold">Instalar en este dispositivo</span>
              <span class="text-sm opacity-70">
                <template v-if="isInstalled">Ya está instalada. Funciona sin conexión.</template>
                <template v-else-if="canInstall">Abre más rápido y funciona sin conexión.</template>
                <template v-else-if="isIos">En Safari, toca <em>Compartir</em> y luego <em>Agregar a pantalla de inicio</em>.</template>
                <template v-else>Abre el menú del navegador y elige <em>Instalar app</em> o <em>Agregar a la pantalla de inicio</em>.</template>
              </span>
            </div>
            <UButton
              v-if="canInstall && !isInstalled"
              size="lg"
              label="Instalar"
              @click="install"
            />
          </div>
          <NuxtLink to="/about" class="flex items-center gap-3 px-4 min-h-14 hover:bg-muted">
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
