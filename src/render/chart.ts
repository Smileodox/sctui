/**
 * Braille line charts and block sparklines.
 *
 * Braille gives 2×4 sub-cell resolution, so an 80×16 pane draws at an
 * effective 160×64 — enough for a price line to read as a curve rather than a
 * staircase. Pure functions; the React wrapper lives in `components/Chart.tsx`.
 */

import { glyphs } from '../theme.js'

/** Dot bit values, indexed as `BRAILLE_DOTS[rowInCell][colInCell]`. */
const BRAILLE_DOTS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
] as const

const BRAILLE_BASE = 0x2800

export interface ChartRenderOptions {
  /** Width in terminal cells. */
  width: number
  /** Height in terminal cells. */
  height: number
}

export interface RenderedChart {
  /** One string per terminal row, top to bottom. */
  rows: string[]
  min: number
  max: number
  /** First and last value of the series, for the change annotation. */
  first: number
  last: number
}

/**
 * Draw `values` as a connected line. Consecutive points are joined vertically
 * so steep moves stay continuous instead of showing as detached dots.
 */
export function brailleChart(values: number[], options: ChartRenderOptions): RenderedChart | undefined {
  const width = Math.max(1, Math.floor(options.width))
  const height = Math.max(1, Math.floor(options.height))

  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) return undefined

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min

  const dotWidth = width * 2
  const dotHeight = height * 4
  const grid = new Uint8Array(width * height)

  // Resample the series onto the dot grid, interpolating between samples.
  const resampled: number[] = new Array(dotWidth)
  for (let x = 0; x < dotWidth; x++) {
    if (clean.length === 1) {
      resampled[x] = clean[0] as number
      continue
    }
    const position = (x / (dotWidth - 1 || 1)) * (clean.length - 1)
    const lower = Math.floor(position)
    const upper = Math.min(clean.length - 1, lower + 1)
    const fraction = position - lower
    resampled[x] = (clean[lower] as number) * (1 - fraction) + (clean[upper] as number) * fraction
  }

  const toDotY = (value: number): number => {
    if (span === 0) return Math.floor((dotHeight - 1) / 2)
    const normalized = (value - min) / span
    return Math.min(dotHeight - 1, Math.max(0, Math.round((1 - normalized) * (dotHeight - 1))))
  }

  let previousY = toDotY(resampled[0] as number)
  for (let x = 0; x < dotWidth; x++) {
    const y = toDotY(resampled[x] as number)
    const from = x === 0 ? y : previousY
    const [lo, hi] = from <= y ? [from, y] : [y, from]
    for (let yy = lo; yy <= hi; yy++) setDot(grid, width, x, yy)
    previousY = y
  }

  const rows: string[] = []
  for (let row = 0; row < height; row++) {
    let line = ''
    for (let col = 0; col < width; col++) {
      const bits = grid[row * width + col] as number
      line += bits === 0 ? ' ' : String.fromCharCode(BRAILLE_BASE + bits)
    }
    rows.push(line)
  }

  return {
    rows,
    min,
    max,
    first: clean[0] as number,
    last: clean[clean.length - 1] as number,
  }
}

function setDot(grid: Uint8Array, cellWidth: number, x: number, y: number): void {
  const cellX = x >> 1
  const cellY = y >> 2
  const index = cellY * cellWidth + cellX
  if (index < 0 || index >= grid.length) return
  const bit = BRAILLE_DOTS[y & 3]?.[x & 1]
  if (bit !== undefined) grid[index] = (grid[index] as number) | bit
}

/**
 * A single-row block sparkline, for inline use in table cells.
 * Returns a string of exactly `width` characters.
 */
export function sparkline(values: number[], width: number): string {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0 || width <= 0) return ' '.repeat(Math.max(0, width))

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min

  // Downsample by bucket-averaging so we never drop the shape of the series.
  const buckets: number[] = []
  for (let i = 0; i < width; i++) {
    const start = Math.floor((i * clean.length) / width)
    const end = Math.max(start + 1, Math.floor(((i + 1) * clean.length) / width))
    let sum = 0
    let count = 0
    for (let j = start; j < end && j < clean.length; j++) {
      sum += clean[j] as number
      count++
    }
    buckets.push(count > 0 ? sum / count : (clean[Math.min(start, clean.length - 1)] as number))
  }

  const levels = glyphs.blocks.length - 1
  return buckets
    .map((value) => {
      const normalized = span === 0 ? 0.5 : (value - min) / span
      const level = Math.max(1, Math.min(levels, Math.round(normalized * levels)))
      return glyphs.blocks[level] as string
    })
    .join('')
}

/**
 * A horizontal bar of `width` cells filled to `ratio` (0–1), using eighth-block
 * characters for sub-cell precision. Used by the allocation breakdown.
 */
export function bar(ratio: number, width: number): string {
  if (width <= 0) return ''
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0))
  const totalEighths = Math.round(clamped * width * 8)
  const fullCells = Math.floor(totalEighths / 8)
  const remainder = totalEighths % 8

  let out = '█'.repeat(Math.min(fullCells, width))
  if (fullCells < width && remainder > 0) out += glyphs.blocks[remainder] as string
  return out.padEnd(width, ' ')
}

/**
 * Pick `count` evenly spaced axis labels from a series, including both ends.
 */
export function axisTicks(count: number, min: number, max: number): number[] {
  if (count <= 1) return [max]
  const ticks: number[] = []
  for (let i = 0; i < count; i++) {
    ticks.push(max - ((max - min) * i) / (count - 1))
  }
  return ticks
}
