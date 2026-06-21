import JSZip from 'jszip';
import Papa from 'papaparse';
import { buildRouteConditionsIndex } from '../utils/transportConditions.js';
import { adjacencyToObject, buildPlannerAdjacency } from '../utils/planner.js';

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
    const [routes, trips, stops, stopTimes, shapes, calendar, frequencies, vehicles, vehicleTrips] = await Promise.all([
      readFile('routes.txt'),
      readFile('trips.txt'),
      readFile('stops.txt'),
      readFile('stop_times.txt'),
      readFile('shapes.txt'),
      readFile('calendar.txt'),
      readFile('frequencies.txt'),
      readFile('vehicles.txt'),
      readFile('vehicle_trips.txt'),
    ]);

    console.log(`[Worker] parse: ${(performance.now()-t1).toFixed(0)}ms — routes:${routes.length} trips:${trips.length} stops:${stops.length} stop_times:${stopTimes.length}`);
    self.postMessage({ type: 'progress', step: 'index' });
    const t2 = performance.now();

    const inferRouteType = (route) => {
      const base = parseInt(route.route_type, 10);
      if (Number.isFinite(base) && base !== 3) return base;
      const sn = String(route.route_short_name || '').trim().toLowerCase();
      if (/к$/u.test(sn) || sn.includes('марш')) return 200;
      return Number.isFinite(base) ? base : 3;
    };

    const routeMetaById = {};
    for (const r of routes) {
      routeMetaById[r.route_id] = {
        id: r.route_id,
        name: r.route_short_name || r.route_long_name,
        hex: r.route_color ? `#${r.route_color}` : '#1e78d0',
        shortName: r.route_short_name || r.route_id,
        routeType: inferRouteType(r),
      };
    }

    const vehicleTypeById = {};
    for (const v of vehicles) {
      if (!v.vehicle_id) continue;
      const vt = parseInt(v.vehicle_type, 10);
      vehicleTypeById[v.vehicle_id] = Number.isFinite(vt) ? vt : 3;
    }

    const tripToRoute = {};
    const tripToService = {};
    const tripMetaById = {};
    for (const t of trips) {
      if (t.trip_id && t.route_id) tripToRoute[t.trip_id] = t.route_id;
      if (t.trip_id && t.service_id) tripToService[t.trip_id] = t.service_id;
      if (t.trip_id) tripMetaById[t.trip_id] = t;
    }

    const stopById = new Map();
    for (const row of stops) {
      const lon = +row.stop_lon;
      const lat = +row.stop_lat;
      if (!row.stop_id || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      stopById.set(row.stop_id, {
        stop_id: row.stop_id,
        name: row.stop_name || row.stop_id,
        lon,
        lat,
      });
    }

    const arrivalsByStopId = {};
    const stopIdsByRouteId = {};
    const routeIdsByStopId = {};
    const stopTimesByTrip = {};
    const tripFirstDepMinByTripId = {};
    for (const row of stopTimes) {
      if (row.trip_id) {
        if (!stopTimesByTrip[row.trip_id]) stopTimesByTrip[row.trip_id] = [];
        stopTimesByTrip[row.trip_id].push({
          stop_id: row.stop_id,
          stop_sequence: row.stop_sequence,
          departure_time: row.departure_time,
          arrival_time: row.arrival_time,
        });
        const dep = row.departure_time || row.arrival_time;
        const seq = +row.stop_sequence;
        if (dep && Number.isFinite(seq)) {
          const depMin = parseTimeMin(dep);
          const prev = tripFirstDepMinByTripId[row.trip_id];
          if (prev == null || seq < prev.seq) {
            tripFirstDepMinByTripId[row.trip_id] = { seq, depMin };
          }
        }
      }
      const routeId = tripToRoute[row.trip_id];
      if (!routeId) continue;
      const stopId = row.stop_id;
      if (stopId) {
        if (!stopIdsByRouteId[routeId]) stopIdsByRouteId[routeId] = new Set();
        stopIdsByRouteId[routeId].add(stopId);
        if (!routeIdsByStopId[stopId]) routeIdsByStopId[stopId] = new Set();
        routeIdsByStopId[stopId].add(routeId);
      }
      const dep = row.departure_time || row.arrival_time;
      if (!dep) continue;
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
    const stopIdsByRouteIdArr = {};
    for (const [routeId, ids] of Object.entries(stopIdsByRouteId)) {
      stopIdsByRouteIdArr[routeId] = [...ids];
    }
    const routeIdsByStopIdArr = {};
    for (const [stopId, ids] of Object.entries(routeIdsByStopId)) {
      routeIdsByStopIdArr[stopId] = [...ids];
    }

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

    const frequenciesByTripId = {};
    for (const row of frequencies) {
      if (!row.trip_id) continue;
      const startMin = parseTimeMin(row.start_time);
      const endMin = parseTimeMin(row.end_time);
      const headwaySec = Math.max(0, +row.headway_secs || 0);
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin || !headwaySec) continue;
      if (!frequenciesByTripId[row.trip_id]) frequenciesByTripId[row.trip_id] = [];
      frequenciesByTripId[row.trip_id].push({
        startMin,
        endMin,
        headwaySec,
        exactTimes: row.exact_times ?? '0',
      });
    }

    const tripFirstDepMinFlat = {};
    for (const [tripId, row] of Object.entries(tripFirstDepMinByTripId)) {
      tripFirstDepMinFlat[tripId] = row.depMin;
    }

    const routeConditionsById = buildRouteConditionsIndex(trips, vehicles, vehicleTrips);

    const t3 = performance.now();
    const plannerAdjacency = adjacencyToObject(
      buildPlannerAdjacency(stopById, stopTimesByTrip, tripMetaById, routeMetaById),
    );
    console.log(`[Worker] planner: ${(performance.now() - t3).toFixed(0)}ms — ${Object.keys(plannerAdjacency).length} stop nodes`);

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
        tripMetaById,
        frequenciesByTripId,
        tripFirstDepMinByTripId: tripFirstDepMinFlat,
        calendarByServiceId,
        shapesByShapeId,
        firstShapeByRoute,
        stopIdsByRouteId: stopIdsByRouteIdArr,
        routeIdsByStopId: routeIdsByStopIdArr,
        routeConditionsById,
        vehicleTypeById,
        plannerAdjacency,
      },
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
