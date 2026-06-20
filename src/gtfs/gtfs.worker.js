import JSZip from 'jszip';
import Papa from 'papaparse';

function parseCsv(text) {
  return Papa.parse(text.trim(), { header: true, skipEmptyLines: true }).data;
}

function parseTimeMin(t) {
  if (!t) return 0;
  const p = t.split(':');
  return parseInt(p[0]) * 60 + parseInt(p[1]);
}

self.onmessage = async (e) => {
  const { buf, lang } = e.data;

  try {
    self.postMessage({ type: 'progress', step: 'unzip' });
    const t0 = performance.now();
    const zip = await JSZip.loadAsync(buf);
    console.log(`[Worker] unzip: ${(performance.now()-t0).toFixed(0)}ms`);

    const readFile = async (name) => {
      const f = zip.file(name);
      return f ? parseCsv(await f.async('string')) : [];
    };

    self.postMessage({ type: 'progress', step: 'parse' });
    const t1 = performance.now();
    const [routes, trips, stops, stopTimes, shapes, calendar] = await Promise.all([
      readFile('routes.txt'),
      readFile('trips.txt'),
      readFile('stops.txt'),
      readFile('stop_times.txt'),
      readFile('shapes.txt'),
      readFile('calendar.txt'),
    ]);

    console.log(`[Worker] parse: ${(performance.now()-t1).toFixed(0)}ms — routes:${routes.length} trips:${trips.length} stops:${stops.length} stop_times:${stopTimes.length}`);
    self.postMessage({ type: 'progress', step: 'index' });
    const t2 = performance.now();

    const routeMetaById = {};
    for (const r of routes) {
      routeMetaById[r.route_id] = {
        id: r.route_id,
        name: r.route_short_name || r.route_long_name,
        hex: r.route_color ? `#${r.route_color}` : '#1e78d0',
        shortName: r.route_short_name || r.route_id,
      };
    }

    const tripToRoute = {};
    const tripToService = {};
    for (const t of trips) {
      if (t.trip_id && t.route_id) tripToRoute[t.trip_id] = t.route_id;
      if (t.trip_id && t.service_id) tripToService[t.trip_id] = t.service_id;
    }

    const arrivalsByStopId = {};
    for (const row of stopTimes) {
      const routeId = tripToRoute[row.trip_id];
      if (!routeId) continue;
      const dep = row.departure_time || row.arrival_time;
      if (!dep) continue;
      const stopId = row.stop_id;
      const meta = routeMetaById[routeId];
      const arrival = {
        tripId: row.trip_id,
        time: dep,
        mins: parseTimeMin(dep),
        routeId,
        routeShort: meta?.shortName || routeId,
      };
      if (!arrivalsByStopId[stopId]) arrivalsByStopId[stopId] = [];
      arrivalsByStopId[stopId].push(arrival);
    }
    for (const arr of Object.values(arrivalsByStopId)) arr.sort((a, b) => a.mins - b.mins);

    // Build shapes
    const shapesByShapeId = {};
    for (const pt of shapes) {
      if (!pt.shape_id) continue;
      if (!shapesByShapeId[pt.shape_id]) shapesByShapeId[pt.shape_id] = [];
      shapesByShapeId[pt.shape_id].push(pt);
    }
    for (const pts of Object.values(shapesByShapeId)) {
      pts.sort((a, b) => (+a.shape_pt_sequence) - (+b.shape_pt_sequence));
    }

    const firstShapeByRoute = {};
    for (const t of trips) {
      if (!t.route_id || !t.shape_id) continue;
      if (!firstShapeByRoute[t.route_id]) firstShapeByRoute[t.route_id] = t.shape_id;
    }

    const calendarByServiceId = {};
    for (const row of calendar) {
      calendarByServiceId[row.service_id] = row;
    }

    console.log(`[Worker] index: ${(performance.now()-t2).toFixed(0)}ms — arrivalsByStopId: ${Object.keys(arrivalsByStopId).length} stops`);
    // Convert Maps to plain objects for structured clone (Worker → main thread)
    self.postMessage({
      type: 'done',
      data: {
        routes,
        stops,
        routeMetaById,
        arrivalsByStopId,
        tripToService,
        tripToRoute,
        calendarByServiceId,
        shapesByShapeId,
        firstShapeByRoute,
      },
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
