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

// One row menu open at a time ("⋯": Subir, Bajar, Quitar).
const openMenu = ref<number | null>(null);
const listRef = shallowRef<HTMLElement | null>(null);
onClickOutside(listRef, () => (openMenu.value = null));
onKeyStroke("Escape", () => (openMenu.value = null));

function toggleMenu(id: number) {
  openMenu.value = openMenu.value === id ? null : id;
}

function rowAction(action: () => void) {
  openMenu.value = null;
  action();
}

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

    <ol v-if="rows.length" ref="listRef" class="rounded-box border border-base-300 divide-y divide-base-300">
      <li
        v-for="row in rows"
        :key="row.id"
        class="relative flex items-center gap-1 pl-4 pr-1.5"
      >
        <button
          type="button"
          class="flex-1 min-w-0 flex items-center gap-3 py-3.5 text-start"
          @click="songStore.navigateToSong(row.id)"
        >
          <span class="shrink-0 min-w-11 text-end text-xl font-bold text-primary tabular-nums leading-none">{{ row.id }}</span>
          <span class="min-w-0 text-base font-semibold leading-snug">{{ row.title }}</span>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-circle h-11 w-11 shrink-0"
          :aria-label="`Opciones para el ${row.id}, ${row.title}`"
          aria-haspopup="menu"
          :aria-expanded="openMenu === row.id"
          @click="toggleMenu(row.id)"
        >
          <Icon name="tabler:dots-vertical" size="22" />
        </button>

        <ul
          v-if="openMenu === row.id"
          class="absolute right-2 top-[calc(100%-0.25rem)] z-20 w-56 rounded-2xl bg-base-100 border border-base-300 shadow-xl p-1.5"
          role="menu"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              class="row-menu-item"
              :disabled="row.index === 0"
              @click="rowAction(() => presentation.move(row.id, -1))"
            >
              <Icon name="tabler:arrow-up" size="20" aria-hidden="true" />
              Subir
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              class="row-menu-item"
              :disabled="row.index === rows.length - 1"
              @click="rowAction(() => presentation.move(row.id, 1))"
            >
              <Icon name="tabler:arrow-down" size="20" aria-hidden="true" />
              Bajar
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              class="row-menu-item text-error"
              @click="rowAction(() => remove(row.id))"
            >
              <Icon name="tabler:x" size="20" aria-hidden="true" />
              Quitar de la lista
            </button>
          </li>
        </ul>
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

<style scoped>
.row-menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.75rem;
  text-align: start;
}
.row-menu-item:hover:not(:disabled),
.row-menu-item:focus-visible {
  background: var(--color-base-200);
  outline: none;
}
.row-menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
