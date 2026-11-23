<script lang="ts" setup>
const route = useRoute();
const detail = typeof route.query.error === "string" && route.query.error
  ? route.query.error
  : "";
</script>

<template>
  <div class="container mx-auto mt-8 px-4 flex flex-col items-center gap-4 text-center">
    <Icon
      name="tabler:alert-triangle"
      size="48"
      class="text-warning"
      aria-hidden="true"
    />
    <h2 class="text-2xl font-bold">
      Algo salió mal al abrir esta página
    </h2>
    <p class="max-w-md opacity-80">
      Puedes volver al himno o intentarlo de nuevo en unos segundos.
    </p>
    <p v-if="detail" class="max-w-md text-sm opacity-60">
      Detalle: {{ detail }}
    </p>
    <div class="flex flex-wrap justify-center gap-2 mt-2">
      <UButton
        to="/"
        size="lg"
        icon="i-tabler-arrow-left"
        label="Volver al himno"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="lg"
        label="Reintentar"
        @click="$router.go(0)"
      />
    </div>
  </div>
</template>
