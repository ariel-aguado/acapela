<script lang="ts" setup>
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { CultoItem, ReadingMode } from "~~/lib/culto";

// Editing an element while the service is live (NN/g: recovering from an
// error is quick and at hand, and nothing changes on the congregation's
// screen without the operator seeing it first): a reading's passage (with
// its live recognition), version and how it is split, or every text of a
// screen; the screens it will give, and how to apply it. A side panel over
// the order, so the screen on air stays in sight.
const props = defineProps<{
  entry: ItemScreens | null;
  /** The element is on air: show it now or when moving on. */
  onAir: boolean;
}>();
const emit = defineEmits<{
  apply: [changes: Partial<CultoItem>, show: "now" | "later" | "none"];
}>();
const open = defineModel<boolean>("open", { required: true });
const bible = useBibleStore();
const { versions } = storeToRefs(bible);
const versionItems = computed(() => versions.value.map(v => ({ label: v.label, value: v.id })));
const modeItems: { label: string; value: ReadingMode }[] = [
  { label: "Ajustar a la pantalla", value: "fit" },
  { label: "Un versículo por pantalla", value: "verse" },
];

/** The fields that can be edited, as the element has them now. */
type Fields = {
  reference: string;
  versionId: string;
  mode: ReadingMode;
  eyebrow: string;
  title: string;
  body: string;
};
const form = reactive<Fields>({
  reference: "",
  versionId: "",
  mode: "fit",
  eyebrow: "",
  title: "",
  body: "",
});

function fieldsOf(item: CultoItem): Fields {
  return {
    reference: item.kind === "reading" || item.kind === "screen"
      ? item.reference
      : "",
    versionId: item.kind === "reading"
      ? item.versionId || bible.currentId
      : "",
    mode: item.kind === "reading"
      ? item.mode ?? "fit"
      : "fit",
    eyebrow: item.kind === "screen"
      ? item.eyebrow
      : "",
    title: item.kind === "screen"
      ? item.title
      : "",
    body: item.kind === "screen"
      ? item.body
      : "",
  };
}

watch([
  open,
  () => props.entry?.item.id,
], () => {
  const item = props.entry?.item;
  if (open.value && item)
    Object.assign(form, fieldsOf(item));
}, { immediate: true });

const isReading = computed(() => props.entry?.item.kind === "reading");
const screen = computed(() => (props.entry?.item.kind === "screen"
  ? props.entry.item
  : null));
/** A screen's long text: only the «Texto» layout shows it, as in the editor. */
const hasBody = computed(() => screen.value?.layout === "text");

/** What differs from the element, trimmed as the editor would keep it. */
const changes = computed<Partial<CultoItem>>(() => {
  const item = props.entry?.item;
  if (!item)
    return {};
  const now = fieldsOf(item);
  const keys: (keyof Fields)[] = item.kind === "reading"
    ? ["reference", "versionId", "mode"]
    : hasBody.value
      ? [
          "eyebrow",
          "title",
          "reference",
          "body",
        ]
      : ["eyebrow", "title", "reference"];
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = key === "body" || key === "title"
      ? form[key].replace(/\s+$/, "")
      : form[key].trim();
    if (value !== now[key])
      out[key] = value;
  }
  return out as Partial<CultoItem>;
});
const changed = computed(() => Object.keys(changes.value).length > 0);

// The screens it will give, measured as on the projector.
const draft = computed<CultoItem[]>(() => (props.entry && open.value
  ? [
      {
        ...props.entry.item,
        ...changes.value,
        id: `${props.entry.item.id}-fix`,
      } as CultoItem,
    ]
  : []));
const { entries: preview } = useCultoScreens(draft);
const previewEntry = computed(() => preview.value[0] ?? null);
const ready = computed(() => changed.value && previewEntry.value?.status === "ready" && previewEntry.value.screens.length > 0);

// Enter in the field takes the reference; the next Enter applies it: the
// button that does is focused as soon as its screens are ready (it stays
// disabled until then). Typing something else drops it.
const focusFor = ref<string | null>(null);
const cta = useTemplateRef<HTMLElement>("cta");
function referenceDone() {
  focusFor.value = form.reference.trim();
}
watch([
  ready,
  focusFor,
], async () => {
  if (!ready.value || focusFor.value === null)
    return;
  if (focusFor.value !== form.reference.trim()) {
    focusFor.value = null;
    return;
  }
  focusFor.value = null;
  await nextTick();
  cta.value?.querySelector<HTMLElement>("[data-cta]")?.focus();
});
// Opens in the first field, with what it holds selected: ready to type over.
const picker = useTemplateRef<{ focus: () => void }>("picker");
const fields = useTemplateRef<HTMLElement>("fields");
watch(open, (isOpen) => {
  focusFor.value = null;
  if (!isOpen)
    return;
  setTimeout(() => {
    if (picker.value) {
      picker.value.focus();
      return;
    }
    const first = fields.value?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    first?.focus();
    first?.select();
  }, 50);
});

const title = computed(() => (isReading.value
  ? "Corregir la cita"
  : "Editar la pantalla"));

function apply(show: "now" | "later" | "none") {
  emit("apply", changes.value, show);
  open.value = false;
}
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    :overlay="false"
    :title="title"
    :description="entry?.label"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div v-if="entry" class="flex flex-col gap-4">
        <template v-if="isReading">
          <UFormField label="Cita" help="Escríbela o elige libro, capítulo y versículos.">
            <CultoPassagePicker
              ref="picker"
              v-model="form.reference"
              :version-id="form.versionId"
              @done="referenceDone"
            />
          </UFormField>
          <UFormField label="Versión">
            <USelect
              v-model="form.versionId"
              :items="versionItems"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Cómo repartir">
            <URadioGroup v-model="form.mode" :items="modeItems" />
          </UFormField>
        </template>
        <div v-else-if="screen" ref="fields" class="flex flex-col gap-4">
          <UFormField label="Etiqueta" help="Arriba, en letra pequeña: «Santa Cena», «Anuncios»…">
            <UInput v-model="form.eyebrow" size="lg" class="w-full" />
          </UFormField>
          <UFormField label="Título">
            <UTextarea
              v-model="form.title"
              :rows="2"
              autoresize
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Referencia o subtítulo">
            <UInput
              v-model="form.reference"
              size="lg"
              class="w-full"
              placeholder="1 Corintios 11:24"
            />
          </UFormField>
          <UFormField v-if="hasBody" label="Texto" help="Si no cabe, sigue en otras pantallas. Una línea en blanco separa párrafos.">
            <UTextarea
              v-model="form.body"
              :rows="5"
              autoresize
              :maxrows="12"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>

        <section class="flex flex-col gap-2" aria-label="Cómo quedará">
          <h3 class="text-xs font-bold uppercase tracking-wider text-muted">
            Cómo quedará
            <template v-if="previewEntry?.status === 'ready'">
              · {{ previewEntry.screens.length }} {{ previewEntry.screens.length === 1 ? 'pantalla' : 'pantallas' }}
            </template>
          </h3>
          <p v-if="previewEntry?.status === 'error'" class="rounded-xl bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
            {{ previewEntry.error }}
          </p>
          <div v-else-if="previewEntry?.status === 'loading'" class="grid aspect-video place-items-center rounded-xl bg-muted">
            <UIcon name="i-tabler-loader-2" class="size-6 animate-spin opacity-60" aria-label="Preparando" />
          </div>
          <ol v-else-if="previewEntry" class="grid grid-cols-2 gap-2">
            <li v-for="(s, i) in previewEntry.screens" :key="i" class="relative overflow-hidden rounded-lg ring-1 ring-default">
              <CultoScreen :screen="s" />
              <span class="absolute bottom-1 left-1 grid h-5 min-w-5 place-items-center rounded-full bg-black/70 px-1 text-[0.68rem] font-bold text-white tabular-nums">{{ i + 1 }}</span>
            </li>
          </ol>
        </section>
      </div>
    </template>
    <template #footer>
      <div ref="cta" class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancelar"
          @click="open = false"
        />
        <template v-if="onAir">
          <UButton
            color="neutral"
            variant="outline"
            label="Aplicar al pasar"
            title="La pantalla actual sigue hasta que avances"
            :disabled="!ready"
            @click="apply('later')"
          />
          <UButton
            data-cta
            icon="i-tabler-broadcast"
            label="Aplicar y mostrar"
            :disabled="!ready"
            @click="apply('now')"
          />
        </template>
        <UButton
          v-else
          data-cta
          icon="i-tabler-check"
          label="Aplicar"
          :disabled="!ready"
          @click="apply('none')"
        />
      </div>
    </template>
  </USlideover>
</template>
