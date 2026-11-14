import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import {
  Crosshair,
  Maximize2,
  RotateCcw,
  Satellite,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  MARS_TREK_JEZERO_CTX_MOSAIC_WMTS_URL,
  MARS_TREK_JEZERO_HIRISE_WMTS_URL,
} from '../data/waypoints'
import {
  coordsToEpsg4326Tile,
  formatWmtsTileUrl,
  metersPerPixelAtLat,
} from '../services/hiriseTiles'
import type { LatLonTuple } from '../types/eva'

interface HiRISEZoomViewerProps {
  coords: LatLonTuple
  title: string
  className?: string
  defaultZoom?: 15 | 16 | 17
  defaultMagnify?: number
  showExpand?: boolean
  onExpand?: () => void
}

const TILE_OFFSETS = [-1, 0, 1] as const
const STAGE_PX = 768 // 3x3 tiles * 256px

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function niceScaleBarMeters(rawMeters: number): number {
  const candidates = [5, 10, 20, 25, 40, 50, 75, 100, 150, 200]
  let best = candidates[0]
  for (const c of candidates) {
    if (Math.abs(c - rawMeters) < Math.abs(best - rawMeters)) {
      best = c
    }
  }
  return best
}

export function HiRISEZoomViewer({
  coords,
  title,
  className = 'h-44 w-full',
  defaultZoom = 17,
  defaultMagnify = 1.15,
  showExpand = true,
  onExpand,
}: HiRISEZoomViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 })

  const [tileZoom, setTileZoom] = useState<15 | 16 | 17>(defaultZoom)
  const [magnify, setMagnify] = useState(defaultMagnify)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [loadedTiles, setLoadedTiles] = useState(0)
  const [failedTiles, setFailedTiles] = useState(0)

  // Isolate drags and wheel zoom inside Leaflet Popups from the map underneath
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    L.DomEvent.disableClickPropagation(el)
    L.DomEvent.disableScrollPropagation(el)
  }, [])

  const hi = coordsToEpsg4326Tile(coords, tileZoom)
  const ctxZoom = Math.min(tileZoom, 16)
  const ctx = coordsToEpsg4326Tile(coords, ctxZoom)
  const ctxRatio = Math.pow(2, tileZoom - ctxZoom)
  const ctxTilePx = 256 * ctxRatio

  const centerPxX = (1 + hi.fracX) * 256
  const centerPxY = (1 + hi.fracY) * 256

  const effectiveMPerPx = metersPerPixelAtLat(coords[0], tileZoom) / magnify
  const targetBarMeters = niceScaleBarMeters(68 * effectiveMPerPx)
  const scaleBarPx = Math.max(
    24,
    Math.min(110, Math.round(targetBarMeters / effectiveMPerPx)),
  )

  const handleStepZoom = (dir: 1 | -1) => {
    if (dir === 1) {
      if (tileZoom < 17) {
        setTileZoom((z) => (z < 17 ? ((z + 1) as 15 | 16 | 17) : z))
      } else {
        setMagnify((m) => clamp(Number((m + 0.35).toFixed(2)), 1, 2.4))
      }
    } else {
      if (magnify > 1.05) {
        setMagnify((m) => clamp(Number((m - 0.35).toFixed(2)), 1, 2.4))
      } else if (tileZoom > 15) {
        setTileZoom((z) => (z > 15 ? ((z - 1) as 15 | 16 | 17) : z))
      }
    }
  }

  const handleReset = () => {
    setTileZoom(defaultZoom)
    setMagnify(defaultMagnify)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.button !== 0) return
        dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return
        e.stopPropagation()
        const dx = e.clientX - dragRef.current.lastX
        const dy = e.clientY - dragRef.current.lastY
        dragRef.current.lastX = e.clientX
        dragRef.current.lastY = e.clientY
        const maxPan = 175 * magnify
        setPan((prev) => ({
          x: clamp(prev.x + dx, -maxPan, maxPan),
          y: clamp(prev.y + dy, -maxPan, maxPan),
        }))
      }}
      onPointerUp={(e) => {
        dragRef.current.active = false
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      }}
      onPointerCancel={() => {
        dragRef.current.active = false
      }}
      onWheel={(e) => {
        e.stopPropagation()
        handleStepZoom(e.deltaY < 0 ? 1 : -1)
      }}
      className={`relative cursor-grab select-none overflow-hidden rounded-lg border border-cyan-500/35 bg-slate-950 active:cursor-grabbing ${className}`}
    >
      {/* Coordinate-Aligned 3x3 Orbital Tile Stage (CTX backdrop + 25cm HiRISE overlay) */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2"
        style={{
          width: `${STAGE_PX}px`,
          height: `${STAGE_PX}px`,
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${magnify}) translate(${-centerPxX}px, ${-centerPxY}px)`,
        }}
      >
        {/* Gap-Free NASA CTX + HRSC Base Tiles */}
        {TILE_OFFSETS.map((dy) =>
          TILE_OFFSETS.map((dx) => {
            const tileX =
              (((ctx.tx + dx) % ctx.worldCols) + ctx.worldCols) % ctx.worldCols
            const tileY = clamp(ctx.ty + dy, 0, ctx.worldRows - 1)
            const url = formatWmtsTileUrl(
              MARS_TREK_JEZERO_CTX_MOSAIC_WMTS_URL,
              ctxZoom,
              tileY,
              tileX,
            )
            const left = centerPxX + (dx - ctx.fracX) * ctxTilePx
            const top = centerPxY + (dy - ctx.fracY) * ctxTilePx
            return (
              <img
                key={`ctx-${ctxZoom}-${tileX}-${tileY}-${dx}-${dy}`}
                src={url}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${ctxTilePx}px`,
                  height: `${ctxTilePx}px`,
                  maxWidth: 'none',
                  opacity: 1,
                }}
                onLoad={() => setLoadedTiles((c) => c + 1)}
                onError={(e) => {
                  e.currentTarget.style.opacity = '0'
                  setFailedTiles((c) => c + 1)
                }}
              />
            )
          }),
        )}

        {/* High-Resolution 25cm/px NASA HiRISE Orthomosaic Tiles */}
        {TILE_OFFSETS.map((dy) =>
          TILE_OFFSETS.map((dx) => {
            const tileX =
              (((hi.tx + dx) % hi.worldCols) + hi.worldCols) % hi.worldCols
            const tileY = clamp(hi.ty + dy, 0, hi.worldRows - 1)
            const url = formatWmtsTileUrl(
              MARS_TREK_JEZERO_HIRISE_WMTS_URL,
              tileZoom,
              tileY,
              tileX,
            )
            return (
              <img
                key={`hirise-${tileZoom}-${tileX}-${tileY}-${dx}-${dy}`}
                src={url}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${(dx + 1) * 256}px`,
                  top: `${(dy + 1) * 256}px`,
                  width: '256px',
                  height: '256px',
                  maxWidth: 'none',
                }}
                onLoad={() => setLoadedTiles((c) => c + 1)}
                onError={(e) => {
                  e.currentTarget.style.opacity = '0'
                  setFailedTiles((c) => c + 1)
                }}
              />
            )
          }),
        )}

        {/* Exact Coordinate Pin Marker inside Stage */}
        <div
          style={{
            position: 'absolute',
            left: `${centerPxX}px`,
            top: `${centerPxY}px`,
            transform: `translate(-50%, -50%) scale(${1 / magnify})`,
          }}
          className="flex items-center justify-center text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.9)]"
        >
          <Crosshair className="h-5 w-5" />
        </div>
      </div>

      {loadedTiles === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/75 px-3 text-center font-mono text-[10px] text-cyan-200">
          {failedTiles >= 18
            ? `Orbital imagery unavailable offline (${coords[0].toFixed(4)}°N, ${coords[1].toFixed(4)}°E)`
            : 'LOADING HIRISE 25CM ORBITAL VIEW...'}
        </div>
      )}

      {/* Top HUD Overlay: Orbital Zoom Badge + Controls */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-400/45 bg-[#090d16]/85 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-cyan-200 backdrop-blur-md">
          <Satellite className="h-3 w-3 text-cyan-400" />
          <span>HIRISE Z{tileZoom}</span>
          <span className="text-slate-400">•</span>
          <span>{(effectiveMPerPx * 100).toFixed(0)}cm/px</span>
        </div>

        <div
          className="pointer-events-auto flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleStepZoom(1)}
            title="Zoom Closer"
            aria-label="Zoom Closer"
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-700/80 bg-[#090d16]/85 text-slate-200 backdrop-blur-md transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => handleStepZoom(-1)}
            title="Zoom Wider"
            aria-label="Zoom Wider"
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-700/80 bg-[#090d16]/85 text-slate-200 backdrop-blur-md transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            title="Recenter on Waypoint"
            aria-label="Recenter on Waypoint"
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-700/80 bg-[#090d16]/85 text-slate-200 backdrop-blur-md transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          {showExpand && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              title="Open High-Res Expanded View"
              aria-label="Open High-Res Expanded View"
              className="flex h-6 items-center gap-1 rounded border border-cyan-400/50 bg-cyan-500/20 px-1.5 font-mono text-[9px] font-bold text-cyan-100 backdrop-blur-md transition hover:bg-cyan-500/35"
            >
              <Maximize2 className="h-2.5 w-2.5" />
              <span>ZOOM</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Caption + Scale Bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-[#090d16]/95 via-[#090d16]/60 to-transparent px-2.5 py-1.5 font-mono text-[9px] text-slate-200">
        <span className="truncate">{title}</span>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-cyan-300">{targetBarMeters} m</span>
          <div
            style={{ width: `${scaleBarPx}px` }}
            className="h-1 border-x border-b border-cyan-300"
          />
        </div>
      </div>
    </div>
  )
}
