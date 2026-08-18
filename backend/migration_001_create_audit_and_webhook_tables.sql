-- Migration 001: Create audit logs and webhook_events tables
-- Run this once against your PostgreSQL database (e.g., psql -f migration_001_create_audit_and_webhook_tables.sql)

-- Logs table (audit trail)
CREATE TABLE IF NOT EXISTS logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook events table (store raw payload/signature and processed flag for idempotency/audit)
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT,
  provider TEXT,
  payload JSONB,
  signature TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recharges table (idempotency for payment provider credits)
CREATE TABLE IF NOT EXISTS recharges (
  id BIGSERIAL PRIMARY KEY,
  payment_id TEXT UNIQUE,
  student_id BIGINT,
  amount NUMERIC(12,2),
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes to help retention queries
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_recharges_payment_id ON recharges(payment_id);
