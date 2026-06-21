import { describe, it, expect } from 'vitest';
import {
  getRouteIdsForStop,
  shortStopName,
  collectStopsForRoutes,
} from '../../src/utils/stopFocus.js';

describe('stopFocus', () => {
  it('reads route ids from index', () => {
    const routeIdsByStopId = new Map([['s1', ['r1', 'r2']]]);
    expect(getRouteIdsForStop('s1', routeIdsByStopId, new Map())).toEqual(['r1', 'r2']);
  });

  it('falls back to arrivals', () => {
    const arrivalsByStopId = new Map([
      ['s1', [{ routeId: 'r3' }, { routeId: 'r4' }, { routeId: 'r3' }]],
    ]);
    expect(getRouteIdsForStop('s1', new Map(), arrivalsByStopId).sort()).toEqual(['r3', 'r4']);
  });

  it('shortens long stop names', () => {
    expect(shortStopName('Очень длинное название остановки в городе')).toMatch(/…$/);
    expect(shortStopName('Центр')).toBe('Центр');
  });

  it('collects stops for routes', () => {
    const allStops = [
      { stop_id: 's1', stop_name: 'A' },
      { stop_id: 's2', stop_name: 'B' },
      { stop_id: 's3', stop_name: 'C' },
    ];
    const stopIdsByRouteId = new Map([
      ['r1', ['s1', 's2']],
      ['r2', ['s2', 's3']],
    ]);
    const result = collectStopsForRoutes(allStops, ['r1', 'r2'], stopIdsByRouteId);
    expect(result.map((s) => s.stop_id).sort()).toEqual(['s1', 's2', 's3']);
  });
});