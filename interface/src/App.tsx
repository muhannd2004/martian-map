import { useEffect, useState } from 'react'
import { LayersControl } from './components/LayersControl'
import { MarsMap } from './components/MarsMap'
import { MissionHeader } from './components/MissionHeader'
import { TelemetryDrawer } from './components/TelemetryDrawer'
import { INITIAL_LAYERS, JEZERO_WAYPOINTS } from './data/waypoints'
import { planLocalEvaRoute } from './services/localRoutePlanner'
import type {
  ControlCircleId,
  EvaRoutePlan,
  LayerConfig,
  LayerId,
  RasterAvailabilityMap,
} from './types/eva'

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

  const [routePlan, setRoutePlan] = useState<EvaRoutePlan>(() =>
    planLocalEvaRoute({
      startWaypointId: INITIAL_START_ID,
      targetWaypointId: INITIAL_TARGET_ID,
      maxSlopeDeg: INITIAL_MAX_SLOPE,
      stormMode: false,
    }),
  )

  // Detect whether Python-exported raster overlays exist in public/layers/
  useEffect(() => {
    const cancelSlope = probeImageExists('/layers/slope_heatmap.png', (ok) => {
      setRasterStatus((prev) => ({
        ...prev,
        slopeHeatmap: ok ? 'available' : 'missing',
      }))
    })

    return () => {
      cancelSlope()
    }
  }, [])

  const startWaypoint =
    JEZERO_WAYPOINTS.find((wp) => wp.id === startWaypointId) ??
    JEZERO_WAYPOINTS[0]
  const targetWaypoint =
    JEZERO_WAYPOINTS.find((wp) => wp.id === targetWaypointId) ??
    JEZERO_WAYPOINTS[JEZERO_WAYPOINTS.length - 1]

  const recalculateRoute = (overrides?: {
    startId?: string
    targetId?: string
    slopeDeg?: number
    storm?: boolean
  }) => {
    setRoutePlan(
      planLocalEvaRoute({
        startWaypointId: overrides?.startId ?? startWaypointId,
        targetWaypointId: overrides?.targetId ?? targetWaypointId,
        maxSlopeDeg: overrides?.slopeDeg ?? maxSlopeDeg,
        stormMode: overrides?.storm ?? stormMode,
      }),
    )
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

  const handleChangeStart = (id: string) => {
    if (id === targetWaypointId) {
      handleSwapWaypoints()
      return
    }
    setStartWaypointId(id)
    recalculateRoute({ startId: id })
  }

  const handleChangeTarget = (id: string) => {
    if (id === startWaypointId) {
      handleSwapWaypoints()
      return
    }
    setTargetWaypointId(id)
    setSelectedWaypointId(id)
    recalculateRoute({ targetId: id })
  }

  const handleStartRoute = () => {
    recalculateRoute()
    setActiveControlCircle(null)
    setBriefingOpen(true)
  }

  const handleStartRouteFromPin = (waypointId: string) => {
    setSelectedWaypointId(waypointId)
    if (waypointId !== startWaypointId && waypointId !== targetWaypointId) {
      setTargetWaypointId(waypointId)
      recalculateRoute({ targetId: waypointId })
    } else {
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
        onToggleStormMode={handleToggleStormMode}
        rasterStatus={rasterStatus}
        onFocusLayersPanel={() => {
          setControlsOpen(true)
          setActiveControlCircle('slopeHeatmap')
        }}
        onOpenBriefing={handleOpenBriefing}
      />

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <MarsMap
          layers={layers}
          rasterStatus={rasterStatus}
          routePlan={routePlan}
          startWaypointId={startWaypointId}
          targetWaypointId={targetWaypointId}
          selectedWaypointId={selectedWaypointId}
          stormMode={stormMode}
          onSelectWaypoint={handleSelectMapWaypoint}
          onSetStart={handleChangeStart}
          onSetTarget={handleChangeTarget}
          onStartRouteFromPin={handleStartRouteFromPin}
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
          startWaypointId={startWaypointId}
          targetWaypointId={targetWaypointId}
          maxSlopeDeg={maxSlopeDeg}
          stormMode={stormMode}
          onChangeStart={handleChangeStart}
          onChangeTarget={handleChangeTarget}
          onSwapWaypoints={handleSwapWaypoints}
          onChangeMaxSlope={setMaxSlopeDeg}
          onStartRoute={handleStartRoute}
        />

        <TelemetryDrawer
          open={briefingOpen}
          onClose={() => setBriefingOpen(false)}
          startWaypoint={startWaypoint}
          targetWaypoint={targetWaypoint}
          routePlan={routePlan}
          stormMode={stormMode}
          onSwapWaypoints={handleSwapWaypoints}
        />
      </main>
    </div>
  )
}

export default App
