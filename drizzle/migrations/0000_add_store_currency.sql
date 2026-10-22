ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';
ALTER TABLE public.stores ADD CONSTRAINT stores_currency_iso_code_check CHECK (currency ~ '^[A-Z]{3}$');