import fs from "node:fs";
import zlib from "node:zlib";
import { PMTiles } from "pmtiles";
import { config, FALLBACK } from "../config";

// Reads a local .pmtiles archive (built by scripts/data/build-tiles.sh) with range reads.
class NodeFileSource {
  constructor(file) {
    this.file = file;
    this.handle = fs.promises.open(file, "r");
  }
  getKey() {
    return this.file;
  }
  async getBytes(offset, length) {
    const fh = await this.handle;
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buffer, 0, length, offset);
    const slice = buffer.subarray(0, bytesRead);
    return { data: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) };
  }
}

export function hasLocalTiles() {
  return fs.existsSync(config.pmtilesPath);
}

function archive() {
  if (!hasLocalTiles()) return null;
  const mtime = fs.statSync(config.pmtilesPath).mtimeMs;
  const cached = globalThis.__nakshaPmtiles;
  if (cached && cached.mtime === mtime) return cached.archive;
  const pm = new PMTiles(new NodeFileSource(config.pmtilesPath));
  globalThis.__nakshaPmtiles = { mtime, archive: pm };
  return pm;
}

export async function getTile(z, x, y) {
  const pm = archive();
  if (!pm) return null;
  const tile = await pm.getZxy(z, x, y);
  if (!tile?.data) return null;
  const bytes = Buffer.from(tile.data);
  // Planetiler gzips tiles; serve plain protobuf and let the CDN/HTTP layer compress.
  return bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes) : bytes;
}

export async function tileJson(tileUrlTemplate) {
  const pm = archive();
  if (!pm) return null;
  const [header, metadata] = await Promise.all([pm.getHeader(), pm.getMetadata().catch(() => ({}))]);
  return {
    tilejson: "3.0.0",
    name: metadata.name || "Naksha",
    attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    tiles: [tileUrlTemplate],
    minzoom: header.minZoom,
    maxzoom: header.maxZoom,
    bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
    center: [header.centerLon, header.centerLat, header.centerZoom],
    vector_layers: metadata.vector_layers || [],
  };
}

// Where MapLibre should fetch tiles from: our own tiles, or the dev fallback.
export function vectorSource(origin, key) {
  if (hasLocalTiles()) {
    return { type: "vector", url: `${origin}/api/v1/tiles/tilejson?key=${encodeURIComponent(key)}` };
  }
  return { type: "vector", url: FALLBACK.tilejson };
}
