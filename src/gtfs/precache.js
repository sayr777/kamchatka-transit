const MAPBOX_TOKEN = 'pk.eyJ1IjoiYW50b24wNjEyIiwiYSI6ImNtcWltNWt2NzAwNW0ydHM5eXlkcGZ6cjAifQ.8PaloVhi21MZLJfuFNIibA';
const TILE_CACHE = 'transit-pwa-tiles-pk-v1';

const BBOX = { minLon: 158.35, maxLon: 159.10, minLat: 52.75, maxLat: 53.30 };
const ZOOMS = [8, 9, 10, 11, 12, 13, 14];

function lon2tile(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
function lat2tile(lat, z) { return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z)); }

function buildUrls() {
  const urls = [];
  for (const z of ZOOMS) {
    const x0 = lon2tile(BBOX.minLon, z), x1 = lon2tile(BBOX.maxLon, z);
    const y0 = lat2tile(BBOX.maxLat, z), y1 = lat2tile(BBOX.minLat, z);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        urls.push(`https://api.mapbox.com/styles/v1/anton0612/cmqinytnv001z01pmbzqogxpa/tiles/256/${z}/${x}/${y}?access_token=${MAPBOX_TOKEN}`);
  }
  return urls;
}

export async function precacheRegionTiles(onProgress) {
  const urls = buildUrls();
  console.log(`[offline] precaching ${urls.length} tiles for PKC region`);

  const cache = await caches.open(TILE_CACHE);
  let done = 0;

  // Process in batches of 10 to avoid overwhelming the network
  const BATCH = 10;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const existing = await cache.match(url);
          if (existing) { done++; return; }
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        } catch {}
        done++;
        onProgress?.(done, urls.length);
      })
    );
  }
  return urls.length;
}
