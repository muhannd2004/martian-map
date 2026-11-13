import type { FeatureCollection, Polygon } from 'geojson'
import type { GeologicUnitProperties, LatLonTuple } from '../types/eva'

/**
 * Starter USGS Geologic & Trafficability Zones across the Jezero Western Delta core.
 * Note: GeoJSON uses [longitude, latitude] coordinate order.
 */
export const JEZERO_GEOLOGIC_UNITS: FeatureCollection<
  Polygon,
  GeologicUnitProperties
> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'crater-floor-fractured',
        name: 'Crater Floor Fractured Unit',
        hazardLevel: 'moderate',
        slopeRange: '2° – 8°',
        trafficability: 'Nominal — Flat volcanic plains with scattered fractured pavers',
        fillColor: '#38bdf8',
        strokeColor: '#0ea5e9',
        description:
          'Basaltic crater floor around Octavia E. Butler Landing. Low slope angles make it ideal for Habitat infrastructure and high-speed EVA traverses.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.416, 18.436],
            [77.466, 18.432],
            [77.468, 18.466],
            [77.422, 18.468],
            [77.412, 18.452],
            [77.416, 18.436],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'seitah-sand-ripples',
        name: 'Séítah Eolian Sand Ripples',
        hazardLevel: 'extreme',
        slopeRange: '8° – 18° (Loose Regolith)',
        trafficability: 'High Slip / Entrapment Hazard — Avoid crossing ripple troughs',
        fillColor: '#ef4444',
        strokeColor: '#f87171',
        description:
          'Deep eolian megaripples and windblown dust traps surrounding [18.435, 77.425]. High boot/wheel sinkage risk requires perimeter routing.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.408, 18.425],
            [77.442, 18.424],
            [77.444, 18.443],
            [77.415, 18.447],
            [77.405, 18.435],
            [77.408, 18.425],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'western-delta-scarp',
        name: 'Western Sedimentary Delta & Scarp',
        hazardLevel: 'high',
        slopeRange: '15° – 25° Cliff Edge',
        trafficability: 'Slope-Constrained — Use Three Forks ramp corridors only',
        fillColor: '#f59e0b',
        strokeColor: '#fbbf24',
        description:
          'Steeply eroded delta front spanning Kodiak Butte and Three Forks. Unclamped direct ascents exceed 15° suit stability thresholds.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.376, 18.448],
            [77.414, 18.447],
            [77.412, 18.478],
            [77.386, 18.494],
            [77.372, 18.472],
            [77.376, 18.448],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'margin-carbonate-unit',
        name: 'Margin Carbonate Unit',
        hazardLevel: 'low',
        slopeRange: '4° – 12°',
        trafficability: 'Fair — Ancient shoreline benches & Neretva channel walls',
        fillColor: '#10b981',
        strokeColor: '#34d399',
        description:
          'High astrobiology priority shoreline carbonate belt around Bright Angel [18.485, 77.365]. Offers partial cliff-wall shelter during dust events.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.336, 18.468],
            [77.382, 18.472],
            [77.386, 18.506],
            [77.340, 18.506],
            [77.334, 18.484],
            [77.336, 18.468],
          ],
        ],
      },
    },
  ],
}

/** Approximate Mars 2020 Perseverance traverse path in [lat, lon] order for Leaflet Polyline */
export const PERSEVERANCE_TRAVERSE: LatLonTuple[] = [
  [18.4447, 77.4508], // Octavia E. Butler Landing
  [18.4415, 77.443],
  [18.4368, 77.434], // South around Séítah rim
  [18.441, 77.422],
  [18.4485, 77.413],
  [18.4555, 77.406], // Approaching Kodiak / Three Forks
  [18.462, 77.398], // Three Forks
  [18.4685, 77.391],
  [18.4742, 77.382],
  [18.4795, 77.373],
  [18.485, 77.365], // Bright Angel / Margin Unit
]
