from pyproj import Transformer
import rasterio

class Mapper:
    def __init__(self, dem_src):
        self.dem_src = dem_src

    def latlon_to_rc(self, lat, lon):
        geo_crs = self.dem_src.crs.geodetic_crs
        transformer = Transformer.from_crs(geo_crs, self.dem_src.crs, always_xy=True)

        x_map, y_map = transformer.transform(lon, lat)
        row, col = rasterio.transform.rowcol(self.dem_src.transform, x_map, y_map)
        return int(row), int(col)

    def path_to_latlon(self, path_rc):
        geo_crs = self.dem_src.crs.geodetic_crs
        transformer = Transformer.from_crs(self.dem_src.crs, geo_crs, always_xy=True)

        rows = path_rc[:, 0]
        cols = path_rc[:, 1]
        xs, ys = rasterio.transform.xy(self.dem_src.transform, rows, cols)
        lons, lats = transformer.transform(xs, ys)

        return [[float(lat), float(lon)] for lat, lon in zip(lats, lons)]