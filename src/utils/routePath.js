import { bearingFromDelta } from './bearing';

export function shapePointsToPath(points) {
  if (!points?.length) return [];
  return points.map((p) => ({
    lon: parseFloat(p.shape_pt_lon ?? p.lon ?? p[0]),
    lat: parseFloat(p.shape_pt_lat ?? p.lat ?? p[1]),
  })).filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
}

/** Sample position and bearing along a polyline; t wraps 0..1. */
export function samplePath(path, t) {
  if (!path?.length) return null;
  if (path.length === 1) {
    return { lon: path[0].lon, lat: path[0].lat, bearing: 0 };
  }

  const segLens = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dLon = b.lon - a.lon;
    const dLat = b.lat - a.lat;
    const len = Math.hypot(dLon, dLat);
    segLens.push({ len, dLon, dLat, a, b });
    total += len;
  }
  if (total <= 0) {
    return { lon: path[0].lon, lat: path[0].lat, bearing: 0 };
  }

  let dist = ((t % 1) + 1) % 1 * total;
  for (const seg of segLens) {
    if (dist > seg.len) {
      dist -= seg.len;
      continue;
    }
    const frac = seg.len > 0 ? dist / seg.len : 0;
    return {
      lon: seg.a.lon + seg.dLon * frac,
      lat: seg.a.lat + seg.dLat * frac,
      bearing: bearingFromDelta(seg.dLon, seg.dLat) ?? 0,
    };
  }

  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  return {
    lon: last.lon,
    lat: last.lat,
    bearing: bearingFromDelta(last.lon - prev.lon, last.lat - prev.lat) ?? 0,
  };
}

function flipBearing(bearing) {
  return (bearing + 180) % 360;
}

function alignBearingToHint(bearing, hintBearing) {
  if (!Number.isFinite(hintBearing)) return bearing;
  const diff = ((bearing - hintBearing + 540) % 360) - 180;
  return Math.abs(diff) > 90 ? flipBearing(bearing) : bearing;
}

/** Bearing of the nearest route segment at (lon, lat); hint picks travel direction. */
export function bearingOnPath(path, lon, lat, hintBearing) {
  if (!path?.length || path.length < 2) return hintBearing ?? 0;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return hintBearing ?? 0;

  let bestDist2 = Infinity;
  let bestBearing = hintBearing ?? 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dLon = b.lon - a.lon;
    const dLat = b.lat - a.lat;
    const segLen2 = dLon * dLon + dLat * dLat;
    if (segLen2 <= 0) continue;

    const t = Math.max(0, Math.min(1, ((lon - a.lon) * dLon + (lat - a.lat) * dLat) / segLen2));
    const px = a.lon + dLon * t;
    const py = a.lat + dLat * t;
    const dist2 = (lon - px) ** 2 + (lat - py) ** 2;
    if (dist2 >= bestDist2) continue;

    bestDist2 = dist2;
    bestBearing = alignBearingToHint(bearingFromDelta(dLon, dLat) ?? 0, hintBearing);
  }

  return bestBearing;
}