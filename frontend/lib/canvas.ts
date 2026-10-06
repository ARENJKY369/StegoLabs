/** Canvas helpers for previews, difference amplification and LSB planes. */

export async function loadImageData(url: string): Promise<ImageData> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = url;
  });
}

/** |a-b| × gain per channel, on black. Shows exactly where bits changed. */
export function drawAmplifiedDiff(
  canvas: HTMLCanvasElement,
  a: ImageData,
  b: ImageData,
  gain = 20,
): number {
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(w, h);
  let changed = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ia = (y * a.width + x) * 4;
      const ib = (y * b.width + x) * 4;
      const io = (y * w + x) * 4;
      const dr = Math.abs(a.data[ia] - b.data[ib]);
      const dg = Math.abs(a.data[ia + 1] - b.data[ib + 1]);
      const db = Math.abs(a.data[ia + 2] - b.data[ib + 2]);
      if (dr + dg + db > 0) changed++;
      out.data[io] = Math.min(255, dr * gain);
      out.data[io + 1] = Math.min(255, dg * gain);
      out.data[io + 2] = Math.min(255, db * gain);
      out.data[io + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return changed;
}

/** Render one channel's LSB plane as white-on-black. channel: 0=R 1=G 2=B */
export function drawLsbPlane(
  canvas: HTMLCanvasElement,
  src: ImageData,
  channel: 0 | 1 | 2,
): void {
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(src.width, src.height);
  for (let i = 0; i < src.width * src.height; i++) {
    const bit = src.data[i * 4 + channel] & 1;
    const v = bit ? 255 : 0;
    out.data[i * 4] = v;
    out.data[i * 4 + 1] = v;
    out.data[i * 4 + 2] = v;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}
