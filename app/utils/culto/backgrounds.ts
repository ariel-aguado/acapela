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
];

export function galleryUrl(id: string): string {
  return `/img/culto/fondos/${id}.webp`;
}

export function galleryThumb(id: string): string {
  return `/img/culto/fondos/mini/${id}.webp`;
}
