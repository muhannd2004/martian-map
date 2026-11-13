from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import rasterio

from service.mapper import Mapper
from service.terrain_router import TerrainRouter

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEM_PATH = "../data/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif"


class RouteRequest(BaseModel):
    start: list[float]
    end: list[float]
    max_slope: float = 15.0


@app.post("/api/route")
def get_route(req: RouteRequest):
    with rasterio.open(DEM_PATH) as dem_src:
        mapper = Mapper(dem_src)
        router = TerrainRouter(dem_src=dem_src, slope_power=2, max_slope=req.max_slope)
        start_rc = mapper.latlon_to_rc(req.start[0], req.start[1])
        end_rc = mapper.latlon_to_rc(req.end[0], req.end[1])
        try:
            result = router.get_best_path(start_rc, end_rc)
        except (ValueError, RuntimeError) as e:
            raise HTTPException(status_code=400, detail=str(e))
        coords = mapper.path_to_latlon(result["path"])
    return {"coordinates": coords, "cost": result["cost"], "steps": result["steps"]}
