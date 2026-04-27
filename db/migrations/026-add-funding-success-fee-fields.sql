-- VestBlock funding strategy success fee disclosure fields.

ALTER TABLE funding_strategy_requests
  ADD COLUMN IF NOT EXISTS success_fee_rate NUMERIC DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS consent_success_fee BOOLEAN DEFAULT FALSE;
