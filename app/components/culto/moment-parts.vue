<script lang="ts" setup>
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { MomentPart, ReadingMode, ScreenItem } from "~~/lib/culto";

import { itemLook } from "~/utils/culto/moment";

// A moment's other screens, after its own: the passages read during the
// Lord's supper, the offering's verse, the sermon's references, or a page
// of text. A passage is split into as many screens as it needs; it can be
// replaced by typing or picking another one, and the screens re-flow. They
// are shown in this order, and the screen manager below hides, moves or
// cuts any of them like the moment's own.
const props = defineProps<{ entry: ItemScreens }>();

const culto = useCultoStore();
const bible = useBibleStore();
const { versions } = storeToRefs(bible);
const { show: toast } = useUndoToast();

const item = computed(() => props.entry.item as ScreenItem);
const parts = computed(() => item.value.parts ?? []);
const momentLabel = computed(() => itemLook(item.value).label);

const versionItems = computed(() => versions.value.map(v => ({ label: v.label, value: v.id })));
const modeItems: { label: string; value: ReadingMode }[] = [
  { label: "Ajustar a la pantalla", value: "fit" },
  { label: "Un versículo por pantalla", value: "verse" },
];
const layoutItems = [
  { label: "Título", value: "title" },
  { label: "Cita", value: "quote" },
  { label: "Texto", value: "text" },
];

function update(part: MomentPart, changes: Partial<MomentPart>) {
  culto.updatePart(item.value.id, part.id, changes);
}

async function focusPart(id: string) {
  await nextTick();
  document.querySelector<HTMLInputElement>(`[data-part="${id}"] input, [data-part="${id}"] textarea`)?.focus();
}

function addReading() {
  const part = culto.addPart(item.value.id, culto.newReadingPart("", bible.currentId));
  focusPart(part.id);
}

function addText() {
  const eyebrow = item.value.eyebrow.trim() || momentLabel.value;
  const part = culto.addPart(item.value.id, culto.newTextPart(eyebrow));
  focusPart(part.id);
}

function remove(part: MomentPart) {
  const before = parts.value.slice();
  culto.removePart(item.value.id, part.id);
  toast(part.kind === "reading"
    ? "Se quitó la cita."
    : "Se quitó la pantalla.", {
    label: "Deshacer",
    run: () => culto.updateItem(item.value.id, { parts: before } as Partial<ScreenItem>),
  });
}

function partName(part: MomentPart, index: number) {
  const what = part.kind === "reading"
    ? part.reference.trim() || "cita sin escribir"
    : part.title.trim() || "pantalla de texto";
  return `${index + 1}: ${what}`;
}
</script>

<template>
  <section class="flex flex-col gap-3" aria-labelledby="moment-parts">
    <div class="flex flex-col gap-0.5">
      <h3 id="moment-parts" class="text-sm font-semibold text-highlighted">
        Más pantallas de {{ momentLabel }}
      </h3>
      <p class="text-sm text-muted">
        Citas bíblicas, que se reparten solas en las pantallas que hagan falta, o pantallas de texto. Se proyectan después de esta, en este orden.
      </p>
    </div>

    <ol v-if="parts.length" class="flex flex-col gap-2">
      <li
        v-for="(part, i) in parts"
        :key="part.id"
        :data-part="part.id"
        class="flex flex-col gap-3 rounded-2xl border border-default bg-default p-3"
      >
        <div class="flex items-center gap-2">
          <UIcon
            :name="part.kind === 'reading' ? 'i-tabler-book' : 'i-tabler-text-size'"
            class="size-5 text-muted shrink-0"
          />
          <span class="flex-1 min-w-0 text-sm font-semibold">
            {{ part.kind === 'reading' ? 'Cita bíblica' : 'Pantalla de texto' }}
          </span>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            square
            icon="i-tabler-chevron-up"
            :disabled="i === 0"
            :aria-label="`Subir ${partName(part, i)}`"
            @click="culto.movePart(item.id, part.id, -1)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            square
            icon="i-tabler-chevron-down"
            :disabled="i === parts.length - 1"
            :aria-label="`Bajar ${partName(part, i)}`"
            @click="culto.movePart(item.id, part.id, 1)"
          />
          <UButton
            color="error"
            variant="ghost"
            size="sm"
            square
            icon="i-tabler-trash"
            :aria-label="`Quitar ${partName(part, i)}`"
            @click="remove(part)"
          />
        </div>

        <!-- A passage, split into screens -->
        <template v-if="part.kind === 'reading'">
          <div class="flex flex-wrap gap-3">
            <UFormField label="Cita" class="flex-1 min-w-64">
              <CultoPassagePicker
                :model-value="part.reference"
                :version-id="part.versionId"
                @update:model-value="v => update(part, { reference: v })"
              />
            </UFormField>
            <UFormField label="Versión" class="w-48">
              <USelect
                :model-value="part.versionId || bible.currentId"
                :items="versionItems"
                size="lg"
                class="w-full"
                @update:model-value="v => update(part, { versionId: String(v) })"
              />
            </UFormField>
          </div>
          <URadioGroup
            :model-value="part.mode"
            :items="modeItems"
            orientation="horizontal"
            aria-label="Cómo repartir la cita"
            @update:model-value="v => update(part, { mode: v as ReadingMode })"
          />
          <UAlert
            v-if="entry.partErrors?.[part.id] && part.reference.trim()"
            color="warning"
            variant="subtle"
            icon="i-tabler-alert-triangle"
            :title="entry.partErrors[part.id]"
            description="Las demás pantallas se siguen proyectando."
          />
        </template>

        <!-- A page of text -->
        <template v-else>
          <URadioGroup
            :model-value="part.layout"
            :items="layoutItems"
            orientation="horizontal"
            aria-label="Diseño de la pantalla"
            @update:model-value="v => update(part, { layout: v as 'title' | 'quote' | 'text' })"
          />
          <UFormField label="Etiqueta">
            <UInput
              :model-value="part.eyebrow"
              size="lg"
              class="w-full"
              @update:model-value="v => update(part, { eyebrow: String(v) })"
            />
          </UFormField>
          <UFormField label="Título">
            <UTextarea
              :model-value="part.title"
              :rows="2"
              autoresize
              size="lg"
              class="w-full"
              @update:model-value="v => update(part, { title: String(v) })"
            />
          </UFormField>
          <UFormField label="Referencia o subtítulo">
            <UInput
              :model-value="part.reference"
              size="lg"
              class="w-full"
              @update:model-value="v => update(part, { reference: String(v) })"
            />
          </UFormField>
          <UFormField v-if="part.layout === 'text'" label="Texto" help="Si no cabe, sigue en otras pantallas.">
            <UTextarea
              :model-value="part.body"
              :rows="4"
              autoresize
              size="lg"
              class="w-full"
              @update:model-value="v => update(part, { body: String(v) })"
            />
          </UFormField>
        </template>
      </li>
    </ol>

    <div class="flex flex-wrap gap-2">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-tabler-book"
        label="Cita bíblica"
        @click="addReading"
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="i-tabler-text-size"
        label="Pantalla de texto"
        @click="addText"
      />
    </div>
  </section>
</template>
