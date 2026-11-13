import { JEZERO_WAYPOINTS } from '../data/waypoints'
import type {
  ElevationPoint,
  EvaRoutePlan,
  LatLonTuple,
  PlanEvaParams,
  Waypoint,
} from '../types/eva'

const MARS_RADIUS_M = 3_389_500
const PRESET_WAYPOINT_IDS = new Set(JEZERO_WAYPOINTS.map((wp) => wp.id))
const SEITAH_CENTER: LatLonTuple = [18.435, 77.425]

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Haversine distance in meters using Mars mean volumetric radius. */
function marsDistanceM(a: LatLonTuple, b: LatLonTuple): number {
  const dLat = toRadians(b[0] - a[0])
  const dLon = toRadians(b[1] - a[1])
  const lat1 = toRadians(a[0])
  const lat2 = toRadians(b[0])

  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon

  return 2 * MARS_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

function findWaypoint(id: string, extraWaypoints?: Waypoint[]): Waypoint {
  if (extraWaypoints) {
    const customMatch = extraWaypoints.find((wp) => wp.id === id)
    if (customMatch) return customMatch
  }
  return JEZERO_WAYPOINTS.find((wp) => wp.id === id) ?? JEZERO_WAYPOINTS[0]
}

function crossesSeitahHazard(a: LatLonTuple, b: LatLonTuple): boolean {
  for (let i = 1; i <= 4; i++) {
    const t = i / 5
    const lat = a[0] + (b[0] - a[0]) * t
    const lon = a[1] + (b[1] - a[1]) * t
    if (marsDistanceM([lat, lon], SEITAH_CENTER) < 950) {
      return true
    }
  }
  return false
}

function appendCustomCorridor(
  corridor: LatLonTuple[],
  east: Waypoint,
  west: Waypoint,
  maxSlopeDeg: number,
  stormMode: boolean,
  hazardsAvoided: string[],
): number {
  const directM = marsDistanceM(east.coords, west.coords)
  const midLat = (east.coords[0] + west.coords[0]) / 2
  const midLon = (east.coords[1] + west.coords[1]) / 2

  if (crossesSeitahHazard(east.coords, west.coords)) {
    corridor.push([18.452, 77.425])
  } else if (directM > 900 && (stormMode || maxSlopeDeg < 14)) {
    const latShift = stormMode ? 0.0042 : 0.0024
    corridor.push([
      Number((midLat + latShift).toFixed(4)),
      Number(midLon.toFixed(4)),
    ])
  }

  if (stormMode) {
    hazardsAvoided.push(
      'Exposed Plateau Ridges (Dust/Radiation)',
      'Western Delta Escarpment (>15°)',
    )
  } else if (maxSlopeDeg < 14) {
    hazardsAvoided.push('Western Delta Escarpment (>13° Switchback)')
  } else if (maxSlopeDeg <= 18) {
    hazardsAvoided.push('Western Delta Steep Scarp (>18°)')
  }

  const gradeDeg =
    (Math.atan2(Math.abs(west.elevationM - east.elevationM), Math.max(250, directM)) *
      180) /
    Math.PI
  const terrainFactor = stormMode ? gradeDeg * 1.45 + 3.2 : gradeDeg * 1.7 + 4.1
  const cap = stormMode ? Math.min(maxSlopeDeg - 0.6, 12.6) : maxSlopeDeg - 0.4
  return Math.max(2.4, Math.min(cap, terrainFactor))
}

/**
 * Intermediate terrain corridor points inside the Jezero Delta operational area.
 * Normal mode respects slope limits; storm mode favors lower-lying, leeward terrain shelter.
 */
function buildCorridorPath(
  start: Waypoint,
  target: Waypoint,
  maxSlopeDeg: number,
  stormMode: boolean,
): { coords: LatLonTuple[]; hazardsAvoided: string[]; peakSlopeDeg: number } {
  if (start.id === target.id) {
    return {
      coords: [start.coords],
      hazardsAvoided: [],
      peakSlopeDeg: 1.5,
    }
  }

  const orderedByEastWest =
    start.coords[1] >= target.coords[1] ? [start, target] : [target, start]
  const reversed = orderedByEastWest[0].id !== start.id

  const corridor: LatLonTuple[] = [orderedByEastWest[0].coords]
  const hazardsAvoided: string[] = ['Séítah Eolian Sand Ripples']

  const isCustomRoute =
    !PRESET_WAYPOINT_IDS.has(start.id) || !PRESET_WAYPOINT_IDS.has(target.id)

  let basePeakSlope: number

  if (isCustomRoute) {
    basePeakSlope = appendCustomCorridor(
      corridor,
      orderedByEastWest[0],
      orderedByEastWest[1],
      maxSlopeDeg,
      stormMode,
      hazardsAvoided,
    )
  } else {
    const touchesEastHub =
      orderedByEastWest[0].id === 'butler-landing' ||
      orderedByEastWest[1].id === 'butler-landing'
    const crossesDelta =
      orderedByEastWest[1].id === 'bright-angel' ||
      orderedByEastWest[1].id === 'three-forks' ||
      orderedByEastWest[1].id === 'kodiak-butte'

    if (stormMode) {
      // Sheltered leeward corridor hugging the northern crater floor rim and delta base wall
      if (touchesEastHub) {
        corridor.push([18.4545, 77.4415], [18.4615, 77.4255])
      }
      if (crossesDelta) {
        corridor.push([18.4648, 77.4095], [18.4675, 77.3945])
        if (orderedByEastWest[1].id === 'bright-angel') {
          corridor.push([18.4775, 77.3795])
        }
      }
      hazardsAvoided.push(
        'Exposed Plateau Ridges (Dust/Radiation)',
        'Western Delta Escarpment (>15°)',
      )
    } else if (maxSlopeDeg < 14) {
      // Conservative low-slope switchback avoiding steep delta scarps
      if (touchesEastHub) {
        corridor.push([18.4495, 77.436], [18.4535, 77.419])
      }
      if (crossesDelta) {
        corridor.push([18.4588, 77.4045], [18.4665, 77.394], [18.476, 77.381])
      }
      hazardsAvoided.push('Western Delta Escarpment (>13° Switchback)')
    } else {
      // Standard nominal EVA corridor
      if (touchesEastHub && orderedByEastWest[1].id !== 'seitah-dunes') {
        corridor.push([18.4485, 77.4355], [18.4525, 77.4185])
      }
      if (orderedByEastWest[1].id === 'bright-angel') {
        corridor.push([18.4628, 77.3988], [18.4745, 77.3825])
      }
      if (maxSlopeDeg <= 18) {
        hazardsAvoided.push('Western Delta Steep Scarp (>18°)')
      }
    }

    basePeakSlope = stormMode
      ? Math.min(maxSlopeDeg - 0.8, 12.6)
      : maxSlopeDeg < 14
        ? Math.max(8.4, maxSlopeDeg - 0.6)
        : Math.min(maxSlopeDeg - 0.4, 14.8)
  }

  corridor.push(orderedByEastWest[1].coords)
  const finalCoords = reversed ? [...corridor].reverse() : corridor

  return {
    coords: finalCoords,
    hazardsAvoided,
    peakSlopeDeg: Number(basePeakSlope.toFixed(1)),
  }
}

function buildElevationProfile(
  coords: LatLonTuple[],
  startElevM: number,
  targetElevM: number,
  peakSlopeDeg: number,
  stormMode: boolean,
): { totalDistanceM: number; profile: ElevationPoint[] } {
  const segmentLengths = coords
    .slice(1)
    .map((pt, idx) => marsDistanceM(coords[idx], pt))
  const totalDistanceM = segmentLengths.reduce((acc, len) => acc + len, 0)

  if (totalDistanceM < 1) {
    return {
      totalDistanceM: 0,
      profile: [
        {
          distanceM: 0,
          elevationM: startElevM,
          slopeDeg: 1.2,
          terrainTag: 'Staging Pad',
        },
      ],
    }
  }

  const samples = 18
  const profile: ElevationPoint[] = []

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const distanceM = Math.round(totalDistanceM * t)
    // Smooth S-curve representing crater floor -> delta scarp climb -> plateau
    const scarpCurve = 0.5 - 0.5 * Math.cos(Math.PI * t)
    const microRipple = Math.sin(t * Math.PI * 5) * (stormMode ? 2.5 : 4.2)
    const elevationM = Math.round(
      startElevM + (targetElevM - startElevM) * scarpCurve + microRipple,
    )

    const bellFactor = Math.exp(-Math.pow((t - 0.58) / 0.24, 2))
    const slopeDeg = Number(
      Math.max(1.4, 2.2 + (peakSlopeDeg - 2.2) * bellFactor).toFixed(1),
    )

    const terrainTag =
      t < 0.3
        ? 'Crater Floor'
        : t < 0.72
          ? stormMode
            ? 'Leeward Ramp'
            : 'Delta Scarp'
          : 'Margin Bench'

    profile.push({ distanceM, elevationM, slopeDeg, terrainTag })
  }

  return { totalDistanceM: Math.round(totalDistanceM), profile }
}

/**
 * Pure client-side EVA route preview (no external backend API calls yet).
 * Slope raster computation and full DEM pathfinding will be served by the Python backend.
 */
export function planLocalEvaRoute({
  startWaypointId,
  targetWaypointId,
  maxSlopeDeg,
  stormMode,
  extraWaypoints,
}: PlanEvaParams): EvaRoutePlan {
  const start = findWaypoint(startWaypointId, extraWaypoints)
  const target = findWaypoint(targetWaypointId, extraWaypoints)

  const { coords, hazardsAvoided, peakSlopeDeg } = buildCorridorPath(
    start,
    target,
    maxSlopeDeg,
    stormMode,
  )

  const { totalDistanceM, profile } = buildElevationProfile(
    coords,
    start.elevationM,
    target.elevationM,
    peakSlopeDeg,
    stormMode,
  )

  // Average EVA walking speed ~1.15 m/s nominal, ~0.85 m/s in dust storm
  const speedMs = stormMode ? 0.85 : 1.15
  const estimatedTimeMin = Math.max(
    5,
    Math.round(totalDistanceM / speedMs / 60),
  )

  const avgRadRateMsvDay =
    (start.telemetry.radiationMsvDay + target.telemetry.radiationMsvDay) / 2
  const stormRadMultiplier = stormMode ? 3.8 : 1.0
  const cumulativeRadiationMsv = Number(
    (
      avgRadRateMsvDay *
      stormRadMultiplier *
      (estimatedTimeMin / (24 * 60))
    ).toFixed(3),
  )

  const o2ConsumedPct = Math.min(
    72,
    Math.round(estimatedTimeMin * (stormMode ? 0.34 : 0.24)),
  )
  const o2ReservePct = Math.max(18, 100 - o2ConsumedPct)

  const advisory =
    start.id === target.id
      ? 'Start and destination match. Select a distinct target waypoint to compute an EVA traverse.'
      : stormMode
        ? `SOLAR STORM SHELTER MODE: Rerouted along leeward scarp & crater-floor cover (${peakSlopeDeg}° max slope). Expect elevated RAD exposure.`
        : `Client-side route preview within ${maxSlopeDeg}° suit limit. Final pixel-level slope optimization will sync with the Python DEM backend.`

  return {
    routeId: `preview-${start.id}-${target.id}-${maxSlopeDeg}-${stormMode ? 'storm' : 'norm'}`,
    startWaypointId: start.id,
    targetWaypointId: target.id,
    mode: stormMode ? 'storm' : 'normal',
    maxSlopeLimitDeg: maxSlopeDeg,
    coordinates: coords,
    metrics: {
      distanceM: totalDistanceM,
      estimatedTimeMin,
      peakSlopeDeg,
      cumulativeRadiationMsv,
      o2ReservePct,
    },
    elevationProfile: profile,
    hazardsAvoided,
    advisory,
    slopeSource: 'local-preview',
  }
}
