<script lang="ts" setup>
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { CultoItem } from "~~/lib/culto";

// Correcting a passage while the service is live (NN/g: recovering from an
// error is quick and at hand, and nothing changes on the congregation's
// screen without the operator seeing it first): the passage with its live
// recognition and its version, or a screen's reference, the screens it will
// give, and how to apply it. A side panel over the order, so the screen on
// air stays in sight.
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

const reference = ref("");
const versionId = ref("");
watch([
  open,
  () => props.entry?.item.id,
], () => {
  const item = props.entry?.item;
  if (!open.value || !item)
    return;
  reference.value = item.kind === "reading" || item.kind === "screen"
    ? item.reference
    : "";
  versionId.value = item.kind === "reading"
    ? item.versionId || bible.currentId
    : "";
}, { immediate: true });

const isReading = computed(() => props.entry?.item.kind === "reading");
const changes = computed<Partial<CultoItem>>(() => (isReading.value
  ? {
      reference: reference.value.trim(),
      versionId: versionId.value,
    }
  : {
      reference: reference.value.trim(),
    }) as Partial<CultoItem>);
const changed = computed(() => {
  const item = props.entry?.item;
  if (!item || (item.kind !== "reading" && item.kind !== "screen"))
    return false;
  return item.reference !== reference.value.trim()
    || (item.kind === "reading" && (item.versionId || bible.currentId) !== versionId.value);
});

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
    title="Corregir la cita"
    :description="entry?.label"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div v-if="entry" class="flex flex-col gap-4">
        <UFormField v-if="isReading" label="Cita" help="Escríbela o elige libro, capítulo y versículos.">
          <CultoPassagePicker v-model="reference" :version-id="versionId" />
        </UFormField>
        <UFormField v-if="isReading" label="Versión">
          <USelect
            v-model="versionId"
            :items="versionItems"
            size="lg"
            class="w-full"
          />
        </UFormField>
        <UFormField v-if="!isReading" label="Referencia" help="Bajo el título de la pantalla.">
          <UInput
            v-model="reference"
            size="lg"
            class="w-full"
            placeholder="1 Corintios 11:24"
          />
        </UFormField>

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
      <div class="flex w-full flex-wrap justify-end gap-2">
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
            icon="i-tabler-broadcast"
            label="Aplicar y mostrar"
            :disabled="!ready"
            @click="apply('now')"
          />
        </template>
        <UButton
          v-else
          icon="i-tabler-check"
          label="Aplicar"
          :disabled="!ready"
          @click="apply('none')"
        />
      </div>
    </template>
  </USlideover>
</template>
