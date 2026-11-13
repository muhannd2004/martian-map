import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import type { Feature, Polygon } from 'geojson'
import {
  GeoJSON,
  ImageOverlay,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import {
  JEZERO_GEOLOGIC_UNITS,
  PERSEVERANCE_TRAVERSE,
} from '../data/geologicUnits'
import {
  JezeroElevationLayer,
  ThemisThermalCanvasLayer,
} from './CanvasMapLayers'
import {
  JEZERO_BOUNDS,
  JEZERO_CENTER,
  JEZERO_DEFAULT_ZOOM,
  JEZERO_WAYPOINTS,
  MARS_TREK_JEZERO_CTX_MOSAIC_WMTS_URL,
  MARS_TREK_JEZERO_HIRISE_WMTS_URL,
} from '../data/waypoints'
import type {
  EvaRoutePlan,
  GeologicUnitProperties,
  LatLonTuple,
  LayerConfig,
  LayerId,
  RasterAvailabilityMap,
  Waypoint,
  WaypointCategory,
} from '../types/eva'

interface MarsMapProps {
  layers: LayerConfig[]
  rasterStatus: RasterAvailabilityMap
  routePlan: EvaRoutePlan
  startWaypointId: string
  targetWaypointId: string
  selectedWaypointId: string
  stormMode: boolean
  onSelectWaypoint: (waypointId: string) => void
  onSetStart: (waypointId: string) => void
  onSetTarget: (waypointId: string) => void
  onStartRouteFromPin: (waypointId: string) => void
}

const CATEGORY_COLORS: Record<
  WaypointCategory,
  { ring: string; core: string; badge: string }
> = {
  habitat: {
    ring: 'rgba(34, 211, 238, 0.55)',
    core: '#22d3ee',
    badge: 'HAB',
  },
  hazard: {
    ring: 'rgba(239, 68, 68, 0.6)',
    core: '#ef4444',
    badge: 'HAZ',
  },
  geology: {
    ring: 'rgba(245, 158, 11, 0.55)',
    core: '#f59e0b',
    badge: 'GEO',
  },
  climb: {
    ring: 'rgba(251, 146, 60, 0.55)',
    core: '#fb923c',
    badge: 'RAMP',
  },
  astrobiology: {
    ring: 'rgba(16, 185, 129, 0.6)',
    core: '#10b981',
    badge: 'BIO',
  },
}

function createWaypointDivIcon(
  waypoint: Waypoint,
  role: 'start' | 'target' | 'none',
  isSelected: boolean,
): L.DivIcon {
  const palette = CATEGORY_COLORS[waypoint.category]
  const roleTag =
    role === 'start' ? 'START' : role === 'target' ? 'DEST' : palette.badge
  const haloSize = isSelected || role !== 'none' ? 28 : 22

  const html = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
      <div style="
        width:${haloSize}px;
        height:${haloSize}px;
        border-radius:9999px;
        background:${palette.ring};
        border:2px solid ${isSelected ? '#ffffff' : palette.core};
        box-shadow:0 0 14px ${palette.core};
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <div style="width:8px;height:8px;border-radius:9999px;background:#090d16;border:2px solid #f8fafc;"></div>
      </div>
      <div style="
        margin-top:4px;
        padding:1px 6px;
        border-radius:4px;
        background:rgba(9,13,22,0.9);
        border:1px solid ${isSelected ? '#38bdf8' : 'rgba(148,163,184,0.35)'};
        color:#f1f5f9;
        font-family:ui-monospace,monospace;
        font-size:10px;
        font-weight:700;
        white-space:nowrap;
        letter-spacing:0.04em;
      ">${roleTag} · ${waypoint.shortLabel.split('//')[1]?.trim() ?? waypoint.name}</div>
    </div>
  `

  return L.divIcon({
    className: 'ares-div-icon',
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function MapCursorTracker({
  onCursorMove,
}: {
  onCursorMove: (coords: LatLonTuple | null) => void
}) {
  useMapEvents({
    mousemove(e) {
      onCursorMove([e.latlng.lat, e.latlng.lng])
    },
    mouseout() {
      onCursorMove(null)
    },
  })
  return null
}

function PinPopupContent({
  waypoint,
  role,
  onSetStart,
  onSetTarget,
  onStartRouteFromPin,
}: {
  waypoint: Waypoint
  role: 'start' | 'target' | 'none'
  onSetStart: (waypointId: string) => void
  onSetTarget: (waypointId: string) => void
  onStartRouteFromPin: (waypointId: string) => void
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="w-[238px] space-y-2 text-slate-100">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
            role === 'start'
              ? 'border border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
              : role === 'target'
                ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                : 'border border-slate-600/60 bg-slate-800/80 text-slate-300'
          }`}
        >
          {role === 'start'
            ? `START • ${waypoint.shortLabel}`
            : role === 'target'
              ? `TARGET • ${waypoint.shortLabel}`
              : waypoint.shortLabel}
        </span>
        <span className="font-mono text-[10px] text-slate-300">
          {waypoint.elevationM} m
        </span>
      </div>

      <div>
        <div className="text-xs font-semibold text-white">{waypoint.name}</div>
        <div className="mt-0.5 font-mono text-[10px] text-cyan-300">
          {waypoint.geologicUnit}
        </div>
      </div>

      {!imgError ? (
        <div className="overflow-hidden rounded border border-slate-700/70 bg-slate-950">
          <img
            src={waypoint.povImageUrl}
            alt={waypoint.povTitle}
            className="h-24 w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="flex h-16 items-center justify-center rounded border border-slate-700/70 bg-slate-950/90 px-2 text-center font-mono text-[10px] text-slate-400">
          Mastcam-Z preview unavailable offline
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
        <div className="rounded bg-slate-900/90 px-1.5 py-1">
          <div className="text-[9px] text-slate-500">TEMP</div>
          <div className="text-slate-200">{waypoint.telemetry.tempC}°C</div>
        </div>
        <div className="rounded bg-slate-900/90 px-1.5 py-1">
          <div className="text-[9px] text-slate-500">WIND</div>
          <div className="text-slate-200">{waypoint.telemetry.windMs} m/s</div>
        </div>
        <div className="rounded bg-slate-900/90 px-1.5 py-1">
          <div className="text-[9px] text-slate-500">RAD</div>
          <div className="text-cyan-200">
            {waypoint.telemetry.radiationMsvDay.toFixed(2)} mSv/d
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSetStart(waypoint.id)
          }}
          disabled={role === 'start'}
          className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
            role === 'start'
              ? 'cursor-default border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
              : 'cursor-pointer border-slate-700 bg-slate-900/90 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200'
          }`}
        >
          {role === 'start' ? 'ACTIVE START' : 'SET START'}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSetTarget(waypoint.id)
          }}
          disabled={role === 'target'}
          className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
            role === 'target'
              ? 'cursor-default border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
              : 'cursor-pointer border-slate-700 bg-slate-900/90 text-slate-200 hover:border-emerald-400/50 hover:text-emerald-200'
          }`}
        >
          {role === 'target' ? 'ACTIVE TARGET' : 'SET TARGET'}
        </button>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onStartRouteFromPin(waypoint.id)
        }}
        className="w-full cursor-pointer rounded border border-emerald-400/55 bg-emerald-500/20 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-wider text-emerald-100 transition-colors hover:bg-emerald-500/30"
      >
        START ROUTE BRIEF
      </button>
    </div>
  )
}

function MapBoundsManager() {
  const map = useMap()

  useEffect(() => {
    const syncBoundsAndCoverZoom = () => {
      map.invalidateSize({ pan: false })
      const size = map.getSize()
      if (size.x <= 0 || size.y <= 0) return

      // Reset minZoom briefly so shrinking/expanding viewport can lower or raise cover zoom
      map.setMinZoom(0)
      const coverZoom = map.getBoundsZoom(JEZERO_BOUNDS, true)
      map.setMinZoom(coverZoom)

      if (map.getZoom() < coverZoom) {
        map.setZoom(coverZoom, { animate: false })
      }
      map.panInsideBounds(JEZERO_BOUNDS, { animate: false })
    }

    syncBoundsAndCoverZoom()
    const timer = window.setTimeout(syncBoundsAndCoverZoom, 180)

    const container = map.getContainer()
    const resizeObserver = new ResizeObserver(() => {
      syncBoundsAndCoverZoom()
    })
    resizeObserver.observe(container)

    return () => {
      window.clearTimeout(timer)
      resizeObserver.disconnect()
    }
  }, [map])

  return null
}

export function MarsMap({
  layers,
  rasterStatus,
  routePlan,
  startWaypointId,
  targetWaypointId,
  selectedWaypointId,
  stormMode,
  onSelectWaypoint,
  onSetStart,
  onSetTarget,
  onStartRouteFromPin,
}: MarsMapProps) {
  const [cursorCoords, setCursorCoords] = useState<LatLonTuple | null>(null)

  const layerById = useMemo(() => {
    const record = {} as Record<LayerId, LayerConfig>
    for (const layer of layers) {
      record[layer.id] = layer
    }
    return record
  }, [layers])

  const routeGlowColor = stormMode ? '#f59e0b' : '#06b6d4'
  const routeCoreColor = stormMode ? '#fef08a' : '#34d399'

  return (
    <div className="relative isolate h-full w-full flex-1 overflow-hidden bg-[#090d16]">
      <MapContainer
        crs={L.CRS.EPSG4326}
        center={JEZERO_CENTER}
        zoom={JEZERO_DEFAULT_ZOOM}
        minZoom={8}
        maxZoom={17}
        zoomSnap={0.05}
        zoomDelta={0.5}
        maxBounds={JEZERO_BOUNDS}
        maxBoundsViscosity={1.0}
        zoomControl={true}
        className="h-full w-full"
      >
        <MapCursorTracker onCursorMove={setCursorCoords} />
        <MapBoundsManager />

        {/* 1. Permanent Jezero Base Backdrop: Gap-free NASA Mars Trek HiRISE+CTX+HRSC */}
        <TileLayer
          url={MARS_TREK_JEZERO_CTX_MOSAIC_WMTS_URL}
          bounds={JEZERO_BOUNDS}
          minZoom={8}
          maxNativeZoom={16}
          maxZoom={17}
          opacity={1}
          zIndex={1}
          attribution="NASA / JPL / Mars Trek (HiRISE+CTX+HRSC)"
        />

        {/* 2. Permanent Live NASA Mars Trek 25cm HiRISE Optical (Full Jezero Mosaic) */}
        <TileLayer
          url={MARS_TREK_JEZERO_HIRISE_WMTS_URL}
          bounds={JEZERO_BOUNDS}
          minZoom={8}
          maxNativeZoom={17}
          maxZoom={17}
          opacity={0.92}
          zIndex={2}
          attribution="NASA / JPL / UofA HiRISE"
        />

        {/* 3. Processed Canvas Layers: MOLA Topographic Elevation & THEMIS Red/Blue Thermal */}
        {layers.map((layer) => {
          if (!layer.visible || !layer.wmtsUrl) return null

          if (layer.kind === 'mola-dem') {
            return (
              <JezeroElevationLayer
                key={layer.id}
                demUrl={layer.wmtsUrl}
                opacity={layer.opacity}
                minLayerInt={layer.topoMinLayer ?? 0}
                stepM={layer.topoStepM ?? 50}
                maxNativeZoom={layer.maxNativeZoom ?? 13}
                zIndex={layer.zIndex ?? 10}
                attribution={layer.attribution}
              />
            )
          }

          if (layer.kind === 'themis-thermal') {
            return (
              <ThemisThermalCanvasLayer
                key={layer.id}
                wmtsUrl={layer.wmtsUrl}
                opacity={layer.opacity}
                minLayerInt={layer.thermalMinLayer ?? 0}
                bands={layer.thermalBands ?? 12}
                rawRange={layer.thermalRawRange ?? [32, 190]}
                maxNativeZoom={layer.maxNativeZoom ?? 9}
                zIndex={layer.zIndex ?? 11}
                attribution={layer.attribution}
              />
            )
          }

          return null
        })}

        {/* 4. USGS Geologic & Trafficability Zones */}
        {layerById.geologicZones.visible && (
          <GeoJSON
            data={JEZERO_GEOLOGIC_UNITS}
            style={(feature) => {
              const props = feature?.properties as
                | GeologicUnitProperties
                | undefined
              return {
                color: props?.strokeColor ?? '#38bdf8',
                fillColor: props?.fillColor ?? '#38bdf8',
                weight: 1.5,
                dashArray: props?.hazardLevel === 'extreme' ? '5 4' : undefined,
                fillOpacity: layerById.geologicZones.opacity * 0.45,
                opacity: Math.min(1, layerById.geologicZones.opacity + 0.2),
              }
            }}
            onEachFeature={(
              feature: Feature<Polygon, GeologicUnitProperties>,
              layer,
            ) => {
              const p = feature.properties
              layer.bindTooltip(
                `<div style="font-family:ui-monospace,monospace;font-size:11px;">
                  <div style="font-weight:700;color:#f8fafc;">${p.name}</div>
                  <div style="color:#94a3b8;margin-top:2px;">Slope: ${p.slopeRange}</div>
                  <div style="color:#38bdf8;margin-top:2px;">${p.trafficability}</div>
                </div>`,
                { sticky: true, className: 'ares-tooltip' },
              )
            }}
          />
        )}

        {/* Perseverance Historical Traverse */}
        {layerById.perseveranceTraverse.visible && (
          <Polyline
            positions={PERSEVERANCE_TRAVERSE}
            pathOptions={{
              color: '#cbd5e1',
              weight: 2,
              dashArray: '4 6',
              opacity: layerById.perseveranceTraverse.opacity,
            }}
          >
            <Tooltip sticky className="ares-tooltip">
              <span className="font-mono text-[11px]">
                Mars 2020 Perseverance Historical Traverse (Reference)
              </span>
            </Tooltip>
          </Polyline>
        )}

        {/* Calculated EVA Route Polyline (Outer Glow + Inner Core) */}
        {routePlan.coordinates.length > 1 && (
          <>
            <Polyline
              positions={routePlan.coordinates}
              pathOptions={{
                color: routeGlowColor,
                weight: 8,
                opacity: 0.28,
              }}
            />
            <Polyline
              positions={routePlan.coordinates}
              pathOptions={{
                color: routeCoreColor,
                weight: 3,
                dashArray: stormMode ? '8 6' : undefined,
                opacity: 0.95,
              }}
            />
          </>
        )}

        {/* 5 Jezero Waypoint Markers (Custom L.divIcon) */}
        {JEZERO_WAYPOINTS.map((wp) => {
          const role =
            wp.id === startWaypointId
              ? 'start'
              : wp.id === targetWaypointId
                ? 'target'
                : 'none'
          const isSelected = wp.id === selectedWaypointId
          const icon = createWaypointDivIcon(wp, role, isSelected)

          return (
            <Marker
              key={wp.id}
              position={wp.coords}
              icon={icon}
              eventHandlers={{
                click: () => onSelectWaypoint(wp.id),
              }}
            >
              <Popup maxWidth={270} minWidth={235}>
                <PinPopupContent
                  key={wp.id}
                  waypoint={wp}
                  role={role}
                  onSetStart={onSetStart}
                  onSetTarget={onSetTarget}
                  onStartRouteFromPin={onStartRouteFromPin}
                />
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Bottom-Left Cursor Coordinate & Projection HUD */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-col gap-1.5">
        <div className="rounded-md border border-cyan-500/30 bg-[#090d16]/90 px-3 py-1.5 font-mono text-[11px] text-slate-200 shadow-lg backdrop-blur-md">
          {cursorCoords ? (
            <span>
              LAT{' '}
              <strong className="text-cyan-300">
                {cursorCoords[0].toFixed(4)}°N
              </strong>{' '}
              • LON{' '}
              <strong className="text-cyan-300">
                {cursorCoords[1].toFixed(4)}°E
              </strong>
            </span>
          ) : (
            <span className="text-slate-400">
              JEZERO DELTA • MOVE CURSOR FOR (LAT, LON)
            </span>
          )}
        </div>
      </div>

      {/* Top-Center Route Advisory Overlay */}
      <div className="pointer-events-none absolute top-3 left-1/2 z-[400] -translate-x-1/2">
        <div
          className={`rounded-full border px-3.5 py-1 font-mono text-[11px] shadow-lg backdrop-blur-md ${
            stormMode
              ? 'border-amber-400/60 bg-amber-950/85 text-amber-200'
              : 'border-cyan-500/35 bg-[#090d16]/85 text-cyan-200'
          }`}
        >
          {stormMode
            ? 'STORM ROUTE: SHELTERED LEEWARD CORRIDOR'
            : `NOMINAL ROUTE • MAX SLOPE ≤ ${routePlan.maxSlopeLimitDeg}°`}
        </div>
      </div>
    </div>
  )
}
