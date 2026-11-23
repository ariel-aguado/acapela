<script lang="ts" setup>
// "Lista del culto": the hymns planned for a service, in order. Built here or
// from the reader / console, projected in order (N / P in the console) and
// shared as a link.
const presentation = usePresentationStore();
const songStore = useSongStore();
const { songs } = storeToRefs(songStore);
const { show: toast } = useUndoToast();

const showAdd = ref(false);
const titleDraft = ref(presentation.title);
watch(() => presentation.title, t => (titleDraft.value = t));

const rows = computed(() =>
  presentation.items.map((id, i) => ({
    id,
    index: i,
    title: songs.value[id - 1]?.title ?? "",
  })),
);

function saveTitle() {
  presentation.title = titleDraft.value;
}

function add(id: number) {
  if (presentation.has(id)) {
    toast(`El ${id} ya está en la lista`);
    return;
  }
  presentation.add(id);
  toast(`Agregado el ${id} a la lista`, { label: "Deshacer", run: () => presentation.remove(id) });
}

function remove(id: number) {
  const before = presentation.items.slice();
  presentation.remove(id);
  toast(`Quitado el ${id} de la lista`, {
    label: "Deshacer",
    run: () => presentation.replace({ title: presentation.title, items: before }),
  });
}

function clearAll() {
  const before = presentation.items.slice();
  presentation.replace({ title: presentation.title, items: [] });
  toast("Lista vaciada", {
    label: "Deshacer",
    run: () => presentation.replace({ title: presentation.title, items: before }),
  });
}

async function share() {
  const url = presentation.shareUrl(window.location.origin);
  const text = `${presentation.title}: ${presentation.items.join(", ")}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: presentation.title, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast("Enlace copiado. Pégalo en un mensaje para compartir la lista.");
  }
  catch (err) {
    // The user closed the share sheet: nothing to report.
    if ((err as DOMException)?.name === "AbortError")
      return;
    toast("No se pudo compartir. Copia el enlace desde la barra de direcciones.");
  }
}

function project() {
  const first = presentation.items[0];
  if (first)
    songStore.songId = first;
  navigateTo("/fullscreen");
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <label for="setlist-title" class="text-sm font-medium">Nombre de la lista</label>
      <input
        id="setlist-title"
        v-model="titleDraft"
        type="text"
        class="input w-full"
        maxlength="60"
        placeholder="Por ejemplo: Domingo 29"
        @change="saveTitle"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      >
    </div>

    <ol v-if="rows.length" class="rounded-box border border-base-300 divide-y divide-base-300 overflow-hidden">
      <li v-for="row in rows" :key="row.id" class="flex items-center gap-1 pl-3 pr-1">
        <span class="w-6 text-xs opacity-60 tabular-nums">{{ row.index + 1 }}.</span>
        <button
          type="button"
          class="flex-1 min-w-0 flex items-center gap-3 py-2.5 text-start"
          @click="songStore.navigateToSong(row.id)"
        >
          <span class="w-9 text-end text-lg font-semibold text-primary tabular-nums">{{ row.id }}</span>
          <span class="flex-1 min-w-0 font-semibold leading-snug line-clamp-2">{{ row.title }}</span>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-square h-11 w-11"
          :aria-label="`Subir el ${row.id}`"
          :disabled="row.index === 0"
          @click="presentation.move(row.id, -1)"
        >
          <Icon name="tabler:arrow-up" size="20" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-square h-11 w-11"
          :aria-label="`Bajar el ${row.id}`"
          :disabled="row.index === rows.length - 1"
          @click="presentation.move(row.id, 1)"
        >
          <Icon name="tabler:arrow-down" size="20" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-square h-11 w-11"
          :aria-label="`Quitar el ${row.id} de la lista`"
          @click="remove(row.id)"
        >
          <Icon name="tabler:x" size="20" />
        </button>
      </li>
    </ol>
    <div v-else class="rounded-box border border-dashed border-base-300 px-4 py-8 text-center flex flex-col items-center gap-2">
      <Icon
        name="tabler:playlist"
        size="36"
        class="opacity-60"
        aria-hidden="true"
      />
      <p class="font-semibold">
        La lista está vacía
      </p>
      <p class="text-sm opacity-80 max-w-xs">
        Agrega los himnos del culto en orden. También puedes agregarlos mientras lees, con el botón de lista de la cabecera.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn btn-primary h-11" @click="showAdd = true">
        <Icon name="tabler:playlist-add" size="20" />
        Agregar himno
      </button>
      <button
        v-if="rows.length"
        type="button"
        class="btn h-11"
        @click="share"
      >
        <Icon name="tabler:share" size="20" />
        Compartir
      </button>
      <button
        v-if="rows.length"
        type="button"
        class="btn h-11 hidden lg:inline-flex"
        @click="project"
      >
        <Icon name="tabler:presentation" size="20" />
        Proyectar la lista
      </button>
      <button
        v-if="rows.length"
        type="button"
        class="btn btn-ghost h-11 ml-auto"
        @click="clearAll"
      >
        Vaciar lista
      </button>
    </div>

    <AppGoToHymn
      v-model:open="showAdd"
      heading="Agregar a la lista"
      action-label="Agregar"
      @go="add"
    />
  </div>
</template>
