import type { Background, CultoItem, Look, ProjectionTheme } from "~~/lib/culto";

import { PROJECTION_FONTS } from "~~/lib/culto";

/** Relative luminance of a #rrggbb colour (0 black – 1 white). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m)
    return 0;
  const [r, g, b] = m.slice(1).map((h) => {
    const c = Number.parseInt(h, 16) / 255;
    return c <= 0.03928
      ? c / 12.92
      : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** The look of an element's screens: its own background or the theme's. */
export function resolveLook(theme: ProjectionTheme, item?: Pick<CultoItem, "background">): Look {
  const background: Background = item?.background ?? theme.background;
  const darkText = background.kind === "color" && luminance(background.color) > 0.45;
  // A light accent on a light background would not be read.
  const accent = darkText && luminance(theme.accent) > 0.6
    ? "#1b1a22"
    : theme.accent;
  const font = PROJECTION_FONTS.find(f => f.id === theme.font)?.css ?? PROJECTION_FONTS[0]!.css;
  return { background, accent, font, darkText };
}

/**
 * CSS variables for a look, read by the slide components. `imageUrl` is the
 * background image already resolved (object URLs are per page).
 */
export function lookVars(look: Look | undefined, imageUrl: string | null): Record<string, string> {
  if (!look)
    return {};
  const vars: Record<string, string> = {
    "--proj-font": look.font,
    "--proj-accent": look.accent,
  };
  if (look.background.kind === "color") {
    vars["--proj-bg"] = look.background.color;
  }
  else if (look.background.kind === "image") {
    vars["--proj-bg"] = imageUrl
      ? `linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.45)), url("${imageUrl}") center / cover no-repeat`
      : "#111";
  }
  if (look.darkText) {
    vars["--proj-fg"] = "#1b1a22";
    vars["--proj-shadow"] = "none";
  }
  return vars;
}
