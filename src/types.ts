export function parseSizeToNumber(sizeStr: string | number | undefined): number {
  if (sizeStr === undefined || sizeStr === null) return 0;
  if (typeof sizeStr === 'number') return sizeStr;
  
  // Clean up any double quotes or single quotes
  let s = String(sizeStr).replace(/["']/g, ' ').trim();
  
  // Try to parse fraction parts
  const parts = s.split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (part.includes('/')) {
      const [num, den] = part.split('/');
      total += parseFloat(num) / parseFloat(den);
    } else {
      total += parseFloat(part.replace(',', '.'));
    }
  }
  return isNaN(total) ? 0 : total;
}

export interface Perimetre {
  id: string;
  name: string;
  abbreviation?: string;
  created_at?: string;
}

export interface CasingString {
  id: string;
  name: string; // e.g., "Surface Casing", "Production Casing"
  boreholeSize: number | string; // e.g., 12.25 or "12'' 1/4"
  casingSize: number | string; // e.g., 9.625 or "9'' 5/8"
  topDepth: number; // in meters, e.g., 0
  shoeDepth: number; // in meters, e.g., 448.45 (Sabot depth)
  drilledDepth: number; // in meters, e.g., 450.60 (Total depth drilled for this section)
  topOfCement: number | null; // in meters, e.g., 1800 (Top ciment)
  topOfLiner?: number | null; // Top of liner (TOL)
  startFromTOL?: boolean; // If true, casing starts from topOfLiner instead of topDepth (0)
  topOfFonde?: number | null; // TF (Top Fonde) - top of cement plug inside casing
  grade?: string; // e.g., "J55"
  weight?: number; // e.g., 20 lbs/ft
  connection?: string; // e.g., "BTC", "VAM"
  observations?: string;
}

export type TubingComponentType = string;

export interface TubingComponent {
  id: string;
  name: string; // User description, e.g., "Tubing 2''7/8", "Packer Baker"
  type: TubingComponentType;
  od: string; // in inches, e.g., "2''7/8"
  length: number; // in meters
  bottomDepth: number; // bottom depth in meters (cote)
  isCoteProductAdded?: boolean; // New flag to track if Cote Product was explicitly added
  observations?: string; // Observations like "J55-6.5#-RII"
  qty?: string; // French "Nb." (Quantity)
  customType?: string; // French "Type"
  minId?: string; // French "Ø Mini"
}

export interface CementPlug {
  id: string;
  topDepth: number;    // Top ciment (du)
  bottomDepth: number; // Bottom (B.C) (à)
  observations?: string;
}

export interface BridgePlug {
  id: string;
  wellId?: string;
  designation?: string;
  name?: string;
  size?: string;
  od?: string;
  type?: string;
  customType?: string;
  length?: number;
  bottomDepth: number;
  observations?: string;
  displayOrder?: number;
}

export interface PerforationZone {
  id: string;
  topDepth: number; // in meters
  bottomDepth: number; // in meters
  height: number; // calculated bottomDepth - topDepth
  perfoType?: string; // e.g., "CC", "TCP"
  diameter?: string; // e.g., "4''1/2"
  density?: number; // shots per meter, e.g., 13
  shots?: number; // total shots
  observations?: string;
  calage?: string; // e.g., "CCL"
  reservoir?: string;
  isSqueezed?: boolean; // If true, perforation is squeezed / isolated
}

export interface LinerCrepineZone {
  id: string;
  topDepth: number; // in meters
  bottomDepth: number; // in meters
  height: number; // calculated bottomDepth - topDepth
  typeCrepine?: string; // e.g. "JOHNSON", "//"
  diameter?: string; // e.g. "6''"
  slot?: string; // e.g. "0.020"
  idMi?: string; // ID mi
  nbreCoups?: number; // Nbre. Coups
  observations?: string;
}

export interface LinerCrepineParams {
  topOfLiner?: number; // Début Liner Crépine (TOL)
  shoeDepth?: number; // Sabot Liner Crépine
  diameter?: string; // Diamètre Liner Crépine (e.g. 6", 7", 4"1/2)
  length?: number; // Longueur calculée (shoeDepth - topOfLiner)
  tubingSabotDepth?: number; // Sabot du tubing connecté dans le liner crépine
  tubingDiameter?: string; // Diamètre du tubing connecté (OD)
  tubingLength?: number; // Longueur calculée du tubing connecté (tubingSabotDepth - spoolProd)
  observations?: string;
  holeDiameter?: string | number; // Hole Ø (Diamètre trou foré / Open hole Ø, e.g. "8'' 1/2" ou 8.5)
  drilledToDepth?: number; // Foré jusqu'à (Profondeur forée / Open hole bottom depth in m, e.g. 275.00)
}

export interface WellData {
  id: string;
  name: string; // e.g., "GARA 2"
  purpose: string; // e.g., "Puits Producteur Huile (PPH)"
  completionType: string; // e.g., "COMPLETION SIMPLE"
  reservoir: string; // e.g., "F6"
  field?: string; // e.g., "Gara"
  elevationSol: number; // Z Sol: 523.52
  elevationForage: number; // Z Forage: 527.08
  elevationProduction: number; // Z Production: 522.82
  spoolProd?: string; // Spool Prod
  packerType?: string; // PKR de tête
  suspTbg?: string; // SUSP. TBG
  etanTbg?: string; // ETAN. S/ TBG.
  origineCotes?: string; // Origine cotes
  xmasTreeBrand?: string; // Marque Crown, pressure, valves details
  xmasTreeType?: string; // e.g. "CTCM"
  xmasTreeRactSup?: string; // e.g. "CB 15A"
  xmasTreePressure?: string;
  xmasTreeAttacheTbg?: string; // e.g. "OLIVE"
  xmasTreeEmbase?: string; // e.g. "11\" 2000"
  xmasTreeReduction?: string; // e.g. "7\"1/16 X 2\"9/16. 2000"
  xmasTreeOlive?: string; // e.g. "CTC 1 A EST taraudée 2\"7/8EU"
  
  vannesSasMarque?: string;
  vannesSasNombre?: string;
  vannesSasSerie?: string;
  vannesMaitresseMarque?: string;
  vannesMaitresseNombre?: string;
  vannesMaitresseSerie?: string;
  vannesLatTbgMarque?: string;
  vannesLatTbgNombre?: string;
  vannesLatTbgSerie?: string;
  vannesLatCsgMarque?: string;
  vannesLatCsgNombre?: string;
  vannesLatCsgSerie?: string;

  casings: CasingString[];
  tubings: TubingComponent[];
  srpComponents?: TubingComponent[];
  perforations: PerforationZone[];
  linerCrepines?: LinerCrepineZone[];
  linerCrepineParams?: LinerCrepineParams;
  cementPlugs?: CementPlug[];
  bridgePlugs?: BridgePlug[];
  isAbandonProvisoire?: boolean;
  isCasingsCleared?: boolean;
  observations?: string;
  folio?: string;
  folioToCancel?: string;
  prodTbgParams?: {
    od?: string;
    grade?: string;
    weight?: string;
  };
  updatedDate?: string;
  endOperationDate?: string;
  vuBy?: string;
  editedBy?: string;
  createdAt: string;
  updatedAt: string;
}
