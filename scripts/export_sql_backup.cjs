const fs = require('fs');
const path = require('path');

const dumpPath = path.join(__dirname, '..', 'supabase_full_dump.json');
const dumpData = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));

function escapeSqlString(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
  }
  return "'" + String(val).replace(/'/g, "''") + "'";
}

let sql = `-- ========================================================\n`;
sql += `-- WELLBORE PRO COMPLETE DATABASE BACKUP (SCHEMA + DATA)\n`;
sql += `-- Downloaded from Supabase Cloud: ${new Date().toISOString()}\n`;
sql += `-- ========================================================\n\n`;

// 1. Employees Table
sql += `-- TABLE: employees\n`;
sql += `CREATE TABLE IF NOT EXISTS employees (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  name VARCHAR(255) NOT NULL,\n`;
sql += `  matricule VARCHAR(255),\n`;
sql += `  role VARCHAR(100),\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.employees && dumpData.employees.length > 0) {
  sql += `INSERT INTO employees (id, name, matricule, role, created_at) VALUES\n`;
  const empRows = dumpData.employees.map(e => 
    `  (${escapeSqlString(e.id)}, ${escapeSqlString(e.name)}, ${escapeSqlString(e.matricule)}, ${escapeSqlString(e.role)}, ${escapeSqlString(e.created_at)})`
  );
  sql += empRows.join(',\n') + ';\n\n';
}

// 2. Custom Tool Types Table
sql += `-- TABLE: custom_tool_types\n`;
sql += `CREATE TABLE IF NOT EXISTS custom_tool_types (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  type VARCHAR(255) NOT NULL,\n`;
sql += `  french_designation VARCHAR(255),\n`;
sql += `  default_name VARCHAR(255),\n`;
sql += `  default_custom_type VARCHAR(255),\n`;
sql += `  default_od VARCHAR(255),\n`;
sql += `  default_min_id VARCHAR(255),\n`;
sql += `  sort_order INT DEFAULT 0,\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.custom_tool_types && dumpData.custom_tool_types.length > 0) {
  sql += `INSERT INTO custom_tool_types (id, type, french_designation, default_name, default_custom_type, default_od, default_min_id, sort_order, created_at) VALUES\n`;
  const toolRows = dumpData.custom_tool_types.map(t => 
    `  (${escapeSqlString(t.id)}, ${escapeSqlString(t.type)}, ${escapeSqlString(t.french_designation)}, ${escapeSqlString(t.default_name)}, ${escapeSqlString(t.default_custom_type)}, ${escapeSqlString(t.default_od)}, ${escapeSqlString(t.default_min_id)}, ${t.sort_order || 0}, ${escapeSqlString(t.created_at)})`
  );
  sql += toolRows.join(',\n') + ';\n\n';
}

// 3. Wells Table
sql += `-- TABLE: wells\n`;
sql += `CREATE TABLE IF NOT EXISTS wells (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  name VARCHAR(255) NOT NULL,\n`;
sql += `  purpose VARCHAR(255),\n`;
sql += `  completion_type VARCHAR(255),\n`;
sql += `  reservoir VARCHAR(255),\n`;
sql += `  field VARCHAR(255),\n`;
sql += `  state VARCHAR(100),\n`;
sql += `  perimeter VARCHAR(255),\n`;
sql += `  spool_prod VARCHAR(255),\n`;
sql += `  z_sol NUMERIC,\n`;
sql += `  z_forage NUMERIC,\n`;
sql += `  z_prod NUMERIC,\n`;
sql += `  orig_cotes VARCHAR(255),\n`;
sql += `  sp_att_tbg VARCHAR(255),\n`;
sql += `  fiche_comments TEXT,\n`;
sql += `  prod_tbg_od VARCHAR(100),\n`;
sql += `  prod_tbg_grade VARCHAR(100),\n`;
sql += `  prod_tbg_weight VARCHAR(100),\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
sql += `  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.wells && dumpData.wells.length > 0) {
  sql += `INSERT INTO wells (id, name, purpose, completion_type, reservoir, field, state, perimeter, spool_prod, z_sol, z_forage, z_prod, orig_cotes, sp_att_tbg, fiche_comments, prod_tbg_od, prod_tbg_grade, prod_tbg_weight, created_at, updated_at) VALUES\n`;
  const wellRows = dumpData.wells.map(w => 
    `  (${escapeSqlString(w.id)}, ${escapeSqlString(w.name)}, ${escapeSqlString(w.purpose)}, ${escapeSqlString(w.completion_type)}, ${escapeSqlString(w.reservoir)}, ${escapeSqlString(w.field)}, ${escapeSqlString(w.state)}, ${escapeSqlString(w.perimeter)}, ${escapeSqlString(w.spool_prod)}, ${w.z_sol ?? 'NULL'}, ${w.z_forage ?? 'NULL'}, ${w.z_prod ?? 'NULL'}, ${escapeSqlString(w.orig_cotes)}, ${escapeSqlString(w.sp_att_tbg)}, ${escapeSqlString(w.fiche_comments)}, ${escapeSqlString(w.prod_tbg_od)}, ${escapeSqlString(w.prod_tbg_grade)}, ${escapeSqlString(w.prod_tbg_weight)}, ${escapeSqlString(w.created_at)}, ${escapeSqlString(w.updated_at)})`
  );
  sql += wellRows.join(',\n') + ';\n\n';
}

// 4. Casing Strings Table
sql += `-- TABLE: casing_strings\n`;
sql += `CREATE TABLE IF NOT EXISTS casing_strings (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  well_id VARCHAR(255) REFERENCES wells(id) ON DELETE CASCADE,\n`;
sql += `  name VARCHAR(255),\n`;
sql += `  borehole_size VARCHAR(100),\n`;
sql += `  casing_size VARCHAR(100),\n`;
sql += `  top_depth NUMERIC,\n`;
sql += `  shoe_depth NUMERIC,\n`;
sql += `  drilled_depth NUMERIC,\n`;
sql += `  top_of_cement NUMERIC,\n`;
sql += `  top_of_liner NUMERIC,\n`;
sql += `  top_of_fonde NUMERIC,\n`;
sql += `  grade VARCHAR(100),\n`;
sql += `  weight NUMERIC,\n`;
sql += `  connection VARCHAR(100),\n`;
sql += `  observations TEXT,\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.casing_strings && dumpData.casing_strings.length > 0) {
  sql += `INSERT INTO casing_strings (id, well_id, name, borehole_size, casing_size, top_depth, shoe_depth, drilled_depth, top_of_cement, top_of_liner, top_of_fonde, grade, weight, connection, observations, created_at) VALUES\n`;
  const csgRows = dumpData.casing_strings.map(c => 
    `  (${escapeSqlString(c.id)}, ${escapeSqlString(c.well_id)}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.borehole_size)}, ${escapeSqlString(c.casing_size)}, ${c.top_depth ?? 'NULL'}, ${c.shoe_depth ?? 'NULL'}, ${c.drilled_depth ?? 'NULL'}, ${c.top_of_cement ?? 'NULL'}, ${c.top_of_liner ?? 'NULL'}, ${c.top_of_fonde ?? 'NULL'}, ${escapeSqlString(c.grade)}, ${c.weight ?? 'NULL'}, ${escapeSqlString(c.connection)}, ${escapeSqlString(c.observations)}, ${escapeSqlString(c.created_at)})`
  );
  sql += csgRows.join(',\n') + ';\n\n';
}

// 5. Tubing Components Table
sql += `-- TABLE: tubing_components\n`;
sql += `CREATE TABLE IF NOT EXISTS tubing_components (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  well_id VARCHAR(255) REFERENCES wells(id) ON DELETE CASCADE,\n`;
sql += `  name VARCHAR(255),\n`;
sql += `  type VARCHAR(100),\n`;
sql += `  custom_type VARCHAR(100),\n`;
sql += `  qty VARCHAR(50),\n`;
sql += `  od VARCHAR(100),\n`;
sql += `  length NUMERIC,\n`;
sql += `  bottom_depth NUMERIC,\n`;
sql += `  is_cote_product_added BOOLEAN DEFAULT FALSE,\n`;
sql += `  min_id VARCHAR(100),\n`;
sql += `  observations TEXT,\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.tubing_components && dumpData.tubing_components.length > 0) {
  sql += `INSERT INTO tubing_components (id, well_id, name, type, custom_type, qty, od, length, bottom_depth, is_cote_product_added, min_id, observations, created_at) VALUES\n`;
  const tbgRows = dumpData.tubing_components.map(t => 
    `  (${escapeSqlString(t.id)}, ${escapeSqlString(t.well_id)}, ${escapeSqlString(t.name)}, ${escapeSqlString(t.type)}, ${escapeSqlString(t.custom_type)}, ${escapeSqlString(t.qty)}, ${escapeSqlString(t.od)}, ${t.length ?? 'NULL'}, ${t.bottom_depth ?? 'NULL'}, ${t.is_cote_product_added ? 'TRUE' : 'FALSE'}, ${escapeSqlString(t.min_id)}, ${escapeSqlString(t.observations)}, ${escapeSqlString(t.created_at)})`
  );
  sql += tbgRows.join(',\n') + ';\n\n';
}

// 6. Cement Plugs Table (B.C)
sql += `-- TABLE: cement_plugs (Bouchons de Ciment - B.C)\n`;
sql += `CREATE TABLE IF NOT EXISTS cement_plugs (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  well_id VARCHAR(255) REFERENCES wells(id) ON DELETE CASCADE,\n`;
sql += `  top_depth NUMERIC NOT NULL,\n`;
sql += `  bottom_depth NUMERIC NOT NULL,\n`;
sql += `  observations TEXT,\n`;
sql += `  display_order INT DEFAULT 0,\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.cement_plugs && dumpData.cement_plugs.length > 0) {
  sql += `INSERT INTO cement_plugs (id, well_id, top_depth, bottom_depth, observations, created_at) VALUES\n`;
  const cpRows = dumpData.cement_plugs.map(cp => 
    `  (${escapeSqlString(cp.id)}, ${escapeSqlString(cp.well_id)}, ${cp.top_depth ?? 'NULL'}, ${cp.bottom_depth ?? 'NULL'}, ${escapeSqlString(cp.observations)}, ${escapeSqlString(cp.created_at)})`
  );
  sql += cpRows.join(',\n') + ';\n\n';
}

// 7. Bridge Plugs Table (B.P)
sql += `-- TABLE: bridge_plugs (Barrières de Fond - B.P)\n`;
sql += `CREATE TABLE IF NOT EXISTS bridge_plugs (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  well_id VARCHAR(255) REFERENCES wells(id) ON DELETE CASCADE,\n`;
sql += `  designation VARCHAR(255) DEFAULT 'Bridge plug',\n`;
sql += `  size VARCHAR(100) DEFAULT '7"',\n`;
sql += `  type VARCHAR(100) DEFAULT 'PERMANENT',\n`;
sql += `  length NUMERIC DEFAULT 0,\n`;
sql += `  bottom_depth NUMERIC NOT NULL,\n`;
sql += `  observations TEXT,\n`;
sql += `  display_order INT DEFAULT 0,\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
sql += `  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.bridge_plugs && dumpData.bridge_plugs.length > 0) {
  sql += `INSERT INTO bridge_plugs (id, well_id, designation, size, type, length, bottom_depth, observations, display_order, created_at) VALUES\n`;
  const bpRows = dumpData.bridge_plugs.map(bp => 
    `  (${escapeSqlString(bp.id)}, ${escapeSqlString(bp.well_id)}, ${escapeSqlString(bp.designation || bp.name || 'Bridge plug')}, ${escapeSqlString(bp.size || bp.od || '7"')}, ${escapeSqlString(bp.type || bp.custom_type || 'PERMANENT')}, ${bp.length ?? 0}, ${bp.bottom_depth ?? 'NULL'}, ${escapeSqlString(bp.observations)}, ${bp.display_order || 0}, ${escapeSqlString(bp.created_at)})`
  );
  sql += bpRows.join(',\n') + ';\n\n';
}

// 7. Perforation Zones Table
sql += `-- TABLE: perforation_zones\n`;
sql += `CREATE TABLE IF NOT EXISTS perforation_zones (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  well_id VARCHAR(255) REFERENCES wells(id) ON DELETE CASCADE,\n`;
sql += `  top_depth NUMERIC,\n`;
sql += `  bottom_depth NUMERIC,\n`;
sql += `  perforation_type VARCHAR(100),\n`;
sql += `  diameter VARCHAR(100),\n`;
sql += `  density NUMERIC,\n`;
sql += `  phasing VARCHAR(100),\n`;
sql += `  shots_count INT,\n`;
sql += `  reservoir VARCHAR(255),\n`;
sql += `  is_squeezed BOOLEAN DEFAULT FALSE,\n`;
sql += `  observations TEXT,\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.perforation_zones && dumpData.perforation_zones.length > 0) {
  sql += `INSERT INTO perforation_zones (id, well_id, top_depth, bottom_depth, perforation_type, diameter, density, phasing, shots_count, reservoir, observations, created_at) VALUES\n`;
  const perfRows = dumpData.perforation_zones.map(p => 
    `  (${escapeSqlString(p.id)}, ${escapeSqlString(p.well_id)}, ${p.top_depth ?? 'NULL'}, ${p.bottom_depth ?? 'NULL'}, ${escapeSqlString(p.perforation_type)}, ${escapeSqlString(p.diameter)}, ${p.density ?? 'NULL'}, ${escapeSqlString(p.phasing)}, ${p.shots_count ?? 'NULL'}, ${escapeSqlString(p.reservoir)}, ${escapeSqlString(p.observations)}, ${escapeSqlString(p.created_at)})`
  );
  sql += perfRows.join(',\n') + ';\n\n';
}

// 8. Well History Table
sql += `-- TABLE: well_history\n`;
sql += `CREATE TABLE IF NOT EXISTS well_history (\n`;
sql += `  id VARCHAR(255) PRIMARY KEY,\n`;
sql += `  well_id VARCHAR(255) REFERENCES wells(id) ON DELETE CASCADE,\n`;
sql += `  folio VARCHAR(50),\n`;
sql += `  snapshot JSONB,\n`;
sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
sql += `);\n\n`;

if (dumpData.well_history && dumpData.well_history.length > 0) {
  sql += `INSERT INTO well_history (id, well_id, folio, snapshot, created_at) VALUES\n`;
  const histRows = dumpData.well_history.map(h => 
    `  (${escapeSqlString(h.id)}, ${escapeSqlString(h.well_id)}, ${escapeSqlString(h.folio)}, ${escapeSqlString(h.snapshot)}, ${escapeSqlString(h.created_at)})`
  );
  sql += histRows.join(',\n') + ';\n\n';
}

// Write to supa.sql and supabase_full_backup.sql
const supaPath = path.join(__dirname, '..', 'supa.sql');
const backupPath = path.join(__dirname, '..', 'supabase_full_backup.sql');

fs.writeFileSync(supaPath, sql, 'utf-8');
fs.writeFileSync(backupPath, sql, 'utf-8');

console.log(`\n💾 Saved SQL schema & data to: ${supaPath}`);
console.log(`💾 Saved SQL schema & data to: ${backupPath}`);
