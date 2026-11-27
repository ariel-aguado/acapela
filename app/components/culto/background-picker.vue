<script setup lang="ts">
import type { Background } from "~~/lib/culto";

import { importImage, mediaUrl } from "~/utils/culto/media";

// What is behind the text: Acapela's picture, a colour or a picture of the
// church's own. With `inherit`, "Del tema" leaves the element on the theme's.
const props = defineProps<{
  inherit?: boolean;
}>();
const model = defineModel<Background | undefined>();

const SWATCHES = [
  "#1c1b22",
  "#0f2a24",
  "#1d2a44",
  "#3b1f2b",
  "#f0eadc",
  "#ffffff",
];

type Kind = "inherit" | Background["kind"];
const kind = computed<Kind>(() => model.value?.kind ?? (props.inherit
  ? "inherit"
  : "acapela"));

const items = computed(() => [
  ...(props.inherit
    ? [
        { label: "Del tema", value: "inherit" },
      ]
    : []),
  { label: "Imagen de Acapela", value: "acapela" },
  { label: "Color", value: "color" },
  { label: "Imagen propia", value: "image" },
]);

const fileInput = useTemplateRef<HTMLInputElement>("file");
const busy = ref(false);

function setKind(value: Kind) {
  if (value === "inherit") {
    model.value = undefined;
  }
  else if (value === "acapela") {
    model.value = { kind: "acapela" };
  }
  else if (value === "color") {
    model.value = {
      kind: "color",
      color: model.value?.kind === "color"
        ? model.value.color
        : SWATCHES[0]!,
    };
  }
  else if (model.value?.kind !== "image") {
    fileInput.value?.click();
  }
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!file)
    return;
  busy.value = true;
  try {
    model.value = { kind: "image", mediaId: await importImage(file, file.name) };
  }
  finally {
    busy.value = false;
  }
}

const preview = ref<string | null>(null);
watchEffect(async () => {
  preview.value = model.value?.kind === "image"
    ? await mediaUrl(model.value.mediaId)
    : null;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <URadioGroup
      :model-value="kind"
      :items="items"
      orientation="horizontal"
      variant="card"
      size="sm"
      @update:model-value="v => setKind(v as Kind)"
    />
    <div v-if="model?.kind === 'color'" class="flex flex-wrap items-center gap-2">
      <button
        v-for="c in SWATCHES"
        :key="c"
        type="button"
        class="size-9 rounded-full ring-1 ring-default"
        :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-default': model.color === c }"
        :style="{ background: c }"
        :aria-label="`Color ${c}`"
        :aria-pressed="model.color === c"
        @click="model = { kind: 'color', color: c }"
      />
      <label class="size-9 rounded-full ring-1 ring-default grid place-items-center cursor-pointer overflow-hidden relative" title="Otro color">
        <UIcon name="i-tabler-palette" class="size-5 opacity-70" />
        <input
          type="color"
          class="absolute inset-0 opacity-0 cursor-pointer"
          :value="model.color"
          aria-label="Elegir otro color"
          @input="e => model = { kind: 'color', color: (e.target as HTMLInputElement).value }"
        >
      </label>
    </div>
    <div v-if="model?.kind === 'image'" class="flex items-center gap-3">
      <img
        v-if="preview"
        :src="preview"
        alt=""
        class="h-16 aspect-video object-cover rounded-lg ring-1 ring-default"
      >
      <UButton
        size="sm"
        color="neutral"
        variant="outline"
        icon="i-tabler-photo"
        label="Cambiar imagen"
        :loading="busy"
        @click="fileInput?.click()"
      />
    </div>
    <input
      ref="file"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFile"
    >
  </div>
</template>
