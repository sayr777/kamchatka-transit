/**
 * Тесты карточки остановки: табло, маршруты, GTFS-интеграция.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildStopDepartureBoard,
  parseTimeMin,
  getActiveServiceIds,
} from '../../src/utils/stopDepartures.js';
import { getRouteIdsForStop } from '../../src/utils/stopFocus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_DIR = path.resolve(__dirname, '../../public/gtfs');

const WEEKDAY_CAL = {
  monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
  friday: '1', saturday: '1', sunday: '1',
  start_date: '20200101', end_date: '20991231',
};

function parseCsvLine(line) {
  const values = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let val = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i++]; }
      }
      values.push(val);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { values.push(line.slice(i)); break; }
      values.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return values;
}

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (values[idx] ?? '').trim(); });
    return obj;
  });
}

function sortRouteIds(routeIds, routeMetaById) {
  return [...routeIds].sort((a, b) => String(routeMetaById.get(a)?.shortName || a)
    .localeCompare(String(routeMetaById.get(b)?.shortName || b), undefined, { numeric: true }));
}

function buildFixture(overrides = {}) {
  const base = {
    stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
    arrivals: [],
    frequenciesByTripId: new Map(),
    tripFirstDepMinByTripId: new Map(),
    tripMetaById: new Map(),
    tripToService: new Map(),
    tripToRoute: new Map(),
    calendarByServiceId: new Map([['svc1', WEEKDAY_CAL]]),
    routeMetaById: new Map(),
    vehicles: [],
    stopRouteIds: [],
    gtfsDate: '20260621',
    nowMin: 10 * 60,
  };
  return { ...base, ...overrides };
}

function buildBoardFromGtfs(stopId, nowMin = 10 * 60, gtfsDate = '20260621') {
  const stops = parseCsv(path.join(GTFS_DIR, 'stops.txt'));
  const routes = parseCsv(path.join(GTFS_DIR, 'routes.txt'));
  const trips = parseCsv(path.join(GTFS_DIR, 'trips.txt'));
  const stopTimes = parseCsv(path.join(GTFS_DIR, 'stop_times.txt'));
  const calendar = parseCsv(path.join(GTFS_DIR, 'calendar.txt'));
  const frequencies = parseCsv(path.join(GTFS_DIR, 'frequencies.txt'));

  const stop = stops.find((s) => s.stop_id === stopId);
  if (!stop) throw new Error(`stop ${stopId} not found`);

  const tripToRoute = new Map();
  const tripToService = new Map();
  const tripMetaById = new Map();
  for (const t of trips) {
    if (!t.trip_id) continue;
    tripToRoute.set(t.trip_id, t.route_id);
    tripToService.set(t.trip_id, t.service_id);
    tripMetaById.set(t.trip_id, t);
  }

  const routeMetaById = new Map();
  for (const r of routes) {
    const hex = r.route_color ? `#${r.route_color}` : '#2563eb';
    routeMetaById.set(r.route_id, {
      shortName: r.route_short_name || r.route_id,
      name: r.route_long_name || '',
      hex,
    });
  }

  const calendarByServiceId = new Map(calendar.map((c) => [c.service_id, c]));

  const frequenciesByTripId = new Map();
  for (const row of frequencies) {
    if (!row.trip_id) continue;
    const entry = {
      startMin: parseTimeMin(row.start_time),
      endMin: parseTimeMin(row.end_time),
      headwaySec: Math.max(0, +row.headway_secs || 0),
      exactTimes: row.exact_times ?? '0',
    };
    if (!frequenciesByTripId.has(row.trip_id)) frequenciesByTripId.set(row.trip_id, []);
    frequenciesByTripId.get(row.trip_id).push(entry);
  }

  const tripFirstDepMinByTripId = new Map();
  for (const row of stopTimes) {
    if (!row.trip_id) continue;
    const dep = row.departure_time || row.arrival_time;
    const seq = +row.stop_sequence;
    if (!dep || !Number.isFinite(seq)) continue;
    const depMin = parseTimeMin(dep);
    const prev = tripFirstDepMinByTripId.get(row.trip_id);
    if (!prev || seq < prev.seq) {
      tripFirstDepMinByTripId.set(row.trip_id, { seq, depMin });
    }
  }

  const arrivals = [];
  const routeIdsByStopId = new Map();

  for (const row of stopTimes) {
    if (row.stop_id !== stopId || !row.trip_id) continue;
    const routeId = tripToRoute.get(row.trip_id);
    if (!routeId) continue;

    if (!routeIdsByStopId.has(stopId)) routeIdsByStopId.set(stopId, new Set());
    routeIdsByStopId.get(stopId).add(routeId);

    const dep = row.departure_time || row.arrival_time;
    if (!dep) continue;

    const meta = routeMetaById.get(routeId);
    arrivals.push({
      tripId: row.trip_id,
      time: dep,
      mins: parseTimeMin(dep),
      routeId,
      routeShort: meta?.shortName || routeId,
    });
  }

  const tripFirstFlat = new Map();
  for (const [tripId, row] of tripFirstDepMinByTripId) {
    tripFirstFlat.set(tripId, row.depMin);
  }

  const routeIdsByStopArr = new Map();
  for (const [sid, ids] of routeIdsByStopId) {
    routeIdsByStopArr.set(sid, [...ids]);
  }

  const stopRouteIds = getRouteIdsForStop(stopId, routeIdsByStopArr, new Map([[stopId, arrivals]]));

  const board = buildStopDepartureBoard({
    stop,
    arrivals,
    frequenciesByTripId,
    tripFirstDepMinByTripId: tripFirstFlat,
    tripMetaById,
    tripToService,
    tripToRoute,
    calendarByServiceId,
    routeMetaById,
    vehicles: [],
    stopRouteIds,
    gtfsDate,
    nowMin,
  });

  return { stop, board, routeIds: stopRouteIds, routeMetaById, arrivals };
}

describe('stop card — unit', () => {
  it('keeps stable route chip order regardless of vehicle ETA', () => {
    const routeMetaById = new Map([
      ['r12', { shortName: '12', hex: '#111111' }],
      ['r3', { shortName: '3', hex: '#222222' }],
      ['r5', { shortName: '5', hex: '#333333' }],
    ]);
    const stopRouteIds = ['r12', 'r3', 'r5'];

    const boardNear = buildStopDepartureBoard(buildFixture({
      arrivals: [
        { tripId: 't12', mins: 10 * 60 + 20, routeId: 'r12', routeShort: '12' },
        { tripId: 't3', mins: 10 * 60 + 5, routeId: 'r3', routeShort: '3' },
        { tripId: 't5', mins: 10 * 60 + 40, routeId: 'r5', routeShort: '5' },
      ],
      tripMetaById: new Map([
        ['t12', { direction_id: '0', trip_headsign: 'A' }],
        ['t3', { direction_id: '0', trip_headsign: 'B' }],
        ['t5', { direction_id: '0', trip_headsign: 'C' }],
      ]),
      tripToService: new Map([['t12', 'svc1'], ['t3', 'svc1'], ['t5', 'svc1']]),
      tripToRoute: new Map([['t12', 'r12'], ['t3', 'r3'], ['t5', 'r5']]),
      tripFirstDepMinByTripId: new Map([['t12', 9 * 60], ['t3', 9 * 60], ['t5', 9 * 60]]),
      routeMetaById,
      stopRouteIds,
      vehicles: [{ id: 'v3', routeId: 'r3', lat: 53.03, lon: 158.70, speed: 25 }],
    }));

    const boardFar = buildStopDepartureBoard(buildFixture({
      arrivals: boardNear.groups.flatMap((g) => g.departures.map((d) => ({
        tripId: d.tripId,
        mins: d.mins,
        routeId: g.routeId,
        routeShort: g.routeShort,
      }))),
      tripMetaById: new Map([
        ['t12', { direction_id: '0', trip_headsign: 'A' }],
        ['t3', { direction_id: '0', trip_headsign: 'B' }],
        ['t5', { direction_id: '0', trip_headsign: 'C' }],
      ]),
      tripToService: new Map([['t12', 'svc1'], ['t3', 'svc1'], ['t5', 'svc1']]),
      tripToRoute: new Map([['t12', 'r12'], ['t3', 'r3'], ['t5', 'r5']]),
      tripFirstDepMinByTripId: new Map([['t12', 9 * 60], ['t3', 9 * 60], ['t5', 9 * 60]]),
      routeMetaById,
      stopRouteIds,
      vehicles: [{ id: 'v3', routeId: 'r3', lat: 53.08, lon: 158.70, speed: 25 }],
    }));

    const chipOrder = sortRouteIds(stopRouteIds, routeMetaById);
    expect(chipOrder).toEqual(['r3', 'r5', 'r12']);

    const groupOrderNear = boardNear.groups.map((g) => g.routeShort);
    const groupOrderFar = boardFar.groups.map((g) => g.routeShort);
    expect(groupOrderNear).toEqual(['3', '5', '12']);
    expect(groupOrderFar).toEqual(groupOrderNear);
  });

  it('splits same route into separate direction groups', () => {
    const board = buildStopDepartureBoard(buildFixture({
      arrivals: [
        { tripId: 't1', mins: 10 * 60 + 5, routeId: 'r1', routeShort: '7' },
        { tripId: 't2', mins: 10 * 60 + 12, routeId: 'r1', routeShort: '7' },
      ],
      tripMetaById: new Map([
        ['t1', { direction_id: '0', trip_headsign: 'Центр' }],
        ['t2', { direction_id: '1', trip_headsign: 'Аэропорт' }],
      ]),
      tripToService: new Map([['t1', 'svc1'], ['t2', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1'], ['t2', 'r1']]),
      tripFirstDepMinByTripId: new Map([['t1', 9 * 60], ['t2', 9 * 60]]),
      routeMetaById: new Map([['r1', { shortName: '7', hex: '#ff0000' }]]),
      stopRouteIds: ['r1'],
    }));

    expect(board.groups.length).toBe(2);
    expect(board.groups.map((g) => g.headsign).sort()).toEqual(['Аэропорт', 'Центр']);
  });

  it('assigns realtime vehicle to matching direction group', () => {
    const board = buildStopDepartureBoard(buildFixture({
      arrivals: [
        { tripId: 't1', mins: 10 * 60 + 10, routeId: 'r1', routeShort: '7' },
        { tripId: 't2', mins: 10 * 60 + 15, routeId: 'r1', routeShort: '7' },
      ],
      tripMetaById: new Map([
        ['t1', { direction_id: '0', trip_headsign: 'Центр' }],
        ['t2', { direction_id: '1', trip_headsign: 'Аэропорт' }],
      ]),
      tripToService: new Map([['t1', 'svc1'], ['t2', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1'], ['t2', 'r1']]),
      tripFirstDepMinByTripId: new Map([['t1', 9 * 60], ['t2', 9 * 60]]),
      routeMetaById: new Map([['r1', { shortName: '7', hex: '#ff0000' }]]),
      stopRouteIds: ['r1'],
      vehicles: [{
        id: 'v1',
        routeId: 'r1',
        tripId: 't2',
        lat: 53.04,
        lon: 158.70,
        speed: 22,
      }],
    }));

    const airport = board.groups.find((g) => g.headsign === 'Аэропорт');
    const center = board.groups.find((g) => g.headsign === 'Центр');
    expect(airport?.departures.some((d) => d.isRealtime)).toBe(true);
    expect(center?.departures.some((d) => d.isRealtime)).toBe(false);
  });

  it('reports no service when calendar is inactive', () => {
    const board = buildStopDepartureBoard(buildFixture({
      arrivals: [{ tripId: 't1', mins: 10 * 60, routeId: 'r1', routeShort: '3' }],
      tripMetaById: new Map([['t1', { direction_id: '0', trip_headsign: 'Центр' }]]),
      tripToService: new Map([['t1', 'svc_weekday']]),
      tripToRoute: new Map([['t1', 'r1']]),
      tripFirstDepMinByTripId: new Map([['t1', 9 * 60]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
      calendarByServiceId: new Map([['svc_weekday', {
        ...WEEKDAY_CAL,
        sunday: '0',
      }]]),
      gtfsDate: '20260621',
      nowMin: 10 * 60,
    }));

    expect(board.noService).toBe(true);
    expect(board.isEmpty).toBe(true);
  });

  it('filters departures beyond horizon', () => {
    const board = buildStopDepartureBoard(buildFixture({
      arrivals: [
        { tripId: 't1', mins: 10 * 60 + 30, routeId: 'r1', routeShort: '3' },
        { tripId: 't1', mins: 10 * 60 + 200, routeId: 'r1', routeShort: '3' },
      ],
      tripMetaById: new Map([['t1', { direction_id: '0', trip_headsign: 'Центр' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      tripFirstDepMinByTripId: new Map([['t1', 9 * 60]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
      horizonMin: 180,
    }));

    expect(board.groups[0].departures.length).toBe(1);
    expect(board.groups[0].departures[0].minutesAway).toBe(30);
  });

  it('marks first departure in each group as next', () => {
    const board = buildStopDepartureBoard(buildFixture({
      arrivals: [
        { tripId: 't1', mins: 10 * 60 + 10, routeId: 'r1', routeShort: '3' },
        { tripId: 't1', mins: 10 * 60 + 25, routeId: 'r1', routeShort: '3' },
      ],
      tripMetaById: new Map([['t1', { direction_id: '0', trip_headsign: 'Центр' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      tripFirstDepMinByTripId: new Map([['t1', 9 * 60]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
    }));

    const deps = board.groups[0].departures;
    expect(deps[0].isNext).toBe(true);
    expect(deps[1]?.isNext).toBe(false);
  });

  it('getRouteIdsForStop prefers GTFS index over arrivals order', () => {
    const routeIds = getRouteIdsForStop('s1', new Map([['s1', ['r2', 'r1']]]), new Map([
      ['s1', [{ routeId: 'r9' }]],
    ]));
    expect(routeIds).toEqual(['r2', 'r1']);
  });
});

describe('stop card — GTFS integration', () => {
  let gtfsIndexes;

  beforeAll(() => {
    const stopTimes = parseCsv(path.join(GTFS_DIR, 'stop_times.txt'));
    const trips = parseCsv(path.join(GTFS_DIR, 'trips.txt'));
    const tripToRoute = new Map(trips.filter((t) => t.trip_id).map((t) => [t.trip_id, t.route_id]));
    const tripToService = new Map(trips.filter((t) => t.trip_id).map((t) => [t.trip_id, t.service_id]));
    const calendar = parseCsv(path.join(GTFS_DIR, 'calendar.txt'));
    const calMap = new Map(calendar.map((c) => [c.service_id, c]));

    const candidateStops = [...new Set(stopTimes.map((r) => r.stop_id).filter(Boolean))];
    const dates = ['20260619', '20260620', '20260621'];

    let best = null;
    for (const gtfsDate of dates) {
      const active = getActiveServiceIds(gtfsDate, calMap);
      for (const stopId of candidateStops) {
        const tripIds = new Set(
          stopTimes.filter((r) => r.stop_id === stopId).map((r) => r.trip_id).filter(Boolean),
        );
        const activeTrips = [...tripIds].filter((id) => active.has(tripToService.get(id)));
        if (!activeTrips.length) continue;

        const routes = new Set(activeTrips.map((id) => tripToRoute.get(id)).filter(Boolean));
        const snapshot = buildBoardFromGtfs(stopId, 10 * 60, gtfsDate);
        const score = routes.size * 1000 + snapshot.board.groups.length;
        if (!snapshot.board.isEmpty && (!best || score > best.score)) {
          best = { stopId, gtfsDate, snapshot, score, routeCount: routes.size };
        }
      }
    }

    expect(best, 'no stop with active board found in GTFS').toBeTruthy();
    gtfsIndexes = { ...best.snapshot, gtfsDate: best.gtfsDate, stopId: best.stopId };
  });

  it('builds non-empty board for a real busy stop', () => {
    expect(gtfsIndexes.board.isEmpty).toBe(false);
    expect(gtfsIndexes.board.groups.length).toBeGreaterThan(0);
    expect(gtfsIndexes.routeIds.length).toBeGreaterThan(1);
  });

  it('board only contains routes that serve the stop', () => {
    const fromBoard = [...new Set(gtfsIndexes.board.groups.map((g) => g.routeId))];
    expect(fromBoard.length).toBeGreaterThan(0);
    for (const routeId of fromBoard) {
      expect(gtfsIndexes.routeIds).toContain(routeId);
    }
  });

  it('every group lists departures in scheduled time order', () => {
    for (const group of gtfsIndexes.board.groups) {
      expect(group.departures.length).toBeGreaterThan(0);
      for (let i = 1; i < group.departures.length; i++) {
        const prev = group.departures[i - 1].scheduledMins ?? group.departures[i - 1].mins;
        const cur = group.departures[i].scheduledMins ?? group.departures[i].mins;
        expect(cur).toBeGreaterThanOrEqual(prev);
      }
      for (const dep of group.departures) {
        expect(dep.minutesAway).toBeLessThanOrEqual(180);
        expect(dep.clock).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });

  it('group order is stable (sorted by route number)', () => {
    const shorts = gtfsIndexes.board.groups.map((g) => g.routeShort);
    const sorted = [...shorts].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    expect(shorts).toEqual(sorted);
  });

  it('builds frequency board for a known weekday stop', () => {
    const snapshot = buildBoardFromGtfs('stop_2603280916_80828', 10 * 60, '20260619');
    expect(snapshot.board.isEmpty).toBe(false);
    const hasInterval = snapshot.board.groups.some((g) => (g.interval?.headwayMin ?? 0) > 0);
    const hasFreqDep = snapshot.board.groups.some((g) => g.departures.some((d) => d.isFrequency));
    expect(hasInterval || hasFreqDep).toBe(true);
    expect(snapshot.board.groups[0].departures[0].minutesAway).toBeLessThanOrEqual(5);
  });

  it('uses a GTFS date when the stop actually has active service', () => {
    const calendar = parseCsv(path.join(GTFS_DIR, 'calendar.txt'));
    const calMap = new Map(calendar.map((c) => [c.service_id, c]));
    const active = getActiveServiceIds(gtfsIndexes.gtfsDate, calMap);
    expect(active.size).toBeGreaterThan(0);
    expect(gtfsIndexes.board.noService).toBe(false);
  });
});