export default defineAppConfig({
  ui: {
    colors: {
      primary: "acapela",
      // The favourite heart.
      secondary: "pink",
      neutral: "slate",
    },
    // Nuxt UI's own icons from Tabler, the set the app already ships
    // (@iconify-json/tabler), instead of Lucide.
    icons: {
      arrowDown: "i-tabler-arrow-down",
      arrowLeft: "i-tabler-arrow-left",
      arrowRight: "i-tabler-arrow-right",
      arrowUp: "i-tabler-arrow-up",
      check: "i-tabler-check",
      chevronDoubleLeft: "i-tabler-chevrons-left",
      chevronDoubleRight: "i-tabler-chevrons-right",
      chevronDown: "i-tabler-chevron-down",
      chevronLeft: "i-tabler-chevron-left",
      chevronRight: "i-tabler-chevron-right",
      chevronUp: "i-tabler-chevron-up",
      close: "i-tabler-x",
      dark: "i-tabler-moon",
      drag: "i-tabler-grip-vertical",
      edit: "i-tabler-pencil",
      ellipsis: "i-tabler-dots",
      error: "i-tabler-circle-x",
      external: "i-tabler-external-link",
      eye: "i-tabler-eye",
      eyeOff: "i-tabler-eye-off",
      file: "i-tabler-file",
      folder: "i-tabler-folder",
      folderOpen: "i-tabler-folder-open",
      light: "i-tabler-sun",
      loading: "i-tabler-loader-2",
      menu: "i-tabler-menu-2",
      minus: "i-tabler-minus",
      panelClose: "i-tabler-layout-sidebar-left-collapse",
      panelOpen: "i-tabler-layout-sidebar-left-expand",
      plus: "i-tabler-plus",
      reload: "i-tabler-reload",
      search: "i-tabler-search",
      star: "i-tabler-star",
      stop: "i-tabler-player-stop",
      success: "i-tabler-circle-check",
      system: "i-tabler-device-desktop",
      trash: "i-tabler-trash",
      upload: "i-tabler-upload",
    },
    // Rounded buttons and fields everywhere, like the floating capsules.
    button: {
      slots: {
        base: "rounded-full",
      },
    },
    input: {
      slots: {
        base: "rounded-full",
      },
    },
  },
});
