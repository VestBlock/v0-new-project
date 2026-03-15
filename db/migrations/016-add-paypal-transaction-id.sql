-- Add PayPal transaction ID to payments table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' 
                   AND column_name = 'paypal_transaction_id') THEN
        ALTER TABLE payments ADD COLUMN paypal_transaction_id TEXT;
    END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_transaction ON payments(paypal_transaction_id);
