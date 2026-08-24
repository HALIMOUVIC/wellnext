export default function init(): Promise<void>;
export function wasm_version(): string;
export function wasm_parse_size_to_number(size: string): number;
export function wasm_calculate_max_depth(wellJson: string): number;
export function wasm_compute_schematic(inputJson: string): string;
export function wasm_compute_schematic_full(inputJson: string): string;
export function wasm_active_casing_radius(wellJson: string, casingsJson: string, depth: number): number;
export function wasm_recalculate_bottom_depths(tubingsJson: string): string;
export function wasm_calculate_cote_products(tubingsJson: string, spoolProd: string): string;
export function wasm_calculate_perforation_fields(
  top: number,
  bottom: number,
  manualHeight: number,
  density: number,
  manualShots: number,
  hasManualHeight: boolean,
  hasDensity: boolean,
  hasManualShots: boolean
): string;
export function wasm_save_perforation(wellJson: string, perfJson: string, editingId: string): string;
export function wasm_remove_perforation(wellJson: string, perfId: string): string;
export function wasm_update_tool_matrix(rowsJson: string): string;
export function wasm_get_filtered_tubings(tubingsJson: string): string;
