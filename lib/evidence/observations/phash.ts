// Perceptual hash: a 64-bit fingerprint of what a picture looks like, so near-identical pictures (resized,
// recompressed) get near-identical hashes. Unlike SHA-256, which changes completely with any byte.

const N = 32;

/** DCT-based pHash of a 32 × 32 grey image (row-major, any brightness scale): 16 hex digits. */
export function phashFromGray(gray: ArrayLike<number>): string {
  const cos = Array.from({ length: 8 }, (_, u) => Array.from({ length: N }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))));
  // The lowest 8 × 8 frequencies of the 2-D DCT.
  const coef: number[] = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let y = 0; y < N; y++) {
        const cu = cos[u][y];
        for (let x = 0; x < N; x++) sum += gray[y * N + x] * cu * cos[v][x];
      }
      coef.push(sum);
    }
  }
  const median = [...coef.slice(1)].sort((a, b) => a - b)[31];
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) nibble = (nibble << 1) | (coef[i + b] > median ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

/** Number of differing bits between two 16-hex-digit hashes (0 = same picture, about 32 = unrelated). */
export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** The 32 × 32 grey image turned a quarter turn clockwise. */
export function rotateGray(gray: ArrayLike<number>): Float64Array {
  const out = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out[x * N + (N - 1 - y)] = gray[y * N + x];
  return out;
}

/** Decodes a picture in the browser and scales it to 32 × 32 grey. `trim` cuts dark borders (letterboxed previews). */
export async function grayFromImage(blob: Blob, trim = false): Promise<Float64Array> {
  const bmp = await createImageBitmap(blob);
  try {
    let sx = 0;
    let sy = 0;
    let sw = bmp.width;
    let sh = bmp.height;
    if (trim) {
      const probe = canvas(Math.min(bmp.width, 256), Math.min(bmp.height, 256));
      probe.ctx.drawImage(bmp, 0, 0, probe.w, probe.h);
      const { data } = probe.ctx.getImageData(0, 0, probe.w, probe.h);
      const lum = (x: number, y: number) => {
        const i = (y * probe.w + x) * 4;
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      };
      const rowDark = (y: number) => Array.from({ length: probe.w }, (_, x) => lum(x, y)).every((l) => l < 20);
      const colDark = (x: number) => Array.from({ length: probe.h }, (_, y) => lum(x, y)).every((l) => l < 20);
      let top = 0;
      let bottom = probe.h - 1;
      let left = 0;
      let right = probe.w - 1;
      while (top < bottom && rowDark(top)) top++;
      while (bottom > top && rowDark(bottom)) bottom--;
      while (left < right && colDark(left)) left++;
      while (right > left && colDark(right)) right--;
      const fx = bmp.width / probe.w;
      const fy = bmp.height / probe.h;
      sx = left * fx;
      sy = top * fy;
      sw = Math.max(1, (right - left + 1) * fx);
      sh = Math.max(1, (bottom - top + 1) * fy);
    }
    const c = canvas(N, N);
    c.ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, N, N);
    const { data } = c.ctx.getImageData(0, 0, N, N);
    const gray = new Float64Array(N * N);
    for (let i = 0; i < N * N; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    return gray;
  } finally {
    bmp.close();
  }
}

function canvas(w: number, h: number) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    return { w, h, ctx: c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D };
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { w, h, ctx: c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D };
}
