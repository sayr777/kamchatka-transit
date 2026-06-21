import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadFavoriteStopIds,
  loadFavoriteRouteIds,
  saveFavoriteStopIds,
  saveFavoriteRouteIds,
  toggleFavoriteId,
  resolveFavoriteStops,
  resolveFavoriteRoutes,
} from '../../src/utils/favorites.js';

const lsStore = {};

describe('favorites', () => {
  beforeEach(() => {
    Object.keys(lsStore).forEach((k) => delete lsStore[k]);
    vi.stubGlobal('localStorage', {
      getItem: (k) => (k in lsStore ? lsStore[k] : null),
      setItem: (k, v) => { lsStore[k] = String(v); },
      removeItem: (k) => { delete lsStore[k]; },
      clear: () => { Object.keys(lsStore).forEach((k) => delete lsStore[k]); },
    });
  });

  it('loads empty stop list by default', () => {
    expect(loadFavoriteStopIds()).toEqual([]);
  });

  it('loads empty route list by default', () => {
    expect(loadFavoriteRouteIds()).toEqual([]);
  });

  it('persists and loads stop ids', () => {
    saveFavoriteStopIds(['a', 'b']);
    expect(loadFavoriteStopIds()).toEqual(['a', 'b']);
  });

  it('persists and loads route ids', () => {
    saveFavoriteRouteIds(['r1', 'r2']);
    expect(loadFavoriteRouteIds()).toEqual(['r1', 'r2']);
  });

  it('adds favorite to front', () => {
    const { ids, added } = toggleFavoriteId(['b'], 'a');
    expect(added).toBe(true);
    expect(ids).toEqual(['a', 'b']);
  });

  it('removes favorite', () => {
    const { ids, added } = toggleFavoriteId(['a', 'b'], 'a');
    expect(added).toBe(false);
    expect(ids).toEqual(['b']);
  });

  it('resolves stops in order and skips missing', () => {
    const all = [
      { stop_id: '1', stop_name: 'A' },
      { stop_id: '3', stop_name: 'C' },
    ];
    const resolved = resolveFavoriteStops(['3', '2', '1'], all);
    expect(resolved.map((s) => s.stop_id)).toEqual(['3', '1']);
  });

  it('resolves routes in order', () => {
    const all = [
      { route_id: 'r1', route_short_name: '1' },
      { route_id: 'r3', route_short_name: '3' },
    ];
    const resolved = resolveFavoriteRoutes(['r3', 'r9', 'r1'], all);
    expect(resolved.map((r) => r.route_id)).toEqual(['r3', 'r1']);
  });
});