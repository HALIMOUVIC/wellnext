import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = typeof import.meta?.url === "string" ? fileURLToPath(import.meta.url) : "";
const __dirname = __filename ? path.dirname(__filename) : process.cwd();

let db: Database.Database;

export function initDb(userDataPath: string): Database.Database {
  const dbDir = userDataPath;
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, "base.db");

  // Check if existing database needs employee seeding (file missing, empty, or 0 employees)
  let needsSeed = false;
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
    needsSeed = true;
  } else {
    try {
      const checkDb = new Database(dbPath);
      const row = checkDb.prepare("SELECT count(*) as cnt FROM employees").get() as any;
      checkDb.close();
      if (!row || row.cnt === 0) {
        needsSeed = true;
      }
    } catch (_) {
      needsSeed = true;
    }
  }

  if (needsSeed) {
    const electronResources = (process as any).resourcesPath || "";
    const seedCandidates = [
      path.join(__dirname, "base.db"),
      path.join(__dirname, "..", "base.db"),
      path.join(__dirname, "..", "..", "base.db"),
      path.join(electronResources, "base.db"),
      path.join(electronResources, "app.asar.unpacked", "base.db"),
      path.join(electronResources, "app.asar.unpacked", "dist", "base.db"),
      path.join(electronResources, "app", "base.db")
    ];
    for (const seedPath of seedCandidates) {
      if (fs.existsSync(seedPath) && path.resolve(seedPath) !== path.resolve(dbPath) && fs.statSync(seedPath).size > 0) {
        try {
          const testDb = new Database(seedPath, { readonly: true });
          testDb.prepare("SELECT 1").get();
          testDb.close();

          fs.copyFileSync(seedPath, dbPath);
          console.log(`✅ Seeded SQLite base.db from valid seed file: ${seedPath} -> ${dbPath}`);
          needsSeed = false;
          break;
        } catch (e) {
          console.warn("Skipping invalid/corrupt seed file:", seedPath, e);
        }
      }
    }
  }

  try {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  } catch (err: any) {
    console.error("⚠️ SQLite database opening failed or corrupted, creating fresh database:", err?.message || err);
    try {
      if (db && typeof (db as any).close === "function") (db as any).close();
    } catch {}
    try {
      const backupCorruptPath = `${dbPath}.corrupt.${Date.now()}`;
      if (fs.existsSync(dbPath)) fs.renameSync(dbPath, backupCorruptPath);
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    } catch (cleanupErr) {
      console.error("Error archiving corrupted db:", cleanupErr);
    }
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      matricule TEXT,
      nom_prenom TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      password TEXT,
      d_rec TEXT,
      d_f_contrat TEXT,
      personnel TEXT,
      fonction TEXT,
      observation TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      t_combinaison TEXT,
      t_blouson TEXT,
      t_pantalon TEXT,
      t_parka TEXT,
      t_pantalon_ord TEXT,
      t_chemise_ord TEXT,
      t_tshirt_ord TEXT,
      t_pull TEXT,
      p_chaussure TEXT,
      t_veste_cuire TEXT,
      service TEXT
    );

    CREATE TABLE IF NOT EXISTS wells (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      purpose TEXT DEFAULT 'Oil Producer',
      completion_type TEXT DEFAULT 'COMPLETION SIMPLE',
      reservoir TEXT,
      field TEXT,
      elevation_sol REAL DEFAULT 0,
      elevation_forage REAL DEFAULT 0,
      elevation_production REAL DEFAULT 0,
      spool_prod TEXT,
      packer_type TEXT,
      susp_tbg TEXT,
      etan_tbg TEXT,
      origine_cotes TEXT,
      xmas_tree_brand TEXT,
      xmas_tree_type TEXT,
      xmas_tree_ract_sup TEXT,
      xmas_tree_pressure TEXT,
      xmas_tree_attache_tbg TEXT,
      xmas_tree_embase TEXT,
      xmas_tree_reduction TEXT,
      xmas_tree_olive TEXT,
      vannes_sas_marque TEXT,
      vannes_sas_nombre TEXT,
      vannes_sas_serie TEXT,
      vannes_maitresse_marque TEXT,
      vannes_maitresse_nombre TEXT,
      vannes_maitresse_serie TEXT,
      vannes_lat_tbg_marque TEXT,
      vannes_lat_tbg_nombre TEXT,
      vannes_lat_tbg_serie TEXT,
      vannes_lat_csg_marque TEXT,
      vannes_lat_csg_nombre TEXT,
      vannes_lat_csg_serie TEXT,
      observations TEXT,
      folio TEXT,
      folio_to_cancel TEXT,
      prod_tbg_od TEXT,
      prod_tbg_grade TEXT,
      prod_tbg_weight TEXT,
      updated_date TEXT,
      end_operation_date TEXT,
      vu_by TEXT,
      is_abandon_provisoire INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS casing_strings (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      borehole_size TEXT NOT NULL,
      casing_size TEXT NOT NULL,
      top_depth REAL NOT NULL DEFAULT 0,
      shoe_depth REAL NOT NULL,
      drilled_depth REAL NOT NULL,
      top_of_cement REAL,
      top_of_liner REAL,
      start_from_tol INTEGER DEFAULT 0,
      top_of_fonde REAL,
      grade TEXT,
      weight REAL,
      connection TEXT,
      observations TEXT,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tubing_components (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Tubing',
      od TEXT NOT NULL,
      length REAL NOT NULL,
      bottom_depth REAL NOT NULL,
      is_cote_product_added INTEGER DEFAULT 0,
      observations TEXT,
      qty TEXT,
      custom_type TEXT,
      min_id TEXT,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS perforation_zones (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      top_depth REAL NOT NULL,
      bottom_depth REAL NOT NULL,
      height REAL,
      perfo_type TEXT,
      diameter TEXT,
      density REAL,
      shots REAL,
      observations TEXT,
      calage TEXT,
      reservoir TEXT,
      is_squeezed INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_tool_types (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL UNIQUE,
      default_name TEXT NOT NULL,
      default_od TEXT DEFAULT '2''7/8',
      default_custom_type TEXT DEFAULT 'EU',
      default_min_id TEXT DEFAULT '',
      french_designation TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS well_history (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      folio TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      edited_by TEXT,
      UNIQUE(well_id, folio)
    );

    CREATE TABLE IF NOT EXISTS cement_plugs (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      top_depth REAL NOT NULL,
      bottom_depth REAL NOT NULL,
      observations TEXT,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bridge_plugs (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      designation TEXT DEFAULT 'Bridge plug',
      size TEXT DEFAULT '7"',
      type TEXT DEFAULT 'PERMANENT',
      length REAL DEFAULT 0,
      bottom_depth REAL NOT NULL,
      observations TEXT,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crepine_zone (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      top_depth REAL NOT NULL,
      bottom_depth REAL NOT NULL,
      height REAL NOT NULL,
      type_crepine TEXT,
      diameter TEXT,
      slot TEXT,
      id_mi TEXT,
      nbre_coups REAL,
      observations TEXT,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS perimetres (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      abbreviation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS srp_components (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      qty TEXT DEFAULT '01',
      type TEXT DEFAULT 'SRP',
      custom_type TEXT DEFAULT '-',
      od TEXT DEFAULT '',
      length REAL NOT NULL DEFAULT 0,
      bottom_depth REAL NOT NULL DEFAULT 0,
      is_cote_product_added INTEGER DEFAULT 1,
      observations TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);



  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

// ─── Migrations: add new columns to existing DBs ─────────────────────────────
export function runMigrations(): void {
  const d = getDb();

  // Ensure perimetres table exists
  d.exec(`
    CREATE TABLE IF NOT EXISTS perimetres (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      abbreviation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crepine_zone (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      top_depth REAL NOT NULL,
      bottom_depth REAL NOT NULL,
      height REAL NOT NULL,
      type_crepine TEXT,
      diameter TEXT,
      slot TEXT,
      id_mi TEXT,
      nbre_coups REAL,
      observations TEXT,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS srp_components (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      qty TEXT DEFAULT '01',
      type TEXT DEFAULT 'SRP',
      custom_type TEXT DEFAULT '-',
      od TEXT DEFAULT '',
      length REAL NOT NULL DEFAULT 0,
      bottom_depth REAL NOT NULL DEFAULT 0,
      is_cote_product_added INTEGER DEFAULT 1,
      observations TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate liner_crepines to crepine_zone if the old table exists
  try {
    const tableInfo = d.prepare("PRAGMA table_info(liner_crepines)").all();
    if (tableInfo.length > 0) {
      d.exec(`
        INSERT OR IGNORE INTO crepine_zone SELECT * FROM liner_crepines;
        DROP TABLE liner_crepines;
      `);
      console.log("Migrated local table liner_crepines to crepine_zone");
    }
  } catch (err) {
    console.warn("Migration error liner_crepines -> crepine_zone", err);
  }
  try { d.prepare('ALTER TABLE perimetres ADD COLUMN abbreviation TEXT').run(); } catch (_) { /* column already exists */ }
  
  // Migrate casing_strings
  try { d.prepare('ALTER TABLE casing_strings ADD COLUMN top_of_fonde REAL').run(); } catch (_) { /* column already exists */ }
  
  // Migrate well_history
  try { d.prepare('ALTER TABLE well_history ADD COLUMN updated_at TEXT').run(); } catch (_) { /* column already exists */ }
  try { d.prepare('ALTER TABLE well_history ADD COLUMN edited_by TEXT').run(); } catch (_) { /* column already exists */ }
  
  // Migrate custom_tool_types
  try { d.prepare('ALTER TABLE custom_tool_types ADD COLUMN display_order INTEGER DEFAULT 0').run(); } catch (_) { /* column already exists */ }

  // Migrate employees columns
  const empCols = [
    "matricule",
    "nom_prenom",
    "role",
    "password",
    "d_rec",
    "d_f_contrat",
    "personnel",
    "fonction",
    "observation",
    "created_at",
    "t_combinaison",
    "t_blouson",
    "t_pantalon",
    "t_parka",
    "t_pantalon_ord",
    "t_chemise_ord",
    "t_tshirt_ord",
    "t_pull",
    "p_chaussure",
    "t_veste_cuire",
    "service"
  ];
  for (const col of empCols) {
    try {
      d.prepare(`ALTER TABLE employees ADD COLUMN ${col} TEXT`).run();
    } catch (_) { /* column already exists */ }
  }

  // Migrate wells columns
  const wellCols = [
    { name: "purpose", type: "TEXT" },
    { name: "completion_type", type: "TEXT" },
    { name: "reservoir", type: "TEXT" },
    { name: "field", type: "TEXT" },
    { name: "elevation_sol", type: "REAL" },
    { name: "elevation_forage", type: "REAL" },
    { name: "elevation_production", type: "REAL" },
    { name: "spool_prod", type: "TEXT" },
    { name: "packer_type", type: "TEXT" },
    { name: "susp_tbg", type: "TEXT" },
    { name: "etan_tbg", type: "TEXT" },
    { name: "origine_cotes", type: "TEXT" },
    { name: "xmas_tree_brand", type: "TEXT" },
    { name: "xmas_tree_type", type: "TEXT" },
    { name: "xmas_tree_ract_sup", type: "TEXT" },
    { name: "xmas_tree_pressure", type: "TEXT" },
    { name: "xmas_tree_attache_tbg", type: "TEXT" },
    { name: "xmas_tree_embase", type: "TEXT" },
    { name: "xmas_tree_reduction", type: "TEXT" },
    { name: "xmas_tree_olive", type: "TEXT" },
    { name: "vannes_sas_marque", type: "TEXT" },
    { name: "vannes_sas_nombre", type: "TEXT" },
    { name: "vannes_sas_serie", type: "TEXT" },
    { name: "vannes_maitresse_marque", type: "TEXT" },
    { name: "vannes_maitresse_nombre", type: "TEXT" },
    { name: "vannes_maitresse_serie", type: "TEXT" },
    { name: "vannes_lat_tbg_marque", type: "TEXT" },
    { name: "vannes_lat_tbg_nombre", type: "TEXT" },
    { name: "vannes_lat_tbg_serie", type: "TEXT" },
    { name: "vannes_lat_csg_marque", type: "TEXT" },
    { name: "vannes_lat_csg_nombre", type: "TEXT" },
    { name: "vannes_lat_csg_serie", type: "TEXT" },
    { name: "observations", type: "TEXT" },
    { name: "folio", type: "TEXT" },
    { name: "folio_to_cancel", type: "TEXT" },
    { name: "prod_tbg_od", type: "TEXT" },
    { name: "prod_tbg_grade", type: "TEXT" },
    { name: "prod_tbg_weight", type: "TEXT" },
    { name: "updated_date", type: "TEXT" },
    { name: "end_operation_date", type: "TEXT" },
    { name: "vu_by", type: "TEXT" },
    { name: "is_abandon_provisoire", type: "INTEGER" },
    { name: "liner_top_of_liner", type: "REAL" },
    { name: "tol_depth", type: "REAL" },
    { name: "liner_shoe_depth", type: "REAL" },
    { name: "liner_diameter", type: "TEXT" },
    { name: "liner_length", type: "REAL" },
    { name: "hole_diameter", type: "TEXT" },
    { name: "drilled_to_depth", type: "REAL" },
    { name: "liner_tubing_sabot_depth", type: "REAL" },
    { name: "liner_tubing_diameter", type: "TEXT" },
    { name: "liner_tubing_length", type: "REAL" },
    { name: "liner_observations", type: "TEXT" },
    { name: "liner_crepine_params", type: "TEXT" },
    { name: "created_at", type: "TEXT" },
    { name: "updated_at", type: "TEXT" }
  ];
  for (const col of wellCols) {
    try {
      d.prepare(`ALTER TABLE wells ADD COLUMN ${col.name} ${col.type}`).run();
    } catch (_) { /* column already exists */ }
  }

  // Migrate casing_strings columns
  const casingCols = [
    { name: "top_depth", type: "REAL" },
    { name: "shoe_depth", type: "REAL" },
    { name: "drilled_depth", type: "REAL" },
    { name: "top_of_cement", type: "REAL" },
    { name: "top_of_liner", type: "REAL" },
    { name: "start_from_tol", type: "INTEGER" },
    { name: "top_of_fonde", type: "REAL" },
    { name: "grade", type: "TEXT" },
    { name: "weight", type: "REAL" },
    { name: "connection", type: "TEXT" },
    { name: "observations", type: "TEXT" },
    { name: "display_order", type: "INTEGER" }
  ];
  for (const col of casingCols) {
    try {
      d.prepare(`ALTER TABLE casing_strings ADD COLUMN ${col.name} ${col.type}`).run();
    } catch (_) { /* column already exists */ }
  }
  try {
    d.prepare(`UPDATE casing_strings SET start_from_tol = 1 WHERE top_of_liner IS NOT NULL AND top_of_liner > 0 AND (start_from_tol IS NULL OR start_from_tol = 0)`).run();
  } catch (_) { /* ignore */ }

  // Migrate tubing_components columns
  const tubingCols = [
    { name: "is_cote_product_added", type: "INTEGER" },
    { name: "observations", type: "TEXT" },
    { name: "qty", type: "TEXT" },
    { name: "custom_type", type: "TEXT" },
    { name: "min_id", type: "TEXT" },
    { name: "display_order", type: "INTEGER" }
  ];
  for (const col of tubingCols) {
    try {
      d.prepare(`ALTER TABLE tubing_components ADD COLUMN ${col.name} ${col.type}`).run();
    } catch (_) { /* column already exists */ }
  }

  // Migrate perforation_zones columns
  const perfCols = [
    { name: "height", type: "REAL" },
    { name: "perfo_type", type: "TEXT" },
    { name: "diameter", type: "TEXT" },
    { name: "density", type: "REAL" },
    { name: "shots", type: "REAL" },
    { name: "observations", type: "TEXT" },
    { name: "calage", type: "TEXT" },
    { name: "reservoir", type: "TEXT" },
    { name: "is_squeezed", type: "INTEGER DEFAULT 0" },
    { name: "display_order", type: "INTEGER" }
  ];
  for (const col of perfCols) {
    try {
      d.prepare(`ALTER TABLE perforation_zones ADD COLUMN ${col.name} ${col.type}`).run();
    } catch (_) { /* column already exists */ }
  }

  // Migrate cement_plugs table (create if not exists)
  d.exec(`
    CREATE TABLE IF NOT EXISTS cement_plugs (
      id TEXT PRIMARY KEY,
      well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
      top_depth REAL NOT NULL,
      bottom_depth REAL NOT NULL,
      observations TEXT,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Add any new columns to cement_plugs
  const cementCols = [
    { name: "observations", type: "TEXT" },
    { name: "display_order", type: "INTEGER" },
    { name: "updated_at", type: "TEXT" }
  ];
  for (const col of cementCols) {
    try {
      d.prepare(`ALTER TABLE cement_plugs ADD COLUMN ${col.name} ${col.type}`).run();
    } catch (_) { /* column already exists */ }
  }

  // Migrate bridge_plugs table (create if not exists & handle any legacy schema state)
  try {
    const tableInfo = d.prepare("PRAGMA table_info(bridge_plugs)").all() as any[];
    if (tableInfo && tableInfo.length > 0) {
      const colNames = tableInfo.map((c: any) => c.name);
      const hasDepth = colNames.includes("depth");
      const hasBottomDepth = colNames.includes("bottom_depth");

      if (hasDepth || !hasBottomDepth) {
        const selectDesignation = colNames.includes("designation") ? "COALESCE(designation, 'Bridge plug')" : "'Bridge plug'";
        const selectSize = colNames.includes("size") ? "COALESCE(size, '7\"')" : "'7\"'";
        const selectType = colNames.includes("type") ? "COALESCE(type, 'PERMANENT')" : "'PERMANENT'";
        const selectLength = colNames.includes("length") ? "COALESCE(length, 0)" : "0";
        const selectDepth = hasBottomDepth ? "COALESCE(bottom_depth, 0)" : (hasDepth ? "COALESCE(depth, 0)" : "0");
        const selectObs = colNames.includes("observations") ? "observations" : "''";
        const selectOrder = colNames.includes("display_order") ? "COALESCE(display_order, 0)" : "0";

        d.exec(`
          CREATE TABLE bridge_plugs_new (
            id TEXT PRIMARY KEY,
            well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
            designation TEXT DEFAULT 'Bridge plug',
            size TEXT DEFAULT '7"',
            type TEXT DEFAULT 'PERMANENT',
            length REAL DEFAULT 0,
            bottom_depth REAL DEFAULT 0,
            observations TEXT,
            display_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
          INSERT INTO bridge_plugs_new (id, well_id, designation, size, type, length, bottom_depth, observations, display_order)
          SELECT id, well_id,
            ${selectDesignation},
            ${selectSize},
            ${selectType},
            ${selectLength},
            ${selectDepth},
            ${selectObs},
            ${selectOrder}
          FROM bridge_plugs;
          DROP TABLE bridge_plugs;
          ALTER TABLE bridge_plugs_new RENAME TO bridge_plugs;
        `);
      }
    } else {
      d.exec(`
        CREATE TABLE IF NOT EXISTS bridge_plugs (
          id TEXT PRIMARY KEY,
          well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
          designation TEXT DEFAULT 'Bridge plug',
          size TEXT DEFAULT '7"',
          type TEXT DEFAULT 'PERMANENT',
          length REAL DEFAULT 0,
          bottom_depth REAL DEFAULT 0,
          observations TEXT,
          display_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
    }
  } catch (err) {
    console.warn("bridge_plugs table migration notice:", err);
    try {
      d.exec(`
        CREATE TABLE IF NOT EXISTS bridge_plugs (
          id TEXT PRIMARY KEY,
          well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
          designation TEXT DEFAULT 'Bridge plug',
          size TEXT DEFAULT '7"',
          type TEXT DEFAULT 'PERMANENT',
          length REAL DEFAULT 0,
          bottom_depth REAL DEFAULT 0,
          observations TEXT,
          display_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (_) {}
  }

  const bridgeCols = [
    { name: "designation", type: "TEXT" },
    { name: "size", type: "TEXT" },
    { name: "type", type: "TEXT" },
    { name: "length", type: "REAL" },
    { name: "bottom_depth", type: "REAL" },
    { name: "observations", type: "TEXT" },
    { name: "display_order", type: "INTEGER" },
    { name: "updated_at", type: "TEXT" }
  ];
  for (const col of bridgeCols) {
    try {
      d.prepare(`ALTER TABLE bridge_plugs ADD COLUMN ${col.name} ${col.type}`).run();
    } catch (_) { /* column already exists */ }
  }

  // Repair migration: if bridge_plugs has bottom_depth with NOT NULL constraint,
  // rebuild the table to remove it (so 0-depth bridge plugs don't throw errors)
  try {
    const bpTableInfo = d.prepare("PRAGMA table_info(bridge_plugs)").all() as any[];
    const bpDepthCol = bpTableInfo.find((c: any) => c.name === "bottom_depth");
    if (bpDepthCol && bpDepthCol.notnull === 1) {
      const colNames2 = bpTableInfo.map((c: any) => c.name);
      const selectCols = colNames2.map((n: string) => {
        if (n === "bottom_depth") return "COALESCE(bottom_depth, 0) AS bottom_depth";
        return n;
      }).join(", ");
      d.exec(`
        CREATE TABLE bridge_plugs_repair (
          id TEXT PRIMARY KEY,
          well_id TEXT NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
          designation TEXT DEFAULT 'Bridge plug',
          size TEXT DEFAULT '7"',
          type TEXT DEFAULT 'PERMANENT',
          length REAL DEFAULT 0,
          bottom_depth REAL DEFAULT 0,
          observations TEXT,
          display_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO bridge_plugs_repair (id, well_id, designation, size, type, length, bottom_depth, observations, display_order)
        SELECT id, well_id,
          COALESCE(designation, 'Bridge plug'),
          COALESCE(size, '7"'),
          COALESCE(type, 'PERMANENT'),
          COALESCE(length, 0),
          COALESCE(bottom_depth, 0),
          observations,
          COALESCE(display_order, 0)
        FROM bridge_plugs;
        DROP TABLE bridge_plugs;
        ALTER TABLE bridge_plugs_repair RENAME TO bridge_plugs;
      `);
      console.log("bridge_plugs: repaired NOT NULL constraint on bottom_depth");
    }
  } catch (repairErr) {
    console.warn("bridge_plugs repair migration notice:", repairErr);
  }
}


// ─── Sync helpers ─────────────────────────────────────────────────────────────

export function wasEverSynced(): boolean {
  const d = getDb();
  const row = d.prepare("SELECT value FROM sync_meta WHERE key = 'synced'").get() as any;
  return row?.value === "true";
}

export function markSynced(): void {
  getDb().prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('synced', 'true')").run();
}

export function upsertEmployee(emp: any): void {
  const d = getDb();
  const preparedEmp = { ...emp };
  if (preparedEmp.password === null || preparedEmp.password === undefined || String(preparedEmp.password).trim() === "") {
    preparedEmp.password = preparedEmp.matricule || "1234";
  }
  const cols = Object.keys(preparedEmp).join(", ");
  const vals = Object.keys(preparedEmp).map(k => `@${k}`).join(", ");
  const updates = Object.keys(preparedEmp).filter(k => k !== "id").map(k => `${k} = excluded.${k}`).join(", ");
  d.prepare(`INSERT INTO employees (${cols}) VALUES (${vals}) ON CONFLICT(id) DO UPDATE SET ${updates}`).run(preparedEmp);
}

export function upsertWell(w: any): void {
  const d = getDb();
  // Ensure no undefined values, coerce booleans to integers, and stringify objects
  const preparedW = Object.fromEntries(
    Object.entries(w).map(([k, v]) => {
      if (v === undefined) return [k, null];
      if (typeof v === 'boolean') return [k, v ? 1 : 0];
      if (v !== null && typeof v === 'object') return [k, JSON.stringify(v)];
      return [k, v];
    })
  );

  const cols = Object.keys(preparedW).join(", ");
  const vals = Object.keys(preparedW).map(k => `@${k}`).join(", ");
  const updates = Object.keys(preparedW).filter(k => k !== "id").map(k => `${k} = excluded.${k}`).join(", ");
  d.prepare(`INSERT INTO wells (${cols}) VALUES (${vals}) ON CONFLICT(id) DO UPDATE SET ${updates}`).run(preparedW);
}

export function upsertCasing(c: any): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO casing_strings (id,well_id,name,borehole_size,casing_size,top_depth,shoe_depth,drilled_depth,top_of_cement,top_of_liner,start_from_tol,top_of_fonde,grade,weight,connection,observations,display_order)
    VALUES (@id,@well_id,@name,@borehole_size,@casing_size,@top_depth,@shoe_depth,@drilled_depth,@top_of_cement,@top_of_liner,@start_from_tol,@top_of_fonde,@grade,@weight,@connection,@observations,@display_order)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, borehole_size=excluded.borehole_size, casing_size=excluded.casing_size,
      top_depth=excluded.top_depth, shoe_depth=excluded.shoe_depth, drilled_depth=excluded.drilled_depth,
      top_of_cement=excluded.top_of_cement, top_of_liner=excluded.top_of_liner, start_from_tol=excluded.start_from_tol, top_of_fonde=excluded.top_of_fonde, grade=excluded.grade,
      weight=excluded.weight, connection=excluded.connection, observations=excluded.observations, display_order=excluded.display_order
  `).run({
    ...c,
    top_of_cement: c.top_of_cement ?? null,
    top_of_liner: c.top_of_liner ?? null,
    start_from_tol: c.start_from_tol ? 1 : 0,
    top_of_fonde: c.top_of_fonde ?? null
  });
}

export function upsertTubing(t: any): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO tubing_components (id,well_id,name,type,od,length,bottom_depth,is_cote_product_added,observations,qty,custom_type,min_id,display_order)
    VALUES (@id,@well_id,@name,@type,@od,@length,@bottom_depth,@is_cote_product_added,@observations,@qty,@custom_type,@min_id,@display_order)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, type=excluded.type, od=excluded.od, length=excluded.length,
      bottom_depth=excluded.bottom_depth, is_cote_product_added=excluded.is_cote_product_added,
      observations=excluded.observations, qty=excluded.qty, custom_type=excluded.custom_type,
      min_id=excluded.min_id, display_order=excluded.display_order
  `).run({ ...t, is_cote_product_added: t.is_cote_product_added ? 1 : 0 });
}

export function upsertPerforation(p: any): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO perforation_zones (id,well_id,top_depth,bottom_depth,perfo_type,diameter,density,shots,observations,calage,reservoir,is_squeezed,display_order)
    VALUES (@id,@well_id,@top_depth,@bottom_depth,@perfo_type,@diameter,@density,@shots,@observations,@calage,@reservoir,@is_squeezed,@display_order)
    ON CONFLICT(id) DO UPDATE SET
      top_depth=excluded.top_depth, bottom_depth=excluded.bottom_depth, perfo_type=excluded.perfo_type,
      diameter=excluded.diameter, density=excluded.density, shots=excluded.shots,
      observations=excluded.observations, calage=excluded.calage, reservoir=excluded.reservoir,
      is_squeezed=excluded.is_squeezed, display_order=excluded.display_order
  `).run({
    ...p,
    reservoir: p.reservoir || null,
    is_squeezed: p.is_squeezed !== undefined ? (p.is_squeezed ? 1 : 0) : (p.isSqueezed ? 1 : 0)
  });
}

export function upsertLinerCrepine(lc: any): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO crepine_zone (id,well_id,top_depth,bottom_depth,height,type_crepine,diameter,slot,id_mi,nbre_coups,observations,display_order)
    VALUES (@id,@well_id,@top_depth,@bottom_depth,@height,@type_crepine,@diameter,@slot,@id_mi,@nbre_coups,@observations,@display_order)
    ON CONFLICT(id) DO UPDATE SET
      top_depth=excluded.top_depth, bottom_depth=excluded.bottom_depth, height=excluded.height,
      type_crepine=excluded.type_crepine, diameter=excluded.diameter, slot=excluded.slot,
      id_mi=excluded.id_mi, nbre_coups=excluded.nbre_coups, observations=excluded.observations, display_order=excluded.display_order
  `).run({
    id: lc.id,
    well_id: lc.well_id,
    top_depth: Number(lc.top_depth) || 0,
    bottom_depth: Number(lc.bottom_depth) || 0,
    height: Number(lc.height) || Math.abs((Number(lc.bottom_depth) || 0) - (Number(lc.top_depth) || 0)),
    type_crepine: lc.type_crepine || '',
    diameter: lc.diameter || '',
    slot: lc.slot || '',
    id_mi: lc.id_mi || '',
    nbre_coups: lc.nbre_coups != null ? Number(lc.nbre_coups) : null,
    observations: lc.observations || '',
    display_order: lc.display_order || 0
  });
}

export function upsertCementPlug(cp: any): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO cement_plugs (id, well_id, top_depth, bottom_depth, observations, display_order)
    VALUES (@id, @well_id, @top_depth, @bottom_depth, @observations, @display_order)
    ON CONFLICT(id) DO UPDATE SET
      top_depth=excluded.top_depth, bottom_depth=excluded.bottom_depth,
      observations=excluded.observations, display_order=excluded.display_order,
      updated_at=datetime('now')
  `).run({
    id: cp.id,
    well_id: cp.well_id,
    top_depth: Number(cp.top_depth) || 0,
    bottom_depth: Number(cp.bottom_depth) || 0,
    observations: cp.observations || '',
    display_order: cp.display_order || 0
  });
}

export function upsertToolType(t: any): void {
  const tool = { display_order: 0, ...t };
  if (tool.display_order === null || tool.display_order === undefined) {
    tool.display_order = 0;
  }
  getDb().prepare(`
    INSERT INTO custom_tool_types (id,type,default_name,default_od,default_custom_type,default_min_id,french_designation,display_order)
    VALUES (@id,@type,@default_name,@default_od,@default_custom_type,@default_min_id,@french_designation,@display_order)
    ON CONFLICT(type) DO UPDATE SET
      default_name=excluded.default_name, default_od=excluded.default_od,
      default_custom_type=excluded.default_custom_type, default_min_id=excluded.default_min_id,
      french_designation=excluded.french_designation,
      display_order=excluded.display_order
  `).run(tool);
}

export function upsertHistory(h: any): void {
  let snapshotObj: any = null;
  if (typeof h.snapshot === "string") {
    try {
      snapshotObj = JSON.parse(h.snapshot);
    } catch (_) {}
  } else if (h.snapshot && typeof h.snapshot === "object") {
    snapshotObj = h.snapshot;
  }

  const edited_by = h.edited_by || (snapshotObj && (snapshotObj.editedBy || snapshotObj.edited_by)) || "";
  const updated_at = h.updated_at || (snapshotObj && (snapshotObj.updatedAt || snapshotObj.updated_at)) || h.created_at || new Date().toISOString();

  getDb().prepare(`
    INSERT INTO well_history (id, well_id, folio, snapshot, created_at, updated_at, edited_by)
    VALUES (@id, @well_id, @folio, @snapshot, @created_at, @updated_at, @edited_by)
    ON CONFLICT(well_id, folio) DO UPDATE SET
      snapshot = excluded.snapshot,
      updated_at = excluded.updated_at,
      edited_by = excluded.edited_by
  `).run({
    id: h.id,
    well_id: h.well_id,
    folio: h.folio,
    snapshot: typeof h.snapshot === "string" ? h.snapshot : JSON.stringify(h.snapshot),
    created_at: h.created_at || new Date().toISOString(),
    updated_at: updated_at,
    edited_by: edited_by
  });
}

export function upsertBridgePlug(bp: any): void {
  const d = getDb();
  const bottomDepth = Number(bp.bottom_depth || bp.bottomDepth || bp.depth) || 0;
  
  let hasDepthCol = false;
  try {
    const tableInfo = d.prepare("PRAGMA table_info(bridge_plugs)").all() as any[];
    hasDepthCol = tableInfo.some((c: any) => c.name === "depth");
  } catch (_) {}

  if (hasDepthCol) {
    try {
      d.prepare(`
        INSERT INTO bridge_plugs (id, well_id, designation, size, type, length, bottom_depth, depth, observations, display_order)
        VALUES (@id, @well_id, @designation, @size, @type, @length, @bottom_depth, @depth, @observations, @display_order)
        ON CONFLICT(id) DO UPDATE SET
          designation=excluded.designation, size=excluded.size, type=excluded.type,
          length=excluded.length, bottom_depth=excluded.bottom_depth, depth=excluded.depth,
          observations=excluded.observations, display_order=excluded.display_order,
          updated_at=datetime('now')
      `).run({
        id: bp.id,
        well_id: bp.well_id,
        designation: bp.designation || bp.name || 'Bridge plug',
        size: bp.size || bp.od || '7"',
        type: bp.type || bp.customType || 'PERMANENT',
        length: Number(bp.length) || 0,
        bottom_depth: bottomDepth,
        depth: bottomDepth,
        observations: bp.observations || '',
        display_order: bp.display_order || 0
      });
      return;
    } catch (_) {}
  }

  d.prepare(`
    INSERT INTO bridge_plugs (id, well_id, designation, size, type, length, bottom_depth, observations, display_order)
    VALUES (@id, @well_id, @designation, @size, @type, @length, @bottom_depth, @observations, @display_order)
    ON CONFLICT(id) DO UPDATE SET
      designation=excluded.designation, size=excluded.size, type=excluded.type,
      length=excluded.length, bottom_depth=excluded.bottom_depth,
      observations=excluded.observations, display_order=excluded.display_order,
      updated_at=datetime('now')
  `).run({
    id: bp.id,
    well_id: bp.well_id,
    designation: bp.designation || bp.name || 'Bridge plug',
    size: bp.size || bp.od || '7"',
    type: bp.type || bp.customType || 'PERMANENT',
    length: Number(bp.length) || 0,
    bottom_depth: bottomDepth,
    observations: bp.observations || '',
    display_order: bp.display_order || 0
  });
}

export function upsertPerimetre(p: any): void {
  const d = getDb();
  const name = typeof p === 'string' ? p.trim() : (p && p.name ? String(p.name).trim() : '');
  if (!name) return;
  const abbreviation = (typeof p === 'object' && p.abbreviation) ? String(p.abbreviation).trim().toUpperCase() : null;
  const id = (typeof p === 'object' && p.id) ? String(p.id) : `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  try {
    d.prepare(`
      INSERT INTO perimetres (id, name, abbreviation, created_at)
      VALUES (?, ?, ?, COALESCE(?, datetime('now')))
      ON CONFLICT(name) DO UPDATE SET
        name=excluded.name,
        abbreviation=COALESCE(excluded.abbreviation, perimetres.abbreviation)
    `).run(id, name, abbreviation, (typeof p === 'object' && p.created_at) ? p.created_at : null);
  } catch (e) {
    console.warn("upsertPerimetre notice:", e);
  }
}

export function upsertSrpComponent(srp: any): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO srp_components (id,well_id,name,qty,type,custom_type,od,length,bottom_depth,is_cote_product_added,observations,display_order)
    VALUES (@id,@well_id,@name,@qty,@type,@custom_type,@od,@length,@bottom_depth,@is_cote_product_added,@observations,@display_order)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, qty=excluded.qty, type=excluded.type, custom_type=excluded.custom_type,
      od=excluded.od, length=excluded.length, bottom_depth=excluded.bottom_depth,
      is_cote_product_added=excluded.is_cote_product_added, observations=excluded.observations,
      display_order=excluded.display_order
  `).run({
    id: srp.id,
    well_id: srp.well_id,
    name: srp.name || "SRP Component",
    qty: srp.qty || '01',
    type: srp.type || 'SRP',
    custom_type: srp.custom_type || srp.customType || '-',
    od: srp.od || '',
    length: Number(srp.length) || 0,
    bottom_depth: Number(srp.bottom_depth ?? srp.bottomDepth) || 0,
    is_cote_product_added: (srp.is_cote_product_added ?? srp.isCoteProductAdded) ? 1 : 0,
    observations: srp.observations || '',
    display_order: srp.display_order || 0
  });
}

