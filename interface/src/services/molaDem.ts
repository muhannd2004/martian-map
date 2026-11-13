import {
  JEZERO_BOUNDS,
  JEZERO_WAYPOINTS,
  MARS_TREK_MOLA_ELEVATION_WMTS_URL,
} from '../data/waypoints'

// Tile cache storing luminance (0..255) buffers for loaded NASA CORS PNGs
const tileGrayCache = new Map<string, Promise<Uint8Array | null>>()
const resolvedGrayCache = new Map<string, Uint8Array>()

/** Clamp a numeric value to [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Load and cache a grayscale luminance buffer from a CORS-enabled NASA PNG tile. */
export function fetchGrayTile(url: string): Promise<Uint8Array | null> {
  const existing = tileGrayCache.get(url)
  if (existing) return existing

  const promise = new Promise<Uint8Array | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = img.width || 256
        const h = img.height || 256
        const off = document.createElement('canvas')
        off.width = w
        off.height = h
        const ctx = off.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        const { data } = ctx.getImageData(0, 0, w, h)
        const gray = new Uint8Array(w * h)
        for (let i = 0; i < gray.length; i++) {
          gray[i] = data[i * 4]
        }
        resolvedGrayCache.set(url, gray)
        resolve(gray)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })

  tileGrayCache.set(url, promise)
  return promise
}

/** Synchronously read a previously resolved grayscale tile buffer if available. */
export function peekGrayTile(url: string): Uint8Array | null {
  return resolvedGrayCache.get(url) ?? null
}

function cubicHermiteClamped(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  f: number,
): number {
  const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3
  const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3
  const c = -0.5 * p0 + 0.5 * p2
  const val = ((a * f + b) * f + c) * f + p1
  const minNeighbor = Math.min(p1, p2)
  const maxNeighbor = Math.max(p1, p2)
  return clamp(val, minNeighbor - 0.25, maxNeighbor + 0.25)
}

/** Sample calibrated Jezero elevation (meters) from the z=5 MOLA luminance buffer. */
export function sampleDemMeters(
  dem: Uint8Array,
  lat: number,
  lon: number,
): number {
  // Source tile is Mars_MOLA z=5 tile (x=45, y=12): 64 cols x 32 rows @ 256px
  const fx = ((lon + 180) / 360 * 64 - 45) * 256 - 0.5
  const fy = ((90 - lat) / 180 * 32 - 12) * 256 - 0.5

  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy

  const at = (x: number, y: number) => {
    const cx = clamp(x, 0, 255)
    const cy = clamp(y, 0, 255)
    return dem[cy * 256 + cx]
  }

  let rowVals0 = 0
  let rowVals1 = 0
  let rowVals2 = 0
  let rowVals3 = 0

  for (let rowOffset = -1; rowOffset <= 2; rowOffset++) {
    const yy = iy + rowOffset
    const v = cubicHermiteClamped(
      at(ix - 1, yy),
      at(ix, yy),
      at(ix + 1, yy),
      at(ix + 2, yy),
      tx,
    )
    if (rowOffset === -1) rowVals0 = v
    else if (rowOffset === 0) rowVals1 = v
    else if (rowOffset === 1) rowVals2 = v
    else rowVals3 = v
  }

  const demL = cubicHermiteClamped(rowVals0, rowVals1, rowVals2, rowVals3, ty)
  // Calibrated to Jezero waypoints (Butler Landing L=81 -> -2568m, Bright Angel L=84 -> -2432m)
  return -2568 + (demL - 81) * (136 / 3)
}

/**
 * Return calibrated Jezero elevation (meters) from the cached MOLA buffer when loaded,
 * falling back to an IDW estimate across known mission waypoints before the tile finishes.
 */
export function estimateJezeroElevationM(lat: number, lon: number): number {
  const cachedDem = peekGrayTile(MARS_TREK_MOLA_ELEVATION_WMTS_URL)
  if (cachedDem) {
    return Math.round(sampleDemMeters(cachedDem, lat, lon))
  }

  let weightedSum = 0
  let totalWeight = 0
  for (const wp of JEZERO_WAYPOINTS) {
    const dLat = lat - wp.coords[0]
    const dLon = lon - wp.coords[1]
    const distSq = dLat * dLat + dLon * dLon
    if (distSq < 1e-10) return wp.elevationM
    const w = 1 / distSq
    weightedSum += wp.elevationM * w
    totalWeight += w
  }
  return Math.round(weightedSum / (totalWeight || 1))
}

/** Check whether coordinates lie within the Jezero CTX orthographic mosaic bounds. */
export function isInsideJezero(lat: number, lon: number): boolean {
  return (
    lat >= JEZERO_BOUNDS[0][0] &&
    lat <= JEZERO_BOUNDS[1][0] &&
    lon >= JEZERO_BOUNDS[0][1] &&
    lon <= JEZERO_BOUNDS[1][1]
  )
}
