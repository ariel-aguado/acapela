<script setup lang="ts">
import type { Culto } from "~~/lib/culto";

import { cultoWhen, partOfDay } from "~/stores/culto";

// Every service saved on this device, to find one and keep them in order:
// a search (name, hymn number, reading, screen title), filters by when and
// by part of the day, grouped by month, by upcoming and past, or by name,
// and sorted. Each one opens, duplicates or is deleted from here. How it
// was last left (filters, grouping, order) is kept.
const emit = defineEmits<{ duplicate: [id: string] }>();
const open = defineModel<boolean>("open", { required: true });

const culto = useCultoStore();
const { sorted, current } = storeToRefs(culto);
const { show: toast } = useUndoToast();

type When = "all" | "upcoming" | "past" | "month";
type Part = "all" | "mañana" | "tarde" | "noche" | "none";
type Group = "month" | "status" | "name" | "none";
type Sort = "date-desc" | "date-asc" | "name" | "edited" | "size";

const view = useLocalStorage("cultoListView", {
  when: "all" as When,
  part: "all" as Part,
  group: "month" as Group,
  sort: "date-desc" as Sort,
}, { mergeDefaults: true });
const query = ref("");

const WHEN_ITEMS = [
  { label: "Todas las fechas", value: "all" },
  { label: "Próximos", value: "upcoming" },
  { label: "Pasados", value: "past" },
  { label: "Este mes", value: "month" },
];
const PART_ITEMS = [
  { label: "Todo el día", value: "all" },
  { label: "Mañana", value: "mañana" },
  { label: "Tarde", value: "tarde" },
  { label: "Noche", value: "noche" },
  { label: "Sin hora", value: "none" },
];
const GROUP_ITEMS = [
  { label: "Por mes", value: "month", icon: "i-tabler-calendar-month" },
  { label: "Próximos y pasados", value: "status", icon: "i-tabler-calendar-time" },
  { label: "Por nombre", value: "name", icon: "i-tabler-abc" },
  { label: "Sin agrupar", value: "none", icon: "i-tabler-list" },
];
const SORT_ITEMS = [
  { label: "Más recientes primero", value: "date-desc" },
  { label: "Más antiguos primero", value: "date-asc" },
  { label: "Nombre (A–Z)", value: "name" },
  { label: "Editados hace poco", value: "edited" },
  { label: "Más elementos", value: "size" },
];

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const todayIso = ref(isoToday());
watch(open, (value) => {
  if (value)
    todayIso.value = isoToday();
});

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** What a search looks in: its name, and what is in it. */
function haystack(c: Culto) {
  const words = [c.title];
  for (const i of c.items) {
    if (i.kind === "hymn")
      words.push(String(i.songId));
    else if (i.kind === "reading")
      words.push(i.reference);
    else words.push(i.title);
  }
  for (const s of c.sections ?? [])
    words.push(s.title);
  return normalize(words.join(" · "));
}

const filtered = computed(() => {
  const q = normalize(query.value.trim());
  const today = todayIso.value;
  const month = today.slice(0, 7);
  const { when, part } = view.value;
  return sorted.value.filter((c) => {
    if (when === "upcoming" && c.date < today)
      return false;
    if (when === "past" && c.date >= today)
      return false;
    if (when === "month" && !c.date.startsWith(month))
      return false;
    if (part !== "all") {
      const p = partOfDay(c.time);
      if (part === "none"
        ? !!p
        : p !== part) {
        return false;
      }
    }
    return !q || haystack(c).includes(q);
  });
});

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
function byDate(a: Culto, b: Culto) {
  return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");
}

const ordered = computed(() => {
  const list = [...filtered.value];
  switch (view.value.sort) {
    case "date-asc":
      return list.sort(byDate);
    case "name":
      return list.sort((a, b) => collator.compare(a.title, b.title) || byDate(b, a));
    case "edited":
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    case "size":
      return list.sort((a, b) => b.items.length - a.items.length || byDate(b, a));
    default:
      return list.sort((a, b) => byDate(b, a));
  }
});

function monthLabel(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const text = new Date(y!, m! - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The groups, in the order the list is sorted in. */
const groups = computed(() => {
  const today = todayIso.value;
  const keyOf = (c: Culto): [string, string] => {
    switch (view.value.group) {
      case "month":
        return [
          c.date.slice(0, 7),
          monthLabel(c.date),
        ];
      case "status":
        return c.date === today
          ? ["0", "Hoy"]
          : c.date > today
            ? ["1", "Próximos"]
            : ["2", "Pasados"];
      case "name":
        return [
          normalize(c.title),
          c.title,
        ];
      default:
        return ["", ""];
    }
  };
  const map = new Map<string, { key: string; label: string; cultos: Culto[] }>();
  for (const c of ordered.value) {
    const [key, label] = keyOf(c);
    if (!map.has(key))
      map.set(key, { key, label, cultos: [] });
    map.get(key)!.cultos.push(c);
  }
  const list = [
    ...map.values(),
  ];
  // Today, then what is ahead, then what is past, whatever the order inside.
  if (view.value.group === "status")
    list.sort((a, b) => a.key.localeCompare(b.key));
  return list;
});

const filtering = computed(() => !!query.value.trim() || view.value.when !== "all" || view.value.part !== "all");
function clearFilters() {
  query.value = "";
  view.value = { ...view.value, when: "all", part: "all" };
}

// ------------------------------------------------------------ one service

function dayTile(c: Culto) {
  const [y, m, d] = c.date.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return {
    day: d,
    weekday: date.toLocaleDateString("es", { weekday: "short" }).replace(".", ""),
    month: date.toLocaleDateString("es", { month: "short" }).replace(".", ""),
  };
}

function contents(c: Culto) {
  const hymns = c.items.filter(i => i.kind === "hymn").length;
  const readings = c.items.filter(i => i.kind === "reading").length;
  const parts = [`${c.items.length} ${c.items.length === 1
    ? "elemento"
    : "elementos"}`];
  if (hymns) {
    parts.push(`${hymns} ${hymns === 1
      ? "himno"
      : "himnos"}`);
  }
  if (readings) {
    parts.push(`${readings} ${readings === 1
      ? "lectura"
      : "lecturas"}`);
  }
  if (c.messages?.length) {
    parts.push(`${c.messages.length} ${c.messages.length === 1
      ? "mensaje"
      : "mensajes"}`);
  }
  return parts.join(" · ");
}

function openCulto(id: string) {
  culto.select(id);
  open.value = false;
}

function removeCulto(c: Culto) {
  // A plain deep copy for «Deshacer»: structuredClone fails on reactive data.
  const copy = JSON.parse(JSON.stringify(c)) as Culto;
  culto.remove(c.id);
  const fresh = culto.sorted.length
    ? null
    : culto.create();
  toast(`Se borró «${copy.title} · ${cultoWhen(copy)}».`, {
    label: "Deshacer",
    run: () => {
      if (fresh)
        culto.remove(fresh.id);
      culto.cultos = [...culto.cultos, copy];
    },
  }, 8000);
}

function menu(c: Culto) {
  return [
    [
      {
        label: "Abrir",
        icon: "i-tabler-folder-open",
        onSelect: () => openCulto(c.id),
      },
      {
        label: "Duplicar…",
        icon: "i-tabler-copy",
        onSelect: () => emit("duplicate", c.id),
      },
    ],
    [
      {
        label: "Borrar",
        icon: "i-tabler-trash",
        color: "error" as const,
        onSelect: () => removeCulto(c),
      },
    ],
  ];
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Todos los cultos"
    :description="`${sorted.length} ${sorted.length === 1 ? 'culto guardado' : 'cultos guardados'} en este dispositivo.`"
    :ui="{ content: 'sm:max-w-4xl', body: 'p-0 sm:p-0' }"
  >
    <template #body>
      <div class="c-list-tools sticky top-0 z-10 flex flex-col gap-2 border-b border-default bg-default px-4 py-3 sm:px-6">
        <UInput
          v-model="query"
          icon="i-tabler-search"
          placeholder="Buscar por nombre, número de himno o lectura"
          aria-label="Buscar cultos"
          class="w-full"
          :ui="{ trailing: 'pe-1' }"
        >
          <template v-if="query" #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              icon="i-tabler-x"
              aria-label="Borrar la búsqueda"
              @click="query = ''"
            />
          </template>
        </UInput>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <USelect
            v-model="view.when"
            :items="WHEN_ITEMS"
            icon="i-tabler-calendar"
            aria-label="Filtrar por fecha"
            class="min-w-0 sm:min-w-40"
          />
          <USelect
            v-model="view.part"
            :items="PART_ITEMS"
            icon="i-tabler-sun-moon"
            aria-label="Filtrar por parte del día"
            class="min-w-0 sm:min-w-36"
          />
          <div class="hidden flex-1 sm:block" />
          <USelect
            v-model="view.group"
            :items="GROUP_ITEMS"
            icon="i-tabler-stack-2"
            aria-label="Agrupar"
            class="min-w-0 sm:min-w-44"
          />
          <USelect
            v-model="view.sort"
            :items="SORT_ITEMS"
            icon="i-tabler-arrows-sort"
            aria-label="Ordenar"
            class="min-w-0 sm:min-w-48"
          />
        </div>
      </div>

      <div class="flex flex-col gap-5 px-4 py-4 sm:px-6">
        <div v-if="!ordered.length" class="flex flex-col items-center gap-3 py-10 text-center">
          <UIcon name="i-tabler-calendar-search" class="size-10 text-muted" />
          <p class="font-semibold">
            Ningún culto coincide
          </p>
          <UButton
            v-if="filtering"
            color="neutral"
            variant="soft"
            label="Quitar filtros"
            @click="clearFilters"
          />
        </div>

        <section
          v-for="group in groups"
          :key="group.key"
          class="flex flex-col gap-2"
          :aria-label="group.label || 'Cultos'"
        >
          <h3 v-if="group.label" class="flex items-center gap-2 text-sm font-semibold text-muted">
            {{ group.label }}
            <span class="rounded-full bg-elevated px-2 text-xs tabular-nums">{{ group.cultos.length }}</span>
          </h3>
          <div
            v-for="c in group.cultos"
            :key="c.id"
            class="c-list-row flex items-center gap-3 rounded-xl px-2 py-2 ring-1 ring-default"
            :class="{ 'c-list-row--on': c.id === current?.id, 'c-list-row--past': c.date < todayIso }"
            :data-culto-id="c.id"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-start"
              :aria-label="`Abrir «${c.title}», ${cultoWhen(c)}`"
              @click="openCulto(c.id)"
            >
              <span class="c-list-day" aria-hidden="true">
                <span class="c-list-day__wd">{{ dayTile(c).weekday }}</span>
                <span class="c-list-day__d tabular-nums">{{ dayTile(c).day }}</span>
                <span class="c-list-day__m">{{ dayTile(c).month }}</span>
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="truncate font-semibold">{{ c.title }}</span>
                  <UBadge
                    v-if="c.id === current?.id"
                    size="sm"
                    variant="soft"
                    label="Abierto"
                    class="shrink-0"
                  />
                  <UBadge
                    v-else-if="c.date === todayIso"
                    size="sm"
                    color="warning"
                    variant="soft"
                    label="Hoy"
                    class="shrink-0"
                  />
                </span>
                <span class="text-sm text-muted first-letter:uppercase sm:truncate">{{ cultoWhen(c) }}</span>
                <span class="truncate text-xs text-dimmed">{{ contents(c) }}</span>
              </span>
            </button>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-tabler-copy"
              class="hidden sm:inline-flex"
              label="Duplicar"
              @click="emit('duplicate', c.id)"
            />
            <UDropdownMenu :items="menu(c)">
              <UButton
                color="neutral"
                variant="ghost"
                square
                icon="i-tabler-dots"
                :aria-label="`Más opciones de «${c.title}»`"
              />
            </UDropdownMenu>
          </div>
        </section>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.c-list-row {
  transition: background 0.15s;
}
.c-list-row:hover {
  background: var(--ui-bg-elevated);
}
.c-list-row--on {
  --tw-ring-color: var(--ui-primary);
  background: color-mix(in oklab, var(--ui-primary) 6%, transparent);
}
.c-list-row--past .c-list-day {
  opacity: 0.6;
}
.c-list-day {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 3.25rem;
  padding: 0.25rem 0;
  border-radius: 0.75rem;
  background: var(--ui-bg-elevated);
  line-height: 1.1;
}
.c-list-day__wd,
.c-list-day__m {
  font-size: 0.6875rem;
  text-transform: uppercase;
  color: var(--ui-text-muted);
  letter-spacing: 0.04em;
}
.c-list-day__d {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ui-text-highlighted);
}
</style>
