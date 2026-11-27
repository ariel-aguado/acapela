<script lang="ts" setup>
import type { DropdownMenuItem } from "@nuxt/ui";

import type { ItemScreens } from "~/composables/use-culto-screens";

import { itemLook, rowTitle, spokenLabel } from "~/utils/culto/moment";

// One element in the order of a service: its tile, title and kind, and,
// when chosen, the arrows that move it (NN/g, WCAG 2.2 · 2.5.7: the
// alternative to dragging by the handle, which assistive technology skips).
const props = defineProps<{
  entry: ItemScreens;
  selected: boolean;
  canUp: boolean;
  canDown: boolean;
  /** Class of the drag handle: the order's or a section's list. */
  handle: string;
  /** What can be inserted right after it (its «+», when chosen). */
  insertMenu?: DropdownMenuItem[][];
  /** Just added: lit for a moment. */
  flash?: boolean;
}>();
const emit = defineEmits<{
  choose: [];
  step: [delta: -1 | 1];
}>();

const look = computed(() => itemLook(props.entry.item));
const title = computed(() => rowTitle(props.entry));
const spoken = computed(() => spokenLabel(props.entry));
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-2xl border transition-colors"
    :class="[selected ? 'border-primary bg-primary/10' : 'border-transparent bg-default shadow-card hover:bg-muted', { 'row-flash': flash }]"
  >
    <span
      class="self-stretch flex items-center ps-2 cursor-grab touch-none opacity-50 hover:opacity-100"
      :class="handle"
      aria-hidden="true"
      title="Arrastrar para mover"
    >
      <UIcon name="i-tabler-grip-vertical" class="size-5" />
    </span>
    <button
      type="button"
      class="flex-1 min-w-0 flex items-center gap-3 ps-1 py-2.5 text-start"
      :aria-current="selected ? 'true' : undefined"
      @click="emit('choose')"
    >
      <CultoMomentTile :item="entry.item" />
      <span class="flex-1 min-w-0 flex flex-col">
        <span class="font-semibold text-highlighted truncate">{{ title }}</span>
        <span class="text-xs text-muted truncate">
          <span class="font-semibold text-(--m-label)" :class="`moment--${look.tone}`">{{ look.label }}</span>
          <template v-if="entry.status === 'ready'"> · {{ entry.screens.length }} {{ entry.screens.length === 1 ? 'pantalla' : 'pantallas' }}</template>
          <template v-if="entry.item.inserted"> · insertado en vivo</template>
        </span>
      </span>
      <UIcon
        v-if="entry.status === 'error'"
        name="i-tabler-alert-triangle"
        class="size-5 text-warning shrink-0"
        :aria-label="entry.error"
      />
      <UIcon
        v-else-if="entry.status === 'loading'"
        name="i-tabler-loader-2"
        class="size-4 animate-spin opacity-60 shrink-0"
        aria-label="Preparando"
      />
    </button>
    <UDropdownMenu v-if="selected && insertMenu" :items="insertMenu">
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        square
        icon="i-tabler-plus"
        :aria-label="`Insertar después de: ${spoken}`"
        title="Insertar después de este"
      />
    </UDropdownMenu>
    <div v-if="selected" class="flex flex-col pe-1">
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        square
        icon="i-tabler-chevron-up"
        :disabled="!canUp"
        :aria-label="`Subir: ${spoken}`"
        :data-move-for="entry.item.id"
        data-move="up"
        @click="emit('step', -1)"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        square
        icon="i-tabler-chevron-down"
        :disabled="!canDown"
        :aria-label="`Bajar: ${spoken}`"
        :data-move-for="entry.item.id"
        data-move="down"
        @click="emit('step', 1)"
      />
    </div>
  </div>
</template>
