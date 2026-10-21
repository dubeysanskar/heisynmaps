// One source of truth for plans, SKUs and endpoint docs.
// Used by the API gateway (rate limits, metering), /docs, /pricing and /console.

// hardCap: requests beyond the included amount are refused instead of billed.
export const PLANS = {
  free: { name: "Free", priceInr: 0, includedPerSku: 100_000, rpm: 300, hardCap: true },
  growth: { name: "Growth", priceInr: 4999, includedPerSku: 1_000_000, rpm: 3000 },
  enterprise: { name: "Enterprise / On-prem", priceInr: null, includedPerSku: Infinity, rpm: 20000 },
  system: { name: "First-party", priceInr: 0, includedPerSku: Infinity, rpm: 6000 },
};

// Key scopes. A key with no scopes can call every group.
export const API_GROUPS = {
  maps: "Maps & tiles",
  search: "Search & geocoding",
  routing: "Routing & optimisation",
  fleet: "Geofencing",
  addressing: "DIGIPIN & places",
};

export function skuGroup(sku) {
  const prefix = String(sku || "").split(".")[0];
  return { maps: "maps", search: "search", route: "routing", geofence: "fleet", address: "addressing", places: "addressing" }[
    prefix
  ];
}

// Overage price in INR per 1,000 billable units (admins can override per SKU in /admin).
export const SKUS = {
  "maps.load": { label: "Map loads", inrPer1k: 60 },
  "maps.tiles": { label: "Vector tiles", inrPer1k: 0 },
  "search.autocomplete": { label: "Autocomplete", inrPer1k: 25 },
  "search.geocode": { label: "Geocode", inrPer1k: 40 },
  "search.reverse": { label: "Reverse geocode", inrPer1k: 40 },
  "search.nearby": { label: "Nearby search", inrPer1k: 40 },
  "route.directions": { label: "Directions", inrPer1k: 80 },
  "route.matrix": { label: "Distance matrix (per element)", inrPer1k: 80 },
  "route.isochrone": { label: "Isochrones", inrPer1k: 80 },
  "route.optimize": { label: "Route optimisation", inrPer1k: 400 },
  "route.snap": { label: "Snap to road", inrPer1k: 80 },
  "address.digipin": { label: "DIGIPIN", inrPer1k: 0 },
  "address.pincode": { label: "PIN code lookup", inrPer1k: 10 },
  "places.read": { label: "Places (read)", inrPer1k: 10 },
  "places.write": { label: "Places (write)", inrPer1k: 10 },
  "geofence.read": { label: "Geofences (read)", inrPer1k: 2 },
  "geofence.write": { label: "Geofences (write)", inrPer1k: 2 },
  "geofence.check": { label: "Geofence checks (per point)", inrPer1k: 2 },
};

const P = (lat, lon) => ({ lat, lon });
const CP = P(28.6315, 77.2167); // Connaught Place
const CYBER = P(28.495, 77.0896); // Cyber City, Gurugram
const NOIDA = P(28.5708, 77.3261); // Noida Sector 18

// Profiles accepted by every routing endpoint.
const PROFILE_PARAM = {
  name: "profile",
  in: "body",
  type: "string",
  required: false,
  description: "car (default) · truck · bike (motorcycle) · scooter · bicycle · foot · bus",
};
const TRUCK_PARAM = {
  name: "truck",
  in: "body",
  type: "object",
  required: false,
  description: "Truck dimensions when profile is truck: { weight_t, height_m, width_m, length_m, axle_load_t, axle_count, hazmat }",
};
const AVOID_PARAM = {
  name: "avoid",
  in: "body",
  type: "string[]",
  required: false,
  description: 'Any of "tolls", "highways", "ferries"',
};

// Example search result as returned by autocomplete / geocode / nearby.
const RESULT = {
  id: "osm:W1449268449",
  source: "osm",
  name: "DLF Cyber Hub",
  label: "DLF Cyber Hub, Sector 25A, Gurgaon, Haryana",
  category: "landuse:retail",
  type: "locality",
  address: {
    house_number: null,
    street: null,
    locality: "Sector 25A",
    city: "Gurgaon",
    state: "Haryana",
    postcode: null,
    country: "India",
    country_code: "IN",
  },
  lat: 28.4951011,
  lon: 77.0885127,
  digipin: "39JL95J3J2",
  extent: [77.0865315, 28.4975961, 77.090877, 28.4922016],
};

const STEP = {
  instruction: "Drive north on Outer Circle.",
  distance_m: 19,
  duration_s: 4,
  type: 1,
  street_names: ["Outer Circle"],
  location: [77.216717, 28.631504],
};

const PLACE = {
  mappin: "KAE35N",
  name: "Okhla DC-1",
  category: "warehouse",
  address: "Okhla Phase II, New Delhi",
  lat: 28.5355,
  lon: 77.271,
  digipin: "39J4T26MM3",
  props: {},
  created_at: "2026-10-21T11:07:39.406Z",
};

const FENCE = {
  id: "gf_7ad88486f2c440f682aa",
  name: "Okhla hub",
  geometry: {
    type: "Polygon",
    coordinates: [[[77.271, 28.539997], [77.271502, 28.539953], [77.271985, 28.539825], [77.271, 28.539997]]],
  },
  props: {},
  created_at: "2026-10-21T11:07:39.700Z",
};

// slug: stable URL id for /docs/api/[slug]
// params: [{ name, in: query|body|path, type, required, description }]
// example: what the "Try it" runner pre-fills ({ query, body, path })
// response: a real (abbreviated) response from the live API
export const ENDPOINTS = [
  {
    slug: "style",
    group: "Maps",
    sku: "maps.load",
    method: "GET",
    path: "/api/v1/style",
    title: "Map style",
    summary: "MapLibre GL style JSON. Each request counts as one map load. Themes: light, dark, logistics.",
    description:
      "Point any MapLibre GL client (web, Android, iOS) at this URL. The style references our vector tiles, fonts and the official-boundary overlay, and carries your key on every tile request. Use a browser key with your site's origin when loading it from a web page.",
    params: [
      { name: "key", in: "query", type: "string", required: true, description: "API key. Browser keys are fine here." },
      { name: "theme", in: "query", type: "string", required: false, description: "light (default) · dark · logistics" },
    ],
    example: { query: { theme: "light" } },
    response: {
      version: 8,
      name: "HeisynMaps light",
      metadata: { "heisyn:theme": "light" },
      glyphs: "https://…/fonts/{fontstack}/{range}.pbf",
      sources: { omt: { type: "vector", url: "https://…/api/v1/tiles/tilejson?key=…" } },
      layers: [{ id: "background", type: "background", paint: { "background-color": "#f3f1ec" } }, "… 42 more layers"],
    },
  },
  {
    slug: "tilejson",
    group: "Maps",
    sku: null,
    method: "GET",
    path: "/api/v1/tiles/tilejson",
    title: "TileJSON",
    summary: "TileJSON 3.0 description of the self-hosted vector tileset (bounds, zoom range, layers). Not billed.",
    description:
      "The style already points at this document, so most apps never call it directly. It returns 404 no_tiles when the server is running without a local PMTiles file (development mode uses public tiles instead).",
    params: [{ name: "key", in: "query", type: "string", required: true, description: "API key" }],
    example: { query: {} },
    response: {
      tilejson: "3.0.0",
      name: "HeisynMaps",
      attribution: '<a href="https://openmaptiles.org/">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
      tiles: ["https://…/api/v1/tiles/{z}/{x}/{y}.pbf?key=…"],
      minzoom: 0,
      maxzoom: 14,
      bounds: [76.84, 28.2, 77.65, 28.9],
      center: [77.209, 28.6139, 10],
      vector_layers: [{ id: "transportation", fields: { class: "String" } }, "…"],
    },
  },
  {
    slug: "tiles",
    group: "Maps",
    sku: "maps.tiles",
    method: "GET",
    path: "/api/v1/tiles/{z}/{x}/{y}.pbf",
    title: "Vector tiles",
    summary: "OpenMapTiles-schema vector tiles (Mapbox Vector Tile protobuf). Referenced automatically by the style. Free.",
    description:
      "Tiles are served from the self-hosted PMTiles archive and are cacheable for a day. An empty tile returns 204. You rarely need to call this yourself — load /api/v1/style in MapLibre instead.",
    params: [
      { name: "z", in: "path", type: "integer", required: true, description: "Zoom level, 0–14" },
      { name: "x", in: "path", type: "integer", required: true, description: "Tile column" },
      { name: "y", in: "path", type: "integer", required: true, description: "Tile row" },
      { name: "key", in: "query", type: "string", required: true, description: "API key" },
    ],
    example: { path: { z: "10", x: "731", y: "427" } },
    response: "Binary application/x-protobuf (204 No Content for an empty tile)",
  },
  {
    slug: "autocomplete",
    group: "Search",
    sku: "search.autocomplete",
    method: "GET",
    path: "/api/v1/autocomplete",
    title: "Autocomplete",
    summary: "Search-as-you-type. Your organisation's saved places are returned first. Bias with lat/lon.",
    description:
      "Typo-tolerant prefix search over places and addresses. Results within 200 km of the bias point are ranked first; without lat/lon the bias defaults to central Delhi. A DIGIPIN or one of your MapPINs typed into the box resolves directly. Debounce keystrokes (~200 ms) on the client.",
    params: [
      { name: "q", in: "query", type: "string", required: true, description: "Text typed so far (max 200 chars)" },
      { name: "lat", in: "query", type: "number", required: false, description: "Bias latitude (e.g. the map centre or user location)" },
      { name: "lon", in: "query", type: "number", required: false, description: "Bias longitude" },
      { name: "limit", in: "query", type: "integer", required: false, description: "1–20, default 8" },
    ],
    example: { query: { q: "cyber hub", lat: 28.6, lon: 77.2 } },
    response: { query: "cyber hub", results: [RESULT] },
  },
  {
    slug: "geocode",
    group: "Search",
    sku: "search.geocode",
    method: "GET",
    path: "/api/v1/geocode",
    title: "Geocode",
    summary: "Address or place → coordinates, with DIGIPIN for every Indian result. Also accepts a DIGIPIN or MapPIN as q.",
    description:
      "Order of precedence: a valid DIGIPIN, then one of your MapPINs, then your saved places, then OpenStreetMap. Every result inside India carries its 10-character DIGIPIN. `extent` is set when the match is an area ([west, north, east, south]).",
    params: [
      { name: "q", in: "query", type: "string", required: true, description: "Address, place name, DIGIPIN or MapPIN" },
      { name: "lat", in: "query", type: "number", required: false, description: "Bias latitude" },
      { name: "lon", in: "query", type: "number", required: false, description: "Bias longitude" },
      { name: "limit", in: "query", type: "integer", required: false, description: "1–20, default 8" },
    ],
    example: { query: { q: "Sector 18 Noida" } },
    response: {
      query: "Sector 18 Noida",
      results: [
        {
          ...RESULT,
          id: "osm:R19397973",
          name: "Sector 18",
          label: "Sector 18, Noida, Uttar Pradesh",
          category: "place:suburb",
          type: "district",
          address: { ...RESULT.address, locality: null, city: "Noida", state: "Uttar Pradesh" },
          lat: 28.5705399,
          lon: 77.3228931,
          digipin: "39J54JP88F",
          extent: [77.3197972, 28.5736167, 77.326778, 28.5670257],
        },
      ],
    },
  },
  {
    slug: "reverse",
    group: "Search",
    sku: "search.reverse",
    method: "GET",
    path: "/api/v1/reverse",
    title: "Reverse geocode",
    summary: "Coordinates → nearest address, plus the DIGIPIN of the exact point.",
    description:
      "`digipin` is the code for the coordinates you sent; `result.digipin` is the code for the matched address. `result` is null when nothing is nearby (e.g. open sea).",
    params: [
      { name: "lat", in: "query", type: "number", required: true, description: "Latitude, -90 to 90" },
      { name: "lon", in: "query", type: "number", required: true, description: "Longitude, -180 to 180" },
    ],
    example: { query: { lat: 28.6315, lon: 77.2167 } },
    response: {
      lat: 28.6315,
      lon: 77.2167,
      digipin: "39J49KP2C8",
      result: {
        ...RESULT,
        id: "osm:W578543605",
        name: "Outer Circle",
        label: "Outer Circle, Connaught Place, New Delhi, Delhi, 110001",
        category: "highway:secondary",
        type: "street",
        address: { ...RESULT.address, locality: "Connaught Place", city: "New Delhi", state: "Delhi", postcode: "110001" },
        lat: 28.631551,
        lon: 77.2167011,
        digipin: "39J49KP9MT",
        extent: [77.2166601, 28.6316729, 77.2167421, 28.6314291],
      },
    },
  },
  {
    slug: "nearby",
    group: "Search",
    sku: "search.nearby",
    method: "GET",
    path: "/api/v1/nearby",
    title: "Nearby",
    summary: "Points of interest by category around a point, sorted by straight-line distance.",
    description: "Each result has the same shape as a geocode result plus `distance_m` from the point you sent.",
    params: [
      { name: "lat", in: "query", type: "number", required: true, description: "Latitude of the centre" },
      { name: "lon", in: "query", type: "number", required: true, description: "Longitude of the centre" },
      {
        name: "category",
        in: "query",
        type: "string",
        required: true,
        description: "fuel · ev_charging · atm · hospital · pharmacy · restaurant · parking · police · toilets · warehouse",
      },
      { name: "radius", in: "query", type: "integer", required: false, description: "Metres, 100–25000, default 3000" },
      { name: "limit", in: "query", type: "integer", required: false, description: "1–50, default 20" },
    ],
    example: { query: { lat: 28.6315, lon: 77.2167, category: "fuel" } },
    response: {
      category: "fuel",
      radius_m: 3000,
      results: [
        {
          ...RESULT,
          id: "osm:W351418890",
          name: "Indian Oil",
          label: "Indian Oil, Hanuman Lane, Connaught Place, New Delhi, Delhi, 110001",
          category: "amenity:fuel",
          type: "house",
          address: { ...RESULT.address, street: "Hanuman Lane", locality: "Connaught Place", city: "New Delhi", state: "Delhi", postcode: "110001" },
          lat: 28.6292409,
          lon: 77.2126215,
          digipin: "39J49LF7F4",
          extent: [77.2124657, 28.6293684, 77.2127772, 28.6291133],
          distance_m: 471,
        },
      ],
    },
  },
  {
    slug: "route",
    group: "Routing",
    sku: "route.directions",
    method: "POST",
    path: "/api/v1/route",
    title: "Directions",
    summary:
      "Multi-stop routing with turn-by-turn steps. Profiles: car, truck, bike (motorcycle), scooter, bicycle, foot. Truck dimensions and weight are applied per request.",
    description:
      "Returns the fastest route first, plus up to two alternatives for simple A→B requests. Geometry is a GeoJSON LineString ([lon, lat]); distances are metres and durations seconds. A 422 no_route means the stops can't be connected (for example a truck that is too tall for every way in).",
    params: [
      { name: "locations", in: "body", type: "{lat, lon}[]", required: true, description: "2–25 stops, in visiting order" },
      PROFILE_PARAM,
      { name: "alternatives", in: "body", type: "integer", required: false, description: "0–2 extra routes (only for two stops)" },
      TRUCK_PARAM,
      AVOID_PARAM,
      { name: "depart_at", in: "body", type: "string", required: false, description: "Local departure time, e.g. 2026-10-21T22:30" },
      { name: "language", in: "body", type: "string", required: false, description: "Instruction language, default en-US" },
    ],
    example: {
      body: { locations: [CP, CYBER], profile: "truck", truck: { weight_t: 12, height_m: 3.8 }, alternatives: 1 },
    },
    response: {
      profile: "truck",
      routes: [
        {
          distance_m: 26180,
          duration_s: 3799,
          has_toll: false,
          has_highway: true,
          has_ferry: false,
          geometry: { type: "LineString", coordinates: [[77.216717, 28.631504], [77.21666, 28.631673], [77.089601, 28.495012]] },
          legs: [{ distance_m: 26180, duration_s: 3799, steps: [STEP] }],
        },
      ],
    },
  },
  {
    slug: "matrix",
    group: "Routing",
    sku: "route.matrix",
    method: "POST",
    path: "/api/v1/matrix",
    title: "Distance matrix",
    summary: "Travel time (s) and distance (m) between every source and target. Billed per element, up to 2,500 (50×50).",
    description:
      "`durations[i][j]` and `distances[i][j]` go from sources[i] to targets[j]. A cell is null when that pair can't be routed. Omit targets for a square matrix over the sources.",
    params: [
      { name: "sources", in: "body", type: "{lat, lon}[]", required: true, description: "1–50 origins" },
      { name: "targets", in: "body", type: "{lat, lon}[]", required: false, description: "1–50 destinations (defaults to sources)" },
      PROFILE_PARAM,
      TRUCK_PARAM,
      AVOID_PARAM,
    ],
    example: { body: { sources: [CP, NOIDA], targets: [CYBER, NOIDA], profile: "car" } },
    response: { profile: "car", durations: [[3273, 2532], [4642, 0]], distances: [[23502, 17318], [32355, 0]] },
  },
  {
    slug: "isochrone",
    group: "Routing",
    sku: "route.isochrone",
    method: "POST",
    path: "/api/v1/isochrone",
    title: "Isochrone (reachability)",
    summary: "Polygons of the area reachable within N minutes or N km. Returns GeoJSON.",
    description:
      "Send either `minutes` or `km` (up to four values). The response is a GeoJSON FeatureCollection with one polygon per value, largest first, each with a suggested `color`.",
    params: [
      { name: "location", in: "body", type: "{lat, lon}", required: true, description: "Starting point (e.g. a hub or dark store)" },
      { name: "minutes", in: "body", type: "number[]", required: false, description: "1–4 travel times, each ≤ 120" },
      { name: "km", in: "body", type: "number[]", required: false, description: "1–4 travel distances, each ≤ 100 (instead of minutes)" },
      PROFILE_PARAM,
      TRUCK_PARAM,
    ],
    example: { body: { location: CP, minutes: [15, 30], profile: "bike" } },
    response: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[[77.2247, 28.719904], [77.2251, 28.7195], [77.2247, 28.719904]]] },
          properties: { minutes: 30, color: "#2563eb" },
        },
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[[77.2207, 28.667731], [77.221, 28.6674], [77.2207, 28.667731]]] },
          properties: { minutes: 15, color: "#0d9488" },
        },
      ],
    },
  },
  {
    slug: "optimize",
    group: "Routing",
    sku: "route.optimize",
    method: "POST",
    path: "/api/v1/optimize",
    title: "Route optimisation",
    summary:
      "Single vehicle: send locations and get back the fastest visiting order (first and last stop fixed). Fleet VRP with capacities and time windows: send vehicles and jobs.",
    description:
      "Single vehicle (3–25 locations): `order` lists the original indexes in the optimised visiting order and `route` is the full route in that order. Fleet mode (vehicles + jobs) solves capacitated VRP with time windows on the self-hosted optimiser; it returns 501 vroom_not_configured until the operator enables it.",
    params: [
      { name: "locations", in: "body", type: "{lat, lon}[]", required: false, description: "Single vehicle: 3–25 stops; first and last stay fixed" },
      PROFILE_PARAM,
      TRUCK_PARAM,
      {
        name: "vehicles",
        in: "body",
        type: "object[]",
        required: false,
        description: "Fleet: [{ id, start: {lat,lon}, end?, capacity?: [n], time_window?: [start_s, end_s], skills? }] (max 100)",
      },
      {
        name: "jobs",
        in: "body",
        type: "object[]",
        required: false,
        description: "Fleet: [{ id, lat, lon, service?, delivery?: [n], pickup?: [n], time_windows?, skills?, priority? }] (max 1000)",
      },
    ],
    example: { body: { locations: [CP, NOIDA, P(28.5355, 77.391), CYBER], profile: "bike" } },
    response: {
      profile: "bike",
      order: [0, 2, 1, 3],
      route: {
        distance_m: 72363,
        duration_s: 10254,
        has_toll: false,
        has_highway: true,
        has_ferry: false,
        geometry: { type: "LineString", coordinates: [[77.216717, 28.631504], [77.21666, 28.631673], [77.089601, 28.495012]] },
        legs: [{ distance_m: 26474, duration_s: 3719, steps: [STEP] }, "… 2 more legs"],
      },
    },
  },
  {
    slug: "snap",
    group: "Routing",
    sku: "route.snap",
    method: "POST",
    path: "/api/v1/snap",
    title: "Snap to road",
    summary: "Matches a noisy GPS trace to the road network and returns the driven path and distance. Traces are never stored.",
    description:
      "Use it for trip audits, distance-based billing and cleaning up telematics pings. When every point has a `time` (epoch seconds) the timestamps are used to improve the match.",
    params: [
      { name: "points", in: "body", type: "{lat, lon, time?}[]", required: true, description: "2–5000 GPS points in order" },
      PROFILE_PARAM,
    ],
    example: {
      body: {
        points: [P(28.6304, 77.2177), P(28.6312, 77.2195), P(28.6326, 77.2205), P(28.6339, 77.2199)],
        profile: "car",
      },
    },
    response: {
      profile: "car",
      route: {
        distance_m: 2218,
        duration_s: 660,
        has_toll: false,
        has_highway: false,
        has_ferry: false,
        geometry: { type: "LineString", coordinates: [[77.217698, 28.630122], [77.217789, 28.630074], [77.219912, 28.633903]] },
        legs: [{ distance_m: 2218, duration_s: 660, steps: [{ ...STEP, instruction: "Turn right onto Sansad Marg.", street_names: ["Sansad Marg"], type: 10 }] }],
      },
    },
  },
  {
    slug: "digipin",
    group: "Addressing",
    sku: "address.digipin",
    method: "GET",
    path: "/api/v1/digipin",
    title: "DIGIPIN encode / decode",
    summary: "India Post's 10-character grid code (~4 m cell). Pass lat & lon to encode, or code to decode. Free.",
    description:
      "Encoding works for any point inside India's DIGIPIN area (lat 2.5–38.5, lon 63.5–99.5); outside it returns 400 invalid_param. Decoding returns the centre of the ~4 m cell and its bbox. Codes are accepted with or without dashes.",
    params: [
      { name: "lat", in: "query", type: "number", required: false, description: "Latitude to encode" },
      { name: "lon", in: "query", type: "number", required: false, description: "Longitude to encode" },
      { name: "code", in: "query", type: "string", required: false, description: "DIGIPIN to decode, e.g. 39J-49K-P2C8" },
    ],
    example: { query: { lat: 28.6315, lon: 77.2167 } },
    response: { lat: 28.6315, lon: 77.2167, digipin: "39J49KP2C8", formatted: "39J-49K-P2C8" },
  },
  {
    slug: "pincode",
    group: "Addressing",
    sku: "address.pincode",
    method: "GET",
    path: "/api/v1/pincode",
    title: "PIN code lookup",
    summary:
      "India Post PIN codes three ways: ?lat&lon finds the PIN covering a point, ?code returns one PIN's details and post offices, ?q searches by PIN prefix (\"1100\") or area / post-office name (\"lajpat nagar\").",
    description:
      "Point lookups use the official PIN boundary where it is loaded (method boundary, confidence high), then the postcode on the nearest OpenStreetMap address if it is a real PIN nearby (address, medium), then the nearest post office (nearest_post_office, medium within 3 km, otherwise low). Every geocode, autocomplete, reverse and nearby result also carries a pincode field resolved the same way, and plain PIN codes like 110001 work as search queries. Data: Department of Posts, Government of India (GODL-India).",
    params: [
      { name: "lat", in: "query", type: "number", required: false, description: "Latitude — find the PIN covering this point (with lon)" },
      { name: "lon", in: "query", type: "number", required: false, description: "Longitude" },
      { name: "code", in: "query", type: "string", required: false, description: "A 6-digit PIN to look up, e.g. 110001" },
      { name: "q", in: "query", type: "string", required: false, description: "PIN prefix (1–5 digits) or area / post-office name" },
      { name: "geometry", in: "query", type: "0 | 1", required: false, description: "With code: include the boundary polygon when available" },
      { name: "limit", in: "query", type: "integer", required: false, description: "With q: 1–50 results (default 10)" },
    ],
    example: { query: { lat: 28.495, lon: 77.0896 } },
    response: {
      lat: 28.495,
      lon: 77.0896,
      pincode: "122002",
      district: "Gurugram",
      state: "Haryana",
      circle: "Haryana Circle",
      region: null,
      division: "Gurgaon Division",
      center: { lat: 28.466093, lon: 77.105835 },
      digipin: "39JL7JKK95",
      bbox: [77.06859, 28.46322, 77.12073, 28.50652],
      post_office_count: 1,
      delivery_offices: 1,
      boundary: { available: true },
      method: "boundary",
      confidence: "high",
    },
  },
  {
    slug: "pincode-detail",
    group: "Addressing",
    sku: "address.pincode",
    method: "GET",
    path: "/api/v1/pincode/{code}",
    title: "PIN code details",
    summary: "One PIN code: district, state, postal circle and division, centre, bounding box and every post office in it. Add ?geometry=1 for the boundary polygon.",
    description:
      "The centre is the robust median of the PIN's post offices (moved inside the boundary when one is loaded). Without a boundary, bbox frames the core of the area rather than every outlying branch office. Returns 404 for PINs India Post does not list.",
    params: [
      { name: "code", in: "path", type: "string", required: true, description: "6-digit PIN code" },
      { name: "geometry", in: "query", type: "0 | 1", required: false, description: "Include the boundary as GeoJSON when available" },
    ],
    example: { path: { code: "122002" }, query: { geometry: 1 } },
    response: {
      pincode: "122002",
      district: "Gurugram",
      state: "Haryana",
      circle: "Haryana Circle",
      region: null,
      division: "Gurgaon Division",
      center: { lat: 28.466093, lon: 77.105835 },
      digipin: "39JL7JKK95",
      bbox: [77.06859, 28.46322, 77.12073, 28.50652],
      post_office_count: 1,
      delivery_offices: 1,
      boundary: { available: true },
      post_offices: [{ name: "DLF QE SO", type: "Sub office", delivery: true, lat: 28.466093, lon: 77.1058349 }],
      geometry: { type: "MultiPolygon", coordinates: "[… boundary rings …]" },
    },
  },
  {
    slug: "places-create",
    group: "Addressing",
    sku: "places.write",
    method: "POST",
    path: "/api/v1/places",
    title: "Save a place (MapPIN)",
    summary:
      "Store your own hubs, warehouses, stores or customer gates. Each one gets a short 6-character MapPIN that works in /geocode and /autocomplete.",
    description:
      "Places are private to your organisation. MapPINs use only unambiguous characters (no 0/O/1/I) so they can be read out over the phone to a rider.",
    params: [
      { name: "name", in: "body", type: "string", required: true, description: "Display name (max 200)" },
      { name: "lat", in: "body", type: "number", required: true, description: "Latitude" },
      { name: "lon", in: "body", type: "number", required: true, description: "Longitude" },
      { name: "category", in: "body", type: "string", required: false, description: "Free text, e.g. warehouse, store, customer" },
      { name: "address", in: "body", type: "string", required: false, description: "Address text (max 500)" },
      { name: "props", in: "body", type: "object", required: false, description: "Any JSON you want stored with the place" },
    ],
    example: { body: { name: "Okhla DC-1", lat: 28.5355, lon: 77.271, category: "warehouse", address: "Okhla Phase II, New Delhi" } },
    response: { place: PLACE },
  },
  {
    slug: "places-list",
    group: "Addressing",
    sku: "places.read",
    method: "GET",
    path: "/api/v1/places",
    title: "List places",
    summary: "Your organisation's saved places, newest first.",
    params: [
      { name: "limit", in: "query", type: "integer", required: false, description: "1–500, default 100" },
      { name: "offset", in: "query", type: "integer", required: false, description: "Skip this many, default 0" },
    ],
    example: { query: { limit: 20 } },
    response: { places: [PLACE] },
  },
  {
    slug: "places-get",
    group: "Addressing",
    sku: "places.read",
    method: "GET",
    path: "/api/v1/places/{mappin}",
    title: "Resolve a MapPIN",
    summary: "Fetch one of your saved places by its MapPIN. 404 not_found if it doesn't exist.",
    params: [{ name: "mappin", in: "path", type: "string", required: true, description: "6-character MapPIN (case-insensitive)" }],
    example: { path: { mappin: "KAE35N" } },
    response: { place: PLACE },
  },
  {
    slug: "places-delete",
    group: "Addressing",
    sku: "places.write",
    method: "DELETE",
    path: "/api/v1/places/{mappin}",
    title: "Delete a place",
    summary: "Remove a saved place. Its MapPIN stops resolving immediately.",
    params: [{ name: "mappin", in: "path", type: "string", required: true, description: "6-character MapPIN" }],
    example: { path: { mappin: "KAE35N" } },
    response: { deleted: true },
  },
  {
    slug: "geofences-create",
    group: "Fleet",
    sku: "geofence.write",
    method: "POST",
    path: "/api/v1/geofences",
    title: "Create geofence",
    summary: "Polygon (GeoJSON) or circle (center + radius_m) around a hub, yard or customer site.",
    description: "Circles are stored as 64-point polygons, so every fence is returned as GeoJSON.",
    params: [
      { name: "name", in: "body", type: "string", required: true, description: "Display name" },
      { name: "geometry", in: "body", type: "GeoJSON", required: false, description: "Polygon or MultiPolygon ([lon, lat] rings)" },
      { name: "center", in: "body", type: "{lat, lon}", required: false, description: "Circle centre (instead of geometry)" },
      { name: "radius_m", in: "body", type: "number", required: false, description: "Circle radius in metres, up to 100000" },
      { name: "props", in: "body", type: "object", required: false, description: "Any JSON you want stored with the fence" },
    ],
    example: { body: { name: "Okhla hub", center: { lat: 28.5355, lon: 77.271 }, radius_m: 500 } },
    response: { geofence: FENCE },
  },
  {
    slug: "geofences-list",
    group: "Fleet",
    sku: "geofence.read",
    method: "GET",
    path: "/api/v1/geofences",
    title: "List geofences",
    summary: "All of your organisation's geofences (up to 5,000), newest first.",
    params: [],
    example: { query: {} },
    response: { geofences: [FENCE] },
  },
  {
    slug: "geofences-delete",
    group: "Fleet",
    sku: "geofence.write",
    method: "DELETE",
    path: "/api/v1/geofences/{id}",
    title: "Delete geofence",
    summary: "Remove a geofence by id.",
    params: [{ name: "id", in: "path", type: "string", required: true, description: "Geofence id, e.g. gf_7ad8…" }],
    example: { path: { id: "gf_7ad88486f2c440f682aa" } },
    response: { deleted: true },
  },
  {
    slug: "geofences-check",
    group: "Fleet",
    sku: "geofence.check",
    method: "POST",
    path: "/api/v1/geofences/check",
    title: "Geofence check",
    summary: "Which of your geofences contain each point? Up to 1,000 points per call, billed per point.",
    description: "Send the latest position of each vehicle; `inside` lists every fence that contains it (empty when outside all of them).",
    params: [{ name: "points", in: "body", type: "{id?, lat, lon}[]", required: true, description: "1–1000 positions; id is echoed back" }],
    example: { body: { points: [{ id: "truck-7", lat: 28.5357, lon: 77.2712 }] } },
    response: { results: [{ id: "truck-7", lat: 28.5357, lon: 77.2712, inside: [{ id: "gf_7ad88486f2c440f682aa", name: "Okhla hub" }] }] },
  },
  {
    slug: "status",
    group: "Platform",
    sku: null,
    method: "GET",
    path: "/api/v1/status",
    title: "Status",
    summary: "Engine health: every engine is ours (built-in or self-hosted); not_configured lists anything not set up yet. No key needed.",
    params: [],
    example: { query: {} },
    response: {
      ok: true,
      independent: true,
      third_party: [],
      not_configured: [],
      engines: {
        routing: { engine: "Valhalla", mode: "self-hosted", host: "127.0.0.1:8002", ok: true, status: 200, latency_ms: 4 },
        search: { engine: "HeisynMaps search index", mode: "built-in", ok: true, places: 412000, built_at: "2026-10-22T06:10:00.000Z" },
        tiles: { engine: "PMTiles", mode: "self-hosted", ok: true },
        fonts: { engine: "Map fonts", mode: "built-in", ok: true },
        pincodes: { engine: "India Post PIN codes", mode: "built-in", ok: true },
        optimizer: { engine: "VROOM", mode: "disabled", host: null },
        database: { engine: "SQLite", mode: "self-hosted", ok: true },
      },
    },
  },
];

// Older consumers read `query` / `body` as { name: description } maps.
for (const e of ENDPOINTS) {
  const pick = (where) => {
    const list = (e.params || []).filter((p) => p.in === where);
    return list.length ? Object.fromEntries(list.map((p) => [p.name, p.description])) : undefined;
  };
  e.query = pick("query");
  e.body = pick("body");
}

export const endpointBySlug = (slug) => ENDPOINTS.find((e) => e.slug === slug);
