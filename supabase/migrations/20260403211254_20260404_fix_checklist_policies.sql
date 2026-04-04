-- Fix migration: make checklist policies idempotent
-- This migration fixes the duplicate policy error

-- Drop policies if they exist (idempotent fix)
DROP POLICY IF EXISTS "Public can insert checklists via token" ON party_hall_digital_checklists;
DROP POLICY IF EXISTS "Public can select checklists by token" ON party_hall_digital_checklists;

-- Recreate policies
CREATE POLICY "Public can insert checklists via token"
ON party_hall_digital_checklists
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can select checklists by token"
ON party_hall_digital_checklists
FOR SELECT
TO anon, authenticated
USING (true);
