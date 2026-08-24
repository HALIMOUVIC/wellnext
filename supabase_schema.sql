-- ====================================================================
-- SUPABASE / POSTGRESQL DATABASE SCHEMA
-- Application: Wellbore Completion Schematic & Spec Cards
-- Description: Core tables, custom types, constraints, and Row Level
--              Security (RLS) policies for full-stack oil & gas
--              well completion management.
-- Date: July 2026
-- ====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. Custom Types and Domains
-- ====================================================================

CREATE TYPE tubing_component_type AS ENUM (
  'Tubing',
  'Packer',
  'Seating Nipple',
  'Shoe',
  'Side-pocket Mandrel',
  'Anchor-seal',
  'Reduction',
  'Sliding Sleeve',
  'Tailpipe',
  'Other'
);

-- ====================================================================
-- 2. Core Tables
-- ====================================================================

-- 2.1 WELLS TABLE
CREATE TABLE IF NOT EXISTS wells (
  id VARCHAR(100) PRIMARY KEY DEFAULT 'well-' || md5(random()::text),
  name VARCHAR(255) NOT NULL,
  purpose VARCHAR(255) DEFAULT 'Oil Producer',
  completion_type VARCHAR(255) DEFAULT 'COMPLETION SIMPLE',
  reservoir VARCHAR(255),
  field VARCHAR(255),
  
  -- Elevations
  elevation_sol NUMERIC(8, 2) DEFAULT 0.00,
  elevation_forage NUMERIC(8, 2) DEFAULT 0.00,
  elevation_production NUMERIC(8, 2) DEFAULT 0.00,
  
  -- Wellhead Equipment
  spool_prod VARCHAR(255),
  packer_type VARCHAR(255),
  susp_tbg VARCHAR(255),
  etan_tbg VARCHAR(255),
  origine_cotes VARCHAR(255),
  
  -- Christmas Tree (Tête d'éruption)
  xmas_tree_brand VARCHAR(255),
  xmas_tree_type VARCHAR(255),
  xmas_tree_ract_sup VARCHAR(255),
  xmas_tree_pressure VARCHAR(100),
  xmas_tree_attache_tbg VARCHAR(255),
  xmas_tree_embase VARCHAR(255),
  xmas_tree_reduction VARCHAR(255),
  xmas_tree_olive VARCHAR(255),
  
  -- Valves Specifications
  -- SAS Valves
  vannes_sas_marque VARCHAR(255),
  vannes_sas_nombre VARCHAR(100),
  vannes_sas_serie VARCHAR(255),
  -- Master Valves
  vannes_maitresse_marque VARCHAR(255),
  vannes_maitresse_nombre VARCHAR(100),
  vannes_maitresse_serie VARCHAR(255),
  -- Lateral Tubing Valves
  vannes_lat_tbg_marque VARCHAR(255),
  vannes_lat_tbg_nombre VARCHAR(100),
  vannes_lat_tbg_serie VARCHAR(255),
  -- Lateral Casing Valves
  vannes_lat_csg_marque VARCHAR(255),
  vannes_lat_csg_nombre VARCHAR(100),
  vannes_lat_csg_serie VARCHAR(255),
  
  -- Technical & Operations Metadata
  observations TEXT,
  folio VARCHAR(100),
  folio_to_cancel VARCHAR(100),
  
  -- Production Tubing Parameters
  prod_tbg_od VARCHAR(100),
  prod_tbg_grade VARCHAR(100),
  prod_tbg_weight VARCHAR(100),
  
  -- Revision dates and approvals
  updated_date VARCHAR(100),
  end_operation_date VARCHAR(100),
  vu_by VARCHAR(255),
  
  -- Audit Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 CASING STRINGS TABLE (Tubages du puits)
CREATE TABLE IF NOT EXISTS casing_strings (
  id VARCHAR(100) PRIMARY KEY DEFAULT 'casing-' || md5(random()::text),
  well_id VARCHAR(100) NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g. "Surface Casing", "Production Casing"
  borehole_size VARCHAR(100) NOT NULL, -- e.g. "12'' 1/4" or "12.25"
  casing_size VARCHAR(100) NOT NULL,   -- e.g. "9'' 5/8" or "9.625"
  
  -- Depths
  top_depth NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  shoe_depth NUMERIC(8, 2) NOT NULL, -- Sabot depth
  drilled_depth NUMERIC(8, 2) NOT NULL, -- Total depth drilled for this section
  top_of_cement NUMERIC(8, 2), -- Top ciment
  top_of_liner NUMERIC(8, 2),  -- Top of liner (TOL)
  
  -- Specifications
  grade VARCHAR(100), -- e.g. "J55", "N80"
  weight NUMERIC(8, 2), -- e.g. 36.00 lbs/ft
  connection VARCHAR(100), -- e.g. "BTC", "VAM"
  observations TEXT,
  
  -- UI Layout Order
  display_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 TUBING COMPONENTS TABLE (Completion assembly/elements)
CREATE TABLE IF NOT EXISTS tubing_components (
  id VARCHAR(100) PRIMARY KEY DEFAULT 'tubing-' || md5(random()::text),
  well_id VARCHAR(100) NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g. "Tubing joint", "Anchor Seal"
  type tubing_component_type NOT NULL DEFAULT 'Tubing',
  
  -- Specifications
  od VARCHAR(100) NOT NULL, -- Outer diameter e.g. "2''7/8"
  length NUMERIC(8, 2) NOT NULL, -- length of single or sequence of joints
  bottom_depth NUMERIC(8, 2) NOT NULL, -- Bottom depth (cote) in meters
  
  is_cote_product_added BOOLEAN DEFAULT FALSE,
  observations TEXT,
  qty VARCHAR(100), -- Quantity (Nb.) e.g. "198 jts" or "1"
  custom_type VARCHAR(100), -- Customized sub-types
  min_id VARCHAR(100), -- Minimum inner diameter e.g. "1''812"
  
  -- Sequence assembly order
  display_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 PERFORATION ZONES TABLE (Intervals de perforation)
CREATE TABLE IF NOT EXISTS perforation_zones (
  id VARCHAR(100) PRIMARY KEY DEFAULT 'perf-' || md5(random()::text),
  well_id VARCHAR(100) NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
  
  -- Depths & Thickness
  top_depth NUMERIC(8, 2) NOT NULL,
  bottom_depth NUMERIC(8, 2) NOT NULL,
  height NUMERIC(8, 2) GENERATED ALWAYS AS (bottom_depth - top_depth) STORED,
  
  -- Specifications
  perfo_type VARCHAR(100), -- e.g. "CC", "TCP"
  diameter VARCHAR(100),   -- Gun diameter e.g. "4'' 1/2"
  density NUMERIC(6, 2),   -- Shots per meter e.g. 13
  shots NUMERIC(8, 2),     -- Total shots
  observations TEXT,
  calage VARCHAR(100),     -- e.g. "CCL", "GR"
  reservoir VARCHAR(255),
  is_squeezed BOOLEAN DEFAULT FALSE,
  
  -- UI Layout Order
  display_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_depths CHECK (bottom_depth >= top_depth)
);

-- 2.5 CUSTOM TOOL TYPES TABLE (Catalogue des Composants / Désignations & Composants)
-- Matches the UI list: type, french_designation, default_name (+ form defaults).
-- Schematic rendering settings stay in app code (wellboreCore.ts).
CREATE TABLE IF NOT EXISTS custom_tool_types (
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


CREATE TABLE IF NOT EXISTS well_history (
  id VARCHAR(100) PRIMARY KEY DEFAULT 'history-' || md5(random()::text),
  well_id VARCHAR(100) NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
  folio VARCHAR(100) NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_well_folio UNIQUE(well_id, folio)
);

-- NOTE: Authentication uses an existing `public.employees` table managed outside
-- this wells schema. Login only reads: id, matricule, nom_prenom, role, password.

CREATE INDEX IF NOT EXISTS idx_casing_strings_well_id ON casing_strings(well_id);
CREATE INDEX IF NOT EXISTS idx_tubing_components_well_id ON tubing_components(well_id);
CREATE INDEX IF NOT EXISTS idx_perforation_zones_well_id ON perforation_zones(well_id);
CREATE INDEX IF NOT EXISTS idx_custom_tool_types_type ON custom_tool_types(type);
CREATE INDEX IF NOT EXISTS idx_tubing_components_depth ON tubing_components(bottom_depth);
CREATE INDEX IF NOT EXISTS idx_perforation_zones_depth ON perforation_zones(top_depth, bottom_depth);
CREATE INDEX IF NOT EXISTS idx_well_history_well_id ON well_history(well_id);

-- ====================================================================
-- 4. Automated Timestamps Triggers
-- ====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wells_updated_at
  BEFORE UPDATE ON wells
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_casing_strings_updated_at
  BEFORE UPDATE ON casing_strings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tubing_components_updated_at
  BEFORE UPDATE ON tubing_components
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_perforation_zones_updated_at
  BEFORE UPDATE ON perforation_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_custom_tool_types_updated_at
  BEFORE UPDATE ON custom_tool_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- 5. Supabase Row Level Security (RLS) Policies
-- ====================================================================

-- Enable RLS on all tables to secure tenant/user access
ALTER TABLE wells ENABLE ROW LEVEL SECURITY;
ALTER TABLE casing_strings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tubing_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE perforation_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_tool_types ENABLE ROW LEVEL SECURITY;

-- Create Permissive public / authenticated policies (Standard Supabase Template)
-- (Users can refine auth.uid() checks once linked to auth.users)

-- Wells Policies
CREATE POLICY "Allow public read access to wells"
  ON wells FOR SELECT USING (true);

CREATE POLICY "Allow public insert to wells"
  ON wells FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to wells"
  ON wells FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to wells"
  ON wells FOR DELETE USING (true);

-- Casing Strings Policies
CREATE POLICY "Allow public read access to casing_strings"
  ON casing_strings FOR SELECT USING (true);

CREATE POLICY "Allow public insert to casing_strings"
  ON casing_strings FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to casing_strings"
  ON casing_strings FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to casing_strings"
  ON casing_strings FOR DELETE USING (true);

-- Tubing Components Policies
CREATE POLICY "Allow public read access to tubing_components"
  ON tubing_components FOR SELECT USING (true);

CREATE POLICY "Allow public insert to tubing_components"
  ON tubing_components FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to tubing_components"
  ON tubing_components FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to tubing_components"
  ON tubing_components FOR DELETE USING (true);

-- Perforation Zones Policies
CREATE POLICY "Allow public read access to perforation_zones"
  ON perforation_zones FOR SELECT USING (true);

CREATE POLICY "Allow public insert to perforation_zones"
  ON perforation_zones FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to perforation_zones"
  ON perforation_zones FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to perforation_zones"
  ON perforation_zones FOR DELETE USING (true);

-- Custom Tool Types Policies (Catalogue des Composants)
CREATE POLICY "Allow public read access to custom_tool_types"
  ON custom_tool_types FOR SELECT USING (true);

CREATE POLICY "Allow public insert to custom_tool_types"
  ON custom_tool_types FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to custom_tool_types"
  ON custom_tool_types FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to custom_tool_types"
  ON custom_tool_types FOR DELETE USING (true);

-- Well History Policies
ALTER TABLE well_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to well_history"
  ON well_history FOR SELECT USING (true);

CREATE POLICY "Allow public insert to well_history"
  ON well_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to well_history"
  ON well_history FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete to well_history"
  ON well_history FOR DELETE USING (true);

-- ====================================================================
-- 6. Seed Custom Tool Types Catalogue
-- ====================================================================

-- 6.5 Seed component catalogue (Catalogue des Composants — matches production UI)
INSERT INTO custom_tool_types (
  id, type, default_name, default_od, default_custom_type, default_min_id, french_designation
) VALUES
  ('tooltype-anchor-seal', 'Anchor-seal', 'Anchor-seal', '2''7/8', 'EU', '', 'Anchor-seal'),
  ('tooltype-drill', 'Drill', 'Drill', '2''7/8', 'EU', '', 'Drill'),
  ('tooltype-other', 'Other', 'Autre composant', '2''7/8', 'EU', '', 'Autre'),
  ('tooltype-packer', 'packer', 'packer', '2''7/8', 'D', '', 'packer'),
  ('tooltype-reduction', 'Reduction', 'Réduction', '2''7/8', 'EU', '', 'Réduction'),
  ('tooltype-seating-nipple', 'Seating Nipple', 'Siège (Seating Nipple)', '2''7/8', 'EU', '', 'Siège'),
  ('tooltype-shoe', 'Shoe', 'Sabot (Tubing Shoe)', '2''7/8', 'EU', '', 'Sabot'),
  ('tooltype-mandrel', 'Side-pocket Mandrel', 'Mandrin (Side-pocket)', '2''7/8', 'EU', '', 'Mandrin'),
  ('tooltype-sliding-sleeve', 'Sliding Sleeve', 'Sliding Sleeve (SSD)', '2''7/8', 'EU', '', 'Sliding Sleeve')
ON CONFLICT (type) DO UPDATE SET
  default_name = EXCLUDED.default_name,
  french_designation = EXCLUDED.french_designation,
  default_od = EXCLUDED.default_od,
  default_custom_type = EXCLUDED.default_custom_type,
  default_min_id = EXCLUDED.default_min_id,
  updated_at = NOW();
