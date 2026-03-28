// ─── Pure fractal computation (no DOM / Node deps) ────────────────────────────
// Safe to import in both browser workers and server-side code.

import type { FractalTileInput, FractalTileOutput } from "./shared-types";

// ─── Color palette ────────────────────────────────────────────────────────────
// Clementine-branded: warm cream → orange → crimson → deep purple → near-black
// Cycles for smooth banding across iteration counts.

const KEYFRAME_COLORS: [number, number, number][] = [
  [255, 220, 150],   // warm gold
  [239, 131, 84],    // Clementine orange  #EF8354
  [210, 80, 30],     // burnt orange
  [150, 30, 10],     // red-orange
  [111, 6, 0],       // deep crimson       #6f0600
  [70, 10, 50],      // dark maroon
  [40, 15, 90],      // deep purple
  [15, 25, 100],     // indigo
  [8, 40, 80],       // midnight blue
  [18, 11, 9],       // near-black         #120B09
];

// Pre-compute a 1024-entry smooth palette for fast lookup
const PALETTE_LEN = 1024;
const PALETTE_R = new Uint8Array(PALETTE_LEN);
const PALETTE_G = new Uint8Array(PALETTE_LEN);
const PALETTE_B = new Uint8Array(PALETTE_LEN);

(function buildPalette() {
  const n = KEYFRAME_COLORS.length;
  for (let i = 0; i < PALETTE_LEN; i++) {
    const t = (i / PALETTE_LEN) * (n - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, n - 1);
    const frac = t - lo;
    const [r1, g1, b1] = KEYFRAME_COLORS[lo];
    const [r2, g2, b2] = KEYFRAME_COLORS[hi];
    PALETTE_R[i] = Math.round(r1 + (r2 - r1) * frac);
    PALETTE_G[i] = Math.round(g1 + (g2 - g1) * frac);
    PALETTE_B[i] = Math.round(b1 + (b2 - b1) * frac);
  }
})();

function iterToRgba(iter: number, maxIter: number, zr: number, zi: number): [number, number, number] {
  // Inside the Mandelbrot set → near-black
  if (iter === maxIter) return [18, 11, 9];

  // Smooth (continuous) coloring — removes harsh iteration bands
  const log2 = Math.LN2;
  const logZn = Math.log(zr * zr + zi * zi) * 0.5;
  const nu = Math.log(logZn / log2) / log2;
  const smooth = iter + 1 - nu;

  // Cycle through palette every ~80 smooth iterations
  const t = ((smooth % 80) / 80) * PALETTE_LEN;
  const lo = Math.floor(t) % PALETTE_LEN;
  const hi = (lo + 1) % PALETTE_LEN;
  const frac = t - Math.floor(t);

  const r = Math.round(PALETTE_R[lo] + (PALETTE_R[hi] - PALETTE_R[lo]) * frac);
  const g = Math.round(PALETTE_G[lo] + (PALETTE_G[hi] - PALETTE_G[lo]) * frac);
  const b = Math.round(PALETTE_B[lo] + (PALETTE_B[hi] - PALETTE_B[lo]) * frac);

  return [r, g, b];
}

// ─── Mandelbrot tile computation ──────────────────────────────────────────────

export function computeFractalTile(input: FractalTileInput): FractalTileOutput {
  const {
    tileX, tileY, tileWidth, tileHeight,
    imageWidth, imageHeight,
    xMin, xMax, yMin, yMax,
    maxIterations,
  } = input;

  const pixels = new Array<number>(tileWidth * tileHeight * 4);
  const t0 = Date.now();

  const xScale = (xMax - xMin) / imageWidth;
  const yScale = (yMax - yMin) / imageHeight;

  for (let py = 0; py < tileHeight; py++) {
    const cy = yMin + (tileY + py) * yScale;

    for (let px = 0; px < tileWidth; px++) {
      const cx = xMin + (tileX + px) * xScale;

      let zr = 0.0;
      let zi = 0.0;
      let iter = 0;

      // Mandelbrot iteration with early escape
      while (iter < maxIterations) {
        const zr2 = zr * zr;
        const zi2 = zi * zi;
        if (zr2 + zi2 > 4.0) break;
        zi = 2.0 * zr * zi + cy;
        zr = zr2 - zi2 + cx;
        iter++;
      }

      const [r, g, b] = iterToRgba(iter, maxIterations, zr, zi);
      const idx = (py * tileWidth + px) * 4;
      pixels[idx]     = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }

  return { pixels, durationMs: Date.now() - t0 };
}

// ─── Async chunked variant — yields every CHUNK rows so the event loop breathes
// This prevents the main thread from freezing during large tile computation.

const ASYNC_CHUNK_ROWS = 8;

export async function computeFractalTileAsync(
  input: FractalTileInput,
  onProgress?: (pct: number) => void
): Promise<FractalTileOutput> {
  const {
    tileX, tileY, tileWidth, tileHeight,
    imageWidth, imageHeight,
    xMin, xMax, yMin, yMax,
    maxIterations,
  } = input;

  const pixels = new Array<number>(tileWidth * tileHeight * 4);
  const t0 = Date.now();
  const xScale = (xMax - xMin) / imageWidth;
  const yScale = (yMax - yMin) / imageHeight;

  for (let startRow = 0; startRow < tileHeight; startRow += ASYNC_CHUNK_ROWS) {
    const endRow = Math.min(startRow + ASYNC_CHUNK_ROWS, tileHeight);

    for (let py = startRow; py < endRow; py++) {
      const cy = yMin + (tileY + py) * yScale;

      for (let px = 0; px < tileWidth; px++) {
        const cx = xMin + (tileX + px) * xScale;
        let zr = 0.0, zi = 0.0, iter = 0;

        while (iter < maxIterations) {
          const zr2 = zr * zr;
          const zi2 = zi * zi;
          if (zr2 + zi2 > 4.0) break;
          zi = 2.0 * zr * zi + cy;
          zr = zr2 - zi2 + cx;
          iter++;
        }

        const [r, g, b] = iterToRgba(iter, maxIterations, zr, zi);
        const idx = (py * tileWidth + px) * 4;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;
      }
    }

    onProgress?.(Math.round((endRow / tileHeight) * 100));
    // Yield to event loop so socket events can be processed between chunks
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  return { pixels, durationMs: Date.now() - t0 };
}
