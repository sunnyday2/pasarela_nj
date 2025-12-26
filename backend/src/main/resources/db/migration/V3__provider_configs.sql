UPDATE payment_intents SET provider = 'MASTERCARD' WHERE provider = 'TRANSBANK';
UPDATE routing_decisions SET chosen_provider = 'MASTERCARD' WHERE chosen_provider = 'TRANSBANK';
UPDATE payment_events SET provider = 'MASTERCARD' WHERE provider = 'TRANSBANK';
UPDATE provider_health_snapshot SET provider = 'MASTERCARD' WHERE provider = 'TRANSBANK';
UPDATE merchant_provider_configs SET provider = 'MASTERCARD' WHERE provider = 'TRANSBANK';
UPDATE merchants SET config_json = REPLACE(config_json, 'TRANSBANK', 'MASTERCARD') WHERE config_json LIKE '%TRANSBANK%';

CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json_enc TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_configs_provider ON provider_configs(provider);
