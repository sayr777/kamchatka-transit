/**
 * Live vehicle markers — transit-app style (Google Maps / Yandex / Citymapper).
 * Rounded capsule with directional nose; front faces up (bearing 0° = north).
 */

const STROKE = 'rgba(255,255,255,.96)';
const SW = 2.4;
const GLASS = 'rgba(255,255,255,.82)';
const GLASS_SOFT = 'rgba(255,255,255,.55)';
const SHADE = 'rgba(0,0,0,.16)';
const ACCENT = 'rgba(0,0,0,.28)';

function wrap(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${inner}</svg>`;
}

/** Shared directional capsule — pointed nose at top. */
function capsule(color, opts = {}) {
  const {
    x = 11, w = 26, y = 11, h = 32, rx = 11,
    nose = true, mirror = true, axle = true,
    extra = '',
  } = opts;
  const cx = x + w / 2;
  const noseY = y - 1;
  const parts = [
    extra,
    `<ellipse cx="${cx}" cy="44.5" rx="${w * 0.34}" ry="2.2" fill="rgba(0,0,0,.22)"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}"/>`,
    nose
      ? `<path d="M${cx} ${noseY - 5} L${cx + 7} ${y + 5} L${cx - 7} ${y + 5} Z" fill="${GLASS}"/>`
      : '',
    `<rect x="${x + 4}" y="${y + 3}" width="${w - 8}" height="${h * 0.28}" rx="5" fill="${GLASS_SOFT}"/>`,
    mirror
      ? `<circle cx="${x - 1.5}" cy="${y + h * 0.42}" r="2.4" fill="${GLASS_SOFT}" stroke="${STROKE}" stroke-width="1"/>`
        + `<circle cx="${x + w + 1.5}" cy="${y + h * 0.42}" r="2.4" fill="${GLASS_SOFT}" stroke="${STROKE}" stroke-width="1"/>`
      : '',
    axle
      ? `<circle cx="${x + 5}" cy="${y + h - 2}" r="2.5" fill="${ACCENT}"/>`
        + `<circle cx="${x + w - 5}" cy="${y + h - 2}" r="2.5" fill="${ACCENT}"/>`
      : '',
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>`,
    nose
      ? `<path d="M${cx} ${noseY - 5} L${cx + 7} ${y + 5} L${cx - 7} ${y + 5} Z" fill="none" stroke="${STROKE}" stroke-width="1.4" stroke-linejoin="round"/>`
      : '',
  ];
  return wrap(parts.join(''));
}

const BUS = (c) => capsule(c, { x: 9, w: 30, y: 10, h: 33, rx: 12 });

const MINIBUS = (c) => capsule(c, {
  x: 13, w: 22, y: 13, h: 27, rx: 10, mirror: false,
});

const TROLLEYBUS = (c) => capsule(c, {
  x: 9, w: 30, y: 14, h: 30, rx: 12,
  extra: [
    '<line x1="17" y1="14" x2="14" y2="2" stroke="#484848" stroke-width="2.6" stroke-linecap="round"/>',
    '<line x1="31" y1="14" x2="34" y2="2" stroke="#484848" stroke-width="2.6" stroke-linecap="round"/>',
    '<rect x="15" y="1" width="18" height="3.5" rx="1.8" fill="#666"/>',
    '<line x1="17" y1="14" x2="14" y2="2" stroke="rgba(255,255,255,.5)" stroke-width="1" stroke-linecap="round"/>',
    '<line x1="31" y1="14" x2="34" y2="2" stroke="rgba(255,255,255,.5)" stroke-width="1" stroke-linecap="round"/>',
  ].join(''),
});

const TRAM = (c) => wrap([
  '<rect x="1" y="20" width="46" height="3" rx="1.5" fill="rgba(0,0,0,.32)"/>',
  '<rect x="1" y="36" width="46" height="3" rx="1.5" fill="rgba(0,0,0,.32)"/>',
  `<rect x="14" y="8" width="20" height="34" rx="8" fill="${c}"/>`,
  `<path d="M24 3 L30 11 L18 11 Z" fill="${GLASS}"/>`,
  `<rect x="17" y="11" width="14" height="9" rx="4" fill="${GLASS_SOFT}"/>`,
  `<rect x="17" y="30" width="14" height="8" rx="3" fill="${SHADE}"/>`,
  '<rect x="12" y="14" width="3.5" height="7" rx="1.5" fill="rgba(255,255,255,.5)"/>',
  '<rect x="12" y="24" width="3.5" height="7" rx="1.5" fill="rgba(255,255,255,.5)"/>',
  '<rect x="32.5" y="14" width="3.5" height="7" rx="1.5" fill="rgba(255,255,255,.5)"/>',
  '<rect x="32.5" y="24" width="3.5" height="7" rx="1.5" fill="rgba(255,255,255,.5)"/>',
  '<line x1="24" y1="4" x2="24" y2="1.5" stroke="#555" stroke-width="2.2" stroke-linecap="round"/>',
  `<rect x="14" y="8" width="20" height="34" rx="8" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>`,
  `<path d="M24 3 L30 11 L18 11 Z" fill="none" stroke="${STROKE}" stroke-width="1.4" stroke-linejoin="round"/>`,
].join(''));

const METRO = (c) => wrap([
  `<ellipse cx="24" cy="44" rx="14" ry="2.2" fill="rgba(0,0,0,.2)"/>`,
  `<rect x="8" y="12" width="32" height="30" rx="15" fill="${c}"/>`,
  `<rect x="12" y="14" width="24" height="12" rx="8" fill="${GLASS}"/>`,
  `<rect x="12" y="30" width="24" height="9" rx="5" fill="${GLASS_SOFT}"/>`,
  '<rect x="8" y="24" width="5" height="12" rx="2.5" fill="rgba(255,255,255,.45)"/>',
  '<rect x="35" y="24" width="5" height="12" rx="2.5" fill="rgba(255,255,255,.45)"/>',
  `<rect x="8" y="12" width="32" height="30" rx="15" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>`,
].join(''));

const RAIL = (c) => wrap([
  '<rect x="0" y="18" width="48" height="2.5" rx="1.2" fill="rgba(0,0,0,.3)"/>',
  '<rect x="0" y="34" width="48" height="2.5" rx="1.2" fill="rgba(0,0,0,.3)"/>',
  `<rect x="10" y="9" width="28" height="32" rx="9" fill="${c}"/>`,
  `<path d="M24 4 L30 12 L18 12 Z" fill="${GLASS}"/>`,
  `<rect x="14" y="12" width="20" height="10" rx="4" fill="${GLASS_SOFT}"/>`,
  `<rect x="14" y="28" width="20" height="9" rx="3" fill="${SHADE}"/>`,
  `<rect x="10" y="9" width="28" height="32" rx="9" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>`,
  `<path d="M24 4 L30 12 L18 12 Z" fill="none" stroke="${STROKE}" stroke-width="1.4" stroke-linejoin="round"/>`,
].join(''));

const FERRY = (c) => wrap([
  `<path d="M24 4 L38 16 L36 40 C36 40 30 44 24 44 C18 44 12 40 12 40 L10 16 Z" fill="${c}"/>`,
  `<rect x="16" y="22" width="16" height="12" rx="4" fill="${GLASS_SOFT}"/>`,
  `<rect x="18" y="24" width="12" height="6" rx="3" fill="${GLASS}"/>`,
  '<path d="M20 14 L24 6 L28 14 Z" fill="rgba(255,255,255,.65)"/>',
  `<path d="M24 4 L38 16 L36 40 C36 40 30 44 24 44 C18 44 12 40 12 40 L10 16 Z" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`,
].join(''));

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