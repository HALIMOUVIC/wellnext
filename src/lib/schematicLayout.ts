/**
 * TypeScript fallback for schematic geometry (Phase 2).
 * Used when WASM is not loaded. Mirrors rust/wellbore-core/src/layout.rs.
 */

import type { WellData } from '../types';
import {
  formatDepth,
  formatCasingSize,
  parseSizeToNumber,
  calculateKeyAnchors,
  mapDepthToYRaw,
  mapDepthToY,
  getFilteredTubings,
  calculateComputedTools,
  getFrenchType,
} from './wellboreCore';

export interface CasingDrawData {
  casingIndex: number;
  casingId: string;
  casingR: number;
  boreholeR: number;
  yTop: number;
  yShoe: number;
  yDrilled: number;
  yToc: number;
  hasCement: boolean;
  tocVal: number | null;
  hasLiner: boolean;
  tolVal: number | null;
  yTol: number | null;
  hasTF: boolean;
  tfVal: number | null;
  yTF: number | null;
  blockY: number;
  prevCasingR: number;
  prevShoeY: number;
  prevDrilledY: number;
  prevBoreholeR: number;
}

export interface FormationLayout {
  yTop: number;
  yBotDotted: number;
  rectHeight: number;
  formationLabel: string;
}

export interface YRange {
  yStart: number;
  yEnd: number;
}

export interface PerforationDrawLayout {
  topDepth: number;
  bottomDepth: number;
  yTop: number;
  yBottom: number;
  shotRows: number[];
}

export interface ResolvedLeftLabel {
  text: string;
  targetY: number;
  targetX: number;
  resolvedY: number;
  labelType: string;
  depthStr: string;
}

export interface ResolvedRightLabel {
  id: string;
  targetY: number;
  resolvedY: number;
  height: number;
  startX: number;
}

export interface PrintTableRowMeta {
  toolId: string;
  qty: string;
  displayOd: string;
  displayType: string;
  showsCote: boolean;
}

export interface SchematicGeometryOutput {
  sortedCasingIndices: number[];
  casings: CasingDrawData[];
  formation: FormationLayout | null;
  tubingSegments: YRange[];
  perforation: PerforationDrawLayout | null;
  leftLabels: ResolvedLeftLabel[];
  rightLabels: ResolvedRightLabel[];
  printTableRows: PrintTableRowMeta[];
  tbgBottomDepth: number;
  tbgVisualYBottom: number;
}

interface LayoutParams {
  svgWidth: number;
  svgHeight: number;
  xCenter: number;
  yStart: number;
  yEnd: number;
  radiusFactor: number;
  minBlockSpacing: number;
  visualToolLimit: number;
}

function isValidDepth(val: number | null | undefined): boolean {
  return val !== null && val !== undefined && !Number.isNaN(val);
}

export function getCasingTopDepth(casing: any): number {
  if (!casing) return 0;
  const hasLiner = isValidDepth(casing.topOfLiner);
  const tolVal = hasLiner ? Number(casing.topOfLiner) : null;
  const isLiner = (casing.startFromTOL || (hasLiner && tolVal !== null && tolVal > 0)) && hasLiner && tolVal !== null;
  return isLiner ? tolVal! : (casing.topDepth || 0);
}

function resolveBlockLabels(targets: number[], minSpacing: number): number[] {
  const sorted = targets.map((y, i) => ({ i, y })).sort((a, b) => a.y - b.y);
  const actual = new Array(targets.length).fill(0);
  let currentY = -Infinity;
  for (const { i, y } of sorted) {
    const resolved = y < currentY + minSpacing ? currentY + minSpacing : y;
    actual[i] = resolved;
    currentY = resolved;
  }
  return actual;
}

function resolveSpacingLabels(
  targets: number[],
  spacingY: number,
  minY: number,
  maxY: number,
  iterations: number
): number[] {
  const resolved = [...targets];
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let j = 0; j < resolved.length - 1; j++) {
      if (resolved[j + 1] - resolved[j] < spacingY) {
        const overlap = spacingY - (resolved[j + 1] - resolved[j]);
        resolved[j] -= overlap / 2;
        resolved[j + 1] += overlap / 2;
        changed = true;
      }
    }
    for (let j = 0; j < resolved.length; j++) {
      if (resolved[j] < minY) { resolved[j] = minY; changed = true; }
      if (resolved[j] > maxY) { resolved[j] = maxY; changed = true; }
    }
    if (!changed) break;
  }
  return resolved;
}

/** Minimum vertical space (px) reserved per two-line tool label block. */
export const TOOL_LABEL_BLOCK_HEIGHT = 28;
/** Extra gap (px) between consecutive tool label blocks. */
export const TOOL_LABEL_BLOCK_PADDING = 8;

function resolveHeightLabels(
  items: Array<[number, number]>,
  padding: number,
  iterations: number
): number[] {
  const sorted = [...items].sort((a, b) => a[0] - b[0]);
  const adjusted = sorted.map(([target]) => target);
  const heights = sorted.map(([, h]) => h);

  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < adjusted.length - 1; i++) {
      const required = (heights[i] + heights[i + 1]) / 2 + padding;
      const actual = adjusted[i + 1] - adjusted[i];
      if (actual < required) {
        const overlap = required - actual;
        adjusted[i] -= overlap / 2;
        adjusted[i + 1] += overlap / 2;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return adjusted;
}

function computeRightToolLabels(
  computedTools: ReturnType<typeof calculateComputedTools>,
  xCenter: number,
  minY: number,
  maxY: number,
  iterations: number
): ResolvedRightLabel[] {
  const items = computedTools.map((tool) => {
    const yTop = tool.visualYTop;
    const yBottom = tool.visualYBottom;
    const height = tool.visualHeight;
    const yMid = (yTop + yBottom) / 2;
    const t = tool.effectiveType.toLowerCase();

    let anchorY = yMid;
    let startX = xCenter + 5;

    if (t.includes('packer')) {
      const drawHeight = Math.max(35, height);
      anchorY = yTop + (277 / 635) * drawHeight;
      startX = xCenter + 15;
    } else if (t.includes('mandrel') || t.includes('mandrin')) {
      anchorY = yMid;
      startX = xCenter + 15;
    } else if (t.includes('nipple') || t.includes('siège') || t.includes('siege') || t.includes('seating')) {
      anchorY = yMid;
      startX = xCenter + 10;
    } else if (t.includes('shoe') || t.includes('sabot')) {
      anchorY = yMid;
    }

    // Set initial targetY ABOVE tool anchor so leader lines slant UPWARDS to text labels
    const targetY = anchorY - 20;

    return {
      id: `tool-${tool.id}`,
      targetY,
      height: TOOL_LABEL_BLOCK_HEIGHT,
      startX,
    };
  });

  const sorted = [...items].sort((a, b) => a.targetY - b.targetY);
  
  // Backward pass: fan tool labels UPWARDS into open space
  const adjusted = sorted.map((item) => item.targetY);
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = adjusted.length - 1; i > 0; i--) {
      const required = TOOL_LABEL_BLOCK_HEIGHT + TOOL_LABEL_BLOCK_PADDING;
      const actual = adjusted[i] - adjusted[i - 1];
      if (actual < required) {
        const overlap = required - actual;
        adjusted[i - 1] -= overlap;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const spacingY = TOOL_LABEL_BLOCK_HEIGHT + TOOL_LABEL_BLOCK_PADDING;
  const resolvedYs = resolveSpacingLabels(adjusted, spacingY, minY, maxY, iterations);

  return sorted.map((item, i) => ({
    ...item,
    resolvedY: resolvedYs[i],
  }));
}

export function computeSchematicLayoutTs(
  well: WellData,
  scaleMode: 'compact' | 'linear',
  params: LayoutParams,
  schematic: {
    maxDepth: number;
    keyAnchors: ReturnType<typeof calculateKeyAnchors>;
    computedTools: ReturnType<typeof calculateComputedTools>;
  }
): SchematicGeometryOutput {
  const { maxDepth, keyAnchors, computedTools } = schematic;
  const deepest = computedTools.length > 0 ? computedTools[computedTools.length - 1] : null;
  const tbgBottomDepth = deepest?.bottomDepth || 0;
  const tbgVisualYBottom = deepest?.visualYBottom ?? params.yStart;

  const mapRaw = (depth: number) =>
    mapDepthToYRaw(depth, scaleMode, maxDepth, keyAnchors, params.yStart, params.yEnd);
  const mapY = (depth: number) =>
    mapDepthToY(depth, scaleMode, maxDepth, keyAnchors, params.yStart, params.yEnd, tbgBottomDepth, tbgVisualYBottom, params.svgHeight);

  const sortedIndices = [...well.casings.keys()].sort(
    (a, b) => parseSizeToNumber(well.casings[b].casingSize) - parseSizeToNumber(well.casings[a].casingSize)
  );

  const casings: CasingDrawData[] = sortedIndices.map((casingIndex) => {
    const casing = well.casings[casingIndex];
    const casingR = parseSizeToNumber(casing.casingSize) * params.radiusFactor;
    const boreholeR = parseSizeToNumber(casing.boreholeSize) * params.radiusFactor;
    const hasCement = isValidDepth(casing.topOfCement as number | null | undefined);
    const tocVal = hasCement ? Number(casing.topOfCement) : null;
    const hasLiner = isValidDepth(casing.topOfLiner as number | null | undefined);
    const tolVal = hasLiner ? Number(casing.topOfLiner) : null;
    const hasTF = isValidDepth(casing.topOfFonde as number | null | undefined);
    const tfVal = hasTF ? Number(casing.topOfFonde) : null;
    const effectiveTopDepth = getCasingTopDepth(casing);
    const yTop = mapY(effectiveTopDepth);
    const yShoe = mapY(casing.shoeDepth || 0);
    const yDrilled = mapY(casing.drilledDepth || 0);
    const yToc = hasCement ? mapY(tocVal || 0) : yTop;
    const yTol = hasLiner ? mapY(tolVal || 0) : null;
    const yTF = hasTF ? mapY(tfVal || 0) : null;
    return {
      casingIndex,
      casingId: casing.id,
      casingR,
      boreholeR,
      yTop,
      yShoe,
      yDrilled,
      yToc,
      hasCement,
      tocVal,
      hasLiner,
      tolVal,
      yTol,
      hasTF,
      tfVal,
      yTF,
      blockY: 0,
      prevCasingR: 0,
      prevShoeY: 0,
      prevDrilledY: 0,
      prevBoreholeR: 0,
    };
  });

  const blockYs = resolveBlockLabels(casings.map((c) => c.yShoe - 25), params.minBlockSpacing);
  casings.forEach((cd, i) => {
    cd.blockY = blockYs[i];
    if (i > 0) {
      cd.prevCasingR = casings[i - 1].casingR;
      cd.prevShoeY = casings[i - 1].yShoe;
      cd.prevDrilledY = casings[i - 1].yDrilled;
      cd.prevBoreholeR = casings[i - 1].boreholeR;
    } else {
      cd.prevCasingR = cd.boreholeR;
      cd.prevShoeY = cd.yTop;
      cd.prevDrilledY = cd.yTop;
      cd.prevBoreholeR = cd.boreholeR;
    }
  });

  let formation: FormationLayout | null = null;
  if (well.perforations.length > 0) {
    const minTop = Math.min(...well.perforations.map((p) => p.topDepth || 0));
    const maxBottom = Math.max(...well.perforations.map((p) => p.bottomDepth || 0));
    const yTop = mapY(minTop);
    const yBot = mapY(maxBottom);
    const deepestCsg = well.casings.reduce(
      (max, c) => ((c.shoeDepth || 0) > (max.shoeDepth || 0) ? c : max),
      well.casings[0]
    );
    let yBotDotted = yBot + 35;
    if (deepestCsg) {
      const yCasingShoe = mapY(deepestCsg.shoeDepth || 0);
      if (yBotDotted >= yCasingShoe - 5) yBotDotted = yCasingShoe - 5;
    }
    const resName = (well.reservoir || 'F6').trim();
    formation = {
      yTop,
      yBotDotted,
      rectHeight: yBotDotted - (yTop - 15),
      formationLabel: resName.toUpperCase().includes('GRS') || resName.toUpperCase().includes('SAND')
        ? resName
        : `GRS ${resName} SANDSTONE`,
    };
  }

  const yEndTotal = computedTools.length > 0
    ? Math.max(...computedTools.map((t) => t.visualYBottom))
    : params.yStart;

  const excluded = computedTools
    .filter((t) => t.effectiveType !== 'Tubing' && t.effectiveType !== 'Tubing Court')
    .map((t) => ({ yStart: t.visualYTop, yEnd: t.visualYBottom }))
    .sort((a, b) => a.yStart - b.yStart);

  const tubingSegments: YRange[] = [];
  let currentY = params.yStart;
  for (const range of excluded) {
    if (range.yStart > currentY + 1) tubingSegments.push({ yStart: currentY, yEnd: range.yStart });
    currentY = range.yEnd;
  }
  if (currentY < yEndTotal) tubingSegments.push({ yStart: currentY, yEnd: yEndTotal });

  let perforation: PerforationDrawLayout | null = null;
  if (well.perforations.length > 0) {
    const topDepth = Math.min(...well.perforations.map((p) => p.topDepth || 0));
    const bottomDepth = Math.max(...well.perforations.map((p) => p.bottomDepth || 0));
    const yTop = mapY(topDepth);
    const yBottom = mapY(bottomDepth);
    const height = yBottom - yTop;
    const step = Math.max(8, height / 10);
    const shotRows: number[] = [];
    for (let y = yTop; y <= yBottom; y += step) shotRows.push(y);
    perforation = { topDepth, bottomDepth, yTop, yBottom, shotRows };
  }

  const leftSpacing = params.svgHeight > 1000 ? 15 : 18.5;
  const leftMinY = params.svgHeight > 1000 ? 75 : 50;
  const leftMaxY = params.svgHeight > 1000 ? params.svgHeight - 25 : params.svgHeight - 20;
  const leftIters = params.svgHeight > 1000 ? 120 : 100;

  const rawLeft: ResolvedLeftLabel[] = [];
  casings.forEach((cd, index) => {
    const casing = well.casings[cd.casingIndex];
    const csgSize = formatCasingSize(casing.casingSize);
    const topVal = getCasingTopDepth(casing);
    if (index === 0) {
      rawLeft.push({ text: `Ø tubage : ${csgSize}`, targetY: cd.yTop + 15, targetX: params.xCenter - cd.casingR, resolvedY: 0, labelType: 'Casing String', depthStr: `${topVal} m` });
      if (cd.hasCement) rawLeft.push({ text: 'ciment', targetY: (cd.yToc + cd.yShoe) / 2 + 8, targetX: params.xCenter - (cd.boreholeR + cd.casingR) / 2, resolvedY: 0, labelType: 'Cement Fill', depthStr: `${cd.tocVal} m - ${casing.shoeDepth} m` });
      rawLeft.push({ text: `Sbt: ${formatDepth(casing.shoeDepth)} m`, targetY: cd.yShoe, targetX: params.xCenter - cd.casingR, resolvedY: 0, labelType: 'Casing Shoe (Sabot)', depthStr: `${formatDepth(casing.shoeDepth)} m` });
    } else {
      rawLeft.push({ text: `Ø tubage : ${csgSize}`, targetY: cd.yShoe - 30, targetX: params.xCenter - cd.casingR, resolvedY: 0, labelType: 'Casing String', depthStr: `${topVal} m` });
      rawLeft.push({ text: `Sbt: ${formatDepth(casing.shoeDepth)} m`, targetY: cd.yShoe, targetX: params.xCenter - cd.casingR, resolvedY: 0, labelType: 'Casing Shoe (Sabot)', depthStr: `${formatDepth(casing.shoeDepth)} m` });
      if (cd.hasCement && cd.tocVal !== null) rawLeft.push({ text: `TOC ${csgSize} : ${formatDepth(cd.tocVal)} m`, targetY: cd.yToc, targetX: params.xCenter - (cd.boreholeR + cd.casingR) / 2, resolvedY: 0, labelType: 'Cement Fill', depthStr: `${formatDepth(cd.tocVal)} m` });
      if (cd.hasLiner && cd.tolVal !== null && cd.yTol !== null) rawLeft.push({ text: `TOL ${csgSize} : ${formatDepth(cd.tolVal)} m`, targetY: cd.yTol, targetX: params.xCenter - (cd.boreholeR + cd.casingR) / 2, resolvedY: 0, labelType: 'Liner Hanger', depthStr: `${formatDepth(cd.tolVal)} m` });
      if (cd.hasTF && cd.tfVal !== null && cd.yTF !== null) rawLeft.push({ text: `TF ${csgSize} : ${formatDepth(cd.tfVal)} m`, targetY: cd.yTF, targetX: params.xCenter - (cd.boreholeR + cd.casingR) / 2, resolvedY: 0, labelType: 'Top Fonde', depthStr: `${formatDepth(cd.tfVal)} m` });
      if (cd.yDrilled > cd.yShoe + 1) rawLeft.push({ text: `foré jusqu' à ${formatDepth(casing.drilledDepth)} m`, targetY: cd.yDrilled, targetX: params.xCenter - cd.boreholeR, resolvedY: 0, labelType: 'Drilled Borehole', depthStr: `${formatDepth(casing.drilledDepth)} m` });
    }
  });
  rawLeft.sort((a, b) => a.targetY - b.targetY);

  if (
    well.linerCrepineParams?.topOfLiner !== undefined &&
    well.linerCrepineParams?.topOfLiner !== null &&
    !isNaN(well.linerCrepineParams.topOfLiner)
  ) {
    const tolVal = Number(well.linerCrepineParams.topOfLiner);
    const yTol = mapY(tolVal);
    const diamStr = well.linerCrepineParams.diameter ? ` ${well.linerCrepineParams.diameter}` : '';
    rawLeft.push({
      text: `TOL${diamStr} : ${formatDepth(tolVal)} m`,
      targetY: yTol,
      targetX: params.xCenter - 18,
      resolvedY: 0,
      labelType: 'Liner Crépine (TOL)',
      depthStr: `${formatDepth(tolVal)} m`
    });
  }

  if (
    well.linerCrepineParams?.shoeDepth !== undefined &&
    well.linerCrepineParams?.shoeDepth !== null &&
    !isNaN(well.linerCrepineParams.shoeDepth)
  ) {
    const shoeVal = Number(well.linerCrepineParams.shoeDepth);
    const yShoe = mapY(shoeVal);
    const diamStr = well.linerCrepineParams.diameter ? ` ${well.linerCrepineParams.diameter}` : '';
    rawLeft.push({
      text: `Sbt Crépine${diamStr} : ${formatDepth(shoeVal)} m`,
      targetY: yShoe,
      targetX: params.xCenter - 18,
      resolvedY: 0,
      labelType: 'Sabot Liner Crépine',
      depthStr: `${formatDepth(shoeVal)} m`
    });
  }

  if (
    well.linerCrepineParams?.drilledToDepth !== undefined &&
    well.linerCrepineParams?.drilledToDepth !== null &&
    !isNaN(well.linerCrepineParams.drilledToDepth)
  ) {
    const drilledVal = Number(well.linerCrepineParams.drilledToDepth);
    const yDrilled = mapY(drilledVal);
    const diamStr = well.linerCrepineParams.holeDiameter ? ` Ø ${well.linerCrepineParams.holeDiameter}` : '';
    rawLeft.push({
      text: `foré${diamStr} jusqu' à ${formatDepth(drilledVal)} m`,
      targetY: yDrilled,
      targetX: params.xCenter - 22,
      resolvedY: 0,
      labelType: 'Trou Foré (Open Hole)',
      depthStr: `${formatDepth(drilledVal)} m`
    });
  }

  rawLeft.sort((a, b) => a.targetY - b.targetY);
  const resolvedLeftYs = resolveSpacingLabels(rawLeft.map((l) => l.targetY), leftSpacing, leftMinY, leftMaxY, leftIters);
  const leftLabels = rawLeft.map((l, i) => ({ ...l, resolvedY: resolvedLeftYs[i] }));

  const rightMinY = params.svgHeight > 1000 ? 60 : 50;
  const rightMaxY = params.svgHeight > 1000 ? params.svgHeight - 30 : params.svgHeight - 20;
  const rightIters = params.svgHeight > 1000 ? 150 : 120;
  const rightLabels = computeRightToolLabels(
    computedTools,
    params.xCenter,
    rightMinY,
    rightMaxY,
    rightIters
  );

  const printTableRows: PrintTableRowMeta[] = well.tubings.map((tool, idx) => {
    const isBlank = !tool.name;
    let displayOd = tool.od;
    if (!isBlank && idx > 0 && well.tubings[idx - 1].od === tool.od) displayOd = '//';
    let displayType = getFrenchType(tool.type, tool.name);
    if (!isBlank && idx > 0) {
      const prevFr = getFrenchType(well.tubings[idx - 1].type, well.tubings[idx - 1].name);
      if (prevFr === displayType && (displayType === 'EU' || displayType === 'D')) displayType = '//';
    }
    const qty = tool.qty || (tool.type === 'Tubing' && tool.length > 30 ? String(Math.round(tool.length / 9.6)) : '01');
    return { toolId: tool.id, qty: isBlank ? '' : qty, displayOd: isBlank ? '' : displayOd, displayType: isBlank ? '' : (tool.customType || displayType), showsCote: !isBlank && tool.isCoteProductAdded };
  });

  return {
    sortedCasingIndices: sortedIndices,
    casings,
    formation,
    tubingSegments,
    perforation,
    leftLabels,
    rightLabels,
    printTableRows,
    tbgBottomDepth,
    tbgVisualYBottom,
  };
}

export function activeCasingRadiusTs(
  well: WellData,
  casings: CasingDrawData[],
  depth: number,
  toolOd?: string | number
): number {
  if (!casings || casings.length === 0) return 24.5;

  // 1. If toolOd is provided, attempt smart match against casing sizes
  if (toolOd !== undefined && toolOd !== null) {
    const odVal = parseSizeToNumber(toolOd);
    if (odVal > 0) {
      const matching = casings.filter((cd) => {
        const casing = well.casings[cd.casingIndex];
        if (!casing) return false;
        const csgSizeNum = parseSizeToNumber(casing.casingSize);
        return Math.abs(csgSizeNum - odVal) < 0.25;
      });

      if (matching.length > 0) {
        let bestCd = matching[0];
        let minDistance = Infinity;
        matching.forEach((cd) => {
          const casing = well.casings[cd.casingIndex];
          const top = getCasingTopDepth(casing);
          const shoe = casing.shoeDepth || 0;
          let dist = 0;
          if (depth < top) dist = top - depth;
          else if (depth > shoe) dist = depth - shoe;
          if (dist < minDistance) {
            minDistance = dist;
            bestCd = cd;
          }
        });
        return bestCd.casingR;
      }
    }
  }

  // 2. Filter casings covering depth
  const covering = casings
    .filter((cd) => {
      const casing = well.casings[cd.casingIndex];
      if (!casing) return false;
      const top = getCasingTopDepth(casing);
      return depth >= top && depth <= (casing.shoeDepth || 0);
    })
    .sort((a, b) => a.casingR - b.casingR);

  if (covering.length > 0) return covering[0].casingR;

  // 3. Fallback to closest casing string by depth distance
  let bestCd = casings[0];
  let minDistance = Infinity;
  casings.forEach((cd) => {
    const casing = well.casings[cd.casingIndex];
    if (!casing) return;
    const top = getCasingTopDepth(casing);
    const shoe = casing.shoeDepth || 0;
    let dist = 0;
    if (depth < top) dist = top - depth;
    else if (depth > shoe) dist = depth - shoe;
    if (dist < minDistance) {
      minDistance = dist;
      bestCd = cd;
    }
  });

  return bestCd ? bestCd.casingR : 24.5;
}

export function layoutParamsFor(mode: 'interactive' | 'print') {
  return mode === 'print'
    ? { svgWidth: 700, svgHeight: 940, xCenter: 350, yStart: 50, yEnd: 915, radiusFactor: 4.5, minBlockSpacing: 42, visualToolLimit: 835 }
    : { svgWidth: 700, svgHeight: 1100, xCenter: 350, yStart: 40, yEnd: 1050, radiusFactor: 4.5, minBlockSpacing: 42, visualToolLimit: 950 };
}

export { getFilteredTubings, calculateComputedTools, calculateKeyAnchors };
