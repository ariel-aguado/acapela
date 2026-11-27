import { nanoid } from "nanoid";

import type { Culto, CultoItem, CultoSection, ScreenItem } from "~~/lib/culto";

import { SCREEN_MOMENT_LABELS } from "~~/lib/culto";

import { screenMoment } from "./moment";

// The order of a service in blocks: an element on its own, or a section
// (the Lord's supper, the offering, the sermon…) with its elements, which
// are always together in the order and move with it. The items stay one
// flat list, in the order they are projected; a section only groups them.

export type Block<T extends { id: string; sectionId?: string } = CultoItem>
  = | { kind: "item"; item: T }
    | { kind: "section"; section: CultoSection; items: T[] };

/** The blocks of a list of items, in order (sections must be contiguous: see normalizeCulto). */
export function blocksOf<T extends { id: string; sectionId?: string }>(items: T[], sections: CultoSection[] = []): Block<T>[] {
  const byId = new Map(sections.map(s => [s.id, s]));
  const blocks: Block<T>[] = [];
  for (const item of items) {
    const section = item.sectionId
      ? byId.get(item.sectionId)
      : undefined;
    const last = blocks.at(-1);
    if (!section) {
      blocks.push({ kind: "item", item });
    }
    else if (last?.kind === "section" && last.section.id === section.id) {
      last.items.push(item);
    }
    else {
      blocks.push({
        kind: "section",
        section,
        items: [item],
      });
    }
  }
  return blocks;
}

export function flattenBlocks<T extends { id: string; sectionId?: string }>(blocks: Block<T>[]): T[] {
  return blocks.flatMap(b => b.kind === "item"
    ? [b.item]
    : b.items);
}

function withSection<T extends CultoItem>(item: T, sectionId: string | undefined): T {
  const { sectionId: _old, ...rest } = item;
  return (sectionId
    ? { ...rest, sectionId }
    : rest) as T;
}

/** A section's name for a moment ("Santa Cena"), or the screen's own words. */
export function sectionTitleFor(item: ScreenItem): string {
  const moment = screenMoment(item);
  return moment === "other"
    ? item.eyebrow.trim() || item.title.trim() || "Sección"
    : SCREEN_MOMENT_LABELS[moment];
}

/**
 * A service as it is kept: a moment's extra screens of the earlier model
 * (ScreenItem.parts) become elements of a section; a section's elements are
 * together, after the first of them; sections without elements and
 * references to missing sections are dropped. Returns the same object when
 * there is nothing to change.
 */
export function normalizeCulto(culto: Culto): Culto {
  let sections = [
    ...(culto.sections ?? []),
  ];
  let items: CultoItem[] = [];

  // Earlier model: the moment's screens inside its title screen.
  for (const item of culto.items) {
    if (item.kind !== "screen" || !item.parts?.length) {
      items.push(item);
      continue;
    }
    const moment = screenMoment(item);
    let sectionId = item.sectionId;
    if (!sectionId || !sections.some(s => s.id === sectionId)) {
      sectionId = nanoid(8);
      sections.push({
        id: sectionId,
        moment,
        title: sectionTitleFor(item),
      });
    }
    const { parts, ...own } = item;
    items.push({ ...own, sectionId });
    for (const part of parts) {
      items.push(part.kind === "reading"
        ? {
            id: nanoid(8),
            kind: "reading",
            reference: part.reference,
            versionId: part.versionId,
            mode: part.mode,
            sectionId,
          }
        : {
            id: nanoid(8),
            kind: "screen",
            moment,
            layout: part.layout,
            eyebrow: part.eyebrow,
            title: part.title,
            body: part.body,
            reference: part.reference,
            sectionId,
          });
    }
  }

  // References to sections that do not exist.
  const known = new Set(sections.map(s => s.id));
  items = items.map(i => i.sectionId && !known.has(i.sectionId)
    ? withSection(i, undefined)
    : i);

  // A section's elements together, where its first one is.
  const together: CultoItem[] = [];
  const placed = new Set<string>();
  for (const item of items) {
    if (!item.sectionId) {
      together.push(item);
    }
    else if (!placed.has(item.sectionId)) {
      placed.add(item.sectionId);
      together.push(...items.filter(i => i.sectionId === item.sectionId));
    }
  }
  sections = sections.filter(s => placed.has(s.id));

  const next: Culto = { ...culto, items: together, sections };
  if (!next.sections?.length)
    delete next.sections;
  return JSON.stringify(next) === JSON.stringify(culto)
    ? culto
    : next;
}

/** The items with a new section for some of them (by id); undefined = on their own. */
export function assignSections(items: CultoItem[], order: { id: string; sectionId?: string }[]): CultoItem[] {
  const byId = new Map(items.map(i => [i.id, i]));
  return order
    .map(o => byId.get(o.id) && withSection(byId.get(o.id)!, o.sectionId))
    .filter((i): i is CultoItem => !!i);
}

/**
 * One step up or down for an element, with the arrows: inside its section
 * it changes places with its neighbour; at the section's edge it leaves it
 * (just before or after it); on its own, it goes past a whole section.
 */
export function stepItem(items: CultoItem[], sections: CultoSection[], itemId: string, delta: -1 | 1): CultoItem[] {
  const blocks = blocksOf(items, sections);
  const at = blocks.findIndex(b => b.kind === "item"
    ? b.item.id === itemId
    : b.items.some(i => i.id === itemId));
  const block = blocks[at];
  if (!block)
    return items;
  if (block.kind === "section") {
    const inner = block.items.findIndex(i => i.id === itemId);
    const to = inner + delta;
    if (to >= 0 && to < block.items.length) {
      const list = [...block.items];
      [list[inner], list[to]] = [list[to]!, list[inner]!];
      blocks[at] = { ...block, items: list };
    }
    else {
      // Out of the section, on its own, on that side of it.
      const item = withSection(block.items[inner]!, undefined);
      const rest = block.items.filter(i => i.id !== itemId);
      const replaced: Block[] = rest.length
        ? [
            { ...block, items: rest },
          ]
        : [];
      blocks.splice(at, 1, ...(delta < 0
        ? [
            { kind: "item" as const, item },
            ...replaced,
          ]
        : [
            ...replaced,
            { kind: "item" as const, item },
          ]));
    }
    return flattenBlocks(blocks);
  }
  const to = at + delta;
  if (to < 0 || to >= blocks.length)
    return items;
  [blocks[at], blocks[to]] = [blocks[to]!, blocks[at]!];
  return flattenBlocks(blocks);
}

/** A whole section one place up or down among the blocks. */
export function stepSection(items: CultoItem[], sections: CultoSection[], sectionId: string, delta: -1 | 1): CultoItem[] {
  const blocks = blocksOf(items, sections);
  const at = blocks.findIndex(b => b.kind === "section" && b.section.id === sectionId);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= blocks.length)
    return items;
  [blocks[at], blocks[to]] = [blocks[to]!, blocks[at]!];
  return flattenBlocks(blocks);
}
