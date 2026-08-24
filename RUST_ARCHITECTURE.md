# Wellbore Rust Core Architecture

## Goal

- **TypeScript / React** → UI only (forms, tables, routing, API calls)
- **Rust (`wellbore-core`)** → all calculations (depths, tubing, perforations, schematic math)
- **WASM (`wellbore-wasm`)** → run Rust in the browser at near-native speed

This is the same pattern used by Discord, Figma, and VS Code for performance-critical code.

## Project layout

```
rust/
  wellbore-core/     # Pure Rust calculation library (no DOM, no React)
  wellbore-wasm/     # wasm-bindgen bridge for the browser

src/lib/
  wellboreCore.ts    # Current TS implementation (fallback)
  wellboreEngine.ts  # Facade: loads WASM, falls back to TS
```

## Phase 1 — DONE

Ported from `wellboreCore.ts` into Rust and wired through `wellboreEngine.ts`:

| Function | Rust module |
|---|---|
| `parseSizeToNumber` | `parse.rs` |
| `formatDepth`, `formatCasingSize` | `parse.rs` |
| `calculateMaxDepth` | `depth.rs` |
| `calculateKeyAnchors` | `depth.rs` |
| `mapDepthToYRaw`, `mapDepthToY` | `depth.rs` |
| `getEffectiveType` | `tubing.rs` |
| `getFilteredTubings` | `tubing.rs` |
| `calculateComputedTools` | `tubing.rs` |
| `recalculateBottomDepths` | `tubing.rs` |
| `calculateCoteProducts` | `tubing.rs` |
| `calculatePerforationFields` | `perforation.rs` |
| `savePerforation`, `removePerforationFromWell` | `perforation.rs` |
| `updateTubingComponentMatrix` | `matrix.rs` |
| `getTubingTypeDefaults` | `matrix.rs` |
| `getFrenchDesignation`, `getFrenchType` | `matrix.rs` |
| `computeSchematic` (batch) | `lib.rs` |

**Wired in UI:** `WellboreSchematic.tsx`, `WellboreA4Print.tsx`, forms, and catalogue all import from `wellboreEngine.ts`.

**Build:** `npm run build:wasm` → `public/wellbore/` (WASM is ~247 KB, served at `/wellbore/`).

## Phase 2 — DONE (schematic geometry)

Ported to `rust/wellbore-core/src/layout.rs` and exposed via `wasm_compute_schematic_full`:

| Function | Rust module |
|---|---|
| `compute_casings_layout` / casing draw data | `layout.rs` |
| Block label collision resolver | `layout.rs` |
| Left label overlap solver (120/100 iter) | `layout.rs` |
| Right label overlap solver (100 iter) | `layout.rs` |
| Formation background geometry | `layout.rs` |
| Tubing segments splitter | `layout.rs` |
| `active_casing_radius_at_depth` | `layout.rs` |
| Perforation merged band + shot rows | `layout.rs` |
| Print table OD/type collapse + joint count | `layout.rs` |
| `compute_schematic_full` (batch) | `layout.rs` + `lib.rs` |

**Wired in UI:** `WellboreSchematic.tsx`, `WellboreA4Print.tsx` use `computeSchematicFull()`.

**TS fallback:** `src/lib/schematicLayout.ts` (when WASM not loaded).

## Phase 3 — TODO (optional polish)

- [ ] BlueprintSchematic.tsx formation (uses same `layout.formation`)
- [ ] Right-hand print labels use `layout.rightLabels` positions
- [ ] Server-side Rust for batch PDF export

## Install Rust (required once)

```powershell
# Install Rust: https://rustup.rs/
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

## Build WASM

```powershell
npm run build:wasm
```

Output goes to `src/wasm/`:
- `wellbore_wasm.js`
- `wellbore_wasm_bg.wasm`

## Use in the app

```typescript
import { initWellboreEngine, calculateMaxDepth, computeSchematic } from './lib/wellboreEngine';

await initWellboreEngine(); // loads Rust WASM
const maxDepth = calculateMaxDepth(well);
const schematic = computeSchematic(well, 'interactive', 'compact');
```

If WASM is not built, the app automatically uses the existing TypeScript `wellboreCore.ts` — nothing breaks.

## Migration rule

1. UI components import from `wellboreEngine.ts`, not `wellboreCore.ts` directly
2. New calculations go in Rust first, then get a WASM export
3. Delete TS duplicate only after Rust parity is verified

## Full function checklist

### Core (`wellboreCore.ts`) — Rust port status

- [x] parseSizeToNumber
- [x] formatDepth
- [x] formatCasingSize
- [x] calculateMaxDepth
- [x] calculateKeyAnchors
- [x] mapDepthToYRaw
- [x] mapDepthToY
- [x] getEffectiveType
- [x] getFilteredTubings
- [x] calculateComputedTools
- [x] getFrenchDesignation
- [x] getFrenchType
- [x] recalculateBottomDepths
- [x] calculateCoteProducts
- [x] calculatePerforationFields
- [x] savePerforation
- [x] removePerforationFromWell
- [x] updateTubingComponentMatrix
- [x] getTubingTypeDefaults
- [x] computeSchematic (batch API)

### Schematic components — Phase 2

- [x] Casing draw data (`casingsData`)
- [x] Block label collision resolver
- [x] Left label overlap solver (120 iter)
- [x] Right label overlap solver (100 iter)
- [x] Formation background geometry
- [x] Tubing segments splitter
- [x] Covering casing at depth
- [x] Perforation merged band + shot rows
- [x] Print table OD/type collapse
- [x] Joint count estimate

### Server (`server.ts`) — stays TypeScript

- Folio increment (`max + 1`) — trivial, not worth Rust
- Supabase CRUD — stays in Express/TS
