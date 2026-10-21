"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { boundsOf } from "@/components/map/format";
import { loadMaplibre } from "@/components/map/loadMaplibre";

// Pulls anything drawable out of an API response: route lines, isochrone/geofence
// polygons, and result points.
export function extractGeo(data) {
  const features = [];
  const add = (geometry, props = {}) => geometry && features.push({ type: "Feature", geometry, properties: props });
  if (!data || typeof data !== "object") return features;
  if (data.type === "FeatureCollection") data.features?.forEach((f) => add(f.geometry, { kind: "area" }));
  data.routes?.forEach((r, i) => add(r.geometry, { kind: i === 0 ? "route" : "alt" }));
  if (data.route?.geometry) add(data.route.geometry, { kind: "route" });
  data.geofences?.forEach((g) => add(g.geometry, { kind: "area" }));
  if (data.geofence?.geometry) add(data.geofence.geometry, { kind: "area" });
  if (data.geometry?.type && data.geometry.type !== "LineString") add(data.geometry, { kind: "area" }); // e.g. a PIN boundary
  if (data.center && Number.isFinite(data.center.lat)) add({ type: "Point", coordinates: [data.center.lon, data.center.lat] }, { kind: "point" });
  const pts = [...(data.results || []), data.result, data.place, ...(data.places || [])].filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon)
  );
  pts.forEach((p) => add({ type: "Point", coordinates: [p.lon, p.lat] }, { kind: "point", name: p.name || "" }));
  if (!pts.length && Number.isFinite(data.lat) && Number.isFinite(data.lon)) {
    add({ type: "Point", coordinates: [data.lon, data.lat] }, { kind: "point", name: data.formatted || "" });
  }
  return features;
}

function coordsOf(geometry) {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "LineString":
      return geometry.coordinates;
    case "Polygon":
      return geometry.coordinates.flat();
    case "MultiPolygon":
      return geometry.coordinates.flat(2);
    default:
      return [];
  }
}

function draw(map, features) {
  map.getSource("preview").setData({ type: "FeatureCollection", features });
  const coords = features.flatMap((f) => coordsOf(f.geometry));
  if (coords.length === 1) map.jumpTo({ center: coords[0], zoom: 15 });
  else if (coords.length > 1) map.fitBounds(boundsOf(coords), { padding: 30, maxZoom: 16, duration: 0 });
}

export default function GeoPreview({ features, mapKey, height = 260 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const featuresRef = useRef(features);
  featuresRef.current = features;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const maplibregl = await loadMaplibre();
      if (disposed || !ref.current) return;
      const map = new maplibregl.Map({
        container: ref.current,
        style: `${window.location.origin}/api/v1/style?theme=light&key=${encodeURIComponent(mapKey)}`,
        center: [77.209, 28.6139],
        zoom: 10,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on("load", () => {
        map.addSource("preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "pv-fill", type: "fill", source: "preview", filter: ["==", ["get", "kind"], "area"], paint: { "fill-color": "#0d9488", "fill-opacity": 0.15 } });
        map.addLayer({ id: "pv-area-line", type: "line", source: "preview", filter: ["==", ["get", "kind"], "area"], paint: { "line-color": "#0f766e", "line-width": 2 } });
        map.addLayer({ id: "pv-alt", type: "line", source: "preview", filter: ["==", ["get", "kind"], "alt"], paint: { "line-color": "#94a3b8", "line-width": 5 } });
        map.addLayer({ id: "pv-route", type: "line", source: "preview", filter: ["==", ["get", "kind"], "route"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#14b8a6", "line-width": 5 } });
        map.addLayer({ id: "pv-pt", type: "circle", source: "preview", filter: ["==", ["get", "kind"], "point"], paint: { "circle-color": "#dc2626", "circle-radius": 6, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        map.__ready = true;
        draw(map, featuresRef.current); // data may have arrived before the map finished loading
      });
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapKey]);

  useEffect(() => {
    if (mapRef.current?.__ready) draw(mapRef.current, features);
  }, [features]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <div className="absolute inset-0">
        <div ref={ref} className="h-full w-full" />
      </div>
    </div>
  );
}
