import shapely
import geopandas as gpd

features = gpd.GeoDataFrame(
    data={
        "name": ["0", "1", "2", "3"],
        "connectivity": [
            ["1"],
            ["0", "2", "3"],
            ["1", "3"],
            ["2"],
        ],
    },
    geometry=[
        shapely.geometry.Point(10, 54).buffer(2.0),
        shapely.geometry.LineString([(10, 44), (20, 44)]).buffer(1.0),
        shapely.geometry.Polygon([(10, 64), (20, 64), (20, 50)]),
        shapely.geometry.MultiPolygon([
            shapely.geometry.Polygon([(20, 49), (10, 46), (10, 51)]),
            shapely.geometry.Polygon([(20, 48), (12, 46), (16, 46)]),
        ]),
    ]
)

features.to_file('features.geojson', driver='GeoJSON')