import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import type { Marker as LeafletMarker } from 'leaflet'
import type { Feature, Polygon } from 'geojson'
import {
  GeoJSON,
  MapContainer,
  Marker,
  Polygon as LeafletPolygon,
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
  TesSpectralCanvasLayer,
  ThemisThermalCanvasLayer,
} from './CanvasMapLayers'
import { WaypointMediaViewer } from './WaypointMediaViewer'
import {
  JEZERO_BOUNDS,
  JEZERO_CENTER,
  JEZERO_DEFAULT_ZOOM,
  MARS_TREK_JEZERO_CTX_MOSAIC_WMTS_URL,
  MARS_TREK_JEZERO_HIRISE_WMTS_URL,
} from '../data/waypoints'
import type {
  AvoidableArea,
  EvaRoutePlan,
  GeologicUnitProperties,
  LatLonTuple,
  LayerConfig,
  LayerId,
  Waypoint,
  WaypointCategory,
} from '../types/eva'

interface MarsMapProps {
  layers: LayerConfig[]
  routePlan: EvaRoutePlan
  routeLoading: boolean
  waypoints: Waypoint[]
  probeWaypoint: Waypoint | null
  startWaypointId: string
  targetWaypointId: string
  selectedWaypointId: string
  stormMode: boolean
  avoidableAreas: AvoidableArea[]
  isDrawingAvoidableArea: boolean
  draftAvoidablePoints: LatLonTuple[]
  onSelectWaypoint: (waypointId: string) => void
  onDropMapWaypoint: (coords: LatLonTuple) => void
  onSetStart: (waypointId: string) => void
  onSetTarget: (waypointId: string) => void
  onStartRouteFromPin: (waypointId: string) => void
  onToggleDrawingAvoidableArea: () => void
  onAddAvoidablePoint: (coords: LatLonTuple) => void
  onRemoveAvoidableArea: (index: number) => void
  onClearAvoidableAreas: () => void
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
      ">${roleTag} · ${waypoint.shortLabel.split('//')[1]?.trim() ?? waypoint.name}${
        waypoint.panorama
          ? ' <span style="color:#38bdf8;margin-left:3px;">360°</span>'
          : ''
      }</div>
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

function MapClickDropper({
  isDrawingAvoidableArea,
  onAddAvoidablePoint,
  onDropWaypoint,
}: {
  isDrawingAvoidableArea: boolean
  onAddAvoidablePoint: (coords: LatLonTuple) => void
  onDropWaypoint: (coords: LatLonTuple) => void
}) {
  useMapEvents({
    click(e) {
      const target = e.originalEvent.target as HTMLElement | null
      if (
        !isDrawingAvoidableArea &&
        target?.closest('.leaflet-marker-icon, .leaflet-popup, .leaflet-control')
      ) {
        return
      }
      const clampedLat = Math.max(
        JEZERO_BOUNDS[0][0],
        Math.min(JEZERO_BOUNDS[1][0], e.latlng.lat),
      )
      const clampedLon = Math.max(
        JEZERO_BOUNDS[0][1],
        Math.min(JEZERO_BOUNDS[1][1], e.latlng.lng),
      )
      if (isDrawingAvoidableArea) {
        onAddAvoidablePoint([clampedLat, clampedLon])
      } else {
        onDropWaypoint([clampedLat, clampedLon])
      }
    },
  })
  return null
}

function ProbeWaypointMarker({
  waypoint,
  selectedWaypointId,
  onSelectWaypoint,
  onSetStart,
  onSetTarget,
  onStartRouteFromPin,
}: {
  waypoint: Waypoint
  selectedWaypointId: string
  onSelectWaypoint: (waypointId: string) => void
  onSetStart: (waypointId: string) => void
  onSetTarget: (waypointId: string) => void
  onStartRouteFromPin: (waypointId: string) => void
}) {
  const markerRef = useRef<LeafletMarker | null>(null)
  const [probeLat, probeLon] = waypoint.coords
  const icon = createWaypointDivIcon(
    waypoint,
    'none',
    selectedWaypointId === waypoint.id,
  )

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    const frameId = window.requestAnimationFrame(() => {
      marker.openPopup()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [probeLat, probeLon, waypoint.id])

  return (
    <Marker
      ref={markerRef}
      position={waypoint.coords}
      icon={icon}
      eventHandlers={{
        click: () => onSelectWaypoint(waypoint.id),
      }}
    >
      <Popup maxWidth={330} minWidth={288}>
        <PinPopupContent
          key={`${waypoint.id}-${waypoint.coords[0]}-${waypoint.coords[1]}`}
          waypoint={waypoint}
          role="none"
          onSetStart={onSetStart}
          onSetTarget={onSetTarget}
          onStartRouteFromPin={onStartRouteFromPin}
        />
      </Popup>
    </Marker>
  )
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
  return (
    <div className="w-[288px] space-y-2 text-slate-100">
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
        {/*<div className="mt-0.5 font-mono text-[10px] text-slate-400">*/}
        {/*  {waypoint.coords[0].toFixed(4)}°N, {waypoint.coords[1].toFixed(4)}°E*/}
        {/*</div>*/}
        <div className="mt-0.5 font-mono text-[10px] text-white-300">
          {waypoint.geologicUnit}
        </div>
      </div>

      <WaypointMediaViewer waypoint={waypoint} heightClass="h-44" />

      <p className="text-[11px] leading-snug text-slate-200">
        {waypoint.scienceObjective}
      </p>
      {/*<p className="rounded border border-slate-800/90 bg-slate-950/70 px-2 py-1 font-mono text-[10px] leading-snug text-slate-300">*/}
      {/*  {waypoint.rationale}*/}
      {/*</p>*/}

      {/*<div className="grid grid-cols-3 gap-1 font-mono text-[10px]">*/}
      {/*  <div className="rounded bg-slate-900/90 px-1.5 py-1">*/}
      {/*    <div className="text-[9px] text-slate-500">TEMP</div>*/}
      {/*    <div className="text-slate-200">{waypoint.telemetry.tempC}°C</div>*/}
      {/*  </div>*/}
      {/*  <div className="rounded bg-slate-900/90 px-1.5 py-1">*/}
      {/*    <div className="text-[9px] text-slate-500">WIND</div>*/}
      {/*    <div className="text-slate-200">{waypoint.telemetry.windMs} m/s</div>*/}
      {/*  </div>*/}
      {/*  <div className="rounded bg-slate-900/90 px-1.5 py-1">*/}
      {/*    <div className="text-[9px] text-slate-500">RAD</div>*/}
      {/*    <div className="text-cyan-200">*/}
      {/*      {waypoint.telemetry.radiationMsvDay.toFixed(2)} mSv/d*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</div>*/}

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
  routePlan,
  routeLoading,
  waypoints,
  probeWaypoint,
  startWaypointId,
  targetWaypointId,
  selectedWaypointId,
  stormMode,
  avoidableAreas,
  isDrawingAvoidableArea,
  draftAvoidablePoints,
  onSelectWaypoint,
  onDropMapWaypoint,
  onSetStart,
  onSetTarget,
  onStartRouteFromPin,
  onToggleDrawingAvoidableArea,
  onAddAvoidablePoint,
  onRemoveAvoidableArea,
  onClearAvoidableAreas,
}: MarsMapProps) {
  const [cursorCoords, setCursorCoords] = useState<LatLonTuple | null>(null)

  const layerById = useMemo(() => {
    const record = {} as Record<LayerId, LayerConfig>
    for (const layer of layers) {
      record[layer.id] = layer
    }
    return record
  }, [layers])

  const routeGlowColor = '#06b6d4'
  const routeCoreColor = '#34d399'

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
        <MapClickDropper
          isDrawingAvoidableArea={isDrawingAvoidableArea}
          onAddAvoidablePoint={onAddAvoidablePoint}
          onDropWaypoint={onDropMapWaypoint}
        />
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

          if (layer.kind === 'tes-spectral') {
            return (
              <TesSpectralCanvasLayer
                key={layer.id}
                wmtsUrl={layer.wmtsUrl}
                opacity={layer.opacity}
                minLayerInt={layer.spectralMinLayer ?? 0}
                bands={layer.spectralBands ?? 12}
                rawRange={layer.spectralRawRange ?? [0, 1]}
                palette={layer.spectralPalette ?? 'pyroxene'}
                maxNativeZoom={layer.maxNativeZoom ?? 13}
                zIndex={layer.zIndex ?? 13}
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
                opacity: 0.95,
              }}
            />
          </>
        )}

        {/* Mission & Active Custom Waypoint Markers (Custom L.divIcon) */}
        {waypoints.map((wp) => {
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
              <Popup maxWidth={330} minWidth={288}>
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

        {/* Clicked Arbitrary Map Point Waypoint Preview */}
        {probeWaypoint && (
          <ProbeWaypointMarker
            waypoint={probeWaypoint}
            selectedWaypointId={selectedWaypointId}
            onSelectWaypoint={onSelectWaypoint}
            onSetStart={onSetStart}
            onSetTarget={onSetTarget}
            onStartRouteFromPin={onStartRouteFromPin}
          />
        )}

        {/* Avoidable Danger / Exclusion Zones */}
        {avoidableAreas.map((area, idx) => (
          <LeafletPolygon
            key={`avoidable-area-${idx}`}
            positions={area}
            interactive={!isDrawingAvoidableArea}
            pathOptions={{
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.35,
              weight: 2,
              dashArray: '6 4',
            }}
          >
            <Tooltip sticky className="ares-tooltip">
              <span className="font-mono text-[11px] font-semibold text-red-300">
                Avoidable Area #{idx + 1} (Click to remove)
              </span>
            </Tooltip>
            <Popup minWidth={150}>
              <div className="space-y-1.5 p-1 font-mono text-slate-100">
                <div className="text-xs font-bold text-red-400">
                  AVOIDABLE AREA #{idx + 1}
                </div>
                <div className="text-[10px] text-slate-300">
                  4-Point Restricted Perimeter
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveAvoidableArea(idx)
                  }}
                  className="mt-1 w-full cursor-pointer rounded border border-red-500/60 bg-red-600/30 px-2 py-1 text-[10px] font-bold text-red-200 transition-colors hover:bg-red-600/50"
                >
                  REMOVE AREA
                </button>
              </div>
            </Popup>
          </LeafletPolygon>
        ))}

        {/* Temporary Draft Avoidable Area Markers and Line */}
        {draftAvoidablePoints.length > 0 && (
          <>
            <Polyline
              positions={draftAvoidablePoints}
              pathOptions={{
                color: '#f97316',
                weight: 2,
                dashArray: '4 4',
              }}
            />
            {draftAvoidablePoints.map((pt, i) => (
              <Marker
                key={`draft-avoidable-pt-${i}`}
                position={pt}
                icon={L.divIcon({
                  className: 'ares-div-icon',
                  html: `
                    <div style="position:relative;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);">
                      <div style="width:20px;height:20px;border-radius:9999px;background:rgba(239,68,68,0.95);border:2px solid #ffffff;color:#ffffff;font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;font-family:monospace;box-shadow:0 0 10px #ef4444;">
                        ${i + 1}
                      </div>
                    </div>
                  `,
                  iconSize: [0, 0],
                  iconAnchor: [0, 0],
                })}
              />
            ))}
          </>
        )}
      </MapContainer>

      {/* Top-Left Avoidable Areas Control Tool */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleDrawingAvoidableArea}
            className={`cursor-pointer rounded border px-3 py-1 font-mono text-[11px] font-bold tracking-wide backdrop-blur-md transition-all shadow-lg ${
              isDrawingAvoidableArea
                ? 'border-amber-400 bg-amber-500/25 text-amber-200 ring-2 ring-amber-400/30 animate-pulse'
                : 'border-red-500/50 bg-[#090d16]/90 text-red-300 hover:border-red-400 hover:bg-red-950/60'
            }`}
          >
            {isDrawingAvoidableArea
              ? `CANCEL DRAWING (${draftAvoidablePoints.length}/4 PTS)`
              : '+ AVOIDABLE AREA (4 PTS)'}
          </button>

          {avoidableAreas.length > 0 && (
            <button
              type="button"
              onClick={onClearAvoidableAreas}
              className="cursor-pointer rounded border border-slate-700 bg-[#090d16]/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-300 backdrop-blur-md transition-colors hover:border-red-500/60 hover:text-red-300 shadow-lg"
            >
              CLEAR ({avoidableAreas.length})
            </button>
          )}
        </div>

        {isDrawingAvoidableArea && (
          <div className="rounded border border-amber-500/50 bg-[#090d16]/95 px-3 py-2 font-mono text-[10px] text-amber-300 shadow-xl backdrop-blur-md">
            <div>Click 4 points on map to enclose hazard perimeter:</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white">
              <span>Points:</span>
              {[1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={`inline-block h-5 w-5 rounded-full text-center leading-5 text-[10px] ${
                    step <= draftAvoidablePoints.length
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'border border-slate-600 bg-slate-800 text-slate-400'
                  }`}
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

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
              CLICK ANYWHERE FOR WAYPOINT TELEMETRY • (LAT, LON)
            </span>
          )}
        </div>
      </div>

      {/* Top-Center Route Advisory Overlay */}
      <div className="pointer-events-none absolute top-3 left-1/2 z-[400] -translate-x-1/2 flex flex-col items-center gap-1.5">
        <div className="rounded-full border border-cyan-500/35 bg-[#090d16]/85 px-3.5 py-1 font-mono text-[11px] text-cyan-200 shadow-lg backdrop-blur-md">
          {stormMode
            ? `STORM SHELTER ROUTE • MAX SLOPE ≤ ${routePlan.maxSlopeLimitDeg}°`
            : `NOMINAL ROUTE • MAX SLOPE ≤ ${routePlan.maxSlopeLimitDeg}°`}
        </div>
        {routeLoading ? (
          <div className="rounded-full border border-amber-400/50 bg-amber-500/15 px-3 py-0.5 font-mono text-[10px] text-amber-300 shadow backdrop-blur-md animate-pulse">
            ⟳ COMPUTING DEM PATH…
          </div>
        ) : routePlan.slopeSource === 'python-backend' ? (
          <div className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-0.5 font-mono text-[10px] text-emerald-300 shadow backdrop-blur-md">
            ✓ DEM SHORTEST PATH
          </div>
        ) : (
          <div className="rounded-full border border-slate-500/40 bg-slate-800/60 px-3 py-0.5 font-mono text-[10px] text-slate-400 shadow backdrop-blur-md">
            LOCAL PREVIEW
          </div>
        )}
      </div>
    </div>
  )
}
