"""Extract searchable features from an OpenStreetMap .pbf into line-delimited JSON.

Our own replacement for third-party place exports: every named place, point of interest,
road and addressed building, with its centre and bounding box. Node locations are kept in
a disk-backed index, so memory stays low even for all of India.

    python scripts/data/osm_places.py input.osm.pbf places.raw.jsonl [index-dir]

Needs pyosmium:  pip install osmium
"""
import json
import math
import os
import sys
import tempfile
import time

import osmium

POI_KEYS = ("amenity", "shop", "tourism", "office", "leisure", "historic", "healthcare", "craft", "emergency")
TRANSPORT = {
    "railway": {"station", "halt", "stop", "subway_entrance", "tram_stop"},
    "aeroway": {"aerodrome", "terminal", "helipad"},
    "public_transport": {"station"},
    "highway": {"bus_stop"},
}
STREETS = {
    "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
    "living_street", "service", "pedestrian", "motorway_link", "trunk_link", "primary_link",
    "secondary_link", "tertiary_link", "road", "track",
}
AREA_KEYS = {
    "landuse": {"commercial", "retail", "industrial", "education", "institutional", "religious", "military"},
    "natural": {"water", "peak", "wood", "beach"},
    "waterway": {"river", "canal"},
    "man_made": {"tower", "bridge", "works"},
}
PLACE_KIND = {
    "city": "city", "town": "city", "municipality": "city",
    "suburb": "district", "borough": "district", "quarter": "district",
    "neighbourhood": "locality", "village": "locality", "hamlet": "locality", "locality": "locality",
    "isolated_dwelling": "locality", "state": "state", "district": "county", "county": "county",
}
PLACE_IMPORTANCE = {
    "state": 0.7, "city": 0.6, "town": 0.45, "municipality": 0.45, "district": 0.4, "county": 0.4,
    "suburb": 0.35, "borough": 0.35, "quarter": 0.25, "neighbourhood": 0.22, "village": 0.2,
    "hamlet": 0.12, "locality": 0.1, "isolated_dwelling": 0.05,
}
NAME_KEYS = ("name:hi", "name:ur", "name:pa", "name:bn", "alt_name", "old_name", "short_name", "official_name", "loc_name")


def classify(tags):
    """Return (osm_key, osm_value, kind, importance) or None if not searchable."""
    place = tags.get("place")
    if place in PLACE_KIND:
        imp = PLACE_IMPORTANCE.get(place, 0.1)
        pop = tags.get("population", "").replace(",", "")
        if pop.isdigit():
            imp += min(0.25, math.log10(max(int(pop), 1)) / 40)
        return "place", place, PLACE_KIND[place], imp
    for key, values in TRANSPORT.items():
        v = tags.get(key)
        if v in values:
            imp = 0.45 if key == "aeroway" and v == "aerodrome" else 0.3 if key == "railway" and v == "station" else 0.12
            return key, v, "other", imp
    for key in POI_KEYS:
        v = tags.get(key)
        if v:
            return key, v, ("house" if "addr:housenumber" in tags else "other"), 0.1
    hw = tags.get("highway")
    if hw in STREETS:
        return "highway", hw, "street", 0.15 if hw in ("motorway", "trunk", "primary") else 0.08
    for key, values in AREA_KEYS.items():
        v = tags.get(key)
        if v in values:
            return key, v, "other", 0.12
    if "building" in tags:
        return "building", tags.get("building") or "yes", "house", 0.06
    if "addr:housenumber" in tags:
        return "place", "house", "house", 0.03
    return None


def main(pbf, out_path, index_dir=None):
    started = time.time()
    index_dir = index_dir or tempfile.mkdtemp(prefix="heisyn-osm-")
    os.makedirs(index_dir, exist_ok=True)
    locations = osmium.index.create_map(f"sparse_file_array,{os.path.join(index_dir, 'nodes.idx')}")
    # Areas: multipolygon relations (airports, hospitals, stations, campuses) assembled from their ways.
    processor = osmium.FileProcessor(pbf).with_locations(locations).with_areas()

    written = 0
    with open(out_path, "w", encoding="utf-8") as out:
        for obj in processor:
            if obj.is_relation():
                continue  # relations arrive as assembled areas instead
            if obj.is_area() and obj.from_way():
                continue  # closed ways are already handled as ways
            tags = obj.tags
            name = tags.get("name:en") or tags.get("name")
            hn = tags.get("addr:housenumber")
            if not name and not (hn and tags.get("addr:street")):
                continue
            cls = classify(tags)
            if not cls:
                continue
            key, value, kind, imp = cls
            if tags.get("wikidata") or tags.get("wikipedia"):
                imp += 0.15

            if obj.is_node():
                if not obj.location.valid():
                    continue
                lon, lat = obj.location.lon, obj.location.lat
                bbox = [lon, lat, lon, lat]
                otype = "N"
            elif obj.is_area():
                pts = [(n.lon, n.lat) for ring in obj.outer_rings() for n in ring if n.location.valid()]
                if not pts:
                    continue
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                bbox = [min(xs), min(ys), max(xs), max(ys)]
                lon, lat = sum(xs) / len(xs), sum(ys) / len(ys)
                otype = "R"
            else:
                pts = [(n.lon, n.lat) for n in obj.nodes if n.location.valid()]
                if not pts:
                    continue
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                bbox = [min(xs), min(ys), max(xs), max(ys)]
                if kind == "street":
                    mid = pts[len(pts) // 2]  # a point on the road, not off it
                    lon, lat = mid
                else:
                    lon, lat = sum(xs) / len(xs), sum(ys) / len(ys)
                otype = "W"

            names = {k: tags.get(k) for k in NAME_KEYS if tags.get(k)}
            if tags.get("name") and tags.get("name") != name:
                names["local"] = tags.get("name")
            rec = {
                "t": otype,
                "id": obj.orig_id() if obj.is_area() else obj.id,
                "name": name or f"{hn} {tags.get('addr:street')}",
                "names": names,
                "key": key,
                "value": value,
                "kind": kind,
                "imp": round(min(imp, 1.0), 4),
                "lat": round(lat, 7),
                "lon": round(lon, 7),
                "bbox": [round(v, 7) for v in bbox],
                "hn": hn,
                "street": tags.get("addr:street"),
                "postcode": tags.get("addr:postcode"),
                "addr_city": tags.get("addr:city"),
                "addr_suburb": tags.get("addr:suburb") or tags.get("addr:place"),
            }
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            written += 1
            if written % 200_000 == 0:
                print(f"  {written:,} features...", flush=True)
    print(f"Extracted {written:,} features from {os.path.basename(pbf)} in {time.time() - started:.0f} s", flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
