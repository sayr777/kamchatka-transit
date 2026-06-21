import { haversineMeters } from './geo';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_MINS = 24 * 60;

export function toGtfsDate(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function parseTimeMin(time) {
  if (!time) return 0;
  const [h, m] = String(time).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatClock(mins) {
  const wrapped = ((mins % DAY_MINS) + DAY_MINS) % DAY_MINS;
  const h = Math.floor(wrapped / 60) % 24;
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function minsUntil(targetMin, nowMin) {
  let diff = targetMin - nowMin;
  if (diff < 0) diff += DAY_MINS;
  return diff;
}

export function getActiveServiceIds(gtfsDate, calendarByServiceId) {
  const y = parseInt(gtfsDate.slice(0, 4), 10);
  const m = parseInt(gtfsDate.slice(4, 6), 10) - 1;
  const d = parseInt(gtfsDate.slice(6, 8), 10);
  const day = DAY_KEYS[new Date(y, m, d).getDay()];
  const set = new Set();
  const cal = calendarByServiceId instanceof Map
    ? calendarByServiceId
    : new Map(Object.entries(calendarByServiceId || {}));
  for (const [sid, row] of cal) {
    if (row[day] === '1' && gtfsDate >= row.start_date && gtfsDate <= row.end_date) {
      set.add(sid);
    }
  }
  return set;
}

function isTripActive(tripId, activeServices, tripToService) {
  const sid = tripToService?.get?.(tripId) ?? tripToService?.[tripId];
  return !sid || activeServices.has(sid);
}

function tripOffsetMin(stopDepMin, tripStartMin) {
  return ((stopDepMin - tripStartMin) % DAY_MINS + DAY_MINS) % DAY_MINS;
}

/** Signed difference predicted − scheduled (minutes), handles midnight wrap. */
export function signedDelayMin(predictedMin, scheduledMin) {
  let diff = predictedMin - scheduledMin;
  if (diff > DAY_MINS / 2) diff -= DAY_MINS;
  if (diff < -DAY_MINS / 2) diff += DAY_MINS;
  return diff;
}

/** OTP-style delay bucket: slight delay, late, or early. */
export function classifyDelayStatus(delayMin) {
  const d = Math.round(delayMin || 0);
  if (d >= 5) return { status: 'late', minutes: d };
  if (d >= 2) return { status: 'delayed', minutes: d };
  if (d <= -2) return { status: 'early', minutes: Math.abs(d) };
  return null;
}

export function attachDelayToRealtime(dep, scheduledDep) {
  if (!dep?.isRealtime || !scheduledDep || scheduledDep.isRealtime) return dep;
  const delayMin = dep.minutesAway - scheduledDep.minutesAway;
  const bucket = classifyDelayStatus(delayMin);
  return {
    ...dep,
    scheduledMins: scheduledDep.mins,
    scheduledClock: scheduledDep.clock || formatClock(scheduledDep.mins),
    delayMin,
    delayStatus: bucket?.status ?? null,
    delayMinutes: bucket?.minutes ?? null,
  };
}

export function scheduledSlotMins(dep) {
  return dep?.scheduledMins ?? dep?.mins ?? 0;
}

export function groupStableKey(group) {
  return `${group.routeId}|${group.directionId ?? ''}|${group.headsign ?? ''}`;
}

export function departureSlotKey(group, dep) {
  return `${groupStableKey(group)}|${dep.tripId ?? ''}|${scheduledSlotMins(dep)}`;
}

/** Update countdowns and delays without reordering rows frozen at open. */
export function refreshStopBoardLive(frozen, fresh, nowMin) {
  if (!frozen?.groups?.length) return fresh;

  const freshMap = new Map();
  for (const g of fresh.groups || []) {
    for (const d of g.departures || []) {
      freshMap.set(departureSlotKey(g, d), d);
    }
  }

  const groups = frozen.groups.map((g) => ({
    ...g,
    departures: g.departures.map((d, i) => {
      const slot = scheduledSlotMins(d);
      const key = departureSlotKey(g, { ...d, mins: slot, scheduledMins: slot });
      const live = freshMap.get(key);
      const scheduledClock = d.scheduledClock || formatClock(slot);

      if (live) {
        return {
          ...d,
          scheduledMins: slot,
          scheduledClock: live.scheduledClock || scheduledClock,
          minutesAway: live.minutesAway,
          clock: live.clock,
          isRealtime: live.isRealtime,
          delayStatus: live.delayStatus ?? null,
          delayMinutes: live.delayMinutes ?? null,
          vehicleId: live.vehicleId ?? null,
          isNext: i === 0,
        };
      }

      return {
        ...d,
        scheduledMins: slot,
        scheduledClock,
        minutesAway: minsUntil(slot, nowMin),
        clock: formatClock(slot),
        isRealtime: false,
        delayStatus: null,
        delayMinutes: null,
        vehicleId: null,
        isNext: i === 0,
      };
    }),
  }));

  return {
    ...frozen,
    noService: fresh.noService,
    isEmpty: groups.length === 0,
    groups,
  };
}

function findGroupKeyForVehicle(groups, routeId, tripId, metaMap) {
  if (tripId) {
    const tripMeta = metaMap?.get?.(tripId);
    if (tripMeta) {
      const exact = `${routeId}|${tripMeta.direction_id || ''}|${tripMeta.trip_headsign || ''}`;
      if (groups.has(exact)) return exact;
    }
    for (const [key, group] of groups) {
      if (!key.startsWith(`${routeId}|`)) continue;
      if (group.departures?.some((d) => d.tripId === tripId)) return key;
    }
  }
  return [...groups.keys()].find((k) => k.startsWith(`${routeId}|`)) ?? null;
}

function findNearestScheduledDeparture(candidates, minutesAway, tripId) {
  let pool = (candidates || []).filter((d) => !d.isRealtime);
  if (!pool.length) return null;
  if (tripId) {
    const sameTrip = pool.filter((d) => d.tripId === tripId);
    if (sameTrip.length) pool = sameTrip;
  }

  let best = null;
  let bestGap = Infinity;
  for (const dep of pool) {
    const gap = Math.abs((dep.minutesAway ?? 0) - minutesAway);
    if (gap <= 45 && gap < bestGap) {
      bestGap = gap;
      best = dep;
    }
  }
  return best;
}

function dedupeDepartures(list, mergeWindowMin = 2) {
  const sorted = [...list].sort((a, b) => a.mins - b.mins);
  const out = [];
  for (const dep of sorted) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(dep.mins - prev.mins) <= mergeWindowMin) {
      if (dep.isRealtime && !prev.isRealtime) {
        out[out.length - 1] = attachDelayToRealtime(dep, prev);
      }
      continue;
    }
    out.push(dep);
  }
  return out;
}

/** Expand GTFS frequencies (exact_times=0) into stop departures. */
export function expandFrequencyDepartures(stopDepMin, tripStartMin, freqRows, nowMin, limit = 24) {
  if (!freqRows?.length || tripStartMin == null) return [];
  const offset = tripOffsetMin(stopDepMin, tripStartMin);
  const out = [];

  for (const row of freqRows) {
    if (String(row.exactTimes) === '1') continue;
    const headwayMin = (row.headwaySec || 0) / 60;
    if (headwayMin <= 0) continue;

    const windowStart = row.startMin + offset;
    const windowEnd = row.endMin + offset;
    let t = windowStart;
    let guard = 0;
    while (t < nowMin - 0.5 && guard++ < 2000) t += headwayMin;

    guard = 0;
    while (t <= windowEnd + 0.5 && out.length < limit && guard++ < 2000) {
      if (t >= nowMin - 0.5) {
        out.push({
          mins: ((t % DAY_MINS) + DAY_MINS) % DAY_MINS,
          headwaySec: row.headwaySec,
          windowEndMin: row.endMin,
          isFrequency: true,
        });
      }
      t += headwayMin;
    }
  }

  return dedupeDepartures(out.map((d) => ({ ...d, isRealtime: false })));
}

function detectInterval(departures) {
  if (departures.length < 4) return null;
  const gaps = [];
  for (let i = 1; i < Math.min(departures.length, 8); i++) {
    let gap = departures[i].mins - departures[i - 1].mins;
    if (gap < 0) gap += DAY_MINS;
    if (gap > 0 && gap < 120) gaps.push(gap);
  }
  if (gaps.length < 3) return null;
  gaps.sort((a, b) => a - b);
  const headwayMin = Math.round(gaps[Math.floor(gaps.length / 2)]);
  const untilMin = departures[0].windowEndMin ?? departures[departures.length - 1].mins;
  return { headwayMin, untilMin };
}

/** GTFS frequencies.txt interval for a stop (exact_times=0). */
function getFrequencyInterval(freqRows, stopDepMin, tripStartMin, nowMin) {
  if (!freqRows?.length || tripStartMin == null) return null;
  const offset = tripOffsetMin(stopDepMin, tripStartMin);
  let best = null;

  for (const row of freqRows) {
    if (String(row.exactTimes) === '1') continue;
    const headwayMin = (row.headwaySec || 0) / 60;
    if (headwayMin <= 0) continue;

    const windowStart = row.startMin + offset;
    const windowEnd = row.endMin + offset;
    const wrappedNow = ((nowMin % DAY_MINS) + DAY_MINS) % DAY_MINS;
    const inWindow = wrappedNow >= windowStart - 0.5 && wrappedNow <= windowEnd + 0.5;
    if (!inWindow && !(windowEnd < windowStart && (wrappedNow >= windowStart || wrappedNow <= windowEnd))) {
      continue;
    }

    const untilMin = ((row.endMin + offset) % DAY_MINS + DAY_MINS) % DAY_MINS;
    const candidate = { headwayMin: Math.round(headwayMin), untilMin };
    if (!best || candidate.headwayMin < best.headwayMin) best = candidate;
  }

  return best;
}

export function estimateVehicleEtaMinutes(vehicle, stop) {
  if (!vehicle || !stop) return null;
  const lat = parseFloat(stop.stop_lat ?? stop.lat);
  const lon = parseFloat(stop.stop_lon ?? stop.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const dist = haversineMeters(vehicle.lat, vehicle.lon, lat, lon);
  const speedKmh = vehicle.speed > 3 ? vehicle.speed : 22;
  const speedMps = (speedKmh * 1000) / 3600;
  const min = Math.max(0, Math.round((dist / speedMps) / 60));
  if (min > 120 || dist > 25000) return null;
  return min;
}

/**
 * Build OTP-style departure board grouped by route + direction.
 */
export function buildStopDepartureBoard({
  stop,
  arrivals = [],
  frequenciesByTripId,
  tripFirstDepMinByTripId,
  tripMetaById,
  tripToService,
  tripToRoute,
  calendarByServiceId,
  routeMetaById,
  vehicles = [],
  stopRouteIds = [],
  gtfsDate,
  nowMin,
  horizonMin = 180,
  maxPerGroup = 4,
}) {
  const serveRoutes = new Set(
    Array.isArray(stopRouteIds) ? stopRouteIds : [...(stopRouteIds || [])],
  );
  const activeServices = getActiveServiceIds(gtfsDate, calendarByServiceId);
  const freqMap = frequenciesByTripId instanceof Map
    ? frequenciesByTripId
    : new Map(Object.entries(frequenciesByTripId || {}));
  const tripStartMap = tripFirstDepMinByTripId instanceof Map
    ? tripFirstDepMinByTripId
    : new Map(Object.entries(tripFirstDepMinByTripId || {}));
  const metaMap = tripMetaById instanceof Map
    ? tripMetaById
    : new Map(Object.entries(tripMetaById || {}));

  const tripStops = new Map();
  for (const a of arrivals) {
    if (!tripStops.has(a.tripId)) tripStops.set(a.tripId, a);
  }

  const groups = new Map();

  for (const [tripId, template] of tripStops) {
    if (!isTripActive(tripId, activeServices, tripToService)) continue;

    const routeId = template.routeId || tripToRoute?.get?.(tripId);
    if (!routeId) continue;

    const tripMeta = metaMap.get(tripId) || {};
    const groupKey = `${routeId}|${tripMeta.direction_id || ''}|${tripMeta.trip_headsign || ''}`;
    const freqRows = freqMap.get(tripId);
    const tripStart = tripStartMap.get(tripId);
    const hasFrequency = freqRows?.some((r) => String(r.exactTimes) !== '1') && tripStart != null;

    if (!groups.has(groupKey)) {
      const routeMeta = routeMetaById?.get?.(routeId);
      groups.set(groupKey, {
        routeId,
        routeShort: template.routeShort || routeMeta?.shortName || routeId,
        routeColor: routeMeta?.hex || '#2563eb',
        headsign: tripMeta.trip_headsign || routeMeta?.name || '',
        directionId: tripMeta.direction_id || '',
        scheduleMode: hasFrequency ? 'frequency' : 'scheduled',
        interval: hasFrequency
          ? getFrequencyInterval(freqRows, template.mins, tripStart, nowMin)
          : null,
        departures: [],
      });
    } else if (hasFrequency) {
      const group = groups.get(groupKey);
      group.scheduleMode = 'frequency';
      if (!group.interval) {
        group.interval = getFrequencyInterval(freqRows, template.mins, tripStart, nowMin);
      }
    }

    let deps = [];

    if (hasFrequency) {
      deps = expandFrequencyDepartures(template.mins, tripStart, freqRows, nowMin, 32);
    } else {
      deps = arrivals
        .filter((a) => a.tripId === tripId)
        .map((a) => ({ mins: a.mins, isFrequency: false, isRealtime: false }));
    }

    for (const dep of deps) {
      if (minsUntil(dep.mins, nowMin) > horizonMin) continue;
      groups.get(groupKey).departures.push({
        ...dep,
        tripId,
        clock: formatClock(dep.mins),
        minutesAway: minsUntil(dep.mins, nowMin),
      });
    }
  }

  const stopLat = parseFloat(stop?.stop_lat ?? stop?.lat);
  const stopLon = parseFloat(stop?.stop_lon ?? stop?.lon);
  const stopPoint = Number.isFinite(stopLat) && Number.isFinite(stopLon)
    ? { stop_lat: stopLat, stop_lon: stopLon }
    : null;

  for (const v of vehicles) {
    if (!v.routeId || !stopPoint) continue;
    if (serveRoutes.size && !serveRoutes.has(v.routeId)) continue;
    const eta = estimateVehicleEtaMinutes(v, stopPoint);
    if (eta == null) continue;

    const groupKey = findGroupKeyForVehicle(groups, v.routeId, v.tripId, metaMap);
    if (!groupKey) continue;
    const key = groupKey;

    const mins = ((nowMin + eta) % DAY_MINS + DAY_MINS) % DAY_MINS;
    const scheduledMatch = findNearestScheduledDeparture(
      groups.get(key).departures,
      eta,
      v.tripId,
    );
    const rtDep = attachDelayToRealtime({
      mins,
      clock: formatClock(mins),
      minutesAway: eta,
      isRealtime: true,
      isFrequency: false,
      vehicleId: v.id,
      tripId: v.tripId || null,
    }, scheduledMatch);
    groups.get(key).departures.push(rtDep);
  }

  const result = [];
  for (const group of groups.values()) {
    const limit = group.scheduleMode === 'frequency' && group.interval ? 2 : maxPerGroup;
    group.departures = dedupeDepartures(group.departures)
      .map((dep) => {
        const slot = scheduledSlotMins(dep);
        return {
          ...dep,
          scheduledMins: slot,
          scheduledClock: dep.scheduledClock || formatClock(slot),
        };
      })
      .sort((a, b) => scheduledSlotMins(a) - scheduledSlotMins(b))
      .slice(0, limit);

    if (!group.departures.length) continue;

    if (!group.interval) {
      group.interval = detectInterval(group.departures);
    }
    group.departures = group.departures.map((dep, i) => ({
      ...dep,
      isNext: i === 0,
    }));
    result.push(group);
  }

  result.sort((a, b) => {
    const routeCmp = String(a.routeShort).localeCompare(String(b.routeShort), undefined, { numeric: true });
    if (routeCmp !== 0) return routeCmp;
    return String(a.headsign).localeCompare(String(b.headsign));
  });

  const hadTrips = tripStops.size > 0;
  const activeTripCount = [...tripStops.keys()].filter((id) => isTripActive(id, activeServices, tripToService)).length;

  return {
    groups: result,
    noService: hadTrips && activeTripCount === 0,
    isEmpty: result.length === 0,
  };
}

export function formatDelayStatusLabel(status, minutes, lang = 'ru') {
  const n = Math.max(1, Math.round(minutes || 0));
  if (status === 'late') {
    if (lang === 'en') return n > 1 ? `late · +${n} min` : 'late';
    if (lang === 'zh') return n > 1 ? `晚点 · +${n} 分` : '晚点';
    if (lang === 'ja') return n > 1 ? `遅延 · +${n} 分` : '遅延';
    return n > 1 ? `опаздывает · +${n} мин` : 'опаздывает';
  }
  if (status === 'delayed') {
    if (lang === 'en') return n > 1 ? `delayed · +${n} min` : 'delayed';
    if (lang === 'zh') return n > 1 ? `延误 · +${n} 分` : '延误';
    if (lang === 'ja') return n > 1 ? `遅れ · +${n} 分` : '遅れ';
    return n > 1 ? `задерживается · +${n} мин` : 'задерживается';
  }
  if (status === 'early') {
    if (lang === 'en') return n > 1 ? `early · −${n} min` : 'early';
    if (lang === 'zh') return n > 1 ? `提前 · −${n} 分` : '提前';
    if (lang === 'ja') return n > 1 ? `早着 · −${n} 分` : '早着';
    return n > 1 ? `опережает · −${n} мин` : 'опережает';
  }
  return '';
}

export function formatDepartureCountdown(minutesAway, lang = 'ru') {
  const rounded = Math.max(0, Math.round(minutesAway || 0));
  if (rounded <= 0) {
    if (lang === 'en') return 'now';
    if (lang === 'zh') return '即将到站';
    if (lang === 'ja') return 'まもなく';
    return 'сейчас';
  }
  if (lang === 'en') return `${rounded} min`;
  if (lang === 'zh' || lang === 'ja') return `${rounded} 分`;
  if (rounded === 1) return '1 мин';
  if (rounded < 5) return `${rounded} мин`;
  return `${rounded} мин`;
}