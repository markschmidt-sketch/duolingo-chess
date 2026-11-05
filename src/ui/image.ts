import type { RGBAImage } from '../vision/image';

/** Decode a picked/pasted image file into sRGB pixels (Safari also handles HEIC here). */
export async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx(canvas).drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ctx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  // Display P3 screenshots are converted to sRGB, which is what the templates were built from.
  return canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' })!;
}

export function pixels(canvas: HTMLCanvasElement): RGBAImage {
  return ctx(canvas).getImageData(0, 0, canvas.width, canvas.height, { colorSpace: 'srgb' });
}

/** A square crop of the source image, for side-by-side comparison. */
export function cropCanvas(src: HTMLCanvasElement, x: number, y: number, size: number, out = 640): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = Math.min(out, Math.round(size));
  c.className = 'crop';
  c.getContext('2d')!.drawImage(src, x, y, size, size, 0, 0, c.width, c.height);
  return c;
}
