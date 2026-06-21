import { describe, it, expect } from 'vitest';
import {
  expandFrequencyDepartures,
  buildStopDepartureBoard,
  formatDepartureCountdown,
  formatDelayStatusLabel,
  classifyDelayStatus,
  attachDelayToRealtime,
  refreshStopBoardLive,
  minsUntil,
} from '../../src/utils/stopDepartures.js';

describe('stopDepartures', () => {
  it('expands frequency departures with stop offset', () => {
    const deps = expandFrequencyDepartures(
      6 * 60 + 4,
      6 * 60,
      [{ startMin: 6 * 60, endMin: 6 * 60 + 10, headwaySec: 60, exactTimes: '0' }],
      6 * 60 + 5,
      8,
    );
    expect(deps.length).toBeGreaterThanOrEqual(3);
    expect(deps[0].mins).toBe(6 * 60 + 5);
  });

  it('builds grouped board with interval hint', () => {
    const board = buildStopDepartureBoard({
      stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
      arrivals: [{
        tripId: 't1',
        time: '08:00:00',
        mins: 8 * 60,
        routeId: 'r1',
        routeShort: '3',
      }],
      frequenciesByTripId: new Map([
        ['t1', [{ startMin: 6 * 60, endMin: 22 * 60, headwaySec: 600, exactTimes: '0' }]],
      ]),
      tripFirstDepMinByTripId: new Map([['t1', 6 * 60]]),
      tripMetaById: new Map([['t1', { trip_headsign: 'Центр', direction_id: '0' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      calendarByServiceId: new Map([['svc1', {
        monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
        friday: '1', saturday: '1', sunday: '1',
        start_date: '20200101', end_date: '20991231',
      }]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
      vehicles: [],
      gtfsDate: '20260621',
      nowMin: 8 * 60,
    });

    expect(board.groups.length).toBe(1);
    expect(board.groups[0].routeShort).toBe('3');
    expect(board.groups[0].departures.length).toBeGreaterThan(0);
    expect(board.groups[0].interval?.headwayMin).toBe(10);
    expect(board.groups[0].scheduleMode).toBe('frequency');
    expect(board.groups[0].departures.length).toBeLessThanOrEqual(2);
  });

  it('keeps full departure list for exact scheduled trips', () => {
    const board = buildStopDepartureBoard({
      stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
      arrivals: [
        { tripId: 't1', time: '08:00:00', mins: 8 * 60, routeId: 'r1', routeShort: '3' },
        { tripId: 't1', time: '08:15:00', mins: 8 * 60 + 15, routeId: 'r1', routeShort: '3' },
        { tripId: 't1', time: '08:30:00', mins: 8 * 60 + 30, routeId: 'r1', routeShort: '3' },
        { tripId: 't1', time: '08:45:00', mins: 8 * 60 + 45, routeId: 'r1', routeShort: '3' },
      ],
      frequenciesByTripId: new Map(),
      tripFirstDepMinByTripId: new Map([['t1', 7 * 60]]),
      tripMetaById: new Map([['t1', { trip_headsign: 'Центр', direction_id: '0' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      calendarByServiceId: new Map([['svc1', {
        monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
        friday: '1', saturday: '1', sunday: '1',
        start_date: '20200101', end_date: '20991231',
      }]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
      vehicles: [],
      gtfsDate: '20260621',
      nowMin: 8 * 60,
      maxPerGroup: 4,
    });

    expect(board.groups[0].scheduleMode).toBe('scheduled');
    expect(board.groups[0].departures.length).toBe(4);
  });

  it('formats countdown labels', () => {
    expect(formatDepartureCountdown(0, 'ru')).toBe('сейчас');
    expect(formatDepartureCountdown(5, 'en')).toBe('5 min');
    expect(minsUntil(8 * 60 + 10, 8 * 60)).toBe(10);
  });

  it('classifies delay status buckets', () => {
    expect(classifyDelayStatus(1)).toBeNull();
    expect(classifyDelayStatus(3)?.status).toBe('delayed');
    expect(classifyDelayStatus(6)?.status).toBe('late');
    expect(classifyDelayStatus(-3)?.status).toBe('early');
  });

  it('attaches delay labels to realtime departures', () => {
    const rt = attachDelayToRealtime(
      { isRealtime: true, minutesAway: 8, mins: 8 * 60 + 8, clock: '08:08' },
      { isRealtime: false, minutesAway: 5, mins: 8 * 60 + 5, clock: '08:05' },
    );
    expect(rt.delayStatus).toBe('delayed');
    expect(rt.scheduledClock).toBe('08:05');
    expect(formatDelayStatusLabel(rt.delayStatus, rt.delayMinutes, 'ru')).toContain('задерживается');
  });

  it('marks late vehicles on departure board', () => {
    const board = buildStopDepartureBoard({
      stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
      arrivals: [
        { tripId: 't1', time: '08:10:00', mins: 8 * 60 + 10, routeId: 'r1', routeShort: '3' },
      ],
      frequenciesByTripId: new Map(),
      tripFirstDepMinByTripId: new Map([['t1', 7 * 60]]),
      tripMetaById: new Map([['t1', { trip_headsign: 'Центр', direction_id: '0' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      calendarByServiceId: new Map([['svc1', {
        monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
        friday: '1', saturday: '1', sunday: '1',
        start_date: '20200101', end_date: '20991231',
      }]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
      vehicles: [{
        id: 'v1',
        routeId: 'r1',
        tripId: 't1',
        lat: 53.055,
        lon: 158.70,
        speed: 20,
      }],
      stopRouteIds: ['r1'],
      gtfsDate: '20260621',
      nowMin: 8 * 60,
    });

    const dep = board.groups[0].departures.find((d) => d.isRealtime);
    expect(dep).toBeTruthy();
    expect(dep.delayStatus).toBe('late');
    expect(formatDelayStatusLabel(dep.delayStatus, dep.delayMinutes, 'ru')).toContain('опаздывает');
  });

  it('ignores vehicles on routes that do not serve the stop', () => {
    const board = buildStopDepartureBoard({
      stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
      arrivals: [
        { tripId: 't1', time: '08:10:00', mins: 8 * 60 + 10, routeId: 'r1', routeShort: '3' },
      ],
      frequenciesByTripId: new Map(),
      tripFirstDepMinByTripId: new Map([['t1', 7 * 60]]),
      tripMetaById: new Map([['t1', { trip_headsign: 'Центр', direction_id: '0' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      calendarByServiceId: new Map([['svc1', {
        monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
        friday: '1', saturday: '1', sunday: '1',
        start_date: '20200101', end_date: '20991231',
      }]]),
      routeMetaById: new Map([
        ['r1', { shortName: '3', hex: '#ff0000' }],
        ['r9', { shortName: '99', hex: '#00ff00' }],
      ]),
      vehicles: [{
        id: 'v9',
        routeId: 'r9',
        lat: 53.01,
        lon: 158.70,
        speed: 20,
      }],
      stopRouteIds: ['r1'],
      gtfsDate: '20260621',
      nowMin: 8 * 60,
    });

    expect(board.groups.length).toBe(1);
    expect(board.groups[0].routeId).toBe('r1');
    expect(board.groups[0].departures.some((d) => d.isRealtime)).toBe(false);
  });

  it('merges realtime with scheduled within 2 minutes and shows delay', () => {
    const board = buildStopDepartureBoard({
      stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
      arrivals: [
        { tripId: 't1', time: '08:10:00', mins: 8 * 60 + 10, routeId: 'r1', routeShort: '3' },
      ],
      frequenciesByTripId: new Map(),
      tripFirstDepMinByTripId: new Map([['t1', 7 * 60]]),
      tripMetaById: new Map([['t1', { trip_headsign: 'Центр', direction_id: '0' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      calendarByServiceId: new Map([['svc1', {
        monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
        friday: '1', saturday: '1', sunday: '1',
        start_date: '20200101', end_date: '20991231',
      }]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
      vehicles: [{
        id: 'v1',
        routeId: 'r1',
        tripId: 't1',
        lat: 53.043,
        lon: 158.70,
        speed: 22,
      }],
      stopRouteIds: ['r1'],
      gtfsDate: '20260621',
      nowMin: 8 * 60,
    });

    const deps = board.groups[0].departures;
    expect(deps.length).toBe(1);
    expect(deps[0].isRealtime).toBe(true);
    expect(deps[0].scheduledClock).toBe('08:10');
  });

  it('sorts departures by scheduled time not live ETA', () => {
    const board = buildStopDepartureBoard({
      stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
      arrivals: [
        { tripId: 't1', time: '08:20:00', mins: 8 * 60 + 20, routeId: 'r1', routeShort: '3' },
        { tripId: 't1', time: '08:10:00', mins: 8 * 60 + 10, routeId: 'r1', routeShort: '3' },
      ],
      frequenciesByTripId: new Map(),
      tripFirstDepMinByTripId: new Map([['t1', 7 * 60]]),
      tripMetaById: new Map([['t1', { trip_headsign: 'Центр', direction_id: '0' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      calendarByServiceId: new Map([['svc1', {
        monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
        friday: '1', saturday: '1', sunday: '1',
        start_date: '20200101', end_date: '20991231',
      }]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
      vehicles: [],
      gtfsDate: '20260621',
      nowMin: 8 * 60,
    });

    const mins = board.groups[0].departures.map((d) => d.scheduledMins ?? d.mins);
    expect(mins).toEqual([8 * 60 + 10, 8 * 60 + 20]);
  });

  it('builds board for a single filtered route', () => {
    const board = buildStopDepartureBoard({
      stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
      arrivals: [
        { tripId: 't1', time: '08:10:00', mins: 8 * 60 + 10, routeId: 'r1', routeShort: '3' },
      ],
      frequenciesByTripId: new Map(),
      tripFirstDepMinByTripId: new Map([['t1', 7 * 60], ['t2', 7 * 60]]),
      tripMetaById: new Map([
        ['t1', { trip_headsign: 'Центр', direction_id: '0' }],
        ['t2', { trip_headsign: 'Аэропорт', direction_id: '0' }],
      ]),
      tripToService: new Map([['t1', 'svc1'], ['t2', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1'], ['t2', 'r2']]),
      calendarByServiceId: new Map([['svc1', {
        monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
        friday: '1', saturday: '1', sunday: '1',
        start_date: '20200101', end_date: '20991231',
      }]]),
      routeMetaById: new Map([
        ['r1', { shortName: '3', hex: '#ff0000' }],
        ['r2', { shortName: '7', hex: '#00ff00' }],
      ]),
      vehicles: [],
      stopRouteIds: ['r1'],
      gtfsDate: '20260621',
      nowMin: 8 * 60,
    });

    expect(board.groups.length).toBe(1);
    expect(board.groups[0].routeId).toBe('r1');
  });

  it('refreshStopBoardLive keeps row order when delays change', () => {
    const base = {
      stop: { stop_id: 's1', stop_lat: '53.01', stop_lon: '158.70' },
      arrivals: [
        { tripId: 't1', time: '08:10:00', mins: 8 * 60 + 10, routeId: 'r1', routeShort: '3' },
        { tripId: 't1', time: '08:20:00', mins: 8 * 60 + 20, routeId: 'r1', routeShort: '3' },
      ],
      frequenciesByTripId: new Map(),
      tripFirstDepMinByTripId: new Map([['t1', 7 * 60]]),
      tripMetaById: new Map([['t1', { trip_headsign: 'Центр', direction_id: '0' }]]),
      tripToService: new Map([['t1', 'svc1']]),
      tripToRoute: new Map([['t1', 'r1']]),
      calendarByServiceId: new Map([['svc1', {
        monday: '1', tuesday: '1', wednesday: '1', thursday: '1',
        friday: '1', saturday: '1', sunday: '1',
        start_date: '20200101', end_date: '20991231',
      }]]),
      routeMetaById: new Map([['r1', { shortName: '3', hex: '#ff0000' }]]),
      stopRouteIds: ['r1'],
      gtfsDate: '20260621',
      nowMin: 8 * 60,
    };

    const frozen = buildStopDepartureBoard({ ...base, vehicles: [] });
    const fresh = buildStopDepartureBoard({
      ...base,
      vehicles: [{ id: 'v1', routeId: 'r1', tripId: 't1', lat: 53.055, lon: 158.70, speed: 20 }],
    });

    const slotsBefore = frozen.groups[0].departures.map((d) => d.scheduledMins ?? d.mins);
    const refreshed = refreshStopBoardLive(frozen, fresh, 8 * 60);
    const slotsAfter = refreshed.groups[0].departures.map((d) => d.scheduledMins ?? d.mins);
    expect(slotsAfter).toEqual(slotsBefore);
    expect(refreshed.groups[0].departures[0].isRealtime).toBe(true);
    expect(refreshed.groups[0].departures[0].minutesAway).toBeGreaterThan(10);
  });
});