import type { Program } from "~/utils/culto/program";

/** Days a program is kept after its service. */
const KEEP_DAYS = 14;
/** How far ahead a service is "the next one" on the home page. */
const SOON_DAYS = 7;

function isoDay(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The service programs received on this device (links from the church's
 * group): one per service, the newest version kept. Old ones go by
 * themselves two weeks after their day.
 */
export const useProgramsStore = defineStore("programs", () => {
  const programs = useLocalStorage<Program[]>("programs", []);

  function prune() {
    const oldest = isoDay(-KEEP_DAYS);
    if (programs.value.some(p => p.date < oldest))
      programs.value = programs.value.filter(p => p.date >= oldest);
  }
  prune();

  /** Newest day first. */
  const sorted = computed(() => [...programs.value].sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? "")));

  /**
   * Keeps a received program. An older version of the same service is
   * replaced; an even older link opened later does not undo a newer one.
   */
  function receive(received: Program, sala?: string): { program: Program; replaced: boolean; stale: boolean } {
    const known = programs.value.find(p => p.id === received.id);
    // Its room stays known, whichever link brings it.
    const program = { ...received, sala: sala ?? received.sala ?? known?.sala };
    if (!program.sala)
      delete program.sala;
    if (known && known.rev > program.rev) {
      if (program.sala && !known.sala) {
        programs.value = programs.value.map(p => p.id === known.id
          ? { ...known, sala: program.sala }
          : p);
      }
      return { program: known, replaced: false, stale: true };
    }
    // The same version again: nothing to say.
    const same = !!known && known.rev === program.rev;
    programs.value = [
      ...programs.value.filter(p => p.id !== program.id),
      program,
    ];
    return { program, replaced: !!known && !same, stale: false };
  }

  function remove(id: string) {
    programs.value = programs.value.filter(p => p.id !== id);
  }

  function byId(id: string): Program | null {
    return programs.value.find(p => p.id === id) ?? null;
  }

  /** Today's service, else the next one this week: the home page's card. */
  const featured = computed<{ program: Program; today: boolean } | null>(() => {
    const today = isoDay();
    const soon = isoDay(SOON_DAYS);
    const ahead = sorted.value.filter(p => p.date >= today && p.date <= soon).reverse();
    const first = ahead[0];
    return first
      ? { program: first, today: first.date === today }
      : null;
  });

  return {
    programs,
    sorted,
    receive,
    remove,
    byId,
    featured,
    prune,
  };
});
