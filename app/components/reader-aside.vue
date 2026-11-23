<script lang="ts" setup>
// Left column of the reader on tablets and computers: the service list and
// every hymn, filterable by number or title, with the open one highlighted.
const props = defineProps<{ current: number }>();
const emit = defineEmits<{ (e: "go", songId: number): void }>();

const { songs } = storeToRefs(useSongStore());
const presentation = usePresentationStore();
const filter = ref("");
const listRef = shallowRef<HTMLElement | null>(null);

const rows = computed(() => {
  const q = normalizeLyric(filter.value);
  const all = songs.value.map(s => ({ id: s.songId, title: s.title }));
  if (!q)
    return all;
  if (/^\d+$/.test(q))
    return all.filter(r => String(r.id).startsWith(q));
  return all.filter(r => normalizeLyric(r.title).includes(q));
});

const setlist = computed(() =>
  presentation.items.map(id => ({ id, title: songs.value[id - 1]?.title ?? "" })),
);

watch(
  () => props.current,
  async (id) => {
    await nextTick();
    listRef.value?.querySelector(`[data-aside-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
  },
  { immediate: true },
);
</script>

<template>
  <aside
    class="w-80 shrink-0 flex-col h-dvh pad-bar-top pad-bar-bottom border-r border-base-300 bg-base-100"
    aria-label="Himnos"
    data-no-autohide
  >
    <div class="p-3 border-b border-base-200">
      <label for="aside-filter" class="sr-only">Filtrar por número o título</label>
      <div class="input w-full flex items-center gap-2">
        <Icon
          name="tabler:filter"
          size="18"
          class="opacity-60"
          aria-hidden="true"
        />
        <input
          id="aside-filter"
          v-model="filter"
          type="search"
          autocomplete="off"
          placeholder="Filtrar por número o título"
          class="flex-1 min-w-0"
        >
      </div>
    </div>
    <div ref="listRef" class="flex-1 overflow-y-auto">
      <section v-if="setlist.length && !filter" aria-labelledby="aside-setlist">
        <h3 id="aside-setlist" class="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wider opacity-70 truncate">
          {{ presentation.title }}
        </h3>
        <ol>
          <li v-for="item in setlist" :key="`s-${item.id}`">
            <button
              type="button"
              class="aside-row"
              :class="{ 'aside-row--on': item.id === current }"
              :aria-current="item.id === current ? 'true' : undefined"
              @click="emit('go', item.id)"
            >
              <span class="aside-row__no">{{ item.id }}</span>
              <span class="truncate">{{ item.title }}</span>
            </button>
          </li>
        </ol>
        <h3 class="px-4 pt-4 pb-1 text-xs font-bold uppercase tracking-wider opacity-70">
          Todos los himnos
        </h3>
      </section>
      <ul>
        <li v-for="row in rows" :key="row.id">
          <button
            type="button"
            class="aside-row"
            :class="{ 'aside-row--on': row.id === current }"
            :data-aside-id="row.id"
            :aria-current="row.id === current ? 'true' : undefined"
            @click="emit('go', row.id)"
          >
            <span class="aside-row__no">{{ row.id }}</span>
            <span class="truncate">{{ row.title }}</span>
          </button>
        </li>
      </ul>
      <p v-if="!rows.length" class="px-4 py-6 text-sm opacity-70">
        Ningún himno coincide con «{{ filter }}».
      </p>
    </div>
  </aside>
</template>

<style scoped>
.aside-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.35rem 1rem;
  text-align: start;
  font-size: 0.9rem;
}
.aside-row:hover {
  background: var(--color-base-200);
}
.aside-row--on {
  background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  font-weight: 700;
}
.aside-row__no {
  width: 2.25rem;
  flex: none;
  text-align: end;
  font-weight: 600;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
</style>
