function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, "0");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

type Bucket = { r: number; g: number; b: number; weight: number };

/**
 * Returns the dominant color of an image as "#rrggbb", or null if it can't be read.
 * Near-black, near-white and washed-out pixels count for less, so the result
 * is the picture's most characteristic color rather than its background.
 */
export async function extractDominantColor(src: string): Promise<string | null> {
  try {
    const img = await loadImage(src);

    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<number, Bucket>();
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 125) continue;

      totalR += r;
      totalG += g;
      totalB += b;
      count++;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 510;
      if (l < 0.12 || l > 0.92) continue;

      const d = (max - min) / 255;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      const weight = 0.15 + sat;

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, weight: 0 };
      bucket.r += r * weight;
      bucket.g += g * weight;
      bucket.b += b * weight;
      bucket.weight += weight;
      buckets.set(key, bucket);
    }

    let best: Bucket | null = null;
    for (const bucket of buckets.values()) {
      if (!best || bucket.weight > best.weight) best = bucket;
    }

    if (best) {
      return `#${toHex(best.r / best.weight)}${toHex(best.g / best.weight)}${toHex(best.b / best.weight)}`;
    }

    // Image is almost entirely black/white/transparent: fall back to the average
    if (count === 0) return null;
    return `#${toHex(totalR / count)}${toHex(totalG / count)}${toHex(totalB / count)}`;
  } catch {
    return null;
  }
}