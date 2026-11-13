import numpy as np
import rasterio
import matplotlib.pyplot as plt

from service.mapper import Mapper
from service.terrain_router import TerrainRouter

data = "../data/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif"

with rasterio.open(data) as dem_src:
    router = TerrainRouter(dem_src=dem_src, slope_power=4)
    mapper = Mapper(dem_src)
    result = router.get_best_path((5, 2), (1500, 600))
    dem = router.get_dem()
    count = np.sum(~np.isnan(dem))
    path = result["path"]

fig, ax= plt.subplots(1, 1, figsize=(14, 6))

im1 = ax.imshow(dem, cmap="terrain", vmin=np.nanmin(dem), vmax=np.nanmax(dem))
ax.set_title("Elevation (meters)")
plt.colorbar(im1, ax=ax, label="Meters")

ax.plot(path[:, 1], path[:, 0], color="red", linewidth=2, label="Best Path")

ax.scatter(
    path[0, 1], path[0, 0], color="lime", edgecolor="black", s=80, zorder=5, label="Start"
)
ax.scatter(
    path[-1, 1], path[-1, 0], color="blue", edgecolor="black", s=80, zorder=5, label="End"
)

plt.tight_layout()
plt.show()


