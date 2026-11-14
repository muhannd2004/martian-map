import { useEffect, useMemo, useState } from 'react'
import { LayersControl } from './components/LayersControl'
import { MarsMap } from './components/MarsMap'
import { MissionHeader } from './components/MissionHeader'
import { TelemetryDrawer } from './components/TelemetryDrawer'
import {
  INITIAL_LAYERS,
  JEZERO_WAYPOINTS,
  MARS_TREK_MOLA_ELEVATION_WMTS_URL,
} from './data/waypoints'
import { planLocalEvaRoute } from './services/localRoutePlanner'
import { fetchBackendRoute } from './services/backendRoute'
import { fetchGrayTile } from './services/molaDem'
import {
  createCustomWaypointFromCoords,
  withElevationEstimate,
} from './services/siteInspector'
import type {
  AvoidableArea,
  ControlCircleId,
  EvaRoutePlan,
  LatLonTuple,
  LayerConfig,
  LayerId,
  RasterAvailabilityMap,
  Waypoint,
} from './types/eva'

function sortPolygonPoints(points: LatLonTuple[]): LatLonTuple[] {
  if (points.length < 3) return points
  const centerLat = points.reduce((sum, p) => sum + p[0], 0) / points.length
  const centerLon = points.reduce((sum, p) => sum + p[1], 0) / points.length
  return [...points].sort((a, b) => {
    const angleA = Math.atan2(a[0] - centerLat, a[1] - centerLon)
    const angleB = Math.atan2(b[0] - centerLat, b[1] - centerLon)
    return angleA - angleB
  })
}

const INITIAL_START_ID = 'butler-landing'
const INITIAL_TARGET_ID = 'bright-angel'
const INITIAL_MAX_SLOPE = 15

function probeImageExists(
  url: string,
  onResult: (available: boolean) => void,
): () => void {
  let cancelled = false
  const img = new Image()
  img.onload = () => {
    if (!cancelled) onResult(true)
  }
  img.onerror = () => {
    if (!cancelled) onResult(false)
  }
  img.src = url
  return () => {
    cancelled = true
  }
}

function App() {
  const [layers, setLayers] = useState<LayerConfig[]>(INITIAL_LAYERS)
  const [rasterStatus, setRasterStatus] = useState<RasterAvailabilityMap>({
    slopeHeatmap: 'checking',
  })

  const [controlsOpen, setControlsOpen] = useState(false)
  const [activeControlCircle, setActiveControlCircle] =
    useState<ControlCircleId | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)

  const [startWaypointId, setStartWaypointId] = useState(INITIAL_START_ID)
  const [targetWaypointId, setTargetWaypointId] = useState(INITIAL_TARGET_ID)
  const [selectedWaypointId, setSelectedWaypointId] =
    useState(INITIAL_TARGET_ID)
  const [maxSlopeDeg, setMaxSlopeDeg] = useState(INITIAL_MAX_SLOPE)
  const [stormMode, setStormMode] = useState(false)

  const [probeWaypoint, setProbeWaypoint] = useState<Waypoint | null>(null)
  const [customEndpoints, setCustomEndpoints] = useState<Waypoint[]>([])

  const [avoidableAreas, setAvoidableAreas] = useState<AvoidableArea[]>([])
  const [isDrawingAvoidableArea, setIsDrawingAvoidableArea] = useState(false)
  const [draftAvoidablePoints, setDraftAvoidablePoints] = useState<LatLonTuple[]>([])

  const [routePlan, setRoutePlan] = useState<EvaRoutePlan>(() =>
    planLocalEvaRoute({
      startWaypointId: INITIAL_START_ID,
      targetWaypointId: INITIAL_TARGET_ID,
      maxSlopeDeg: INITIAL_MAX_SLOPE,
      stormMode: false,
    }),
  )
  const [routeLoading, setRouteLoading] = useState(false)

  // Detect Python slope raster availability and prefetch MOLA DEM buffer for click telemetry
  useEffect(() => {
    let cancelled = false
    const cancelSlope = probeImageExists('/layers/slope_heatmap.png', (ok) => {
      setRasterStatus((prev) => ({
        ...prev,
        slopeHeatmap: ok ? 'available' : 'missing',
      }))
    })

    void fetchGrayTile(MARS_TREK_MOLA_ELEVATION_WMTS_URL).then((dem) => {
      if (cancelled || !dem) return
      setProbeWaypoint((prev) =>
        prev ? withElevationEstimate(prev, dem) : null,
      )
      setCustomEndpoints((prev) =>
        prev.map((wp) => withElevationEstimate(wp, dem)),
      )
    })

    return () => {
      cancelled = true
      cancelSlope()
    }
  }, [])

  const allWaypoints = useMemo(
    () => [...JEZERO_WAYPOINTS, ...customEndpoints],
    [customEndpoints],
  )

  const startWaypoint =
    allWaypoints.find((wp) => wp.id === startWaypointId) ?? JEZERO_WAYPOINTS[0]
  const targetWaypoint =
    allWaypoints.find((wp) => wp.id === targetWaypointId) ??
    JEZERO_WAYPOINTS[JEZERO_WAYPOINTS.length - 1]

  const recalculateRoute = (overrides?: {
    startId?: string
    targetId?: string
    slopeDeg?: number
    storm?: boolean
    extraWaypoints?: Waypoint[]
    avoidableAreas?: AvoidableArea[]
  }) => {
    const activeAvoidableAreas = overrides?.avoidableAreas ?? avoidableAreas
    const params = {
      startWaypointId: overrides?.startId ?? startWaypointId,
      targetWaypointId: overrides?.targetId ?? targetWaypointId,
      maxSlopeDeg: overrides?.slopeDeg ?? maxSlopeDeg,
      stormMode: overrides?.storm ?? stormMode,
      extraWaypoints: overrides?.extraWaypoints ?? customEndpoints,
      avoidableAreas: activeAvoidableAreas,
    }
    const extra = overrides?.extraWaypoints ?? customEndpoints
    const all = [...JEZERO_WAYPOINTS, ...extra]
    const s = all.find((wp) => wp.id === params.startWaypointId) ?? JEZERO_WAYPOINTS[0]
    const t = all.find((wp) => wp.id === params.targetWaypointId) ?? JEZERO_WAYPOINTS[JEZERO_WAYPOINTS.length - 1]
    setRoutePlan(planLocalEvaRoute(params))
    setRouteLoading(true)
    void fetchBackendRoute(s, t, params).then((plan) => {
      setRoutePlan(plan)
      setRouteLoading(false)
    })
  }

  const handleToggleDrawingAvoidableArea = () => {
    setIsDrawingAvoidableArea((prev) => {
      if (prev) setDraftAvoidablePoints([])
      return !prev
    })
  }

  const handleAddAvoidablePoint = (coords: LatLonTuple) => {
    const nextDraft = [...draftAvoidablePoints, coords]
    if (nextDraft.length === 4) {
      const sorted = sortPolygonPoints(nextDraft)
      const nextAreas = [...avoidableAreas, sorted]
      setAvoidableAreas(nextAreas)
      setDraftAvoidablePoints([])
      setIsDrawingAvoidableArea(false)
      recalculateRoute({ avoidableAreas: nextAreas })
    } else {
      setDraftAvoidablePoints(nextDraft)
    }
  }

  const handleRemoveAvoidableArea = (index: number) => {
    const nextAreas = avoidableAreas.filter((_, i) => i !== index)
    setAvoidableAreas(nextAreas)
    recalculateRoute({ avoidableAreas: nextAreas })
  }

  const handleClearAvoidableAreas = () => {
    setAvoidableAreas([])
    setDraftAvoidablePoints([])
    setIsDrawingAvoidableArea(false)
    recalculateRoute({ avoidableAreas: [] })
  }

  const handleToggleLayer = (id: LayerId) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    )
  }

  const handleChangeOpacity = (id: LayerId, opacity: number) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, opacity } : layer)),
    )
  }

  const handleUpdateLayer = (id: LayerId, patch: Partial<LayerConfig>) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id ? { ...layer, ...patch, visible: true } : layer,
      ),
    )
  }

  const handleToggleStormMode = () => {
    const nextStorm = !stormMode
    setStormMode(nextStorm)
    recalculateRoute({ storm: nextStorm })
  }

  const handleSwapWaypoints = () => {
    const nextStart = targetWaypointId
    const nextTarget = startWaypointId
    setStartWaypointId(nextStart)
    setTargetWaypointId(nextTarget)
    setSelectedWaypointId(nextTarget)
    recalculateRoute({ startId: nextStart, targetId: nextTarget })
  }

  const handleSelectMapWaypoint = (waypointId: string) => {
    setSelectedWaypointId(waypointId)
  }

  const handleDropMapWaypoint = (coords: LatLonTuple) => {
    const customPin = createCustomWaypointFromCoords(coords, 'custom-probe')
    setProbeWaypoint(customPin)
    setSelectedWaypointId(customPin.id)
  }

  const promoteProbe = (role: 'start' | 'target', probe: Waypoint) => {
    const otherId = role === 'start' ? targetWaypointId : startWaypointId
    const slotId = otherId === 'custom-a' ? 'custom-b' : 'custom-a'
    const promoted: Waypoint = {
      ...probe,
      id: slotId,
      shortLabel: 'PIN // CUSTOM',
    }
    const nextCustom = [
      ...customEndpoints.filter((wp) => wp.id === otherId),
      promoted,
    ]
    setCustomEndpoints(nextCustom)
    setProbeWaypoint(null)
    setSelectedWaypointId(slotId)
    if (role === 'start') {
      setStartWaypointId(slotId)
      recalculateRoute({ startId: slotId, extraWaypoints: nextCustom })
    } else {
      setTargetWaypointId(slotId)
      recalculateRoute({ targetId: slotId, extraWaypoints: nextCustom })
    }
  }

  const pruneCustomEndpoints = (
    nextStartId: string,
    nextTargetId: string,
  ): Waypoint[] => {
    const nextCustom = customEndpoints.filter(
      (wp) => wp.id === nextStartId || wp.id === nextTargetId,
    )
    setCustomEndpoints(nextCustom)
    return nextCustom
  }

  const handleChangeStart = (id: string) => {
    if (id === 'custom-probe' && probeWaypoint) {
      promoteProbe('start', probeWaypoint)
      return
    }
    if (id === targetWaypointId) {
      handleSwapWaypoints()
      return
    }
    const nextCustom = pruneCustomEndpoints(id, targetWaypointId)
    setStartWaypointId(id)
    recalculateRoute({ startId: id, extraWaypoints: nextCustom })
  }

  const handleChangeTarget = (id: string) => {
    if (id === 'custom-probe' && probeWaypoint) {
      promoteProbe('target', probeWaypoint)
      return
    }
    if (id === startWaypointId) {
      handleSwapWaypoints()
      return
    }
    const nextCustom = pruneCustomEndpoints(startWaypointId, id)
    setTargetWaypointId(id)
    setSelectedWaypointId(id)
    recalculateRoute({ targetId: id, extraWaypoints: nextCustom })
  }

  const handleChangeMaxSlope = (nextSlope: number) => {
    setMaxSlopeDeg(nextSlope)
    recalculateRoute({ slopeDeg: nextSlope })
  }

  const handleStartRoute = () => {
    recalculateRoute()
    setActiveControlCircle(null)
    setBriefingOpen(true)
  }

  const handleStartRouteFromPin = (waypointId: string) => {
    if (waypointId !== startWaypointId && waypointId !== targetWaypointId) {
      handleChangeTarget(waypointId)
    } else {
      setSelectedWaypointId(waypointId)
      recalculateRoute()
    }
    setActiveControlCircle(null)
    setBriefingOpen(true)
  }

  const handleOpenBriefing = () => {
    recalculateRoute()
    setActiveControlCircle(null)
    setBriefingOpen(true)
  }

  const handleToggleControls = () => {
    if (controlsOpen) {
      setControlsOpen(false)
      setActiveControlCircle(null)
    } else {
      setControlsOpen(true)
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#090d16] text-slate-100">
      <MissionHeader
        solLabel="SOL 1428 • 14:32 LMST"
        stormMode={stormMode}
        onOpenBriefing={handleOpenBriefing}
      />

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <MarsMap
          layers={layers}
          routePlan={routePlan}
          routeLoading={routeLoading}
          waypoints={allWaypoints}
          probeWaypoint={probeWaypoint}
          startWaypointId={startWaypointId}
          targetWaypointId={targetWaypointId}
          selectedWaypointId={selectedWaypointId}
          stormMode={stormMode}
          avoidableAreas={avoidableAreas}
          isDrawingAvoidableArea={isDrawingAvoidableArea}
          draftAvoidablePoints={draftAvoidablePoints}
          onSelectWaypoint={handleSelectMapWaypoint}
          onDropMapWaypoint={handleDropMapWaypoint}
          onSetStart={handleChangeStart}
          onSetTarget={handleChangeTarget}
          onStartRouteFromPin={handleStartRouteFromPin}
          onToggleDrawingAvoidableArea={handleToggleDrawingAvoidableArea}
          onAddAvoidablePoint={handleAddAvoidablePoint}
          onRemoveAvoidableArea={handleRemoveAvoidableArea}
          onClearAvoidableAreas={handleClearAvoidableAreas}
        />

        <LayersControl
          open={controlsOpen}
          activeCircle={activeControlCircle}
          onToggleOpen={handleToggleControls}
          onSelectCircle={setActiveControlCircle}
          layers={layers}
          rasterStatus={rasterStatus}
          onToggleLayer={handleToggleLayer}
          onChangeOpacity={handleChangeOpacity}
          onUpdateLayer={handleUpdateLayer}
          waypoints={allWaypoints}
          startWaypointId={startWaypointId}
          targetWaypointId={targetWaypointId}
          maxSlopeDeg={maxSlopeDeg}
          stormMode={stormMode}
          onToggleStormMode={handleToggleStormMode}
          onChangeStart={handleChangeStart}
          onChangeTarget={handleChangeTarget}
          onSwapWaypoints={handleSwapWaypoints}
          onChangeMaxSlope={handleChangeMaxSlope}
          onStartRoute={handleStartRoute}
        />

        <TelemetryDrawer
          open={briefingOpen}
          onClose={() => setBriefingOpen(false)}
          startWaypoint={startWaypoint}
          targetWaypoint={targetWaypoint}
          routePlan={routePlan}
          onSwapWaypoints={handleSwapWaypoints}
        />
      </main>
    </div>
  )
}

export default App
