export type LatLonTuple = [number, number]

export type LatLonBoundsTuple = [LatLonTuple, LatLonTuple]

export type WaypointCategory =
  | 'habitat'
  | 'hazard'
  | 'geology'
  | 'climb'
  | 'astrobiology'

export interface WaypointTelemetry {
  tempC: number
  pressurePa: number
  windMs: number
  radiationMsvDay: number
}

export interface WaypointPanorama {
  url: string
  verticalFovDeg: number
  horizontalFovDeg?: number
  initialPitchDeg?: number
  initialYawDeg?: number
}

export interface Waypoint {
  id: string
  name: string
  shortLabel: string
  category: WaypointCategory
  coords: LatLonTuple
  elevationM: number
  geologicUnit: string
  scienceObjective: string
  rationale: string
  telemetry: WaypointTelemetry
  povImageUrl: string
  povTitle: string
  povCredit: string
  panorama?: WaypointPanorama
}

export type HazardLevel = 'low' | 'moderate' | 'high' | 'extreme'

export interface GeologicUnitProperties {
  id: string
  name: string
  hazardLevel: HazardLevel
  slopeRange: string
  trafficability: string
  fillColor: string
  strokeColor: string
  description: string
}

export type LayerId =
  | 'molaElevation'
  | 'themisDayIr'
  | 'themisNightIr'
  | 'tesPyroxene'
  | 'tesPlagioclase'
  | 'tesDust'
  | 'slopeHeatmap'
  | 'geologicZones'

export type ControlCircleId =
  | LayerId
  | 'waypoints'
  | 'maxSlope'
  | 'stormMode'
  | 'avoidableArea'

export type LayerKind =
  | 'mola-dem'
  | 'themis-thermal'
  | 'tes-spectral'
  | 'local-raster'
  | 'vector'

export type LocalRasterKey = 'slopeHeatmap'

export type RasterLoadStatus = 'checking' | 'available' | 'missing'

export type RasterAvailabilityMap = Record<LocalRasterKey, RasterLoadStatus>

export type TopoStepM = 25 | 50 | 100
export type ThermalBandsCount = 8 | 12 | 16
export type SpectralPalette = 'pyroxene' | 'plagioclase' | 'dust'

export interface LayerConfig {
  id: LayerId
  label: string
  subtitle: string
  visible: boolean
  opacity: number
  kind: LayerKind
  wmtsUrl?: string
  attribution?: string
  maxNativeZoom?: number
  topoMinLayer?: number
  topoStepM?: TopoStepM
  thermalMinLayer?: number
  thermalBands?: ThermalBandsCount
  thermalRawRange?: [number, number]
  spectralMinLayer?: number
  spectralBands?: ThermalBandsCount
  spectralRawRange?: [number, number]
  spectralPalette?: SpectralPalette
  zIndex?: number
  localKey?: LocalRasterKey
  localPath?: string
  backendHandled?: boolean
}

export interface ElevationPoint {
  distanceM: number
  elevationM: number
  slopeDeg: number
  terrainTag: string
}

export interface EvaRouteMetrics {
  distanceM: number
  estimatedTimeMin: number
  peakSlopeDeg: number
  cumulativeRadiationMsv: number
  o2ReservePct: number
}

export interface EvaRoutePlan {
  routeId: string
  startWaypointId: string
  targetWaypointId: string
  mode: 'normal' | 'storm'
  maxSlopeLimitDeg: number
  coordinates: LatLonTuple[]
  metrics: EvaRouteMetrics
  elevationProfile: ElevationPoint[]
  hazardsAvoided: string[]
  advisory: string
  slopeSource: 'local-preview' | 'python-backend'
}

export type AvoidableArea = LatLonTuple[]

export interface PlanEvaParams {
  startWaypointId: string
  targetWaypointId: string
  maxSlopeDeg: number
  stormMode: boolean
  extraWaypoints?: Waypoint[]
  avoidableAreas?: AvoidableArea[]
}
