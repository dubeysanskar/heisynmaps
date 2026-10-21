// End-to-end check of the API against a running app:
//   npm run dev   (in another terminal)
//   npm run smoke [-- http://localhost:3000]
// Signs up a throwaway user, creates a server key, then calls every v1 endpoint.

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
let cookie = "";
let failures = 0;

async function call(method, path, { body, key, expect = [200, 201] } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "X-Api-Key": key } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = await res.json().catch(() => null);
  const ok = expect.includes(res.status);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${res.status} ${method} ${path}${ok ? "" : "  " + JSON.stringify(data)}`);
  return data;
}

const email = `smoke+${Date.now()}@example.test`;
await call("POST", "/api/auth/signup", { body: { email, password: "smoke-test-123", name: "Smoke" } });
const { key } = await call("POST", "/api/console/keys", { body: { name: "smoke", kind: "server" } });
const k = key.key;

await call("GET", "/api/v1/status");
await call("GET", "/api/v1/route", { expect: [405] });
await call("GET", "/api/v1/digipin?lat=28.6315&lon=77.2167", { key: "nk_sk_wrong", expect: [401] });

const style = await call("GET", "/api/v1/style?theme=logistics", { key: k });
console.log(`     style layers: ${style?.layers?.length}`);
const dp = await call("GET", "/api/v1/digipin?lat=13.11179621&lon=80.20264269", { key: k });
console.log(`     DIGIPIN ${dp?.digipin} (India Post example expects 4T396F42L7)`);
await call("GET", "/api/v1/digipin?code=4P3JK852C9", { key: k });

const ac = await call("GET", "/api/v1/autocomplete?q=connaught%20place", { key: k });
console.log(`     autocomplete top: ${ac?.results?.[0]?.label}`);
await call("GET", "/api/v1/geocode?q=sector%2018%20noida", { key: k });
const rev = await call("GET", "/api/v1/reverse?lat=28.4950&lon=77.0896", { key: k });
console.log(`     reverse: ${rev?.result?.label} · ${rev?.digipin}`);
const nb = await call("GET", "/api/v1/nearby?lat=28.6315&lon=77.2167&category=fuel", { key: k });
console.log(`     nearby fuel: ${nb?.results?.length} results`);

const CP = { lat: 28.6315, lon: 77.2167 };
const CYBER = { lat: 28.495, lon: 77.0896 };
const NOIDA = { lat: 28.5708, lon: 77.3261 };
const r = await call("POST", "/api/v1/route", {
  key: k,
  body: { locations: [CP, CYBER], profile: "truck", truck: { weight_t: 12, height_m: 3.8 }, alternatives: 1 },
});
const best = r?.routes?.[0];
console.log(`     truck CP→Cyber City: ${(best?.distance_m / 1000).toFixed(1)} km, ${Math.round(best?.duration_s / 60)} min, ${r?.routes?.length} route(s)`);
await call("POST", "/api/v1/route", { key: k, body: { locations: [CP, NOIDA], profile: "scooter" } });
const m = await call("POST", "/api/v1/matrix", { key: k, body: { sources: [CP, NOIDA], targets: [CYBER, NOIDA] } });
console.log(`     matrix durations: ${JSON.stringify(m?.durations)}`);
const iso = await call("POST", "/api/v1/isochrone", { key: k, body: { location: CP, minutes: [10, 20], profile: "bike" } });
console.log(`     isochrone features: ${iso?.features?.length}`);
const opt = await call("POST", "/api/v1/optimize", {
  key: k,
  body: { locations: [CP, CYBER, NOIDA, { lat: 28.5355, lon: 77.391 }], profile: "bike" },
});
console.log(`     optimised order: ${JSON.stringify(opt?.order)}`);
await call("POST", "/api/v1/snap", {
  key: k,
  body: {
    points: [
      { lat: 28.6304, lon: 77.2177 },
      { lat: 28.6312, lon: 77.2195 },
      { lat: 28.6326, lon: 77.2205 },
      { lat: 28.6339, lon: 77.2199 },
    ],
  },
});
await call("POST", "/api/v1/optimize", { key: k, body: { vehicles: [{ start: CP }], jobs: [NOIDA] }, expect: [200, 501] });

const place = await call("POST", "/api/v1/places", {
  key: k,
  body: { name: "Okhla DC-1", lat: 28.5355, lon: 77.271, category: "warehouse" },
});
const pin = place?.place?.mappin;
console.log(`     MapPIN: ${pin}`);
await call("GET", `/api/v1/places/${pin}`, { key: k });
const found = await call("GET", `/api/v1/geocode?q=${pin}`, { key: k });
console.log(`     geocode by MapPIN → ${found?.results?.[0]?.name}`);
await call("GET", "/api/v1/autocomplete?q=okhla%20dc", { key: k });

const fence = await call("POST", "/api/v1/geofences", {
  key: k,
  body: { name: "Okhla hub", center: { lat: 28.5355, lon: 77.271 }, radius_m: 500 },
});
const check = await call("POST", "/api/v1/geofences/check", {
  key: k,
  body: { points: [{ id: "truck-7", lat: 28.5357, lon: 77.2712 }, { id: "truck-9", lat: 28.6, lon: 77.2 }] },
});
console.log(`     geofence: truck-7 in ${check?.results?.[0]?.inside?.length}, truck-9 in ${check?.results?.[1]?.inside?.length}`);
await call("DELETE", `/api/v1/geofences/${fence?.geofence?.id}`, { key: k });
await call("DELETE", `/api/v1/places/${pin}`, { key: k });

// --- PIN codes (needs `npm run data:pincodes`; 503 means the data isn't loaded) ---
const pinProbe = await fetch(`${BASE}/api/v1/pincode/110001`, { headers: { "X-Api-Key": k } });
if (pinProbe.status === 503) {
  console.log("SKIP PIN code checks: data not loaded (run npm run data:pincodes)");
} else {
  const pinDetail = await call("GET", "/api/v1/pincode/110001", { key: k });
  console.log(`     PIN 110001: ${pinDetail?.district}, ${pinDetail?.state}, ${pinDetail?.post_offices?.length} post offices`);
  const pinAt = await call("GET", "/api/v1/pincode?lat=28.4950&lon=77.0896", { key: k });
  console.log(`     Cyber City is in PIN ${pinAt?.pincode} (${pinAt?.method})`);
  const pinPrefix = await call("GET", "/api/v1/pincode?q=2013&limit=3", { key: k });
  console.log(`     prefix 2013 → ${pinPrefix?.results?.map((r) => r.pincode).join(", ")}`);
  await call("GET", "/api/v1/pincode?q=lajpat%20nagar&limit=3", { key: k });
  await call("GET", "/api/v1/pincode/012345", { key: k, expect: [400] });
  await call("GET", "/api/v1/pincode/999999", { key: k, expect: [404] });
  const pinSearch = await call("GET", "/api/v1/geocode?q=110001", { key: k });
  const pinFirst = pinSearch?.results?.[0];
  const pinOk = pinFirst?.type === "pincode" && pinFirst?.pincode === "110001";
  if (!pinOk) failures++;
  console.log(`${pinOk ? "PASS" : "FAIL"} geocode "110001" returns the Indian PIN first (${pinFirst?.label})`);
  const withPin = await call("GET", "/api/v1/geocode?q=connaught%20place", { key: k });
  const hasPin = /^[1-9]\d{5}$/.test(withPin?.results?.[0]?.pincode || "");
  if (!hasPin) failures++;
  console.log(`${hasPin ? "PASS" : "FAIL"} geocode results carry a pincode (${withPin?.results?.[0]?.pincode})`);
}

// --- key restrictions ---
const limited = (
  await call("POST", "/api/console/keys", {
    body: { name: "limited", kind: "server", scopes: ["search"], dailyQuota: 2, rpmLimit: 50 },
  })
).key;
await call("GET", "/api/v1/digipin?lat=28.6&lon=77.2", { key: limited.key, expect: [403] }); // scope_denied
await call("GET", "/api/v1/geocode?q=noida", { key: limited.key });
await call("GET", "/api/v1/geocode?q=delhi", { key: limited.key });
await call("GET", "/api/v1/geocode?q=gurugram", { key: limited.key, expect: [429] }); // daily quota
const ipKey = (await call("POST", "/api/console/keys", { body: { name: "ip", kind: "server", allowedIps: "203.0.113.7" } })).key;
await call("GET", "/api/v1/digipin?lat=28.6&lon=77.2", { key: ipKey.key, expect: [403] }); // ip_not_allowed
const web = (
  await call("POST", "/api/console/keys", { body: { name: "web", kind: "browser", allowedOrigins: "https://app.example.com" } })
).key;
const okOrigin = await fetch(`${BASE}/api/v1/digipin?lat=28.6&lon=77.2&key=${web.key}`, { headers: { Origin: "https://app.example.com" } });
const badOrigin = await fetch(`${BASE}/api/v1/digipin?lat=28.6&lon=77.2&key=${web.key}`, { headers: { Origin: "https://evil.example" } });
const originOk = okOrigin.status === 200 && badOrigin.status === 403;
if (!originOk) failures++;
console.log(`${originOk ? "PASS" : "FAIL"} browser key origin check (${okOrigin.status} allowed / ${badOrigin.status} other site)`);
await call("PATCH", `/api/console/keys/${ipKey.id}`, { body: { disabled: true } });
await call("GET", "/api/v1/digipin?lat=28.6&lon=77.2", { key: ipKey.key, expect: [403] }); // key_disabled
const rotated = (await call("POST", `/api/console/keys/${web.id}/rotate`)).key;
const oldGone = await fetch(`${BASE}/api/v1/digipin?lat=28.6&lon=77.2&key=${web.key}`, { headers: { Origin: "https://app.example.com" } });
const newWorks = await fetch(`${BASE}/api/v1/digipin?lat=28.6&lon=77.2&key=${rotated.key}`, { headers: { Origin: "https://app.example.com" } });
const rotateOk = oldGone.status === 401 && newWorks.status === 200;
if (!rotateOk) failures++;
console.log(`${rotateOk ? "PASS" : "FAIL"} rotation (old ${oldGone.status}, new ${newWorks.status})`);
for (const id of [limited.id, ipKey.id, web.id]) await call("DELETE", `/api/console/keys/${id}`);

// --- console session (playground) auth ---
const pg = await fetch(`${BASE}/api/v1/digipin?lat=28.6&lon=77.2`, { headers: { Cookie: cookie, "X-Naksha-Console": "1" } });
if (pg.status !== 200) failures++;
console.log(`${pg.status === 200 ? "PASS" : "FAIL"} ${pg.status} playground call with session`);

await new Promise((r) => setTimeout(r, 2500)); // let buffered metering flush
const usage = await call("GET", "/api/console/usage");
console.log(`     metered SKUs this month: ${usage?.monthToDate?.length}`);
const logs = await call("GET", "/api/console/logs?status=4xx&limit=20");
console.log(`     4xx requests logged: ${logs?.rows?.length}`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
