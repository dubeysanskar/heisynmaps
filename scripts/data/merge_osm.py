"""Merge sorted OpenStreetMap extracts into one sorted file, with constant memory.

Delhi NCR spans two Geofabrik zones: Delhi/Haryana are in the Northern Zone,
Noida/Ghaziabad/Greater Noida (Uttar Pradesh) in the Central Zone. Planetiler needs one
file sorted as nodes, then ways, then relations, so the zones are merged first. Objects on
the zone border appear in both files; one copy is kept.

    python scripts/data/merge_osm.py out.osm.pbf northern-zone.osm.pbf central-zone.osm.pbf

Needs pyosmium:  pip install osmium
"""
import sys
import time

import osmium

ORDER = {"n": 0, "w": 1, "r": 2}


def key(obj):
    return (ORDER[obj.type_str()], obj.id)


def main(out, inputs):
    started = time.time()
    streams = [iter(osmium.FileProcessor(path)) for path in inputs]
    heads = [next(s, None) for s in streams]
    writer = osmium.SimpleWriter(out, overwrite=True)
    written = dupes = 0
    while True:
        live = [(key(h), i) for i, h in enumerate(heads) if h is not None]
        if not live:
            break
        smallest = min(k for k, _ in live)
        first = True
        # Objects are only valid until their stream advances, so write before advancing.
        for k, i in live:
            if k != smallest:
                continue
            if first:
                writer.add(heads[i])
                written += 1
                first = False
            else:
                dupes += 1
            heads[i] = next(streams[i], None)
        if written % 2_000_000 == 0:
            print(f"  {written:,} objects...", flush=True)
    writer.close()
    print(f"Merged {len(inputs)} extracts -> {out}: {written:,} objects, {dupes:,} duplicates dropped, {time.time() - started:.0f} s")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2:])
