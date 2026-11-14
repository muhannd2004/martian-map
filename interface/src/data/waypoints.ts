import {
  coordsToEpsg4326Tile,
  formatWmtsTileUrl,
} from '../services/hiriseTiles'
import type {
  LatLonBoundsTuple,
  LatLonTuple,
  LayerConfig,
  Waypoint,
} from '../types/eva'

/** Maximum coverage of NASA Mars Trek Jezero 25cm HiRISE Orthomosaic (~20.3 km x 21.5 km) */
export const JEZERO_BOUNDS: LatLonBoundsTuple = [
  [18.3067994, 77.2229331], // [south, west]
  [18.669315, 77.583964],   // [north, east]
]

export const JEZERO_CENTER: LatLonTuple = [18.465, 77.40]
export const JEZERO_DEFAULT_ZOOM = 12

/** NASA Mars Trek WMTS endpoints (Equirectangular / EPSG:4326) */
export const MARS_TREK_JEZERO_CTX_MOSAIC_WMTS_URL =
  'https://trek.nasa.gov/tiles/Mars/EQ/NES_JEZ_MID_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018/1.0.0/default/default028mm/{z}/{y}/{x}.png'

export const MARS_TREK_JEZERO_HIRISE_WMTS_URL =
  'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm/{z}/{y}/{x}.png'

export const MARS_TREK_THEMIS_NIGHT_IR_WMTS_URL =
  'https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{y}/{x}.png'

export const MARS_TREK_THEMIS_DAY_IR_WMTS_URL =
  'https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{y}/{x}.png'

export const MARS_TREK_MOLA_ELEVATION_WMTS_URL =
  'https://trek.nasa.gov/tiles/Mars/EQ/mola128_mola64_merge_90Nto90S_SimpleC_clon0/1.0.0/default/default028mm/5/12/45.png'

// NASA Mars Trek MGS TES spectral products serve native zoom levels 0..1 (Jezero lies inside 1/0/2.png)
export const MARS_TREK_TES_PYROXENE_WMTS_URL =
  'https://trek.nasa.gov/tiles/Mars/EQ/TES_Clinopyroxene/1.0.0/default/default028mm/1/0/2.png'

export const MARS_TREK_TES_PLAGIOCLASE_WMTS_URL =
  'https://trek.nasa.gov/tiles/Mars/EQ/TES_Plagioclase/1.0.0/default/default028mm/1/0/2.png'

export const MARS_TREK_TES_DUST_WMTS_URL =
  'https://trek.nasa.gov/tiles/Mars/EQ/TES_Dust/1.0.0/default/default028mm/1/0/2.png'

function hiRiseCenterTileUrl(coords: LatLonTuple, z = 17): string {
  const { ty, tx } = coordsToEpsg4326Tile(coords, z)
  return formatWmtsTileUrl(MARS_TREK_JEZERO_HIRISE_WMTS_URL, z, ty, tx)
}

export const JEZERO_WAYPOINTS: Waypoint[] = [
  {
    id: 'butler-landing',
    name: 'Octavia E. Butler Landing',
    shortLabel: 'HAB // BUTLER',
    category: 'habitat',
    coords: [18.4447, 77.4508],
    elevationM: -2568,
    geologicUnit: 'Crater Floor Fractured Unit (Máaz Formation)',
    scienceObjective:
      'Primary EVA staging hub, pressurized habitat anchor, and basaltic crater-floor baseline calibration.',
    rationale:
      'Flat, trafficable volcanic plains with minimal boulder density and clear line-of-sight communications to orbital relays.',
    telemetry: {
      tempC: -63,
      pressurePa: 724,
      windMs: 3.8,
      radiationMsvDay: 0.62,
    },
    povImageUrl: '/panoramas/butler-landing.jpg',
    povTitle: 'Octavia E. Butler Landing 360° Panorama (Mastcam-Z)',
    povCredit: 'NASA/JPL-Caltech/ASU/MSSS • 360° Panorama',
    panorama: {
      url: '/panoramas/butler-landing.jpg',
      verticalFovDeg: 112,
      horizontalFovDeg: 360,
      initialPitchDeg: 10,
      initialYawDeg: 0,
    },
  },
  {
    id: 'seitah-dunes',
    name: 'Séítah Dune Field',
    shortLabel: 'HAZ // SÉÍTAH',
    category: 'hazard',
    coords: [18.435, 77.425],
    elevationM: -2581,
    geologicUnit: 'Séítah Olivine-Cumulate & Eolian Sand Ripples',
    scienceObjective:
      'No-go / cautious perimeter inspection of wind-sculpted eolian megaripples and olivine-rich bedrock.',
    rationale:
      'Unconsolidated dust and steep lee-side ripple crests pose severe rover wheel and astronaut boot sinkage risks.',
    telemetry: {
      tempC: -66,
      pressurePa: 728,
      windMs: 6.4,
      radiationMsvDay: 0.65,
    },
    povImageUrl: '/panoramas/seitah.jpg',
    povTitle: 'Séítah Megaripples 360° Mosaic (Mastcam-Z)',
    povCredit: 'NASA/JPL-Caltech • 360° Panorama',
    panorama: {
      url: '/panoramas/seitah.jpg',
      verticalFovDeg: 54,
      horizontalFovDeg: 360,
      initialPitchDeg: 3,
      initialYawDeg: 0,
    },
  },
  {
    id: 'kodiak-butte',
    name: 'Kodiak Butte',
    shortLabel: 'GEO // KODIAK',
    category: 'geology',
    coords: [18.452, 77.405],
    elevationM: -2534,
    geologicUnit: 'Eroded Delta Remnant (Gilbert-Type Delta Foresets)',
    scienceObjective:
      'High-resolution stratigraphic logging of steeply dipping river-delta foreset beds and flood-deposited cobbles.',
    rationale:
      'Exposed cliff cross-section preserves an unambiguous record of ancient lake level and episodic high-energy floods.',
    telemetry: {
      tempC: -64,
      pressurePa: 719,
      windMs: 4.5,
      radiationMsvDay: 0.64,
    },
    povImageUrl: '/panoramas/kodiak-butte.jpg',
    povTitle: 'Kodiak Butte 360° Delta Stratigraphy (Mastcam-Z)',
    povCredit: 'NASA/JPL-Caltech/ASU/MSSS • 360° Panorama',
    panorama: {
      url: '/panoramas/kodiak-butte.jpg',
      verticalFovDeg: 96,
      horizontalFovDeg: 360,
      initialPitchDeg: 6,
      initialYawDeg: 0,
    },
  },
  {
    id: 'three-forks',
    name: 'Three Forks / Delta Front',
    shortLabel: 'RAMP // 3-FORKS',
    category: 'climb',
    coords: [18.462, 77.398],
    elevationM: -2498,
    geologicUnit: 'Western Sedimentary Delta & Escarpment',
    scienceObjective:
      'Navigate slope-constrained ascent corridor onto the delta top while sampling fine-grained mudstones at the base.',
    rationale:
      '15°–25° escarpment walls require strict suit slope thresholding; fine-grained bottomset mudstones excel at preserving organics.',
    telemetry: {
      tempC: -62,
      pressurePa: 714,
      windMs: 5.1,
      radiationMsvDay: 0.66,
    },
    povImageUrl: hiRiseCenterTileUrl([18.462, 77.398]),
    povTitle: 'Three Forks / Delta Front — 25cm HiRISE Orbital View',
    povCredit: 'NASA / JPL / UofA HiRISE',
  },
  {
    id: 'bright-angel',
    name: 'Margin Unit / Bright Angel',
    shortLabel: 'BIO // BRIGHT ANGEL',
    category: 'astrobiology',
    coords: [18.485, 77.365],
    elevationM: -2432,
    geologicUnit: 'Margin Carbonate & Neretva Vallis Channel Unit',
    scienceObjective:
      'Primary astrobiology target: core carbonate-cemented shoreline deposits and light-toned mudstone veins for biosignatures.',
    rationale:
      'Ancient shoreline carbonates and redox-stratified mudstones in Neretva Vallis represent the highest-priority microbial habitat.',
    telemetry: {
      tempC: -60,
      pressurePa: 706,
      windMs: 4.9,
      radiationMsvDay: 0.69,
    },
    povImageUrl: hiRiseCenterTileUrl([18.485, 77.365]),
    povTitle: 'Margin Unit / Bright Angel — 25cm HiRISE Orbital View',
    povCredit: 'NASA / JPL / UofA HiRISE',
  },
]

export const INITIAL_LAYERS: LayerConfig[] = [
  {
    id: 'molaElevation',
    label: 'Elevation Heatmap (MOLA DEM)',
    subtitle: 'Calibrated Jezero heights (-2660m to -1880m rim)',
    visible: false,
    opacity: 0.72,
    kind: 'mola-dem',
    wmtsUrl: MARS_TREK_MOLA_ELEVATION_WMTS_URL,
    attribution: 'NASA / JPL MOLA',
    maxNativeZoom: 13,
    topoMinLayer: 0,
    topoStepM: 50,
    zIndex: 10,
  },
  {
    id: 'themisNightIr',
    label: 'Thermal Heatmap (THEMIS Night IR)',
    subtitle: 'Red (rocky heat) vs. Blue (cold sand/dust) • 100m/px',
    visible: false,
    opacity: 0.72,
    kind: 'themis-thermal',
    wmtsUrl: MARS_TREK_THEMIS_NIGHT_IR_WMTS_URL,
    attribution: 'NASA / JPL / ASU THEMIS',
    maxNativeZoom: 9,
    thermalMinLayer: 0,
    thermalBands: 12,
    thermalRawRange: [32, 190],
    zIndex: 11,
  },
  {
    id: 'themisDayIr',
    label: 'Thermal Heatmap (THEMIS Day IR)',
    subtitle: 'Daytime Red/Blue infrared temperature • 100m/px',
    visible: false,
    opacity: 0.72,
    kind: 'themis-thermal',
    wmtsUrl: MARS_TREK_THEMIS_DAY_IR_WMTS_URL,
    attribution: 'NASA / JPL / ASU THEMIS',
    maxNativeZoom: 9,
    thermalMinLayer: 0,
    thermalBands: 12,
    thermalRawRange: [85, 175],
    zIndex: 12,
  },
  {
    id: 'tesPyroxene',
    label: 'High-Calcium Pyroxene Abundance',
    subtitle: 'MGS TES clinopyroxene mafic signature',
    visible: false,
    opacity: 0.65,
    kind: 'tes-spectral',
    wmtsUrl: MARS_TREK_TES_PYROXENE_WMTS_URL,
    attribution: 'NASA / JPL / ASU MGS TES',
    maxNativeZoom: 13,
    spectralMinLayer: 0,
    spectralBands: 12,
    spectralRawRange: [0.24, 0.68],
    spectralPalette: 'pyroxene',
    zIndex: 13,
  },
  {
    id: 'tesPlagioclase',
    label: 'Plagioclase Feldspar Abundance',
    subtitle: 'MGS TES crustal feldspar enrichment',
    visible: false,
    opacity: 0.65,
    kind: 'tes-spectral',
    wmtsUrl: MARS_TREK_TES_PLAGIOCLASE_WMTS_URL,
    attribution: 'NASA / JPL / ASU MGS TES',
    maxNativeZoom: 13,
    spectralMinLayer: 0,
    spectralBands: 12,
    spectralRawRange: [0.2, 0.78],
    spectralPalette: 'plagioclase',
    zIndex: 14,
  },
  {
    id: 'tesDust',
    label: 'Surface Dust Cover Index',
    subtitle: 'MGS TES fine regolith & dust mantle index',
    visible: false,
    opacity: 0.6,
    kind: 'tes-spectral',
    wmtsUrl: MARS_TREK_TES_DUST_WMTS_URL,
    attribution: 'NASA / JPL / ASU MGS TES',
    maxNativeZoom: 13,
    spectralMinLayer: 0,
    spectralBands: 12,
    spectralRawRange: [0.0, 0.28],
    spectralPalette: 'dust',
    zIndex: 15,
  },
  {
    id: 'geologicZones',
    label: 'USGS Geologic & Trafficability',
    subtitle: 'GeoJSON hazard & astrobiology zones',
    visible: true,
    opacity: 0.45,
    kind: 'vector',
  },
  {
    id: 'perseveranceTraverse',
    label: 'Perseverance Historical Traverse',
    subtitle: 'Mars 2020 Jezero reference path',
    visible: true,
    opacity: 0.85,
    kind: 'vector',
  },
]
