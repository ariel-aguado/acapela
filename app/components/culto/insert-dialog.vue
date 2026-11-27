<script setup lang="ts">
import type { CultoItem } from "~~/lib/culto";

// Live insertion during the service: type a hymn number, a Bible reference
// or any text, choose where it goes, Enter. Whatever is typed is understood
// in every way it can be (12 → hymn 12, or the text "12"), the likeliest
// first.
export type InsertWhere = "now" | "next" | "end";

const emit = defineEmits<{ (e: "insert", item: CultoItem, where: InsertWhere): void }>();
const open = defineModel<boolean>("open", { required: true });
const culto = useCultoStore();
const bible = useBibleStore();
const songbook = useSongbookStore();
const { songs } = storeToRefs(useSongStore());

const text = ref("");
const where = ref<InsertWhere>("now");
const choice = ref(0);

type Option = { kind: string; label: string; detail: string; make: () => CultoItem };
const readingOptions = ref<Option[]>([]);

// The Bible readings of what is typed (async: the book index is in the
// worker), as SúperBiblia's "Ir a": every valid passage it can be, the
// likeliest first ("jn123" → Juan 1:23, Juan 12:3).
watchDebounced(text, async (value) => {
  readingOptions.value = [];
  const typed = value.trim();
  if (!typed || /^\d+$/.test(typed) || typed.includes("\n") || typed.length > 40)
    return;
  try {
    const list = await bible.predict(typed);
    if (typed !== text.value.trim())
      return;
    const version = bible.versions.find(v => v.id === bible.currentId)?.label ?? "";
    readingOptions.value = list.filter(s => !s.isBook).slice(0, 3).map(s => ({
      kind: "Lectura",
      label: s.label,
      detail: version,
      make: () => culto.newReading(s.label, bible.currentId, { inserted: true }),
    }));
  }
  catch {
    // No Bibles on this site: only hymns and text.
  }
}, { debounce: 150 });

const options = computed<Option[]>(() => {
  const typed = text.value.trim();
  if (!typed)
    return [];
  const list: Option[] = [];
  if (/^\d+$/.test(typed)) {
    const n = Number(typed);
    const song = songs.value[n - 1];
    if (song) {
      list.push({
        kind: "Himno",
        label: `${n} · ${song.title}`,
        detail: songbook.currentSongbook?.name ?? "",
        make: () => culto.newHymn(songbook.currentId, n, { inserted: true }),
      });
    }
  }
  list.push(...readingOptions.value);
  const lines = typed.split("\n");
  list.push({
    kind: "Texto",
    label: lines[0]!.length > 60
      ? `${lines[0]!.slice(0, 60)}…`
      : lines[0]!,
    detail: "Se reparte en las pantallas que haga falta",
    make: () => culto.newScreen(undefined, { body: typed, inserted: true }),
  });
  return list;
});

watch(options, () => {
  if (choice.value >= options.value.length)
    choice.value = 0;
});

watch(open, (isOpen) => {
  if (isOpen) {
    text.value = "";
    choice.value = 0;
    where.value = "now";
    if (!bible.loaded)
      bible.refresh();
  }
});

function submit() {
  const option = options.value[choice.value];
  if (!option)
    return;
  emit("insert", option.make(), where.value);
  open.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
  else if (e.key === "ArrowDown" && options.value.length) {
    e.preventDefault();
    choice.value = (choice.value + 1) % options.value.length;
  }
  else if (e.key === "ArrowUp" && options.value.length) {
    e.preventDefault();
    choice.value = (choice.value - 1 + options.value.length) % options.value.length;
  }
}

const whereItems: { label: string; description: string; value: InsertWhere }[] = [
  { label: "Ahora", description: "y volver aquí", value: "now" },
  { label: "Después de este elemento", description: "sin mostrarlo todavía", value: "next" },
  { label: "Al final", description: "del culto", value: "end" },
];
</script>

<template>
  <UModal
    v-model:open="open"
    title="Insertar"
    description="Un número de himno, una cita (Jn 3:16, Sal 46:1-7) o cualquier texto."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div v-scroll-fade.parent class="flex flex-col gap-4">
        <UTextarea
          v-model="text"
          :rows="1"
          autoresize
          :maxrows="6"
          size="xl"
          autofocus
          placeholder="12, jn 3:16, Oremos por…"
          class="w-full"
          aria-label="Qué insertar"
          :ui="{ base: 'pe-10', trailing: 'items-start pt-2' }"
          @keydown="onKeydown"
        >
          <template v-if="text" #trailing>
            <AppClearButton label="Borrar" @clear="text = ''" />
          </template>
        </UTextarea>

        <ul
          v-if="options.length"
          class="flex flex-col gap-1"
          role="listbox"
          aria-label="Qué es"
        >
          <li
            v-for="(o, i) in options"
            :key="o.kind + o.label"
            role="option"
            :aria-selected="i === choice"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer"
            :class="i === choice ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'"
            @click="choice = i"
          >
            <UBadge color="neutral" variant="soft" :label="o.kind" />
            <span class="flex-1 min-w-0 flex flex-col">
              <span class="font-semibold truncate">{{ o.label }}</span>
              <span v-if="o.detail" class="text-xs opacity-70 truncate">{{ o.detail }}</span>
            </span>
          </li>
        </ul>

        <URadioGroup
          v-model="where"
          :items="whereItems"
          legend="Dónde"
          orientation="horizontal"
          variant="card"
        />
      </div>
    </template>
    <template #footer>
      <div class="w-full flex items-center justify-between gap-3">
        <span class="text-xs opacity-70 hidden sm:inline">
          <UKbd value="↵" /> insertar · <UKbd value="↑" /> <UKbd value="↓" /> elegir · <UKbd value="⇧" /><UKbd value="↵" /> nueva línea
        </span>
        <UButton
          size="lg"
          label="Insertar"
          :disabled="!options.length"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
