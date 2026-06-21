# GTFS Extensions — vehicles.txt и vehicle_trips.txt

## Обзор

Стандарт GTFS не включает детальную информацию о транспортных средствах. Данный проект использует два нестандартных файла, расширяющих спецификацию GTFS для хранения паспорта ТС и назначений.

---

## vehicles.txt

Справочник транспортных средств парка.

### Поля

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|---------|
| `vehicle_id` | ID | ✓ | Уникальный идентификатор |
| `label` | string | ✓ | Гос. номер (У214АХ 41) |
| `garage_number` | string | | Гаражный номер (01) |
| `vehicle_type` | enum | ✓ | 3=Автобус, 11=Троллейбус, 5=Трамвай |
| `capacity` | integer | | Полная вместимость |
| `seating_capacity` | integer | | Сидячих мест |
| `standing_capacity` | integer | | Стоячих мест |
| `wheelchair` | 0/1 | | Оборудован для кресел-колясок |
| `air_conditioning` | 0/1 | | Кондиционер |
| `heating` | 0/1 | | Отопление |
| `low_floor` | 0/1 | | Низкопольный |
| `cctv` | 0/1 | | Видеонаблюдение |
| `usb` | 0/1 | | USB-зарядка |
| `wifi` | 0/1 | | Wi-Fi |
| `validator` | 0/1 | | Валидатор |
| `fuel_type` | enum | | diesel/electric/hybrid/gas/cng |
| `manufacturer` | string | | Производитель |
| `model` | string | | Модель |
| `year` | integer | | Год выпуска |
| `agency_id` | ID | | Ссылка на agency.txt |
| `depot` | string | | Название парка/депо |
| `notes` | string | | Произвольные заметки |

### Пример

```csv
vehicle_id,label,garage_number,vehicle_type,capacity,seating_capacity,standing_capacity,wheelchair,air_conditioning,heating,low_floor,cctv,usb,wifi,validator,fuel_type,manufacturer,model,year,agency_id,depot,notes
vehicle_37612,У214АХ 41,01,3,80,25,55,1,1,1,1,1,1,1,0,diesel,,,, agency_49996,,Маршрут 3
vehicle_19127,М350КЕ 41,02,3,80,25,55,0,0,1,0,0,0,0,0,diesel,,,,agency_49996,,Маршрут 2
```

---

## vehicle_trips.txt

Назначение ТС на рейсы. Позволяет определить, какой конкретный автобус выполняет какой рейс.

### Поля

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|---------|
| `assignment_id` | ID | ✓ | Уникальный идентификатор назначения |
| `vehicle_id` | ID | ✓ | Ссылка на vehicles.txt |
| `route_id` | ID | ✓ | Ссылка на routes.txt |
| `trip_id` | ID | ✓ | Ссылка на trips.txt |
| `service_id` | ID | | Ссылка на calendar.txt |
| `start_date` | YYYYMMDD | | Начало действия |
| `end_date` | YYYYMMDD | | Конец действия |
| `block_id` | string | | Блок рейсов (для сквозных рейсов) |
| `notes` | string | | Заметки |

### Пример

```csv
assignment_id,vehicle_id,route_id,trip_id,service_id,start_date,end_date,block_id,notes
va_89507,vehicle_37612,route_42721,trip_59056,svc_22304,20260101,20280328,,Маршрут 3
va_07144,vehicle_37612,route_42721,trip_93759,svc_97024,20260101,20280328,,Маршрут 3
```

---

## Использование в приложении

### React-версия (`src/`)

GTFS Worker (`gtfs.worker.js`) пока парсит стандартные файлы: `routes`, `trips`, `stops`, `stop_times`, `shapes`, `calendar`.  
`vehicles.txt` и `vehicle_trips.txt` **не загружаются** в Worker — планируется в P1 (см. `doc/BACKLOG.md`).

Реалтайм-позиции ТС приходят через WebSocket или симулятор (`vehicleTracker.js`), не из `vehicle_trips.txt`.

### Legacy (`app.html`)

```javascript
// Построение маппинга route → vehicle
S.vehicleByRoute = new Map()
for (const vt of S.parsed.vehicleTripsArr) {
  if (!S.vehicleByRoute.has(vt.route_id)) {
    const v = S.vehicles.find(x => x.vehicle_id === vt.vehicle_id)
    if (v) S.vehicleByRoute.set(vt.route_id, v)
  }
}
const vehicle = S.vehicleByRoute.get(routeId)
```

Карточка ТС в legacy использует поля `vehicles.txt` (вместимость, удобства, МГН).
