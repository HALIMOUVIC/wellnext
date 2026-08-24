# Wellbore Schematic Pro

> Plateforme unifiée pour la gestion des puits, le suivi des complétions et l'historisation des données techniques.

---

## Architecture

| Layer | Technology |
|---|---|
| **UI** | TypeScript / React / Vite |
| **Server** | Node.js + Express + better-sqlite3 |
| **Calculations** | Rust (`rust/wellbore-core`) compiled to WebAssembly |
| **Desktop App** | Electron (wraps the full stack) |
| **Database** | SQLite (local, via better-sqlite3) |

---

## Prerequisites

| Tool | Required | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) ≥ 18 | ✅ Yes | Install from nodejs.org |
| [Rust + Cargo](https://rustup.rs/) | ⚠️ Only for WASM rebuild | Install via rustup |
| [wasm-pack](https://rustwasm.github.io/wasm-pack/) | ⚠️ Only for WASM rebuild | `cargo install wasm-pack` |

---

## 1. Run Locally (Development)

```powershell
# Install dependencies
npm install

# Start the dev server (browser app)
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## 2. Build Rust WASM (optional — for faster calculations)

> Skip this if the `src/wasm/` folder already contains `.wasm` files.

```powershell
# Add the WASM target to Rust
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack

# Build the WASM bindings
npm run build:wasm
```

The app automatically falls back to TypeScript if WASM is unavailable.

---

## 3. Export the App as a Windows EXE Installer

> This produces `build-desktop/WellboreSchematicPro Setup.exe`

### Step 1 — Make sure you have enough disk space

The build requires **at least 700 MB free** on your C: drive.
You can check with:

```powershell
Get-PSDrive C | Select-Object @{N='Free_GB';E={[math]::Round($_.Free/1GB,2)}}
```

### Step 2 — (Optional) Rebuild WASM if you changed Rust code

```powershell
npm run build:wasm
```

### Step 3 — Clean old build output (recommended)

```powershell
Remove-Item -Recurse -Force "build-desktop" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "package-staging" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
```

### Step 4 — Build the EXE installer

```powershell
npm run dist:exe
```

### Step 5 — Locate the installer

When the build finishes you will see:

```
==================================================
SUCCESS: Installer generated inside "build-desktop/"!
==================================================
```

Your installer is at:

```
build-desktop\WellboreSchematicPro Setup.exe
```

Double-click it to install the app on any Windows machine.

---

## Quick Reference — All Commands

```powershell
# 1. Install dependencies
npm install

# 2. Run in browser (development)
npm run dev

# 3. Build Rust WASM (only when Rust code changes)
npm run build:wasm

# 4. Build Vite + server bundle only (no installer)
npm run build

# 5. Build full Windows EXE installer  ← most common
npm run dist:exe

# 6. Clean build outputs
Remove-Item -Recurse -Force "build-desktop","package-staging","dist" -ErrorAction SilentlyContinue
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `There is not enough space on the disk` | Free at least 700 MB on C: drive and retry `npm run dist:exe` |
| `Cannot find module '../wasm/wellbore_wasm.js'` | Run `npm run build:wasm` first |
| App opens but schematic is blank | Run `npm install` then retry |
| Installer finish screen shows error | Known Windows association quirk — the app is installed correctly, launch it from Start Menu |

---

## Output Files

| File | Description |
|---|---|
| `build-desktop/WellboreSchematicPro Setup.exe` | Windows NSIS installer (distribute this) |
| `build-desktop/win-unpacked/` | Unpacked app (for testing without install) |
| `dist/` | Vite + server build output (bundled into EXE) |
| `src/wasm/` | Compiled WebAssembly binaries |
