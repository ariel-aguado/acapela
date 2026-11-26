const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

/** Escapa texto plano (ej. un título) para insertarlo dentro de un fragmento HTML de confianza (ver useMark.ts para el mismo criterio en otro contexto: nunca sanitiza HTML de terceros, solo evita que caracteres especiales de un string plano rompan el marcado). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => ESCAPE_MAP[char] ?? char);
}
