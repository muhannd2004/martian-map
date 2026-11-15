import type { EvaRoutePlan, LatLonTuple, PlanEvaParams, Waypoint } from '../types/eva'
import { planLocalEvaRoute } from './localRoutePlanner'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export async function fetchBackendRoute(
  start: Waypoint,
  target: Waypoint,
  params: PlanEvaParams,
): Promise<EvaRoutePlan> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: start.coords,
        end: target.coords,
        max_slope: params.maxSlopeDeg,
        avoidable_areas: params.avoidableAreas ?? [],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      const local = planLocalEvaRoute(params)
      return {
        ...local,
        advisory: err?.detail ? `Route blocked: ${err.detail}` : 'No valid path within constraints',
      }
    }
    const data = (await res.json()) as { coordinates: LatLonTuple[]; cost: number; steps: number }
    const local = planLocalEvaRoute(params)
    const avoidedCount = params.avoidableAreas?.length ?? 0
    return {
      ...local,
      coordinates: data.coordinates,
      slopeSource: 'python-backend',
      advisory: `DEM shortest path computed · ${data.steps} steps · cost ${data.cost.toFixed(1)}${
        avoidedCount > 0 ? ` · ${avoidedCount} avoidable area(s) bypassed` : ''
      }`,
    }
  } catch {
    return planLocalEvaRoute(params)
  }
}
