import type { LyricBlockSource, LyricLine, SongData } from "~~/lib/types";

/**
 * Split the big songbook text into individual song blocks and extract id/title/raw lyric.
 * Pure function — no I/O, no side effects. Safe to use in workers.
 */
export function parseSongbook(text: string): SongData[] {
  return text
    // eslint-disable-next-line regexp/optimal-lookaround-quantifier -- kept verbatim from legacy parser
    .split(/(?=^\d+\.\s*[^\n]*)/m)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      const first = (lines[0] || "").trim();
      const num = first.match(/^\d+/);
      if (!num)
        return null;
      const songId = Number.parseInt(num[0], 10);
      const title = first.replace(/^\d+\.?\s*/, "").trim();
      const lyric = lines.slice(1).join("\n").trim();
      return {
        id: songId,
        songId,
        title,
        lyric,
        createdAt: Date.now(),
      } as unknown as SongData;
    })
    .filter(Boolean) as SongData[];
}

function isChorusLine(line: string) {
  return /^\s*cor?o:?\s*$/i.test(line.trim());
}

/**
 * Format marks stanzas, numbers, and handles CORO.
 * Returns a Markdown string suitable for `marked.parse`.
 * Pure function — safe to use in workers.
 */
export function formatSongContent(content: string): string {
  const lines = content.split(/\r?\n/) as string[];
  const out: string[] = [];
  let stanzaIdx = 1;
  let inChorus = false;
  let chorusBuffer: string[] = [];
  let stanzaBuffer: string[] = [];
  let firstBlock = true;

  const flushStanza = () => {
    if (stanzaBuffer.length === 0)
      return;
    const isCitation = stanzaBuffer.length === 1 && /^\([^)]+\)\s*$/.test(stanzaBuffer[0] ?? "");
    if (!firstBlock)
      out.push("");
    if (!isCitation) {
      out.push(`*${stanzaIdx}*  `);
      stanzaIdx++;
      out.push("");
    }
    stanzaBuffer.forEach(l => out.push(`${l}  `));
    stanzaBuffer = [];
    firstBlock = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (isChorusLine(trimmed)) {
      flushStanza();
      if (chorusBuffer.length > 0) {
        out.push(...chorusBuffer);
        chorusBuffer = [];
      }
      inChorus = true;
      if (!firstBlock)
        out.push("");
      out.push("**CORO:  ");
      continue;
    }

    if (inChorus) {
      if (trimmed === "" || i === lines.length - 1) {
        if (trimmed !== "")
          chorusBuffer.push(`${line}  `);
        if (chorusBuffer.length > 0) {
          if (chorusBuffer.length > 1)
            out.push(...chorusBuffer.slice(0, -1));
          let last = chorusBuffer[chorusBuffer.length - 1] ?? "";
          if (last.endsWith("  "))
            last = `${last.slice(0, -2)}**  `;
          else last = `${last}**`;
          out.push(last);
          chorusBuffer = [];
        }
        inChorus = false;
        if (trimmed === "" && i < lines.length - 1)
          out.push("");
      }
      else {
        chorusBuffer.push(`${line}  `);
      }
      continue;
    }

    if (trimmed === "") {
      flushStanza();
      if (!firstBlock && i < lines.length - 1)
        out.push("");
      continue;
    }

    stanzaBuffer.push(line);
  }

  flushStanza();

  if (chorusBuffer.length > 0) {
    if (chorusBuffer.length > 1)
      out.push(...chorusBuffer.slice(0, -1));
    let last = chorusBuffer[chorusBuffer.length - 1] ?? "";
    if (last.endsWith("  "))
      last = `${last.slice(0, -2)}**  `;
    else last = `${last}**`;
    out.push(last);
  }

  return out.join("\n");
}

/**
 * Convert formatted lyric string into array of LyricLine objects used by the UI.
 * Pure function — safe to use in workers.
 */
export function lyricToLines(content: string): LyricLine[] {
  const lines = content.split("\n");
  let inChorus = false;
  const parsed: LyricLine[] = [];

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("**CORO:")) {
      inChorus = true;
      const coroLabel = trimmed.replace(/^\*\*CORO:\s*\*?$/, "CORO:");
      parsed.push({ line: coroLabel });
      continue;
    }

    if ((line.startsWith("(") && line.endsWith(")")) || /^\*\d+\*$/.test(trimmed) || trimmed === "") {
      continue;
    }

    let processed = trimmed;
    if (inChorus) {
      processed = processed.replace(/\*+$/, "");
      if (line.trim().endsWith("**"))
        inChorus = false;
    }

    if (processed)
      parsed.push({ line: processed });
  }

  return parsed;
}

/**
 * Convert the formatted lyric (output of `formatSongContent`) into the blocks
 * a singer recognizes: the Bible citation, numbered stanzas and the chorus.
 * Each block keeps its own Markdown (some hymns use tables for the parts of
 * men and women) plus a plain-text version of its lines for matching search
 * hits to a stanza. Pure function — safe to use in workers.
 */
export function lyricToBlocks(formatted: string): LyricBlockSource[] {
  const blocks: LyricBlockSource[] = [];
  let current: LyricBlockSource | null = null;

  const flush = () => {
    if (current && current.markdown.length > 0)
      blocks.push(current);
    current = null;
  };

  for (const raw of formatted.split(/\r?\n/)) {
    const trimmed = raw.trim();

    // Blank line: ends a block with content. A bare stanza marker ("*1*") is
    // followed by a blank line before its lines, so keep empty blocks open.
    if (trimmed === "") {
      if (current && current.markdown.length > 0)
        flush();
      continue;
    }

    const stanzaMarker = trimmed.match(/^\*(\d+)\*$/);
    if (stanzaMarker) {
      flush();
      current = { kind: "stanza", number: stanzaMarker[1] ?? "", markdown: [] };
      continue;
    }

    // "**CORO:", "**CORO**:" and similar openers.
    if (/^\*\*cor?o\b/i.test(trimmed)) {
      flush();
      current = { kind: "chorus", number: "", markdown: [] };
      const rest = trimmed.replace(/^\*\*cor?o\**:?\**/i, "").trim();
      if (rest)
        current.markdown.push(rest);
      continue;
    }

    // Bible citation, e.g. "(SALMO 100)": only before any sung line.
    const sungSoFar = blocks.some(b => b.kind !== "citation") || (current?.markdown.length ?? 0) > 0;
    if (/^\([^)]*\)$/.test(trimmed) && !sungSoFar) {
      blocks.push({
        kind: "citation",
        number: "",
        markdown: [
          trimmed.slice(1, -1).trim(),
        ],
      });
      continue;
    }

    if (!current)
      current = { kind: "stanza", number: "", markdown: [] };

    let line = trimmed;
    // The chorus opener's bold is closed on its last line ("…aleluya!**").
    // Drop that unmatched closer but keep balanced bold such as "**Hombres**".
    if (current.kind === "chorus" && line.endsWith("**") && (line.match(/\*\*/g) ?? []).length % 2 === 1)
      line = line.slice(0, -2).trimEnd();
    if (line)
      current.markdown.push(line);
  }

  flush();
  return blocks;
}

/**
 * Plain text of a block's Markdown lines: no emphasis marks, no table pipes
 * or separator rows, `<br>` turned into separate lines.
 */
export function blockPlainLines(markdown: string[]): string[] {
  const out: string[] = [];
  for (const line of markdown) {
    // Table separator row ("| --- | --- |").
    if (/^[\s:|-]+$/.test(line) && line.includes("---"))
      continue;
    const parts = line
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\|/g, "\n")
      .split("\n");
    for (const part of parts) {
      const text = part.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
      if (text)
        out.push(text);
    }
  }
  return out;
}
