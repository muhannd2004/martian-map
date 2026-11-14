import type { LatLonTuple } from '../types/eva'

const MARS_RADIUS_M = 3_389_500
const MARS_CIRCUMFERENCE_M = 2 * Math.PI * MARS_RADIUS_M

export interface Epsg4326TilePosition {
  z: number
  tx: number
  ty: number
  fracX: number
  fracY: number
  fx: number
  fy: number
  worldCols: number
  worldRows: number
}

/** Convert (lat, lon) to NASA Mars Trek EPSG:4326 WMTS tile coordinates and sub-tile offset. */
export function coordsToEpsg4326Tile(
  coords: LatLonTuple,
  z: number,
): Epsg4326TilePosition {
  const [lat, lon] = coords
  const worldCols = Math.pow(2, z + 1)
  const worldRows = Math.pow(2, z)

  const fx = ((lon + 180) / 360) * worldCols
  const fy = ((90 - lat) / 180) * worldRows

  const rawTx = Math.floor(fx)
  const rawTy = Math.floor(fy)

  return {
    z,
    tx: ((rawTx % worldCols) + worldCols) % worldCols,
    ty: Math.max(0, Math.min(worldRows - 1, rawTy)),
    fracX: fx - rawTx,
    fracY: fy - rawTy,
    fx,
    fy,
    worldCols,
    worldRows,
  }
}

/** Format a WMTS template URL using z, y, x indices. */
export function formatWmtsTileUrl(
  template: string,
  z: number,
  ty: number,
  tx: number,
): string {
  return template
    .replace('{z}', String(z))
    .replace('{y}', String(ty))
    .replace('{x}', String(tx))
}

/** Ground sampling scale (meters per pixel) at a given Jezero latitude and WMTS zoom level. */
export function metersPerPixelAtLat(lat: number, z: number): number {
  const worldWidthPx = Math.pow(2, z + 1) * 256
  return (MARS_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / worldWidthPx
}
