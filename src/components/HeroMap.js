"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { boundsOf, formatDistance, formatDuration } from "@/components/map/format";
import { loadMaplibre } from "@/components/map/loadMaplibre";

const FROM = { lat: 28.5355, lon: 77.271, name: "Okhla Phase II" };
const TO = { lat: 28.4595, lon: 77.0266, name: "Gurugram Sector 29" };

// Live demo on the landing page: a real 12-tonne truck route through our own API.
export default function HeroMap({ apiKey }) {
  const ref = useRef(null);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let map;
    let disposed = false;
    (async () => {
      const maplibregl = await loadMaplibre();
      if (disposed) return;
      const key = encodeURIComponent(apiKey);
      map = new maplibregl.Map({
        container: ref.current,
        style: `${window.location.origin}/api/v1/style?theme=logistics&key=${key}`,
        center: [77.15, 28.5],
        zoom: 10.3,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map.on("load", async () => {
        try {
          const res = await fetch(`/api/v1/route?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locations: [FROM, TO], profile: "truck", truck: { weight_t: 12, height_m: 3.8 } }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || "Routing failed");
          if (disposed) return;
          const best = data.routes[0];
          setRoute(best);
          map.addSource("demo", { type: "geojson", data: { type: "Feature", geometry: best.geometry, properties: {} } });
          map.addLayer({ id: "demo-casing", type: "line", source: "demo", paint: { "line-color": "#134e4a", "line-width": 9 }, layout: { "line-cap": "round", "line-join": "round" } });
          map.addLayer({ id: "demo-line", type: "line", source: "demo", paint: { "line-color": "#2dd4bf", "line-width": 5 }, layout: { "line-cap": "round", "line-join": "round" } });
          for (const [p, color] of [
            [FROM, "#0f766e"],
            [TO, "#ea580c"],
          ]) {
            new maplibregl.Marker({ color }).setLngLat([p.lon, p.lat]).addTo(map);
          }
          map.fitBounds(boundsOf(best.geometry.coordinates), { padding: 50, duration: 1200 });
        } catch (err) {
          if (!disposed) setError(err.message);
        }
      });
    })();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [apiKey]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <div ref={ref} className="h-full w-full" />
      </div>
      <div className="absolute left-3 top-3 rounded-xl bg-white/95 px-3.5 py-2.5 text-sm shadow-lg ring-1 ring-slate-900/5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Live · Truck 12 t · 3.8 m</p>
        <p className="mt-0.5 font-medium text-slate-900">
          {FROM.name} → {TO.name}
        </p>
        <p className="mt-0.5 text-slate-600">
          {route ? `${formatDuration(route.duration_s)} · ${formatDistance(route.distance_m)}` : error ? error : "Routing…"}
        </p>
      </div>
    </div>
  );
}
