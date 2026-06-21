/** Азимут по приращению lon/lat в градусах [0, 360), 0° = север */
export function bearingFromDelta(dLon, dLat) {
  if (!dLon && !dLat) return null;
  return (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
}

/** Азимут между двумя точками [lon, lat] */
export function bearingBetween(from, to) {
  if (!from || !to) return 0;
  return bearingFromDelta(to[0] - from[0], to[1] - from[1]) ?? 0;
}