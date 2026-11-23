<script setup lang="ts">
export type ShortcutGroup = {
  title: string;
  items: Array<{ keys: string[]; label: string }>;
};

const props = defineProps<{ open: boolean; groups: ShortcutGroup[] }>();
const emit = defineEmits<{ (e: "update:open", value: boolean): void }>();

const dialogRef = shallowRef<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open && !dialogRef.value?.open)
      dialogRef.value?.showModal();
    else if (!open && dialogRef.value?.open)
      dialogRef.value.close();
  },
);
</script>

<template>
  <dialog
    ref="dialogRef"
    class="modal"
    aria-labelledby="shortcuts-title"
    @close="emit('update:open', false)"
  >
    <div class="modal-box max-w-lg">
      <div class="flex items-center justify-between mb-2">
        <h3 id="shortcuts-title" class="text-lg font-bold">
          Atajos de teclado
        </h3>
        <button
          type="button"
          class="btn btn-ghost btn-circle"
          aria-label="Cerrar"
          @click="emit('update:open', false)"
        >
          <Icon name="tabler:x" size="22" />
        </button>
      </div>
      <section v-for="group in groups" :key="group.title" class="mt-4">
        <h4 class="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">
          {{ group.title }}
        </h4>
        <dl class="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 items-center">
          <template v-for="item in group.items" :key="item.label">
            <dt class="flex gap-1 justify-end">
              <kbd v-for="key in item.keys" :key="key" class="kbd kbd-sm">{{ key }}</kbd>
            </dt>
            <dd class="text-sm">
              {{ item.label }}
            </dd>
          </template>
        </dl>
      </section>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit" aria-label="Cerrar">
        Cerrar
      </button>
    </form>
  </dialog>
</template>
