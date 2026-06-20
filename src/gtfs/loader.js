const CACHE_NAME = 'gtfs-feeds-v1';
const BASE = 'https://sayr777.github.io/kamchatka-transit/public';

const FEEDS = {
  ru: `${BASE}/gtfs_ru.zip`,
  en: `${BASE}/gtfs_en.zip`,
  zh: `${BASE}/gtfs_cn.zip`,
  ja: `${BASE}/gtfs_jp.zip`,
};

async function fetchWithCache(url) {
  if ('caches' in window) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) return cached.arrayBuffer();
    const res = await fetch(url);
    if (res.ok) cache.put(url, res.clone()).catch(() => {});
    return res.arrayBuffer();
  }
  return (await fetch(url)).arrayBuffer();
}

export function loadGtfsFeed(lang, onProgress) {
  return new Promise(async (resolve, reject) => {
    const url = FEEDS[lang] || FEEDS.ru;
    let buf;
    try {
      console.log(`[GTFS] fetch: ${url}`);
      onProgress?.('download');
      buf = await fetchWithCache(url);
      console.log(`[GTFS] fetched ${(buf.byteLength / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.error('[GTFS] fetch failed:', e);
      return reject(new Error(`Нет сети и кеша для GTFS`));
    }

    const worker = new Worker(
      new URL('./gtfs.worker.js', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e) => {
      const { type, data, step, message } = e.data;
      if (type === 'progress') {
        console.log(`[GTFS] worker: ${step}`);
        onProgress?.(step);
      } else if (type === 'done') {
        worker.terminate();
        console.log(`[GTFS] done — stops: ${data.stops?.length}, routes: ${Object.keys(data.routeMetaById).length}, stop_times entries: ${Object.keys(data.arrivalsByStopId).length} stops indexed`);
        // Convert plain objects back to Maps for store compatibility
        const result = {
          ...data,
          routeMetaById:       new Map(Object.entries(data.routeMetaById)),
          arrivalsByStopId:    new Map(Object.entries(data.arrivalsByStopId)),
          tripToService:       new Map(Object.entries(data.tripToService)),
          tripToRoute:         new Map(Object.entries(data.tripToRoute)),
          calendarByServiceId: new Map(Object.entries(data.calendarByServiceId)),
          shapesByShapeId:     new Map(Object.entries(data.shapesByShapeId)),
          firstShapeByRoute:   new Map(Object.entries(data.firstShapeByRoute)),
        };
        resolve(result);
      } else if (type === 'error') {
        console.error('[GTFS] worker error:', message);
        worker.terminate();
        reject(new Error(message));
      }
    };

    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };

    // Transfer buffer to worker (zero-copy)
    worker.postMessage({ buf, lang }, [buf]);
  });
}

export async function refreshFeedsInBackground() {
  if (!navigator.onLine) return;
  const cache = await caches.open(CACHE_NAME);
  for (const url of Object.values(FEEDS)) {
    try {
      const res = await fetch(url);
      if (res.ok) await cache.put(url, res);
    } catch {}
  }
}
