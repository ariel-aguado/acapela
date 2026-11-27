// Nuxt UI defaults brought from Diaconeo's redesign: white surfaces without
// a border on the grey canvas, pill controls and solid floating surfaces
// with a soft shadow.

// A surface floating over the page (menus, popovers, selects).
const floating = "bg-default ring ring-default shadow-float";
// An overlay covering the viewport.
const overlay = "backdrop-blur-(--overlay-blur) bg-neutral-950/30 dark:bg-black/50";

export default defineAppConfig({
  ui: {
    colors: {
      primary: "iris",
      // Also the favourite heart.
      secondary: "tangerine",
      success: "green",
      info: "aqua",
      warning: "tangerine",
      error: "red",
      neutral: "zinc",
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
    button: {
      slots: {
        base: "rounded-full font-medium",
      },
      compoundVariants: [
        {
          color: "neutral",
          variant: "outline",
          class: "ring-default bg-default hover:bg-(--control-bg)",
        },
        {
          color: "neutral",
          variant: "soft",
          class: "bg-(--control-bg) hover:bg-(--control-bg-hover) active:bg-(--control-bg-hover) disabled:bg-(--control-bg) aria-disabled:bg-(--control-bg)",
        },
        {
          color: "neutral",
          variant: "ghost",
          class: "hover:bg-(--control-bg) active:bg-(--control-bg)",
        },
      ],
    },
    badge: {
      slots: {
        base: "rounded-full font-medium",
      },
    },
    card: {
      slots: {
        root: "rounded-2xl",
        header: "px-5 pt-5 pb-0 sm:px-6 sm:pt-6",
        body: "p-5 sm:p-6",
        footer: "px-5 pb-5 pt-0 sm:px-6 sm:pb-6",
      },
      variants: {
        variant: {
          outline: {
            root: "bg-default ring-0 shadow-card divide-y-0",
          },
          soft: {
            root: "bg-elevated divide-y-0",
          },
          subtle: {
            root: "bg-muted ring ring-default divide-y-0",
          },
        },
      },
    },
    chip: {
      slots: {
        base: "ring-0",
      },
    },
    input: {
      slots: {
        base: "rounded-full",
      },
      variants: {
        variant: {
          soft: "bg-(--control-bg) hover:bg-(--control-bg-hover) focus:bg-(--control-bg-hover) disabled:bg-(--control-bg)",
        },
      },
    },
    inputMenu: {
      slots: {
        base: "rounded-full",
        content: floating,
      },
    },
    select: {
      slots: {
        base: "rounded-full",
        content: floating,
        item: "data-highlighted:not-data-disabled:before:bg-(--control-bg)",
      },
      variants: {
        variant: {
          soft: "bg-(--control-bg) hover:bg-(--control-bg-hover) focus:bg-(--control-bg-hover) disabled:bg-(--control-bg)",
        },
      },
    },
    selectMenu: {
      slots: {
        base: "rounded-full",
        content: floating,
      },
    },
    textarea: {
      slots: {
        base: "rounded-xl",
      },
    },
    inputDate: {
      slots: {
        base: "gap-0! rounded-full",
        segment: "w-auto! px-0.5",
      },
      compoundVariants: [
        {
          color: "primary",
          variant: "none",
          class: {
            segment: "focus:bg-primary focus:text-white",
          },
        },
      ],
    },
    inputTime: {
      slots: {
        base: "gap-0! rounded-full",
        segment: "w-auto! px-0.5",
      },
      compoundVariants: [
        {
          color: "primary",
          variant: "none",
          class: {
            segment: "focus:bg-primary focus:text-white",
          },
        },
      ],
    },
    kbd: {
      compoundVariants: [
        {
          color: "neutral",
          variant: "soft",
          class: "bg-(--control-bg)",
        },
      ],
    },
    commandPalette: {
      slots: {
        root: "divide-default",
      },
    },
    contextMenu: {
      slots: {
        content: floating,
      },
    },
    dropdownMenu: {
      slots: {
        content: [floating, "rounded-xl"],
      },
    },
    popover: {
      slots: {
        content: [floating, "rounded-xl"],
      },
    },
    tooltip: {
      slots: {
        content: "rounded-lg",
      },
    },
    modal: {
      slots: {
        content: "bg-default ring-0 shadow-float divide-y divide-default",
      },
      variants: {
        fullscreen: {
          false: {
            content: "rounded-2xl w-[calc(100vw-1rem)] h-[calc(100dvh-1rem)] sm:w-[calc(100vw-2rem)] sm:h-auto",
          },
        },
        overlay: {
          true: {
            overlay,
          },
        },
      },
      compoundVariants: [
        {
          fullscreen: false,
          scrollable: false,
          class: {
            content: "max-h-none",
          },
        },
        {
          fullscreen: false,
          scrollable: true,
          class: {
            overlay: "p-2 sm:p-4 sm:py-8",
          },
        },
      ],
    },
    slideover: {
      slots: {
        overlay,
        content: "bg-default ring-0 shadow-float divide-none",
      },
      compoundVariants: [
        {
          side: "top",
          inset: true,
          class: {
            content: "rounded-2xl max-h-[calc(100%-1rem)] inset-x-2 top-2",
          },
        },
        {
          side: "right",
          inset: true,
          class: {
            content: "rounded-2xl w-[calc(100%-1rem)] inset-y-2 right-2",
          },
        },
        {
          side: "bottom",
          inset: true,
          class: {
            content: "rounded-2xl max-h-[calc(100%-1rem)] inset-x-2 bottom-2",
          },
        },
        {
          side: "left",
          inset: true,
          class: {
            content: "rounded-2xl w-[calc(100%-1rem)] inset-y-2 left-2",
          },
        },
      ],
    },
    navigationMenu: {
      slots: {
        link: "hover:before:bg-(--control-bg-hover)",
      },
      compoundVariants: [
        {
          disabled: false,
          active: false,
          variant: "pill",
          class: {
            link: "hover:before:bg-(--control-bg)",
          },
        },
      ],
    },
    // Pill tabs: grey track, the active one white with a shadow.
    tabs: {
      slots: {
        trigger: "w-full rounded-full",
      },
      variants: {
        variant: {
          pill: {
            list: "rounded-full gap-0.5 bg-(--well-bg) p-1",
            indicator: "rounded-full",
          },
        },
      },
      compoundVariants: [
        {
          color: "neutral",
          variant: "pill",
          class: {
            indicator: "bg-default shadow-card dark:bg-(--control-bg-hover)",
            trigger: [
              "data-[state=active]:text-highlighted",
              "hover:data-[state=inactive]:not-disabled:text-highlighted",
              "in-[[data-slot=list]:not(:has([data-slot=indicator]))]:data-[state=active]:before:bg-default",
              "in-[[data-slot=list]:not(:has([data-slot=indicator]))]:data-[state=active]:before:rounded-full",
            ],
          },
        },
      ],
    },
    // Boltshift table: the header in a rounded grey row, no strong lines
    // between rows.
    table: {
      slots: {
        th: "py-3 text-xs font-medium text-muted bg-elevated first:rounded-s-xl last:rounded-e-xl",
        td: "text-default",
        tbody: "divide-default/60",
        separator: "hidden",
      },
    },
  },
});
