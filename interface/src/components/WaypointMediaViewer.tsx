import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Compass, Satellite, X } from 'lucide-react'
import type { Waypoint } from '../types/eva'
import { HiRISEZoomViewer } from './HiRISEZoomViewer'
import { Panorama360Viewer } from './Panorama360Viewer'

interface WaypointMediaViewerProps {
  waypoint: Waypoint
  heightClass?: string
  showHeader?: boolean
}

/**
 * Unified waypoint visual viewer:
 * - Renders an interactive WebGL 360° panorama for stations with a 360 mosaic (`kodiak-butte`, `seitah-dunes`)
 * - Renders a coordinate-centered high-resolution zoomed-in HiRISE (25cm/px) orbital view for all other sites
 * - Provides a document-body portal modal so fullscreen works cleanly from inside Leaflet popups
 */
export function WaypointMediaViewer({
  waypoint,
  heightClass = 'h-44',
  showHeader = false,
}: WaypointMediaViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const is360 = Boolean(waypoint.panorama)
  const viewerKey = `${waypoint.id}-${waypoint.coords[0]}-${waypoint.coords[1]}`

  useEffect(() => {
    if (!expanded) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setExpanded(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [expanded])

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      {showHeader && (
        <div className="flex items-center justify-between border-b border-slate-800/80 px-2.5 py-1.5 font-mono text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-200">
            {is360 ? (
              <Compass className="h-3 w-3 text-cyan-400" />
            ) : (
              <Satellite className="h-3 w-3 text-cyan-400" />
            )}
            <span>
              {is360 ? '360° MASTCAM-Z VIEW' : '25CM HIRISE ZOOM VIEW'}
            </span>
          </span>
          <span className="text-[9px] text-slate-500">{waypoint.povCredit}</span>
        </div>
      )}

      {waypoint.panorama ? (
        <Panorama360Viewer
          key={`inline-360-${viewerKey}`}
          panorama={waypoint.panorama}
          title={waypoint.povTitle}
          className={`${heightClass} w-full rounded-none border-0`}
          onExpand={() => setExpanded(true)}
        />
      ) : (
        <HiRISEZoomViewer
          key={`inline-hirise-${viewerKey}`}
          coords={waypoint.coords}
          title={waypoint.povTitle}
          className={`${heightClass} w-full rounded-none border-0`}
          onExpand={() => setExpanded(true)}
        />
      )}

      {expanded &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${waypoint.name} Visual Inspection`}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-500/40 bg-[#0b111e]/98 shadow-[0_24px_90px_rgba(0,0,0,0.95)]"
            >
              {/* Modal Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/75 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/45 bg-cyan-500/15 text-cyan-300">
                    {is360 ? (
                      <Compass className="h-4 w-4" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase">
                        {waypoint.name}
                      </h3>
                      <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-500/35">
                        {is360 ? '360° INTERACTIVE' : '25CM/PX HIRISE ORBITAL'}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-400">
                      {waypoint.coords[0].toFixed(4)}°N,{' '}
                      {waypoint.coords[1].toFixed(4)}°E • {waypoint.elevationM} m
                      • {waypoint.geologicUnit}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label="Close fullscreen view"
                  className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Main Interactive 360° or Zoomed HiRISE Canvas */}
              {waypoint.panorama ? (
                <Panorama360Viewer
                  key={`modal-360-${viewerKey}`}
                  panorama={waypoint.panorama}
                  title={waypoint.povTitle}
                  className="h-[62vh] min-h-[360px] w-full rounded-none border-0"
                  showExpand={false}
                />
              ) : (
                <HiRISEZoomViewer
                  key={`modal-hirise-${viewerKey}`}
                  coords={waypoint.coords}
                  title={waypoint.povTitle}
                  defaultZoom={17}
                  defaultMagnify={1.45}
                  className="h-[62vh] min-h-[360px] w-full rounded-none border-0"
                  showExpand={false}
                />
              )}

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950/75 px-4 py-2.5">
                <p className="text-xs text-slate-300">
                  {waypoint.scienceObjective}
                </p>
                <span className="font-mono text-[10px] text-slate-500">
                  {waypoint.povCredit}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
