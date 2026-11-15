import {
  Compass,
} from 'lucide-react'

interface MissionHeaderProps {
  solLabel: string
  stormMode: boolean
  onOpenBriefing: () => void
}

// eslint-disable-next-line no-empty-pattern
export function MissionHeader({

}: MissionHeaderProps) {
  // const tempC = stormMode ? -71 : -63
  // const pressurePa = stormMode ? 768 : 720
  // const windMs = stormMode ? 28.4 : 4.2
  // const baseRadMsv = stormMode ? 2.45 : 0.64

  return (
    <header className="relative z-30 shrink-0 border-b border-cyan-500/25 bg-[#0b111e]/95 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* Brand & Mission Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-300">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-[0.16em] text-slate-100 uppercase">
                JEZERO Map
              </h1>
              {/*<span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-cyan-300 ring-1 ring-cyan-500/30">*/}
              {/*  {solLabel}*/}
              {/*</span>*/}
            </div>
            {/*<p className="font-mono text-[11px] text-slate-400">*/}
            {/*  JEZERO WESTERN DELTA • FULL HIRISE MOSAIC (~20.3×21.5 KM) • EPSG:4326*/}
            {/*</p>*/}
          </div>
        </div>

        {/* Live Simulated MEDA / RAD Telemetry Strip */}
        {/*<div className="hidden items-center gap-4 rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-1.5 font-mono text-xs xl:flex">*/}
        {/*  <TelemetryReadout*/}
        {/*    icon={<Thermometer className="h-3.5 w-3.5 text-cyan-400" />}*/}
        {/*    label="MEDA TEMP"*/}
        {/*    value={`${tempC}°C`}*/}
        {/*  />*/}
        {/*  <Divider />*/}
        {/*  <TelemetryReadout*/}
        {/*    icon={<span className="text-[10px] font-bold text-cyan-400">Pa</span>}*/}
        {/*    label="PRESSURE"*/}
        {/*    value={`${pressurePa} Pa`}*/}
        {/*  />*/}
        {/*  <Divider />*/}
        {/*  <TelemetryReadout*/}
        {/*    icon={<Wind className="h-3.5 w-3.5 text-cyan-400" />}*/}
        {/*    label="WIND"*/}
        {/*    value={`${windMs.toFixed(1)} m/s`}*/}
        {/*  />*/}
        {/*  <Divider />*/}
        {/*  <TelemetryReadout*/}
        {/*    icon={<Radiation className="h-3.5 w-3.5 text-emerald-400" />}*/}
        {/*    label="BASE RAD"*/}
        {/*    value={`${baseRadMsv.toFixed(2)} mSv/day`}*/}
        {/*  />*/}
        {/*</div>*/}

        {/* Route Briefing Trigger */}
        {/*<div className="flex items-center gap-2.5">*/}
        {/*  <button*/}
        {/*    type="button"*/}
        {/*    onClick={onOpenBriefing}*/}
        {/*    className="flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20"*/}
        {/*  >*/}
        {/*    <Activity className="h-3.5 w-3.5 text-cyan-400" />*/}
        {/*    <span>ROUTE BRIEF</span>*/}
        {/*  </button>*/}
        {/*</div>*/}
      </div>
    </header>
  )
}

// function TelemetryReadout({
//   icon,
//   label,
//   value,
// }: {
//   icon: React.ReactNode
//   label: string
//   value: string
// }) {
//   return (
//     <div className="flex items-center gap-1.5">
//       {icon}
//       <span className="text-[10px] text-slate-400">{label}</span>
//       <span className="font-semibold text-slate-100">{value}</span>
//     </div>
//   )
// }
//
// function Divider() {
//   return <span className="h-3.5 w-px bg-slate-800" />
// }
