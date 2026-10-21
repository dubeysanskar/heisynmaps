export function formatDuration(seconds) {
  if (seconds == null) return "—";
  const min = Math.round(seconds / 60);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatDistance(metres) {
  if (metres == null) return "—";
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 1 : 0)} km`;
}

export function formatDigipin(code) {
  return code ? `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6)}` : "";
}

export function boundsOf(coordinates) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of coordinates) {
    b[0] = Math.min(b[0], lon);
    b[1] = Math.min(b[1], lat);
    b[2] = Math.max(b[2], lon);
    b[3] = Math.max(b[3], lat);
  }
  return [
    [b[0], b[1]],
    [b[2], b[3]],
  ];
}

export const featureCollection = (features = []) => ({ type: "FeatureCollection", features });
