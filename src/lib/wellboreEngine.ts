/**
 * Rust/WASM engine facade.
 * UI stays in TypeScript; calculations run in Rust when WASM is built and loaded.
 * Falls back to existing TypeScript implementations in wellboreCore.ts.
 */

/// <reference path="../wasm/wellbore_wasm.d.ts" />

import type { WellData, TubingComponent, PerforationZone } from '../types';
import * as tsCore from './wellboreCore';
import {
  activeCasingRadiusTs,
  computeSchematicLayoutTs,
  layoutParamsFor,
  type SchematicGeometryOutput,
} from './schematicLayout';

export type { SchematicGeometryOutput, CasingDrawData, FormationLayout, PerforationDrawLayout, ResolvedLeftLabel, PrintTableRowMeta } from './schematicLayout';

type WasmModule = {
  wasm_parse_size_to_number: (size: string) => number;
  wasm_calculate_max_depth: (wellJson: string) => number;
  wasm_compute_schematic: (inputJson: string) => string;
  wasm_compute_schematic_full: (inputJson: string) => string;
  wasm_active_casing_radius: (wellJson: string, casingsJson: string, depth: number) => number;
  wasm_recalculate_bottom_depths: (tubingsJson: string) => string;
  wasm_calculate_cote_products: (tubingsJson: string, spoolProd: string) => string;
  wasm_calculate_perforation_fields: (
    top: number,
    bottom: number,
    manualHeight: number,
    density: number,
    manualShots: number,
    hasManualHeight: boolean,
    hasDensity: boolean,
    hasManualShots: boolean
  ) => string;
  wasm_save_perforation: (wellJson: string, perfJson: string, editingId: string) => string;
  wasm_remove_perforation: (wellJson: string, perfId: string) => string;
  wasm_update_tool_matrix: (rowsJson: string) => string;
  wasm_get_filtered_tubings: (tubingsJson: string) => string;
  wasm_version: () => string;
};

let wasmModule: WasmModule | null = null;
let wasmReady = false;

export async function initWellboreEngine(): Promise<boolean> {
  if (wasmReady) return true;
  try {
    const mod = await import('../wasm/wellbore_wasm.js');
    await mod.default();
    wasmModule = mod as WasmModule;
    wasmReady = true;
    console.info('[wellbore-engine] Rust WASM loaded', wasmModule.wasm_version());
    return true;
  } catch (error) {
    console.warn('[wellbore-engine] WASM unavailable, using TypeScript fallback', error);
    wasmReady = false;
    wasmModule = null;
    return false;
  }
}

function hasRealWasm() {
  return wasmReady && !!wasmModule && typeof wasmModule.wasm_version === 'function' && wasmModule.wasm_version() !== '1.0.0-fallback';
}

export function isRustEngineReady() {
  return hasRealWasm();
}

export function parseSizeToNumber(size: string | number | undefined) {
  if (hasRealWasm() && typeof size === 'string') {
    return wasmModule!.wasm_parse_size_to_number(size);
  }
  return tsCore.parseSizeToNumber(size);
}

export function calculateMaxDepth(well: WellData) {
  if (hasRealWasm()) {
    return wasmModule!.wasm_calculate_max_depth(JSON.stringify(well));
  }
  return tsCore.calculateMaxDepth(well);
}

export function recalculateBottomDepths(tubings: TubingComponent[]) {
  if (hasRealWasm()) {
    try {
      return JSON.parse(wasmModule!.wasm_recalculate_bottom_depths(JSON.stringify(tubings)));
    } catch (e) {
      console.warn("WASM recalculateBottomDepths failed, falling back to TS:", e);
    }
  }
  return tsCore.recalculateBottomDepths(tubings);
}

export function calculateCoteProducts(tubings: TubingComponent[], spoolProd?: string) {
  if (hasRealWasm()) {
    try {
      return JSON.parse(wasmModule!.wasm_calculate_cote_products(JSON.stringify(tubings), spoolProd || ''));
    } catch (e) {
      console.warn("WASM calculateCoteProducts failed, falling back to TS:", e);
    }
  }
  return tsCore.calculateCoteProducts(tubings, spoolProd);
}

export function calculatePerforationFields(
  top: number,
  bottom: number,
  manualHeight?: number,
  density?: number,
  manualShots?: number
) {
  if (hasRealWasm()) {
    try {
      return JSON.parse(
        wasmModule!.wasm_calculate_perforation_fields(
          top,
          bottom,
          manualHeight ?? 0,
          density ?? 0,
          manualShots ?? 0,
          manualHeight !== undefined && manualHeight !== null,
          density !== undefined,
          manualShots !== undefined
        )
      );
    } catch (e) {
      console.warn("WASM calculatePerforationFields failed, falling back to TS:", e);
    }
  }
  return tsCore.calculatePerforationFields(top, bottom, manualHeight, density, manualShots);
}

export function savePerforation(well: WellData, newPerf: Partial<PerforationZone>, editingPerfId: string | null) {
  return tsCore.savePerforation(well, newPerf, editingPerfId);
}

export function squeezePerforations(well: WellData, perfIds: string[], squeeze: boolean = true) {
  return tsCore.squeezePerforations(well, perfIds, squeeze);
}

export function removePerforationFromWell(well: WellData, id: string) {
  return tsCore.removePerforationFromWell(well, id);
}

export function updateTubingComponentMatrix(toolsFromDb: unknown[]) {
  // Always build the matrix in TypeScript so schematic SVG rules stay in sync
  // with public/img assets (prebuilt WASM may lag behind source changes).
  tsCore.updateTubingComponentMatrix(toolsFromDb);
}

export function computeSchematic(
  well: WellData,
  layout: 'interactive' | 'print' = 'interactive',
  scaleMode: 'compact' | 'linear' = 'compact'
) {
  if (hasRealWasm()) {
    const input = {
      well,
      layout:
        layout === 'print'
          ? { svgWidth: 700, svgHeight: 940, xCenter: 350, yStart: 50, yEnd: 915, casingRadiusFactor: 4.5, tubingHalfWidth: 5, visualToolLimit: 835, minBlockSpacing: 42 }
          : { svgWidth: 700, svgHeight: 1100, xCenter: 350, yStart: 40, yEnd: 1050, casingRadiusFactor: 4.5, tubingHalfWidth: 7, visualToolLimit: 950, minBlockSpacing: 42 },
      scaleMode,
    };
    return JSON.parse(wasmModule!.wasm_compute_schematic(JSON.stringify(input)));
  }

  const maxDepth = tsCore.calculateMaxDepth(well);
  const yStart = layout === 'print' ? 50 : 40;
  const yEnd = layout === 'print' ? 915 : 1050;
  const keyAnchors = tsCore.calculateKeyAnchors(well, maxDepth, yStart, yEnd);
  const filtered = tsCore.getFilteredTubings(well.tubings);
  const mapRaw = (depth: number) =>
    tsCore.mapDepthToYRaw(depth, scaleMode, maxDepth, keyAnchors, yStart, yEnd);
  const computedTools = tsCore.calculateComputedTools(
    filtered,
    mapRaw,
    layout === 'print' ? 835 : 950
  );
  return { maxDepth, keyAnchors, filteredTubings: filtered, computedTools };
}

function layoutInputFor(mode: 'interactive' | 'print') {
  return mode === 'print'
    ? { svgWidth: 700, svgHeight: 940, xCenter: 350, yStart: 50, yEnd: 915, casingRadiusFactor: 4.5, tubingHalfWidth: 5, visualToolLimit: 835, minBlockSpacing: 42 }
    : { svgWidth: 700, svgHeight: 1100, xCenter: 350, yStart: 40, yEnd: 1050, casingRadiusFactor: 4.5, tubingHalfWidth: 7, visualToolLimit: 950, minBlockSpacing: 42 };
}

export function computeSchematicFull(
  well: WellData,
  layoutMode: 'interactive' | 'print' = 'interactive',
  scaleMode: 'compact' | 'linear' = 'compact'
): { schematic: ReturnType<typeof computeSchematic>; layout: SchematicGeometryOutput } {
  if (hasRealWasm()) {
    const input = { well, layout: layoutInputFor(layoutMode), scaleMode };
    const result = JSON.parse(wasmModule!.wasm_compute_schematic_full(JSON.stringify(input)));
    if (result.error) throw new Error(result.error);
    return { schematic: result.schematic, layout: result.layout };
  }

  const schematic = computeSchematic(well, layoutMode, scaleMode);
  const layout = computeSchematicLayoutTs(well, scaleMode, layoutParamsFor(layoutMode), schematic);
  return { schematic, layout };
}

export function activeCasingRadius(
  well: WellData,
  casings: SchematicGeometryOutput['casings'],
  depth: number,
  toolOd?: string | number
): number {
  if (hasRealWasm()) {
    if ((wasmModule as any)?.wasm_active_casing_radius_with_od) {
      return (wasmModule as any).wasm_active_casing_radius_with_od(
        JSON.stringify(well),
        JSON.stringify(casings),
        depth,
        toolOd !== undefined && toolOd !== null ? String(toolOd) : undefined
      );
    }
    return wasmModule!.wasm_active_casing_radius(JSON.stringify(well), JSON.stringify(casings), depth);
  }
  return activeCasingRadiusTs(well, casings, depth, toolOd);
}

// Re-export TS-only helpers until schematic geometry is fully ported to Rust (phase 2)
export {
  formatDepth,
  formatCasingSize,
  calculateKeyAnchors,
  mapDepthToYRaw,
  mapDepthToY,
  getEffectiveType,
  getFilteredTubings,
  calculateComputedTools,
  getFrenchDesignation,
  getFrenchType,
  getTubingTypeDefaults,
  MINIMAL_FALLBACK_MATRIX,
  BUILTIN_TUBING_COMPONENT_MATRIX,
  TUBING_COMPONENT_MATRIX,
  buildMatrixFromDb,
  configFromDbRow,
  resolveTubingConfig,
  getImageSourceHeight,
  parseViewBoxSize,
  toolSvgUrl,
  calculateLinerCrepineFields,
  saveLinerCrepine,
  removeLinerCrepineFromWell,
  calculateLinerCrepineHeaderParams,
  saveLinerCrepineParams,
} from './wellboreCore';