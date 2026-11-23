<script setup lang="ts">
export type ShortcutGroup = {
  title: string;
  items: Array<{ keys: string[]; label: string }>;
};

defineProps<{ groups: ShortcutGroup[] }>();
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <UModal
    v-model:open="open"
    title="Atajos de teclado"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <section v-for="(group, gi) in groups" :key="group.title" :class="{ 'mt-5': gi > 0 }">
        <h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-2">
          {{ group.title }}
        </h4>
        <dl class="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 items-center">
          <template v-for="item in group.items" :key="item.label">
            <dt class="flex gap-1 justify-end">
              <UKbd
                v-for="key in item.keys"
                :key="key"
                :value="key"
                size="md"
              />
            </dt>
            <dd class="text-sm">
              {{ item.label }}
            </dd>
          </template>
        </dl>
      </section>
    </template>
  </UModal>
</template>
