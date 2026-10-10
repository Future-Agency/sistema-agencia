# tienda-vision

Sistema para sacarle datos a las cámaras que ya tenés en el negocio:

- **Patrones de compra**: cuánta gente entra por hora, cuánto se queda frente a cada góndola, mapas de calor, largo de la cola, conversión visitas → ventas cruzando con el POS.
- **Robo interno**: motor de excepciones sobre las transacciones del POS (anulaciones tardías, devoluciones sin ticket, descuentos altos, cajón sin venta, cajeros fuera de la curva) cruzado con lo que ve la cámara de caja (venta sin cliente, cliente sin venta).
- **Alertas de comportamiento**: merodeo, zona restringida, local cerrado con gente adentro, cola larga. Cada alerta guarda un clip corto y se puede mandar a Claude para que lo describa y lo priorice.

Lo que **no** hace: detección de hurto por gestos (ocultar producto en bolso). Eso es un modelo entrenado con millones de clips, lo cubre un proveedor como Veesion. Este sistema se lleva bien al lado de uno de esos.

Principios: corre local, guarda **eventos y no video**, no identifica personas (sin reconocimiento facial).

## Arquitectura

```
cámaras RTSP ──► vision/ (YOLO + ByteTrack + zonas) ──eventos JSON──► api/ (FastAPI) ──► Postgres (Supabase) o SQLite
                 │                                                      ▲
                 └── recorder (ffmpeg, segmentos 60 s, 48 h)            │
                                                                        │
POS (CSV o API) ─────────────────────────────────────────────────────────┘
                                                                        │
                                              alertas ──clip──► Claude (revisión estructurada)
```

| Carpeta | Qué hay |
|---|---|
| `vision/` | Motor por cámara: detección de personas, tracking, líneas de conteo, zonas, mapa de calor, alertas, clips. `recorder.py` graba segmentos continuos con ffmpeg. |
| `api/` | FastAPI: ingesta de eventos, carga del POS, motor de excepciones, alertas, métricas, revisión con Claude. |
| `api/pos/exceptions.py` | Las reglas de robo interno, en Python puro y testeadas. |
| `config/cameras.yaml` | Cámaras, líneas, zonas, horarios, umbrales, mapeo terminal POS → cámara. |
| `sql/001_schema.sql` | Esquema para Supabase (la API lo crea sola igual). |
| `samples/` | Generadores de un video y un CSV de prueba para correr todo sin cámaras. |
| `tests/` | 16 tests: zonas, reglas del POS, adaptador CSV, flujo completo de la API. |

## Instalación

Necesitás Python 3.11+ y ffmpeg.

```bash
cd tienda-vision
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Con GPU NVIDIA instalá antes el torch con CUDA según https://pytorch.org y cambiá `model.weights` a `yolo11s.pt` o `yolo11m.pt` en el config. En CPU `yolo11n.pt` procesa una cámara a ~8 frames por segundo, suficiente con `frame_stride: 3`.

## Probarlo sin cámaras (5 minutos)

```bash
# 1) API
uvicorn api.main:app --port 8000          # docs en http://localhost:8000/docs

# 2) video sintético con una persona que entra, se queda en la vidriera y se va
python samples/make_sample_video.py samples/demo_entrada.mp4
python -m vision.run --camera entrada --source samples/demo_entrada.mp4 --sink http --start-ts 2026-10-09T15:00:00

# 3) un día de ventas con un cajero que se porta raro
python samples/make_sample_pos.py samples/pos_ventas_ejemplo.csv
curl -F file=@samples/pos_ventas_ejemplo.csv localhost:8000/pos/import/csv
curl -X POST localhost:8000/pos/analyze -H 'content-type: application/json' -d '{}'

# 4) mirar resultados
curl localhost:8000/alerts
curl localhost:8000/pos/cashiers
curl "localhost:8000/metrics/conversion?bucket=hour"
curl localhost:8000/metrics/summary
```

Para que la alerta de merodeo salte con el video de 23 segundos, bajá `alerts.loitering_seconds` a 5 en el config.

Tests: `pytest -q`.

## Con cámaras reales

1. Conseguí la URL RTSP de cada cámara. Hikvision: `rtsp://usuario:clave@IP:554/Streaming/Channels/101`. Dahua: `rtsp://usuario:clave@IP:554/cam/realmonitor?channel=1&subtype=0`. Si tenés DVR, el DVR expone las mismas URLs con el número de canal. Probá con `ffplay URL`.
2. Sacá una captura de cada cámara y dibujá las zonas en `config/cameras.yaml` con coordenadas relativas 0..1. Tipos de zona:
   - `gondola`: dispara merodeo si alguien se queda más de `loitering_seconds`.
   - `cola`: dispara cola larga si hay más de `queue_max`.
   - `caja_cliente` y `caja_empleado`: se usan para cruzar con el POS.
   - `restringida`: alerta si entra alguien fuera de horario (o siempre, con `restricted_always: true`).
   Las líneas (`lines`) cuentan entradas y salidas según `in_direction`.
3. Corré todo: `python -m vision.run --all --sink http`. Levanta un proceso por cámara y, si `record: true`, un grabador ffmpeg por cámara en `RECORDINGS_DIR` con 48 h de retención.

## POS

Dos formas de cargar transacciones:

- **CSV exportado**: `POST /pos/import/csv` con el archivo. El mapeo por defecto espera `id,fecha,terminal,cajero,tipo,total,items,descuento_pct,ref`. Para otro formato mandá `mapping` como JSON `{"pos_tx_id": "nro", "ts": "hora", ...}`. Los tipos en español se normalizan solos (venta, anulación, devolución, sin venta, cancelación).
- **API o webhook**: `POST /pos/transactions` con una lista JSON. Ideal si el POS puede avisar en tiempo real.

Después `POST /pos/analyze` corre las reglas y crea alertas sin duplicar. Umbrales ajustables en `pos.rules` del config (ver `DEFAULT_RULES` en `api/pos/exceptions.py`).

Para cruzar caja con cámara, mapeá cada terminal del POS a su cámara en `pos.terminal_camera`.

## Alertas y revisión con Claude

- `GET /alerts?status=open` lista lo pendiente. `PATCH /alerts/{id}` para marcar `reviewed`, `dismissed` o `confirmed` con una nota.
- Las alertas de visión ya traen clip. Las del POS no: `POST /alerts/{id}/clip` lo recorta de las grabaciones continuas. `GET /alerts/{id}/clip.mp4` lo descarga.
- `POST /alerts/{id}/review` manda 6 frames del clip a Claude con el contexto de la alerta y guarda un veredicto estructurado: resumen, si es sospechoso, confianza, tipo y recomendación. Si Claude está seguro de que no hay nada raro, la alerta pasa sola a `reviewed`. Necesita `ANTHROPIC_API_KEY`.

## Supabase

Poné en `.env` la connection string de Postgres del proyecto:

```
DATABASE_URL=postgresql+psycopg://postgres.xxxx:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

La API crea las tablas al arrancar. `sql/001_schema.sql` tiene el mismo esquema por si preferís correrlo a mano. Un dashboard Next.js puede leer las tablas directo con el cliente de Supabase o pegarle a `/metrics/*`.

## Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| POST | `/events/batch` | El motor manda eventos acá |
| GET | `/events` | Consultar eventos crudos |
| POST | `/pos/transactions`, `/pos/import/csv` | Cargar ventas |
| POST | `/pos/analyze` | Correr reglas de robo interno |
| GET | `/pos/cashiers` | Resumen por cajero |
| GET/PATCH | `/alerts`, `/alerts/{id}` | Bandeja de alertas |
| POST | `/alerts/{id}/clip`, `/alerts/{id}/review` | Clip y revisión con Claude |
| GET | `/metrics/traffic` | Entradas y salidas por franja |
| GET | `/metrics/dwell` | Permanencia por zona |
| GET | `/metrics/occupancy` | Ocupación por zona (colas) |
| GET | `/metrics/heatmap` | Grilla de calor normalizada por cámara |
| GET | `/metrics/conversion` | Visitantes vs ventas por franja |
| GET | `/metrics/summary` | Números del período |

## Próximos pasos

- Dashboard en Next.js (reusar el stack de `sistema-agencia`): bandeja de alertas con el clip, curva de tráfico vs ventas, mapa de calor sobre la captura de cada cámara, ranking de cajeros.
- Conteo de productos en caja para detectar no escaneo (detector de objetos sobre la cinta vs líneas del ticket). Es la parte más experimental.
- Reporte semanal en lenguaje natural generado con Claude a partir de `/metrics/*`.
- Si hace falta hurto por gestos, integrar las alertas de Veesion como un `source` más en la tabla de alertas.
