<script lang="ts" setup>
// The ✕ inside a text field once it holds something: empties it and leaves
// the cursor there, ready to type again. Goes in the field's #trailing slot:
//   <template v-if="text" #trailing><AppClearButton @clear="text = ''" /></template>
defineProps<{ label?: string }>();
const emit = defineEmits<{ clear: [] }>();

function clear(event: MouseEvent) {
  const field = (event.currentTarget as HTMLElement).closest("[data-slot='root'], .relative")?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  emit("clear");
  nextTick(() => field?.focus());
}
</script>

<template>
  <UButton
    color="neutral"
    variant="link"
    size="sm"
    icon="i-tabler-x"
    :aria-label="label ?? 'Borrar'"
    :title="label ?? 'Borrar'"
    class="pointer-events-auto"
    @mousedown.prevent
    @click="clear"
  />
</template>
