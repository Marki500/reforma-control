BEGIN;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS contacted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opinion TEXT NOT NULL DEFAULT '';

ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_trade_check;
ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_trade_length_check CHECK (length(trim(trade)) BETWEEN 1 AND 100),
  ADD CONSTRAINT suppliers_opinion_length_check CHECK (length(opinion) <= 500);

COMMIT;
