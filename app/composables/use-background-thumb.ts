import type { MaybeRefOrGetter } from "vue";

import type { Background } from "~~/lib/culto";

import { galleryThumb } from "~/utils/culto/backgrounds";
import { mediaUrl } from "~/utils/culto/media";

/**
 * A small picture of a background, as a style for any box: the gallery's
 * thumbnail, the church's own image, a colour or Acapela's cross.
 */
export function useBackgroundThumb(background: MaybeRefOrGetter<Background | undefined>) {
  const style = ref<Record<string, string>>({});
  watchEffect(async () => {
    const b = toValue(background) ?? { kind: "acapela" };
    if (b.kind === "color") {
      style.value = { background: b.color };
    }
    else if (b.kind === "gallery") {
      style.value = { background: `url("${galleryThumb(b.id)}") center / cover` };
    }
    else if (b.kind === "image") {
      const url = await mediaUrl(b.mediaId);
      style.value = url
        ? { background: `url("${url}") center / cover` }
        : {};
    }
    else {
      style.value = { background: `url("/img/background-fullscreen.webp") center / cover` };
    }
  });
  return style;
}
