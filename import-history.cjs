
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'wellbore-pro', 'base.db');
console.log('Opening DB at:', dbPath);

const db = new Database(dbPath);

// Ensure well_history table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS well_history (
    id TEXT PRIMARY KEY,
    well_id TEXT NOT NULL,
    folio TEXT,
    snapshot TEXT,
    created_at TEXT
  )
`);

const rows = [
  {
    id: 'history-1486b8fb789a29d89cc81553b368318a',
    well_id: 'well-1783519376578',
    folio: '02',
    snapshot: JSON.stringify({"id":"well-1783519376578","name":"RCL24","vuBy":"","field":"RCL","folio":"02","casings":[{"id":"casing-1783616807189","name":"Casing String","grade":"","weight":0,"topDepth":0,"shoeDepth":90.36,"casingSize":"18\"5/8","connection":"","topOfLiner":null,"topOfCement":null,"boreholeSize":"26\"","drilledDepth":99,"observations":""},{"id":"casing-1783616935468","name":"Casing String","grade":"","weight":54,"topDepth":0,"shoeDepth":835.36,"casingSize":"13\"3/8","connection":"","topOfLiner":null,"topOfCement":null,"boreholeSize":"16\"","drilledDepth":836.36,"observations":""},{"id":"casing-1783617153566","name":"Casing String","grade":"","weight":47,"topDepth":0,"shoeDepth":1399.36,"casingSize":"9\"5/8","connection":"","topOfLiner":null,"topOfCement":null,"boreholeSize":"12\"","drilledDepth":1400,"observations":""},{"id":"casing-1783617228937","name":"Casing String","grade":"","weight":32,"topDepth":0,"shoeDepth":1771.36,"casingSize":"7\"","connection":"","topOfLiner":null,"topOfCement":1199.36,"boreholeSize":"8\"1/2","drilledDepth":1771.36,"observations":""}],"etanTbg":"","purpose":"PPG","suspTbg":"Tbgg","tubings":[],"createdAt":"2026-07-10T00:30:24.477784+00:00","reservoir":"F6","spoolProd":"0.70","updatedAt":"2026-07-10T15:53:58.721Z","packerType":"","updatedDate":"2026-07-10","elevationSol":628.83,"observations":"","origineCotes":"","perforations":[],"xmasTreeType":"","folioToCancel":"01","prodTbgParams":{"od":"4\"1/2","grade":"C85","weight":"13.5"},"xmasTreeBrand":"","xmasTreeOlive":"","completionType":"COMPLETION SIMPLE","elevationForage":636.49,"xmasTreeAttacheTbg":"OLIVE","elevationProduction":628.85}),
    created_at: '2026-07-10 08:42:02.721257+00'
  },
  {
    id: 'history-1b9a9c2c0cf29515276a690d34606b13',
    well_id: 'well-1783519376578',
    folio: '01',
    snapshot: JSON.stringify({"id":"well-1783519376578","name":"RCL24","vuBy":"","field":"RCL","folio":"01","casings":[{"id":"casing-1783616807189","name":"","grade":"","weight":0,"topDepth":0,"shoeDepth":90.36,"casingSize":"18\"5/8","connection":"","boreholeSize":"26\"","drilledDepth":99,"observations":""},{"id":"casing-1783616935468","name":"","grade":"","weight":54,"topDepth":0,"shoeDepth":835.36,"casingSize":"13\"3/8","connection":"","boreholeSize":"16\"","drilledDepth":836.36,"observations":""},{"id":"casing-1783617153566","name":"","grade":"","weight":47,"topDepth":0,"shoeDepth":1399.36,"casingSize":"9\"5/8","connection":"","boreholeSize":"12\"","drilledDepth":1400,"observations":""},{"id":"casing-1783617228937","name":"","grade":"","weight":32,"topDepth":0,"shoeDepth":1771.36,"casingSize":"7\"","connection":"","topOfCement":1199.36,"boreholeSize":"8\"1/2","drilledDepth":1771.36,"observations":""}],"etanTbg":"","purpose":"PPG","suspTbg":"","tubings":[],"createdAt":"2026-07-08 14:02:56","reservoir":"F6","spoolProd":"0.70","updatedAt":"2026-07-10T01:30:25.589Z","packerType":"","updatedDate":"2026-07-10","elevationSol":628.83,"observations":"","origineCotes":"","perforations":[],"xmasTreeType":"","folioToCancel":"00","prodTbgParams":{"od":"4\"1/2","grade":"C85","weight":"13.5"},"completionType":"COMPLETION SIMPLE","elevationForage":636.49,"xmasTreeAttacheTbg":"","elevationProduction":628.85}),
    created_at: '2026-07-10 00:30:24.993961+00'
  },
  {
    id: 'history-294ac7e6ff9867288083ab6a6a5d9dad',
    well_id: 'well-1782891613028',
    folio: '01',
    snapshot: JSON.stringify({"id":"well-1782891613028","name":"TG 64","vuBy":"A.BOUZAHRI","field":"TIGENTOURINE","folio":"01","casings":[{"id":"c-1782891663354-0","name":"18 5/8\" Casing","grade":"K55","weight":87.5,"topDepth":0,"shoeDepth":34.42,"casingSize":"18.625","connection":"","topOfLiner":null,"topOfCement":null,"boreholeSize":"26","drilledDepth":45,"observations":""},{"id":"c-1782891663354-1","name":"13 3/8\" Casing","grade":"K55","weight":54.5,"topDepth":0,"shoeDepth":381.42,"casingSize":"13.375","connection":"","topOfLiner":null,"topOfCement":null,"boreholeSize":"16","drilledDepth":334,"observations":""},{"id":"c-1782891663354-2","name":"9 5/8\" Casing","grade":"P110 ","weight":47,"topDepth":0,"shoeDepth":983.42,"casingSize":"9.625","connection":"","topOfLiner":null,"topOfCement":281.42,"boreholeSize":"12.25","drilledDepth":1059,"observations":""},{"id":"c-1782891663354-3","name":"7\" Casing","grade":"P110 ","weight":29,"topDepth":0,"shoeDepth":1264.42,"casingSize":"7","connection":"","topOfLiner":829.42,"topOfCement":580.42,"boreholeSize":"8.5","drilledDepth":1130,"observations":""}],"etanTbg":"SBMS","purpose":"PPG","suspTbg":"Tbg","tubings":[],"createdAt":"2026-07-05T13:22:06.775151+00:00","reservoir":"F2","spoolProd":"0.68","updatedAt":"2026-07-06T15:35:27.747Z","packerType":"","updatedDate":"2026-07-06","elevationSol":450.66,"observations":"<p><br></p><p>• Puits non perforé.</p><p>• L'annulaire 7''x4''1/2 sous saumure inhibée d=1,02.</p><p>• Poids apparent 19T</p>","origineCotes":"","perforations":[],"xmasTreeType":"","folioToCancel":"00","prodTbgParams":{"od":"4\"1/2","grade":"P110","weight":"4.7"},"xmasTreeBrand":"C.EPAI","xmasTreeOlive":"C.EPAI Taraudée en 4\" 3/4 ACME ","completionType":"completion simple","vannesSasSerie":"4\"1/16.5000","xmasTreeEmbase":"11\"5000","elevationForage":458.31,"vannesSasMarque":"C.EPAI","vannesSasNombre":"01","xmasTreeRactSup":"OTIS ACME 6\"1/2","endOperationDate":"2025-12-13","xmasTreePressure":"5000","vannesLatCsgSerie":"4\"1/16.5000","vannesLatTbgSerie":"4\"1/16.5000","xmasTreeReduction":"7\"1/16 X 4\"1/16. 5000","vannesLatCsgMarque":"C.EPAI","vannesLatCsgNombre":"02","vannesLatTbgMarque":"C.EPAI","vannesLatTbgNombre":"02","xmasTreeAttacheTbg":"Olive","elevationProduction":450.73,"vannesMaitresseSerie":"4\"1/16.5000","vannesMaitresseMarque":"C.EPAI","vannesMaitresseNombre":"02"}),
    created_at: '2026-07-06 15:35:29.852539+00'
  },
  {
    id: 'history-30025b42597078f585bfcdfa7afa961d',
    well_id: 'well-1782891613028',
    folio: '02',
    snapshot: JSON.stringify({"id":"well-1782891613028","name":"TG 64","vuBy":"A.BOUZAHRI","field":"TIGENTOURINE","folio":"02","casings":[{"id":"c-1782891663354-0","name":"18 5/8\" Casing","grade":"K55","weight":87.5,"topDepth":0,"shoeDepth":34.42,"casingSize":"18.625"},{"id":"c-1782891663354-1","name":"13 3/8\" Casing","grade":"K55","weight":54.5,"topDepth":0,"shoeDepth":381.42,"casingSize":"13.375"},{"id":"c-1782891663354-2","name":"9 5/8\" Casing","grade":"P110 ","weight":47,"topDepth":0,"shoeDepth":983.42,"casingSize":"9.625","topOfCement":281.42},{"id":"c-1782891663354-3","name":"7\" Casing","grade":"P110 ","weight":29,"topDepth":0,"shoeDepth":1264.42,"casingSize":"7","topOfLiner":829.42,"topOfCement":580.42}],"etanTbg":"SBMS","purpose":"PPG","suspTbg":"Tbg","tubings":[],"createdAt":"2026-07-05T13:22:06.775151+00:00","reservoir":"F2","spoolProd":"0.68","updatedAt":"2026-07-06T15:35:57.435Z","packerType":"","updatedDate":"2026-07-06","elevationSol":450.66,"folioToCancel":"01","completionType":"completion simple","elevationForage":458.31,"xmasTreeBrand":"C.EPAI","elevationProduction":450.73}),
    created_at: '2026-07-06 15:35:58.309717+00'
  },
  {
    id: 'history-4a4bee5d2acdc11bd777a6f892e7db0e',
    well_id: 'well-1782891613028',
    folio: '04',
    snapshot: JSON.stringify({"id":"well-1782891613028","name":"TG 64","vuBy":"L.BELHADJ","field":"Not Specified","folio":"04","casings":[{"id":"c-1782891663354-0","name":"18 5/8\" Casing","grade":"K55BTC","weight":87.5,"topDepth":0,"shoeDepth":41,"casingSize":18.625,"boreholeSize":26,"drilledDepth":45},{"id":"c-1782891663354-1","name":"13 3/8\" Casing","grade":"K55 BTC","weight":54.5,"topDepth":0,"shoeDepth":333,"casingSize":13.375,"boreholeSize":16,"drilledDepth":334},{"id":"c-1782891663354-2","name":"9 5/8\" Casing","grade":"P110 N/VAM","weight":47,"topDepth":0,"shoeDepth":1057,"casingSize":9.625,"boreholeSize":12.25,"drilledDepth":1059},{"id":"c-1782891663354-3","name":"7\" Casing","grade":"P110 N-VAM","weight":29,"topDepth":0,"shoeDepth":1129,"casingSize":7,"boreholeSize":8.5,"drilledDepth":1130}],"etanTbg":"//","purpose":"PPH","suspTbg":"Tbg","tubings":[],"createdAt":"2026-07-01T07:40:13.028Z","reservoir":"F2","updatedAt":"2026-07-10T01:35:48.032Z","packerType":"//","updatedDate":"2026-07-10","elevationSol":497.295,"observations":"PEA 13''3/8* 9''5/8 =450 psi ","perforations":[{"id":"perf-1782897635555","shots":26,"calage":"CCL","height":2,"density":13,"diameter":"4\"1/2","topDepth":1100.24,"perfoType":"CC","bottomDepth":1102.24,"observations":""}],"xmasTreeType":"TCM-ET","folioToCancel":"03","xmasTreeBrand":"CAMERON","xmasTreeOlive":"CAM A403 Taraudée en 2'' 7/8  EU","completionType":"Cased Hole","vannesSasSerie":"2''1/16.2000","elevationForage":505.055,"vannesSasMarque":"CAMERON","vannesSasNombre":"01","xmasTreeRactSup":"5\" ACME-2G QUICK UNION ","endOperationDate":"2018-01-10","xmasTreePressure":"2000","xmasTreeAttacheTbg":"Olive","elevationProduction":497.295}),
    created_at: '2026-07-10 00:35:47.183434+00'
  },
  {
    id: 'history-562f24c83188c43d3a729f1ff8108274',
    well_id: 'well-1782891613028',
    folio: '03',
    snapshot: JSON.stringify({"id":"well-1782891613028","name":"TG 64","vuBy":"A.BOUZAHRI","field":"TIGENTOURINE","folio":"03","casings":[{"id":"c-1782891663354-0","name":"18 5/8\" Casing","grade":"K55","weight":87.5,"topDepth":0,"shoeDepth":34.42,"casingSize":"18.625"},{"id":"c-1782891663354-1","name":"13 3/8\" Casing","grade":"K55","weight":54.5,"topDepth":0,"shoeDepth":381.42,"casingSize":"13.375"},{"id":"c-1782891663354-2","name":"9 5/8\" Casing","grade":"P110 ","weight":47,"topDepth":0,"shoeDepth":983.42,"casingSize":"9.625","topOfCement":281.42},{"id":"c-1782891663354-3","name":"7\" Casing","grade":"P110 ","weight":29,"topDepth":0,"shoeDepth":1264.42,"casingSize":"7","topOfLiner":829.42,"topOfCement":580.42}],"etanTbg":"SBMS","purpose":"PPG","suspTbg":"Tbg","tubings":[],"createdAt":"2026-07-05T13:22:06.775151+00:00","reservoir":"F2","spoolProd":"0.68","updatedAt":"2026-07-06T15:36:06.174Z","packerType":"","updatedDate":"2026-07-06","elevationSol":450.66,"folioToCancel":"02","completionType":"completion simple","elevationForage":458.31,"xmasTreeBrand":"C.EPAI","elevationProduction":450.73}),
    created_at: '2026-07-06 15:36:07.163088+00'
  },
  {
    id: 'history-845226d4af8c34497bff3991936de016',
    well_id: 'well-1782891613028',
    folio: '06',
    snapshot: JSON.stringify({"id":"well-1782891613028","name":"TG 64","vuBy":"L.BELHADJ","field":"Not Specified","folio":"06","casings":[{"id":"c-1782891663354-0","name":"18 5/8\" Casing","grade":"K55BTC","weight":87.5,"topDepth":0,"shoeDepth":41,"casingSize":"18.625","boreholeSize":"26","drilledDepth":45},{"id":"c-1782891663354-1","name":"13 3/8\" Casing","grade":"K55 BTC","weight":54.5,"topDepth":0,"shoeDepth":333,"casingSize":"13.375","boreholeSize":"16","drilledDepth":334},{"id":"c-1782891663354-2","name":"9 5/8\" Casing","grade":"P110 N/VAM","weight":47,"topDepth":0,"shoeDepth":1057,"casingSize":"9.625","boreholeSize":"12.25","drilledDepth":1059},{"id":"c-1782891663354-3","name":"7\" Casing","grade":"P110 N-VAM","weight":29,"topDepth":0,"shoeDepth":1129,"casingSize":"7","boreholeSize":"8.5","drilledDepth":1130}],"etanTbg":"//","purpose":"PPH","suspTbg":"Tbgg","tubings":[],"createdAt":"2026-07-05T13:22:06.775151+00:00","reservoir":"F2","spoolProd":"0.68","updatedAt":"2026-07-10T15:47:51.419Z","packerType":"//","updatedDate":"2026-07-10","elevationSol":497.3,"observations":"<p>PEA 13''3/8* 9''5/8 =450 psi</p>","perforations":[{"id":"perf-1782897635555","shots":26,"calage":"CCL","height":2,"density":13,"diameter":"4\"1/2","topDepth":1100.24,"perfoType":"CC","bottomDepth":1102.24,"observations":""}],"xmasTreeType":"TCM-ET","folioToCancel":"05","xmasTreeBrand":"CAMERON","xmasTreeOlive":"CAM A403 Taraudée en 2'' 7/8  EU","completionType":"Cased Hole","vannesSasSerie":"2''1/16.2000","elevationForage":505.06,"vannesSasMarque":"CAMERON","vannesSasNombre":"01","xmasTreeRactSup":"5\" ACME-2G QUICK UNION ","endOperationDate":"2018-01-10","xmasTreePressure":"2000","xmasTreeAttacheTbg":"Olive","elevationProduction":497.3}),
    created_at: '2026-07-10 14:00:58.10422+00'
  },
  {
    id: 'history-afab3591aef6989d3154bd357e0ad958',
    well_id: 'well-1783519376578',
    folio: '03',
    snapshot: JSON.stringify({"id":"well-1783519376578","name":"RCL24","vuBy":"","field":"RCL","folio":"03","casings":[{"id":"casing-1783616807189","name":"Casing String","grade":"","weight":0,"topDepth":0,"shoeDepth":90.36,"casingSize":"18\"5/8","boreholeSize":"26\"","drilledDepth":99},{"id":"casing-1783616935468","name":"Casing String","grade":"","weight":54,"topDepth":0,"shoeDepth":835.36,"casingSize":"13\"3/8","boreholeSize":"16\"","drilledDepth":836.36},{"id":"casing-1783617153566","name":"Casing String","grade":"","weight":47,"topDepth":0,"shoeDepth":1399.36,"casingSize":"9\"5/8","boreholeSize":"12\"","drilledDepth":1400},{"id":"casing-1783617228937","name":"Casing String","grade":"","weight":32,"topDepth":0,"shoeDepth":1771.36,"casingSize":"7\"","topOfCement":1199.36,"boreholeSize":"8\"1/2","drilledDepth":1771.36}],"etanTbg":"","purpose":"PPG","suspTbg":"Tbg","tubings":[],"createdAt":"2026-07-10T00:30:24.477784+00:00","reservoir":"F6","spoolProd":"0.70","updatedAt":"2026-07-10T15:54:18.741Z","packerType":"","updatedDate":"2026-07-10","elevationSol":628.83,"observations":"","perforations":[],"folioToCancel":"02","prodTbgParams":{"od":"4\"1/2","grade":"C85","weight":"13.5"},"completionType":"COMPLETION SIMPLE","elevationForage":636.49,"xmasTreeAttacheTbg":"OLIVE","elevationProduction":628.85}),
    created_at: '2026-07-10 14:54:18.332016+00'
  },
  {
    id: 'history-fce5e4ddee5446e7458bd25609dc2ec3',
    well_id: 'well-1782891613028',
    folio: '05',
    snapshot: JSON.stringify({"id":"well-1782891613028","name":"TG 64","vuBy":"L.BELHADJ","field":"Not Specified","folio":"05","casings":[{"id":"c-1782891663354-0","name":"18 5/8\" Casing","grade":"K55BTC","weight":87.5,"topDepth":0,"shoeDepth":41,"casingSize":"18.625","boreholeSize":"26","drilledDepth":45},{"id":"c-1782891663354-1","name":"13 3/8\" Casing","grade":"K55 BTC","weight":54.5,"topDepth":0,"shoeDepth":333,"casingSize":"13.375","boreholeSize":"16","drilledDepth":334},{"id":"c-1782891663354-2","name":"9 5/8\" Casing","grade":"P110 N/VAM","weight":47,"topDepth":0,"shoeDepth":1057,"casingSize":"9.625","boreholeSize":"12.25","drilledDepth":1059},{"id":"c-1782891663354-3","name":"7\" Casing","grade":"P110 N-VAM","weight":29,"topDepth":0,"shoeDepth":1129,"casingSize":"7","boreholeSize":"8.5","drilledDepth":1130}],"etanTbg":"//","purpose":"PPH","suspTbg":"Tbg","tubings":[],"createdAt":"2026-07-01T07:40:13.028Z","reservoir":"F2","updatedAt":"2026-07-10T01:35:48.032Z","packerType":"//","updatedDate":"2026-07-10","elevationSol":497.3,"observations":"PEA 13''3/8* 9''5/8 =450 psi","perforations":[{"id":"perf-1782897635555","shots":26,"calage":"CCL","height":2,"density":13,"diameter":"4\"1/2","topDepth":1100.24,"perfoType":"CC","bottomDepth":1102.24,"observations":""}],"xmasTreeType":"TCM-ET","folioToCancel":"04","xmasTreeBrand":"CAMERON","xmasTreeOlive":"CAM A403 Taraudée en 2'' 7/8  EU","completionType":"Cased Hole","elevationForage":505.06,"endOperationDate":"2018-01-10","xmasTreePressure":"2000","xmasTreeAttacheTbg":"Olive","elevationProduction":497.3}),
    created_at: '2026-07-10 01:35:49.183434+00'
  }
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO well_history (id, well_id, folio, snapshot, created_at)
  VALUES (@id, @well_id, @folio, @snapshot, @created_at)
`);

const insertMany = db.transaction((items) => {
  let count = 0;
  for (const row of items) {
    insert.run(row);
    count++;
    console.log(`  Inserted history [${row.folio}] for well ${row.well_id}`);
  }
  return count;
});

const count = insertMany(rows);
console.log(`\n✅ Done! Inserted ${count} well_history records.`);

// Verify
const all = db.prepare('SELECT id, well_id, folio, created_at FROM well_history ORDER BY well_id, folio').all();
console.log(`\nTotal well_history records in DB: ${all.length}`);
for (const r of all) {
  console.log(`  - [${r.folio}] ${r.well_id} @ ${r.created_at}`);
}

db.close();
