<script lang="ts" setup>
import type { BiblePassage } from "~/stores/bible";

// Ajustes › Biblias: the versions for projecting readings, which are on
// this device, and a field to try a reference. A version downloads the
// first time it is used (here or when projecting); this only lets it be
// done ahead of time, before going offline, or the space freed.

const bible = useBibleStore();
const { versions, loaded, error, progress, currentId } = storeToRefs(bible);

onMounted(() => {
  if (!loaded.value)
    bible.refresh();
});

function megabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function percent(id: string) {
  const p = progress.value[id];
  if (!p?.total)
    return null;
  return Math.min(100, Math.round(p.loaded / p.total * 100));
}

const failed = ref<Record<string, string>>({});

async function download(id: string) {
  const { [id]: _, ...rest } = failed.value;
  failed.value = rest;
  try {
    await bible.download(id);
  }
  catch (err) {
    failed.value = {
      ...failed.value,
      [id]: err instanceof Error
        ? err.message
        : String(err),
    };
  }
}

const query = ref("");
const result = ref<BiblePassage | null>(null);
const resultMessage = ref("");
const searching = ref(false);

async function tryReference() {
  const text = query.value.trim();
  result.value = null;
  resultMessage.value = "";
  if (!text)
    return;
  searching.value = true;
  try {
    result.value = await bible.passage(text);
    if (!result.value)
      resultMessage.value = "No reconozco esa cita. Prueba con «Juan 3:16» o «Sal 46:1-7».";
  }
  catch (err) {
    resultMessage.value = err instanceof Error
      ? err.message
      : String(err);
  }
  finally {
    searching.value = false;
  }
}
</script>

<template>
  <section v-if="!loaded || versions.length || error" class="flex flex-col gap-2" aria-labelledby="s-bibles">
    <h2 id="s-bibles" class="font-medium">
      Biblias
    </h2>
    <p v-if="error" class="text-sm text-error">
      No se pudo cargar la lista de versiones: {{ error }}
    </p>
    <div v-else class="rounded-2xl bg-default shadow-card divide-y divide-default overflow-hidden">
      <div
        v-for="v in versions"
        :key="v.id"
        class="flex items-center gap-3 px-4 min-h-16 py-3"
      >
        <input
          :id="`bible-${v.id}`"
          type="radio"
          name="bible-version"
          class="size-5 accent-(--ui-primary) shrink-0"
          :checked="v.id === currentId"
          @change="bible.select(v.id)"
        >
        <label :for="`bible-${v.id}`" class="flex-1 flex flex-col cursor-pointer">
          <span class="font-semibold">{{ v.label }}</span>
          <span class="text-sm opacity-70">
            <template v-if="progress[v.id]">
              Descargando… {{ percent(v.id) ?? "" }}{{ percent(v.id) === null
                ? ""
                : " %" }}
            </template>
            <template v-else-if="failed[v.id]">No se pudo descargar: {{ failed[v.id] }}</template>
            <template v-else-if="v.isReady">En este dispositivo · funciona sin conexión</template>
            <template v-else>{{ megabytes(v.sizeBytes) }} · se descarga al usarla</template>
          </span>
          <span
            v-if="progress[v.id]"
            class="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            :aria-valuenow="percent(v.id) ?? undefined"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Descarga de ${v.label}`"
          >
            <span class="block h-full bg-primary transition-[width]" :style="{ width: `${percent(v.id) ?? 0}%` }" />
          </span>
        </label>
        <UButton
          v-if="!v.isReady && !progress[v.id]"
          variant="outline"
          color="neutral"
          icon="i-tabler-download"
          :aria-label="`Descargar ${v.label}`"
          @click="download(v.id)"
        />
        <UButton
          v-else-if="v.isReady"
          variant="ghost"
          color="neutral"
          icon="i-tabler-trash"
          :aria-label="`Borrar ${v.label} de este dispositivo`"
          @click="bible.remove(v.id)"
        />
      </div>
    </div>

    <form class="flex flex-col gap-3 mt-2" @submit.prevent="tryReference">
      <label for="bible-try" class="text-sm opacity-70">Probar una cita</label>
      <div class="flex gap-2">
        <UInput
          id="bible-try"
          v-model="query"
          placeholder="Juan 3:16, sal 46:1-7, 1co13…"
          size="lg"
          class="flex-1"
          autocomplete="off"
        />
        <UButton
          type="submit"
          size="lg"
          label="Ver"
          :loading="searching"
        />
      </div>
      <p v-if="resultMessage" class="text-sm opacity-80">
        {{ resultMessage }}
      </p>
      <blockquote v-if="result" class="rounded-2xl bg-default shadow-card p-4 flex flex-col gap-2">
        <p class="text-sm font-semibold">
          {{ result.label }} <span class="font-normal opacity-70">· {{ versions.find(v => v.id === result!.versionId)?.label }}</span>
        </p>
        <p class="font-lyric leading-relaxed">
          <template v-for="row in result.verses" :key="row.id">
            <sup class="opacity-60 me-0.5">{{ row.verse }}</sup>{{ row.text }}
          </template>
        </p>
      </blockquote>
    </form>
  </section>
</template>
