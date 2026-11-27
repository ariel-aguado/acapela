<script setup lang="ts">
import { VueDraggable } from "vue-draggable-plus";

import type { ItemScreens, ManagedScreen } from "~/composables/use-culto-screens";

// The screens of one element, as in SúperBiblia's screen manager: drag to
// change their order, hide one, join it to the previous one, or start a new
// screen inside it. Changes are kept with the element and survive re-flows.
const props = defineProps<{
  entry: ItemScreens;
}>();

const culto = useCultoStore();
const itemId = computed(() => props.entry.item.id);

const hiddenCount = computed(() => props.entry.all.filter(s => s.hidden).length);
const changed = computed(() => {
  const item = props.entry.item;
  return !!(item.screenOrder?.length || item.hidden?.length || (item.breaks && Object.keys(item.breaks).length));
});

function saveOrder(list: ManagedScreen[]) {
  culto.setScreenOrder(itemId.value, list.map(s => s.key));
}

function cutItems(screen: ManagedScreen) {
  return [
    [
      { label: "Empezar una pantalla nueva en:", type: "label" as const },
    ],
    (screen.cuts ?? []).map(cut => ({
      label: cut.label,
      onSelect: () => culto.setBreak(itemId.value, cut.id, true),
    })),
  ];
}

/** Number among the projected screens (hidden ones have none). */
function projectedNumber(screen: ManagedScreen) {
  const visible = props.entry.all.filter(s => !s.hidden);
  return visible.indexOf(screen) + 1;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <VueDraggable
      :model-value="[...entry.all]"
      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
      :animation="150"
      :force-fallback="true"
      :delay="250"
      :delay-on-touch-only="true"
      filter=".screen-actions"
      :prevent-on-filter="false"
      ghost-class="drag-ghost"
      chosen-class="drag-chosen"
      @update:model-value="saveOrder"
    >
      <figure
        v-for="screen in entry.all"
        :key="screen.key"
        class="m-0 flex flex-col gap-1.5 cursor-grab"
      >
        <div class="relative rounded-xl overflow-hidden ring-1 ring-default" :class="{ 'opacity-35 grayscale': screen.hidden }">
          <CultoScreen :screen="screen.screen" />
          <span v-if="screen.hidden" class="absolute inset-0 grid place-items-center text-sm font-bold text-white">
            Oculta
          </span>
        </div>
        <figcaption class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs font-semibold opacity-70 me-auto">
            {{ screen.hidden ? 'No se proyecta' : `Pantalla ${projectedNumber(screen)}` }}
          </span>
          <span class="screen-actions flex flex-wrap gap-1">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              :icon="screen.hidden ? 'i-tabler-eye' : 'i-tabler-eye-off'"
              :label="screen.hidden ? 'Mostrar' : 'Ocultar'"
              @click="culto.toggleHidden(itemId, screen.key)"
            />
            <UButton
              v-if="screen.joinId"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-tabler-arrow-merge-left"
              label="Unir con la anterior"
              @click="culto.setBreak(itemId, screen.joinId, false)"
            />
            <UDropdownMenu v-if="screen.cuts?.length" :items="cutItems(screen)">
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-tabler-separator"
                label="Partir…"
              />
            </UDropdownMenu>
          </span>
        </figcaption>
      </figure>
    </VueDraggable>

    <div class="flex flex-wrap items-center gap-2 text-xs opacity-80">
      <span class="me-auto">
        {{ entry.all.length }} {{ entry.all.length === 1 ? 'pantalla' : 'pantallas' }}<template v-if="hiddenCount">
          · {{ hiddenCount }} {{ hiddenCount === 1 ? 'oculta' : 'ocultas' }}
        </template>
        <template v-if="entry.all.length > 1">
          · arrástralas para cambiar el orden
        </template>
      </span>
      <UButton
        v-if="changed"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-tabler-restore"
        label="Restablecer orden, cortes y ocultas"
        @click="culto.resetScreens(itemId)"
      />
    </div>
  </div>
</template>
