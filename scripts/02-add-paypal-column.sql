-- Adds the column to store the PayPal transaction ID, which is used by the webhook
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS paypal_transaction_id TEXT;
