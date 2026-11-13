export const TOPO_LAYER_MAX = 8
export const THERMAL_LAYER_MAX = 8

export const THERMAL_THRESHOLDS_PCT = [
  0, 15, 28, 40, 52, 64, 75, 85, 93,
] as const

export function topoLayerToMeters(layerInt: number): number {
  const clamped = Math.max(0, Math.min(TOPO_LAYER_MAX, Math.round(layerInt)))
  return -2700 + clamped * 100
}

export function thermalLayerToThresholdPct(layerInt: number): number {
  const clamped = Math.max(0, Math.min(THERMAL_LAYER_MAX, Math.round(layerInt)))
  return THERMAL_THRESHOLDS_PCT[clamped]
}
