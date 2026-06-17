#!/usr/bin/env python3
"""Basic GTFS Schedule validator for local folders or feed ZIP files."""

from __future__ import annotations

import argparse
import csv
import io
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

REQUIRED_FILES = {
    "stops.txt": {"stop_id", "stop_name"},
    "routes.txt": {"route_id"},
    "trips.txt": {"route_id", "service_id", "trip_id"},
    "stop_times.txt": {"trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"},
}

OPTIONAL_FILES = [
    "calendar.txt",
    "calendar_dates.txt",
    "frequencies.txt",
    "transfers.txt",
    "feed_info.txt",
]


def read_text_file(base: Path, name: str) -> str | None:
    path = base / name
    return path.read_text(encoding="utf-8-sig") if path.exists() else None


def read_zip_file(zip_path: Path, name: str) -> str | None:
    with zipfile.ZipFile(zip_path) as zf:
      try:
          with zf.open(name) as fh:
              return fh.read().decode("utf-8-sig")
      except KeyError:
          return None


def load_table(text: str) -> Tuple[List[str], List[dict]]:
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    return reader.fieldnames or [], rows


def as_date(value: str) -> datetime | None:
    try:
        return datetime.strptime(value, "%Y%m%d")
    except Exception:
        return None


def check_file(loader, name: str, required_columns: set[str], report: list[str], errors: list[str]) -> List[dict]:
    text = loader(name)
    if text is None:
        errors.append(f"Missing required file: {name}")
        return []
    header, rows = load_table(text)
    missing = required_columns - set(header)
    if missing:
        errors.append(f"{name}: missing columns {', '.join(sorted(missing))}")
    report.append(f"{name}: {len(rows)} row(s)")
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a GTFS feed folder or ZIP")
    parser.add_argument("path", nargs="?", default="./gtfs", help="Path to GTFS directory or zip file")
    args = parser.parse_args()

    feed_path = Path(args.path)
    if not feed_path.exists():
        print(f"ERROR: path not found: {feed_path}")
        return 2

    if feed_path.is_file() and feed_path.suffix.lower() == ".zip":
        loader = lambda name: read_zip_file(feed_path, name)
        source_label = f"ZIP {feed_path}"
    else:
        loader = lambda name: read_text_file(feed_path, name)
        source_label = f"directory {feed_path}"

    report: list[str] = [f"Validating {source_label}"]
    errors: list[str] = []
    warnings: list[str] = []

    tables = {name: check_file(loader, name, cols, report, errors) for name, cols in REQUIRED_FILES.items()}

    optional_loaded = {}
    for name in OPTIONAL_FILES:
        text = loader(name)
        if text is None:
            continue
        header, rows = load_table(text)
        optional_loaded[name] = rows
        report.append(f"{name}: {len(rows)} row(s)")

    trip_ids = {row.get("trip_id") for row in tables["trips.txt"]}
    stop_ids = {row.get("stop_id") for row in tables["stops.txt"]}
    route_ids = {row.get("route_id") for row in tables["routes.txt"]}
    service_ids = {row.get("service_id") for row in tables["trips.txt"]}

    stop_times_by_trip: Dict[str, List[dict]] = defaultdict(list)
    for row in tables["stop_times.txt"]:
        trip_id = row.get("trip_id")
        stop_id = row.get("stop_id")
        if trip_id not in trip_ids:
            errors.append(f"stop_times.txt references unknown trip_id {trip_id}")
        if stop_id not in stop_ids:
            errors.append(f"stop_times.txt references unknown stop_id {stop_id}")
        stop_times_by_trip[trip_id].append(row)

    for row in tables["trips.txt"]:
        if row.get("route_id") not in route_ids:
            errors.append(f"trips.txt references unknown route_id {row.get('route_id')}")

    calendar_rows = optional_loaded.get("calendar.txt", [])
    calendar_dates_rows = optional_loaded.get("calendar_dates.txt", [])
    calendar_services = {row.get("service_id") for row in calendar_rows}
    exception_services = {row.get("service_id") for row in calendar_dates_rows}
    if calendar_rows or calendar_dates_rows:
        for service_id in service_ids:
            if service_id not in calendar_services and service_id not in exception_services:
                warnings.append(f"service_id {service_id} has no calendar.txt or calendar_dates.txt entry")
    else:
        warnings.append("No calendar.txt or calendar_dates.txt found; service availability cannot be validated")

    for trip_id, rows in stop_times_by_trip.items():
        seqs = [int(row["stop_sequence"]) for row in rows if row.get("stop_sequence", "").isdigit()]
        if len(seqs) != len(rows):
            errors.append(f"trip {trip_id} has non-numeric stop_sequence values")
            continue
        if seqs != sorted(seqs):
            errors.append(f"trip {trip_id} stop_sequence values are not sorted")
        if len(rows) < 2:
            warnings.append(f"trip {trip_id} has fewer than 2 stop_times")

    if calendar_rows:
        coverage_end = max((as_date(row.get("end_date", "")) for row in calendar_rows), default=None)
        if coverage_end:
            remaining = (coverage_end - datetime.utcnow()).days
            if remaining < 7:
                warnings.append(f"Calendar coverage ends soon: {coverage_end:%Y-%m-%d} ({remaining} day(s) left)")

    if optional_loaded.get("frequencies.txt"):
        for row in optional_loaded["frequencies.txt"]:
            try:
                headway = int(row.get("headway_secs", "0"))
                if headway <= 0:
                    errors.append(f"frequencies.txt invalid headway_secs for trip {row.get('trip_id')}")
            except ValueError:
                errors.append(f"frequencies.txt non-numeric headway_secs for trip {row.get('trip_id')}")

    print("\n".join(report))
    if warnings:
        print("\nWarnings:")
        print("\n".join(f"- {item}" for item in warnings[:50]))
    if errors:
        print("\nErrors:")
        print("\n".join(f"- {item}" for item in errors[:50]))
        return 1

    print("\nValidation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
