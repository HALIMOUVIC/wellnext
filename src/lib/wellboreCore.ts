import { WellData, CasingString, TubingComponent, PerforationZone, LinerCrepineZone, LinerCrepineParams, parseSizeToNumber, TubingComponentType } from '../types';

/**
 * Re-export parseSizeToNumber from types so that consumer files can centralize imports
 */
export { parseSizeToNumber };

/**
 * Format depths/meters nicely and remove trailing .00 if it's an integer
 */
export function formatDepth(val: number | string | undefined | null): string {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return num.toFixed(2).replace(/\.00$/, '');
}

/**
 * Format casing sizes from decimal to fractional format (e.g., 18.625 -> 18"5/8)
 */
export function formatCasingSize(size: string | number): string {
  const num = typeof size === 'string' ? parseFloat(size) : size;
  if (isNaN(num)) return String(size);
  
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 1000) / 1000;
  
  if (decimalPart === 0) return `${integerPart}"`;
  
  const fractions: { [key: number]: string } = {
    0.125: '1/8',
    0.25: '1/4',
    0.375: '3/8',
    0.5: '1/2',
    0.625: '5/8',
    0.75: '3/4',
    0.875: '7/8'
  };
  
  const fraction = fractions[decimalPart];
  if (fraction) return `${integerPart}"${fraction}`;
  
  return `${num}"`;
}

/**
 * Calculate the maximum depth represented in the wellbore data
 */
export function calculateMaxDepth(well: WellData): number {
  const casings = well.casings || [];
  const tubings = well.tubings || [];
  const srpComponents = well.srpComponents || [];
  const perforations = well.perforations || [];
  const linerCrepines = well.linerCrepines || [];
  const lcp = well.linerCrepineParams;

  const depths = [
    ...casings.map((c) => c.drilledDepth),
    ...casings.map((c) => c.shoeDepth),
    ...tubings.map((t) => t.bottomDepth),
    ...srpComponents.map((t) => t.bottomDepth),
    ...perforations.map((p) => p.bottomDepth),
    ...linerCrepines.map((lc) => lc.bottomDepth),
    ...linerCrepines.map((lc) => lc.topDepth),
    lcp?.topOfLiner,
    lcp?.shoeDepth,
    lcp?.tubingSabotDepth,
    lcp?.drilledToDepth,
    well.elevationForage,
  ].filter(d => typeof d === "number" && !isNaN(d));
  
  return depths.length > 0 
    ? Math.max(...depths.map(d => typeof d === "string" ? parseFloat(d) : d).filter(d => !isNaN(d)), 100) 
    : 100;
}

/**
 * Define Key Anchor Points for Non-Linear Compacted Scale
 */
export function calculateKeyAnchors(
  well: WellData, 
  maxDepth: number, 
  yStart: number, 
  yEnd: number
): Array<{ depth: number, y: number }> {
  const depthsSet = new Set<number>([0]);
  (well.casings || []).forEach((c) => {
    if (typeof c.shoeDepth === "number" && !isNaN(c.shoeDepth)) depthsSet.add(c.shoeDepth);
    if (typeof c.drilledDepth === "number" && !isNaN(c.drilledDepth)) depthsSet.add(c.drilledDepth);
    if (c.topOfCement !== null && c.topOfCement !== undefined) {
      const toc = Number(c.topOfCement);
      if (!isNaN(toc)) depthsSet.add(toc);
    }
    if (c.topOfLiner !== null && c.topOfLiner !== undefined) {
      const tol = Number(c.topOfLiner);
      if (!isNaN(tol)) depthsSet.add(tol);
    }
    if (c.topOfFonde !== null && c.topOfFonde !== undefined) {
      const tf = Number(c.topOfFonde);
      if (!isNaN(tf)) depthsSet.add(tf);
    }
  });
  (well.tubings || []).forEach((t) => {
    if (typeof t.bottomDepth === "number" && !isNaN(t.bottomDepth)) depthsSet.add(t.bottomDepth);
    if (t.type === "Packer" && typeof t.bottomDepth === "number" && !isNaN(t.bottomDepth)) {
      depthsSet.add(Math.max(0, t.bottomDepth - 10));
    }
  });
  (well.perforations || []).forEach((p) => {
    if (typeof p.topDepth === "number" && !isNaN(p.topDepth)) depthsSet.add(p.topDepth);
    if (typeof p.bottomDepth === "number" && !isNaN(p.bottomDepth)) depthsSet.add(p.bottomDepth);
  });
  (well.linerCrepines || []).forEach((lc) => {
    if (typeof lc.topDepth === "number" && !isNaN(lc.topDepth)) depthsSet.add(lc.topDepth);
    if (typeof lc.bottomDepth === "number" && !isNaN(lc.bottomDepth)) depthsSet.add(lc.bottomDepth);
  });
  if (well.linerCrepineParams) {
    const lcp = well.linerCrepineParams;
    if (typeof lcp.topOfLiner === "number" && !isNaN(lcp.topOfLiner)) depthsSet.add(lcp.topOfLiner);
    if (typeof lcp.shoeDepth === "number" && !isNaN(lcp.shoeDepth)) depthsSet.add(lcp.shoeDepth);
    if (typeof lcp.tubingSabotDepth === "number" && !isNaN(lcp.tubingSabotDepth)) depthsSet.add(lcp.tubingSabotDepth);
    if (typeof lcp.drilledToDepth === "number" && !isNaN(lcp.drilledToDepth)) depthsSet.add(lcp.drilledToDepth);
  }
  (well.cementPlugs || []).forEach((cp) => {
    if (typeof cp.topDepth === "number" && !isNaN(cp.topDepth)) depthsSet.add(cp.topDepth);
    if (typeof cp.bottomDepth === "number" && !isNaN(cp.bottomDepth)) depthsSet.add(cp.bottomDepth);
  });

  const sortedDepths = Array.from(depthsSet)
    .map(d => Number(d))
    .filter((d) => !isNaN(d) && d >= 0)
    .sort((a, b) => a - b);

  if (sortedDepths.length <= 1) {
    return [
      { depth: 0, y: yStart },
      { depth: Math.max(maxDepth, 100), y: yEnd }
    ];
  }

  const usableHeight = yEnd - yStart;
  const N = sortedDepths.length;
  const maxD = sortedDepths[N - 1] || 100;

  let cumulativeWeight = 0;
  const weights: number[] = [0];
  for (let i = 1; i < N; i++) {
    const span = sortedDepths[i] - sortedDepths[i - 1];
    // Sub-linear weighting to compress large empty intervals while keeping small intervals compact & proportional
    const w = Math.pow(Math.max(0, span), 0.55);
    cumulativeWeight += w;
    weights.push(cumulativeWeight);
  }

  const totalWeight = cumulativeWeight || 1;

  return sortedDepths.map((depth, i) => {
    const yLinear = yStart + (depth / maxD) * usableHeight;
    const spanRatio = weights[i] / totalWeight;
    const yCompact = yStart + spanRatio * usableHeight;
    const y = 0.75 * yCompact + 0.25 * yLinear;
    return { depth, y };
  });
}

/**
 * Map raw depth value to raw Y coordinate
 */
export function mapDepthToYRaw(
  depth: number | string,
  scaleMode: "compact" | "linear",
  maxDepth: number,
  keyAnchors: Array<{ depth: number; y: number }>,
  yStart: number,
  yEnd: number
): number {
  const numDepth = typeof depth === "string" ? parseFloat(depth) : depth;
  if (isNaN(numDepth)) return yStart;
  const workingDepth = numDepth;

  if (scaleMode === "linear") {
    const usableHeight = yEnd - yStart;
    return yStart + (workingDepth / maxDepth) * usableHeight;
  } else {
    const anchors = keyAnchors;
    if (workingDepth <= anchors[0].depth) return anchors[0].y;
    if (workingDepth >= anchors[anchors.length - 1].depth)
      return anchors[anchors.length - 1].y;

    for (let i = 0; i < anchors.length - 1; i++) {
      const start = anchors[i];
      const end = anchors[i + 1];
      if (workingDepth >= start.depth && workingDepth <= end.depth) {
        const ratio = (workingDepth - start.depth) / (end.depth - start.depth);
        return start.y + ratio * (end.y - start.y);
      }
    }
    return yStart;
  }
}

/**
 * Get effective type identifier based on type string and name string
 */
export function getEffectiveType(type: string | undefined, name: string | undefined): string {
  const rawType = (type || "").trim();
  if (rawType) {
    if (TUBING_COMPONENT_MATRIX[rawType]) return rawType;
    const matrixKey = Object.keys(TUBING_COMPONENT_MATRIX).find(
      (k) => k.toLowerCase() === rawType.toLowerCase()
    );
    if (matrixKey) return matrixKey;
  }

  const t = (type || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (t.includes("drill") || n.includes("drill")) {
    return "Drill";
  }
  if (t.includes("mandrel") || t.includes("mandrin") || n.includes("mandrel") || n.includes("mandrin") || n.includes("gas lift")) {
    return "Side-pocket Mandrel";
  } else if (t.includes("bridge") || n.includes("bridge") || n.includes("b.p") || n.includes("bp")) {
    return "Bridge Plug";
  } else if (t.includes("packer") || t.includes("pkr") || n.includes("packer") || n.includes("pkr")) {
    return "Packer";
  } else if (t.includes("nipple") || t.includes("siège") || t.includes("siége") || t.includes("siege") || n.includes("nipple") || n.includes("siège") || n.includes("siége") || n.includes("siege") || n.includes("fnp") || n.includes("no-go")) {
    return "Seating Nipple";
  } else if (t.includes("shoe") || t.includes("sabot") || n.includes("shoe") || n.includes("sabot")) {
    return "Shoe";
  } else if (t.includes("pompe") || t.includes("pump") || n.includes("pompe") || n.includes("pump")) {
    return "Pompe";
  } else if (t.includes("moteur") || t.includes("motor") || n.includes("moteur") || n.includes("motor")) {
    return "Moteur";
  } else if (t.includes("crépine") || t.includes("crepine") || n.includes("crépine") || n.includes("crepine") || t.includes("screen") || n.includes("screen")) {
    return "Crépine";
  } else if (t.includes("reduction") || t.includes("swage") || t.includes("crossover") || t.includes("cross-over") || t.includes("réduction") || n.includes("reduction") || n.includes("swage") || n.includes("crossover") || n.includes("cross-over") || n.includes("réduction")) {
    return "Reduction";
  } else if (t.includes("tailpipe") || t.includes("queue") || n.includes("tailpipe") || n.includes("queue")) {
    return "Tailpipe";
  } else if (t.includes("anchor") || t.includes("ancrage") || t.includes("seal") || n.includes("anchor") || n.includes("ancrage") || n.includes("seal")) {
    return "Anchor-seal";
  } else if (t.includes("pup") || t.includes("court") || n.includes("pup") || n.includes("court") || n.includes("joint court") || n.includes("tubing court")) {
    return "Tubing Court";
  } else if (t.includes("sliding") || n.includes("sliding")) {
    return rawType || "sliding-sleeve";
  }
  return type || "Tubing";
}

/**
 * Filter and resolve missing depths for Tubing components
 */
export function getFilteredTubings(tubings: TubingComponent[]): TubingComponent[] {
  let seenJointCourt = false;
  const seenKeys = new Set<string>();
  const tubingsList = Array.isArray(tubings) ? tubings : [];

  const tubingsWithDepths = [...tubingsList].map((tool, index) => {
    if (tool.bottomDepth !== undefined && tool.bottomDepth !== null && tool.bottomDepth > 0) {
      return tool;
    }
    
    if (index > 0) {
      const prev = tubingsList[index - 1];
      if (tool.name?.toLowerCase().includes("anchor") && prev.name?.toLowerCase().includes("packer")) {
           return { ...tool, bottomDepth: (prev.bottomDepth || 0) - 0.22 };
      }
      return { ...tool, bottomDepth: (prev.bottomDepth || 0) - (prev.length || 0) };
    }
    return tool;
  });

  return tubingsWithDepths.filter((tool) => {
    if (!tool.isCoteProductAdded) return false;
    if (!tool.name) return false;

    const effectiveType = getEffectiveType(tool.type, tool.name);

    if (effectiveType === "Tubing Court") {
      if (seenJointCourt) return false;
      seenJointCourt = true;
    }

    if (effectiveType !== "Side-pocket Mandrel") {
      const depthKey = `${effectiveType}_${Math.round((tool.bottomDepth || 0) * 10) / 10}`;
      if (seenKeys.has(depthKey)) {
        return false;
      }
      seenKeys.add(depthKey);
    }

    return true;
  });
}

export interface VisualTool extends TubingComponent {
  visualYTop: number;
  visualYBottom: number;
  visualHeight: number;
  effectiveType: string;
}

function isTubingLikeType(effectiveType: string): boolean {
  return effectiveType === 'Tubing' || effectiveType === 'Tubing Court';
}

/**
 * Force completion tools within the same depth cluster (< 150 m) to share
 * one contiguous visual stack (no coordinate gaps between nipple / packer / shoe).
 */
export function compactCompletionClusters(tools: VisualTool[]): void {
  const completion = tools
    .filter((t) => !isTubingLikeType(t.effectiveType))
    .sort((a, b) => (a.bottomDepth || 0) - (b.bottomDepth || 0));

  if (completion.length <= 1) return;

  let groupStart = 0;
  for (let i = 1; i <= completion.length; i++) {
    const breakCluster =
      i === completion.length ||
      (completion[i].bottomDepth || 0) - (completion[groupStart].bottomDepth || 0) >= 150;

    if (breakCluster) {
      const group = completion.slice(groupStart, i);
      if (group.length > 1) {
        let y = Math.min(...group.map((t) => t.visualYTop));
        for (const t of group) {
          const h = t.visualHeight;
          t.visualYTop = y;
          t.visualYBottom = y + h;
          t.visualHeight = h;
          y += h;
        }
      }
      groupStart = i;
    }
  }
}

/**
 * Calculate visual top, bottom, and height for each tubing string tool
 */
export function calculateComputedTools(
  filteredTubings: TubingComponent[],
  mapDepthToYRawFn: (depth: number) => number,
  limit: number = 950
): VisualTool[] {
  const sortedTools = [...filteredTubings].sort((a, b) => {
    const da = a.bottomDepth || 0;
    const db = b.bottomDepth || 0;
    return da - db;
  });

  const result: VisualTool[] = [];

  sortedTools.forEach((tool, idx) => {
    const effectiveType = getEffectiveType(tool.type, tool.name);
    const rawYBottom = mapDepthToYRawFn(tool.bottomDepth || 0);
    const rawYTop = mapDepthToYRawFn((tool.bottomDepth || 0) - (tool.length || 0));
    let normalHeight = Math.max(15, rawYBottom - rawYTop);

    if (effectiveType.toLowerCase().includes('packer') || effectiveType.toLowerCase().includes('bridge') || effectiveType === 'Pompe' || effectiveType === 'Moteur') {
      normalHeight = 45;
    } else if (effectiveType === 'Side-pocket Mandrel') {
      normalHeight = 45;
    } else if (effectiveType === 'Crépine') {
      normalHeight = 35;
    } else if (effectiveType === 'Seating Nipple') {
      normalHeight = 25;
    } else if (effectiveType === 'Shoe') {
      normalHeight = 25;
    } else if (effectiveType === 'Reduction') {
      normalHeight = 20;
    } else if (effectiveType === 'Anchor-seal') {
      normalHeight = 25;
    } else if (effectiveType === 'Tubing Court') {
      normalHeight = 35;
    } else if (effectiveType === 'Drill') {
      normalHeight = 25;
    }

    let visualYTop = rawYTop;
    let visualYBottom = rawYTop + normalHeight;

    if (idx > 0) {
      const prev = result[idx - 1];
      const gap = (tool.bottomDepth || 0) - (prev.bottomDepth || 0);

      if (gap < 150) {
        visualYTop = prev.visualYBottom;
        visualYBottom = visualYTop + normalHeight;
      } else if (!isTubingLikeType(effectiveType)) {
        const prevCompletion = [...result].reverse().find((t) => !isTubingLikeType(t.effectiveType));
        if (prevCompletion) {
          const clusterGap = (tool.bottomDepth || 0) - (prevCompletion.bottomDepth || 0);
          if (clusterGap < 150) {
            visualYTop = prevCompletion.visualYBottom;
            visualYBottom = visualYTop + normalHeight;
          }
        }
      }
    }

    result.push({
      ...tool,
      visualYTop,
      visualYBottom,
      visualHeight: visualYBottom - visualYTop,
      effectiveType
    });
  });

  compactCompletionClusters(result);

  const deepestYBottom = result.length > 0 ? result[result.length - 1].visualYBottom : 0;
  if (deepestYBottom > limit) {
    const overhang = deepestYBottom - limit;
    result.forEach(r => {
      r.visualYTop -= overhang;
      r.visualYBottom -= overhang;
    });
  }

  return result;
}

/**
 * Complete adjusted mapping helper that places any deep item correctly below the visual stacked tubing string
 */
export function mapDepthToY(
  depth: number | string,
  scaleMode: 'compact' | 'linear',
  maxDepth: number,
  keyAnchors: Array<{ depth: number, y: number }>,
  yStart: number,
  yEnd: number,
  tbgBottomDepth: number,
  tbgVisualYBottom: number,
  svgHeight: number
): number {
  const rawY = mapDepthToYRaw(depth, scaleMode, maxDepth, keyAnchors, yStart, yEnd);
  const numDepth = typeof depth === "string" ? parseFloat(depth) : depth;
  if (isNaN(numDepth)) return rawY;

  if (tbgBottomDepth > 0 && numDepth > tbgBottomDepth) {
    const rawTbgBottomY = mapDepthToYRaw(tbgBottomDepth, scaleMode, maxDepth, keyAnchors, yStart, yEnd);
    const bottomY = svgHeight - 50;
    
    if (rawY > rawTbgBottomY && bottomY > rawTbgBottomY) {
      const ratio = (rawY - rawTbgBottomY) / (bottomY - rawTbgBottomY);
      const availableHeight = Math.max(50, bottomY - tbgVisualYBottom);
      return tbgVisualYBottom + ratio * availableHeight;
    } else {
      return tbgVisualYBottom + 5;
    }
  }
  return rawY;
}

/**
 * French designation mapping for printing layouts
 */
export function getFrenchDesignation(type: string, name: string): string {
  const effectiveType = getEffectiveType(type, name);
  const config = TUBING_COMPONENT_MATRIX[effectiveType];
  if (config) {
    return config.frenchDesignation;
  }
  
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  if (t === 'shoe' || n.includes('sabot')) return 'Sabot';
  if (t === 'seating nipple' || n.includes('siege') || n.includes('siége') || n.includes('nipple')) return 'Siège';
  if (t === 'packer' || n.includes('packer') || n.includes('pkr')) return 'Packer';
  if (t === 'side-pocket mandrel' || n.includes('mandrin') || n.includes('mandrel')) return 'Mandrin';
  if (t === 'anchor-seal' || n.includes('anchor') || n.includes('seal')) return 'Anchor-seal';
  if (t === 'reduction' || n.includes('reduc') || n.includes('réduction') || n.includes('reducer')) return 'Réduction';
  if (n.includes('olive') || (t === 'other' && n.includes('olive'))) return 'Olive';
  if (t === 'tubing') return 'Tubing';
  if (t === 'sliding sleeve') return 'Sliding Sleeve';
  return name || 'Tubing';
}

/**
 * French short component Type
 */
export function getFrenchType(type: string, name: string): string {
  const effectiveType = getEffectiveType(type, name);
  const config = TUBING_COMPONENT_MATRIX[effectiveType];
  if (config) {
    return config.frenchType;
  }
  
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  if (t === 'shoe' || n.includes('sabot')) return 'EU';
  if (t === 'seating nipple' || n.includes('siege') || n.includes('siége')) return 'D';
  if (t === 'packer' || n.includes('packer')) return 'D';
  if (t === 'side-pocket mandrel' || n.includes('mandrin') || n.includes('mandrel')) return 'SMO-1';
  if (t === 'anchor-seal' || n.includes('anchor') || n.includes('seal')) return 'E22';
  if (n.includes('olive')) return 'CTC';
  return 'EU';
}

/**
 * Auto-recalculate bottom depths sequentially after a move or swap
 */
export function recalculateBottomDepths(tubings: TubingComponent[]): TubingComponent[] {
  let currentDepth = 0;
  const list = Array.isArray(tubings) ? tubings : [];
  return list.map(t => {
    currentDepth += (t.length || 0);
    return {
      ...t,
      bottomDepth: parseFloat(currentDepth.toFixed(2))
    };
  });
}

/**
 * Sequential calculation of Côte Product (Cote Product) values
 */
export function calculateCoteProducts(tubings: TubingComponent[], spoolProdStr: string | undefined): Array<TubingComponent & { calculatedCote: number }> {
  const spoolProd = parseFloat(spoolProdStr || '0');
  const list = Array.isArray(tubings) ? tubings : [];
  const totalLength = list.reduce((sum, t) => sum + (t.length || 0), 0);
  let currentCote = totalLength - spoolProd;

  return list.map((tool) => {
    const cote = currentCote;
    currentCote -= tool.length;
    return { ...tool, calculatedCote: cote };
  });
}

/**
 * Calculate height and shot values for a perforation zone
 */
export function calculatePerforationFields(
  topInput: number,
  bottomInput: number,
  manualHeight?: number,
  density?: number,
  manualShots?: number
): { topDepth: number; bottomDepth: number; height: number; shots?: number } {
  const topDepth = Math.min(topInput, bottomInput);
  const bottomDepth = Math.max(topInput, bottomInput);
  const height = manualHeight !== undefined && manualHeight !== null && manualHeight > 0
    ? parseFloat(manualHeight.toFixed(2))
    : parseFloat((bottomDepth - topDepth).toFixed(2));

  const shots = manualShots !== undefined 
    ? manualShots 
    : (density !== undefined ? parseFloat((height * density).toFixed(2)) : undefined);

  return { topDepth, bottomDepth, height, shots };
}

/**
 * Core business logic to save or update a perforation zone.
 * Returns the updated WellData object.
 */
export function savePerforation(
  well: WellData,
  newPerf: Partial<PerforationZone>,
  editingPerfId: string | null
): WellData {
  const inputTop = newPerf.topDepth ?? 0;
  const inputBottom = newPerf.bottomDepth ?? 0;
  
  const { topDepth, bottomDepth, height, shots } = calculatePerforationFields(
    inputTop,
    inputBottom,
    newPerf.height,
    newPerf.density,
    newPerf.shots
  );

  const density = newPerf.density !== undefined ? newPerf.density : undefined;

  let updatedPerforations: PerforationZone[];

  if (editingPerfId) {
    updatedPerforations = (well.perforations || []).map(p => {
      if (p.id === editingPerfId) {
        return {
          ...p,
          topDepth: topDepth,
          bottomDepth: bottomDepth,
          height: height,
          perfoType: newPerf.perfoType || '',
          diameter: newPerf.diameter || '',
          density: density,
          calage: newPerf.calage || '',
          shots: shots,
          observations: newPerf.observations || '',
          reservoir: newPerf.reservoir || '',
          isSqueezed: newPerf.isSqueezed !== undefined ? newPerf.isSqueezed : p.isSqueezed
        };
      }
      return p;
    });
  } else {
    const entry: PerforationZone = {
      id: `perf-${Date.now()}`,
      topDepth: topDepth,
      bottomDepth: bottomDepth,
      height: height,
      perfoType: newPerf.perfoType || '',
      diameter: newPerf.diameter || '',
      density: density,
      calage: newPerf.calage || '',
      shots: shots,
      observations: newPerf.observations || '',
      reservoir: newPerf.reservoir || '',
      isSqueezed: !!newPerf.isSqueezed
    };
    updatedPerforations = [...(well.perforations || []), entry];
  }

  return {
    ...well,
    perforations: updatedPerforations,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Core business logic to squeeze or unsqueeze selected perforation zones.
 */
export function squeezePerforations(
  well: WellData,
  perfIds: string[],
  squeeze: boolean = true
): WellData {
  const idsSet = new Set(perfIds);
  const updatedPerforations = (well.perforations || []).map(p => {
    if (idsSet.has(p.id)) {
      return { ...p, isSqueezed: squeeze };
    }
    return p;
  });
  return {
    ...well,
    perforations: updatedPerforations,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Core business logic to remove a perforation zone.
 * Returns the updated WellData object.
 */
export function removePerforationFromWell(well: WellData, id: string): WellData {
  return {
    ...well,
    perforations: (well.perforations || []).filter(p => p.id !== id),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Calculate fields for a liner crepine zone
 */
export function calculateLinerCrepineFields(
  topInput: number,
  bottomInput: number,
  manualHeight?: number
): { topDepth: number; bottomDepth: number; height: number } {
  const topDepth = Math.min(topInput, bottomInput);
  const bottomDepth = Math.max(topInput, bottomInput);
  const height = manualHeight !== undefined && manualHeight !== null && manualHeight > 0
    ? parseFloat(manualHeight.toFixed(2))
    : parseFloat(Math.abs(bottomDepth - topDepth).toFixed(2));

  return { topDepth, bottomDepth, height };
}

/**
 * Core business logic to save or update a liner crepine zone.
 * Returns the updated WellData object.
 */
export function saveLinerCrepine(
  well: WellData,
  newLC: Partial<LinerCrepineZone>,
  editingLCId: string | null
): WellData {
  const inputTop = newLC.topDepth ?? 0;
  const inputBottom = newLC.bottomDepth ?? 0;
  
  const { topDepth, bottomDepth, height } = calculateLinerCrepineFields(
    inputTop,
    inputBottom,
    newLC.height
  );

  let updatedLinerCrepines: LinerCrepineZone[];

  if (editingLCId) {
    updatedLinerCrepines = (well.linerCrepines || []).map(lc => {
      if (lc.id === editingLCId) {
        return {
          ...lc,
          topDepth,
          bottomDepth,
          height,
          typeCrepine: newLC.typeCrepine || '',
          diameter: newLC.diameter || '',
          slot: newLC.slot || '',
          idMi: newLC.idMi || '',
          nbreCoups: newLC.nbreCoups !== undefined ? newLC.nbreCoups : undefined,
          observations: newLC.observations || ''
        };
      }
      return lc;
    });
  } else {
    const entry: LinerCrepineZone = {
      id: `lc-${Date.now()}`,
      topDepth,
      bottomDepth,
      height,
      typeCrepine: newLC.typeCrepine || '',
      diameter: newLC.diameter || '',
      slot: newLC.slot || '',
      idMi: newLC.idMi || '',
      nbreCoups: newLC.nbreCoups !== undefined ? newLC.nbreCoups : undefined,
      observations: newLC.observations || ''
    };
    updatedLinerCrepines = [...(well.linerCrepines || []), entry];
  }

  return {
    ...well,
    linerCrepines: updatedLinerCrepines,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Core business logic to remove a liner crepine zone.
 * Returns the updated WellData object.
 */
export function removeLinerCrepineFromWell(well: WellData, id: string): WellData {
  return {
    ...well,
    linerCrepines: (well.linerCrepines || []).filter(lc => lc.id !== id),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Calculate Liner Crépine overall string length and connected tubing length.
 * Follows the PPH/PPG calculation method:
 * - Liner Length = Sabot (Shoe Depth) - TOL (Top of Liner)
 * - Tubing Length = Sabot Tubing - Spool Prod (or raw Sabot Tubing if no spool)
 */
export function calculateLinerCrepineHeaderParams(
  topOfLiner?: number,
  shoeDepth?: number,
  tubingSabotDepth?: number,
  spoolProdStr?: string
): { linerLength?: number; tubingLength?: number } {
  let linerLength: number | undefined;
  if (
    topOfLiner !== undefined &&
    topOfLiner !== null &&
    !isNaN(topOfLiner) &&
    shoeDepth !== undefined &&
    shoeDepth !== null &&
    !isNaN(shoeDepth)
  ) {
    linerLength = parseFloat(Math.abs(shoeDepth - topOfLiner).toFixed(2));
  }

  let tubingLength: number | undefined;
  if (
    tubingSabotDepth !== undefined &&
    tubingSabotDepth !== null &&
    !isNaN(tubingSabotDepth)
  ) {
    const spool = parseFloat(spoolProdStr || '0') || 0;
    tubingLength = parseFloat(Math.max(0, tubingSabotDepth - spool).toFixed(2));
  }

  return { linerLength, tubingLength };
}

/**
 * Core business logic to save or update Liner Crépine general parameters.
 * Returns the updated WellData object.
 */
export function saveLinerCrepineParams(
  well: WellData,
  params: Partial<LinerCrepineParams>
): WellData {
  const { linerLength, tubingLength } = calculateLinerCrepineHeaderParams(
    params.topOfLiner,
    params.shoeDepth,
    params.tubingSabotDepth,
    well.spoolProd
  );

  const updatedParams: LinerCrepineParams = {
    topOfLiner: params.topOfLiner,
    shoeDepth: params.shoeDepth,
    diameter: params.diameter || '',
    length: linerLength !== undefined ? linerLength : params.length,
    tubingSabotDepth: params.tubingSabotDepth,
    tubingDiameter: params.tubingDiameter || '',
    tubingLength: tubingLength !== undefined ? tubingLength : params.tubingLength,
    observations: params.observations || '',
    holeDiameter: params.holeDiameter !== undefined ? params.holeDiameter : '',
    drilledToDepth: params.drilledToDepth
  };

  return {
    ...well,
    linerCrepineParams: updatedParams,
    updatedAt: new Date().toISOString()
  };
}

export interface TubingPreset {
  defaultName: string;
  defaultOd: string;
  defaultCustomType: string;
  defaultMinId: string;
}

export interface TubingComponentConfig {
  type: string;
  defaultName: string;
  defaultOd: string;
  defaultCustomType: string;
  defaultMinId: string;
  frenchDesignation: string;
  frenchType: string;

  // Drawing configuration
  renderType: 'image' | 'vector';

  // Image parameters
  imageUrl?: string;
  viewBox?: string;
  mainScale?: number;
  printScale?: number;
  minHeight?: number;

  // Vector / custom path drawing parameters
  vectorType?: 'reduction' | 'tailpipe' | 'anchor-seal' | 'tubing-court' | 'sliding-sleeve' | 'hanger' | 'default';
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

/** Last-resort entries when the database catalogue is empty or offline. */
export const MINIMAL_FALLBACK_MATRIX: Record<string, TubingComponentConfig> = {
  Tubing: {
    type: 'Tubing',
    defaultName: "Tubing 2''7/8",
    defaultOd: "2''7/8",
    defaultCustomType: 'EU',
    defaultMinId: '',
    frenchDesignation: 'Tubing',
    frenchType: 'EU',
    renderType: 'vector',
    vectorType: 'default',
    fillColor: '#cbd5e1',
    strokeColor: '#0f172a',
    strokeWidth: 1.5,
    minHeight: 15,
  },
  Other: {
    type: 'Other',
    defaultName: 'Other',
    defaultOd: "2''7/8",
    defaultCustomType: 'EU',
    defaultMinId: '',
    frenchDesignation: 'Other',
    frenchType: 'EU',
    renderType: 'vector',
    vectorType: 'default',
    fillColor: '#cbd5e1',
    strokeColor: '#0f172a',
    strokeWidth: 1.5,
    minHeight: 15,
  },
};

/** @deprecated use MINIMAL_FALLBACK_MATRIX */
export const BUILTIN_TUBING_COMPONENT_MATRIX = MINIMAL_FALLBACK_MATRIX;

export let TUBING_COMPONENT_MATRIX: Record<string, TubingComponentConfig> = {
  ...MINIMAL_FALLBACK_MATRIX,
};

/** Build `/img/{slug}.svg` — slug from type name (with legacy filename aliases). */
export function imageSlugForType(typeName: string, designation?: string): string {
  const t = typeName.toLowerCase();
  const d = (designation || '').toLowerCase();
  if (t.includes('nipple') || t.includes('seating') || t.includes('siège') || t.includes('siége') || t.includes('siege') || d.includes('siège') || d.includes('siége') || d.includes('siege')) return 'siege';
  if (t.includes('shoe') || t.includes('sabot') || d.includes('sabot')) return 'sabot';
  if (t.includes('mandrel') || t.includes('mandrin') || d.includes('mandrin')) return 'mandrin';
  if (t.includes('packer') || d.includes('packer')) return 'packer';
  if (t.includes('bridge') || d.includes('bridge')) return 'bridge-plug';
  if (t.includes('drill') || d.includes('drill')) return 'drill';
  if (t.includes('sliding')) return 'sliding-sleeve';
  if (t.includes('fonde') || t.includes('tf') || t.includes('liner') || d.includes('fonde') || d.includes('tf') || d.includes('liner')) return 'liner';
  if (t.includes('pompe') || t.includes('pump') || d.includes('pompe') || d.includes('pump')) return 'pompe';
  if (t.includes('moteur') || t.includes('motor') || d.includes('moteur') || d.includes('motor')) return 'moteur';
  if (t.includes('crépine') || t.includes('crepine') || d.includes('crépine') || d.includes('crepine') || t.includes('screen') || d.includes('screen')) return 'crépines';
  return typeName.trim().toLowerCase();
}

export function toolSvgUrl(typeOrDesignation: string): string {
  const slug = String(typeOrDesignation || '').trim().toLowerCase();
  if (!slug) return '';
  return `/img/${slug}.svg?v=2`;
}

function inferRenderType(typeName: string): 'image' | 'vector' {
  const t = typeName.toLowerCase();
  if (t === 'tubing' || t === 'other') return 'vector';
  if (t.includes('reduction') || t.includes('réduction')) return 'vector';
  if (t.includes('anchor-seal') || (t.includes('anchor') && t.includes('seal'))) return 'vector';
  if (t.includes('tailpipe') || t.includes('queue')) return 'vector';
  if (t.includes('tubing court') || t.includes('joint court')) return 'vector';
  return 'image';
}

function inferVectorType(typeName: string): TubingComponentConfig['vectorType'] {
  const t = typeName.toLowerCase();
  if (t.includes('reduction') || t.includes('réduction')) return 'reduction';
  if (t.includes('anchor') || t.includes('seal')) return 'anchor-seal';
  if (t.includes('sliding')) return 'sliding-sleeve';
  if (t.includes('tailpipe') || t.includes('queue')) return 'tailpipe';
  if (t.includes('court') || t.includes('pup')) return 'tubing-court';
  return 'default';
}

function inferViewBox(typeName: string): string {
  const t = typeName.toLowerCase();
  if (t.includes('bridge')) return '0 0 512 512';
  if (t.includes('packer')) return '0 0 300 750';
  if (t.includes('shoe') || t.includes('sabot')) return '0 40 300 390';
  return '0 0 300 220';
}

function inferMinHeight(typeName: string, renderType: 'image' | 'vector'): number {
  const t = typeName.toLowerCase();
  if (t.includes('packer') || t.includes('mandrel') || t.includes('bridge') || t.includes('pompe') || t.includes('moteur')) return 45;
  if (t.includes('sliding') || t.includes('crépine') || t.includes('crepine')) return 30;
  if (t.includes('nipple') || t.includes('shoe') || t.includes('drill') || t.includes('anchor')) return 25;
  if (t.includes('reduction')) return 20;
  return renderType === 'image' ? 20 : 15;
}

/** Build one schematic config from a `custom_tool_types` database row. */
export function configFromDbRow(row: {
  type: string;
  default_name?: string;
  default_od?: string;
  default_custom_type?: string;
  default_min_id?: string;
  french_designation?: string;
}): TubingComponentConfig {
  const typeName = String(row.type || '').trim();
  const designation = row.french_designation?.trim() || row.default_name?.trim() || typeName;
  const renderType = inferRenderType(typeName);
  const isImage = renderType === 'image';

  return {
    type: typeName,
    defaultName: row.default_name?.trim() || typeName,
    defaultOd: row.default_od?.trim() || "2''7/8",
    defaultCustomType: row.default_custom_type?.trim() || 'EU',
    defaultMinId: row.default_min_id?.trim() || '',
    frenchDesignation: designation,
    frenchType: row.default_custom_type?.trim() || 'EU',
    renderType,
    vectorType: inferVectorType(typeName),
    fillColor: typeName.toLowerCase().includes('reduction') ? '#64748b' : '#cbd5e1',
    strokeColor: '#0f172a',
    strokeWidth: 1.5,
    ...(isImage
      ? {
          imageUrl: toolSvgUrl(imageSlugForType(typeName, designation)),
          viewBox: inferViewBox(typeName),
          mainScale: 0.25,
          printScale: 0.25,
        }
      : {}),
    minHeight: inferMinHeight(typeName, renderType),
  };
}

/** Build the full matrix from database catalogue rows (+ minimal fallbacks). */
export function buildMatrixFromDb(
  rows: Array<{
    type: string;
    default_name?: string;
    default_od?: string;
    default_custom_type?: string;
    default_min_id?: string;
    french_designation?: string;
  }>
): Record<string, TubingComponentConfig> {
  const matrix: Record<string, TubingComponentConfig> = { ...MINIMAL_FALLBACK_MATRIX };
  for (const row of rows) {
    if (!row?.type?.trim()) continue;
    matrix[row.type] = configFromDbRow(row);
  }
  return matrix;
}

/** Height of the embedded raster/SVG source used inside schematic image tools. */
export function getImageSourceHeight(config: TubingComponentConfig): string {
  const viewBox = config.viewBox || "0 0 300 500";
  const parts = viewBox.split(/\s+/).map((v) => parseFloat(v));
  if (parts.length === 4 && !isNaN(parts[3]) && parts[3] > 0) {
    return String(parts[3]);
  }
  return "500";
}

/** Parse width/height from a schematic viewBox string. */
export function parseViewBoxSize(viewBox?: string): { width: number; height: number } {
  const parts = (viewBox || '0 0 300 220').split(/\s+/).map((v) => parseFloat(v));
  return {
    width: parts.length === 4 && !isNaN(parts[2]) ? parts[2] : 300,
    height: parts.length === 4 && !isNaN(parts[3]) ? parts[3] : 220,
  };
}

function refreshConfigFromRow(config: TubingComponentConfig): TubingComponentConfig {
  return configFromDbRow({
    type: config.type,
    default_name: config.defaultName,
    default_od: config.defaultOd,
    default_custom_type: config.defaultCustomType,
    default_min_id: config.defaultMinId,
    french_designation: config.frenchDesignation,
  });
}

/**
 * Resolve drawing config for a tool — falls back to `/img/{name}.svg` for DB-added tools.
 */
export function resolveTubingConfig(
  effectiveType: string,
  toolName?: string
): TubingComponentConfig {
  const direct = TUBING_COMPONENT_MATRIX[effectiveType];
  if (direct) return refreshConfigFromRow(direct);

  const typeKey = Object.keys(TUBING_COMPONENT_MATRIX).find(
    (k) => k.toLowerCase() === effectiveType.toLowerCase()
  );
  if (typeKey) return refreshConfigFromRow(TUBING_COMPONENT_MATRIX[typeKey]);

  const name = (toolName || effectiveType || "").trim();
  if (name) {
    const nameKey = Object.keys(TUBING_COMPONENT_MATRIX).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );
    if (nameKey) return refreshConfigFromRow(TUBING_COMPONENT_MATRIX[nameKey]);

    return configFromDbRow({ type: name, french_designation: name });
  }

  return TUBING_COMPONENT_MATRIX['Other'];
}

export function updateTubingComponentMatrix(toolsFromDb: any[]) {
  if (!toolsFromDb || !Array.isArray(toolsFromDb)) return;
  TUBING_COMPONENT_MATRIX = buildMatrixFromDb(toolsFromDb);
}

export function applyTubingComponentMatrix(matrix: Record<string, TubingComponentConfig>) {
  TUBING_COMPONENT_MATRIX = matrix;
}

/**
 * Returns the default settings/presets for a given tubing component type
 */
export function getTubingTypeDefaults(type: TubingComponentType): TubingPreset {
  const config = TUBING_COMPONENT_MATRIX[type];
  if (config) {
    return {
      defaultName: config.defaultName,
      defaultOd: config.defaultOd,
      defaultCustomType: config.defaultCustomType,
      defaultMinId: config.defaultMinId
    };
  }
  return {
    defaultName: type,
    defaultOd: "2''7/8",
    defaultCustomType: "EU",
    defaultMinId: ""
  };
}


