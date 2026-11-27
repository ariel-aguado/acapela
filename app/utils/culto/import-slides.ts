import { importImage, putMedia } from "./media";

// Slides for a service from the files the preacher brings: a PDF (each page
// becomes an image at projection size) or images. PowerPoint, Keynote,
// Google Slides and SúperBiblia export to PDF. Everything stays on this
// device; pdf.js is only loaded when a PDF is imported.

export type ImportProgress = { done: number; total: number; name: string };

async function pdfPages(file: File, onProgress?: (p: ImportProgress) => void): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const doc = await task.promise;
  const ids: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress?.({ done: n - 1, total: doc.numPages, name: file.name });
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      // 1920 px on its longer side: sharp on a projector, light to keep.
      const viewport = page.getViewport({ scale: 1920 / Math.max(base.width, base.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // "print": no requestAnimationFrame, which the browser pauses in a tab
      // that is not in front (the projector window often is).
      await page.render({ canvas, viewport, intent: "print" }).promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => b
          ? resolve(b)
          : reject(new Error("no se pudo convertir la página")), "image/webp", 0.9));
      ids.push(await putMedia(blob, `${file.name} · ${n}`));
      page.cleanup();
    }
    onProgress?.({ done: doc.numPages, total: doc.numPages, name: file.name });
  }
  finally {
    await task.destroy();
  }
  return ids;
}

/** Images in IndexedDB, in the files' order (each PDF page after the other). */
export async function importSlides(files: File[], onProgress?: (p: ImportProgress) => void): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, file] of files.entries()) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      ids.push(...await pdfPages(file, onProgress));
    }
    else if (file.type.startsWith("image/")) {
      onProgress?.({ done: i, total: files.length, name: file.name });
      ids.push(await importImage(file, file.name));
    }
  }
  return ids;
}

/** A title from the first file's name ("Sermón 29-11.pdf" → "Sermón 29-11"). */
export function titleFromFiles(files: File[]): string {
  return files[0]?.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ?? "";
}
