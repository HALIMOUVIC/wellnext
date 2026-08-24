const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log("=== STEP 1: Extracting history snapshots from backup ===");
  const backupFile = 'import-history.cjs';
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Backup file '${backupFile}' not found!`);
    process.exit(1);
  }

  const content = fs.readFileSync(backupFile, 'utf8');
  const rowsStart = content.indexOf('const rows = [');
  const rowsEnd = content.indexOf('];', rowsStart);
  if (rowsStart === -1 || rowsEnd === -1) {
    console.error("❌ Could not parse rows array from backup file.");
    process.exit(1);
  }

  const rowsCode = content.substring(rowsStart, rowsEnd + 2);
  const rows = eval('(function(){ ' + rowsCode + '; return rows; })()');
  console.log(`✅ Extracted ${rows.length} snapshots successfully!`);

  console.log("\n=== STEP 2: Connecting and clearing SQLite (base.db) ===");
  const db = sqlite3('base.db');
  db.pragma('foreign_keys = OFF');

  // Clean active and history tables
  db.prepare('DELETE FROM wells').run();
  db.prepare('DELETE FROM casing_strings').run();
  db.prepare('DELETE FROM tubing_components').run();
  db.prepare('DELETE FROM perforation_zones').run();
  db.prepare('DELETE FROM well_history').run();
  console.log("✅ Cleared local tables");

  console.log("\n=== STEP 3: Inserting history snapshots ===");
  const insertHistory = db.prepare(`
    INSERT INTO well_history (id, well_id, folio, snapshot, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    insertHistory.run(
      row.id,
      row.well_id,
      row.folio,
      row.snapshot,
      row.created_at,
      row.created_at // Use created_at as updated_at
    );
    console.log(`  Inserted history [${row.folio}] for well ${row.well_id}`);
  }

  console.log("\n=== STEP 4: Restoring active tables from highest folio snapshots ===");
  // Find unique well IDs
  const wellIds = [...new Set(rows.map(r => r.well_id))];
  
  for (const wellId of wellIds) {
    console.log(`\nProcessing well ID: ${wellId}...`);
    const wellSnapshots = rows.filter(r => r.well_id === wellId);
    
    // Find highest folio snapshot
    const highestSnapshotRow = wellSnapshots.reduce((prev, curr) => {
      const prevFolio = parseInt(prev.folio, 10) || 0;
      const currFolio = parseInt(curr.folio, 10) || 0;
      return currFolio > prevFolio ? curr : prev;
    });

    console.log(`  Highest folio found: ${highestSnapshotRow.folio}`);
    const well = JSON.parse(highestSnapshotRow.snapshot);

    // A. Insert Well
    const insertWell = db.prepare(`
      INSERT INTO wells (
        id, name, purpose, completion_type, reservoir, field,
        elevation_sol, elevation_forage, elevation_production,
        spool_prod, packer_type, susp_tbg, etan_tbg, origine_cotes,
        xmas_tree_brand, xmas_tree_type, xmas_tree_ract_sup, xmas_tree_pressure, xmas_tree_attache_tbg, xmas_tree_embase, xmas_tree_reduction, xmas_tree_olive,
        vannes_sas_marque, vannes_sas_nombre, vannes_sas_serie,
        vannes_maitresse_marque, vannes_maitresse_nombre, vannes_maitresse_serie,
        vannes_lat_tbg_marque, vannes_lat_tbg_nombre, vannes_lat_tbg_serie,
        vannes_lat_csg_marque, vannes_lat_csg_nombre, vannes_lat_csg_serie,
        observations, folio, folio_to_cancel,
        prod_tbg_od, prod_tbg_grade, prod_tbg_weight,
        updated_date, end_operation_date, vu_by, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    insertWell.run(
      well.id,
      well.name || "NEW WELL",
      well.purpose || "Oil Producer",
      well.completionType || "COMPLETION SIMPLE",
      well.reservoir || "",
      well.field || "",
      Number(well.elevationSol) || 0,
      Number(well.elevationForage) || 0,
      Number(well.elevationProduction) || 0,
      well.spoolProd || "",
      well.packerType || "",
      well.suspTbg || "",
      well.etanTbg || "",
      well.origineCotes || "",
      well.xmasTreeBrand || "",
      well.xmasTreeType || "",
      well.xmasTreeRactSup || "",
      well.xmasTreePressure || "",
      well.xmasTreeAttacheTbg || "",
      well.xmasTreeEmbase || "",
      well.xmasTreeReduction || "",
      well.xmasTreeOlive || "",
      well.vannesSasMarque || "",
      well.vannesSasNombre || "",
      well.vannesSasSerie || "",
      well.vannesMaitresseMarque || "",
      well.vannesMaitresseNombre || "",
      well.vannesMaitresseSerie || "",
      well.vannesLatTbgMarque || "",
      well.vannesLatTbgNombre || "",
      well.vannesLatTbgSerie || "",
      well.vannesLatCsgMarque || "",
      well.vannesLatCsgNombre || "",
      well.vannesLatCsgSerie || "",
      well.observations || "",
      well.folio || "",
      well.folioToCancel || "",
      well.prodTbgParams?.od || "",
      well.prodTbgParams?.grade || "",
      well.prodTbgParams?.weight || "",
      well.updatedDate || "",
      well.endOperationDate || "",
      well.vuBy || "",
      well.createdAt || new Date().toISOString(),
      well.updatedAt || new Date().toISOString()
    );
    console.log(`  Inserted active well: ${well.name} (${well.id})`);

    // B. Insert Casings
    if (well.casings && well.casings.length > 0) {
      const insertCasing = db.prepare(`
        INSERT INTO casing_strings (
          id, well_id, name, borehole_size, casing_size,
          top_depth, shoe_depth, drilled_depth, top_of_cement, top_of_liner, top_of_fonde,
          grade, weight, connection, observations, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      well.casings.forEach((c, index) => {
        insertCasing.run(
          c.id || `casing-${well.id}-${index}-${Date.now()}`,
          well.id,
          c.name || "Casing String",
          String(c.boreholeSize || ""),
          String(c.casingSize || ""),
          Number(c.topDepth) || 0,
          Number(c.shoeDepth) || 0,
          Number(c.drilledDepth) || 0,
          c.topOfCement != null ? Number(c.topOfCement) : null,
          c.topOfLiner != null ? Number(c.topOfLiner) : null,
          c.topOfFonde != null ? Number(c.topOfFonde) : null,
          c.grade || "",
          c.weight != null ? Number(c.weight) : null,
          c.connection || "",
          c.observations || "",
          index + 1,
          new Date().toISOString(),
          new Date().toISOString()
        );
      });
      console.log(`  Inserted ${well.casings.length} casings`);
    }

    // C. Insert Tubings
    if (well.tubings && well.tubings.length > 0) {
      const insertTubing = db.prepare(`
        INSERT INTO tubing_components (
          id, well_id, name, type, od, length, bottom_depth,
          is_cote_product_added, observations, qty, custom_type, min_id, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      well.tubings.forEach((t, index) => {
        insertTubing.run(
          t.id || `tubing-${well.id}-${index}-${Date.now()}`,
          well.id,
          t.name || "Tubing Component",
          t.type || "Tubing",
          t.od || "",
          Number(t.length) || 0,
          Number(t.bottomDepth) || 0,
          t.isCoteProductAdded ? 1 : 0,
          t.observations || "",
          t.qty || "",
          t.customType || "",
          t.minId || "",
          index + 1,
          new Date().toISOString(),
          new Date().toISOString()
        );
      });
      console.log(`  Inserted ${well.tubings.length} tubings`);
    }

    // D. Insert Perforations
    if (well.perforations && well.perforations.length > 0) {
      const insertPerf = db.prepare(`
        INSERT INTO perforation_zones (
          id, well_id, top_depth, bottom_depth, perfo_type, diameter, density, shots, observations, calage, reservoir, is_squeezed, display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      well.perforations.forEach((p, index) => {
        insertPerf.run(
          p.id || `perf-${well.id}-${index}-${Date.now()}`,
          well.id,
          Number(p.topDepth) || 0,
          Number(p.bottomDepth) || 0,
          p.perfoType || "",
          p.diameter || "",
          p.density != null ? Number(p.density) : null,
          p.shots != null ? Number(p.shots) : null,
          p.observations || "",
          p.calage || "",
          p.reservoir || "",
          p.isSqueezed ? 1 : 0,
          index + 1,
          new Date().toISOString(),
          new Date().toISOString()
        );
      });
      console.log(`  Inserted ${well.perforations.length} perforations`);
    }
  }

  // Re-enable foreign keys and verify constraints
  db.pragma('foreign_keys = ON');
  console.log("\n✅ Local SQLite restoration complete!");

  // Verify counts
  ['wells', 'casing_strings', 'tubing_components', 'perforation_zones', 'well_history'].forEach(t => {
    console.log(`  - ${t} local count:`, db.prepare(`SELECT count(*) as c FROM ${t}`).get().c);
  });

  console.log("\n=== STEP 5: Pushing all data to Supabase ===");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const tables = [
    { name: 'custom_tool_types' },
    { name: 'employees' },
    { name: 'wells' },
    { name: 'casing_strings' },
    { name: 'tubing_components' },
    { name: 'perforation_zones' },
    { name: 'well_history' }
  ];

  const tableColumns = {
    custom_tool_types: [
      'id', 'type', 'default_name', 'default_od', 'default_custom_type', 'default_min_id', 'french_designation', 'created_at', 'updated_at'
    ],
    employees: [
      'id', 'matricule', 'nom_prenom', 'd_rec', 'd_f_contrat', 'personnel', 'fonction', 'observation', 'created_at', 't_combinaison', 't_blouson', 't_pantalon', 't_parka', 't_pantalon_ord', 't_chemise_ord', 't_tshirt_ord', 't_pull', 'p_chaussure', 't_veste_cuire', 'service', 'password', 'role'
    ],
    wells: [
      'id', 'name', 'purpose', 'completion_type', 'reservoir', 'field', 'elevation_sol', 'elevation_forage', 'elevation_production', 'spool_prod', 'packer_type', 'susp_tbg', 'etan_tbg', 'origine_cotes', 'xmas_tree_brand', 'xmas_tree_type', 'xmas_tree_ract_sup', 'xmas_tree_pressure', 'xmas_tree_attache_tbg', 'xmas_tree_embase', 'xmas_tree_reduction', 'xmas_tree_olive', 'vannes_sas_marque', 'vannes_sas_nombre', 'vannes_sas_serie', 'vannes_maitresse_marque', 'vannes_maitresse_nombre', 'vannes_maitresse_serie', 'vannes_lat_tbg_marque', 'vannes_lat_tbg_nombre', 'vannes_lat_tbg_serie', 'vannes_lat_csg_marque', 'vannes_lat_csg_nombre', 'vannes_lat_csg_serie', 'observations', 'folio', 'folio_to_cancel', 'prod_tbg_od', 'prod_tbg_grade', 'prod_tbg_weight', 'updated_date', 'end_operation_date', 'vu_by', 'created_at', 'updated_at'
    ],
    casing_strings: [
      'id', 'well_id', 'name', 'borehole_size', 'casing_size', 'top_depth', 'shoe_depth', 'drilled_depth', 'top_of_cement', 'top_of_liner', 'grade', 'weight', 'connection', 'observations', 'display_order', 'created_at', 'updated_at'
    ],
    tubing_components: [
      'id', 'well_id', 'name', 'type', 'od', 'length', 'bottom_depth', 'is_cote_product_added', 'observations', 'qty', 'custom_type', 'min_id', 'display_order', 'created_at', 'updated_at'
    ],
    perforation_zones: [
      'id', 'well_id', 'top_depth', 'bottom_depth', 'perfo_type', 'diameter', 'density', 'shots', 'observations', 'calage', 'reservoir', 'is_squeezed', 'display_order', 'created_at', 'updated_at'
    ],
    well_history: [
      'id', 'well_id', 'folio', 'snapshot', 'created_at'
    ]
  };

  // Delete all rows in Supabase to start clean
  console.log("\n--- Clearing outdated Supabase records ---");
  const deleteOrder = ['well_history', 'perforation_zones', 'tubing_components', 'casing_strings', 'wells', 'employees', 'custom_tool_types'];
  
  for (const tableName of deleteOrder) {
    console.log(`Deleting existing rows from Supabase table: ${tableName}...`);
    const { error } = await sb.from(tableName).delete().not('id', 'is', null);
    if (error) {
      console.warn(`⚠️ Warning: Could not delete from ${tableName}:`, error.message);
    } else {
      console.log(`✅ Cleared ${tableName} in Supabase`);
    }
  }

  console.log("\n--- Pushing newly restored local data to Supabase ---");

  for (const table of tables) {
    const tableName = table.name;
    console.log(`\nReading restored local SQLite table: ${tableName}...`);
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all();

    if (rows.length === 0) {
      console.log(`ℹ️ Table ${tableName} is empty. Skipping.`);
      continue;
    }

    console.log(`Formatting ${rows.length} rows for Supabase...`);

    const formattedRows = rows.map(row => {
      const filtered = {};
      const allowedCols = tableColumns[tableName] || Object.keys(row);
      
      allowedCols.forEach(col => {
        if (col in row) {
          filtered[col] = row[col];
        }
      });

      if ('is_cote_product_added' in filtered) {
        filtered.is_cote_product_added = !!filtered.is_cote_product_added;
      }

      if ('snapshot' in filtered && typeof filtered.snapshot === 'string') {
        try {
          filtered.snapshot = JSON.parse(filtered.snapshot);
        } catch (e) {
          console.warn(`⚠️ Warning parsing snapshot JSON:`, e.message);
        }
      }

      for (const key of Object.keys(filtered)) {
        if (filtered[key] === '') {
          if (['d_rec', 'd_f_contrat', 'top_of_cement', 'top_of_liner', 'top_of_fonde', 'weight', 'density', 'shots'].includes(key)) {
            filtered[key] = null;
          }
        }
      }

      return filtered;
    });

    console.log(`Pushing ${formattedRows.length} rows to Supabase table: ${tableName}...`);
    
    const chunkSize = 50;
    for (let i = 0; i < formattedRows.length; i += chunkSize) {
      const chunk = formattedRows.slice(i, i + chunkSize);
      const { error } = await sb.from(tableName).insert(chunk);
      if (error) {
        console.error(`❌ Error pushing chunk to ${tableName}:`, error.message);
        throw error;
      }
    }
    console.log(`✅ Successfully pushed all rows for ${tableName}!`);
  }

  console.log("\n🎉 CONGRATULATIONS! Data recovery and Supabase synchronization completed perfectly!");
  db.close();
}

main().catch(err => {
  console.error("❌ Reseed and sync process failed:", err);
  process.exit(1);
});
