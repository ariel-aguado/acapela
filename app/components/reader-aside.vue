<script lang="ts" setup>
// Left column of the reader on tablets and computers: every hymn, filterable by number or title, with the open one highlighted.
const props = defineProps<{ current: number }>();
const emit = defineEmits<{ (e: "go", songId: number): void }>();

const { songs } = storeToRefs(useSongStore());
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
    class="w-80 shrink-0 flex-col h-dvh pad-bar-top pad-bar-bottom border-r border-default bg-default"
    aria-label="Himnos"
  >
    <div class="p-3 border-b border-muted">
      <label for="aside-filter" class="sr-only">Filtrar por número o título</label>
      <UInput
        id="aside-filter"
        v-model="filter"
        type="search"
        autocomplete="off"
        placeholder="Filtrar por número o título"
        icon="i-tabler-filter"
        size="lg"
        class="w-full"
        :ui="{ trailing: 'pe-1' }"
      >
        <template v-if="filter" #trailing>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-tabler-x"
            aria-label="Borrar filtro"
            @click="filter = ''"
          />
        </template>
      </UInput>
    </div>
    <div ref="listRef" class="flex-1 overflow-y-auto">
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
  background: var(--ui-bg-muted);
}
.aside-row--on {
  background: color-mix(in oklab, var(--ui-primary) 12%, transparent);
  font-weight: 700;
}
.aside-row__no {
  width: 2.25rem;
  flex: none;
  text-align: end;
  font-weight: 600;
  color: var(--ui-primary);
  font-variant-numeric: tabular-nums;
}
</style>
