import {
  bicubicSampleGrid,
  clamp,
  loadCorsTileImageData,
} from './molaDem'

export interface TesScalarTile {
  data: Float32Array
  width: number
  height: number
}

const tesTileCache = new Map<string, Promise<TesScalarTile | null>>()

/** Convert an RGBA pixel from a NASA Mars Trek TES HSV heatmap PNG to scalar abundance [0, 1], or NaN for nodata. */
function rgbaToTesScalar(r: number, g: number, b: number, a: number): number {
  if (a < 16) return Number.NaN

  const rf = r / 255
  const gf = g / 255
  const bf = b / 255
  const maxC = Math.max(rf, gf, bf)
  const minC = Math.min(rf, gf, bf)
  const delta = maxC - minC
  const sat = maxC === 0 ? 0 : delta / maxC

  // Grayscale/black background borders inside global TES PNGs are nodata masks
  if (sat < 0.15 || maxC < 0.08) return Number.NaN

  let hDeg = 0
  if (delta > 0) {
    if (maxC === rf) hDeg = 60 * ((gf - bf) / delta)
    else if (maxC === gf) hDeg = 60 * ((bf - rf) / delta + 2)
    else hDeg = 60 * ((rf - gf) / delta + 4)
    if (hDeg < 0) hDeg += 360
  }

  // Deep red peak values can wrap across 360deg into magenta/crimson (>= 300deg)
  if (hDeg >= 300) return 1
  return clamp((265 - hDeg) / 265, 0, 1)
}

/** Fill isolated NaN nodata texels from valid 8-neighbors so bicubic sampling stays continuous. */
function infillNodataTexels(
  data: Float32Array,
  width: number,
  height: number,
): void {
  let missingCount = 0
  for (let i = 0; i < data.length; i++) {
    if (Number.isNaN(data[i])) missingCount++
  }
  if (missingCount === 0) return

  let src = data
  for (let pass = 0; pass < 8 && missingCount > 0; pass++) {
    const next = new Float32Array(src)
    let remaining = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (!Number.isNaN(src[idx])) continue
        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= width) continue
            const v = src[ny * width + nx]
            if (!Number.isNaN(v)) {
              sum += v
              count++
            }
          }
        }
        if (count > 0) {
          next[idx] = sum / count
        } else {
          remaining++
        }
      }
    }
    src = next
    missingCount = remaining
  }

  for (let i = 0; i < data.length; i++) {
    data[i] = Number.isNaN(src[i]) ? 0 : src[i]
  }
}

/** Load, decode, and cache a NASA MGS TES scalar abundance field from z=1 tile (1/0/2.png). */
export function fetchTesScalarTile(
  url: string,
): Promise<TesScalarTile | null> {
  const existing = tesTileCache.get(url)
  if (existing) return existing

  const promise = loadCorsTileImageData(url).then((imgData) => {
    if (!imgData) return null
    const { data, width, height } = imgData
    const scalar = new Float32Array(width * height)
    for (let i = 0; i < scalar.length; i++) {
      const p = i * 4
      scalar[i] = rgbaToTesScalar(
        data[p],
        data[p + 1],
        data[p + 2],
        data[p + 3],
      )
    }
    infillNodataTexels(scalar, width, height)
    return { data: scalar, width, height }
  })

  tesTileCache.set(url, promise)
  return promise
}

/**
 * Sample continuous scalar abundance [0, 1] at (lat, lon) inside Jezero Crater
 * from MGS TES z=1/0/2.png (covering 0..90 deg E, 0..90 deg N) via bicubic interpolation.
 */
export function sampleTesScalar(
  tile: TesScalarTile,
  lat: number,
  lon: number,
): number {
  const fx = (lon / 90) * tile.width - 0.5
  const fy = ((90 - lat) / 90) * tile.height - 0.5
  return clamp(
    bicubicSampleGrid(tile.data, tile.width, tile.height, fx, fy),
    0,
    1,
  )
}
