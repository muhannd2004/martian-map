import type { EvaRoutePlan, LatLonTuple, PlanEvaParams, Waypoint } from '../types/eva'
import { planLocalEvaRoute } from './localRoutePlanner'

export async function fetchBackendRoute(
  start: Waypoint,
  target: Waypoint,
  params: PlanEvaParams,
): Promise<EvaRoutePlan> {
  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: start.coords, end: target.coords, max_slope: params.maxSlopeDeg }),
    })
    if (!res.ok) return planLocalEvaRoute(params)
    const data = (await res.json()) as { coordinates: LatLonTuple[]; cost: number; steps: number }
    const local = planLocalEvaRoute(params)
    return {
      ...local,
      coordinates: data.coordinates,
      slopeSource: 'python-backend',
      advisory: `DEM shortest path computed · ${data.steps} steps · cost ${data.cost.toFixed(1)}`,
    }
  } catch {
    return planLocalEvaRoute(params)
  }
}
