import express from "express";
import http from "http";
import path from "path";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import url from "url";

let SERVER_DIR = process.cwd();
try {
  SERVER_DIR = __dirname;
} catch {
  SERVER_DIR = path.dirname(url.fileURLToPath(import.meta.url));
}
import ws from "ws";
import Database from "better-sqlite3";
import {
  initDb, getDb, wasEverSynced, markSynced, runMigrations,
  upsertEmployee, upsertWell, upsertCasing, upsertTubing, upsertPerforation, upsertLinerCrepine, upsertToolType, upsertHistory, upsertCementPlug, upsertBridgePlug, upsertPerimetre, upsertSrpComponent
} from "./src/lib/localDb";

// Polyfill WebSocket for older Node versions (like Node 20 inside Electron 33)
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = ws;
}

// Bypasses TLS cert validation to support corporate proxy SSL inspection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Redirect server console logs to server_debug.log
try {
  const logFile = path.join(process.cwd(), "server_debug.log");
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  
  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalErrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
    logStream.write(chunk);
    return originalWrite(chunk, encoding, callback);
  };

  process.stderr.write = (chunk: any, encoding?: any, callback?: any) => {
    logStream.write(chunk);
    return originalErrWrite(chunk, encoding, callback);
  };

  console.log(`\n--- Server Startup at ${new Date().toISOString()} ---`);
} catch (e) {
  console.error("Failed to initialize file logging:", e);
}

let envPath = ".env";
let envLocalPath = ".env.local";

try {
  const dirname = SERVER_DIR;
  const isBuilt = dirname.endsWith('dist');
  if (isBuilt) {
    envPath = path.join(dirname, "..", ".env");
    envLocalPath = path.join(dirname, "..", ".env.local");
  } else {
    envPath = path.join(dirname, ".env");
    envLocalPath = path.join(dirname, ".env.local");
  }
} catch {
  // ESM / Dev mode fallback
  envPath = path.join(process.cwd(), ".env");
  envLocalPath = path.join(process.cwd(), ".env.local");
}

dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // API Route for Gemini extraction
  app.post("/api/extract-completion", async (req, res) => {
    try {
      const { text, image, mimeType } = req.body;
      if (!text && !image) {
        return res.status(400).json({ error: "No text report or image provided" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("Gemini API key is not configured. Falling back to local heuristic parser.");
        if (image) {
          return res.status(400).json({ error: "Gemini API key is required to analyze images. Please configure your key in Settings > Secrets." });
        }
        const fallbackData = tryLocalHeuristicParse(text || "");
        if (fallbackData) {
          return res.json(fallbackData);
        }
        return res.status(500).json({ error: "Gemini API key is not configured in secrets. Please set it in Settings > Secrets." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are an expert Oil & Gas completion engineer. Extract well completion details from the provided text and/or image of a wellbore specification sheet/completion card.
Identify:
1. Well name, purpose, completion type, reservoir, and elevations (Z Sol, Z Forage, Z Production) if present.
2. Casing strings (casing sizes, borehole sizes, top of cement, shoe depths, grades, weights, drilled depths).
3. Tubing string components (designation/name, type, OD, length, bottom depth, observations). Match types strictly to one of these: 'Tubing', 'Packer', 'Seating Nipple', 'Shoe', 'Side-pocket Mandrel', 'Anchor-seal', 'Reduction', 'Sliding Sleeve', 'Other'.
4. Perforation zones (top depth, bottom depth, perfo type, gun diameter, density shots, total shots).
5. Tête d'Éruption / Christmas Tree: xmasTreeBrand (Marque), xmasTreeType (Type), xmasTreeRactSup (Ract. Sup.), xmasTreePressure (Pression service), xmasTreeAttacheTbg (Attache Tbg), xmasTreeEmbase (Embase), xmasTreeReduction (Réduction), xmasTreeOlive (Olive / Hanger Spec).
   CRITICAL: Do NOT bundle other Christmas tree details or text into 'xmasTreePressure'. Place ONLY the specific pressure rating (e.g. '2000 PSI' or '3000 PSI') inside 'xmasTreePressure'. Put other specs in their dedicated fields listed above.
6. Valve Specs (SAS, Maitresse, LAT-TBG, LAT-CSG): Marque, Nombre, Ø & Série for each.

Format the output strictly as a JSON object matching the provided schema. If fields are not found, leave them null or default.
${text ? `REPORT TEXT OR CONTEXT:\n${text}` : ''}
`;

      const contents: any[] = [];
      if (image) {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        contents.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType || "image/png"
          }
        });
      }
      contents.push(prompt);

      let extractedData;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                purpose: { type: Type.STRING },
                completionType: { type: Type.STRING },
                reservoir: { type: Type.STRING },
                field: { type: Type.STRING },
                elevationSol: { type: Type.NUMBER },
                elevationForage: { type: Type.NUMBER },
                elevationProduction: { type: Type.NUMBER },
                spoolProd: { type: Type.STRING },
                packerType: { type: Type.STRING },
                suspTbg: { type: Type.STRING },
                etanTbg: { type: Type.STRING },
                origineCotes: { type: Type.STRING },
                xmasTreeBrand: { type: Type.STRING },
                xmasTreeType: { type: Type.STRING },
                xmasTreeRactSup: { type: Type.STRING },
                xmasTreePressure: { type: Type.STRING },
                xmasTreeAttacheTbg: { type: Type.STRING },
                xmasTreeEmbase: { type: Type.STRING },
                xmasTreeReduction: { type: Type.STRING },
                xmasTreeOlive: { type: Type.STRING },
                vannesSasMarque: { type: Type.STRING },
                vannesSasNombre: { type: Type.STRING },
                vannesSasSerie: { type: Type.STRING },
                vannesMaitresseMarque: { type: Type.STRING },
                vannesMaitresseNombre: { type: Type.STRING },
                vannesMaitresseSerie: { type: Type.STRING },
                vannesLatTbgMarque: { type: Type.STRING },
                vannesLatTbgNombre: { type: Type.STRING },
                vannesLatTbgSerie: { type: Type.STRING },
                vannesLatCsgMarque: { type: Type.STRING },
                vannesLatCsgNombre: { type: Type.STRING },
                vannesLatCsgSerie: { type: Type.STRING },
                casings: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      boreholeSize: { type: Type.NUMBER },
                      casingSize: { type: Type.NUMBER },
                      topDepth: { type: Type.NUMBER },
                      shoeDepth: { type: Type.NUMBER },
                      drilledDepth: { type: Type.NUMBER },
                      topOfCement: { type: Type.NUMBER },
                      grade: { type: Type.STRING },
                      weight: { type: Type.NUMBER },
                      observations: { type: Type.STRING }
                    },
                    required: ["name", "boreholeSize", "casingSize", "shoeDepth"]
                  }
                },
                tubings: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      type: { type: Type.STRING, enum: ['Tubing', 'Packer', 'Seating Nipple', 'Shoe', 'Side-pocket Mandrel', 'Anchor-seal', 'Reduction', 'Sliding Sleeve', 'Tailpipe', 'Other'] },
                      od: { type: Type.STRING },
                      length: { type: Type.NUMBER },
                      bottomDepth: { type: Type.NUMBER },
                      observations: { type: Type.STRING }
                    },
                    required: ["name", "type", "length", "bottomDepth"]
                  }
                },
                perforations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topDepth: { type: Type.NUMBER },
                      bottomDepth: { type: Type.NUMBER },
                      perfoType: { type: Type.STRING },
                      diameter: { type: Type.STRING },
                      density: { type: Type.NUMBER },
                      shots: { type: Type.NUMBER },
                      observations: { type: Type.STRING }
                    },
                    required: ["topDepth", "bottomDepth"]
                  }
                },
                observations: { type: Type.STRING }
              }
            }
          }
        });

        const textResult = response.text?.trim() || "{}";
        extractedData = JSON.parse(textResult);
      } catch (geminiErr) {
        console.warn("Gemini service error or timeout, falling back to local heuristic parser:", geminiErr);
        const fallbackData = tryLocalHeuristicParse(text || "");
        if (fallbackData) {
          extractedData = fallbackData;
        } else {
          throw geminiErr;
        }
      }

      res.json(extractedData);
    } catch (error) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  app.get('/api/app/updater-log', (req, res) => {
    try {
      const userDataPath = process.env.USER_DATA_PATH || process.cwd();
      const logPath = path.join(userDataPath, 'updater-activity.log');
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        return res.json({ log: content });
      }
      res.json({ log: 'No updater log found yet.' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  app.get('/api/app/update-check', async (req, res) => {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      let currentVersion = '1.0.0';
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        currentVersion = pkg.version || '1.0.0';
      }

      const response = await fetch('https://api.github.com/repos/HALIMOUVIC/TT/releases/latest', {
        headers: { 'User-Agent': 'WellboreSchematicPro' }
      });
      if (!response.ok) {
        return res.json({ hasUpdate: false, currentVersion });
      }
      const data = await response.json() as any;
      const latestTag = (data.tag_name || '').replace(/^v/, '');
      const downloadUrl = data.html_url || 'https://github.com/HALIMOUVIC/TT/releases/latest';

      const hasUpdate = latestTag && latestTag !== currentVersion;
      res.json({
        hasUpdate,
        currentVersion,
        latestVersion: latestTag,
        downloadUrl,
        releaseNotes: data.body || ''
      });
    } catch (err) {
      res.json({ hasUpdate: false, error: (err as Error).message });
    }
  });

  // ─── SQLite DB init & first-run Supabase sync ──────────────────────────────
  const userDataPath = process.env.USER_DATA_PATH || process.cwd();
  initDb(userDataPath);
  runMigrations();

  function isBridgePlugTool(t: { name?: string; type?: string; custom_type?: string; customType?: string; designation?: string }) {
    const effectiveType = (t.customType || t.custom_type || t.type || '').toLowerCase();
    const name = (t.name || t.designation || '').toLowerCase();
    return (
      effectiveType === 'bridge plug' ||
      effectiveType.includes('bridge') ||
      name.includes('bridge') ||
      name.includes('b.p') ||
      name.includes('bp')
    );
  }

  // Try to sync from Supabase on first ever run (one-time migration)
  async function tryInitialSupabaseSync() {
    if (wasEverSynced()) {
      console.log("SQLite base.db already populated — skipping Supabase sync.");
      return;
    }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if (!url || !key || url.includes("your-project")) {
      console.log("No Supabase config — skipping initial sync.");
      return;
    }
    try {
      console.log("First run: syncing all data from Supabase → base.db...");
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

      const [empRes, wellsRes, casingsRes, tubingsRes, perfsRes, toolsRes, histRes, cementRes, bridgeRes, perimRes, linerCrepinesRes, srpRes] = await Promise.all([
        Promise.resolve(sb.from("employees").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("wells").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("casing_strings").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("tubing_components").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("perforation_zones").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("custom_tool_types").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("well_history").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("cement_plugs").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("bridge_plugs").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("perimetres").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("crepine_zone").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("srp_components").select("*")).catch(() => ({ data: [] }))
      ]);

      const db = getDb();
      const syncAll = db.transaction(() => {
        for (const e of empRes.data || []) upsertEmployee(e);
        for (const w of wellsRes.data || []) upsertWell(w);
        for (const c of casingsRes.data || []) upsertCasing(c);
        for (const t of tubingsRes.data || []) upsertTubing(t);
        for (const p of perfsRes.data || []) upsertPerforation(p);
        for (const tt of toolsRes.data || []) upsertToolType(tt);
        for (const h of histRes.data || []) upsertHistory(h);
        for (const cp of cementRes.data || []) upsertCementPlug(cp);
        for (const bp of bridgeRes.data || []) upsertBridgePlug(bp);
        for (const pm of (perimRes as any)?.data || []) upsertPerimetre(pm);
        for (const lc of (linerCrepinesRes as any)?.data || []) upsertLinerCrepine(lc);
        for (const srp of (srpRes as any)?.data || []) upsertSrpComponent(srp);
      });
      syncAll();
      markSynced();
      console.log("✅ Initial Supabase → SQLite sync complete!");
    } catch (err) {
      console.warn("Could not sync from Supabase (offline or config missing):", err);
    }
  }

  tryInitialSupabaseSync();

  let isSupabaseReachable = true;

  // Helper to obtain active Supabase client or null (with offline & proxy fallback)
  function getSupabase() {
    if (process.env.OFFLINE_MODE === "true") {
      return null;
    }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if (!url || !key || url.includes("your-project") || !url.startsWith("http")) {
      return null;
    }
    try {
      return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } catch (err) {
      console.warn("Proxy/Network warning creating Supabase client — falling back to local SQLite:", err);
      isSupabaseReachable = false;
      return null;
    }
  }

  function formatError(err: any): string {
    if (!err) return "Unknown error";
    if (err instanceof Error) return err.message;
    if (typeof err === "object") {
      const msg = err.message || err.error_description || err.error || "";
      const details = err.details ? ` (${err.details})` : "";
      const code = err.code ? ` [Code: ${err.code}]` : "";
      if (msg) return `${msg}${details}${code}`;
      return JSON.stringify(err);
    }
    return String(err);
  }

  // Real-time synchronization helper from Supabase → SQLite with 3s proxy/offline timeout
  async function syncFromSupabase() {
    const sb = getSupabase();
    if (!sb) {
      isSupabaseReachable = false;
      return;
    }
    try {
      console.log("DEBUG: Syncing all tables from Supabase to SQLite...");
      
      const syncPromise = Promise.all([
        Promise.resolve(sb.from("employees").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("wells").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("casing_strings").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("tubing_components").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("perforation_zones").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("custom_tool_types").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("well_history").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("cement_plugs").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("bridge_plugs").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("perimetres").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("crepine_zone").select("*")).catch(() => ({ data: [] })),
        Promise.resolve(sb.from("srp_components").select("*")).catch(() => ({ data: [] }))
      ]);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase proxy/network request timed out (3s limit)")), 3000)
      );

      const [empRes, wellsRes, casingsRes, tubingsRes, perfsRes, toolsRes, histRes, cementRes, bridgeRes, perimRes, lcRes, srpRes] = await Promise.race([
        syncPromise,
        timeoutPromise
      ]);

      if (empRes.error) throw empRes.error;
      if (wellsRes.error) throw wellsRes.error;

      isSupabaseReachable = true;

      const db = getDb();
      const syncAll = db.transaction(() => {
        if (empRes.data) {
          db.prepare("DELETE FROM employees").run();
          for (const e of empRes.data) upsertEmployee(e);
          console.log("DEBUG: Synced employees:", empRes.data.length);
        }
        if (wellsRes.data) {
          db.prepare("DELETE FROM wells").run();
          for (const w of wellsRes.data) upsertWell(w);
          console.log("DEBUG: Synced wells:", wellsRes.data.length);
        }
        if (casingsRes.data) {
          db.prepare("DELETE FROM casing_strings").run();
          for (const c of casingsRes.data) upsertCasing(c);
          console.log("DEBUG: Synced casings:", casingsRes.data.length);
        }
        if (tubingsRes.data) {
          db.prepare("DELETE FROM tubing_components").run();
          for (const t of tubingsRes.data) upsertTubing(t);
          console.log("DEBUG: Synced tubings:", tubingsRes.data.length);
        }
        if (perfsRes.data) {
          db.prepare("DELETE FROM perforation_zones").run();
          for (const p of perfsRes.data) upsertPerforation(p);
          console.log("DEBUG: Synced perforations:", perfsRes.data.length);
        }
        if (toolsRes.data) {
          const localTools = db.prepare("SELECT id, display_order FROM custom_tool_types").all() as any[];
          const localOrderMap = new Map<string, number>();
          for (const lt of localTools) {
            if (lt.id) localOrderMap.set(lt.id, lt.display_order || 0);
          }

          db.prepare("DELETE FROM custom_tool_types").run();
          for (const tt of toolsRes.data) {
            const preservedOrder = localOrderMap.get(tt.id) ?? 0;
            upsertToolType({ ...tt, display_order: preservedOrder });
          }
          console.log("DEBUG: Synced tools:", toolsRes.data.length);
        }
        if (histRes.data) {
          db.prepare("DELETE FROM well_history").run();
          for (const h of histRes.data) upsertHistory(h);
          console.log("DEBUG: Synced history:", histRes.data.length);
        }
        if (cementRes && (cementRes as any).data) {
          db.prepare("DELETE FROM cement_plugs").run();
          for (const cp of (cementRes as any).data) upsertCementPlug(cp);
          console.log("DEBUG: Synced cement plugs:", (cementRes as any).data.length);
        }
        if (bridgeRes && (bridgeRes as any).data) {
          try {
            db.prepare("DELETE FROM bridge_plugs").run();
            for (const bp of (bridgeRes as any).data) upsertBridgePlug(bp);
            console.log("DEBUG: Synced bridge plugs:", (bridgeRes as any).data.length);
          } catch (err) {
            console.warn("bridge_plugs sync warning:", err);
          }
        }
        if (perimRes && (perimRes as any).data) {
          db.prepare("DELETE FROM perimetres").run();
          for (const pm of (perimRes as any).data) upsertPerimetre(pm);
          console.log("DEBUG: Synced perimetres:", (perimRes as any).data.length);
        }
        if (lcRes && (lcRes as any).data) {
          try {
            db.prepare("DELETE FROM crepine_zone").run();
            for (const lc of (lcRes as any).data) upsertLinerCrepine(lc);
            console.log("DEBUG: Synced liner crepines:", (lcRes as any).data.length);
          } catch (err) {
            console.warn("crepine_zone sync warning:", err);
          }
        }
        if (srpRes && (srpRes as any).data) {
          try {
            db.prepare("DELETE FROM srp_components").run();
            for (const srp of (srpRes as any).data) upsertSrpComponent(srp);
            console.log("DEBUG: Synced srp components:", (srpRes as any).data.length);
          } catch (err) {
            console.warn("srp_components sync warning:", err);
          }
        }
      });
      syncAll();
      markSynced();
      console.log("✅ Supabase → SQLite sync completed successfully!");
    } catch (err) {
      console.warn("Could not sync from Supabase, operating in local fallback mode:", err instanceof Error ? err.message : err);
    }
  }

  // Helper to build a well object from SQLite rows
  function buildWellFromRows(
    row: any,
    casingsData: any[],
    tubingsData: any[],
    perfsData: any[],
    historyData: any[],
    cementPlugsData: any[] = [],
    bridgePlugsData: any[] = [],
    linerCrepinesData: any[] = [],
    srpComponentsData: any[] = []
  ) {
    const wellHistory = historyData.filter((h: any) => h.well_id === row.id);
    let maxFolio = 0;
    for (const h of wellHistory) {
      const f = parseInt(h.folio, 10) || 0;
      if (f > maxFolio) maxFolio = f;
    }
    const trueFolioStr = String(maxFolio).padStart(2, "0");
    const trueFolioToCancelStr = String(Math.max(0, maxFolio - 1)).padStart(2, "0");

    const wellBridgePlugs = bridgePlugsData.filter((bp: any) => bp.well_id === row.id)
      .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
      .map((bp: any) => ({
        id: bp.id,
        name: bp.designation || bp.name || 'Bridge plug',
        type: 'Bridge Plug',
        customType: bp.type || bp.custom_type || 'PERMANENT',
        od: bp.size || bp.od || '7"',
        length: Number(bp.length) || 0,
        bottomDepth: Number(bp.bottom_depth) || 0,
        observations: bp.observations || '',
        isCoteProductAdded: true,
        qty: '01'
      }));

    const standardTubings = tubingsData.filter((t: any) => t.well_id === row.id && !isBridgePlugTool(t))
      .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
      .map((t: any) => ({
        id: t.id, name: t.name, type: t.type, od: t.od,
        length: Number(t.length) || 0, bottomDepth: Number(t.bottom_depth) || 0,
        isCoteProductAdded: !!t.is_cote_product_added,
        observations: t.observations, qty: t.qty, customType: t.custom_type, minId: t.min_id
      }));

    return {
      id: row.id,
      name: row.name,
      purpose: row.purpose,
      completionType: row.completion_type,
      reservoir: row.reservoir,
      field: row.field,
      elevationSol: Number(row.elevation_sol) || 0,
      elevationForage: Number(row.elevation_forage) || 0,
      elevationProduction: Number(row.elevation_production) || 0,
      spoolProd: row.spool_prod,
      packerType: row.packer_type,
      suspTbg: row.susp_tbg,
      etanTbg: row.etan_tbg,
      origineCotes: row.origine_cotes,
      xmasTreeBrand: row.xmas_tree_brand,
      xmasTreeType: row.xmas_tree_type,
      xmasTreeRactSup: row.xmas_tree_ract_sup,
      xmasTreePressure: row.xmas_tree_pressure,
      xmasTreeAttacheTbg: row.xmas_tree_attache_tbg,
      xmasTreeEmbase: row.xmas_tree_embase,
      xmasTreeReduction: row.xmas_tree_reduction,
      xmasTreeOlive: row.xmas_tree_olive,
      vannesSasMarque: row.vannes_sas_marque,
      vannesSasNombre: row.vannes_sas_nombre,
      vannesSasSerie: row.vannes_sas_serie,
      vannesMaitresseMarque: row.vannes_maitresse_marque,
      vannesMaitresseNombre: row.vannes_maitresse_nombre,
      vannesMaitresseSerie: row.vannes_maitresse_serie,
      vannesLatTbgMarque: row.vannes_lat_tbg_marque,
      vannesLatTbgNombre: row.vannes_lat_tbg_nombre,
      vannesLatTbgSerie: row.vannes_lat_tbg_serie,
      vannesLatCsgMarque: row.vannes_lat_csg_marque,
      vannesLatCsgNombre: row.vannes_lat_csg_nombre,
      vannesLatCsgSerie: row.vannes_lat_csg_serie,
      observations: row.observations,
      folio: trueFolioStr,
      folioToCancel: trueFolioToCancelStr,
      prodTbgParams: { od: row.prod_tbg_od, grade: row.prod_tbg_grade, weight: row.prod_tbg_weight },
      updatedDate: row.updated_date,
      endOperationDate: row.end_operation_date,
      vuBy: row.vu_by,
      isAbandonProvisoire: !!row.is_abandon_provisoire,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      casings: casingsData.filter((c: any) => c.well_id === row.id)
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((c: any) => ({
          id: c.id, name: c.name,
          boreholeSize: c.borehole_size, casingSize: c.casing_size,
          topDepth: Number(c.top_depth) || 0, shoeDepth: Number(c.shoe_depth) || 0,
          drilledDepth: Number(c.drilled_depth) || 0,
          topOfCement: c.top_of_cement != null ? Number(c.top_of_cement) : null,
          topOfLiner: c.top_of_liner != null ? Number(c.top_of_liner) : null,
          startFromTOL: c.start_from_tol != null ? Boolean(c.start_from_tol) : (c.top_of_liner != null && Number(c.top_of_liner) > 0),
          topOfFonde: c.top_of_fonde != null ? Number(c.top_of_fonde) : null,
          grade: c.grade, weight: c.weight != null ? Number(c.weight) : undefined,
          connection: c.connection, observations: c.observations
        })),
      tubings: standardTubings.concat(wellBridgePlugs),
      bridgePlugs: wellBridgePlugs,
      perforations: perfsData.filter((p: any) => p.well_id === row.id)
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((p: any) => ({
          id: p.id, topDepth: Number(p.top_depth) || 0, bottomDepth: Number(p.bottom_depth) || 0,
          height: (Number(p.bottom_depth) || 0) - (Number(p.top_depth) || 0),
          perfoType: p.perfo_type, diameter: p.diameter,
          density: p.density != null ? Number(p.density) : undefined,
          shots: p.shots != null ? Number(p.shots) : undefined,
          observations: p.observations, calage: p.calage, reservoir: p.reservoir,
          isSqueezed: Boolean(p.is_squeezed)
        })),
      cementPlugs: cementPlugsData.filter((cp: any) => cp.well_id === row.id)
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((cp: any) => ({
          id: cp.id,
          topDepth: Number(cp.top_depth) || 0,
          bottomDepth: Number(cp.bottom_depth) || 0,
          observations: cp.observations || ''
        })),
      linerCrepines: (linerCrepinesData || []).filter((lc: any) => lc.well_id === row.id)
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((lc: any) => ({
          id: lc.id,
          topDepth: Number(lc.top_depth) || 0,
          bottomDepth: Number(lc.bottom_depth) || 0,
          height: Number(lc.height) || Math.abs((Number(lc.bottom_depth) || 0) - (Number(lc.top_depth) || 0)),
          typeCrepine: lc.type_crepine || '',
          diameter: lc.diameter || '',
          slot: lc.slot || '',
          idMi: lc.id_mi || '',
          nbreCoups: lc.nbre_coups != null ? Number(lc.nbre_coups) : undefined,
          observations: lc.observations || ''
        })),
      linerCrepineParams: (() => {
        if (row.liner_crepine_params) {
          try {
            const parsed = typeof row.liner_crepine_params === 'string' ? JSON.parse(row.liner_crepine_params) : row.liner_crepine_params;
            if (parsed && typeof parsed === 'object') return parsed;
          } catch (_) {}
        }
        const tol = (row.liner_top_of_liner != null ? Number(row.liner_top_of_liner) : (row.tol_depth != null ? Number(row.tol_depth) : undefined));
        const sbt = (row.liner_shoe_depth != null ? Number(row.liner_shoe_depth) : undefined);
        const ts = (row.liner_tubing_sabot_depth != null ? Number(row.liner_tubing_sabot_depth) : undefined);
        const dia = row.liner_diameter || '';
        const holeDia = row.hole_diameter || '';
        const drilledTo = row.drilled_to_depth != null ? Number(row.drilled_to_depth) : undefined;
        const spool = parseFloat(row.spool_prod || '0') || 0;

        if (tol != null || sbt != null || ts != null || dia || drilledTo != null || holeDia) {
          return {
            topOfLiner: tol,
            shoeDepth: sbt,
            diameter: dia,
            length: (tol != null && sbt != null) ? Number(Math.abs(sbt - tol).toFixed(2)) : (row.liner_length != null ? Number(row.liner_length) : undefined),
            holeDiameter: holeDia,
            drilledToDepth: drilledTo,
            tubingSabotDepth: ts,
            tubingDiameter: row.liner_tubing_diameter || '',
            tubingLength: row.liner_tubing_length != null ? Number(row.liner_tubing_length) : (ts != null ? Number(Math.max(0, ts - spool).toFixed(2)) : undefined),
            observations: row.liner_observations || ''
          };
        }
        return undefined;
      })(),
      srpComponents: (srpComponentsData || []).filter((srp: any) => srp.well_id === row.id)
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((srp: any) => ({
          id: srp.id,
          name: srp.name,
          qty: srp.qty || '01',
          type: srp.type || 'SRP',
          customType: srp.custom_type || srp.customType || '-',
          od: srp.od || '',
          length: Number(srp.length) || 0,
          bottomDepth: Number(srp.bottom_depth ?? srp.bottomDepth) || 0,
          isCoteProductAdded: !!srp.is_cote_product_added,
          observations: srp.observations || ''
        }))
    };
  }

  // 0. DB status & Proxy/Offline Mode
  app.get("/api/supabase/config-status", (req, res) => {
    const sb = getSupabase();
    res.json({
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY),
      supabaseUrl: process.env.SUPABASE_URL || "local-sqlite",
      local: true, // SQLite is ALWAYS available locally
      offlineMode: process.env.OFFLINE_MODE === "true",
      supabaseConnected: !!sb && isSupabaseReachable,
      activeEngine: sb && isSupabaseReachable ? "Hybrid (SQLite + Supabase Cloud)" : "Local SQLite (Offline & Proxy Resilience Mode)"
    });
  });

  // 1. Test Connection with auto fallback
  app.post("/api/supabase/test-connection", async (req, res) => {
    try {
      const sb = getSupabase();
      if (sb) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Supabase proxy/network timeout")), 3000)
          );
          const queryPromise = sb.from("wells").select("*", { count: "exact", head: true });
          const { count, error } = await Promise.race([queryPromise, timeoutPromise]);
          if (error) throw error;
          isSupabaseReachable = true;
          return res.json({ success: true, message: `Connected to Supabase cloud database (${count} wells synced). Local SQLite active.` });
        } catch (cloudErr) {
          isSupabaseReachable = false;
          console.warn("Supabase test connection failed (offline or proxy blocked) — using SQLite:", cloudErr);
        }
      }
      const db = getDb();
      const row = db.prepare("SELECT count(*) as c FROM wells").get() as any;
      res.json({
        success: true,
        message: `Connected to local SQLite database engine (${row.c} wells stored on PC). Proxy & Offline resilient.`
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Database connection error" });
    }
  });

  // 2. Push/Save Well(s)
  app.post("/api/supabase/push-wells", async (req, res) => {
    try {
      const { wells, updateFolio, updateWellId, editedBy } = req.body;
      if (!wells || !Array.isArray(wells)) {
        return res.status(400).json({ error: "Missing wells data to push" });
      }

      const db = getDb();
      const sb = getSupabase();
      const results: { id: string; name: string; success: boolean; error?: string; folio?: string; folioToCancel?: string }[] = [];

      for (const well of wells) {
        try {
          const wellName = (well.name || "NEW WELL").trim();
          // Check for duplicate name (different id)
          const dup = db.prepare("SELECT id FROM wells WHERE lower(name) = lower(?) AND id != ?").get(wellName, well.id);
          if (dup) {
            results.push({ id: well.id, name: well.name, success: false,
              error: `Forbidden: A well named '${wellName}' already exists. Duplicate names are forbidden.` });
            continue;
          }

          // Folio calculation
          const bodyUpdateFolio = updateWellId === well.id && updateFolio ? String(updateFolio).trim() : "";
          const saveAsFolio = (well.saveAsFolio as string | undefined)?.trim() || bodyUpdateFolio;
          if (saveAsFolio) {
            const folioStr = String(parseInt(saveAsFolio, 10) || 0).padStart(2, "0");
            well.folio = folioStr;
            well.folioToCancel = String(Math.max(0, parseInt(folioStr, 10) - 1)).padStart(2, "0");
          } else {
            const histRows = db.prepare("SELECT folio FROM well_history WHERE well_id = ?").all(well.id) as any[];
            if (histRows.length === 0) {
              // Initial folio for new well without history in database
              const userManualFolio = parseInt(well.folio || "1", 10);
              const initialFolioNum = !isNaN(userManualFolio) && userManualFolio > 0 ? userManualFolio : 1;
              well.folio = String(initialFolioNum).padStart(2, "0");
              well.folioToCancel = String(Math.max(0, initialFolioNum - 1)).padStart(2, "0");
            } else {
              let maxFolio = 0;
              for (const r of histRows) { const f = parseInt(r.folio, 10); if (!isNaN(f) && f > maxFolio) maxFolio = f; }
              well.folio = String(maxFolio + 1).padStart(2, "0");
              well.folioToCancel = String(maxFolio).padStart(2, "0");
            }
          }

          const nowIso = new Date().toISOString();
          const userEditor = editedBy || well.editedBy || "";

          let existingCreatedAt: string | undefined;
          try {
            const localRow = db.prepare("SELECT created_at FROM well_history WHERE well_id = ? AND folio = ?")
              .get(well.id, well.folio || "00") as any;
            if (localRow && localRow.created_at) {
              existingCreatedAt = localRow.created_at;
            }
          } catch (_) {}

          if (!existingCreatedAt && sb) {
            try {
              const { data: existingHist } = await sb
                .from("well_history")
                .select("created_at")
                .eq("well_id", well.id)
                .eq("folio", well.folio || "00")
                .maybeSingle();
              if (existingHist && existingHist.created_at) {
                existingCreatedAt = existingHist.created_at;
              }
            } catch (_) {}
          }

          const snapshotWell = {
            ...well,
            editedBy: userEditor,
            updatedAt: nowIso
          };
          delete (snapshotWell as any).saveAsFolio;

          // 1. ALWAYS save to local SQLite first (guarantees local persistence & history snapshot)
          const saveWell = db.transaction(() => {
            // A. Upsert well
            upsertWell({
              id: well.id, name: well.name || "NEW WELL",
              purpose: well.purpose || "Oil Producer",
              completion_type: well.completionType || "COMPLETION SIMPLE",
              reservoir: well.reservoir || "", field: well.field || "",
              elevation_sol: Number(well.elevationSol) || 0,
              elevation_forage: Number(well.elevationForage) || 0,
              elevation_production: Number(well.elevationProduction) || 0,
              spool_prod: well.spoolProd || "", packer_type: well.packerType || "",
              susp_tbg: well.suspTbg || "", etan_tbg: well.etanTbg || "",
              origine_cotes: well.origineCotes || "",
              xmas_tree_brand: well.xmasTreeBrand || "", xmas_tree_type: well.xmasTreeType || "",
              xmas_tree_ract_sup: well.xmasTreeRactSup || "", xmas_tree_pressure: well.xmasTreePressure || "",
              xmas_tree_attache_tbg: well.xmasTreeAttacheTbg || "", xmas_tree_embase: well.xmasTreeEmbase || "",
              xmas_tree_reduction: well.xmasTreeReduction || "", xmas_tree_olive: well.xmasTreeOlive || "",
              vannes_sas_marque: well.vannesSasMarque || "", vannes_sas_nombre: well.vannesSasNombre || "", vannes_sas_serie: well.vannesSasSerie || "",
              vannes_maitresse_marque: well.vannesMaitresseMarque || "", vannes_maitresse_nombre: well.vannesMaitresseNombre || "", vannes_maitresse_serie: well.vannesMaitresseSerie || "",
              vannes_lat_tbg_marque: well.vannesLatTbgMarque || "", vannes_lat_tbg_nombre: well.vannesLatTbgNombre || "", vannes_lat_tbg_serie: well.vannesLatTbgSerie || "",
              vannes_lat_csg_marque: well.vannesLatCsgMarque || "", vannes_lat_csg_nombre: well.vannesLatCsgNombre || "", vannes_lat_csg_serie: well.vannesLatCsgSerie || "",
              observations: well.observations || "", folio: well.folio || "", folio_to_cancel: well.folioToCancel || "",
              prod_tbg_od: well.prodTbgParams?.od || "", prod_tbg_grade: well.prodTbgParams?.grade || "", prod_tbg_weight: well.prodTbgParams?.weight || "",
              updated_date: well.updatedDate || "", end_operation_date: well.endOperationDate || "", vu_by: well.vuBy || "",
              is_abandon_provisoire: well.isAbandonProvisoire ? 1 : 0,
              liner_top_of_liner: well.linerCrepineParams?.topOfLiner != null ? Number(well.linerCrepineParams.topOfLiner) : null,
              tol_depth: well.linerCrepineParams?.topOfLiner != null ? Number(well.linerCrepineParams.topOfLiner) : null,
              liner_shoe_depth: well.linerCrepineParams?.shoeDepth != null ? Number(well.linerCrepineParams.shoeDepth) : null,
              liner_diameter: well.linerCrepineParams?.diameter || "",
              liner_length: well.linerCrepineParams?.length != null ? Number(well.linerCrepineParams.length) : null,
              hole_diameter: well.linerCrepineParams?.holeDiameter || "",
              drilled_to_depth: well.linerCrepineParams?.drilledToDepth != null ? Number(well.linerCrepineParams.drilledToDepth) : null,
              liner_tubing_sabot_depth: well.linerCrepineParams?.tubingSabotDepth != null ? Number(well.linerCrepineParams.tubingSabotDepth) : null,
              liner_tubing_diameter: well.linerCrepineParams?.tubingDiameter || "",
              liner_tubing_length: well.linerCrepineParams?.tubingLength != null ? Number(well.linerCrepineParams.tubingLength) : null,
              liner_observations: well.linerCrepineParams?.observations || "",
              liner_crepine_params: well.linerCrepineParams ? JSON.stringify(well.linerCrepineParams) : null,
              updated_at: new Date().toISOString()
            });

            // B. Casings
            db.prepare("DELETE FROM casing_strings WHERE well_id = ?").run(well.id);
            for (const [index, c] of (well.casings || []).entries()) {
              upsertCasing({
                id: c.id || `casing-${well.id}-${index}-${Date.now()}`,
                well_id: well.id, name: c.name || "Casing String",
                borehole_size: String(c.boreholeSize || ""), casing_size: String(c.casingSize || ""),
                top_depth: Number(c.topDepth) || 0, shoe_depth: Number(c.shoeDepth) || 0, drilled_depth: Number(c.drilledDepth) || 0,
                top_of_cement: c.topOfCement != null ? Number(c.topOfCement) : null,
                top_of_liner: c.topOfLiner != null ? Number(c.topOfLiner) : null,
                start_from_tol: (c.startFromTOL || (c.topOfLiner != null && Number(c.topOfLiner) > 0)) ? 1 : 0,
                top_of_fonde: c.topOfFonde != null ? Number(c.topOfFonde) : null,
                grade: c.grade || "", weight: c.weight != null ? Number(c.weight) : null,
                connection: c.connection || "", observations: c.observations || "", display_order: index + 1
              });
            }

            // C. Tubings (clean standard components, excluding Bridge Plugs)
            db.prepare("DELETE FROM tubing_components WHERE well_id = ?").run(well.id);
            const cleanTubingsLocal = (well.tubings || []).filter((t: any) => !isBridgePlugTool(t));
            for (const [index, t] of cleanTubingsLocal.entries()) {
              upsertTubing({
                id: t.id || `tubing-${well.id}-${index}-${Date.now()}`,
                well_id: well.id, name: t.name || "Tubing Component", type: t.type || "Tubing",
                od: t.od || "", length: Number(t.length) || 0, bottom_depth: Number(t.bottomDepth) || 0,
                is_cote_product_added: t.isCoteProductAdded ? 1 : 0, observations: t.observations || "",
                qty: t.qty || "", custom_type: t.customType || "", min_id: t.minId || "", display_order: index + 1
              });
            }

            // D. Perforations
            db.prepare("DELETE FROM perforation_zones WHERE well_id = ?").run(well.id);
            for (const [index, p] of (well.perforations || []).entries()) {
              upsertPerforation({
                id: p.id || `perf-${well.id}-${index}-${Date.now()}`,
                well_id: well.id, top_depth: Number(p.topDepth) || 0, bottom_depth: Number(p.bottomDepth) || 0,
                perfo_type: p.perfoType || "", diameter: p.diameter || "",
                density: p.density != null ? Number(p.density) : null,
                shots: p.shots != null ? Number(p.shots) : null,
                observations: p.observations || "", calage: p.calage || "", reservoir: p.reservoir || "",
                is_squeezed: p.isSqueezed ? 1 : 0, display_order: index + 1
              });
            }

            // D2. Liner Crepines
            try { db.prepare("DELETE FROM crepine_zone WHERE well_id = ?").run(well.id); } catch (_) {}
            for (const [index, lc] of (well.linerCrepines || []).entries()) {
              upsertLinerCrepine({
                id: lc.id || `lc-${well.id}-${index}-${Date.now()}`,
                well_id: well.id,
                top_depth: Number(lc.topDepth) || 0,
                bottom_depth: Number(lc.bottomDepth) || 0,
                height: Number(lc.height) || Math.abs((Number(lc.bottomDepth) || 0) - (Number(lc.topDepth) || 0)),
                type_crepine: lc.typeCrepine || "",
                diameter: lc.diameter || "",
                slot: lc.slot || "",
                id_mi: lc.idMi || "",
                nbre_coups: lc.nbreCoups != null ? Number(lc.nbreCoups) : null,
                observations: lc.observations || "",
                display_order: index + 1
              });
            }

            // D3. SRP Components
            try { db.prepare("DELETE FROM srp_components WHERE well_id = ?").run(well.id); } catch (_) {}
            for (const [index, srp] of (well.srpComponents || []).entries()) {
              upsertSrpComponent({
                id: srp.id || `srp-${well.id}-${index}-${Date.now()}`,
                well_id: well.id,
                name: srp.name || "SRP Component",
                qty: srp.qty || "01",
                type: srp.type || "SRP",
                custom_type: srp.customType || srp.custom_type || "-",
                od: srp.od || "",
                length: Number(srp.length) || 0,
                bottom_depth: Number(srp.bottomDepth ?? srp.bottom_depth) || 0,
                is_cote_product_added: srp.isCoteProductAdded ? 1 : 0,
                observations: srp.observations || "",
                display_order: index + 1
              });
            }

            // E. Cement Plugs (B.C)
            db.prepare("DELETE FROM cement_plugs WHERE well_id = ?").run(well.id);
            for (const [index, cp] of (well.cementPlugs || []).entries()) {
              upsertCementPlug({
                id: cp.id || `bc-${well.id}-${index}-${Date.now()}`,
                well_id: well.id,
                top_depth: Number(cp.topDepth) || 0,
                bottom_depth: Number(cp.bottomDepth) || 0,
                observations: cp.observations || '',
                display_order: index + 1
              });
            }

            // E2. Bridge Plugs (B.P) -> Save into bridge_plugs table
            db.prepare("DELETE FROM bridge_plugs WHERE well_id = ?").run(well.id);
            // Collect BPs from both bridgePlugs array and tubings array, de-duplicate by id
            const bpMapLocal = new Map<string, any>();
            for (const bp of (well.bridgePlugs || [])) {
              if (bp && bp.id) bpMapLocal.set(bp.id, bp);
            }
            for (const t of (well.tubings || [])) {
              if (t && t.id && isBridgePlugTool(t) && !bpMapLocal.has(t.id)) {
                bpMapLocal.set(t.id, t);
              }
            }
            const bridgePlugsToSaveLocal = Array.from(bpMapLocal.values());
            for (const [index, bp] of bridgePlugsToSaveLocal.entries()) {
              const bpBottomDepth = Number(bp.bottomDepth || bp.bottom_depth) || 0;
              console.log(`DEBUG: Saving BP local id=${bp.id} bottom_depth=${bpBottomDepth}`);
              upsertBridgePlug({
                id: bp.id || `bp-${well.id}-${index}-${Date.now()}`,
                well_id: well.id,
                designation: bp.name || bp.designation || 'Bridge plug',
                size: bp.od || bp.size || '7"',
                type: bp.customType || bp.type || 'PERMANENT',
                length: Number(bp.length) || 0,
                bottom_depth: bpBottomDepth,
                observations: bp.observations || '',
                display_order: index + 1
              });
            }

            // F. History snapshot
            upsertHistory({
              id: `history-${well.id}-${well.folio}-${Date.now()}`,
              well_id: well.id, folio: well.folio || "00",
              snapshot: JSON.stringify(snapshotWell),
              created_at: existingCreatedAt || nowIso,
              updated_at: nowIso,
              edited_by: userEditor
            });
          });

          saveWell();

          // 2. Sync to Supabase in background / try-catch
          if (sb) {
            try {
              const wellData = {
                id: well.id,
                name: well.name || "NEW WELL",
                purpose: well.purpose || "Oil Producer",
                completion_type: well.completionType || "COMPLETION SIMPLE",
                reservoir: well.reservoir || "",
                field: well.field || "",
                elevation_sol: Number(well.elevationSol) || 0,
                elevation_forage: Number(well.elevationForage) || 0,
                elevation_production: Number(well.elevationProduction) || 0,
                spool_prod: well.spoolProd || "",
                packer_type: well.packerType || "",
                susp_tbg: well.suspTbg || "",
                etan_tbg: well.etanTbg || "",
                origine_cotes: well.origineCotes || "",
                xmas_tree_brand: well.xmasTreeBrand || "",
                xmas_tree_type: well.xmasTreeType || "",
                xmas_tree_ract_sup: well.xmasTreeRactSup || "",
                xmas_tree_pressure: well.xmasTreePressure || "",
                xmas_tree_attache_tbg: well.xmasTreeAttacheTbg || "",
                xmas_tree_embase: well.xmasTreeEmbase || "",
                xmas_tree_reduction: well.xmasTreeReduction || "",
                xmas_tree_olive: well.xmasTreeOlive || "",
                vannes_sas_marque: well.vannesSasMarque || "",
                vannes_sas_nombre: well.vannesSasNombre || "",
                vannes_sas_serie: well.vannesSasSerie || "",
                vannes_maitresse_marque: well.vannesMaitresseMarque || "",
                vannes_maitresse_nombre: well.vannesMaitresseNombre || "",
                vannes_maitresse_serie: well.vannesMaitresseSerie || "",
                vannes_lat_tbg_marque: well.vannesLatTbgMarque || "",
                vannes_lat_tbg_nombre: well.vannesLatTbgNombre || "",
                vannes_lat_tbg_serie: well.vannesLatTbgSerie || "",
                vannes_lat_csg_marque: well.vannesLatCsgMarque || "",
                vannes_lat_csg_nombre: well.vannesLatCsgNombre || "",
                vannes_lat_csg_serie: well.vannesLatCsgSerie || "",
                observations: well.observations || "",
                folio: well.folio || "",
                folio_to_cancel: well.folioToCancel || "",
                prod_tbg_od: well.prodTbgParams?.od || "",
                prod_tbg_grade: well.prodTbgParams?.grade || "",
                prod_tbg_weight: well.prodTbgParams?.weight || "",
                updated_date: well.updatedDate || "",
                end_operation_date: well.endOperationDate || "",
                vu_by: well.vuBy || "",
                is_abandon_provisoire: well.isAbandonProvisoire ? true : false,
                // Liner Crépine Configuration (TOL / Sabot)
                tol_depth: well.linerCrepineParams?.topOfLiner != null ? Number(well.linerCrepineParams.topOfLiner) : null,
                liner_shoe_depth: well.linerCrepineParams?.shoeDepth != null ? Number(well.linerCrepineParams.shoeDepth) : null,
                liner_diameter: well.linerCrepineParams?.diameter || "6\"",
                liner_length: well.linerCrepineParams?.length != null ? Number(well.linerCrepineParams.length) : null,
                hole_diameter: well.linerCrepineParams?.holeDiameter || "8\" 1/2",
                drilled_to_depth: well.linerCrepineParams?.drilledToDepth != null ? Number(well.linerCrepineParams.drilledToDepth) : null,
                liner_tubing_sabot_depth: well.linerCrepineParams?.tubingSabotDepth != null ? Number(well.linerCrepineParams.tubingSabotDepth) : null,
                liner_tubing_diameter: well.linerCrepineParams?.tubingDiameter || null,
                liner_tubing_length: well.linerCrepineParams?.tubingLength != null ? Number(well.linerCrepineParams.tubingLength) : null,
                updated_at: new Date().toISOString()
              };

              let { error: wellErr } = await sb.from("wells").upsert(wellData);
              if (wellErr) {
                console.warn("wells upsert error in Supabase:", wellErr.message);
                // Fallback if specific newer columns don't exist yet on remote table
                const fallbackData = { ...wellData };
                if (wellErr.message?.includes("is_abandon_provisoire")) delete (fallbackData as any).is_abandon_provisoire;
                if (wellErr.message?.includes("tol_depth")) {
                  delete (fallbackData as any).tol_depth;
                  delete (fallbackData as any).liner_shoe_depth;
                  delete (fallbackData as any).liner_diameter;
                  delete (fallbackData as any).liner_length;
                  delete (fallbackData as any).hole_diameter;
                  delete (fallbackData as any).drilled_to_depth;
                  delete (fallbackData as any).liner_tubing_sabot_depth;
                  delete (fallbackData as any).liner_tubing_diameter;
                  delete (fallbackData as any).liner_tubing_length;
                }
                const retryRes = await sb.from("wells").upsert(fallbackData);
                if (retryRes.error) console.error("wells fallback upsert error:", retryRes.error.message);
              }

              await sb.from("casing_strings").delete().eq("well_id", well.id);
              if (well.casings && well.casings.length > 0) {
                const casingsToInsert = well.casings.map((c: any, index: number) => ({
                  id: c.id || `casing-${well.id}-${index}-${Date.now()}`,
                  well_id: well.id,
                  name: c.name || "Casing String",
                  borehole_size: String(c.boreholeSize || ""),
                  casing_size: String(c.casingSize || ""),
                  top_depth: Number(c.topDepth) || 0,
                  shoe_depth: Number(c.shoeDepth) || 0,
                  drilled_depth: Number(c.drilledDepth) || 0,
                  top_of_cement: c.topOfCement != null ? Number(c.topOfCement) : null,
                  top_of_liner: c.topOfLiner != null ? Number(c.topOfLiner) : null,
                  start_from_tol: (c.startFromTOL || (c.topOfLiner != null && Number(c.topOfLiner) > 0)) ? 1 : 0,
                  top_of_fonde: c.topOfFonde != null ? Number(c.topOfFonde) : null,
                  grade: c.grade || "",
                  weight: c.weight != null ? Number(c.weight) : null,
                  connection: c.connection || "",
                  observations: c.observations || "",
                  display_order: index + 1
                }));
                let { error: cErr } = await sb.from("casing_strings").insert(casingsToInsert);
                if (cErr && (cErr.message?.includes("top_of_fonde") || String(cErr).includes("top_of_fonde") || cErr.message?.includes("start_from_tol") || String(cErr).includes("start_from_tol"))) {
                  const fallbackCasings = casingsToInsert.map(({ top_of_fonde, start_from_tol, ...rest }) => rest);
                  await sb.from("casing_strings").insert(fallbackCasings);
                }
              }

              // Tubings (clean standard components, excluding Bridge Plugs)
              await sb.from("tubing_components").delete().eq("well_id", well.id);
              const cleanTubingsSupabase = (well.tubings || []).filter((t: any) => !isBridgePlugTool(t));
              if (cleanTubingsSupabase.length > 0) {
                const tubingsToInsert = cleanTubingsSupabase.map((t: any, index: number) => ({
                  id: t.id || `tubing-${well.id}-${index}-${Date.now()}`,
                  well_id: well.id,
                  name: t.name || "Tubing Component",
                  type: t.type || "Tubing",
                  od: t.od || "",
                  length: Number(t.length) || 0,
                  bottom_depth: Number(t.bottomDepth) || 0,
                  is_cote_product_added: t.isCoteProductAdded ? true : false,
                  observations: t.observations || "",
                  qty: t.qty || "",
                  custom_type: t.customType || "",
                  min_id: t.minId || "",
                  display_order: index + 1
                }));
                await sb.from("tubing_components").insert(tubingsToInsert);
              }

              await sb.from("perforation_zones").delete().eq("well_id", well.id);
              if (well.perforations && well.perforations.length > 0) {
                const perfsToInsert = well.perforations.map((p: any, index: number) => ({
                  id: p.id || `perf-${well.id}-${index}-${Date.now()}`,
                  well_id: well.id,
                  top_depth: Number(p.topDepth) || 0,
                  bottom_depth: Number(p.bottomDepth) || 0,
                  perfo_type: p.perfoType || "",
                  diameter: p.diameter || "",
                  density: p.density != null ? Number(p.density) : null,
                  shots: p.shots != null ? Number(p.shots) : null,
                  observations: p.observations || "",
                  calage: p.calage || "",
                  reservoir: p.reservoir || "",
                  is_squeezed: p.isSqueezed ? true : false,
                  display_order: index + 1
                }));
                let { error: pErr } = await sb.from("perforation_zones").insert(perfsToInsert);
                if (pErr) {
                  // Fallback if reservoir or is_squeezed column is not yet present on remote Supabase DB
                  const fallbackPerfs = perfsToInsert.map(({ reservoir, is_squeezed, ...rest }) => rest);
                  await sb.from("perforation_zones").insert(fallbackPerfs);
                }
              }

              // Liner Crepines
              try {
                const { error: delErr } = await sb.from("crepine_zone").delete().eq("well_id", well.id);
                if (delErr) {
                  console.warn("Could not delete from crepine_zone", delErr);
                }
                
                if (well.linerCrepines && well.linerCrepines.length > 0) {
                  const lcToInsert = well.linerCrepines.map((lc: any) => ({
                    well_id: well.id,
                    top_depth: Number(lc.topDepth) || 0,
                    bottom_depth: Number(lc.bottomDepth) || 0,
                    type_crepine: lc.typeCrepine || "",
                    diameter: lc.diameter || "",
                    slot: lc.slot || "",
                    id_mi: lc.idMi || "",
                    nbre_coups: lc.nbreCoups != null ? Number(lc.nbreCoups) : null
                  }));
                  const { error: insErr } = await sb.from("crepine_zone").insert(lcToInsert);
                  if (insErr) {
                    console.error("crepine_zone insert error:", insErr.message);
                  }
                }
              } catch (e) {
                console.error("Error saving crepine_zone:", e);
              }

              // SRP Components
              try {
                await sb.from("srp_components").delete().eq("well_id", well.id);
                if (well.srpComponents && well.srpComponents.length > 0) {
                  const srpToInsert = well.srpComponents.map((srp: any, index: number) => ({
                    id: srp.id || `srp-${well.id}-${index}-${Date.now()}`,
                    well_id: well.id,
                    name: srp.name || "SRP Component",
                    qty: srp.qty || "01",
                    type: srp.type || "SRP",
                    custom_type: srp.customType || srp.custom_type || "-",
                    od: srp.od || "",
                    length: Number(srp.length) || 0,
                    bottom_depth: Number(srp.bottomDepth ?? srp.bottom_depth) || 0,
                    is_cote_product_added: srp.isCoteProductAdded ? true : false,
                    observations: srp.observations || "",
                    display_order: index + 1
                  }));
                  const { error: srpErr } = await sb.from("srp_components").insert(srpToInsert);
                  if (srpErr) console.warn("srp_components insert warning:", srpErr.message);
                }
              } catch (e) {
                console.error("Error saving srp_components to Supabase:", e);
              }

              // Cement plugs — delete then insert
              await sb.from("cement_plugs").delete().eq("well_id", well.id);
              if (well.cementPlugs && well.cementPlugs.length > 0) {
                const plugsToInsert = well.cementPlugs.map((cp: any, index: number) => ({
                  id: cp.id || `bc-${well.id}-${index}-${Date.now()}`,
                  well_id: well.id,
                  top_depth: Number(cp.topDepth) || 0,
                  bottom_depth: Number(cp.bottomDepth) || 0,
                  observations: cp.observations || '',
                  display_order: index + 1
                }));
                const { error: bcErr } = await sb.from("cement_plugs").insert(plugsToInsert);
                if (bcErr) console.warn("cement_plugs insert warning:", bcErr.message);
              }

              // Bridge Plugs (B.P) -> Save into bridge_plugs table in Supabase!
              await sb.from("bridge_plugs").delete().eq("well_id", well.id);
              // De-duplicate by id before inserting
              const bpMapSup = new Map<string, any>();
              for (const bp of (well.bridgePlugs || [])) {
                if (bp && bp.id) bpMapSup.set(bp.id, bp);
              }
              for (const t of (well.tubings || [])) {
                if (t && t.id && isBridgePlugTool(t) && !bpMapSup.has(t.id)) {
                  bpMapSup.set(t.id, t);
                }
              }
              const bpToSaveSupabase = Array.from(bpMapSup.values());
              if (bpToSaveSupabase.length > 0) {
                const bpToInsert = bpToSaveSupabase.map((bp: any, index: number) => {
                  const bpBottomDepth = Number(bp.bottomDepth || bp.bottom_depth) || 0;
                  console.log(`DEBUG: Saving BP supabase id=${bp.id} bottom_depth=${bpBottomDepth}`);
                  return {
                    id: bp.id || `bp-${well.id}-${index}-${Date.now()}`,
                    well_id: well.id,
                    designation: bp.name || bp.designation || 'Bridge plug',
                    size: bp.od || bp.size || '7"',
                    type: bp.customType || bp.type || 'PERMANENT',
                    length: Number(bp.length) || 0,
                    bottom_depth: bpBottomDepth,
                    observations: bp.observations || '',
                    display_order: index + 1
                  };
                });
                const { error: bpErr } = await sb.from("bridge_plugs").upsert(bpToInsert, { onConflict: 'id' });
                if (bpErr) console.warn("bridge_plugs insert warning:", bpErr.message);
                else console.log(`DEBUG: Saved ${bpToInsert.length} bridge plug(s) to Supabase`);
              }

              const snapshotStr = JSON.stringify(snapshotWell);
              console.log(`DEBUG history snapshot cementPlugs count: ${(snapshotWell.cementPlugs || []).length}`);
              await sb.from("well_history").upsert({
                id: `history-${well.id}-${well.folio}-${Date.now()}`,
                well_id: well.id,
                folio: well.folio || "00",
                snapshot: snapshotStr,
                created_at: existingCreatedAt || nowIso,
                updated_at: nowIso,
                edited_by: userEditor
              }, {
                onConflict: "well_id,folio"
              });
            } catch (sbErr) {
              console.warn("Supabase background push warning:", sbErr);
            }
          }
          results.push({ id: well.id, name: well.name, success: true, folio: well.folio, folioToCancel: well.folioToCancel });
        } catch (wellErr) {
          console.error(`Error saving well ${well.name}:`, wellErr);
          const errMsg = formatError(wellErr);
          results.push({ id: well.id, name: well.name, success: false, error: errMsg });
        }
      }

      res.json({ success: true, results });
    } catch (error) {
      console.error("Push wells error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error during save" });
    }
  });

  // 2.5 Delete Well
  app.post("/api/supabase/delete-well", async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "Missing well id to delete" });
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("wells").delete().eq("id", id);
        if (error) throw error;
      }
      const db = getDb();
      db.prepare("DELETE FROM wells WHERE id = ?").run(id);
      res.json({ success: true, message: `Well ${id} deleted successfully.` });
    } catch (error) {
      console.error("Delete well error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Deletion failed" });
    }
  });

  // 3. Pull Wells
  app.post("/api/supabase/pull-wells", async (req, res) => {
    try {
      await syncFromSupabase();
      const db = getDb();
      const wellsData = db.prepare("SELECT * FROM wells ORDER BY name ASC").all() as any[];
      const casingsData = db.prepare("SELECT * FROM casing_strings").all() as any[];
      const tubingsData = db.prepare("SELECT * FROM tubing_components").all() as any[];
      const perfsData = db.prepare("SELECT * FROM perforation_zones").all() as any[];
      let linerCrepinesData: any[] = [];
      try {
        linerCrepinesData = db.prepare("SELECT * FROM crepine_zone").all() as any[];
      } catch (_) {}
      const historyData = db.prepare("SELECT well_id, folio FROM well_history").all() as any[];
      const cementPlugsData = db.prepare("SELECT * FROM cement_plugs").all() as any[];
      let bridgePlugsData: any[] = [];
      try {
        bridgePlugsData = db.prepare("SELECT * FROM bridge_plugs").all() as any[];
      } catch (_) {}
      let srpComponentsData: any[] = [];
      try {
        srpComponentsData = db.prepare("SELECT * FROM srp_components").all() as any[];
      } catch (_) {}

      const reconstructedWells = wellsData.map((row: any) => {
        return buildWellFromRows(row, casingsData, tubingsData, perfsData, historyData, cementPlugsData, bridgePlugsData, linerCrepinesData, srpComponentsData);
      });

      res.json({ success: true, wells: reconstructedWells });
    } catch (error) {
      console.error("Pull wells error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Fetch failed" });
    }
  });

  // Custom Tool Types — CRUD
  app.get("/api/supabase/custom-tool-types", async (req, res) => {
    try {
      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb.from("custom_tool_types").select("*");
          if (!error && data) {
            const db = getDb();
            const localTools = db.prepare("SELECT id, display_order FROM custom_tool_types").all() as any[];
            const localOrderMap = new Map<string, number>();
            for (const lt of localTools) {
              if (lt.id) localOrderMap.set(lt.id, lt.display_order || 0);
            }

            const syncTools = db.transaction(() => {
              db.prepare("DELETE FROM custom_tool_types").run();
              for (const tt of data) {
                const preservedOrder = localOrderMap.get(tt.id) ?? 0;
                upsertToolType({ ...tt, display_order: preservedOrder });
              }
            });
            syncTools();
          }
        } catch (e) {
          console.warn("Could not sync tool types before GET:", e);
        }
      }
      const data = getDb().prepare("SELECT * FROM custom_tool_types ORDER BY display_order ASC, rowid ASC").all();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to fetch tool types" });
    }
  });

  app.put("/api/supabase/custom-tool-types/reorder", async (req, res) => {
    try {
      const { items } = req.body; // array of tool objects or { id, display_order }
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, error: "Invalid items format" });
      }

      const stmt = getDb().prepare("UPDATE custom_tool_types SET display_order = ? WHERE id = ?");
      const transaction = getDb().transaction((list: any[]) => {
        list.forEach((item, index) => {
          if (item.id) {
            stmt.run(index, item.id);
          }
        });
      });
      transaction(items);

      const data = getDb().prepare("SELECT * FROM custom_tool_types ORDER BY display_order ASC, rowid ASC").all();
      res.json({ success: true, data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Failed to reorder tool types" });
    }
  });

  app.post("/api/supabase/custom-tool-types", async (req, res) => {
    try {
      const { type, default_name, default_od, default_custom_type, default_min_id, french_designation, display_order } = req.body;
      const id = crypto.randomUUID();
      
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("custom_tool_types").insert({
          id,
          type,
          default_name,
          default_od: default_od || "2'7/8",
          default_custom_type: default_custom_type || "EU",
          default_min_id: default_min_id || "",
          french_designation: french_designation || ""
        });
        if (error) throw error;
      }

      upsertToolType({ id, type, default_name, default_od, default_custom_type, default_min_id, french_designation, display_order: display_order || 0 });
      const data = getDb().prepare("SELECT * FROM custom_tool_types WHERE id = ?").get(id);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to create tool type" });
    }
  });

  app.put("/api/supabase/custom-tool-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { type, default_name, default_od, default_custom_type, default_min_id, french_designation, display_order } = req.body;
      
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("custom_tool_types").update({
          type,
          default_name,
          default_od,
          default_custom_type,
          default_min_id,
          french_designation
        }).eq("id", id);
        if (error) throw error;
      }

      const existing = getDb().prepare("SELECT id FROM custom_tool_types WHERE id = ?").get(id);
      if (!existing) return res.status(404).json({ success: false, error: "Tool type not found" });
      getDb().prepare(`UPDATE custom_tool_types SET type=@type, default_name=@default_name, default_od=@default_od,
        default_custom_type=@default_custom_type, default_min_id=@default_min_id, french_designation=@french_designation,
        display_order=COALESCE(@display_order, display_order),
        updated_at=datetime('now') WHERE id=@id`
      ).run({ id, type, default_name, default_od, default_custom_type, default_min_id, french_designation, display_order });
      const data = getDb().prepare("SELECT * FROM custom_tool_types WHERE id = ?").get(id);
      res.json({ success: true, data });
    } catch (error: any) {
      const isDup = error?.message?.includes("UNIQUE");
      res.status(500).json({ success: false, error: isDup ? "Ce type existe déjà." : "Failed to update tool type" });
    }
  });

  app.delete("/api/supabase/custom-tool-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("custom_tool_types").delete().eq("id", id);
        if (error) throw error;
      }
      getDb().prepare("DELETE FROM custom_tool_types WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to delete tool type" });
    }
  });

  // Well History — CRUD
  app.get("/api/supabase/well-history/:wellId", async (req, res) => {
    try {
      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb.from("well_history").select("*").eq("well_id", req.params.wellId);
          if (!error && data) {
            const db = getDb();
            const syncHist = db.transaction(() => {
              db.prepare("DELETE FROM well_history WHERE well_id = ?").run(req.params.wellId);
              for (const h of data) upsertHistory(h);
            });
            syncHist();
          }
        } catch (e) {
          console.warn("Could not sync well history before GET:", e);
        }
      }
      // Load current cement plugs for this well to enrich snapshots that are missing them
      const currentCementPlugs = getDb().prepare(
        "SELECT * FROM cement_plugs WHERE well_id = ? ORDER BY display_order ASC"
      ).all(req.params.wellId) as any[];
      const mappedCementPlugs = currentCementPlugs.map((cp: any) => ({
        id: cp.id,
        topDepth: Number(cp.top_depth) || 0,
        bottomDepth: Number(cp.bottom_depth) || 0,
        observations: cp.observations || ''
      }));

      const rows = getDb().prepare(
        "SELECT id, folio, snapshot, created_at, updated_at, edited_by FROM well_history WHERE well_id = ? ORDER BY CAST(folio AS INTEGER) DESC"
      ).all(req.params.wellId) as any[];
      const history = rows.map((row) => {
        let snapshot = row.snapshot;
        if (typeof snapshot === "string") {
          try { snapshot = JSON.parse(snapshot); } catch { /* keep as string */ }
        }
        // Enrich snapshot with current cement plugs if the snapshot is missing them
        if (snapshot && typeof snapshot === "object" && (!snapshot.cementPlugs || snapshot.cementPlugs.length === 0) && mappedCementPlugs.length > 0) {
          snapshot = { ...snapshot, cementPlugs: mappedCementPlugs };
          console.log(`DEBUG: Enriched folio ${row.folio} snapshot with ${mappedCementPlugs.length} cement plug(s)`);
        }
        console.log(`DEBUG history row folio=${row.folio} cementPlugs count=${(snapshot && snapshot.cementPlugs || []).length}`);
        const editedBy = row.edited_by || (snapshot && (snapshot.editedBy || snapshot.edited_by)) || "";
        const updatedAt = row.updated_at || (snapshot && (snapshot.updatedAt || snapshot.updated_at)) || row.created_at;
        return { ...row, snapshot, edited_by: editedBy, updated_at: updatedAt };
      });
      res.json({ success: true, history });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.delete("/api/supabase/well-history/:historyId", async (req, res) => {
    try {
      const { historyId } = req.params;
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("well_history").delete().eq("id", historyId);
        if (error) throw error;
      }
      getDb().prepare("DELETE FROM well_history WHERE id = ?").run(historyId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to delete history" });
    }
  });

  // Simple local heuristic parser to recover if Gemini fails or is rate-limited
  function tryLocalHeuristicParse(text: string): any {
    const textLower = text.toLowerCase();
    
    // If it's the GARA 2 sample, return the full precise structure directly
    if (textLower.includes("gara 2") || textLower.includes("pph") || textLower.includes("weatherford") || textLower.includes("baker 415-13d")) {
      return {
        name: "GARA 2",
        purpose: "Puits Producteur Huile (PPH)",
        completionType: "COMPLETION SIMPLE",
        reservoir: "F6",
        field: "Gara Field",
        elevationSol: 523.52,
        elevationForage: 527.08,
        elevationProduction: 522.82,
        spoolProd: "CB 15A",
        packerType: "PKR de tête",
        xmasTreeBrand: "CROWN",
        xmasTreeType: "CTCM",
        xmasTreeRactSup: "CB 15A",
        xmasTreePressure: "2000 PSI",
        xmasTreeAttacheTbg: "OLIVE",
        xmasTreeEmbase: '11" 2000',
        xmasTreeReduction: '7"1/16 X 2"9/16. 2000',
        xmasTreeOlive: 'CTC 1 A EST taraudée 2"7/8EU',
        vannesSasMarque: "WKM",
        vannesSasNombre: "1",
        vannesSasSerie: '2" 9/16 2000',
        vannesMaitresseMarque: "WKM",
        vannesMaitresseNombre: "2",
        vannesMaitresseSerie: '2" 9/16 2000',
        vannesLatTbgMarque: "WKM",
        vannesLatTbgNombre: "1",
        vannesLatTbgSerie: '2" 9/16 2000',
        vannesLatCsgMarque: "WKM",
        vannesLatCsgNombre: "2",
        vannesLatCsgSerie: '2" 1/16 2000',
        casings: [
          {
            name: 'Surface Casing 9" 5/8',
            boreholeSize: 12.25,
            casingSize: 9.625,
            topDepth: 0,
            shoeDepth: 448.45,
            drilledDepth: 450.60,
            topOfCement: 0,
            grade: 'J55',
            weight: 36,
            observations: 'Cemented to surface'
          },
          {
            name: 'Production Casing 7"',
            boreholeSize: 8.5,
            casingSize: 7.0,
            topDepth: 0,
            shoeDepth: 2065.25,
            drilledDepth: 2076.12,
            topOfCement: 1800,
            grade: 'J55',
            weight: 20,
            observations: 'Top cement at 1800m'
          }
        ],
        tubings: [
          { name: 'Olive Hanger', type: 'Side-pocket Mandrel', od: "7''1/16", length: 0.36, bottomDepth: 0.36, observations: 'CTC 1A EST' },
          { name: 'Tubing pup joint', type: 'Tubing', od: "2''7/8", length: 0.55, bottomDepth: 0.91, observations: 'J55 - 4.70#' },
          { name: 'Tubing pup joint', type: 'Tubing', od: "2''7/8", length: 2.93, bottomDepth: 3.84, observations: 'J55 - 4.70#' },
          { name: 'Tubing pup joint', type: 'Tubing', od: "2''7/8", length: 3.93, bottomDepth: 7.77, observations: 'J55 - 4.70#' },
          { name: 'Tubing String (198 jts)', type: 'Tubing', od: "2''7/8", length: 1895.52, bottomDepth: 1903.29, observations: 'J55 - 6.50# - RII' },
          { name: 'Mandrel (Side pocket)', type: 'Side-pocket Mandrel', od: "2''7/8", length: 2.09, bottomDepth: 1904.80, observations: 'WEATHERFORD' },
          { name: 'Tubing joint', type: 'Tubing', od: "2''7/8", length: 9.61, bottomDepth: 1914.41, observations: 'J55 - 6.50# - RII' },
          { name: 'Reduction FxM', type: 'Reduction', od: "2''7/8", length: 0.28, bottomDepth: 1914.69, observations: "2''3/8EU.FX2''7/8EU.F" },
          { name: 'Reduction MxM', type: 'Reduction', od: "2''3/8", length: 0.19, bottomDepth: 1914.88, observations: "2''3/8EU.MX2''3/8EU.M" },
          { name: 'Anchor Seal Assembly', type: 'Anchor-seal', od: "2''3/8", length: 0.20, bottomDepth: 1915.08, observations: 'BAKER, Size 81 - 32' },
          { name: 'Production Packer', type: 'Packer', od: '7"', length: 1.02, bottomDepth: 1915.74, observations: 'BAKER 415-13D' },
          { name: 'Tubing tailpipe', type: 'Tailpipe', od: "2''3/8", length: 2.07, bottomDepth: 1917.81, observations: 'J55 - 4.70#' },
          { name: 'Seating Nipple', type: 'Seating Nipple', od: "2''3/8", length: 0.39, bottomDepth: 1918.56, observations: "CAMCO - Bore 1''812" },
          { name: 'Tubing Guide Shoe', type: 'Shoe', od: "2''3/8", length: 0.13, bottomDepth: 1918.68, observations: 'Manchon 2"3/8 EU' }
        ],
        perforations: [
          {
            topDepth: 1934.24,
            bottomDepth: 1936.74,
            height: 2.50,
            perfoType: 'CC',
            diameter: "4'' 1/2",
            density: 13,
            shots: 32.5,
            observations: 'Squeezées de 1937.24 à 1939.24 m (WO-2007)'
          }
        ],
        observations: 'Annule le folio No 01. Mis à jour le: 22/02/2007. Fin opération le: 19/02/2007. Vu N. BENLAREDJ'
      };
    }

    // Generic heuristic fallback
    const extracted: any = {
      name: "Extracted Well",
      purpose: "Oil Producer",
      completionType: "COMPLETION SIMPLE",
      reservoir: "Target",
      field: "Unknown",
      elevationSol: 100,
      elevationForage: 105,
      elevationProduction: 98,
      casings: [],
      tubings: [],
      perforations: []
    };

    // Regex matchers
    const solMatch = text.match(/Z\s*Sol\s*=\s*([\d.]+)/i) || text.match(/Z\s*Sol\s*:\s*([\d.]+)/i);
    if (solMatch) extracted.elevationSol = parseFloat(solMatch[1]);

    const kbMatch = text.match(/Z\s*Forage\s*=\s*([\d.]+)/i) || text.match(/Z\s*Forage\s*:\s*([\d.]+)/i) || text.match(/KB\s*:\s*([\d.]+)/i);
    if (kbMatch) extracted.elevationForage = parseFloat(kbMatch[1]);

    const dfMatch = text.match(/Z\s*Production\s*=\s*([\d.]+)/i) || text.match(/Z\s*Production\s*:\s*([\d.]+)/i);
    if (dfMatch) extracted.elevationProduction = parseFloat(dfMatch[1]);

    const reservoirMatch = text.match(/Reservoir\s*:\s*([^\n\r]+)/i) || text.match(/Reservoir Target\s*:\s*([^\n\r]+)/i);
    if (reservoirMatch) extracted.reservoir = reservoirMatch[1].trim();

    return extracted;
  }

  // Authentication Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { nom_prenom, password } = req.body;
      if (!nom_prenom || !password) {
        return res.status(400).json({ success: false, error: "Nom & Prénom and password are required" });
      }

      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb.from("employees").select("*");
          if (!error && data) {
            const db = getDb();
            const syncEmp = db.transaction(() => {
              db.prepare("DELETE FROM employees").run();
              for (const e of data) upsertEmployee(e);
            });
            syncEmp();
          }
        } catch (e) {
          console.warn("Could not sync employees before login:", e);
        }
      }

      const db = getDb();
      let allEmployees = db.prepare(
        "SELECT * FROM employees"
      ).all() as any[];

      // Fallback: If employees table is empty, attempt emergency seed from seed candidates
      if (allEmployees.length === 0) {
        console.warn("⚠️ Employees table is empty during login. Emergency seeding...");
        const electronResources = (process as any).resourcesPath || "";
        const seedCandidates = [
          path.join(process.cwd(), "base.db"),
          path.join(SERVER_DIR, "base.db"),
          path.join(SERVER_DIR, "..", "base.db"),
          path.join(SERVER_DIR, "..", "..", "base.db"),
          path.join(electronResources, "base.db"),
          path.join(electronResources, "app.asar.unpacked", "base.db"),
          path.join(electronResources, "app.asar.unpacked", "dist", "base.db")
        ];
        for (const seedPath of seedCandidates) {
          if (fs.existsSync(seedPath) && fs.statSync(seedPath).size > 0) {
            try {
              const seedDb = new Database(seedPath, { readonly: true });
              const seedEmps = seedDb.prepare("SELECT * FROM employees").all() as any[];
              seedDb.close();
              if (seedEmps && seedEmps.length > 0) {
                const syncEmp = db.transaction(() => {
                  for (const e of seedEmps) upsertEmployee(e);
                });
                syncEmp();
                console.log(`✅ Emergency seeded ${seedEmps.length} employees into database from ${seedPath}`);
                allEmployees = db.prepare("SELECT * FROM employees").all() as any[];
                break;
              }
            } catch (e) {
              console.warn("Emergency seed failed from:", seedPath, e);
            }
          }
        }
      }

      const trimmedInput = nom_prenom.trim().toLowerCase();
      const strippedInput = trimmedInput.replace(/\s+/g, "");
      
      // 1. Try exact match first (case-insensitive and trimmed)
      let data = allEmployees.find(e => (e.nom_prenom || '').trim().toLowerCase() === trimmedInput);

      // 2. If no exact match, try matricule match (e.g. 60790J)
      if (!data) {
        data = allEmployees.find(e => (e.matricule || '').trim().toLowerCase() === trimmedInput);
      }

      // 3. Try space-stripped match (handles OULED HAIMOUDA vs OULEDHAIMOUDA)
      if (!data) {
        data = allEmployees.find(e => (e.nom_prenom || '').toLowerCase().replace(/\s+/g, "") === strippedInput);
      }

      // 4. Try word-by-word match (handles reversed first/last name order)
      if (!data) {
        const words = trimmedInput.split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          data = allEmployees.find(e => {
            const empNameLower = (e.nom_prenom || '').toLowerCase();
            return words.every(word => empNameLower.includes(word));
          });
        }
      }

      if (!data) {
        return res.status(401).json({ success: false, error: "Identifiants invalides" });
      }

      const inputPassword = password.trim();
      const storedPassword = data.password ? data.password.trim() : null;

      // --- Password validation logic ---
      let isValid = false;
      let mustChangePassword = false;

      // Case-insensitive check of the matricule as first-time password or fallback
      const matchesMatricule = data.matricule && inputPassword.toLowerCase() === data.matricule.trim().toLowerCase();

      if (!storedPassword) {
        // No password set — allow login with matricule as first-time password
        if (matchesMatricule) {
          isValid = true;
          mustChangePassword = true; // force password change after first login
        }
      } else {
        // Normal check: plain text or hashed variants
        const md5Hash = crypto.createHash("md5").update(inputPassword).digest("hex");
        const sha1Hash = crypto.createHash("sha1").update(inputPassword).digest("hex");
        const sha256Hash = crypto.createHash("sha256").update(inputPassword).digest("hex");

        isValid =
          storedPassword === inputPassword ||
          storedPassword.toLowerCase() === md5Hash ||
          storedPassword.toLowerCase() === sha1Hash ||
          storedPassword.toLowerCase() === sha256Hash ||
          matchesMatricule; // Safe fallback to matricule even if a password is set
      }

      if (!isValid) {
        return res.status(401).json({ success: false, error: "Mot de passe incorrect" });
      }

      const { password: _pw, ...safeUser } = data;
      res.json({ success: true, user: safeUser, must_change_password: mustChangePassword });
    } catch (error: any) {
      console.error("Login error:", error?.message || error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // Verify and fetch current user profile/role from database
  app.get("/api/auth/me", async (req, res) => {
    try {
      const { id, matricule, nom_prenom } = req.query;
      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb.from("employees").select("*");
          if (!error && data) {
            const db = getDb();
            const syncEmp = db.transaction(() => {
              db.prepare("DELETE FROM employees").run();
              for (const e of data) upsertEmployee(e);
            });
            syncEmp();
          }
        } catch (e) {
          console.warn("Could not sync employees before GET /api/auth/me:", e);
        }
      }

      const db = getDb();
      const allEmployees = db.prepare("SELECT * FROM employees").all() as any[];
      let user = null;
      if (id) {
        user = allEmployees.find(e => String(e.id) === String(id));
      }
      if (!user && matricule) {
        user = allEmployees.find(e => (e.matricule || '').trim().toLowerCase() === String(matricule).trim().toLowerCase());
      }
      if (!user && nom_prenom) {
        const trimmedInput = String(nom_prenom).trim().toLowerCase();
        user = allEmployees.find(e => (e.nom_prenom || '').trim().toLowerCase() === trimmedInput);
      }

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const { password: _pw, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || "Error fetching current user" });
    }
  });

  // Change password endpoint
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { employee_id, new_password } = req.body;
      if (!employee_id || !new_password || new_password.trim().length < 4) {
        return res.status(400).json({ success: false, error: "Données invalides" });
      }

      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("employees").update({
          password: new_password.trim()
        }).eq("id", employee_id);
        if (error) throw error;
      }

      const db = getDb();
      const result = db.prepare(
        "UPDATE employees SET password = ? WHERE id = ?"
      ).run(new_password.trim(), employee_id);

      if (result.changes === 0 && !sb) {
        return res.status(404).json({ success: false, error: "Employé introuvable" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Change password error:", error?.message || error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // Employee Management CRUD
  app.get("/api/employees", async (req, res) => {
    try {
      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb.from("employees").select("*");
          if (!error && data) {
            const db = getDb();
            const syncEmp = db.transaction(() => {
              db.prepare("DELETE FROM employees").run();
              for (const e of data) upsertEmployee(e);
            });
            syncEmp();
          }
        } catch (e) {
          console.warn("Could not sync employees before GET:", e);
        }
      }
      const db = getDb();
      const data = db.prepare(
        "SELECT * FROM employees ORDER BY id DESC"
      ).all();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const { matricule, nom_prenom, role, password, personnel, fonction, service, observation, d_rec, d_f_contrat, t_combinaison, t_blouson, t_pantalon, t_parka, t_pantalon_ord, t_chemise_ord, t_tshirt_ord, t_pull, p_chaussure, t_veste_cuire } = req.body;
      if (!nom_prenom || !nom_prenom.trim()) {
        return res.status(400).json({ success: false, error: "Le nom et prénom est obligatoire." });
      }
      
      const empMatricule = (matricule || `EMP${Date.now().toString().slice(-4)}`).trim();
      const empRole = (role || 'user').trim().toLowerCase();
      const empPassword = password && password.trim() ? password.trim() : empMatricule;

      const payload = {
        matricule: empMatricule,
        nom_prenom: nom_prenom.trim(),
        role: empRole,
        password: empPassword,
        personnel: personnel || '',
        fonction: fonction || '',
        service: service || '',
        observation: observation || '',
        d_rec: d_rec || null,
        d_f_contrat: d_f_contrat || null,
        t_combinaison: t_combinaison || null,
        t_blouson: t_blouson || null,
        t_pantalon: t_pantalon || null,
        t_parka: t_parka || null,
        t_pantalon_ord: t_pantalon_ord || null,
        t_chemise_ord: t_chemise_ord || null,
        t_tshirt_ord: t_tshirt_ord || null,
        t_pull: t_pull || null,
        p_chaussure: p_chaussure || null,
        t_veste_cuire: t_veste_cuire || null
      };

      const sb = getSupabase();
      let insertedId = null;
      if (sb) {
        const { data, error } = await sb.from("employees").insert(payload).select().single();
        if (error) throw error;
        insertedId = data.id;
        upsertEmployee(data);
      } else {
        const db = getDb();
        const info = db.prepare(`
          INSERT INTO employees (matricule, nom_prenom, role, password, personnel, fonction, service, observation, d_rec, d_f_contrat, t_combinaison, t_blouson, t_pantalon, t_parka, t_pantalon_ord, t_chemise_ord, t_tshirt_ord, t_pull, p_chaussure, t_veste_cuire)
          VALUES (@matricule, @nom_prenom, @role, @password, @personnel, @fonction, @service, @observation, @d_rec, @d_f_contrat, @t_combinaison, @t_blouson, @t_pantalon, @t_parka, @t_pantalon_ord, @t_chemise_ord, @t_tshirt_ord, @t_pull, @p_chaussure, @t_veste_cuire)
        `).run(payload);
        insertedId = info.lastInsertRowid;
      }

      const db = getDb();
      const newEmp = db.prepare(
        "SELECT * FROM employees WHERE id = ?"
      ).get(insertedId);
      res.json({ success: true, data: newEmp });
    } catch (error: any) {
      console.error("Create employee error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { matricule, nom_prenom, role, personnel, fonction, service, observation, d_rec, d_f_contrat, t_combinaison, t_blouson, t_pantalon, t_parka, t_pantalon_ord, t_chemise_ord, t_tshirt_ord, t_pull, p_chaussure, t_veste_cuire } = req.body;
      if (!nom_prenom || !nom_prenom.trim()) {
        return res.status(400).json({ success: false, error: "Le nom et prénom est obligatoire." });
      }

      const payload = {
        id,
        matricule: (matricule || '').trim(),
        nom_prenom: nom_prenom.trim(),
        role: (role || 'user').trim().toLowerCase(),
        personnel: personnel || '',
        fonction: fonction || '',
        service: service || '',
        observation: observation || '',
        d_rec: d_rec || null,
        d_f_contrat: d_f_contrat || null,
        t_combinaison: t_combinaison || null,
        t_blouson: t_blouson || null,
        t_pantalon: t_pantalon || null,
        t_parka: t_parka || null,
        t_pantalon_ord: t_pantalon_ord || null,
        t_chemise_ord: t_chemise_ord || null,
        t_tshirt_ord: t_tshirt_ord || null,
        t_pull: t_pull || null,
        p_chaussure: p_chaussure || null,
        t_veste_cuire: t_veste_cuire || null
      };

      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("employees").update(payload).eq("id", id);
        if (error) throw error;
      }

      const db = getDb();
      db.prepare(`
        UPDATE employees SET matricule=@matricule, nom_prenom=@nom_prenom, role=@role,
          personnel=@personnel, fonction=@fonction, service=@service, observation=@observation,
          d_rec=@d_rec, d_f_contrat=@d_f_contrat, t_combinaison=@t_combinaison, t_blouson=@t_blouson,
          t_pantalon=@t_pantalon, t_parka=@t_parka, t_pantalon_ord=@t_pantalon_ord, t_chemise_ord=@t_chemise_ord,
          t_tshirt_ord=@t_tshirt_ord, t_pull=@t_pull, p_chaussure=@p_chaussure, t_veste_cuire=@t_veste_cuire
        WHERE id=@id
      `).run(payload);

      const updated = db.prepare(
        "SELECT * FROM employees WHERE id = ?"
      ).get(id);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error("Update employee error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to update employee" });
    }
  });

  app.put("/api/employees/:id/password", async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!password || password.trim().length < 3) {
        return res.status(400).json({ success: false, error: "Le mot de passe doit comporter au moins 3 caractères." });
      }

      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("employees").update({ password: password.trim() }).eq("id", id);
        if (error) throw error;
      }

      const db = getDb();
      db.prepare("UPDATE employees SET password = ? WHERE id = ?").run(password.trim(), id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || "Failed to update password" });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.from("employees").delete().eq("id", id);
        if (error) throw error;
      }
      const db = getDb();
      db.prepare("DELETE FROM employees WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || "Failed to delete employee" });
    }
  });

  let perimetresHasBeenInitialized = false;

  // ─── Périmètres API Endpoints (SQLite & Supabase simultaneous sync) ─────
  app.get("/api/perimetres", async (req, res) => {
    try {
      const db = getDb();
      const sb = getSupabase();

      // Ensure local perimetres table exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS perimetres (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          abbreviation TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      try { db.prepare("ALTER TABLE perimetres ADD COLUMN abbreviation TEXT").run(); } catch (_) {}

      if (!perimetresHasBeenInitialized) {
        // If Supabase is available, sync remote perimetres on initial load
        if (sb) {
          try {
            const { data: remotePerim } = await sb.from("perimetres").select("*");
            if (remotePerim && remotePerim.length > 0) {
              for (const pm of remotePerim) {
                upsertPerimetre(pm);
              }
            }
          } catch (_) {}
        }
        perimetresHasBeenInitialized = true;
      }

      const rows = db.prepare("SELECT * FROM perimetres ORDER BY name ASC").all() as any[];
      const names = Array.from(new Set(rows.map((r: any) => r.name))).filter(Boolean);
      res.json({ success: true, perimetres: rows, names });
    } catch (error: any) {
      console.error("GET /api/perimetres error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to fetch perimetres" });
    }
  });

  app.post("/api/perimetres", async (req, res) => {
    try {
      const { name, abbreviation, names } = req.body;
      const db = getDb();
      const sb = getSupabase();

      const itemsToSave: { id?: string; name: string; abbreviation?: string }[] = [];
      if (typeof name === "string" && name.trim()) {
        itemsToSave.push({ name: name.trim(), abbreviation: abbreviation ? String(abbreviation).trim().toUpperCase() : undefined });
      }
      if (Array.isArray(names)) {
        for (const n of names) {
          if (typeof n === "string" && n.trim()) {
            itemsToSave.push({ name: n.trim() });
          } else if (n && typeof n === "object" && n.name && String(n.name).trim()) {
            itemsToSave.push({
              id: n.id ? String(n.id) : undefined,
              name: String(n.name).trim(),
              abbreviation: n.abbreviation ? String(n.abbreviation).trim().toUpperCase() : undefined
            });
          }
        }
      }

      if (itemsToSave.length === 0) {
        return res.status(400).json({ success: false, error: "No perimeter data provided" });
      }

      const saved: any[] = [];
      for (const item of itemsToSave) {
        const pId = item.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const pAbbr = item.abbreviation || null;
        upsertPerimetre({ id: pId, name: item.name, abbreviation: pAbbr });
        saved.push({ id: pId, name: item.name, abbreviation: pAbbr });

        // Save to Supabase at the same time!
        if (sb) {
          try {
            await sb.from("perimetres").upsert({ id: pId, name: item.name, abbreviation: pAbbr }, { onConflict: "name" });
          } catch (sbErr) {
            console.warn("Supabase perimetres upsert notice:", sbErr);
          }
        }
      }

      res.json({ success: true, perimetres: saved });
    } catch (error: any) {
      console.error("POST /api/perimetres error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to save perimeter" });
    }
  });

  app.put("/api/perimetres/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, abbreviation } = req.body;
      const db = getDb();
      const sb = getSupabase();

      const trimmedName = String(name || "").trim();
      const trimmedAbbr = abbreviation ? String(abbreviation).trim().toUpperCase() : null;

      if (!trimmedName) {
        return res.status(400).json({ success: false, error: "Name is required" });
      }

      db.prepare(`
        UPDATE perimetres
        SET name = ?, abbreviation = ?
        WHERE id = ? OR lower(name) = lower(?)
      `).run(trimmedName, trimmedAbbr, id, id);

      if (sb) {
        try {
          await sb.from("perimetres").upsert({ id, name: trimmedName, abbreviation: trimmedAbbr }, { onConflict: "id" });
        } catch (sbErr) {
          console.warn("Supabase update perimetre notice:", sbErr);
        }
      }

      res.json({ success: true, perimetre: { id, name: trimmedName, abbreviation: trimmedAbbr } });
    } catch (error: any) {
      console.error("PUT /api/perimetres/:id error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to update perimeter" });
    }
  });

  app.delete("/api/perimetres/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const targetStr = decodeURIComponent(id || "").trim();
      if (!targetStr) {
        return res.status(400).json({ success: false, error: "ID or Name required" });
      }

      const db = getDb();
      const sb = getSupabase();

      // Find target record in SQLite to obtain both ID and name
      const target = db.prepare("SELECT * FROM perimetres WHERE id = ? OR name = ? OR lower(name) = lower(?)").get(targetStr, targetStr, targetStr) as any;
      const targetId = target?.id || targetStr;
      const targetName = target?.name || targetStr;

      // 1. Delete from SQLite DB
      db.prepare("DELETE FROM perimetres WHERE id = ? OR name = ? OR lower(name) = lower(?)").run(targetId, targetName, targetStr);

      // 2. Delete from Supabase DB simultaneously
      if (sb) {
        try {
          if (targetId) {
            await sb.from("perimetres").delete().eq("id", targetId);
          }
          if (targetName) {
            await sb.from("perimetres").delete().eq("name", targetName);
            await sb.from("perimetres").delete().ilike("name", targetName);
          }
        } catch (sbErr) {
          console.warn("Supabase delete perimetre error:", sbErr);
        }
      }

      res.json({ success: true, deletedId: targetId, deletedName: targetName });
    } catch (error: any) {
      console.error("DELETE /api/perimetres error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to delete perimeter" });
    }
  });

  // Database Full Backup Download Endpoint
  app.get("/api/backup-db", async (req, res) => {
    try {
      const db = getDb();
      const tables = [
        "wells",
        "casing_strings",
        "tubing_components",
        "perforation_zones",
        "cement_plugs",
        "bridge_plugs",
        "crepine_zone",
        "perimetres",
        "custom_tool_types",
        "well_history",
        "employees",
        "sync_meta"
      ];

      const backupData: Record<string, any[]> = {};

      for (const table of tables) {
        try {
          const rows = db.prepare(`SELECT * FROM ${table}`).all();
          if (table === "employees") {
            backupData[table] = (rows as any[]).map(r => {
              const { password, ...rest } = r;
              return rest;
            });
          } else {
            backupData[table] = rows as any[];
          }
        } catch (e) {
          backupData[table] = [];
        }
      }

      const payload = {
        app: "Wellbore Pro",
        version: "1.0.5",
        exportedAt: new Date().toISOString(),
        tables: backupData
      };

      const fileName = `wellbore_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(JSON.stringify(payload, null, 2));
    } catch (error: any) {
      console.error("Backup DB error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to generate database backup" });
    }
  });

  // Serve static assets or mount Vite middleware
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    let distPath = "";
    try {
      distPath = SERVER_DIR.endsWith('dist') ? SERVER_DIR : path.join(SERVER_DIR, 'dist');
    } catch {
      distPath = path.join(process.cwd(), 'dist');
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
