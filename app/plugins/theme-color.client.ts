// Status bar / browser chrome colour = the page background of the theme in
// use. The two <meta name="theme-color" media=…> tags in nuxt.config cover
// "Sistema"; when the user picks Claro or Oscuro explicitly, both follow
// that choice instead of the phone's setting.
const BG = { light: "#ffffff", dark: "#0f172a" } as const;

export default defineNuxtPlugin(() => {
  const colorMode = useColorMode();
  watch(
    () => [colorMode.preference, colorMode.value] as const,
    ([preference, value]) => {
      const metas = document.querySelectorAll<HTMLMetaElement>("meta[name=\"theme-color\"]");
      metas.forEach((meta) => {
        if (preference === "system") {
          const media = meta.getAttribute("media") ?? "";
          meta.content = media.includes("dark")
            ? BG.dark
            : BG.light;
        }
        else {
          meta.content = value === "dark"
            ? BG.dark
            : BG.light;
        }
      });
    },
    { immediate: true },
  );
});
