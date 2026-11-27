<script lang="ts" setup>
import type { ReferenceChoice } from "~/composables/use-reference-suggestions";

// The readings of a typed reference (see useReferenceSuggestions), as a
// listbox under its field: the field keeps the focus and moves through them
// with ↑↓ (aria-activedescendant), Enter takes the highlighted one.
defineProps<{
  id: string;
  choices: ReferenceChoice[];
}>();
const emit = defineEmits<{ choose: [choice: ReferenceChoice] }>();
const active = defineModel<number>("active", { required: true });
</script>

<template>
  <ul
    :id="id"
    role="listbox"
    aria-label="Citas posibles"
    class="-mx-1 flex flex-col text-xs text-muted"
  >
    <li
      v-for="(s, i) in choices"
      :id="`${id}-${i}`"
      :key="s.key"
      role="option"
      :aria-selected="i === active"
      class="flex min-w-0 cursor-pointer items-baseline gap-1.5 rounded-md px-1.5 py-1"
      :class="i === active ? 'bg-primary/10' : 'hover:bg-elevated'"
      @mousedown.prevent
      @mouseenter="active = i"
      @click="emit('choose', s)"
    >
      <UIcon
        :name="s.isBook ? 'i-tabler-book-2' : 'i-tabler-arrow-right'"
        class="size-3.5 shrink-0 self-center"
        :class="i === active ? 'text-primary' : 'opacity-50'"
      />
      <b class="shrink-0 font-semibold text-highlighted">{{ s.label }}</b>
      <span v-if="s.isBook" class="truncate">· escribe el capítulo y, si quieres, los versículos</span>
      <span v-else class="min-w-0 truncate">
        <template v-if="s.count">· {{ s.count }} {{ s.count === 1 ? 'versículo' : 'versículos' }}</template>
        <span v-if="s.snippet" class="font-lyric italic"> — {{ s.snippet }}</span>
      </span>
      <kbd v-if="i === active" class="ms-auto shrink-0 self-center rounded border border-default px-1 text-[0.65rem] font-sans not-italic">
        Enter
      </kbd>
    </li>
  </ul>
</template>
