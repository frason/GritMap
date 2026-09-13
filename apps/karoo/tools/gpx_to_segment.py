#!/usr/bin/env python3
"""Convert an ordered GPX track into a GritMap v1 segment JSON file."""

from __future__ import annotations

import argparse
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path


EARTH_RADIUS_METERS = 6_371_008.8


def haversine_meters(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    lat1, lng1, _ = a
    lat2, lng2, _ = b
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(h))


def read_track(path: Path) -> tuple[str, list[tuple[float, float, float]]]:
    root = ET.parse(path).getroot()
    namespace = {"gpx": root.tag.partition("}")[0].removeprefix("{")}
    name = root.findtext("gpx:trk/gpx:name", default=path.stem, namespaces=namespace).strip()
    segments = root.findall("gpx:trk/gpx:trkseg", namespace)
    if len(segments) != 1:
        raise ValueError(f"expected exactly one GPX track segment, found {len(segments)}")

    points: list[tuple[float, float, float]] = []
    for node in segments[0].findall("gpx:trkpt", namespace):
        elevation = node.findtext("gpx:ele", namespaces=namespace)
        if elevation is None:
            raise ValueError("every track point must include elevation")
        points.append((float(node.attrib["lat"]), float(node.attrib["lon"]), float(elevation)))
    if len(points) < 2:
        raise ValueError("track must contain at least two points")
    return name, points


def resample(points: list[tuple[float, float, float]], spacing: float) -> tuple[list[dict[str, float]], float]:
    cumulative = [0.0]
    for start, end in zip(points, points[1:]):
        cumulative.append(cumulative[-1] + haversine_meters(start, end))
    total = cumulative[-1]
    targets = [float(value) for value in range(0, int(total // spacing) * int(spacing) + 1, int(spacing))]
    if not math.isclose(targets[-1], total, abs_tol=1e-6):
        targets.append(total)

    output: list[dict[str, float]] = []
    edge = 0
    for target in targets:
        while edge + 1 < len(cumulative) and cumulative[edge + 1] < target:
            edge += 1
        span = cumulative[edge + 1] - cumulative[edge]
        ratio = 0.0 if span == 0 else (target - cumulative[edge]) / span
        start, end = points[edge], points[edge + 1]
        output.append(
            {
                "lat": round(start[0] + (end[0] - start[0]) * ratio, 7),
                "lng": round(start[1] + (end[1] - start[1]) * ratio, 7),
                "distanceMeters": round(target, 3),
                "elevationMeters": round(start[2] + (end[2] - start[2]) * ratio, 2),
            }
        )
    return output, total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--id", required=True)
    parser.add_argument("--name")
    parser.add_argument("--spacing", type=float, default=10.0)
    args = parser.parse_args()
    if args.spacing <= 0 or not args.spacing.is_integer():
        raise ValueError("spacing must be a positive whole number of meters")

    source_name, source_points = read_track(args.input)
    reference_points, total = resample(source_points, args.spacing)
    document = {
        "schemaVersion": 1,
        "id": args.id,
        "name": args.name or source_name,
        "direction": "forward",
        "matching": {"corridorMeters": 30, "requiredCoveragePct": 0.9},
        "referencePolyline": reference_points,
    }
    args.output.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"{len(source_points)} source points -> {len(reference_points)} points; {total:.1f} m")


if __name__ == "__main__":
    main()
