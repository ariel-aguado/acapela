import type { ScreenMoment } from "~~/lib/culto";

// Acapela's gallery of backgrounds (public/img/culto/fondos, drawn by
// scripts/culto-backgrounds.mjs): original illustrations, dark and calm in
// the middle so the text reads on them. Each one says which moments it is
// for, so the picker offers those first.

export type GalleryBackground = {
  id: string;
  label: string;
  /** Moments it suits; "reading" for Bible readings. Empty: any screen. */
  for: (ScreenMoment | "reading")[];
  /** Light: the text on it is dark. */
  light?: boolean;
};

export const GALLERY: GalleryBackground[] = [
  {
    id: "cena-copa-pan",
    label: "La copa y el pan",
    for: ["supper"],
  },
  {
    id: "cena-trigo-uvas",
    label: "Trigo y uvas",
    for: ["supper"],
  },
  {
    id: "ofrenda-trigo-dorado",
    label: "Campo de trigo",
    for: ["offering"],
  },
  {
    id: "ofrenda-semilla",
    label: "La semilla",
    for: ["offering"],
  },
  {
    id: "palabra-libro-luz",
    label: "El libro abierto",
    for: ["sermon", "reading"],
  },
  {
    id: "palabra-lampara",
    label: "Lámpara a mis pies",
    for: ["sermon", "reading"],
  },
  {
    id: "lectura-pergamino",
    label: "Pergamino",
    for: ["reading", "sermon"],
  },
  {
    id: "bienvenida-amanecer",
    label: "Amanecer",
    for: ["welcome"],
  },
  {
    id: "bienvenida-puerta",
    label: "La puerta abierta",
    for: ["welcome"],
  },
  {
    id: "oracion-vela",
    label: "Una vela",
    for: ["prayer"],
  },
  {
    id: "oracion-estrellas",
    label: "Noche estrellada",
    for: ["prayer"],
  },
  {
    id: "anuncios-geometrico",
    label: "Formas",
    for: ["notices"],
  },
  {
    id: "anuncios-lineas",
    label: "Líneas",
    for: ["notices"],
  },
  {
    id: "despedida-atardecer",
    label: "Atardecer en el mar",
    for: ["farewell"],
  },
  {
    id: "despedida-camino",
    label: "El camino",
    for: ["farewell"],
  },
  { id: "general-suave", label: "Suave", for: [] },
  // Light ones, for dark text.
  {
    id: "claro-cena-lino",
    label: "Copa y pan, claro",
    for: ["supper"],
    light: true,
  },
  {
    id: "claro-ofrenda-trigal",
    label: "Trigal claro",
    for: ["offering"],
    light: true,
  },
  {
    id: "claro-palabra-pagina",
    label: "Página abierta",
    for: ["sermon", "reading"],
    light: true,
  },
  {
    id: "claro-bienvenida-manana",
    label: "Mañana",
    for: ["welcome"],
    light: true,
  },
  {
    id: "claro-oracion-nubes",
    label: "Nubes",
    for: ["prayer"],
    light: true,
  },
  {
    id: "claro-anuncios-formas",
    label: "Formas claras",
    for: ["notices"],
    light: true,
  },
  {
    id: "claro-despedida-mar",
    label: "Mar al atardecer",
    for: ["farewell"],
    light: true,
  },
  {
    id: "claro-suave",
    label: "Claro suave",
    for: [],
    light: true,
  },
  {
    id: "claro-cena-trigo-uvas",
    label: "Trigo y uvas, claro",
    for: ["supper"],
    light: true,
  },
  {
    id: "claro-ofrenda-brote",
    label: "Brote",
    for: ["offering"],
    light: true,
  },
  {
    id: "claro-palabra-lampara",
    label: "Lámpara, clara",
    for: ["sermon", "reading"],
    light: true,
  },
  {
    id: "claro-lectura-rollo",
    label: "Rollo",
    for: ["reading", "sermon"],
    light: true,
  },
  {
    id: "claro-bienvenida-puerta",
    label: "Puerta, clara",
    for: ["welcome"],
    light: true,
  },
  {
    id: "claro-oracion-vela",
    label: "Vela, clara",
    for: ["prayer"],
    light: true,
  },
  {
    id: "claro-anuncios-lineas",
    label: "Líneas claras",
    for: ["notices"],
    light: true,
  },
  {
    id: "claro-despedida-camino",
    label: "Camino claro",
    for: ["farewell"],
    light: true,
  },
];

/** Whether a gallery background is light (its text goes dark). */
export function isLightGallery(id: string): boolean {
  return !!GALLERY.find(g => g.id === id)?.light;
}

export function galleryUrl(id: string): string {
  return `/img/culto/fondos/${id}.webp`;
}

export function galleryThumb(id: string): string {
  return `/img/culto/fondos/mini/${id}.webp`;
}
