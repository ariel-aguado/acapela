<script setup lang="ts">
import type { Background, ScreenMoment } from "~~/lib/culto";

import { GALLERY, galleryThumb } from "~/utils/culto/backgrounds";
import { importImage, mediaUrl } from "~/utils/culto/media";

// What is behind the text: one of Acapela's gallery (the ones for this
// moment first), a colour or a picture of the church's own. With `inherit`,
// "Del tema" leaves the element on the theme's.
const props = defineProps<{
  inherit?: boolean;
  /** The element's moment, to offer its backgrounds first. */
  moment?: ScreenMoment | "reading";
  /** Its name ("Santa Cena"), for the heading of those. */
  momentLabel?: string;
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

type Kind = "inherit" | "gallery" | "color" | "image";
const kind = computed<Kind>(() => {
  const k = model.value?.kind;
  if (!k) {
    return props.inherit
      ? "inherit"
      : "gallery";
  }
  return k === "acapela"
    ? "gallery"
    : k;
});

const items = computed(() => [
  ...(props.inherit
    ? [
        { label: "Del tema", value: "inherit" },
      ]
    : []),
  { label: "Galería", value: "gallery" },
  { label: "Color", value: "color" },
  { label: "Imagen propia", value: "image" },
]);

// The gallery: Acapela's cross and the illustrations, the moment's first.
type Tile = { key: string; label: string; thumb: string; value: Background };
const CROSS: Tile = {
  key: "acapela",
  label: "La cruz al amanecer",
  thumb: "/img/background-fullscreen.webp",
  value: { kind: "acapela" },
};
const tiles = computed(() => {
  const all: Tile[] = GALLERY.map(g => ({
    key: g.id,
    label: g.label,
    thumb: galleryThumb(g.id),
    value: { kind: "gallery", id: g.id },
  }));
  const mine = props.moment
    ? all.filter(t => GALLERY.find(g => g.id === t.key)!.for.includes(props.moment!))
    : [];
  return {
    mine,
    rest: [
      CROSS,
      ...all.filter(t => !mine.includes(t)),
    ],
  };
});
function isChosen(tile: Tile) {
  const v = model.value;
  if (tile.value.kind === "acapela")
    return v?.kind === "acapela" || (!v && !props.inherit);
  return v?.kind === "gallery" && tile.value.kind === "gallery" && v.id === tile.value.id;
}

const fileInput = useTemplateRef<HTMLInputElement>("file");
const busy = ref(false);

function setKind(value: Kind) {
  if (value === "inherit") {
    model.value = undefined;
  }
  else if (value === "gallery") {
    if (model.value?.kind !== "gallery" && model.value?.kind !== "acapela")
      model.value = tiles.value.mine[0]?.value ?? { kind: "acapela" };
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
    <!-- The gallery -->
    <div v-if="kind === 'gallery'" class="flex flex-col gap-3">
      <template v-for="group in [{ name: momentLabel ? `Para ${momentLabel}` : '', list: tiles.mine }, { name: tiles.mine.length ? 'Más fondos' : '', list: tiles.rest }]" :key="group.name">
        <div v-if="group.list.length" class="flex flex-col gap-1.5">
          <p v-if="group.name" class="text-xs font-bold uppercase tracking-wider text-muted">
            {{ group.name }}
          </p>
          <div class="grid grid-cols-3 gap-2" role="radiogroup" :aria-label="group.name || 'Fondos de Acapela'">
            <button
              v-for="tile in group.list"
              :key="tile.key"
              type="button"
              role="radio"
              class="group relative aspect-video overflow-hidden rounded-lg ring-1 ring-default"
              :class="{ 'ring-[3px] ring-primary': isChosen(tile) }"
              :aria-checked="isChosen(tile)"
              :aria-label="tile.label"
              :title="tile.label"
              @click="model = tile.value"
            >
              <img
                :src="tile.thumb"
                alt=""
                loading="lazy"
                class="size-full object-cover transition-transform group-hover:scale-105"
              >
              <UIcon v-if="isChosen(tile)" name="i-tabler-circle-check-filled" class="absolute top-1 right-1 size-5 text-white drop-shadow" />
            </button>
          </div>
        </div>
      </template>
    </div>

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
