// MapLibre style generator for the OpenMapTiles vector schema (our Planetiler tiles). Three themes:
//   light     — everyday consumer map
//   dark      — night / dashboards
//   logistics — muted base, bold truck corridors, toll roads and industrial zones highlighted

const THEMES = {
  light: {
    background: "#f3f1ec",
    residential: "#ebe7e0",
    industrial: "#ebe3e8",
    wood: "#cfe5c0",
    grass: "#dcedcf",
    park: "#cde8c3",
    water: "#a8d2ef",
    waterway: "#8fc3e8",
    aeroway: "#e3dfe8",
    building: "#e2ddd5",
    buildingOutline: "#d3ccc2",
    building3d: "#ddd6cc",
    casing: "#d0c8bb",
    motorway: "#f6b26b",
    motorwayCasing: "#d98b3a",
    trunk: "#fbd38d",
    trunkCasing: "#d7a650",
    primary: "#fff4c2",
    secondary: "#ffffff",
    minor: "#ffffff",
    path: "#c4bcae",
    rail: "#b4ada3",
    toll: null,
    boundaryCountry: "#9a7fa8",
    boundaryState: "#b9a5c4",
    text: "#3a3d42",
    textMuted: "#6b6f76",
    halo: "#ffffff",
    waterText: "#3e6f9c",
  },
  dark: {
    background: "#0f1620",
    residential: "#141c26",
    industrial: "#1a1a26",
    wood: "#122319",
    grass: "#14261b",
    park: "#13281c",
    water: "#0b2740",
    waterway: "#0f3354",
    aeroway: "#1b2230",
    building: "#1b2531",
    buildingOutline: "#243142",
    building3d: "#223041",
    casing: "#0a0f16",
    motorway: "#b9783a",
    motorwayCasing: "#5c3a18",
    trunk: "#8f6d3b",
    trunkCasing: "#4a3820",
    primary: "#46525f",
    secondary: "#3a4552",
    minor: "#2c3643",
    path: "#3a4552",
    rail: "#4b5563",
    toll: null,
    boundaryCountry: "#8e7aa3",
    boundaryState: "#5d5370",
    text: "#d4dae2",
    textMuted: "#8b95a3",
    halo: "#0b1118",
    waterText: "#6f9fc9",
  },
  logistics: {
    background: "#f2f3f5",
    residential: "#eceef1",
    industrial: "#e6defa",
    wood: "#dfe9da",
    grass: "#e4ede0",
    park: "#dde9d8",
    water: "#b9d8ec",
    waterway: "#a2cbe6",
    aeroway: "#e2e2ea",
    building: "#e4e6ea",
    buildingOutline: "#d4d8de",
    building3d: "#dcdfe5",
    casing: "#c9ced6",
    motorway: "#1d4ed8",
    motorwayCasing: "#1e3a8a",
    trunk: "#0d9488",
    trunkCasing: "#115e59",
    primary: "#5eead4",
    secondary: "#ffffff",
    minor: "#ffffff",
    path: "#cbd0d8",
    rail: "#9ca3af",
    toll: "#dc2626",
    boundaryCountry: "#7c6f9a",
    boundaryState: "#a59bbd",
    text: "#2b3038",
    textMuted: "#5f6773",
    halo: "#ffffff",
    waterText: "#3f6f95",
  },
};

export const THEME_NAMES = Object.keys(THEMES);

const NAME = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]];
const FONT = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const FONT_ITALIC = ["Noto Sans Italic"];

const lineString = ["==", ["geometry-type"], "LineString"];
const classIn = (...classes) => ["match", ["get", "class"], classes, true, false];
const zoomWidth = (stops) => ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flat()];

// [zoom, width] stops per road group
const ROADS = [
  { id: "path", classes: ["path", "track"], width: [[14, 0.6], [18, 3]], minzoom: 14, color: "path", dashed: true },
  { id: "service", classes: ["service"], width: [[14, 1], [18, 7]], minzoom: 14, color: "minor" },
  { id: "minor", classes: ["minor"], width: [[12, 0.5], [14, 2.5], [18, 13]], minzoom: 12, color: "minor" },
  { id: "tertiary", classes: ["tertiary"], width: [[11, 0.6], [14, 3.5], [18, 15]], minzoom: 10, color: "secondary" },
  { id: "secondary", classes: ["secondary"], width: [[9, 0.6], [14, 4.5], [18, 17]], minzoom: 8, color: "secondary" },
  { id: "primary", classes: ["primary"], width: [[7, 0.6], [12, 2.5], [14, 5.5], [18, 20]], minzoom: 7, color: "primary" },
  { id: "trunk", classes: ["trunk"], width: [[5, 0.6], [10, 2.2], [14, 6], [18, 22]], minzoom: 5, color: "trunk", casing: "trunkCasing" },
  { id: "motorway", classes: ["motorway"], width: [[4, 0.7], [10, 2.6], [14, 6.5], [18, 24]], minzoom: 4, color: "motorway", casing: "motorwayCasing" },
];

function roadLayers(c, theme) {
  const casings = [];
  const fills = [];
  for (const r of ROADS) {
    const filter = ["all", lineString, classIn(...r.classes)];
    const tunnelOpacity = ["case", ["==", ["get", "brunnel"], "tunnel"], 0.5, 1];
    if (!r.dashed) {
      casings.push({
        id: `road-${r.id}-casing`,
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: Math.max(r.minzoom, r.id === "motorway" || r.id === "trunk" ? 6 : r.minzoom),
        filter,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c[r.casing] || c.casing,
          "line-width": zoomWidth(r.width.map(([z, w]) => [z, w + (z >= 14 ? 2 : 1)])),
          "line-opacity": tunnelOpacity,
        },
      });
    }
    fills.push({
      id: `road-${r.id}`,
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: r.minzoom,
      filter,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c[r.color],
        "line-width": zoomWidth(r.width),
        "line-opacity": tunnelOpacity,
        ...(r.dashed ? { "line-dasharray": [2, 1.5] } : {}),
      },
    });
  }
  const extra = [
    {
      id: "rail",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 9,
      filter: ["all", lineString, classIn("rail", "transit")],
      paint: { "line-color": c.rail, "line-width": zoomWidth([[9, 0.6], [16, 2.5]]), "line-dasharray": [3, 2] },
    },
  ];
  if (theme === "logistics") {
    extra.push({
      id: "road-toll",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 8,
      filter: ["all", lineString, ["==", ["get", "toll"], 1]],
      paint: { "line-color": c.toll, "line-width": zoomWidth([[8, 1], [14, 2.5], [18, 5]]), "line-dasharray": [1, 1.5] },
    });
  }
  return [...casings, ...fills, ...extra];
}

const POI_COLOR = [
  "match",
  ["get", "class"],
  ["fuel"], "#ea580c",
  ["hospital", "pharmacy", "doctors", "dentist"], "#dc2626",
  ["restaurant", "fast_food", "cafe", "bar", "beer", "ice_cream", "bakery"], "#d97706",
  ["shop", "grocery", "clothing_store", "alcohol_shop", "convenience", "mall"], "#7c3aed",
  ["bank", "atm"], "#0891b2",
  ["school", "college", "university", "library"], "#2563eb",
  ["place_of_worship"], "#78716c",
  ["lodging"], "#db2777",
  ["parking", "bus", "railway", "airport", "ferry_terminal"], "#1d4ed8",
  ["park", "garden", "playground", "attraction", "zoo"], "#16a34a",
  ["police", "fire_station", "post", "town_hall"], "#475569",
  "#64748b",
];

function labelLayers(c) {
  const halo = { "text-halo-color": c.halo, "text-halo-width": 1.4, "text-halo-blur": 0.3 };
  return [
    {
      id: "water-name-line",
      type: "symbol",
      source: "omt",
      "source-layer": "water_name",
      filter: lineString,
      layout: { "text-field": NAME, "text-font": FONT_ITALIC, "text-size": 12, "symbol-placement": "line" },
      paint: { "text-color": c.waterText, ...halo },
    },
    {
      id: "water-name-point",
      type: "symbol",
      source: "omt",
      "source-layer": "water_name",
      filter: ["==", ["geometry-type"], "Point"],
      layout: { "text-field": NAME, "text-font": FONT_ITALIC, "text-size": 12 },
      paint: { "text-color": c.waterText, ...halo },
    },
    {
      id: "road-name",
      type: "symbol",
      source: "omt",
      "source-layer": "transportation_name",
      minzoom: 13,
      filter: lineString,
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 18, 14],
        "symbol-placement": "line",
        "text-max-angle": 30,
      },
      paint: { "text-color": c.text, ...halo },
    },
    {
      id: "road-ref",
      type: "symbol",
      source: "omt",
      "source-layer": "transportation_name",
      minzoom: 8,
      filter: ["all", ["has", "ref"], classIn("motorway", "trunk", "primary")],
      layout: {
        "text-field": ["get", "ref"],
        "text-font": FONT_BOLD,
        "text-size": 10,
        "symbol-placement": "line",
        "symbol-spacing": 400,
        "text-rotation-alignment": "viewport",
      },
      paint: { "text-color": "#ffffff", "text-halo-color": "#475569", "text-halo-width": 3 },
    },
    {
      id: "poi-dot",
      type: "circle",
      source: "omt",
      "source-layer": "poi",
      minzoom: 14,
      filter: ["<=", ["to-number", ["get", "rank"], 99], ["step", ["zoom"], 8, 15, 20, 16, 99]],
      paint: {
        "circle-color": POI_COLOR,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 6],
        "circle-stroke-color": c.halo,
        "circle-stroke-width": 1.2,
      },
    },
    {
      id: "poi-label",
      type: "symbol",
      source: "omt",
      "source-layer": "poi",
      minzoom: 15,
      filter: ["<=", ["to-number", ["get", "rank"], 99], ["step", ["zoom"], 8, 16, 30, 17, 99]],
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": 11,
        "text-anchor": "top",
        "text-offset": [0, 0.7],
        "text-max-width": 8,
      },
      paint: { "text-color": POI_COLOR, ...halo },
    },
    {
      id: "housenumber",
      type: "symbol",
      source: "omt",
      "source-layer": "housenumber",
      minzoom: 17,
      layout: { "text-field": ["get", "housenumber"], "text-font": FONT, "text-size": 10 },
      paint: { "text-color": c.textMuted, ...halo },
    },
    {
      id: "place-neighbourhood",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 12,
      filter: classIn("suburb", "neighbourhood", "quarter", "hamlet", "isolated_dwelling"),
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 16, 13],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
        "text-max-width": 7,
      },
      paint: { "text-color": c.textMuted, ...halo },
    },
    {
      id: "place-village",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 10,
      filter: classIn("village"),
      layout: { "text-field": NAME, "text-font": FONT, "text-size": 11, "text-max-width": 8 },
      paint: { "text-color": c.text, ...halo },
    },
    {
      id: "place-town",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 7,
      filter: classIn("town"),
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 13, 15],
        "text-max-width": 8,
      },
      paint: { "text-color": c.text, ...halo },
    },
    {
      id: "place-city",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 4,
      filter: classIn("city"),
      layout: {
        "text-field": NAME,
        "text-font": FONT_BOLD,
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, ["case", ["<=", ["coalesce", ["get", "capital"], 99], 2], 13, 11], 12, 20],
        "text-max-width": 8,
      },
      paint: { "text-color": c.text, ...halo },
    },
    {
      id: "place-state",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 4,
      maxzoom: 9,
      filter: classIn("state", "province"),
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": 12,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.15,
        "text-max-width": 8,
      },
      paint: { "text-color": c.textMuted, ...halo },
    },
    {
      id: "place-country",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      maxzoom: 7,
      filter: classIn("country"),
      layout: { "text-field": NAME, "text-font": FONT_BOLD, "text-size": 14, "text-max-width": 8 },
      paint: { "text-color": c.text, ...halo },
    },
  ];
}

export function buildStyle({ theme = "light", source, glyphs, indiaBoundaryUrl, name = "HeisynMaps" }) {
  const c = THEMES[theme] || THEMES.light;
  const sources = { omt: source };
  if (indiaBoundaryUrl) sources["india-boundary"] = { type: "geojson", data: indiaBoundaryUrl };

  const fill = (id, layer, filter, color, extra = {}) => ({
    id,
    type: "fill",
    source: "omt",
    "source-layer": layer,
    ...(filter ? { filter } : {}),
    ...extra,
    paint: { "fill-color": color, ...(extra.paint || {}) },
  });

  const layers = [
    { id: "background", type: "background", paint: { "background-color": c.background } },
    fill("landuse-residential", "landuse", classIn("residential", "suburb", "neighbourhood"), c.residential, { minzoom: 9 }),
    fill("landuse-industrial", "landuse", classIn("industrial", "commercial", "retail", "railway"), c.industrial, { minzoom: 9 }),
    fill("landcover-wood", "landcover", classIn("wood", "forest"), c.wood),
    fill("landcover-grass", "landcover", classIn("grass", "farmland", "scrub", "wetland"), c.grass, {
      paint: { "fill-opacity": 0.7 },
    }),
    fill("park", "park", null, c.park),
    fill("water", "water", null, c.water),
    {
      id: "waterway",
      type: "line",
      source: "omt",
      "source-layer": "waterway",
      paint: { "line-color": c.waterway, "line-width": zoomWidth([[8, 0.5], [16, 3]]) },
    },
    fill("aeroway-area", "aeroway", ["==", ["geometry-type"], "Polygon"], c.aeroway, { minzoom: 11 }),
    fill("building", "building", null, c.building, {
      minzoom: 13,
      paint: { "fill-outline-color": c.buildingOutline },
    }),
    ...roadLayers(c, theme),
    {
      id: "boundary-state",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      minzoom: 4,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
      paint: { "line-color": c.boundaryState, "line-width": 1, "line-dasharray": [3, 2] },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      // Disputed segments are hidden; India's official boundary is drawn from the
      // Survey of India overlay below when available (see docs/PRD.md §7).
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
      paint: { "line-color": c.boundaryCountry, "line-width": zoomWidth([[2, 0.8], [10, 2.2]]) },
    },
    ...(indiaBoundaryUrl
      ? [
          {
            id: "boundary-india-official",
            type: "line",
            source: "india-boundary",
            paint: { "line-color": c.boundaryCountry, "line-width": zoomWidth([[2, 0.8], [10, 2.2]]) },
          },
        ]
      : []),
    {
      id: "building-3d",
      type: "fill-extrusion",
      source: "omt",
      "source-layer": "building",
      minzoom: 14,
      layout: { visibility: "none" },
      paint: {
        "fill-extrusion-color": c.building3d,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    },
    ...labelLayers(c),
  ];

  return {
    version: 8,
    name: `${name} ${theme}`,
    metadata: { "heisyn:theme": theme },
    glyphs,
    sources,
    layers,
  };
}
