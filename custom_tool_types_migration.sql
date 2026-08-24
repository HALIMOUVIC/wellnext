-- ====================================================================
-- MIGRATION: custom_tool_types (Catalogue des Composants)
-- UI columns only: type, french_designation, default_name
-- Run in Supabase SQL Editor. Safe to re-run.
-- ====================================================================

-- 1. Create table (simplified — matches photo UI)
CREATE TABLE IF NOT EXISTS public.custom_tool_types (
  id VARCHAR(100) PRIMARY KEY DEFAULT 'tooltype-' || md5(random()::text),
  type VARCHAR(255) NOT NULL UNIQUE,
  default_name VARCHAR(255) NOT NULL,
  default_od VARCHAR(100) DEFAULT '2''7/8',
  default_custom_type VARCHAR(100) DEFAULT 'EU',
  default_min_id VARCHAR(100) DEFAULT '',
  french_designation VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ensure core columns exist
ALTER TABLE public.custom_tool_types ADD COLUMN IF NOT EXISTS type VARCHAR(255);
ALTER TABLE public.custom_tool_types ADD COLUMN IF NOT EXISTS default_name VARCHAR(255);
ALTER TABLE public.custom_tool_types ADD COLUMN IF NOT EXISTS default_od VARCHAR(100) DEFAULT '2''7/8';
ALTER TABLE public.custom_tool_types ADD COLUMN IF NOT EXISTS default_custom_type VARCHAR(100) DEFAULT 'EU';
ALTER TABLE public.custom_tool_types ADD COLUMN IF NOT EXISTS default_min_id VARCHAR(100) DEFAULT '';
ALTER TABLE public.custom_tool_types ADD COLUMN IF NOT EXISTS french_designation VARCHAR(255);
ALTER TABLE public.custom_tool_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.custom_tool_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Drop removed rendering columns (if upgrading from older schema)
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS french_type;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS render_type;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS vector_type;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS fill_color;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS stroke_color;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS stroke_width;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS image_url;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS view_box;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS main_scale;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS print_scale;
ALTER TABLE public.custom_tool_types DROP COLUMN IF EXISTS min_height;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_custom_tool_types_type ON public.custom_tool_types(type);

-- 5. updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custom_tool_types_updated_at ON public.custom_tool_types;
CREATE TRIGGER trigger_custom_tool_types_updated_at
  BEFORE UPDATE ON public.custom_tool_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Row Level Security
ALTER TABLE public.custom_tool_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to custom_tool_types" ON public.custom_tool_types;
DROP POLICY IF EXISTS "Allow public insert to custom_tool_types" ON public.custom_tool_types;
DROP POLICY IF EXISTS "Allow public update to custom_tool_types" ON public.custom_tool_types;
DROP POLICY IF EXISTS "Allow public delete to custom_tool_types" ON public.custom_tool_types;

CREATE POLICY "Allow public read access to custom_tool_types"
  ON public.custom_tool_types FOR SELECT USING (true);

CREATE POLICY "Allow public insert to custom_tool_types"
  ON public.custom_tool_types FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to custom_tool_types"
  ON public.custom_tool_types FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to custom_tool_types"
  ON public.custom_tool_types FOR DELETE USING (true);

-- 7. Seed catalogue (matches production UI)
INSERT INTO public.custom_tool_types (
  id, type, default_name, default_od, default_custom_type, default_min_id, french_designation
) VALUES
  ('tooltype-tubing', 'Tubing', 'Tubing 2''7/8', '2''7/8', 'EU', '', 'Tubing'),
  ('tooltype-anchor-seal', 'Anchor-seal', 'Anchor-seal', '2''7/8', 'EU', '', 'Anchor-seal'),
  ('tooltype-drill', 'Drill', 'Drill', '2''7/8', 'EU', '', 'Drill'),
  ('tooltype-other', 'Other', 'Autre composant', '2''7/8', 'EU', '', 'Autre'),
  ('tooltype-packer', 'packer', 'packer', '2''7/8', 'D', '', 'packer'),
  ('tooltype-reduction', 'Reduction', 'Réduction', '2''7/8', 'EU', '', 'Réduction'),
  ('tooltype-seating-nipple', 'Seating Nipple', 'Siège (Seating Nipple)', '2''7/8', 'EU', '', 'Siège'),
  ('tooltype-shoe', 'Shoe', 'Sabot (Tubing Shoe)', '2''7/8', 'EU', '', 'Sabot'),
  ('tooltype-mandrel', 'Side-pocket Mandrel', 'Mandrin (Side-pocket)', '2''7/8', 'EU', '', 'Mandrin'),
  ('tooltype-sliding-sleeve', 'sliding-sleeve', 'Sliding Sleeve', '2''7/8', 'EU', '', 'Sliding Sleeve')
ON CONFLICT (type) DO UPDATE SET
  default_name = EXCLUDED.default_name,
  french_designation = EXCLUDED.french_designation,
  default_od = EXCLUDED.default_od,
  default_custom_type = EXCLUDED.default_custom_type,
  default_min_id = EXCLUDED.default_min_id,
  updated_at = NOW();
