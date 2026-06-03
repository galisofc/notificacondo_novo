ALTER TABLE porter_occurrences ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false;
-- Recarregar cache
NOTIFY pgrst, 'reload schema';
