import { describe, it, expect } from 'vitest';
import {
  haversineMeters, routeLengthKm, getBearing, normalizeBearing,
  isOnKamchatka, KAMCHATKA_BOUNDS, PKC,
  parseTimeMin, formatTime, toGtfsDate,
  normalizeName, hashString, escHtml, hexRgb, routeTypeLabel, boolLabel,
  lerp, lerpAngle, shortestLoopDelta, dampFactor, getPaletteRouteHex,
} from './utils.js';

// ── haversineMeters ───────────────────────────────────────────

describe('haversineMeters', () => {
  it('одна и та же точка → 0', () => {
    expect(haversineMeters(53.0, 158.7, 53.0, 158.7)).toBe(0);
  });

  it('ПКЧ → аэропорт Елизово (~23 км по прямой)', () => {
    // Аэропорт Елизово: 53.1672, 158.4536
    const dist = haversineMeters(53.015, 158.700, 53.167, 158.454);
    expect(dist).toBeGreaterThan(20000);
    expect(dist).toBeLessThan(30000);
  });

  it('1 градус широты ≈ 111 км', () => {
    const dist = haversineMeters(53.0, 158.7, 54.0, 158.7);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });

  it('симметрично', () => {
    const d1 = haversineMeters(53.0, 158.7, 53.5, 159.0);
    const d2 = haversineMeters(53.5, 159.0, 53.0, 158.7);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

// ── routeLengthKm ─────────────────────────────────────────────

describe('routeLengthKm', () => {
  it('пустой путь → 0', () => {
    expect(routeLengthKm([])).toBe(0);
    expect(routeLengthKm(null)).toBe(0);
    expect(routeLengthKm([[158.7, 53.0]])).toBe(0);
  });

  it('две точки ~ 1 км', () => {
    // ~900 м по прямой
    const path = [[158.700, 53.000], [158.710, 53.005]];
    const km = routeLengthKm(path);
    expect(km).toBeGreaterThan(0.5);
    expect(km).toBeLessThan(2);
  });

  it('три точки суммирует оба сегмента', () => {
    const path = [[158.700, 53.000], [158.710, 53.000], [158.720, 53.000]];
    const twoSeg = routeLengthKm(path);
    const oneSeg = routeLengthKm([[158.700, 53.000], [158.720, 53.000]]);
    expect(Math.abs(twoSeg - oneSeg)).toBeLessThan(0.01);
  });
});

// ── getBearing ────────────────────────────────────────────────

describe('getBearing', () => {
  it('null аргументы → 0', () => {
    expect(getBearing(null, [158.7, 53.0])).toBe(0);
    expect(getBearing([158.7, 53.0], null)).toBe(0);
  });

  it('восток ≈ 90°', () => {
    const b = getBearing([158.0, 53.0], [159.0, 53.0]);
    expect(b).toBeGreaterThan(85);
    expect(b).toBeLessThan(95);
  });

  it('север ≈ 0° или 360°', () => {
    const b = getBearing([158.0, 53.0], [158.0, 54.0]);
    // getBearing использует atan2(dx,dy) — при движении на север dx=0, dy>0, результат 0°
    expect(b < 5 || b > 355).toBe(true);
  });

  it('результат всегда в [0, 360)', () => {
    const cases = [
      [[0, 0], [1, 1]], [[1, 1], [0, 0]],
      [[158.7, 53.0], [158.0, 52.0]],
    ];
    for (const [a, b] of cases) {
      const bearing = getBearing(a, b);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    }
  });
});

// ── normalizeBearing ──────────────────────────────────────────

describe('normalizeBearing', () => {
  it('0 → 0', () => expect(normalizeBearing(0)).toBe(0));
  it('360 → 0', () => expect(normalizeBearing(360)).toBe(0));
  it('-90 → 270', () => expect(normalizeBearing(-90)).toBe(270));
  it('450 → 90', () => expect(normalizeBearing(450)).toBe(90));
  it('NaN → 0', () => expect(normalizeBearing(NaN)).toBe(0));
  it('Infinity → 0', () => expect(normalizeBearing(Infinity)).toBe(0));
  it('результат в [0, 360)', () => {
    [-720, -1, 0, 180, 359, 360, 721].forEach(v => {
      const r = normalizeBearing(v);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(360);
    });
  });
});

// ── isOnKamchatka ─────────────────────────────────────────────

describe('isOnKamchatka', () => {
  it('ПКЧ внутри', () => expect(isOnKamchatka(PKC.lat, PKC.lon)).toBe(true));
  it('Москва снаружи', () => expect(isOnKamchatka(55.75, 37.61)).toBe(false));
  it('Владивосток снаружи', () => expect(isOnKamchatka(43.12, 131.9)).toBe(false));
  it('Токио снаружи', () => expect(isOnKamchatka(35.68, 139.69)).toBe(false));
  it('крайний север Камчатки внутри', () => expect(isOnKamchatka(60.0, 160.0)).toBe(true));
  it('точно на границе минимума lat', () => expect(isOnKamchatka(50.8, 160.0)).toBe(true));
  it('чуть за границей → снаружи', () => expect(isOnKamchatka(50.79, 160.0)).toBe(false));
  it('PKC координаты соответствуют центру ПКЧ', () => {
    expect(PKC.lat).toBeCloseTo(53.015, 2);
    expect(PKC.lon).toBeCloseTo(158.7, 1);
  });
});

// ── parseTimeMin ──────────────────────────────────────────────

describe('parseTimeMin', () => {
  it('null/undefined → 0', () => {
    expect(parseTimeMin(null)).toBe(0);
    expect(parseTimeMin(undefined)).toBe(0);
    expect(parseTimeMin('')).toBe(0);
  });
  it('00:00 → 0', () => expect(parseTimeMin('00:00')).toBe(0));
  it('01:30 → 90', () => expect(parseTimeMin('01:30')).toBe(90));
  it('12:00 → 720', () => expect(parseTimeMin('12:00')).toBe(720));
  it('23:59 → 1439', () => expect(parseTimeMin('23:59')).toBe(1439));
  it('25:00 → 1500 (GTFS допускает >24ч)', () => expect(parseTimeMin('25:00')).toBe(1500));
  it('HH:MM:SS — берёт только часы и минуты', () => expect(parseTimeMin('08:30:00')).toBe(510));
});

// ── formatTime ────────────────────────────────────────────────

describe('formatTime', () => {
  it('пустая строка → ""', () => expect(formatTime('')).toBe(''));
  it('null → ""', () => expect(formatTime(null)).toBe(''));
  it('08:30:00 → "08:30"', () => expect(formatTime('08:30:00')).toBe('08:30'));
  it('23:59 → "23:59"', () => expect(formatTime('23:59')).toBe('23:59'));
  it('00:00:00 → "00:00"', () => expect(formatTime('00:00:00')).toBe('00:00'));
});

// ── toGtfsDate ────────────────────────────────────────────────

describe('toGtfsDate', () => {
  it('форматирует дату в YYYYMMDD', () => {
    expect(toGtfsDate(new Date(2026, 0, 5))).toBe('20260105');
    expect(toGtfsDate(new Date(2026, 11, 31))).toBe('20261231');
  });
  it('дополняет месяц и день нулями', () => {
    expect(toGtfsDate(new Date(2026, 2, 7))).toBe('20260307');
  });
  it('длина всегда 8 символов', () => {
    expect(toGtfsDate(new Date(2026, 5, 17)).length).toBe(8);
  });
});

// ── normalizeName ─────────────────────────────────────────────

describe('normalizeName', () => {
  it('приводит к нижнему регистру', () => {
    expect(normalizeName('КамГУ')).toBe('камгу');
  });
  it('заменяет ё на е', () => {
    expect(normalizeName('Ёлка')).toBe('елка');
    expect(normalizeName('Площадь Лёнина')).toBe('площадь ленина');
  });
  it('убирает кавычки', () => {
    expect(normalizeName('«Авача»')).toBe('авача');
    expect(normalizeName('"Север"')).toBe('север');
  });
  it('схлопывает пробелы', () => {
    expect(normalizeName('  ул.  Ленина  ')).toBe('ул. ленина');
  });
  it('null/undefined → ""', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
  it('одинаковые названия после нормализации совпадают', () => {
    expect(normalizeName('КамГУ им. В. Беринга')).toBe(normalizeName('камгу им. в. беринга'));
  });
});

// ── hashString ────────────────────────────────────────────────

describe('hashString', () => {
  it('всегда неотрицательный', () => {
    ['', 'test', 'route_123', 'Камчатка'].forEach(s => {
      expect(hashString(s)).toBeGreaterThanOrEqual(0);
    });
  });
  it('детерминированный — одна строка, один результат', () => {
    expect(hashString('route_42')).toBe(hashString('route_42'));
  });
  it('разные строки дают разные хэши (для коротких строк)', () => {
    expect(hashString('route_1')).not.toBe(hashString('route_2'));
  });
  it('null → не бросает исключение', () => {
    expect(() => hashString(null)).not.toThrow();
  });
});

// ── escHtml ───────────────────────────────────────────────────

describe('escHtml', () => {
  it('null/undefined → ""', () => {
    expect(escHtml(null)).toBe('');
    expect(escHtml(undefined)).toBe('');
  });
  it('экранирует &', () => expect(escHtml('a&b')).toBe('a&amp;b'));
  it('экранирует <', () => expect(escHtml('<div>')).toBe('&lt;div&gt;'));
  it('экранирует "', () => expect(escHtml('"текст"')).toBe('&quot;текст&quot;'));
  it('безопасная строка не изменяется', () => {
    expect(escHtml('Петропавловск-Камчатский')).toBe('Петропавловск-Камчатский');
  });
  it('XSS-строка полностью экранируется', () => {
    const xss = '<script>alert("xss")</script>';
    const safe = escHtml(xss);
    expect(safe).not.toContain('<script>');
    expect(safe).not.toContain('"xss"');
  });
});

// ── hexRgb ────────────────────────────────────────────────────

describe('hexRgb', () => {
  it('#FF0000 → [255,0,0]', () => expect(hexRgb('#FF0000')).toEqual([255, 0, 0]));
  it('#000000 → [0,0,0]', () => expect(hexRgb('#000000')).toEqual([0, 0, 0]));
  it('#FFFFFF → [255,255,255]', () => expect(hexRgb('#FFFFFF')).toEqual([255, 255, 255]));
  it('без # тоже работает', () => expect(hexRgb('FC3F1D')).toEqual([252, 63, 29]));
  it('возвращает массив из 3 чисел', () => {
    const r = hexRgb('#1E88E5');
    expect(r).toHaveLength(3);
    r.forEach(c => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(255); });
  });
});

// ── routeTypeLabel ────────────────────────────────────────────

describe('routeTypeLabel', () => {
  it('3 → Автобус', () => expect(routeTypeLabel({ route_type: '3' })).toBe('Автобус'));
  it('11 → Троллейбус', () => expect(routeTypeLabel({ route_type: '11' })).toBe('Троллейбус'));
  it('0 → Трамвай', () => expect(routeTypeLabel({ route_type: '0' })).toBe('Трамвай'));
  it('неизвестный тип → Транспорт', () => expect(routeTypeLabel({ route_type: '99' })).toBe('Транспорт'));
  it('принимает число напрямую', () => expect(routeTypeLabel(3)).toBe('Автобус'));
});

// ── boolLabel ─────────────────────────────────────────────────

describe('boolLabel', () => {
  it('"1" → Да', () => expect(boolLabel('1')).toBe('Да'));
  it('"0" → Нет', () => expect(boolLabel('0')).toBe('Нет'));
  it('1 (число) → Да', () => expect(boolLabel(1)).toBe('Да'));
  it('пустая строка → Нет данных', () => expect(boolLabel('')).toBe('Нет данных'));
  it('null → Нет данных', () => expect(boolLabel(null)).toBe('Нет данных'));
});

// ── lerp ─────────────────────────────────────────────────────

describe('lerp', () => {
  it('t=0 → a', () => expect(lerp(0, 100, 0)).toBe(0));
  it('t=1 → b', () => expect(lerp(0, 100, 1)).toBe(100));
  it('t=0.5 → середина', () => expect(lerp(0, 100, 0.5)).toBe(50));
  it('работает с отрицательными', () => expect(lerp(-10, 10, 0.5)).toBe(0));
});

// ── lerpAngle ─────────────────────────────────────────────────

describe('lerpAngle', () => {
  it('переход через 0°/360° выбирает короткий путь', () => {
    // от 350° до 10° через 0° (20° разница), а не через 180° (340° разница)
    const mid = lerpAngle(350, 10, 0.5);
    expect(mid).toBeCloseTo(0, 0);
  });
  it('t=0 → from', () => expect(lerpAngle(45, 90, 0)).toBeCloseTo(45, 1));
  it('t=1 → to', () => expect(lerpAngle(45, 90, 1)).toBeCloseTo(90, 1));
  it('результат в [0, 360)', () => {
    [
      [350, 10, 0.5], [0, 270, 0.5], [180, 0, 0.5],
    ].forEach(([from, to, t]) => {
      const r = lerpAngle(from, to, t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(360);
    });
  });
});

// ── shortestLoopDelta ─────────────────────────────────────────

describe('shortestLoopDelta', () => {
  it('350→10 по кругу 360 → +20', () => {
    expect(shortestLoopDelta(350, 10, 360)).toBeCloseTo(20);
  });
  it('10→350 по кругу 360 → -20', () => {
    expect(shortestLoopDelta(10, 350, 360)).toBeCloseTo(-20);
  });
  it('0→180 → 180', () => {
    expect(shortestLoopDelta(0, 180, 360)).toBeCloseTo(180);
  });
  it('одинаковые точки → 0', () => {
    expect(shortestLoopDelta(90, 90, 360)).toBeCloseTo(0);
  });
});

// ── dampFactor ────────────────────────────────────────────────

describe('dampFactor', () => {
  it('delta=0 → 0', () => expect(dampFactor(0, 100)).toBeCloseTo(0));
  it('очень большая delta → ≈1', () => expect(dampFactor(10000, 100)).toBeCloseTo(1, 2));
  it('delta=smoothing → ≈0.632', () => {
    expect(dampFactor(100, 100)).toBeCloseTo(1 - Math.exp(-1), 4);
  });
  it('отрицательная delta → 0', () => expect(dampFactor(-50, 100)).toBeCloseTo(0));
  it('smoothing=0 не падает', () => expect(() => dampFactor(100, 0)).not.toThrow());
});

// ── getPaletteRouteHex ────────────────────────────────────────

describe('getPaletteRouteHex', () => {
  it('возвращает строку HEX', () => {
    const c = getPaletteRouteHex(0);
    expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
  it('детерминированный', () => {
    expect(getPaletteRouteHex(5)).toBe(getPaletteRouteHex(5));
  });
  it('циклически повторяется через 15', () => {
    expect(getPaletteRouteHex(0)).toBe(getPaletteRouteHex(15));
    expect(getPaletteRouteHex(3)).toBe(getPaletteRouteHex(18));
  });
  it('разные индексы дают разные цвета внутри одной палитры', () => {
    expect(getPaletteRouteHex(0)).not.toBe(getPaletteRouteHex(1));
  });
});
