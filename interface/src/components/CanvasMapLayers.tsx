import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Coords, DoneCallback } from 'leaflet'
import { useMap } from 'react-leaflet'
import {
  spectralLayerToThresholdPct,
  thermalLayerToThresholdPct,
  topoLayerToMeters,
} from '../data/layerScales'
import { JEZERO_BOUNDS } from '../data/waypoints'
import {
  clamp,
  fetchGrayTile,
  isInsideJezero,
  sampleDemMeters,
} from '../services/molaDem'
import { fetchTesScalarTile, sampleTesScalar } from '../services/tesSpectral'
import type {
  SpectralPalette,
  ThermalBandsCount,
  TopoStepM,
} from '../types/eva'

type ColorStop = readonly [t: number, r: number, g: number, b: number]

// Jezero Crater calibrated hypsometric ramp (-2660m blue floor -> orange/red rim, zero black)
const ELEVATION_PALETTE: readonly ColorStop[] = [
  [0.0, 29, 78, 216], // -2660m Deep Cobalt Blue
  [0.17, 6, 182, 212], // -2527m Cyan Plains
  [0.34, 34, 197, 94], // -2395m Emerald Delta
  [0.52, 250, 204, 21], // -2254m Vivid Yellow
  [0.7, 249, 115, 22], // -2114m Bright Orange
  [0.86, 239, 68, 68], // -1989m Hot Orange-Red (> -2000m)
  [1.0, 220, 38, 38], // -1880m+ Crimson Red
]

// Distinct Red/Blue thermal ramp (cold blue dust/sand -> red hot bedrock)
const THERMAL_PALETTE: readonly ColorStop[] = [
  [0.0, 30, 58, 138], // Deep Blue (coldest dust)
  [0.24, 37, 99, 235], // Royal Blue (cold sand)
  [0.42, 56, 189, 248], // Ice Cyan-Blue
  [0.55, 139, 92, 246], // Cool-Warm Bridge (Violet)
  [0.72, 249, 115, 22], // Warm Orange-Red
  [0.88, 239, 68, 68], // Hot Red (rocky ground)
  [1.0, 220, 38, 38], // Peak Red (high thermal inertia)
]

const SPECTRAL_PALETTES: Record<
  SpectralPalette,
  {
    stops: readonly ColorStop[]
    cutoffRgba: readonly [number, number, number, number]
  }
> = {
  pyroxene: {
    stops: [
      [0.0, 6, 78, 59], // Low Mafic Deep Emerald
      [0.22, 13, 148, 136], // Rich Teal
      [0.45, 16, 185, 129], // Vivid Jade
      [0.68, 163, 230, 53], // Luminous Lime-Chartreuse
      [0.86, 250, 204, 21], // High-Calcium Gold
      [1.0, 245, 158, 11], // Peak Clinopyroxene Amber
    ],
    cutoffRgba: [167, 243, 208, 240],
  },
  plagioclase: {
    stops: [
      [0.0, 49, 46, 129], // Deep Indigo
      [0.24, 109, 40, 217], // Royal Violet
      [0.48, 168, 85, 247], // Orchid Purple
      [0.72, 236, 72, 153], // Vivid Feldspar Magenta
      [0.88, 251, 113, 133], // Bright Rose Pink
      [1.0, 253, 186, 116], // Peak Plagioclase Rose-Gold
    ],
    cutoffRgba: [245, 208, 254, 240],
  },
  dust: {
    stops: [
      [0.0, 51, 65, 85], // Exposed Slate Bedrock
      [0.24, 100, 116, 139], // Cool Silt Grey
      [0.48, 180, 138, 92], // Tan Loess Silt
      [0.72, 217, 119, 6], // Warm Martian Ochre
      [0.88, 234, 88, 12], // Heavy Dust Mantle Orange
      [1.0, 253, 186, 116], // Peak Fine Dust Maxima
    ],
    cutoffRgba: [253, 230, 138, 240],
  },
}

const ELEV_MIN_M = -2660
const ELEV_MAX_M = -1880
const ELEV_SPAN_M = ELEV_MAX_M - ELEV_MIN_M

function samplePalette(
  stops: readonly ColorStop[],
  tInput: number,
): [number, number, number] {
  const t = clamp(tInput, 0, 1)
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i]
    const [t1, r1, g1, b1] = stops[i + 1]
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0 || 1)
      return [
        Math.round(r0 + (r1 - r0) * f),
        Math.round(g0 + (g1 - g0) * f),
        Math.round(b0 + (b1 - b0) * f),
      ]
    }
  }
  const last = stops[stops.length - 1]
  return [last[1], last[2], last[3]]
}

interface ElevationSettings {
  demUrl: string
  minLayerInt: number
  stepM: TopoStepM
}

class JezeroElevationGridLayer extends L.GridLayer {
  private settings: ElevationSettings

  constructor(
    settings: ElevationSettings,
    options?: L.GridLayerOptions,
  ) {
    super(options)
    this.settings = settings
  }

  updateSettings(next: ElevationSettings) {
    if (
      this.settings.demUrl === next.demUrl &&
      this.settings.minLayerInt === next.minLayerInt &&
      this.settings.stepM === next.stepM
    ) {
      return
    }
    this.settings = next
    this.redraw()
  }

  protected createTile(coords: Coords, done: DoneCallback): HTMLElement {
    const tileSize = this.getTileSize()
    const canvas = document.createElement('canvas')
    canvas.width = tileSize.x
    canvas.height = tileSize.y

    const map = this._map
    if (!map) {
      done(undefined, canvas)
      return canvas
    }

    const nwPoint = coords.scaleBy(tileSize)
    const sePoint = nwPoint.add(tileSize)
    const nw = map.unproject(nwPoint, coords.z)
    const se = map.unproject(sePoint, coords.z)

    const { demUrl, minLayerInt, stepM } = this.settings
    const thresholdM = topoLayerToMeters(minLayerInt)

    void fetchGrayTile(demUrl).then((dem) => {
      const ctx = canvas.getContext('2d')
      if (!ctx || !dem) {
        done(undefined, canvas)
        return
      }

      const w = tileSize.x
      const h = tileSize.y
      const gridW = w + 2
      const gridH = h + 2
      const elevGrid = new Float32Array(gridW * gridH)

      const dLat = (se.lat - nw.lat) / h
      const dLon = (se.lng - nw.lng) / w

      for (let gy = 0; gy < gridH; gy++) {
        const lat = nw.lat + (gy - 0.5) * dLat
        for (let gx = 0; gx < gridW; gx++) {
          const lon = nw.lng + (gx - 0.5) * dLon
          elevGrid[gy * gridW + gx] = sampleDemMeters(dem, lat, lon)
        }
      }

      const imgData = ctx.createImageData(w, h)
      const pixels = imgData.data

      for (let y = 0; y < h; y++) {
        const lat = nw.lat + (y + 0.5) * dLat
        for (let x = 0; x < w; x++) {
          const lon = nw.lng + (x + 0.5) * dLon
          const outIdx = (y * w + x) * 4

          if (!isInsideJezero(lat, lon)) {
            pixels[outIdx + 3] = 0
            continue
          }

          const gIdx = (y + 1) * gridW + (x + 1)
          const elev = elevGrid[gIdx]
          const elevRight = elevGrid[gIdx + 1]
          const elevDown = elevGrid[gIdx + gridW]
          const elevLeft = elevGrid[gIdx - 1]
          const elevUp = elevGrid[gIdx - gridW]

          if (minLayerInt > 0 && elev < thresholdM) {
            const touchesCutoff =
              elevRight >= thresholdM ||
              elevDown >= thresholdM ||
              elevLeft >= thresholdM ||
              elevUp >= thresholdM
            if (touchesCutoff) {
              // Crisp gold-orange boundary contour around filtered elevation islands
              pixels[outIdx] = 254
              pixels[outIdx + 1] = 240
              pixels[outIdx + 2] = 138
              pixels[outIdx + 3] = 240
            } else {
              pixels[outIdx + 3] = 0
            }
            continue
          }

          const smoothT = (elev - ELEV_MIN_M) / ELEV_SPAN_M
          const minorBand = Math.floor(elev / stepM)
          const snappedT = (minorBand * stepM - ELEV_MIN_M) / ELEV_SPAN_M

          const [sr, sg, sb] = samplePalette(ELEVATION_PALETTE, smoothT)
          const [br, bg, bb] = samplePalette(ELEVATION_PALETTE, snappedT)

          let r = sr * 0.62 + br * 0.38
          let g = sg * 0.62 + bg * 0.38
          let b = sb * 0.62 + bb * 0.38

          const majorBand = Math.floor(elev / 100)
          const crossesMajor =
            majorBand !== Math.floor(elevRight / 100) ||
            majorBand !== Math.floor(elevDown / 100)
          const crossesMinor =
            minorBand !== Math.floor(elevRight / stepM) ||
            minorBand !== Math.floor(elevDown / stepM)

          if (crossesMajor) {
            r *= 0.62
            g *= 0.62
            b *= 0.62
          } else if (crossesMinor) {
            r *= 0.8
            g *= 0.8
            b *= 0.8
          }

          pixels[outIdx] = Math.round(r)
          pixels[outIdx + 1] = Math.round(g)
          pixels[outIdx + 2] = Math.round(b)
          pixels[outIdx + 3] = 255
        }
      }

      ctx.putImageData(imgData, 0, 0)
      done(undefined, canvas)
    })

    return canvas
  }
}

interface ThermalSettings {
  wmtsUrlTemplate: string
  minLayerInt: number
  bands: ThermalBandsCount
  rawRange: [number, number]
}

interface BandedScalarRenderOptions {
  pixels: Uint8ClampedArray
  width: number
  height: number
  minLayerInt: number
  minNorm: number
  bands: ThermalBandsCount
  palette: readonly ColorStop[]
  cutoffRgba: readonly [number, number, number, number]
  normAt: (px: number, py: number) => number
  includePixel?: (px: number, py: number) => boolean
}

function renderBandedScalarTile({
  pixels,
  width,
  height,
  minLayerInt,
  minNorm,
  bands,
  palette,
  cutoffRgba,
  normAt,
  includePixel,
}: BandedScalarRenderOptions): void {
  const majorEvery = Math.max(2, Math.round(bands / 4))

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4
      if (includePixel && !includePixel(x, y)) {
        pixels[outIdx + 3] = 0
        continue
      }

      const norm = normAt(x, y)
      const normRight = normAt(x + 1, y)
      const normDown = normAt(x, y + 1)

      if (minLayerInt > 0 && norm < minNorm) {
        const touchesCutoff =
          normRight >= minNorm ||
          normDown >= minNorm ||
          normAt(x - 1, y) >= minNorm ||
          normAt(x, y - 1) >= minNorm
        if (touchesCutoff) {
          pixels[outIdx] = cutoffRgba[0]
          pixels[outIdx + 1] = cutoffRgba[1]
          pixels[outIdx + 2] = cutoffRgba[2]
          pixels[outIdx + 3] = cutoffRgba[3]
        } else {
          pixels[outIdx + 3] = 0
        }
        continue
      }

      const band = Math.min(bands - 1, Math.floor(norm * bands))
      const bandCenter = (band + 0.5) / bands
      const bandRight = Math.min(bands - 1, Math.floor(normRight * bands))
      const bandDown = Math.min(bands - 1, Math.floor(normDown * bands))

      const [sr, sg, sb] = samplePalette(palette, norm)
      const [br, bg, bb] = samplePalette(palette, bandCenter)

      let r = sr * 0.6 + br * 0.4
      let g = sg * 0.6 + bg * 0.4
      let b = sb * 0.6 + bb * 0.4

      const majorBand = Math.floor(band / majorEvery)
      const crossesMajor =
        (normRight >= minNorm &&
          majorBand !== Math.floor(bandRight / majorEvery)) ||
        (normDown >= minNorm &&
          majorBand !== Math.floor(bandDown / majorEvery))
      const crossesMinor =
        (normRight >= minNorm && band !== bandRight) ||
        (normDown >= minNorm && band !== bandDown)

      if (crossesMajor) {
        r *= 0.68
        g *= 0.68
        b *= 0.68
      } else if (crossesMinor) {
        r *= 0.85
        g *= 0.85
        b *= 0.85
      }

      pixels[outIdx] = Math.round(r)
      pixels[outIdx + 1] = Math.round(g)
      pixels[outIdx + 2] = Math.round(b)
      pixels[outIdx + 3] = 255
    }
  }
}

class ThemisThermalGridLayer extends L.GridLayer {
  private settings: ThermalSettings

  constructor(settings: ThermalSettings, options?: L.GridLayerOptions) {
    super(options)
    this.settings = settings
  }

  updateSettings(next: ThermalSettings) {
    if (
      this.settings.wmtsUrlTemplate === next.wmtsUrlTemplate &&
      this.settings.minLayerInt === next.minLayerInt &&
      this.settings.bands === next.bands &&
      this.settings.rawRange[0] === next.rawRange[0] &&
      this.settings.rawRange[1] === next.rawRange[1]
    ) {
      return
    }
    this.settings = next
    this.redraw()
  }

  protected createTile(coords: Coords, done: DoneCallback): HTMLElement {
    const tileSize = this.getTileSize()
    const canvas = document.createElement('canvas')
    canvas.width = tileSize.x
    canvas.height = tileSize.y

    const { wmtsUrlTemplate, minLayerInt, bands, rawRange } = this.settings
    const tileUrl = wmtsUrlTemplate
      .replace('{z}', String(coords.z))
      .replace('{y}', String(coords.y))
      .replace('{x}', String(coords.x))

    const [rawMin, rawMax] = rawRange
    const rawSpan = Math.max(1, rawMax - rawMin)
    const minNorm = thermalLayerToThresholdPct(minLayerInt) / 100

    void fetchGrayTile(tileUrl).then((gray) => {
      const ctx = canvas.getContext('2d')
      if (!ctx || !gray) {
        done(undefined, canvas)
        return
      }

      const w = tileSize.x
      const h = tileSize.y
      const imgData = ctx.createImageData(w, h)

      const normAt = (px: number, py: number) => {
        const cx = clamp(px, 0, w - 1)
        const cy = clamp(py, 0, h - 1)
        return clamp((gray[cy * w + cx] - rawMin) / rawSpan, 0, 1)
      }

      renderBandedScalarTile({
        pixels: imgData.data,
        width: w,
        height: h,
        minLayerInt,
        minNorm,
        bands,
        palette: THERMAL_PALETTE,
        cutoffRgba: [254, 215, 170, 240],
        normAt,
      })

      ctx.putImageData(imgData, 0, 0)
      done(undefined, canvas)
    })

    return canvas
  }
}

interface SpectralSettings {
  wmtsUrl: string
  minLayerInt: number
  bands: ThermalBandsCount
  rawRange: [number, number]
  palette: SpectralPalette
}

class TesSpectralGridLayer extends L.GridLayer {
  private settings: SpectralSettings

  constructor(settings: SpectralSettings, options?: L.GridLayerOptions) {
    super(options)
    this.settings = settings
  }

  updateSettings(next: SpectralSettings) {
    if (
      this.settings.wmtsUrl === next.wmtsUrl &&
      this.settings.minLayerInt === next.minLayerInt &&
      this.settings.bands === next.bands &&
      this.settings.rawRange[0] === next.rawRange[0] &&
      this.settings.rawRange[1] === next.rawRange[1] &&
      this.settings.palette === next.palette
    ) {
      return
    }
    this.settings = next
    this.redraw()
  }

  protected createTile(coords: Coords, done: DoneCallback): HTMLElement {
    const tileSize = this.getTileSize()
    const canvas = document.createElement('canvas')
    canvas.width = tileSize.x
    canvas.height = tileSize.y

    const map = this._map
    if (!map) {
      done(undefined, canvas)
      return canvas
    }

    const nwPoint = coords.scaleBy(tileSize)
    const sePoint = nwPoint.add(tileSize)
    const nw = map.unproject(nwPoint, coords.z)
    const se = map.unproject(sePoint, coords.z)

    const { wmtsUrl, minLayerInt, bands, rawRange, palette } = this.settings
    const [rawMin, rawMax] = rawRange
    const rawSpan = Math.max(0.01, rawMax - rawMin)
    const minNorm = spectralLayerToThresholdPct(minLayerInt) / 100
    const paletteCfg = SPECTRAL_PALETTES[palette]

    void fetchTesScalarTile(wmtsUrl).then((scalarTile) => {
      const ctx = canvas.getContext('2d')
      if (!ctx || !scalarTile) {
        done(undefined, canvas)
        return
      }

      const w = tileSize.x
      const h = tileSize.y
      const gridW = w + 2
      const gridH = h + 2
      const normGrid = new Float32Array(gridW * gridH)

      const dLat = (se.lat - nw.lat) / h
      const dLon = (se.lng - nw.lng) / w

      for (let gy = 0; gy < gridH; gy++) {
        const lat = nw.lat + (gy - 0.5) * dLat
        for (let gx = 0; gx < gridW; gx++) {
          const lon = nw.lng + (gx - 0.5) * dLon
          const raw = sampleTesScalar(scalarTile, lat, lon)
          normGrid[gy * gridW + gx] = clamp((raw - rawMin) / rawSpan, 0, 1)
        }
      }

      const imgData = ctx.createImageData(w, h)
      renderBandedScalarTile({
        pixels: imgData.data,
        width: w,
        height: h,
        minLayerInt,
        minNorm,
        bands,
        palette: paletteCfg.stops,
        cutoffRgba: paletteCfg.cutoffRgba,
        normAt: (px, py) => normGrid[(py + 1) * gridW + (px + 1)],
        includePixel: (px, py) =>
          isInsideJezero(nw.lat + (py + 0.5) * dLat, nw.lng + (px + 0.5) * dLon),
      })

      ctx.putImageData(imgData, 0, 0)
      done(undefined, canvas)
    })

    return canvas
  }
}

export function JezeroElevationLayer({
  demUrl,
  opacity,
  minLayerInt,
  stepM,
  maxNativeZoom = 13,
  zIndex = 10,
  attribution = 'NASA / JPL MOLA',
}: {
  demUrl: string
  opacity: number
  minLayerInt: number
  stepM: TopoStepM
  maxNativeZoom?: number
  zIndex?: number
  attribution?: string
}) {
  const map = useMap()
  const layerRef = useRef<JezeroElevationGridLayer | null>(null)

  useEffect(() => {
    const layer = new JezeroElevationGridLayer(
      { demUrl, minLayerInt, stepM },
      {
        bounds: JEZERO_BOUNDS,
        minZoom: 7,
        maxNativeZoom,
        maxZoom: 17,
        opacity,
        zIndex,
        attribution,
      },
    )
    layer.addTo(map)
    layerRef.current = layer

    return () => {
      layer.remove()
      layerRef.current = null
    }
    // Recreate only if underlying tile source, zoom range, or attribution changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, demUrl, maxNativeZoom, attribution])

  useEffect(() => {
    layerRef.current?.setOpacity(opacity)
  }, [opacity])

  useEffect(() => {
    layerRef.current?.setZIndex(zIndex)
  }, [zIndex])

  useEffect(() => {
    layerRef.current?.updateSettings({ demUrl, minLayerInt, stepM })
  }, [demUrl, minLayerInt, stepM])

  return null
}

export function ThemisThermalCanvasLayer({
  wmtsUrl,
  opacity,
  minLayerInt,
  bands,
  rawRange,
  maxNativeZoom = 9,
  zIndex = 11,
  attribution = 'NASA / JPL / ASU THEMIS',
}: {
  wmtsUrl: string
  opacity: number
  minLayerInt: number
  bands: ThermalBandsCount
  rawRange: [number, number]
  maxNativeZoom?: number
  zIndex?: number
  attribution?: string
}) {
  const map = useMap()
  const layerRef = useRef<ThemisThermalGridLayer | null>(null)
  const rawMin = rawRange[0]
  const rawMax = rawRange[1]

  useEffect(() => {
    const layer = new ThemisThermalGridLayer(
      {
        wmtsUrlTemplate: wmtsUrl,
        minLayerInt,
        bands,
        rawRange: [rawMin, rawMax],
      },
      {
        bounds: JEZERO_BOUNDS,
        minZoom: 7,
        maxNativeZoom,
        maxZoom: 17,
        opacity,
        zIndex,
        attribution,
      },
    )
    layer.addTo(map)
    layerRef.current = layer

    return () => {
      layer.remove()
      layerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, wmtsUrl, maxNativeZoom, attribution])

  useEffect(() => {
    layerRef.current?.setOpacity(opacity)
  }, [opacity])

  useEffect(() => {
    layerRef.current?.setZIndex(zIndex)
  }, [zIndex])

  useEffect(() => {
    layerRef.current?.updateSettings({
      wmtsUrlTemplate: wmtsUrl,
      minLayerInt,
      bands,
      rawRange: [rawMin, rawMax],
    })
  }, [wmtsUrl, minLayerInt, bands, rawMin, rawMax])

  return null
}

export function TesSpectralCanvasLayer({
  wmtsUrl,
  opacity,
  minLayerInt,
  bands,
  rawRange,
  palette,
  maxNativeZoom = 13,
  zIndex = 13,
  attribution = 'NASA / JPL / ASU MGS TES',
}: {
  wmtsUrl: string
  opacity: number
  minLayerInt: number
  bands: ThermalBandsCount
  rawRange: [number, number]
  palette: SpectralPalette
  maxNativeZoom?: number
  zIndex?: number
  attribution?: string
}) {
  const map = useMap()
  const layerRef = useRef<TesSpectralGridLayer | null>(null)
  const rawMin = rawRange[0]
  const rawMax = rawRange[1]

  useEffect(() => {
    const layer = new TesSpectralGridLayer(
      {
        wmtsUrl,
        minLayerInt,
        bands,
        rawRange: [rawMin, rawMax],
        palette,
      },
      {
        bounds: JEZERO_BOUNDS,
        minZoom: 7,
        maxNativeZoom,
        maxZoom: 17,
        opacity,
        zIndex,
        attribution,
      },
    )
    layer.addTo(map)
    layerRef.current = layer

    return () => {
      layer.remove()
      layerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, wmtsUrl, maxNativeZoom, attribution])

  useEffect(() => {
    layerRef.current?.setOpacity(opacity)
  }, [opacity])

  useEffect(() => {
    layerRef.current?.setZIndex(zIndex)
  }, [zIndex])

  useEffect(() => {
    layerRef.current?.updateSettings({
      wmtsUrl,
      minLayerInt,
      bands,
      rawRange: [rawMin, rawMax],
      palette,
    })
  }, [wmtsUrl, minLayerInt, bands, rawMin, rawMax, palette])

  return null
}
