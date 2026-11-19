"""Haversine Distance Formula and Spatial Geometry Utilities.

Zero paid APIs or external services required.
Calculates spherical straight-line distances between geographic coordinates in kilometers.
"""
import math
from typing import List, Optional, Tuple

EARTH_RADIUS_KM = 6371.0088


def haversine_distance_km(
    lat1: Optional[float],
    lon1: Optional[float],
    lat2: Optional[float],
    lon2: Optional[float]
) -> Optional[float]:
    """Calculate the great-circle distance between two points on Earth in kilometers.
    
    Returns None if any coordinate is missing or invalid.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None

    try:
        lat1_f = float(lat1)
        lon1_f = float(lon1)
        lat2_f = float(lat2)
        lon2_f = float(lon2)
    except (ValueError, TypeError):
        return None

    # Validate bounds
    if not (-90.0 <= lat1_f <= 90.0 and -180.0 <= lon1_f <= 180.0):
        return None
    if not (-90.0 <= lat2_f <= 90.0 and -180.0 <= lon2_f <= 180.0):
        return None

    # Convert degrees to radians
    phi1 = math.radians(lat1_f)
    phi2 = math.radians(lat2_f)
    delta_phi = math.radians(lat2_f - lat1_f)
    delta_lambda = math.radians(lon2_f - lon1_f)

    # Haversine formula
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    # Clamp to avoid floating point domain errors in sqrt
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    distance = EARTH_RADIUS_KM * c
    return round(distance, 2)


def calculate_cluster_centroid(
    points: List[Tuple[float, float]]
) -> Optional[Tuple[float, float]]:
    """Compute geographic centroid (average lat, lon) of a cluster of points.
    
    Points is a list of (latitude, longitude) tuples.
    """
    valid_points = []
    for lat, lon in points:
        if lat is not None and lon is not None:
            try:
                lat_f = float(lat)
                lon_f = float(lon)
                if -90.0 <= lat_f <= 90.0 and -180.0 <= lon_f <= 180.0:
                    valid_points.append((lat_f, lon_f))
            except (ValueError, TypeError):
                continue

    if not valid_points:
        return None

    avg_lat = sum(p[0] for p in valid_points) / len(valid_points)
    avg_lon = sum(p[1] for p in valid_points) / len(valid_points)
    return (round(avg_lat, 6), round(avg_lon, 6))

