/**
 * Top-down SVG vehicle silhouettes by GTFS route / vehicle type.
 * Front of vehicle faces up (bearing 0° = north).
 */

const BUS = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 64">
<rect x="2" y="4" width="36" height="56" rx="9" fill="${c}"/>
<rect x="6" y="6" width="28" height="14" rx="4" fill="rgba(255,255,255,.7)"/>
<rect x="6" y="44" width="28" height="14" rx="4" fill="rgba(255,255,255,.5)"/>
<rect x="2" y="22" width="7" height="9" rx="2" fill="rgba(255,255,255,.58)"/>
<rect x="2" y="33" width="7" height="9" rx="2" fill="rgba(255,255,255,.58)"/>
<rect x="31" y="22" width="7" height="9" rx="2" fill="rgba(255,255,255,.58)"/>
<rect x="31" y="33" width="7" height="9" rx="2" fill="rgba(255,255,255,.58)"/>
<rect x="14" y="6" width="12" height="52" rx="3" fill="rgba(0,0,0,.12)"/>
<circle cx="8" cy="58" r="3" fill="rgba(0,0,0,.35)"/>
<circle cx="32" cy="58" r="3" fill="rgba(0,0,0,.35)"/>
<rect x="2" y="4" width="36" height="56" rx="9" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="1.6"/>
</svg>`;

const MINIBUS = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 64">
<rect x="7" y="10" width="26" height="44" rx="10" fill="${c}"/>
<rect x="11" y="12" width="18" height="14" rx="4" fill="rgba(255,255,255,.72)"/>
<rect x="11" y="38" width="18" height="14" rx="4" fill="rgba(255,255,255,.48)"/>
<rect x="7" y="28" width="5" height="12" rx="2" fill="rgba(255,255,255,.55)"/>
<rect x="28" y="28" width="5" height="12" rx="2" fill="rgba(255,255,255,.55)"/>
<rect x="17" y="12" width="6" height="40" rx="2" fill="rgba(0,0,0,.1)"/>
<circle cx="12" cy="56" r="2.8" fill="rgba(0,0,0,.35)"/>
<circle cx="28" cy="56" r="2.8" fill="rgba(0,0,0,.35)"/>
<rect x="7" y="10" width="26" height="44" rx="10" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="1.6"/>
</svg>`;

const TROLLEYBUS = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 64">
<line x1="12" y1="0" x2="10" y2="8" stroke="#3d3d3d" stroke-width="2.8" stroke-linecap="round"/>
<line x1="28" y1="0" x2="30" y2="8" stroke="#3d3d3d" stroke-width="2.8" stroke-linecap="round"/>
<rect x="12" y="0" width="16" height="3" rx="1.5" fill="#5a5a5a"/>
<rect x="2" y="6" width="36" height="54" rx="9" fill="${c}"/>
<rect x="6" y="8" width="28" height="13" rx="4" fill="rgba(255,255,255,.7)"/>
<rect x="6" y="45" width="28" height="13" rx="4" fill="rgba(255,255,255,.5)"/>
<rect x="2" y="23" width="7" height="9" rx="2" fill="rgba(255,255,255,.58)"/>
<rect x="31" y="23" width="7" height="9" rx="2" fill="rgba(255,255,255,.58)"/>
<rect x="14" y="8" width="12" height="50" rx="3" fill="rgba(0,0,0,.12)"/>
<rect x="2" y="6" width="36" height="54" rx="9" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="1.6"/>
</svg>`;

const TRAM = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 64">
<rect x="9" y="2" width="22" height="58" rx="7" fill="${c}"/>
<rect x="12" y="4" width="16" height="10" rx="3" fill="rgba(255,255,255,.72)"/>
<rect x="12" y="50" width="16" height="8" rx="3" fill="rgba(255,255,255,.48)"/>
<rect x="9" y="16" width="4" height="6" rx="1.5" fill="rgba(255,255,255,.55)"/>
<rect x="9" y="25" width="4" height="6" rx="1.5" fill="rgba(255,255,255,.55)"/>
<rect x="9" y="34" width="4" height="6" rx="1.5" fill="rgba(255,255,255,.55)"/>
<rect x="27" y="16" width="4" height="6" rx="1.5" fill="rgba(255,255,255,.55)"/>
<rect x="27" y="25" width="4" height="6" rx="1.5" fill="rgba(255,255,255,.55)"/>
<rect x="27" y="34" width="4" height="6" rx="1.5" fill="rgba(255,255,255,.55)"/>
<rect x="0" y="13" width="40" height="3" rx="1" fill="rgba(0,0,0,.28)"/>
<rect x="0" y="48" width="40" height="3" rx="1" fill="rgba(0,0,0,.28)"/>
<rect x="17" y="4" width="6" height="54" rx="2" fill="rgba(0,0,0,.1)"/>
<rect x="9" y="2" width="22" height="58" rx="7" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="1.6"/>
</svg>`;

const METRO = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 64">
<rect x="5" y="8" width="30" height="48" rx="14" fill="${c}"/>
<rect x="9" y="10" width="22" height="12" rx="6" fill="rgba(255,255,255,.72)"/>
<rect x="9" y="42" width="22" height="12" rx="6" fill="rgba(255,255,255,.48)"/>
<rect x="5" y="24" width="6" height="16" rx="3" fill="rgba(255,255,255,.55)"/>
<rect x="29" y="24" width="6" height="16" rx="3" fill="rgba(255,255,255,.55)"/>
<rect x="5" y="8" width="30" height="48" rx="14" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="1.6"/>
</svg>`;

const RAIL = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 64">
<rect x="6" y="6" width="28" height="50" rx="8" fill="${c}"/>
<rect x="10" y="8" width="20" height="11" rx="4" fill="rgba(255,255,255,.7)"/>
<rect x="10" y="45" width="20" height="9" rx="3" fill="rgba(255,255,255,.48)"/>
<rect x="0" y="18" width="40" height="2.5" rx="1" fill="rgba(0,0,0,.3)"/>
<rect x="0" y="44" width="40" height="2.5" rx="1" fill="rgba(0,0,0,.3)"/>
<rect x="6" y="6" width="28" height="50" rx="8" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="1.6"/>
</svg>`;

const FERRY = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 64">
<path d="M20 3 C28 5 36 18 36 34 C36 50 29 61 20 61 C11 61 4 50 4 34 C4 18 12 5 20 3 Z" fill="${c}"/>
<rect x="12" y="27" width="16" height="14" rx="4" fill="rgba(255,255,255,.35)"/>
<rect x="14" y="29" width="12" height="7" rx="3" fill="rgba(255,255,255,.68)"/>
<path d="M17 11 L20 3 L23 11 Z" fill="rgba(255,255,255,.6)"/>
<path d="M20 3 C28 5 36 18 36 34 C36 50 29 61 20 61 C11 61 4 50 4 34 C4 18 12 5 20 3 Z" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="1.6"/>
</svg>`;

/** GTFS route_type (+ extended) → SVG builder */
export const SVG_BY_TYPE = {
  0: TRAM,
  1: METRO,
  2: RAIL,
  3: BUS,
  4: FERRY,
  5: TRAM,
  6: METRO,
  7: RAIL,
  11: TROLLEYBUS,
  200: MINIBUS,
};

/** Infer display icon type from route meta and optional vehicle record. */
export function resolveVehicleIconType(routeMeta, vehicle) {
  const vehicleType = parseInt(vehicle?.vehicleType ?? vehicle?.vehicle_type, 10);
  if (Number.isFinite(vehicleType) && SVG_BY_TYPE[vehicleType]) return vehicleType;

  const routeType = parseInt(routeMeta?.routeType ?? routeMeta?.route_type, 10);
  if (Number.isFinite(routeType) && SVG_BY_TYPE[routeType]) return routeType;

  return 3;
}

const _cache = new Map();

/** Data URI for a colored top-down vehicle icon. */
export function getVehicleIconUrl(routeType, color) {
  const key = `${routeType}|${color}`;
  if (_cache.has(key)) return _cache.get(key);
  const fn = SVG_BY_TYPE[routeType] ?? BUS;
  const url = `data:image/svg+xml,${encodeURIComponent(fn(color))}`;
  _cache.set(key, url);
  return url;
}

/** @deprecated use getVehicleIconUrl — kept for tests */
export function clearVehicleIconCache() {
  _cache.clear();
}