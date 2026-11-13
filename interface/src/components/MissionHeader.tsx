import {
  Activity,
  AlertTriangle,
  Compass,
  Radiation,
  ShieldAlert,
  Thermometer,
  Wind,
} from 'lucide-react'
import type { RasterAvailabilityMap } from '../types/eva'

interface MissionHeaderProps {
  solLabel: string
  stormMode: boolean
  onToggleStormMode: () => void
  rasterStatus: RasterAvailabilityMap
  onFocusLayersPanel: () => void
  onOpenBriefing: () => void
}

export function MissionHeader({
  solLabel,
  stormMode,
  onToggleStormMode,
  rasterStatus,
  onFocusLayersPanel,
  onOpenBriefing,
}: MissionHeaderProps) {
  const slopeMissing = rasterStatus.slopeHeatmap === 'missing'

  const tempC = stormMode ? -71 : -63
  const pressurePa = stormMode ? 768 : 720
  const windMs = stormMode ? 28.4 : 4.2
  const baseRadMsv = stormMode ? 2.45 : 0.64

  return (
    <header
      className={`relative z-30 shrink-0 border-b backdrop-blur-md transition-colors duration-300 ${
        stormMode
          ? 'border-amber-500/60 bg-gradient-to-r from-[#1a0d12] via-[#1b1116] to-[#1a0d12]'
          : 'border-cyan-500/25 bg-[#0b111e]/95'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* Brand & Mission Identity */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
              stormMode
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                : 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300'
            }`}
          >
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-[0.16em] text-slate-100 uppercase">
                ARES-NAV // JEZERO EVA PLANNER
              </h1>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${
                  stormMode
                    ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
                    : 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                }`}
              >
                {solLabel}
              </span>
            </div>
            <p className="font-mono text-[11px] text-slate-400">
              JEZERO WESTERN DELTA • FULL HIRISE MOSAIC (~20.3×21.5 KM) • EPSG:4326
            </p>
          </div>
        </div>

        {/* Live Simulated MEDA / RAD Telemetry Strip */}
        <div className="hidden items-center gap-4 rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-1.5 font-mono text-xs xl:flex">
          <TelemetryReadout
            icon={<Thermometer className="h-3.5 w-3.5 text-cyan-400" />}
            label="MEDA TEMP"
            value={`${tempC}°C`}
            alert={stormMode}
          />
          <Divider />
          <TelemetryReadout
            icon={<span className="text-[10px] font-bold text-cyan-400">Pa</span>}
            label="PRESSURE"
            value={`${pressurePa} Pa`}
            alert={false}
          />
          <Divider />
          <TelemetryReadout
            icon={
              <Wind
                className={`h-3.5 w-3.5 ${
                  stormMode ? 'text-amber-400' : 'text-cyan-400'
                }`}
              />
            }
            label="WIND"
            value={`${windMs.toFixed(1)} m/s`}
            alert={stormMode}
          />
          <Divider />
          <TelemetryReadout
            icon={
              <Radiation
                className={`h-3.5 w-3.5 ${
                  stormMode ? 'text-red-400' : 'text-emerald-400'
                }`}
              />
            }
            label="BASE RAD"
            value={`${baseRadMsv.toFixed(2)} mSv/day`}
            alert={stormMode}
          />
        </div>

        {/* Alerts & Solar Storm Switch */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenBriefing}
            className="flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>ROUTE BRIEF</span>
          </button>

          {slopeMissing && (
            <button
              type="button"
              onClick={onFocusLayersPanel}
              title="Missing Python-generated slope overlay in public/layers/slope_heatmap.png"
              className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 font-mono text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/20"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>SLOPE PNG PENDING</span>
            </button>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={stormMode}
            onClick={onToggleStormMode}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition ${
              stormMode
                ? 'border-red-400/70 bg-red-500/20 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.28)]'
                : 'border-amber-500/35 bg-slate-900/80 text-amber-200/90 hover:border-amber-400/60 hover:bg-amber-500/10'
            }`}
          >
            <ShieldAlert
              className={`h-4 w-4 ${
                stormMode ? 'animate-pulse text-red-400' : 'text-amber-400'
              }`}
            />
            <span>SOLAR STORM / DUST ALERT</span>
            <span
              className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition ${
                stormMode ? 'bg-red-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full bg-white transition-transform ${
                  stormMode ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Active Storm Advisory Banner */}
      {stormMode && (
        <div className="flex items-center justify-between gap-3 border-t border-red-500/40 bg-red-950/60 px-4 py-1 font-mono text-[11px] text-amber-200">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-red-400" />
            <span className="font-semibold text-red-300">
              ALERT ACTIVE — SPE / DUST STORM CONTINGENCY:
            </span>
            <span>
              Rerouting EVA traverse along terrain-sheltered crater & scarp-lee
              corridors (storm_mode: true).
            </span>
          </div>
          <span className="hidden text-red-300/90 sm:inline">
            DUST TAU 3.4 • SHELTER PRIORITY
          </span>
        </div>
      )}
    </header>
  )
}

function TelemetryReadout({
  icon,
  label,
  value,
  alert,
}: {
  icon: React.ReactNode
  label: string
  value: string
  alert: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[10px] text-slate-400">{label}</span>
      <span
        className={`font-semibold ${
          alert ? 'text-amber-300' : 'text-slate-100'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Divider() {
  return <span className="h-3.5 w-px bg-slate-800" />
}
