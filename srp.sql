-- ====================================================================
-- MIGRATION: srp_components (Colonne SRP / Surface Rod Pump)
-- Run in Supabase SQL Editor to support SRP components per well.
-- ====================================================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.srp_components (
  id VARCHAR(255) PRIMARY KEY,
  well_id VARCHAR(255) NOT NULL REFERENCES public.wells(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  qty VARCHAR(100) DEFAULT '01',
  type VARCHAR(255) DEFAULT 'SRP',
  custom_type VARCHAR(255) DEFAULT '-',
  od VARCHAR(100) DEFAULT '',
  length NUMERIC NOT NULL DEFAULT 0,
  bottom_depth NUMERIC NOT NULL DEFAULT 0,
  is_cote_product_added BOOLEAN DEFAULT true,
  observations TEXT DEFAULT '',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_srp_components_well_id ON public.srp_components(well_id);

-- 3. Row Level Security
ALTER TABLE public.srp_components ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'srp_components' AND policyname = 'Allow public access to srp_components'
  ) THEN
    CREATE POLICY "Allow public access to srp_components"
      ON public.srp_components FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Automatic updated_at Trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_srp_components_updated_at'
  ) THEN
    CREATE TRIGGER trigger_srp_components_updated_at
      BEFORE UPDATE ON public.srp_components
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
