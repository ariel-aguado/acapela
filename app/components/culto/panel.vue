<script lang="ts" setup>
// One panel of a page: a white box with its heading (an icon, a title and a
// short note) over its content, and an optional footer (NN/g: common region
// and visual hierarchy), so each part of the page reads at a glance.
const props = withDefaults(defineProps<{
  title: string;
  icon?: string;
  /** Classes for the body; default, padded. */
  bodyClass?: string;
  /** An id for the heading row (title and note), to point at it. */
  headId?: string;
}>(), {
  icon: undefined,
  headId: undefined,
  bodyClass: "p-4",
});
const id = useId();
void props;
</script>

<template>
  <section class="culto-panel flex min-w-0 flex-col rounded-2xl bg-default shadow-card" :aria-labelledby="id">
    <header :id="headId" class="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 border-b border-muted px-4 py-2.5">
      <UIcon v-if="icon" :name="icon" class="size-4.5 shrink-0 text-primary" />
      <h2 :id="id" class="text-sm font-bold text-highlighted">
        {{ title }}
      </h2>
      <span v-if="$slots.meta" class="min-w-0 truncate text-xs text-muted tabular-nums"><slot name="meta" /></span>
      <span class="flex-1" />
      <slot name="actions" />
    </header>
    <div class="min-w-0" :class="bodyClass">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="border-t border-muted px-4 py-3">
      <slot name="footer" />
    </footer>
  </section>
</template>
