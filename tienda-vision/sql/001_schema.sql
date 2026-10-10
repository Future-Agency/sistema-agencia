-- Esquema para Supabase / Postgres. Es el mismo que crea la API sola con SQLAlchemy
-- (init_db), este archivo está para poder crearlo a mano o versionarlo.
-- Los timestamps se guardan como epoch en segundos (double precision) para que
-- motor, API y dashboard usen el mismo número sin pelear con zonas horarias.

CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  camera_id   VARCHAR(64)  NOT NULL,
  ts          DOUBLE PRECISION NOT NULL,
  type        VARCHAR(32)  NOT NULL,          -- line_cross | zone_enter | zone_exit | track_end | occupancy
  track_id    INTEGER,
  zone_id     VARCHAR(64),
  line_id     VARCHAR(64),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_events_camera_id ON events (camera_id);
CREATE INDEX IF NOT EXISTS ix_events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS ix_events_type ON events (type);
CREATE INDEX IF NOT EXISTS ix_events_cam_type_ts ON events (camera_id, type, ts);

CREATE TABLE IF NOT EXISTS heatmaps (
  id          BIGSERIAL PRIMARY KEY,
  camera_id   VARCHAR(64) NOT NULL,
  ts          DOUBLE PRECISION NOT NULL,
  window_s    DOUBLE PRECISION NOT NULL,
  rows        INTEGER NOT NULL,
  cols        INTEGER NOT NULL,
  grid        JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_heatmaps_camera_id ON heatmaps (camera_id);
CREATE INDEX IF NOT EXISTS ix_heatmaps_ts ON heatmaps (ts);

CREATE TABLE IF NOT EXISTS transactions (
  id            BIGSERIAL PRIMARY KEY,
  pos_tx_id     VARCHAR(128) NOT NULL UNIQUE,
  ts            DOUBLE PRECISION NOT NULL,
  terminal      VARCHAR(64),
  cashier       VARCHAR(128),
  type          VARCHAR(32) NOT NULL,         -- sale | void | refund | no_sale | discount | cancel
  total         DOUBLE PRECISION NOT NULL DEFAULT 0,
  items_count   INTEGER NOT NULL DEFAULT 0,
  discount_pct  DOUBLE PRECISION NOT NULL DEFAULT 0,
  ref_tx_id     VARCHAR(128),
  lines         JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw           JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_transactions_ts ON transactions (ts);
CREATE INDEX IF NOT EXISTS ix_transactions_terminal ON transactions (terminal);
CREATE INDEX IF NOT EXISTS ix_transactions_cashier ON transactions (cashier);
CREATE INDEX IF NOT EXISTS ix_transactions_type ON transactions (type);

CREATE TABLE IF NOT EXISTS alerts (
  id              BIGSERIAL PRIMARY KEY,
  ts              DOUBLE PRECISION NOT NULL,
  source          VARCHAR(16) NOT NULL,       -- vision | pos
  alert_type      VARCHAR(48) NOT NULL,
  severity        VARCHAR(16) NOT NULL DEFAULT 'media',
  camera_id       VARCHAR(64),
  track_id        INTEGER,
  zone_id         VARCHAR(64),
  transaction_id  BIGINT REFERENCES transactions (id),
  cashier         VARCHAR(128),
  description     TEXT NOT NULL DEFAULT '',
  clip_path       VARCHAR(512),
  review          JSONB,
  status          VARCHAR(16) NOT NULL DEFAULT 'open',  -- open | reviewed | dismissed | confirmed
  note            TEXT,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_alerts_ts ON alerts (ts);
CREATE INDEX IF NOT EXISTS ix_alerts_source ON alerts (source);
CREATE INDEX IF NOT EXISTS ix_alerts_alert_type ON alerts (alert_type);
CREATE INDEX IF NOT EXISTS ix_alerts_camera_id ON alerts (camera_id);
CREATE INDEX IF NOT EXISTS ix_alerts_cashier ON alerts (cashier);
CREATE INDEX IF NOT EXISTS ix_alerts_status ON alerts (status);
CREATE INDEX IF NOT EXISTS ix_alerts_type_tx ON alerts (alert_type, transaction_id);
