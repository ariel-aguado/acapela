// Splits pieces of text into screens by measuring in the real DOM: SúperBiblia's
// presentationPaginate.ts, brought over. The pieces are added one by one to
// the body of an invisible test screen, the same size and style as the real
// one, until something overflows.
//
// - A paragraph that does not fit is split by sentences and fills what is left;
//   one that is kept whole (a Bible verse) goes to the next screen instead,
//   and is only split when it does not fit even on a screen of its own.
// - Labels and titles (keepNext) never stay alone at the bottom: they move
//   to the next screen with what they introduce.
// - A piece bigger than a whole screen is accepted anyway (it is cut
//   visually); with a sensible letter size that does not happen.
//
// Added for Acapela: `onPage(n)` runs before filling each screen, so the
// first one can keep room for the title and the rest use the whole body.

export type PageItem = {
  /** Stable id of the source piece. */
  id: string;
  /** Id of this part: the piece's, or "<id>#<n>" for the rest of a split paragraph. */
  key: string;
  html: string;
  keepNext: boolean;
  /** Not split to fill the end of a screen: whole on the next one (a verse). */
  keepWhole?: boolean;
  breakBefore: boolean;
  /** Sentences (HTML) still to show, when it can be split. */
  split: string[] | null;
  part: number;
  render: (inner: string, continued: boolean) => string;
};

function partOf(item: PageItem, from: number, to: number, first: boolean): PageItem {
  const sentences = item.split!.slice(from, to);
  const continued = !first || item.part > 0;
  const part = first
    ? item.part
    : item.part + 1;
  return {
    ...item,
    split: sentences,
    part,
    key: part === 0
      ? item.id
      : `${item.id}#${part}`,
    breakBefore: first
      ? item.breakBefore
      : false,
    html: item.render(sentences.join(" "), continued),
  };
}

export function paginate(body: HTMLElement, items: PageItem[], onPage?: (index: number) => void): PageItem[][] {
  const overflows = () => body.scrollWidth > body.clientWidth + 1 || body.scrollHeight > body.clientHeight + 1;
  const put = (item: PageItem) => {
    body.insertAdjacentHTML("beforeend", item.html);
    return body.lastElementChild;
  };
  const pages: PageItem[][] = [];
  let page: PageItem[] = [];
  const flush = () => {
    if (page.length)
      pages.push(page);
    page = [];
    body.innerHTML = "";
    onPage?.(pages.length);
  };

  body.innerHTML = "";
  onPage?.(0);
  const queue = items.slice();
  let guard = 0;
  while (queue.length && guard++ < 20000) {
    const item = queue.shift()!;
    if (item.breakBefore && page.length)
      flush();
    const el = put(item);
    if (!overflows()) {
      page.push(item);
      continue;
    }
    el?.remove();

    // Fill what is left sentence by sentence; a piece kept whole only when
    // the screen holds nothing else (it does not fit even alone).
    const alone = !page.some(p => !p.keepNext);
    if (item.split && item.split.length > 1 && (!item.keepWhole || alone)) {
      let fit = 0;
      for (let i = 1; i < item.split.length; i++) {
        const probe = put(partOf(item, 0, i, true));
        const over = overflows();
        probe?.remove();
        if (over)
          break;
        fit = i;
      }
      if (fit > 0) {
        const head = partOf(item, 0, fit, true);
        put(head);
        page.push(head);
        flush();
        queue.unshift(partOf(item, fit, item.split.length, false));
        continue;
      }
    }

    // To the next screen, taking along the titles that would stay alone.
    if (page.some(p => !p.keepNext)) {
      const carry: PageItem[] = [];
      while (page.length && page.at(-1)!.keepNext)
        carry.unshift(page.pop()!);
      flush();
      for (const c of carry) {
        put(c);
        page.push(c);
      }
      queue.unshift({ ...item, breakBefore: false });
      continue;
    }

    // Bigger than a whole screen: accepted.
    put(item);
    page.push(item);
    flush();
  }
  flush();
  return pages;
}
