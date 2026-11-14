import heapq
import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject
from skimage.graph import MCP_Geometric
from skimage.draw import polygon
from rasterio.fill import fillnodata
from scipy.ndimage import gaussian_filter

class TerrainRouter:

    def __init__(
        self,
        dem_src,
        temp_src=None,
        w_slope=5.0,
        slope_power=2.0,  # >1 makes steep slopes disproportionately expensive
        max_slope=None,  # Optional hard cliff cutoff (blocks path if exceeded)
        w_temp=2.0,
        temp_threshold=30.0,
        temp_power=2.0,  # >1 makes extreme heat disproportionately expensive
        max_temp=None,  # Optional hard heat cutoff (e.g., 45.0°C)
    ):
        self.dem_src = dem_src
        self.temp_src = temp_src

        self.w_slope = w_slope
        self.slope_power = slope_power
        self.max_slope = max_slope

        self.w_temp = w_temp
        self.temp_threshold = temp_threshold
        self.temp_power = temp_power
        self.max_temp = max_temp

        self.dem = dem_src.read(1).astype(np.float32)
        if dem_src.nodata is not None:
            self.dem[self.dem == dem_src.nodata] = np.nan

        self.dem = fillnodata(self.dem, mask=~np.isnan(self.dem), max_search_distance=15)


        self.temp = self._align_to_dem(temp_src) if temp_src is not None else None

    def _align_to_dem(self, src):
        aligned = np.empty(self.dem.shape, dtype=np.float32)
        reproject(
            source=rasterio.band(src, 1),
            destination=aligned,
            src_transform=src.transform,
            src_crs=src.crs,
            dst_transform=self.dem_src.transform,
            dst_crs=self.dem_src.crs,
            resampling=Resampling.bilinear,
        )
        if src.nodata is not None:
            aligned[aligned == src.nodata] = np.nan
        return aligned

    def _slope_penalty(self, slope_val):
        if self.max_slope is not None and slope_val > self.max_slope:
            return np.inf
        return self.w_slope * (slope_val ** self.slope_power)

    def _temp_penalty(self, temp_val):
        if np.isnan(temp_val):
            return 0.0
        if self.max_temp is not None and temp_val > self.max_temp:
            return np.inf
        excess = max(0.0, temp_val - self.temp_threshold)
        return self.w_temp * (excess ** self.temp_power)

    def _validate_point(self, point, name="Point"):
        r, c = point
        rows, cols = self.dem.shape
        if not (0 <= r < rows and 0 <= c < cols):
            raise ValueError(f"{name} {point} is out of DEM bounds {(rows, cols)}.")
        if np.isnan(self.dem[r, c]):
            raise ValueError(f"{name} {point} lands on a NoData DEM pixel.")

    def get_best_path(self, start_rc, end_rc, directional_uphill=False, avoidable_areas=None):
        self._validate_point(start_rc, "Start")
        self._validate_point(end_rc, "End")

        if directional_uphill:
            return self._find_directional_path(start_rc, end_rc, avoidable_areas=avoidable_areas)
        return self._find_geometric_path(start_rc, end_rc, avoidable_areas=avoidable_areas)

    def _find_geometric_path(self, start_rc, end_rc, avoidable_areas=None):
        dy, dx = np.gradient(self.dem)
        slope = np.hypot(dx, dy)

        # Vectorized non-linear slope penalty
        slope_cost = self.w_slope * (slope ** self.slope_power)
        if self.max_slope is not None:
            slope_cost = np.where(slope > self.max_slope, np.inf, slope_cost)

        cost_surface = 1.0 + slope_cost

        if self.temp is not None:
            heat_excess = np.maximum(0.0, self.temp - self.temp_threshold)
            heat_cost = self.w_temp * (heat_excess ** self.temp_power)
            heat_cost = np.nan_to_num(heat_cost, nan=0.0)
            if self.max_temp is not None:
                heat_cost = np.where(self.temp > self.max_temp, np.inf, heat_cost)
            cost_surface += heat_cost

        cost_surface = np.where(np.isnan(self.dem), np.inf, cost_surface)

        if avoidable_areas:
            for area in avoidable_areas:
                if len(area) >= 3:
                    pts = np.array(area)
                    cr, cc = np.mean(pts[:, 0]), np.mean(pts[:, 1])
                    order = np.argsort(np.arctan2(pts[:, 0] - cr, pts[:, 1] - cc))
                    rr, cc_arr = polygon(pts[order, 0], pts[order, 1], shape=cost_surface.shape)
                    cost_surface[rr, cc_arr] = np.inf

        mcp = MCP_Geometric(cost_surface, fully_connected=True)
        cumulative_costs, _ = mcp.find_costs(starts=[start_rc], ends=[end_rc])

        total_cost = float(cumulative_costs[end_rc])
        if np.isinf(total_cost):
            raise RuntimeError("No valid path exists (blocked by NoData, cliffs, extreme heat, or avoidable areas).")

        path = np.array(mcp.traceback(end_rc))
        return {"path": path, "cost": total_cost, "steps": len(path)}

    def _find_directional_path(self, start_rc, end_rc, avoidable_areas=None):
        rows, cols = self.dem.shape
        avoid_mask = np.zeros(self.dem.shape, dtype=bool)
        if avoidable_areas:
            for area in avoidable_areas:
                if len(area) >= 3:
                    pts = np.array(area)
                    cr, cc = np.mean(pts[:, 0]), np.mean(pts[:, 1])
                    order = np.argsort(np.arctan2(pts[:, 0] - cr, pts[:, 1] - cc))
                    rr, cc_arr = polygon(pts[order, 0], pts[order, 1], shape=self.dem.shape)
                    avoid_mask[rr, cc_arr] = True

        pq = [(0.0, start_rc)]
        came_from = {}
        best_cost = {start_rc: 0.0}

        neighbors = [
            (-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
            (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142),
        ]

        while pq:
            curr_cost, (r, c) = heapq.heappop(pq)
            if (r, c) == end_rc:
                break
            if curr_cost > best_cost.get((r, c), np.inf):
                continue

            curr_elev = self.dem[r, c]
            for dr, dc, dist in neighbors:
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols:
                    if avoid_mask[nr, nc]:
                        continue
                    next_elev = self.dem[nr, nc]
                    if np.isnan(next_elev):
                        continue

                    dz = max(0.0, next_elev - curr_elev)
                    uphill_cost = self._slope_penalty(dz)
                    if np.isinf(uphill_cost):
                        continue

                    heat_cost = 0.0
                    if self.temp is not None:
                        heat_cost = self._temp_penalty(self.temp[nr, nc])
                        if np.isinf(heat_cost):
                            continue

                    new_cost = curr_cost + dist + uphill_cost + heat_cost
                    if new_cost < best_cost.get((nr, nc), np.inf):
                        best_cost[(nr, nc)] = new_cost
                        came_from[(nr, nc)] = (r, c)
                        heapq.heappush(pq, (new_cost, (nr, nc)))

        if end_rc not in best_cost:
            raise RuntimeError("No valid path exists (blocked by cliffs or extreme heat).")

        path = []
        curr = end_rc
        while curr in came_from:
            path.append(curr)
            curr = came_from[curr]
        path.append(start_rc)
        path = np.array(path[::-1])

        return {"path": path, "cost": float(best_cost[end_rc]), "steps": len(path)}

    def get_dem(self):
        return self.dem