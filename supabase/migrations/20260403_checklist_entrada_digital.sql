-- Add checklist_token column to party_hall_bookings
ALTER TABLE party_hall_bookings 
ADD COLUMN IF NOT EXISTS checklist_token text UNIQUE;

-- Create party_hall_digital_checklists table
CREATE TABLE IF NOT EXISTS party_hall_digital_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES party_hall_bookings(id) ON DELETE CASCADE NOT NULL,
  condominium_id uuid REFERENCES condominiums(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  signer_ip text,
  signer_geolocation jsonb,
  signature_image text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  general_observations text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE party_hall_digital_checklists ENABLE ROW LEVEL SECURITY;

-- Public can insert checklists via token
CREATE POLICY "Public can insert checklists via token"
ON party_hall_digital_checklists
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Public can select checklists by token
CREATE POLICY "Public can select checklists by token"
ON party_hall_digital_checklists
FOR SELECT
TO anon, authenticated
USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_party_hall_bookings_checklist_token 
ON party_hall_bookings(checklist_token) WHERE checklist_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_party_hall_digital_checklists_token 
ON party_hall_digital_checklists(token);

CREATE INDEX IF NOT EXISTS idx_party_hall_digital_checklists_booking_id 
ON party_hall_digital_checklists(booking_id);
