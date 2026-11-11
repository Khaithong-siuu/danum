/**
 * Helpers for picking photos and videos from the phone's gallery or camera.
 * Everything here runs in the browser / Android WebView.
 */

export type MediaKind = "photo" | "video";

export type FilterId =
  | "original"
  | "vivid"
  | "warm"
  | "cool"
  | "fade"
  | "mono"
  | "noir";

/** `css` is used for the live preview AND baked into the photo on upload. */
export const FILTERS: { id: FilterId; label: string; css: string }[] = [
  { id: "original", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.35) contrast(1.08)" },
  {
    id: "warm",
    label: "Warm",
    css: "sepia(0.22) saturate(1.2) hue-rotate(-8deg) brightness(1.04)",
  },
  {
    id: "cool",
    label: "Cool",
    css: "saturate(1.1) hue-rotate(12deg) brightness(1.02) contrast(1.04)",
  },
  { id: "fade", label: "Fade", css: "contrast(0.88) brightness(1.08) saturate(0.85)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.1)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.35) brightness(0.9)" },
];

export function filterCss(id: FilterId): string {
  return FILTERS.find((f) => f.id === id)?.css ?? "none";
}

const PHOTO_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "m4v", "3gp"]);

/** Works even when the phone leaves the MIME type empty. */
export function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (PHOTO_EXT.has(ext)) return "photo";
  if (VIDEO_EXT.has(ext)) return "video";
  return null;
}

/** Length of a video in whole seconds, or null if it can't be read. */
export function readVideoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const seconds = Math.ceil(probe.duration);
      resolve(Number.isFinite(seconds) && seconds >= 1 ? seconds : null);
    };
    probe.onerror = () => resolve(null);
    probe.src = url;
  });
}

let canvasFilterSupport: boolean | null = null;

/** Android WebView (Chrome) supports canvas filters; some older browsers don't. */
export function supportsCanvasFilter(): boolean {
  if (canvasFilterSupport !== null) return canvasFilterSupport;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    canvasFilterSupport = !!ctx && "filter" in ctx;
  } catch {
    canvasFilterSupport = false;
  }
  return canvasFilterSupport;
}

/**
 * Shrinks a phone photo (often 5-12 MB) to something that uploads quickly,
 * and bakes the chosen filter into the pixels so everyone sees the same thing.
 * Always returns a JPEG.
 */
export async function processPhoto(
  file: File,
  filter: FilterId,
  { maxEdge = 2160, maxBytes = 3 * 1024 * 1024 } = {}
): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("We couldn't read that photo.");
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("We couldn't prepare that photo.");
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  if (filter !== "original" && supportsCanvasFilter()) {
    ctx.filter = filterCss(filter);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

  let blob: Blob | null = null;
  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    blob = await toBlob(quality);
    if (blob && blob.size <= maxBytes) break;
  }
  if (!blob) throw new Error("We couldn't prepare that photo.");

  const base = (file.name.replace(/\.[^.]+$/, "") || "photo").slice(0, 40);
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
