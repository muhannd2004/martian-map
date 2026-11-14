import { JEZERO_GEOLOGIC_UNITS } from '../data/geologicUnits'
import {
  JEZERO_WAYPOINTS,
  MARS_TREK_JEZERO_HIRISE_WMTS_URL,
} from '../data/waypoints'
import type {
  GeologicUnitProperties,
  HazardLevel,
  LatLonTuple,
  Waypoint,
  WaypointCategory,
  WaypointTelemetry,
} from '../types/eva'
import { coordsToEpsg4326Tile, formatWmtsTileUrl } from './hiriseTiles'
import { estimateJezeroElevationM, sampleDemMeters } from './molaDem'

const KM_PER_DEG_LAT = 59.2 // Mars mean spherical scale (~3390 km radius)
const KM_PER_DEG_LON_AT_JEZERO = KM_PER_DEG_LAT * Math.cos((18.5 * Math.PI) / 180)

function distanceKm(a: LatLonTuple, b: LatLonTuple): number {
  const dLatKm = (a[0] - b[0]) * KM_PER_DEG_LAT
  const dLonKm = (a[1] - b[1]) * KM_PER_DEG_LON_AT_JEZERO
  return Math.hypot(dLatKm, dLonKm)
}

function pointInRing(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function findGeologicUnit(lat: number, lon: number): GeologicUnitProperties | null {
  for (const feature of JEZERO_GEOLOGIC_UNITS.features) {
    const outerRing = feature.geometry.coordinates[0]
    if (outerRing && pointInRing(lat, lon, outerRing)) {
      return feature.properties
    }
  }
  return null
}

function findNearestPresetWaypoint(coords: LatLonTuple): {
  waypoint: Waypoint
  distanceKm: number
} {
  let best = JEZERO_WAYPOINTS[0]
  let bestDist = distanceKm(coords, best.coords)
  for (let i = 1; i < JEZERO_WAYPOINTS.length; i++) {
    const candidate = JEZERO_WAYPOINTS[i]
    const d = distanceKm(coords, candidate.coords)
    if (d < bestDist) {
      best = candidate
      bestDist = d
    }
  }
  return { waypoint: best, distanceKm: bestDist }
}

interface SiteClassification {
  category: WaypointCategory
  geologicUnit: string
  scienceObjective: string
  rationale: string
  hazardLevel?: HazardLevel
}

function classifySite(
  unit: GeologicUnitProperties | null,
  elevationM: number,
  nearest: Waypoint,
  distKm: number,
): SiteClassification {
  if (unit) {
    const categoryByUnit: Record<string, WaypointCategory> = {
      'crater-floor-fractured': 'habitat',
      'seitah-sand-ripples': 'hazard',
      'western-delta-scarp': 'climb',
      'margin-carbonate-unit': 'astrobiology',
    }
    return {
      category: categoryByUnit[unit.id] ?? 'geology',
      geologicUnit: `${unit.name} (${unit.slopeRange})`,
      scienceObjective: `${unit.description} Trafficability: ${unit.trafficability}.`,
      rationale: `Mapped within ${unit.name} (${unit.hazardLevel.toUpperCase()} hazard tier, ${distKm.toFixed(1)} km from ${nearest.name}).`,
      hazardLevel: unit.hazardLevel,
    }
  }

  if (elevationM >= -2200) {
    return {
      category: 'climb',
      geologicUnit: 'Jezero Crater Rim & Highlands (MOLA-Inferred)',
      scienceObjective:
        'Survey elevated Jezero rimwall megabreccia outcrops, impact-fractured bedrock, and high-gain relay sightlines.',
      rationale: `High-relief terrain above -2200 m (~${distKm.toFixed(1)} km from ${nearest.name}); verify escarpment gradients against suit slope limit before traverse.`,
      hazardLevel: 'high',
    }
  }

  if (elevationM >= -2460) {
    return {
      category: 'geology',
      geologicUnit: 'Western Delta Terrace & Paleochannels (MOLA-Inferred)',
      scienceObjective:
        'Log ancient deltaic sandstone benches, inverted river channels, and carbonate-bearing shoreline transitions.',
      rationale: `Intermediate delta bench elevation (${elevationM} m, ${distKm.toFixed(1)} km from ${nearest.name}) offers firm rock footing with localized channel drops.`,
      hazardLevel: 'moderate',
    }
  }

  return {
    category: 'geology',
    geologicUnit: 'Jezero Volcanic Basin Floor & Regolith (MOLA-Inferred)',
    scienceObjective:
      'Inspect basaltic crater floor pavers, fractured olivine units, and wind-sorted regolith contrast across the plain.',
    rationale: `Low-relief basin floor (${elevationM} m, ${distKm.toFixed(1)} km from ${nearest.name}) generally supports efficient EVA transit outside localized sand hollows.`,
    hazardLevel: 'low',
  }
}

function buildTelemetryFromElevation(
  elevationM: number,
  hazardLevel?: HazardLevel,
): WaypointTelemetry {
  const elevDelta = elevationM + 2568
  const tempC = -63 + Math.round(elevDelta * 0.022)
  const pressurePa = Math.max(520, Math.round(724 - elevDelta * 0.13))
  const baseWind =
    hazardLevel === 'extreme'
      ? 6.2
      : elevationM >= -2200
        ? 5.8
        : Math.min(6.0, 3.9 + Math.max(0, elevDelta * 0.004))
  const windMs = Number(baseWind.toFixed(1))
  const radiationMsvDay = Number(
    Math.max(0.58, 0.62 + elevDelta * 0.0005).toFixed(2),
  )

  return {
    tempC,
    pressurePa,
    windMs,
    radiationMsvDay,
  }
}

/**
 * Synthesize a full mission-grade Waypoint for any clicked location in Jezero Crater,
 * combining MOLA DEM height, USGS geologic zone matching, estimated MEDA/RAD telemetry,
 * and regional Mastcam-Z visual context from the nearest mission station.
 */
export function createCustomWaypointFromCoords(
  coords: LatLonTuple,
  id: string,
  shortLabel = 'PIN // CUSTOM',
  elevationOverrideM?: number,
): Waypoint {
  const lat = Number(coords[0].toFixed(4))
  const lon = Number(coords[1].toFixed(4))
  const normalizedCoords: LatLonTuple = [lat, lon]
  const elevationM =
    elevationOverrideM !== undefined
      ? Math.round(elevationOverrideM)
      : estimateJezeroElevationM(lat, lon)

  const unit = findGeologicUnit(lat, lon)
  const { waypoint: nearest, distanceKm: distKm } =
    findNearestPresetWaypoint(normalizedCoords)
  const info = classifySite(unit, elevationM, nearest, distKm)

  const { tx, ty } = coordsToEpsg4326Tile(normalizedCoords, 17)

  return {
    id,
    name: `Custom Waypoint (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
    shortLabel,
    category: info.category,
    coords: normalizedCoords,
    elevationM,
    geologicUnit: info.geologicUnit,
    scienceObjective: info.scienceObjective,
    rationale: info.rationale,
    telemetry: buildTelemetryFromElevation(elevationM, info.hazardLevel),
    povImageUrl: formatWmtsTileUrl(MARS_TREK_JEZERO_HIRISE_WMTS_URL, 17, ty, tx),
    povTitle: `Site Imagery (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E) — 25cm HiRISE`,
    povCredit: 'NASA / JPL / UofA HiRISE + CTX',
  }
}

/** Recompute elevation, MOLA-inferred classification, and telemetry once the DEM tile loads. */
export function withElevationEstimate(wp: Waypoint, dem: Uint8Array): Waypoint {
  const elevM = Math.round(sampleDemMeters(dem, wp.coords[0], wp.coords[1]))
  return createCustomWaypointFromCoords(wp.coords, wp.id, wp.shortLabel, elevM)
}
