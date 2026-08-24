export default async function init() {
  return Promise.resolve();
}

export function wasm_version() {
  return '1.0.0-fallback';
}

export function wasm_parse_size_to_number() { return 0; }
export function wasm_calculate_max_depth() { return 0; }
export function wasm_compute_schematic() { return '{}'; }
export function wasm_compute_schematic_full() { return '{}'; }
export function wasm_active_casing_radius() { return 0; }
export function wasm_recalculate_bottom_depths() { return '[]'; }
export function wasm_calculate_cote_products() { return '[]'; }
export function wasm_calculate_perforation_fields() { return '{}'; }
export function wasm_save_perforation() { return '{}'; }
export function wasm_remove_perforation() { return '{}'; }
export function wasm_update_tool_matrix() { return '{}'; }
export function wasm_get_filtered_tubings() { return '[]'; }
