import { describe, it, expect } from 'vitest';
import { bearingFromDelta, bearingBetween } from '../../src/utils/bearing.js';
import { getBearing } from './utils.js';

describe('bearingFromDelta', () => {
  it('returns 0° for northward movement', () => {
    expect(bearingFromDelta(0, 1)).toBe(0);
  });

  it('returns 90° for eastward movement', () => {
    expect(bearingFromDelta(1, 0)).toBe(90);
  });

  it('returns 180° for southward movement', () => {
    expect(bearingFromDelta(0, -1)).toBe(180);
  });

  it('returns 270° for westward movement', () => {
    expect(bearingFromDelta(-1, 0)).toBe(270);
  });

  it('returns null for zero displacement', () => {
    expect(bearingFromDelta(0, 0)).toBeNull();
  });

  it('matches getBearing for point pairs', () => {
    const from = [158.7, 53.01];
    const to = [158.71, 53.02];
    expect(bearingFromDelta(to[0] - from[0], to[1] - from[1])).toBe(getBearing(from, to));
  });
});

describe('bearingBetween', () => {
  it('returns 0 for missing points', () => {
    expect(bearingBetween(null, [1, 2])).toBe(0);
  });
});