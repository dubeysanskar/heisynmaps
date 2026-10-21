"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon, { Logo } from "@/components/Icon";
import { loadMaplibre } from "./loadMaplibre";
import PlaceInput from "./PlaceInput";
import { boundsOf, featureCollection, formatDigipin, formatDistance, formatDuration } from "./format";

const NCR = { center: [77.209, 28.6139], zoom: 10 };

const PROFILES = [
  { id: "car", label: "Car" },
  { id: "bike", label: "Bike" },
  { id: "scooter", label: "Scooter" },
  { id: "truck", label: "Truck" },
  { id: "foot", label: "Walk" },
];

const CATEGORIES = [
  { id: "fuel", label: "Petrol pump", color: "#ea580c" },
  { id: "ev_charging", label: "EV charging", color: "#16a34a" },
  { id: "atm", label: "ATM", color: "#0891b2" },
  { id: "hospital", label: "Hospital", color: "#dc2626" },
  { id: "pharmacy", label: "Pharmacy", color: "#e11d48" },
  { id: "restaurant", label: "Food", color: "#d97706" },
  { id: "parking", label: "Parking", color: "#1d4ed8" },
  { id: "police", label: "Police", color: "#475569" },
];

const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "logistics", label: "Logistics" },
];

// Map features a click can select: POI dots and labels, and place names.
const CLICKABLE_LAYERS = ["poi-dot", "poi-label", "place-neighbourhood", "place-village", "place-town", "place-city"];

const STOP_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#65a30d", "#9333ea", "#be123c", "#334155"];
const letter = (i) => String.fromCharCode(65 + i);

export default function MapExplorer({ apiKey }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const overlayRef = useRef({});
  const markersRef = useRef([]);
  const selectedMarkerRef = useRef(null);
  const handlersRef = useRef({});
  // isStyleLoaded() stays false until tiles arrive, so track "style parsed" ourselves.
  const styleReadyRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState("light");
  const [buildings3d, setBuildings3d] = useState(false);
  const [mode, setMode] = useState("search");
  const [selected, setSelected] = useState(null);
  const [stops, setStops] = useState([null, null]);
  const [profile, setProfile] = useState("car");
  const [truck, setTruck] = useState({ weight_t: 12, height_m: 3.8 });
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(0);
  const [routeState, setRouteState] = useState({ loading: false, error: null });
  const [showSteps, setShowSteps] = useState(false);
  const [nearby, setNearby] = useState(null);
  const [iso, setIso] = useState(null);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const [pinArea, setPinArea] = useState(null);

  // ---------- API ----------
  const api = useCallback(
    async (path, { method = "GET", params, body } = {}) => {
      const url = new URL(path, window.location.origin);
      url.searchParams.set("key", apiKey);
      for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, v);
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
      return data;
    },
    [apiKey]
  );

  const notify = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 2600);
  }, []);

  const getBias = useCallback(() => {
    const c = mapRef.current?.getCenter();
    return c ? { lat: c.lat.toFixed(5), lon: c.lng.toFixed(5) } : {};
  }, []);

  const styleUrl = useCallback(
    (t) => `${window.location.origin}/api/v1/style?theme=${t}&key=${encodeURIComponent(apiKey)}`,
    [apiKey]
  );

  const leftPadding = () => (window.innerWidth >= 768 ? 440 : 40);

  // ---------- overlays (re-added after every style change) ----------
  const applyOverlays = useCallback(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const o = overlayRef.current;
    const before = map.getLayer("road-name") ? "road-name" : undefined;
    if (!map.getSource("nk-iso")) {
      map.addSource("nk-iso", { type: "geojson", data: featureCollection() });
      map.addSource("nk-routes", { type: "geojson", data: featureCollection() });
      map.addSource("nk-nearby", { type: "geojson", data: featureCollection() });
      map.addSource("nk-pin", { type: "geojson", data: featureCollection() });
      map.addSource("nk-pin-offices", { type: "geojson", data: featureCollection() });
      map.addLayer({ id: "nk-pin-fill", type: "fill", source: "nk-pin", paint: { "fill-color": "#7c3aed", "fill-opacity": 0.07 } }, before);
      map.addLayer({ id: "nk-pin-line", type: "line", source: "nk-pin", filter: ["!", ["get", "approx"]], paint: { "line-color": "#7c3aed", "line-width": 2.5 } }, before);
      map.addLayer({
        id: "nk-pin-line-approx",
        type: "line",
        source: "nk-pin",
        filter: ["get", "approx"],
        paint: { "line-color": "#7c3aed", "line-width": 2, "line-dasharray": [2, 2] },
      }, before);
      map.addLayer({ id: "nk-iso-fill", type: "fill", source: "nk-iso", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.14 } }, before);
      map.addLayer({ id: "nk-iso-line", type: "line", source: "nk-iso", paint: { "line-color": ["get", "color"], "line-width": 2 } }, before);
      map.addLayer({
        id: "nk-route-alt",
        type: "line",
        source: "nk-routes",
        filter: ["!", ["get", "active"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#94a3b8", "line-width": 6, "line-opacity": 0.85 },
      }, before);
      map.addLayer({
        id: "nk-route-casing",
        type: "line",
        source: "nk-routes",
        filter: ["get", "active"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#134e4a", "line-width": 10 },
      }, before);
      map.addLayer({
        id: "nk-route-line",
        type: "line",
        source: "nk-routes",
        filter: ["get", "active"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#14b8a6", "line-width": 6 },
      }, before);
      map.addLayer({
        id: "nk-pin-offices",
        type: "circle",
        source: "nk-pin-offices",
        paint: {
          "circle-color": ["case", ["get", "delivery"], "#7c3aed", "#a78bfa"],
          "circle-radius": 5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "nk-nearby",
        type: "circle",
        source: "nk-nearby",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 7,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
    map.getSource("nk-iso").setData(o.iso || featureCollection());
    map.getSource("nk-routes").setData(o.routes || featureCollection());
    map.getSource("nk-nearby").setData(o.nearby || featureCollection());
    map.getSource("nk-pin").setData(o.pin || featureCollection());
    map.getSource("nk-pin-offices").setData(o.pinOffices || featureCollection());
    if (map.getLayer("building-3d")) {
      map.setLayoutProperty("building-3d", "visibility", o.buildings3d ? "visible" : "none");
      map.setLayoutProperty("building", "visibility", o.buildings3d ? "none" : "visible");
    }
  }, []);

  // ---------- map init ----------
  useEffect(() => {
    let disposed = false;
    let map;
    (async () => {
      const maplibregl = await loadMaplibre();
      if (disposed) return;
      libRef.current = maplibregl;
      const params = new URLSearchParams(window.location.search);
      const ll = params.get("ll")?.split(",").map(Number);
      const zoom = Number(params.get("z"));
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl("light"),
        center: ll?.length === 2 && ll.every(Number.isFinite) ? [ll[1], ll[0]] : NCR.center,
        zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : NCR.zoom,
        attributionControl: { compact: true },
        maxPitch: 70,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.addControl(
        new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
        "bottom-right"
      );
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

      map.on("style.load", () => {
        styleReadyRef.current = true;
        applyOverlays();
      });
      map.on("load", () => {
        setReady(true);
        const digipin = params.get("digipin");
        if (digipin) handlersRef.current.openDigipin?.(digipin);
        const pin = params.get("pin");
        if (pin) handlersRef.current.openPin?.(pin);
      });
      map.on("contextmenu", (e) => {
        setMenu({ x: e.point.x, y: e.point.y, lat: e.lngLat.lat, lon: e.lngLat.lng });
      });
      // Touch screens have no right-click: a 550ms press without moving opens the same menu.
      let pressTimer = null;
      const cancelPress = () => {
        clearTimeout(pressTimer);
        pressTimer = null;
      };
      map.on("touchstart", (e) => {
        cancelPress();
        if (e.originalEvent.touches.length !== 1) return;
        pressTimer = setTimeout(() => {
          setMenu({ x: e.point.x, y: e.point.y, lat: e.lngLat.lat, lon: e.lngLat.lng });
          navigator.vibrate?.(15);
        }, 550);
      });
      for (const ev of ["touchend", "touchcancel", "touchmove", "movestart", "zoomstart"]) map.on(ev, cancelPress);
      map.on("click", (e) => {
        setMenu(null);
        handlersRef.current.onMapClick?.(e);
      });
      map.on("moveend", () => {
        const c = map.getCenter();
        const url = new URL(window.location.href);
        url.searchParams.set("ll", `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`);
        url.searchParams.set("z", map.getZoom().toFixed(2));
        url.searchParams.delete("digipin");
        window.history.replaceState(null, "", url);
      });
      map.on("click", "nk-route-alt", (e) => setActiveRoute(e.features[0].properties.idx));
      for (const layer of ["nk-route-alt", "nk-nearby", ...CLICKABLE_LAYERS]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    })();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [applyOverlays, styleUrl]);

  // Theme switch: full style reload, then overlays are re-added on style.load.
  const firstTheme = useRef(true);
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false;
      return;
    }
    if (!mapRef.current) return;
    styleReadyRef.current = false;
    mapRef.current.setStyle(styleUrl(theme), { diff: false });
  }, [theme, styleUrl]);

  useEffect(() => {
    overlayRef.current.buildings3d = buildings3d;
    applyOverlays();
    const map = mapRef.current;
    if (map && buildings3d && map.getPitch() < 30) map.easeTo({ pitch: 55, zoom: Math.max(map.getZoom(), 15.5) });
    if (map && !buildings3d && map.getPitch() > 0) map.easeTo({ pitch: 0 });
  }, [buildings3d, applyOverlays]);

  // ---------- selection ----------
  const select = useCallback(
    (place, { fly = true } = {}) => {
      setSelected(place);
      setMenu(null);
      const map = mapRef.current;
      const maplibregl = libRef.current;
      if (!map || !maplibregl || !place) return;
      selectedMarkerRef.current?.remove();
      selectedMarkerRef.current = new maplibregl.Marker({ color: "#dc2626" }).setLngLat([place.lon, place.lat]).addTo(map);
      if (place.type === "pincode") handlersRef.current.showPinArea?.(place.pincode);
      else handlersRef.current.clearPinArea?.();
      if (!fly) return;
      if (place.extent) {
        const [w, n, e, s] = place.extent;
        map.fitBounds([[w, s], [e, n]], { padding: { top: 60, bottom: 60, right: 60, left: leftPadding() }, maxZoom: 16 });
      } else {
        map.flyTo({ center: [place.lon, place.lat], zoom: Math.max(map.getZoom(), 16), padding: { left: leftPadding() / 2 } });
      }
    },
    []
  );

  const clearSelection = useCallback(() => {
    handlersRef.current.clearPinArea?.();
    setSelected(null);
    selectedMarkerRef.current?.remove();
    selectedMarkerRef.current = null;
  }, []);

  const whatsHere = useCallback(
    async (lat, lon) => {
      setMenu(null);
      try {
        const data = await api("/api/v1/reverse", { params: { lat: lat.toFixed(6), lon: lon.toFixed(6) } });
        const near = data.result;
        select(
          {
            id: `pt:${lat},${lon}`,
            name: near?.name ? `Near ${near.name}` : "Dropped pin",
            label: near?.label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
            category: near?.category,
            lat,
            lon,
            digipin: data.digipin,
            pincode: data.pincode?.pincode ?? null,
            pincode_source: data.pincode?.method,
          },
          { fly: false }
        );
      } catch (err) {
        notify(err.message);
      }
    },
    [api, select, notify]
  );

  // ---------- PIN code area: official boundary (or approximate box) + post offices ----------
  handlersRef.current.showPinArea = async (pincode, { fit = false } = {}) => {
    try {
      const d = await api(`/api/v1/pincode/${pincode}`, { params: { geometry: 1 } });
      const [w, s, e, n] = d.bbox || [];
      const area = d.geometry
        ? { type: "Feature", geometry: d.geometry, properties: { approx: false } }
        : d.bbox
          ? { type: "Feature", geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }, properties: { approx: true } }
          : null;
      overlayRef.current.pin = featureCollection(area ? [area] : []);
      overlayRef.current.pinOffices = featureCollection(
        (d.post_offices || [])
          .filter((o) => o.lat != null)
          .map((o) => ({ type: "Feature", geometry: { type: "Point", coordinates: [o.lon, o.lat] }, properties: { name: o.name, delivery: o.delivery } }))
      );
      applyOverlays();
      setPinArea(d);
      if (fit && d.bbox) {
        mapRef.current?.fitBounds([[w, s], [e, n]], { padding: { top: 60, bottom: 60, right: 60, left: leftPadding() }, maxZoom: 15 });
      }
    } catch (err) {
      notify(err.message);
    }
  };

  handlersRef.current.clearPinArea = () => {
    if (!overlayRef.current.pin && !overlayRef.current.pinOffices) return;
    overlayRef.current.pin = null;
    overlayRef.current.pinOffices = null;
    applyOverlays();
    setPinArea(null);
  };

  handlersRef.current.openPin = async (code) => {
    try {
      const d = await api(`/api/v1/pincode/${code}`);
      if (!d.center) throw new Error(`PIN ${code} has no location on record`);
      select({
        id: `pincode:${d.pincode}`,
        source: "india_post",
        type: "pincode",
        name: `PIN ${d.pincode}`,
        label: [d.district, d.state].filter(Boolean).join(", "),
        category: "address:pincode",
        lat: d.center.lat,
        lon: d.center.lon,
        digipin: d.digipin,
        pincode: d.pincode,
        extent: d.bbox ? [d.bbox[0], d.bbox[3], d.bbox[2], d.bbox[1]] : null,
      });
    } catch (err) {
      notify(err.message);
    }
  };

  handlersRef.current.openDigipin = async (code) => {
    try {
      const d = await api("/api/v1/digipin", { params: { code } });
      mapRef.current?.jumpTo({ center: [d.lon, d.lat], zoom: 18 });
      whatsHere(d.lat, d.lon);
    } catch (err) {
      notify(err.message);
    }
  };

  handlersRef.current.onMapClick = (e) => {
    const map = mapRef.current;
    // A few pixels of slack so small dots and labels are easy to hit.
    const box = [
      [e.point.x - 6, e.point.y - 6],
      [e.point.x + 6, e.point.y + 6],
    ];
    const hits = map.queryRenderedFeatures(box, { layers: ["nk-nearby", ...CLICKABLE_LAYERS].filter((l) => map.getLayer(l)) });
    const hit = hits.find((h) => h.layer.id === "nk-nearby") || hits.find((h) => h.geometry.type === "Point");
    if (!hit) return;
    if (hit.layer.id === "nk-nearby") {
      const place = overlayRef.current.nearbyResults?.[hit.properties.idx];
      if (place) select(place, { fly: false });
      return;
    }
    const [lon, lat] = hit.geometry.coordinates;
    const p = hit.properties;
    const isPlace = hit.sourceLayer === "place";
    select(
      {
        id: `${hit.sourceLayer}:${p.name}:${lon}`,
        name: p["name:en"] || p.name_en || p.name || "Point of interest",
        label: [p.class, p.subclass].filter((v, i, a) => v && a.indexOf(v) === i).join(" · ").replace(/_/g, " "),
        category: `${isPlace ? "place" : "poi"}:${p.class}`,
        lat,
        lon,
      },
      { fly: false }
    );
  };

  // Fill in a DIGIPIN for selections that came from map features.
  useEffect(() => {
    if (!selected || selected.digipin !== undefined) return;
    let stale = false;
    api("/api/v1/digipin", { params: { lat: selected.lat.toFixed(6), lon: selected.lon.toFixed(6) } })
      .then((d) => !stale && setSelected((s) => (s && s.id === selected.id ? { ...s, digipin: d.digipin } : s)))
      .catch(() => !stale && setSelected((s) => (s && s.id === selected.id ? { ...s, digipin: null } : s)));
    return () => {
      stale = true;
    };
  }, [selected, api]);

  // ...and the PIN code, for selections that do not carry one yet.
  useEffect(() => {
    if (!selected || selected.pincode !== undefined) return;
    let stale = false;
    const done = (pincode, source) =>
      !stale && setSelected((s) => (s && s.id === selected.id ? { ...s, pincode, pincode_source: source } : s));
    api("/api/v1/pincode", { params: { lat: selected.lat.toFixed(6), lon: selected.lon.toFixed(6) } })
      .then((d) => done(d.pincode, d.method))
      .catch(() => done(null));
    return () => {
      stale = true;
    };
  }, [selected, api]);

  // ---------- nearby ----------
  const runNearby = useCallback(
    async (category) => {
      const map = mapRef.current;
      if (!map) return;
      const c = selected ? { lat: selected.lat, lng: selected.lon } : map.getCenter();
      const radius = Math.min(25000, Math.max(800, Math.round(40000 / 2 ** (map.getZoom() - 10))));
      setNearby({ category, loading: true, results: [] });
      try {
        // Widen the circle (up to 25 km) until something turns up.
        let data;
        for (let r = radius; ; r = Math.min(25000, r * 4)) {
          data = await api("/api/v1/nearby", {
            params: { lat: c.lat.toFixed(5), lon: c.lng.toFixed(5), category: category.id, radius: r, limit: 30 },
          });
          if (data.results.length || r >= 25000) break;
        }
        setNearby({ category, loading: false, results: data.results });
        overlayRef.current.nearbyResults = data.results;
        overlayRef.current.nearby = featureCollection(
          data.results.map((r, idx) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [r.lon, r.lat] },
            properties: { idx, color: category.color },
          }))
        );
        applyOverlays();
        if (data.results.length) {
          const coords = data.results.map((r) => [r.lon, r.lat]).concat([[c.lng, c.lat]]);
          map.fitBounds(boundsOf(coords), { padding: { top: 80, bottom: 80, right: 80, left: leftPadding() }, maxZoom: 16 });
        } else {
          notify(`No ${category.label.toLowerCase()} found nearby`);
        }
      } catch (err) {
        setNearby(null);
        notify(err.message);
      }
    },
    [api, selected, applyOverlays, notify]
  );

  const clearNearby = useCallback(() => {
    setNearby(null);
    overlayRef.current.nearby = null;
    overlayRef.current.nearbyResults = null;
    applyOverlays();
  }, [applyOverlays]);

  // ---------- directions ----------
  const startDirections = useCallback(
    (to, from = null) => {
      setMode("directions");
      setStops([from, to]);
      clearNearby();
    },
    [clearNearby]
  );

  const filledStops = useMemo(() => stops.filter(Boolean), [stops]);
  const routeKey = JSON.stringify([filledStops.map((s) => [s.lat, s.lon]), profile, profile === "truck" ? truck : null, avoidTolls]);

  useEffect(() => {
    if (mode !== "directions" || filledStops.length < 2 || filledStops.length !== stops.length) {
      setRoutes([]);
      overlayRef.current.routes = null;
      applyOverlays();
      return;
    }
    let stale = false;
    setRouteState({ loading: true, error: null });
    api("/api/v1/route", {
      method: "POST",
      body: {
        locations: filledStops.map(({ lat, lon }) => ({ lat, lon })),
        profile,
        alternatives: filledStops.length === 2 ? 2 : 0,
        ...(profile === "truck" ? { truck } : {}),
        ...(avoidTolls ? { avoid: ["tolls"] } : {}),
      },
    })
      .then((data) => {
        if (stale) return;
        setRoutes(data.routes);
        setActiveRoute(0);
        setRouteState({ loading: false, error: null });
        const all = data.routes.flatMap((r) => r.geometry.coordinates);
        mapRef.current?.fitBounds(boundsOf(all), {
          padding: { top: 80, bottom: 80, right: 80, left: leftPadding() },
          maxZoom: 16,
        });
      })
      .catch((err) => {
        if (stale) return;
        setRoutes([]);
        setRouteState({ loading: false, error: err.message });
      });
    return () => {
      stale = true;
    };
    // routeKey captures every input that changes the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, mode]);

  useEffect(() => {
    overlayRef.current.routes = featureCollection(
      routes
        .map((r, idx) => ({ type: "Feature", geometry: r.geometry, properties: { idx, active: idx === activeRoute } }))
        .sort((a, b) => Number(a.properties.active) - Number(b.properties.active))
    );
    applyOverlays();
  }, [routes, activeRoute, applyOverlays]);

  // Draggable stop markers.
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!ready || !map || !maplibregl || mode !== "directions") return;
    stops.forEach((stop, i) => {
      if (!stop) return;
      const el = document.createElement("div");
      el.className = "nk-stop";
      el.style.background = STOP_COLORS[i % STOP_COLORS.length];
      el.textContent = letter(i);
      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([stop.lon, stop.lat]).addTo(map);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        setStops((s) => s.map((x, j) => (j === i ? { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lon: lng } : x)));
      });
      markersRef.current.push(marker);
    });
  }, [stops, mode, ready]);

  const optimiseStops = useCallback(async () => {
    try {
      setRouteState({ loading: true, error: null });
      const data = await api("/api/v1/optimize", {
        method: "POST",
        body: { locations: filledStops.map(({ lat, lon }) => ({ lat, lon })), profile },
      });
      setStops(data.order.map((i) => filledStops[i]));
      notify("Stops reordered for the fastest trip");
    } catch (err) {
      setRouteState({ loading: false, error: err.message });
    }
  }, [api, filledStops, profile, notify]);

  // ---------- isochrone ----------
  const runIsochrone = useCallback(
    async (lat, lon) => {
      setMenu(null);
      try {
        const fc = await api("/api/v1/isochrone", {
          method: "POST",
          body: { location: { lat, lon }, minutes: [15, 30, 45], profile: profile === "foot" ? "foot" : profile },
        });
        setIso({ lat, lon, profile });
        overlayRef.current.iso = { ...fc, features: [...fc.features].reverse() };
        applyOverlays();
        const coords = fc.features.flatMap((f) => f.geometry.coordinates.flat(f.geometry.type === "MultiPolygon" ? 2 : 1));
        if (coords.length) {
          mapRef.current?.fitBounds(boundsOf(coords), { padding: { top: 60, bottom: 60, right: 60, left: leftPadding() } });
        }
      } catch (err) {
        notify(err.message);
      }
    },
    [api, profile, applyOverlays, notify]
  );

  const clearIso = useCallback(() => {
    setIso(null);
    overlayRef.current.iso = null;
    applyOverlays();
  }, [applyOverlays]);

  const copy = useCallback(
    async (text, what) => {
      try {
        await navigator.clipboard.writeText(text);
        notify(`${what} copied`);
      } catch {
        notify(text);
      }
    },
    [notify]
  );

  const shareUrl = (place) =>
    place.type === "pincode"
      ? `${window.location.origin}/maps?pin=${place.pincode}`
      : place.digipin
      ? `${window.location.origin}/maps?digipin=${place.digipin}`
      : `${window.location.origin}/maps?ll=${place.lat.toFixed(6)},${place.lon.toFixed(6)}&z=17`;

  const active = routes[activeRoute];
  const dark = theme === "dark";

  return (
    <div className={`naksha-ui fixed inset-0 overflow-hidden ${dark ? "dark" : ""}`}>
      {/* Wrapper: maplibre-gl.css forces position:relative on the map element itself. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Left panel */}
      <aside className="absolute left-3 right-3 top-3 z-20 flex max-h-[calc(100dvh-1.5rem)] flex-col md:right-auto md:w-[400px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
            <Link href="/" className="flex items-center gap-2" aria-label="Naksha home">
              <Logo size={26} />
              <span className="text-[15px] font-semibold tracking-tight">Naksha</span>
            </Link>
            <div className="ml-auto flex rounded-lg bg-[var(--field)] p-0.5 text-xs font-medium">
              {[
                ["search", "Explore"],
                ["directions", "Directions"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`rounded-md px-2.5 py-1.5 ${mode === id ? "bg-[var(--panel)] shadow-sm" : "text-[var(--muted)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-3">
            {mode === "search" ? (
              <>
                <PlaceInput
                  api={api}
                  value={selected?.source ? selected : null}
                  onSelect={(r) => {
                    clearNearby();
                    select(r);
                  }}
                  onClear={clearSelection}
                  getBias={getBias}
                  placeholder="Search places, addresses, PIN codes or DIGIPIN"
                />

                <div className="no-scrollbar -mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => runNearby(c)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                        nearby?.category.id === c.id
                          ? "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                          : "border-[var(--line)] hover:bg-[var(--hover)]"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.label}
                    </button>
                  ))}
                </div>

                {selected && (
                  <PlaceCard
                    place={selected}
                    pinArea={pinArea}
                    onShowPin={() => handlersRef.current.showPinArea(selected.pincode, { fit: true })}
                    onHidePin={() => handlersRef.current.clearPinArea()}
                    onClose={clearSelection}
                    onDirections={() => startDirections({ ...selected, label: selected.name })}
                    onCopy={copy}
                    onShare={() => copy(shareUrl(selected), "Link")}
                    onReach={() => runIsochrone(selected.lat, selected.lon)}
                  />
                )}

                {nearby && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {nearby.category.label} nearby{" "}
                        {!nearby.loading && <span className="font-normal text-[var(--muted)]">· {nearby.results.length}</span>}
                      </h3>
                      <button onClick={clearNearby} className="text-xs text-[var(--muted)] hover:underline">
                        Clear
                      </button>
                    </div>
                    {nearby.loading ? (
                      <p className="py-4 text-center text-sm text-[var(--muted)]">Searching…</p>
                    ) : (
                      <ul className="divide-y divide-[var(--line)]">
                        {nearby.results.map((r) => (
                          <li key={r.id}>
                            <button onClick={() => select(r)} className="flex w-full items-start justify-between gap-3 py-2 text-left">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{r.name}</span>
                                <span className="block truncate text-xs text-[var(--muted)]">{r.label}</span>
                              </span>
                              <span className="shrink-0 text-xs text-[var(--muted)]">{formatDistance(r.distance_m)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {!selected && !nearby && (
                  <div className="mt-3 rounded-xl bg-[var(--field)] p-3 text-xs leading-relaxed text-[var(--muted)]">
                    <b className="text-[var(--ink)]">Tip:</b> right-click (or long-press) anywhere for the address,{" "}
                    <b className="text-[var(--ink)]">DIGIPIN</b>, directions or a reachability map.
                  </div>
                )}
              </>
            ) : (
              <DirectionsPanel
                api={api}
                getBias={getBias}
                stops={stops}
                setStops={setStops}
                profile={profile}
                setProfile={setProfile}
                truck={truck}
                setTruck={setTruck}
                avoidTolls={avoidTolls}
                setAvoidTolls={setAvoidTolls}
                routes={routes}
                activeRoute={activeRoute}
                setActiveRoute={setActiveRoute}
                routeState={routeState}
                onOptimise={optimiseStops}
                showSteps={showSteps}
                setShowSteps={setShowSteps}
                active={active}
                onStepClick={(loc) => loc && mapRef.current?.flyTo({ center: loc, zoom: 17 })}
              />
            )}

            {iso && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--line)] p-3 text-xs">
                <div className="flex items-center gap-3">
                  {[
                    ["#0d9488", "15"],
                    ["#2563eb", "30"],
                    ["#7c3aed", "45"],
                  ].map(([c, m]) => (
                    <span key={m} className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
                      {m} min
                    </span>
                  ))}
                  <span className="text-[var(--muted)]">by {PROFILES.find((p) => p.id === iso.profile)?.label.toLowerCase()}</span>
                </div>
                <button onClick={clearIso} className="text-[var(--muted)] hover:underline">
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Top-right controls */}
      <div className="absolute right-3 top-3 z-10 hidden items-center gap-2 md:flex">
        <div className="flex rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 text-xs font-medium text-[var(--ink)] shadow-lg">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`rounded-lg px-3 py-1.5 ${theme === t.id ? "bg-teal-600 text-white" : "hover:bg-[var(--hover)]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setBuildings3d((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-medium shadow-lg ${
            buildings3d ? "bg-teal-600 text-white" : "bg-[var(--panel)] text-[var(--ink)]"
          }`}
        >
          <Icon name="cube" size={15} /> 3D
        </button>
      </div>

      {/* Mobile theme cycle */}
      <button
        onClick={() => setTheme((t) => THEMES[(THEMES.findIndex((x) => x.id === t) + 1) % THEMES.length].id)}
        className="absolute bottom-24 left-3 z-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--ink)] shadow-lg md:hidden"
      >
        {THEMES.find((t) => t.id === theme).label}
      </button>

      {/* Right-click menu */}
      {menu && (
        <div
          className="absolute z-30 w-60 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 text-sm text-[var(--ink)] shadow-2xl"
          style={{
            left: Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 250),
            top: Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 230),
          }}
        >
          <div className="border-b border-[var(--line)] px-3 py-2 font-mono text-xs text-[var(--muted)]">
            {menu.lat.toFixed(5)}, {menu.lon.toFixed(5)}
          </div>
          <MenuItem icon="target" onClick={() => whatsHere(menu.lat, menu.lon)}>
            What&apos;s here?
          </MenuItem>
          <MenuItem
            icon="route"
            onClick={() => {
              const p = { label: `${menu.lat.toFixed(5)}, ${menu.lon.toFixed(5)}`, lat: menu.lat, lon: menu.lon };
              setMode("directions");
              setStops((s) => [p, ...s.slice(1)]);
              setMenu(null);
            }}
          >
            Directions from here
          </MenuItem>
          <MenuItem
            icon="pin"
            onClick={() => {
              const p = { label: `${menu.lat.toFixed(5)}, ${menu.lon.toFixed(5)}`, lat: menu.lat, lon: menu.lon };
              setMode("directions");
              setStops((s) => [...s.slice(0, -1), p]);
              setMenu(null);
            }}
          >
            Directions to here
          </MenuItem>
          <MenuItem icon="sparkle" onClick={() => runIsochrone(menu.lat, menu.lon)}>
            Reachable in 15 / 30 / 45 min
          </MenuItem>
          <MenuItem
            icon="copy"
            onClick={async () => {
              setMenu(null);
              const d = await api("/api/v1/digipin", { params: { lat: menu.lat.toFixed(6), lon: menu.lon.toFixed(6) } }).catch(
                (e) => notify(e.message)
              );
              if (d) copy(d.formatted, `DIGIPIN ${d.formatted}`);
            }}
          >
            Copy DIGIPIN
          </MenuItem>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--hover)]">
      <Icon name={icon} size={16} className="text-teal-600" />
      {children}
    </button>
  );
}

const PIN_SOURCE = {
  boundary: "inside the official PIN boundary",
  address: "from the address on record",
  nearest_post_office: "nearest post office (approximate)",
};

function PlaceCard({ place, pinArea, onClose, onDirections, onCopy, onShare, onReach, onShowPin, onHidePin }) {
  const kind = place.type === "pincode" ? "PIN code area" : place.category?.split(":")[1]?.replace(/_/g, " ");
  const areaShown = pinArea && pinArea.pincode === place.pincode;
  return (
    <div className="mt-3 rounded-xl border border-[var(--line)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">{place.name}</h2>
          {kind && <p className="text-xs capitalize text-teal-700 dark:text-teal-300">{kind}</p>}
          {place.label && place.label !== place.name && (
            <p className="mt-1 text-sm leading-snug text-[var(--muted)]">{place.label}</p>
          )}
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--hover)]" aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {place.digipin && (
          <>
            <dt className="text-[var(--muted)]">DIGIPIN</dt>
            <dd>
              <button
                onClick={() => onCopy(formatDigipin(place.digipin), "DIGIPIN")}
                className="font-mono font-semibold tracking-wide text-teal-700 hover:underline dark:text-teal-300"
              >
                {formatDigipin(place.digipin)}
              </button>
            </dd>
          </>
        )}
        {place.pincode && (
          <>
            <dt className="text-[var(--muted)]">PIN code</dt>
            <dd className="flex flex-wrap items-center gap-x-2">
              <button
                onClick={() => onCopy(place.pincode, "PIN code")}
                className="font-mono font-semibold tracking-wide text-violet-700 hover:underline dark:text-violet-300"
                title={PIN_SOURCE[place.pincode_source] || "PIN code"}
              >
                {place.pincode}
              </button>
              {place.type !== "pincode" && (
                <button onClick={areaShown ? onHidePin : onShowPin} className="text-[var(--muted)] hover:underline">
                  {areaShown ? "Hide area" : "Show area"}
                </button>
              )}
            </dd>
          </>
        )}
        {place.mappin && (
          <>
            <dt className="text-[var(--muted)]">MapPIN</dt>
            <dd className="font-mono font-semibold">{place.mappin}</dd>
          </>
        )}
        <dt className="text-[var(--muted)]">Lat, Lon</dt>
        <dd>
          <button
            onClick={() => onCopy(`${place.lat.toFixed(6)}, ${place.lon.toFixed(6)}`, "Coordinates")}
            className="font-mono hover:underline"
          >
            {place.lat.toFixed(6)}, {place.lon.toFixed(6)}
          </button>
        </dd>
      </dl>

      {areaShown && <PinDetails area={pinArea} />}

      <div className="mt-3 flex gap-2">
        <button
          onClick={onDirections}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Icon name="route" size={16} /> Directions
        </button>
        <button
          onClick={onReach}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--hover)]"
          title="Reachability"
        >
          <Icon name="sparkle" size={16} />
        </button>
        <button
          onClick={onShare}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--hover)]"
          title="Copy link"
        >
          <Icon name="share" size={16} />
        </button>
      </div>
    </div>
  );
}

function PinDetails({ area }) {
  const offices = area.post_offices || [];
  return (
    <div className="mt-3 rounded-lg bg-violet-500/5 p-2.5 text-xs ring-1 ring-violet-500/20">
      <p className="font-medium">
        PIN {area.pincode} · {[area.district, area.state].filter(Boolean).join(", ")}
      </p>
      <p className="mt-0.5 text-[var(--muted)]">
        {area.boundary?.available ? "Official boundary shown" : "Approximate area (boundary not loaded for this PIN)"} ·{" "}
        {offices.length} post office{offices.length === 1 ? "" : "s"}
      </p>
      {offices.length > 0 && (
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
          {offices.map((o) => (
            <li key={o.name} className="flex justify-between gap-2">
              <span className="truncate">{o.name}</span>
              <span className="shrink-0 text-[var(--muted)]">{o.delivery ? "Delivery" : o.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DirectionsPanel({
  api,
  getBias,
  stops,
  setStops,
  profile,
  setProfile,
  truck,
  setTruck,
  avoidTolls,
  setAvoidTolls,
  routes,
  activeRoute,
  setActiveRoute,
  routeState,
  onOptimise,
  showSteps,
  setShowSteps,
  active,
  onStepClick,
}) {
  const setStop = (i, value) => setStops((s) => s.map((x, j) => (j === i ? value : x)));
  const filled = stops.filter(Boolean).length;

  return (
    <div>
      <div className="mb-3 grid grid-cols-5 gap-1 rounded-xl bg-[var(--field)] p-1 text-xs font-medium">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            onClick={() => setProfile(p.id)}
            className={`rounded-lg py-1.5 ${profile === p.id ? "bg-teal-600 text-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <PlaceInput
                api={api}
                value={stop}
                getBias={getBias}
                autoFocus={i === stops.length - 1 && !stop && stops[0] !== null}
                onSelect={(r) => setStop(i, { label: r.name === r.label ? r.name : `${r.name}`, lat: r.lat, lon: r.lon })}
                onClear={() => setStop(i, null)}
                placeholder={i === 0 ? "Choose start" : i === stops.length - 1 ? "Choose destination" : `Stop ${letter(i)}`}
                marker={
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: STOP_COLORS[i % STOP_COLORS.length] }}
                  >
                    {letter(i)}
                  </span>
                }
              />
            </div>
            {stops.length > 2 ? (
              <button
                onClick={() => setStops((s) => s.filter((_, j) => j !== i))}
                className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--hover)]"
                aria-label="Remove stop"
              >
                <Icon name="close" size={16} />
              </button>
            ) : i === 0 ? (
              <button
                onClick={() => setStops((s) => [...s].reverse())}
                className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--hover)]"
                aria-label="Swap start and destination"
              >
                <Icon name="swap" size={16} />
              </button>
            ) : (
              <span className="w-[28px]" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs">
        {stops.length < 10 && (
          <button
            onClick={() => setStops((s) => [...s, null])}
            className="flex items-center gap-1 font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <Icon name="plus" size={14} /> Add stop
          </button>
        )}
        {filled >= 4 && filled === stops.length && (
          <button onClick={onOptimise} className="flex items-center gap-1 font-medium text-teal-700 hover:underline dark:text-teal-300">
            <Icon name="sparkle" size={14} /> Optimise order
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[var(--muted)]">
          <input type="checkbox" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} className="accent-teal-600" />
          Avoid tolls
        </label>
      </div>

      {profile === "truck" && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] p-2.5 text-xs">
          {[
            ["weight_t", "Weight (t)", 1, 60, 0.5],
            ["height_m", "Height (m)", 1.5, 5, 0.1],
          ].map(([k, label, min, max, step]) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-[var(--muted)]">{label}</span>
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={truck[k]}
                onChange={(e) => setTruck((t) => ({ ...t, [k]: Number(e.target.value) }))}
                className="h-9 rounded-lg border border-[var(--line)] bg-[var(--field)] px-2 outline-none focus:border-teal-500"
              />
            </label>
          ))}
        </div>
      )}

      {routeState.loading && <p className="mt-4 text-center text-sm text-[var(--muted)]">Finding the best route…</p>}
      {routeState.error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{routeState.error}</p>}

      {!routeState.loading && routes.length > 0 && (
        <div className="mt-3 space-y-2">
          {routes.map((r, i) => (
            <button
              key={i}
              onClick={() => setActiveRoute(i)}
              className={`w-full rounded-xl border p-3 text-left ${
                i === activeRoute ? "border-teal-500 bg-teal-500/5" : "border-[var(--line)] hover:bg-[var(--hover)]"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-lg font-semibold ${i === activeRoute ? "text-teal-700 dark:text-teal-300" : ""}`}>
                  {formatDuration(r.duration_s)}
                </span>
                <span className="text-sm text-[var(--muted)]">{formatDistance(r.distance_m)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--muted)]">
                {i === 0 && <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-teal-700 dark:text-teal-300">Fastest</span>}
                {r.has_toll && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700">Tolls</span>}
                {r.has_highway && <span className="rounded bg-[var(--field)] px-1.5 py-0.5">Highway</span>}
                {r.legs.length > 1 && <span className="rounded bg-[var(--field)] px-1.5 py-0.5">{r.legs.length} legs</span>}
              </div>
            </button>
          ))}

          {active && (
            <div className="rounded-xl border border-[var(--line)]">
              <button
                onClick={() => setShowSteps((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
              >
                Turn-by-turn ({active.legs.reduce((n, l) => n + l.steps.length, 0)} steps)
                <Icon name="chevron" size={16} className={showSteps ? "rotate-180" : ""} />
              </button>
              {showSteps && (
                <ol className="max-h-72 divide-y divide-[var(--line)] overflow-y-auto border-t border-[var(--line)]">
                  {active.legs.flatMap((leg, li) =>
                    leg.steps.map((s, si) => (
                      <li key={`${li}-${si}`}>
                        <button
                          onClick={() => onStepClick(s.location)}
                          className="flex w-full justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-[var(--hover)]"
                        >
                          <span>{s.instruction}</span>
                          {s.distance_m > 0 && <span className="shrink-0 text-[var(--muted)]">{formatDistance(s.distance_m)}</span>}
                        </button>
                      </li>
                    ))
                  )}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {!routes.length && !routeState.loading && !routeState.error && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
          Pick a start and destination, or right-click the map. Drag the lettered pins to adjust. Truck mode applies weight
          and height limits.
        </p>
      )}
    </div>
  );
}
