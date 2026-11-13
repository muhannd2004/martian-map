import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowLeftRight,
  Camera,
  Clock,
  Flag,
  MapPin,
  Mountain,
  Radiation,
  Route,
  Wind,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EvaRoutePlan, Waypoint } from '../types/eva'

interface TelemetryDrawerProps {
  open: boolean
  onClose: () => void
  startWaypoint: Waypoint
  targetWaypoint: Waypoint
  routePlan: EvaRoutePlan
  onSwapWaypoints: () => void
}

export function TelemetryDrawer({
  open,
  onClose,
  startWaypoint,
  targetWaypoint,
  routePlan,
  onSwapWaypoints,
}: TelemetryDrawerProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="EVA Route Briefing"
      onClick={onClose}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-500/35 bg-[#0b111e]/98 shadow-[0_24px_80px_rgba(0,0,0,0.9)]"
      >
        {/* Mini-Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/60 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/45 bg-cyan-500/15 text-cyan-300">
              <Route className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-xs font-bold tracking-[0.14em] text-slate-100 uppercase">
                  EVA Route Briefing // {startWaypoint.name} →{' '}
                  {targetWaypoint.name}
                </h2>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 uppercase ring-1 ring-emerald-500/35">
                  {routePlan.mode}
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                  PREVIEW (PYTHON BACKEND PENDING)
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400">
                Origin & destination Mastcam-Z imagery, MEDA/RAD telemetry, and
                route slope profile
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSwapWaypoints}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-cyan-300 transition hover:border-cyan-400/60"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>SWAP START / END</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close route briefing"
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Mini-Page Body */}
        <div className="hud-scroll flex-1 space-y-5 overflow-y-auto p-5">
          {/* Side-by-Side Start & End Waypoint Cards with Pictures */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <WaypointBriefCard role="START" waypoint={startWaypoint} />
            <WaypointBriefCard role="END" waypoint={targetWaypoint} />
          </div>

          {/* Route Safety Metrics + Elevation/Slope Profile */}
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <h3 className="font-mono text-xs font-bold tracking-[0.12em] text-slate-100 uppercase">
                  EVA Route Telemetry & Terrain Profile
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                Suit Max Slope Input:{' '}
                <strong className="text-cyan-300">
                  {routePlan.maxSlopeLimitDeg}°
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 font-mono sm:grid-cols-5">
              <MetricTile
                icon={<Flag className="h-3.5 w-3.5 text-cyan-400" />}
                label="DISTANCE"
                value={`${(routePlan.metrics.distanceM / 1000).toFixed(2)} km`}
              />
              <MetricTile
                icon={<Clock className="h-3.5 w-3.5 text-cyan-400" />}
                label="EVA TIME"
                value={`${routePlan.metrics.estimatedTimeMin} min`}
              />
              <MetricTile
                icon={<Mountain className="h-3.5 w-3.5 text-amber-400" />}
                label="PEAK SLOPE (EST.)"
                value={`${routePlan.metrics.peakSlopeDeg}° / ${routePlan.maxSlopeLimitDeg}°`}
                warning={
                  routePlan.metrics.peakSlopeDeg > routePlan.maxSlopeLimitDeg
                }
              />
              <MetricTile
                icon={<Radiation className="h-3.5 w-3.5 text-emerald-400" />}
                label="CUM. RAD"
                value={`${routePlan.metrics.cumulativeRadiationMsv.toFixed(3)} mSv`}
              />
              <MetricTile
                icon={<Wind className="h-3.5 w-3.5 text-cyan-400" />}
                label="ARRIVAL O₂"
                value={`${routePlan.metrics.o2ReservePct}%`}
                warning={routePlan.metrics.o2ReservePct < 35}
              />
            </div>

            <p className="rounded-lg border border-slate-800/80 bg-slate-950/65 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
              {routePlan.advisory}
            </p>

            {/* Recharts Elevation & Slope Profile */}
            <div>
              <div className="mb-1.5 flex items-center justify-between font-mono text-[10px]">
                <span className="text-slate-400 uppercase">
                  Elevation (m) & Terrain Slope (°) Profile — Python DEM Preview
                </span>
                <span className="text-red-300">
                  Suit Limit {routePlan.maxSlopeLimitDeg}°
                </span>
              </div>
              <div className="h-52 w-full min-w-0 rounded-lg border border-slate-800 bg-slate-950/80 p-2.5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={routePlan.elevationProfile}
                    margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#38bdf8"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#38bdf8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="slopeFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f59e0b"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="rgba(148,163,184,0.12)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="distanceM"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                    />
                    <YAxis
                      yAxisId="elev"
                      tick={{ fill: '#38bdf8', fontSize: 10 }}
                      domain={['dataMin - 15', 'dataMax + 15']}
                    />
                    <YAxis
                      yAxisId="slope"
                      orientation="right"
                      tick={{ fill: '#fbbf24', fontSize: 10 }}
                      domain={[0, 30]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(9, 13, 22, 0.96)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'ui-monospace, monospace',
                      }}
                      labelFormatter={(v) => `Distance: ${String(v)} m`}
                    />
                    <ReferenceLine
                      yAxisId="slope"
                      y={routePlan.maxSlopeLimitDeg}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                    />
                    <Area
                      yAxisId="elev"
                      type="monotone"
                      dataKey="elevationM"
                      name="Elevation (m)"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      fill="url(#elevFill)"
                    />
                    <Area
                      yAxisId="slope"
                      type="monotone"
                      dataKey="slopeDeg"
                      name="Slope (°)"
                      stroke="#f59e0b"
                      strokeWidth={1.75}
                      fill="url(#slopeFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function WaypointBriefCard({
  role,
  waypoint,
}: {
  role: 'START' | 'END'
  waypoint: Waypoint
}) {
  const isStart = role === 'START'

  return (
    <section
      className={`space-y-3 rounded-xl border bg-slate-900/65 p-4 ${
        isStart ? 'border-cyan-500/35' : 'border-emerald-500/35'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span
              className={`rounded px-1.5 py-0.5 font-bold ${
                isStart
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {isStart ? 'START // ORIGIN' : 'END // TARGET'}
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <MapPin className="h-3 w-3" />
              {waypoint.shortLabel}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-bold text-slate-100">
            {waypoint.name}
          </h3>
        </div>
        <span className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
          {waypoint.elevationM} m
        </span>
      </div>

      <WaypointPovViewer key={waypoint.id} waypoint={waypoint} />

      <div className="rounded border border-slate-800/90 bg-slate-950/65 px-2.5 py-1.5 font-mono text-[10px] text-amber-200/90">
        {waypoint.geologicUnit}
      </div>

      <p className="text-xs leading-relaxed text-slate-200">
        {waypoint.scienceObjective}
      </p>
      <p className="text-[11px] leading-relaxed text-slate-400">
        {waypoint.rationale}
      </p>

      <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
        <div className="rounded bg-slate-950/75 p-2">
          <div className="text-slate-500">TEMP</div>
          <div className="font-semibold text-slate-100">
            {waypoint.telemetry.tempC}°C
          </div>
        </div>
        <div className="rounded bg-slate-950/75 p-2">
          <div className="text-slate-500">WIND</div>
          <div className="font-semibold text-slate-100">
            {waypoint.telemetry.windMs} m/s
          </div>
        </div>
        <div className="rounded bg-slate-950/75 p-2">
          <div className="text-slate-500">RAD</div>
          <div className="font-semibold text-emerald-300">
            {waypoint.telemetry.radiationMsvDay} mSv/d
          </div>
        </div>
      </div>
    </section>
  )
}

function MetricTile({
  icon,
  label,
  value,
  warning = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  warning?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/75 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`mt-1 text-xs font-bold ${
          warning ? 'text-amber-300' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function WaypointPovViewer({ waypoint }: { waypoint: Waypoint }) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-2.5 py-1.5 font-mono text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Camera className="h-3 w-3 text-cyan-400" />
          <span>MASTCAM-Z POV</span>
        </span>
        <span className="text-[9px] text-slate-500">{waypoint.povCredit}</span>
      </div>

      {imageError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-950 via-[#151218] to-slate-950 px-4 text-center">
          <Camera className="h-5 w-5 text-amber-400/80" />
          <div className="font-mono text-[11px] font-semibold text-slate-200">
            {waypoint.povTitle}
          </div>
          <div className="font-mono text-[10px] text-slate-400">
            Offline / cached HUD placeholder ({waypoint.coords[0].toFixed(4)}°N,{' '}
            {waypoint.coords[1].toFixed(4)}°E)
          </div>
        </div>
      ) : (
        <div className="relative h-40 w-full">
          <img
            src={waypoint.povImageUrl}
            alt={waypoint.povTitle}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#090d16]/95 via-[#090d16]/60 to-transparent px-2.5 py-1.5 font-mono text-[10px] text-slate-200">
            {waypoint.povTitle}
          </div>
        </div>
      )}
    </div>
  )
}
