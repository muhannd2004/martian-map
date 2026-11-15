import {
  AlertCircle,
  ArrowLeftRight,
  Ban,
  Eye,
  EyeOff,
  Flame,
  Gem,
  Hexagon,
  MapPin,
  Moon,
  Mountain,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Wind,
  X,
} from 'lucide-react'
import {
  SPECTRAL_LAYER_MAX,
  THERMAL_LAYER_MAX,
  TOPO_LAYER_MAX,
  spectralLayerToThresholdPct,
  thermalLayerToThresholdPct,
  topoLayerToMeters,
} from '../data/layerScales'
import type {
  AvoidableArea,
  ControlCircleId,
  LatLonTuple,
  LayerConfig,
  LayerId,
  RasterAvailabilityMap,
  SpectralPalette,
  ThermalBandsCount,
  TopoStepM,
  Waypoint,
} from '../types/eva'

const SPECTRAL_UI_META: Record<
  SpectralPalette,
  {
    legendGradientCss: string
    labels: readonly [string, string, string]
    accentClass: string
    unitWord: string
  }
> = {
  pyroxene: {
    legendGradientCss:
      'linear-gradient(to right, #064e3b, #0d9488, #10b981, #a3e635, #facc15, #f59e0b)',
    labels: ['Low Mafic', 'Mixed Basalt', 'Rich Pyroxene'],
    accentClass: 'accent-emerald-400',
    unitWord: 'ABUNDANCE',
  },
  plagioclase: {
    legendGradientCss:
      'linear-gradient(to right, #312e81, #6d28d9, #a855f7, #ec4899, #fb7185, #fdba74)',
    labels: ['Low Crustal', 'Intermediate', 'Rich Feldspar'],
    accentClass: 'accent-fuchsia-400',
    unitWord: 'ABUNDANCE',
  },
  dust: {
    legendGradientCss:
      'linear-gradient(to right, #334155, #64748b, #b48a5c, #d97706, #ea580c, #fdba74)',
    labels: ['Exposed Rock', 'Thin Silt', 'Thick Dust'],
    accentClass: 'accent-amber-400',
    unitWord: 'DUST',
  },
}

interface LayersControlProps {
  open: boolean
  activeCircle: ControlCircleId | null
  onToggleOpen: () => void
  onSelectCircle: (circle: ControlCircleId | null) => void
  layers: LayerConfig[]
  rasterStatus: RasterAvailabilityMap
  onToggleLayer: (id: LayerId) => void
  onChangeOpacity: (id: LayerId, opacity: number) => void
  onUpdateLayer: (id: LayerId, patch: Partial<LayerConfig>) => void
  waypoints: Waypoint[]
  startWaypointId: string
  targetWaypointId: string
  maxSlopeDeg: number
  stormMode: boolean
  avoidableAreas: AvoidableArea[]
  isDrawingAvoidableArea: boolean
  draftAvoidablePoints: LatLonTuple[]
  onToggleStormMode: () => void
  onToggleDrawingAvoidableArea: () => void
  onRemoveAvoidableArea: (index: number) => void
  onClearAvoidableAreas: () => void
  onChangeStart: (id: string) => void
  onChangeTarget: (id: string) => void
  onSwapWaypoints: () => void
  onChangeMaxSlope: (slope: number) => void
  onStartRoute: () => void
}

export function LayersControl({
  open,
  activeCircle,
  onToggleOpen,
  onSelectCircle,
  layers,
  rasterStatus,
  onToggleLayer,
  onChangeOpacity,
  onUpdateLayer,
  waypoints,
  startWaypointId,
  targetWaypointId,
  maxSlopeDeg,
  stormMode,
  avoidableAreas,
  isDrawingAvoidableArea,
  draftAvoidablePoints,
  onToggleStormMode,
  onToggleDrawingAvoidableArea,
  onRemoveAvoidableArea,
  onClearAvoidableAreas,
  onChangeStart,
  onChangeTarget,
  onSwapWaypoints,
  onChangeMaxSlope,
}: LayersControlProps) {

  const slopeMissing = rasterStatus.slopeHeatmap === 'missing'

  const handleCircleClick = (circleId: ControlCircleId) => {
    onSelectCircle(activeCircle === circleId ? null : circleId)
  }


  const activeLayer = layers.find((l) => l.id === activeCircle)

  return (
    <div className="pointer-events-none absolute bottom-14 left-3 z-[450] flex flex-col items-start">
      {/* Popover Setting Panel Anchored Above Selected Circle */}
      {open && activeCircle && (
        <div className="pointer-events-auto mb-3 w-76 rounded-2xl border border-cyan-500/35 bg-[#0b111e]/95 p-3.5 shadow-[0_14px_38px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {/* Layer Setting Popover (Slope / Geologic / Traverse) */}
          {activeLayer && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    {activeLayer.label}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {activeLayer.subtitle}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleLayer(activeLayer.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold transition ${
                    activeLayer.visible
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  {activeLayer.visible ? (
                    <>
                      <Eye className="h-3 w-3" />
                      <span>ON</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" />
                      <span>OFF</span>
                    </>
                  )}
                </button>
              </div>

              {activeLayer.kind === 'mola-dem' && (
                <div className="space-y-2.5">
                  <div>
                    <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-[#1d4ed8] via-[#22c55e] via-[#facc15] via-[#f97316] to-[#dc2626]" />
                    <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-400">
                      <span>-2660m Floor</span>
                      <span>-2250m Delta</span>
                      <span className="text-orange-300">-1880m Rim</span>
                    </div>
                  </div>

                  <IntegerLayerSlicer
                    title="TOPOGRAPHIC LAYER"
                    value={activeLayer.topoMinLayer ?? 0}
                    max={TOPO_LAYER_MAX}
                    badgeText={
                      (activeLayer.topoMinLayer ?? 0) === 0
                        ? 'ALL (≥ -2700 m)'
                        : `≥ ${topoLayerToMeters(activeLayer.topoMinLayer ?? 0)} m`
                    }
                    accentClass="accent-orange-400"
                    presets={[
                      { label: '0: All', value: 0 },
                      { label: '3: ≥-2400', value: 3 },
                      { label: '7: ≥-2000', value: 7 },
                    ]}
                    onChange={(next) =>
                      onUpdateLayer(activeLayer.id, { topoMinLayer: next })
                    }
                  />

                  <DerivationSelector<TopoStepM>
                    label="HEIGHT CONTOUR STEP"
                    value={activeLayer.topoStepM ?? 50}
                    options={[
                      { value: 25, label: '25 m' },
                      { value: 50, label: '50 m' },
                      { value: 100, label: '100 m' },
                    ]}
                    onChange={(step) =>
                      onUpdateLayer(activeLayer.id, { topoStepM: step })
                    }
                  />
                </div>
              )}

              {activeLayer.kind === 'themis-thermal' && (
                <div className="space-y-2.5">
                  <div>
                    <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-[#1e3a8a] via-[#38bdf8] via-[#8b5cf6] via-[#f97316] to-[#dc2626]" />
                    <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-400">
                      <span className="text-sky-300">Cold Sand/Dust</span>
                      <span>Mixed</span>
                      <span className="text-red-300">Hot Bedrock</span>
                    </div>
                  </div>

                  <IntegerLayerSlicer
                    title="THERMAL LAYER"
                    value={activeLayer.thermalMinLayer ?? 0}
                    max={THERMAL_LAYER_MAX}
                    badgeText={
                      (activeLayer.thermalMinLayer ?? 0) === 0
                        ? 'ALL HEAT (0%+)'
                        : `≥ ${thermalLayerToThresholdPct(activeLayer.thermalMinLayer ?? 0)}% HEAT`
                    }
                    accentClass="accent-red-400"
                    presets={[
                      { label: '0: All', value: 0 },
                      { label: '4: ≥52%', value: 4 },
                      { label: '7: ≥85%', value: 7 },
                    ]}
                    onChange={(next) =>
                      onUpdateLayer(activeLayer.id, { thermalMinLayer: next })
                    }
                  />

                  <DerivationSelector<ThermalBandsCount>
                    label="THERMAL DERIVATION"
                    value={activeLayer.thermalBands ?? 12}
                    options={[
                      { value: 8, label: '8 Tiers' },
                      { value: 12, label: '12 Tiers' },
                      { value: 16, label: '16 Tiers' },
                    ]}
                    onChange={(bands) =>
                      onUpdateLayer(activeLayer.id, { thermalBands: bands })
                    }
                  />
                </div>
              )}

              {activeLayer.kind === 'tes-spectral' && (() => {
                const paletteKey = activeLayer.spectralPalette ?? 'pyroxene'
                const meta = SPECTRAL_UI_META[paletteKey]
                const minLayer = activeLayer.spectralMinLayer ?? 0
                return (
                  <div className="space-y-2.5">
                    <div>
                      <div
                        className="h-2.5 w-full rounded-full"
                        style={{ background: meta.legendGradientCss }}
                      />
                      <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-400">
                        <span>{meta.labels[0]}</span>
                        <span>{meta.labels[1]}</span>
                        <span className="text-slate-200">{meta.labels[2]}</span>
                      </div>
                    </div>

                    <IntegerLayerSlicer
                      title="SPECTRAL LAYER"
                      value={minLayer}
                      max={SPECTRAL_LAYER_MAX}
                      badgeText={
                        minLayer === 0
                          ? `ALL ${meta.unitWord} (0%+)`
                          : `≥ ${spectralLayerToThresholdPct(minLayer)}% ${meta.unitWord}`
                      }
                      accentClass={meta.accentClass}
                      presets={[
                        { label: '0: All', value: 0 },
                        { label: '4: ≥52%', value: 4 },
                        { label: '7: ≥85%', value: 7 },
                      ]}
                      onChange={(next) =>
                        onUpdateLayer(activeLayer.id, { spectralMinLayer: next })
                      }
                    />

                    <DerivationSelector<ThermalBandsCount>
                      label="SPECTRAL DERIVATION"
                      value={activeLayer.spectralBands ?? 12}
                      options={[
                        { value: 8, label: '8 Tiers' },
                        { value: 12, label: '12 Tiers' },
                        { value: 16, label: '16 Tiers' },
                      ]}
                      onChange={(bands) =>
                        onUpdateLayer(activeLayer.id, { spectralBands: bands })
                      }
                    />
                  </div>
                )
              })()}

              {activeLayer.id === 'slopeHeatmap' && slopeMissing && (
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 p-2 font-mono text-[10px] text-amber-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    Missing <code className="text-amber-200">public/layers/slope_heatmap.png</code> (Python backend export pending).
                  </span>
                </div>
              )}

              {activeLayer.id === 'geologicZones' && (
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                  <LegendChip color="#10b981" label="Margin Carbonate" />
                  <LegendChip color="#38bdf8" label="Crater Floor" />
                  <LegendChip color="#f59e0b" label="Delta Scarp" />
                  <LegendChip color="#ef4444" label="Séítah Ripples" />
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-0.5">
                <span className="font-mono text-[10px] text-slate-400">
                  OPACITY
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(activeLayer.opacity * 100)}
                  onChange={(e) =>
                    onChangeOpacity(
                      activeLayer.id,
                      Number(e.target.value) / 100,
                    )
                  }
                  disabled={!activeLayer.visible}
                  aria-label={`${activeLayer.label} opacity`}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400 disabled:opacity-40"
                />
                <span className="w-8 text-right font-mono text-[10px] font-semibold text-cyan-300">
                  {Math.round(activeLayer.opacity * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Waypoints Start/Target Popover */}
          {activeCircle === 'waypoints' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold tracking-wider text-slate-100 uppercase">
                  EVA Waypoints
                </span>
                <button
                  type="button"
                  onClick={onSwapWaypoints}
                  className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-cyan-300 transition hover:border-cyan-400/60"
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>SWAP</span>
                </button>
              </div>

              <div>
                <label
                  htmlFor="circle-start-wp"
                  className="mb-1 block font-mono text-[10px] text-slate-400 uppercase"
                >
                  Start Waypoint
                </label>
                <select
                  id="circle-start-wp"
                  value={startWaypointId}
                  onChange={(e) => onChangeStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  {waypoints.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="circle-target-wp"
                  className="mb-1 block font-mono text-[10px] text-slate-400 uppercase"
                >
                  Target Waypoint (or click map)
                </label>
                <select
                  id="circle-target-wp"
                  value={targetWaypointId}
                  onChange={(e) => onChangeTarget(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  {waypoints.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Max Suit Slope Limit Popover */}
          {activeCircle === 'maxSlope' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="font-bold tracking-wider text-slate-100 uppercase">
                  Suit Max Slope Limit
                </span>
                <span className="font-bold text-cyan-300">{maxSlopeDeg}°</span>
              </div>
              <input
                type="range"
                min={8}
                max={25}
                step={1}
                value={maxSlopeDeg}
                onChange={(e) => onChangeMaxSlope(Number(e.target.value))}
                className="hud-range w-full cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between font-mono text-[10px] text-slate-500">
                <span>8° Safe</span>
                <span>15° Nominal</span>
                <span>25° Limit</span>
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-slate-400">
                Constrains preview traverse geometry; Python backend will run
                DEM slope verification.
              </p>
            </div>
          )}

          {/* Solar Storm / Dust Alert Popover */}
          {activeCircle === 'stormMode' && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-mono text-[11px] font-bold tracking-wider text-slate-100 uppercase">
                    Solar Storm / Dust Alert
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                    Switches traverse calculation to leeward shelter routing and
                    updates storm MEDA/RAD telemetry readouts.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={stormMode}
                  onClick={onToggleStormMode}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold transition ${
                    stormMode
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  {stormMode ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 font-mono text-[10px]">
                <span className="text-slate-400">TRAVERSE ROUTING</span>
                <span className="font-semibold text-cyan-300">
                  {stormMode ? 'LEEWARD SHELTER (TAU 3.4)' : 'NOMINAL EVA'}
                </span>
              </div>
            </div>
          )}

          {/* Avoidable Exclusion Zones Popover */}
          {activeCircle === 'avoidableArea' && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-mono text-[11px] font-bold tracking-wider text-slate-100 uppercase">
                    Avoidable Areas
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                    Draw 4-point exclusion zones bypassed during route
                    calculation.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-red-300">
                  {avoidableAreas.length} ACTIVE
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleDrawingAvoidableArea}
                  className={`flex-1 cursor-pointer rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wide transition ${
                    isDrawingAvoidableArea
                      ? 'animate-pulse border-amber-400 bg-amber-500/25 text-amber-200'
                      : 'border-red-500/50 bg-red-950/50 text-red-200 hover:border-red-400 hover:bg-red-900/50'
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
                    className="cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-slate-300 transition hover:border-red-500/60 hover:text-red-300"
                  >
                    CLEAR
                  </button>
                )}
              </div>

              {isDrawingAvoidableArea && (
                <div className="rounded-lg border border-amber-500/45 bg-amber-500/10 px-2.5 py-2 font-mono text-[10px] text-amber-200">
                  <div>Click 4 points on map to enclose hazard perimeter:</div>
                  <div className="mt-1.5 flex items-center gap-1.5 font-bold text-white">
                    <span className="text-amber-300">Points:</span>
                    {[1, 2, 3, 4].map((step) => (
                      <span
                        key={step}
                        className={`inline-block h-5 w-5 rounded-full text-center text-[10px] leading-5 ${
                          step <= draftAvoidablePoints.length
                            ? 'bg-amber-400 font-black text-slate-950'
                            : 'border border-slate-600 bg-slate-900 text-slate-400'
                        }`}
                      >
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {avoidableAreas.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto pr-0.5">
                  {avoidableAreas.map((_, idx) => (
                    <div
                      key={`avoidable-item-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/75 px-2.5 py-1.5 font-mono text-[10px]"
                    >
                      <span className="font-semibold text-red-300">
                        Avoidable Area #{idx + 1} (4 pts)
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveAvoidableArea(idx)}
                        title={`Remove Avoidable Area #${idx + 1}`}
                        aria-label={`Remove Avoidable Area #${idx + 1}`}
                        className="cursor-pointer rounded p-1 text-slate-400 transition hover:bg-red-500/15 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Main Circular Trigger / Horizontal Circular Bar */}
      {!open ? (
        <button
          type="button"
          onClick={onToggleOpen}
          title="Open Overlay & EVA Controls"
          aria-label="Open Overlay & EVA Controls"
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/60 bg-[#0b111e]/95 text-cyan-300 shadow-[0_8px_28px_rgba(0,0,0,0.75)] shadow-cyan-500/20 backdrop-blur-xl transition-all duration-200 hover:scale-105"
        >
          <SlidersHorizontal className="h-5 w-5" />

        </button>
      ) : (
        <div className="pointer-events-auto flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-1.5 rounded-3xl border border-cyan-500/40 bg-[#0b111e]/95 p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.82)] backdrop-blur-xl transition-all duration-200 sm:flex-nowrap sm:rounded-full">
          {/* Close Trigger Circle */}
          <button
            type="button"
            onClick={onToggleOpen}
            title="Close Control Bar"
            aria-label="Close Control Bar"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <CircleDivider />

          {/* Dynamic Layer Circles (MOLA, THEMIS Night/Day IR, Slope, Geologic, Traverse) */}
          {layers.map((layer) => (
            <CircleNode
              key={layer.id}
              active={activeCircle === layer.id}
              enabled={layer.visible}
              alertDot={layer.id === 'slopeHeatmap' && slopeMissing}
              label={layer.label}
              onClick={() => handleCircleClick(layer.id)}
            >
              {renderLayerIcon(layer.id)}
            </CircleNode>
          ))}

          <CircleDivider />

          {/* 4. Start & Target Waypoints Circle */}
          <CircleNode
            active={activeCircle === 'waypoints'}
            enabled={true}
            label="Start & Target Waypoints"
            onClick={() => handleCircleClick('waypoints')}
          >
            <MapPin className="h-4 w-4" />
          </CircleNode>

          {/* 5. Suit Max Slope Limit Circle */}
          <CircleNode
            active={activeCircle === 'maxSlope'}
            enabled={true}
            label={`Max Slope Limit (${maxSlopeDeg}°)`}
            onClick={() => handleCircleClick('maxSlope')}
          >
            <span className="font-mono text-[11px] font-bold">
              {maxSlopeDeg}°
            </span>
          </CircleNode>

          {/* 6. Solar Storm / Dust Alert Circle */}
          <CircleNode
            active={activeCircle === 'stormMode'}
            enabled={stormMode}
            label={`Solar Storm / Dust Alert (${stormMode ? 'ON' : 'OFF'})`}
            onClick={() => handleCircleClick('stormMode')}
          >
            <ShieldAlert className="h-4 w-4" />
          </CircleNode>

          {/* 7. Avoidable Exclusion Areas Circle */}
          <CircleNode
            active={activeCircle === 'avoidableArea'}
            enabled={isDrawingAvoidableArea || avoidableAreas.length > 0}
            alertDot={isDrawingAvoidableArea || avoidableAreas.length > 0}
            label={`Avoidable Areas (${avoidableAreas.length} active)`}
            onClick={() => handleCircleClick('avoidableArea')}
          >
            <Ban className="h-4 w-4" />
          </CircleNode>

          {/* 7. Start EVA Route & Open Briefing Mini-Page */}
          {/*<button*/}
          {/*  type="button"*/}
          {/*  onClick={handleStartRouteClick}*/}
          {/*  title="Start EVA Route & Open Telemetry Briefing"*/}
          {/*  aria-label="Start EVA Route & Open Telemetry Briefing"*/}
          {/*  className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 font-mono text-[11px] font-bold tracking-wider transition hover:scale-105 ${*/}
          {/*    routePulse*/}
          {/*      ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'*/}
          {/*      : 'border-cyan-400/75 bg-cyan-500/25 text-cyan-100 hover:bg-cyan-500/35'*/}
          {/*  }`}*/}
          {/*>*/}
          {/*  {routePulse ? (*/}
          {/*    <Check className="h-3.5 w-3.5" />*/}
          {/*  ) : (*/}
          {/*    <Route className="h-3.5 w-3.5" />*/}
          {/*  )}*/}
          {/*  <span>START ROUTE</span>*/}
          {/*</button>*/}
        </div>
      )}
    </div>
  )
}

function CircleNode({
  active,
  enabled,
  alertDot = false,
  label,
  onClick,
  children,
}: {
  active: boolean
  enabled: boolean
  alertDot?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition hover:scale-105 ${
        active
          ? 'border-white bg-cyan-500/30 text-white shadow-[0_0_16px_rgba(34,211,238,0.45)]'
          : enabled
            ? 'border-cyan-500/45 bg-slate-900/90 text-cyan-300 hover:border-cyan-300'
            : 'border-slate-700/80 bg-slate-950/80 text-slate-500 hover:border-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
      {alertDot && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0b111e] bg-amber-400" />
      )}
    </button>
  )
}

function CircleDivider() {
  return <span className="mx-0.5 h-5 w-px bg-slate-700/70" />
}

function renderLayerIcon(layerId: LayerId): React.ReactNode {
  switch (layerId) {
    case 'molaElevation':
      return <Mountain className="h-4 w-4" />
    case 'themisNightIr':
      return <Moon className="h-4 w-4" />
    case 'themisDayIr':
      return <Sun className="h-4 w-4" />
    case 'tesPyroxene':
      return <Gem className="h-4 w-4" />
    case 'tesPlagioclase':
      return <Sparkles className="h-4 w-4" />
    case 'tesDust':
      return <Wind className="h-4 w-4" />
    case 'slopeHeatmap':
      return <Flame className="h-4 w-4" />
    case 'geologicZones':
      return <Hexagon className="h-4 w-4" />
  }
}

function IntegerLayerSlicer({
  title,
  value,
  max,
  badgeText,
  accentClass,
  presets,
  onChange,
}: {
  title: string
  value: number
  max: number
  badgeText: string
  accentClass: string
  presets: readonly { label: string; value: number }[]
  onChange: (next: number) => void
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-2">
      <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
        <span className="text-slate-400">{title}</span>
        <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-bold text-slate-100">
          L{value} • {badgeText}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label={`Decrease ${title}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900 font-mono text-xs font-bold text-slate-200 transition hover:border-cyan-400/60 disabled:opacity-35"
        >
          -
        </button>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={title}
          className={`h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 ${accentClass}`}
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${title}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900 font-mono text-xs font-bold text-slate-200 transition hover:border-cyan-400/60 disabled:opacity-35"
        >
          +
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 font-mono text-[9px]">
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            className={`rounded border px-1.5 py-0.5 transition ${
              value === preset.value
                ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-800 bg-slate-900/90 text-slate-400 hover:border-slate-600 hover:text-slate-200'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DerivationSelector<T extends number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (next: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
      <span className="text-slate-400">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition ${
              value === opt.value
                ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded bg-slate-950/80 px-2 py-1 text-slate-300">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{label}</span>
    </div>
  )
}
