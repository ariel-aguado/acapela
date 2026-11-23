<script lang="ts" setup>
useHead({ title: "Acerca de" });
</script>

<template>
  <div class="page-scroll w-full flex flex-col max-w-screen min-w-0 md:min-w-2xl md:max-w-2xl md:mx-auto px-4">
    <!-- Brand: the mark, the name in the lyric face and the one tagline. -->
    <div class="about-hero w-full rounded-3xl text-white flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <AppBrandMark class="size-24" />
      <span class="wordmark text-5xl leading-none">Acapela</span>
      <span class="text-lg opacity-85">Himnos y cánticos espirituales</span>
    </div>
    <div>
      <h2 class="text-3xl font-bold text-left md:text-center mt-8">
        Acerca de Acapela
      </h2>
      <p class="md:max-w-2xl md:mx-auto text-left md:text-center mt-4 leading-8">
        "Acapela" nace con una misión clara: poner la tecnología al servicio de la alabanza. Es una herramienta diseñada para que la Iglesia pueda exaltar el nombre del Señor, a quien sea toda la honra y la gloria. Amén.
      </p>
      <p class="md:max-w-2xl md:mx-auto text-left md:text-center mt-4 leading-8">
        Esta aplicación es completamente gratuita y de código abierto. Puedes encontrar el código fuente en <a
          class="link link-primary underline-offset-2"
          href="https://github.com/ariel-aguado/acapela"
          target="_blank"
          rel="noopener noreferrer"
        >GitHub</a>.
      </p>
      <p class="md:max-w-2xl md:mx-auto text-left md:text-center mt-4 leading-8">
        Si necesitas ayuda, tienes alguna sugerencia o encuentras algún error, puedes contactar a través de la siguiente dirección de correo electrónico al:
        <a
          class="link link-primary underline-offset-2"
          href="mailto:ariel.841207@gmail.com"
        >Desarrollador de Acapela</a>.
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Fixed brand indigo (same as the app icon) in both themes. */
.about-hero {
  background: radial-gradient(120% 140% at 85% 15%, #6b52d6 0%, #4f34b4 45%, #2a1a6e 100%);
}
</style>
