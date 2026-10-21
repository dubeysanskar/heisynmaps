#!/usr/bin/env bash
# Builds vector tiles (OpenMapTiles schema) as a single PMTiles file with Planetiler.
# Runs on Linux/macOS with Docker. Output: data/tiles/region.pmtiles, served by the
# app at /api/v1/tiles/... (or upload it to R2/S3 behind a CDN).
#
#   scripts/data/build-tiles.sh ncr     # Delhi NCR (phase 1, minutes)
#   scripts/data/build-tiles.sh india   # all India (phase 2, ~1 hour, 32 GB RAM)
set -euo pipefail

REGION="${1:-ncr}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$ROOT/data"
mkdir -p "$DATA/osm" "$DATA/tiles" "$DATA/planetiler"

case "$REGION" in
  ncr)
    PBF_URL="https://download.geofabrik.de/asia/india/northern-zone-latest.osm.pbf"
    BOUNDS="--bounds=76.84,28.20,77.65,28.90"
    MEM="-Xmx4g"
    ;;
  india)
    PBF_URL="https://download.geofabrik.de/asia/india-latest.osm.pbf"
    BOUNDS=""
    MEM="-Xmx24g"
    ;;
  *)
    echo "Unknown region: $REGION (use ncr or india)" >&2
    exit 1
    ;;
esac

PBF="$DATA/osm/$(basename "$PBF_URL")"
if [ ! -f "$PBF" ] || [ -n "$(find "$PBF" -mtime +6 2>/dev/null)" ]; then
  echo "Downloading $PBF_URL"
  curl -fL -o "$PBF" "$PBF_URL"
fi

echo "Building tiles for $REGION"
docker run --rm -e JAVA_TOOL_OPTIONS="$MEM" \
  -v "$DATA":/data \
  ghcr.io/onthegomap/planetiler:latest \
  --osm-path="/data/osm/$(basename "$PBF")" \
  --output=/data/tiles/region.pmtiles \
  --download --download-dir=/data/planetiler \
  $BOUNDS --maxzoom=14 --force

ls -lh "$DATA/tiles/region.pmtiles"
echo "Done. Restart the app; /api/v1/status should now report tiles: self-hosted."
