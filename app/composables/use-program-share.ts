import type { SharedPassage } from "~/utils/culto/program";
import type { Room } from "~/utils/culto/relay";
import type { Culto } from "~~/lib/culto";

import { buildProgram, encodeProgram, passageKey, readingsOf } from "~/utils/culto/program";
import { newKey, newRoom, publishProgram, RoomTakenError } from "~/utils/culto/relay";

/**
 * The service's program for the congregation, and its room on the relay:
 * the share dialog and the live console both build it the same way. Each
 * service gets its room once on this computer (its code goes in the links
 * already sent, so it is kept).
 */
export function useProgramShare() {
  const culto = useCultoStore();
  const bible = useBibleStore();
  const { theme } = storeToRefs(culto);
  /** By service id. Not in the service itself: its file goes to other people. */
  const rooms = useLocalStorage<Record<string, Room>>("cultoRooms", {});

  /** The program as the part of the link after «#», and the readings that could not be read. */
  async function build(c: Culto): Promise<{ encoded: string; failed: string[] }> {
    const passages: Record<string, SharedPassage> = {};
    const failed: string[] = [];
    for (const { reference, versionId } of readingsOf(c.items)) {
      const key = passageKey(reference, versionId);
      if (passages[key] || failed.includes(reference))
        continue;
      try {
        const passage = await bible.passage(reference, versionId);
        if (!passage?.verses.length)
          throw new Error("sin texto");
        passages[key] = {
          label: passage.label,
          version: bible.versions.find(v => v.id === passage.versionId)?.label ?? "",
          verses: passage.verses,
        };
      }
      catch {
        failed.push(reference);
      }
    }
    return { encoded: await encodeProgram(buildProgram(c, theme.value, passages)), failed };
  }

  function roomFor(cultoId: string): Room {
    const known = rooms.value[cultoId];
    if (known)
      return known;
    const room = newRoom();
    rooms.value = { ...rooms.value, [cultoId]: room };
    return room;
  }

  /**
   * Puts the program in the service's room. A code someone else already
   * holds (very unlikely) gets a new one. Returns how many phones listen.
   */
  async function publish(cultoId: string, encoded: string, rev: number): Promise<{ room: Room; listeners: number }> {
    let room = roomFor(cultoId);
    try {
      return { room, listeners: await publishProgram(room, encoded, rev) };
    }
    catch (err) {
      if (!(err instanceof RoomTakenError))
        throw err;
      room = newRoom();
      rooms.value = { ...rooms.value, [cultoId]: room };
      return { room, listeners: await publishProgram(room, encoded, rev) };
    }
  }

  function hasRoom(cultoId: string): boolean {
    return !!rooms.value[cultoId];
  }

  /** A new remote key for the service's room (it unpairs the previous phone once sent). */
  function newControl(cultoId: string): Room {
    const room = {
      ...roomFor(cultoId),
      control: newKey(),
    };
    rooms.value = { ...rooms.value, [cultoId]: room };
    return room;
  }

  return {
    build,
    roomFor,
    hasRoom,
    publish,
    newControl,
  };
}
