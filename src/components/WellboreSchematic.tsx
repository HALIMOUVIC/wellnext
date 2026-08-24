import React, { useState, useMemo } from "react";
import {
  WellData,
  CasingString,
  TubingComponent,
  PerforationZone,
  CementPlug,
} from "../types";
import {
  parseSizeToNumber,
  formatDepth,
  formatCasingSize,
  computeSchematicFull,
  activeCasingRadius,
  mapDepthToYRaw as mapDepthToYRawCore,
  mapDepthToY as mapDepthToYCore,
  resolveTubingConfig,
  getImageSourceHeight,
  parseViewBoxSize,
} from "../lib/wellboreEngine";
import {
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  Plus,
  Minus,
  Info,
  HelpCircle,
  FileText,
  Database,
  RefreshCw,
} from "lucide-react";
import WellboreA4Print from "./WellboreA4Print";

const getIconForType = (type: string | undefined) => {
  if (!type) return <Info className="w-5 h-5" />;
  const t = type.toLowerCase();

  if (t.includes("cement")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path d="M4 4h16v16H4z M4 9h16 M4 14h16 M9 4v5 M15 9v5 M9 14v5" />
      </svg>
    );
  }
  if (t.includes("perforation")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5 text-rose-500"
      >
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }
  if (t.includes("packer")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5 text-slate-800"
      >
        <rect x="8" y="4" width="8" height="16" rx="1" />
        <path d="M6 8h12 M6 16h12" />
      </svg>
    );
  }
  if (t.includes("shoe")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path d="M7 4v10l5 6 5-6V4" />
      </svg>
    );
  }
  if (t.includes("mandrel")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path d="M10 4v16 M10 8c4 0 6 2 6 4s-2 4-6 4" />
        <circle cx="13" cy="12" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (t.includes("reduction")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path d="M6 4h12 M8 20h8 M6 4l2 16 M18 4l-2 16" />
      </svg>
    );
  }
  if (t.includes("casing")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path d="M7 2v20 M17 2v20 M7 6h10 M7 18h10" />
      </svg>
    );
  }
  if (t.includes("tubing")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5"
      >
        <path d="M10 2v20 M14 2v20" />
      </svg>
    );
  }
  if (t.includes("tailpipe") || t.includes("queue")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5 text-amber-500"
      >
        <path d="M10 2v20 M14 2v20 M8 6h8 M8 12h8 M8 18h8" />
      </svg>
    );
  }

  return <Info className="w-5 h-5" />;
};

const renderRealToolGraphic = (type: string | undefined, name?: string) => {
  const t = (type || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (!type && !name) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12 text-sky-400">
        <circle cx="30" cy="30" r="20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3,3" />
        <path d="M 30 18 L 30 32 M 30 38 L 30 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // 1. Mandrin / Mandrel / Side-Pocket Mandrel (Checked FIRST to avoid "pocket" matching open hole!)
  if (t.includes("mandrel") || t.includes("mandrin") || n.includes("mandrel") || n.includes("mandrin") || t.includes("spm") || n.includes("spm")) {
    return <img src="/img/mandrin.svg" className="w-11 h-11 object-contain" alt="Mandrin" />;
  }

  // 2. Bridge Plug (B.P)
  if (t.includes("bridge") || t.includes("b.p") || n.includes("bridge") || n.includes("b.p")) {
    return <img src="/img/bridge-plug.svg" className="w-11 h-11 object-contain" alt="Bridge Plug" />;
  }

  // 3. Packer (PKR)
  if (t.includes("packer") || t.includes("pkr") || n.includes("packer") || n.includes("pkr")) {
    return <img src="/img/packer.svg" className="w-11 h-11 object-contain" alt="Packer" />;
  }

  // 4. Siège / Nipple / Seating Nipple
  if (t.includes("nipple") || t.includes("siège") || t.includes("siége") || t.includes("siege") || n.includes("nipple") || n.includes("siège") || n.includes("siége") || n.includes("siege")) {
    return <img src="/img/siege.svg" className="w-11 h-11 object-contain" alt="Siège" />;
  }

  // 5. Sliding Sleeve / Manchon coulissant
  if (t.includes("sliding") || t.includes("sleeve") || t.includes("manchon") || n.includes("sliding") || n.includes("sleeve") || n.includes("manchon")) {
    return <img src="/img/sliding-sleeve.svg" className="w-11 h-11 object-contain" alt="Sliding Sleeve" />;
  }

  // 6. Anchor-seal / Ancrage
  if (t.includes("anchor") || t.includes("ancrage") || t.includes("seal") || n.includes("anchor") || n.includes("ancrage") || n.includes("seal")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <rect x="22" y="4" width="16" height="52" fill="#cbd5e1" rx="0.5" stroke="#475569" strokeWidth="0.5" />
        <rect x="25" y="4" width="10" height="52" fill="#0f172a" />
        {/* Chevron packing rings (stacked V shapes) representing anchor seals */}
        <path d="M 20 18 L 30 24 L 40 18" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 20 26 L 30 32 L 40 26" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 20 34 L 30 40 L 40 34" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Top/bottom metal catch collars */}
        <rect x="20" y="8" width="20" height="5" fill="#475569" stroke="#1e293b" strokeWidth="0.5" />
        <rect x="20" y="45" width="20" height="5" fill="#475569" stroke="#1e293b" strokeWidth="0.5" />
      </svg>
    );
  }

  // 7. Reduction / Cross-over
  if (t.includes("reduction") || t.includes("cross-over") || t.includes("crossover") || t.includes("swage") || t.includes("réduction") || n.includes("reduction") || n.includes("cross-over") || n.includes("crossover") || n.includes("swage") || n.includes("réduction")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        {/* Top Large Section */}
        <rect x="14" y="6" width="32" height="14" fill="#cbd5e1" stroke="#475569" strokeWidth="1" rx="0.5" />
        <rect x="16" y="6" width="2" height="14" fill="#ffffff" opacity="0.4" />
        
        {/* Conical Swage Transition Section */}
        <path d="M 14 20 L 22 34 L 38 34 L 46 20 Z" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
        
        {/* Bottom Small Section */}
        <rect x="22" y="34" width="16" height="20" fill="#64748b" stroke="#334155" strokeWidth="1" rx="0.5" />
        <rect x="24" y="34" width="2" height="20" fill="#ffffff" opacity="0.3" />
        
        {/* Helical thread lines represented inside connections */}
        <line x1="16" y1="10" x2="44" y2="10" stroke="#475569" strokeWidth="0.5" strokeDasharray="1,1" />
        <line x1="24" y1="44" x2="36" y2="44" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,1" />
      </svg>
    );
  }

  // 8. Tubing Court / Pup Joint / Joint court
  if (t.includes("pup") || t.includes("court") || n.includes("pup") || n.includes("court") || n.includes("joint court") || n.includes("tubing court")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        {/* Shorter tubing section with highlighted high contrast yellow/black spacers */}
        <rect x="22" y="10" width="16" height="40" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" />
        <rect x="24" y="10" width="3" height="40" fill="#ffffff" opacity="0.6" />
        <rect x="25" y="10" width="10" height="40" fill="#0f172a" />
        
        {/* Top coupling joint */}
        <rect x="18" y="10" width="24" height="8" fill="#fbbf24" stroke="#334155" strokeWidth="1" rx="0.5" />
        <line x1="18" y1="14" x2="42" y2="14" stroke="#1e293b" strokeWidth="1" />
        
        {/* Bottom coupling joint */}
        <rect x="18" y="42" width="24" height="8" fill="#fbbf24" stroke="#334155" strokeWidth="1" rx="0.5" />
        <line x1="18" y1="46" x2="42" y2="46" stroke="#1e293b" strokeWidth="1" />
      </svg>
    );
  }

  // 9. Reservoir Perforations
  if (t.includes("perforation") || t.includes("reservoir") || n.includes("perforation") || n.includes("reservoir")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <rect x="4" y="4" width="52" height="52" fill="#111827" rx="2" />
        
        {/* Casing & Cement layers */}
        <rect x="25" y="4" width="10" height="52" fill="#94a3b8" /> {/* Tubing/Casing */}
        <rect x="18" y="4" width="7" height="52" fill="#475569" opacity="0.7" /> {/* Cement Left */}
        <rect x="35" y="4" width="7" height="52" fill="#475569" opacity="0.7" /> {/* Cement Right */}
        
        {/* Blast Jets/Perforation Tunnels */}
        {/* Left Jet */}
        <path d="M 27 20 L 6 16 L 8 24 L 27 21 Z" fill="#ef4444" opacity="0.9" />
        <path d="M 27 20 L 8 18 L 9 22 L 27 21 Z" fill="#f59e0b" />
        <line x1="27" y1="20.5" x2="6" y2="20" stroke="#ffffff" strokeWidth="1" />
        
        {/* Right Jet */}
        <path d="M 33 40 L 54 36 L 52 44 L 33 41 Z" fill="#ef4444" opacity="0.9" />
        <path d="M 33 40 L 52 38 L 51 42 L 33 41 Z" fill="#f59e0b" />
        <line x1="33" y1="40.5" x2="54" y2="40" stroke="#ffffff" strokeWidth="1" />

        {/* Perfo Entry Holes */}
        <circle cx="27" cy="20.5" r="2" fill="#000000" />
        <circle cx="33" cy="40.5" r="2" fill="#000000" />
      </svg>
    );
  }

  // 10. Cement (B.C / Bouchon de Ciment)
  if (t.includes("cement") || t.includes("ciment") || n.includes("cement") || n.includes("ciment")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <rect x="4" y="4" width="52" height="52" fill="#1e293b" rx="2" />
        {/* Borehole hole (right half) and casing steel (left half) */}
        <rect x="15" y="4" width="30" height="52" fill="#64748b" opacity="0.8" />
        
        {/* Cement aggregate specks */}
        <circle cx="20" cy="12" r="1.5" fill="#cbd5e1" />
        <circle cx="35" cy="16" r="1" fill="#cbd5e1" />
        <circle cx="25" cy="28" r="2" fill="#94a3b8" />
        <circle cx="38" cy="32" r="1.5" fill="#94a3b8" />
        <circle cx="18" cy="44" r="1" fill="#cbd5e1" />
        <circle cx="32" cy="48" r="2.5" fill="#f1f5f9" />
        
        {/* Diagonal dash marks */}
        <line x1="12" y1="15" x2="18" y2="9" stroke="#94a3b8" strokeWidth="0.75" />
        <line x1="42" y1="25" x2="48" y2="19" stroke="#94a3b8" strokeWidth="0.75" />
        <line x1="15" y1="35" x2="21" y2="29" stroke="#94a3b8" strokeWidth="0.75" />
        
        {/* Metal casing boundary line */}
        <line x1="15" y1="4" x2="15" y2="56" stroke="#e2e8f0" strokeWidth="1.5" />
        <line x1="45" y1="4" x2="45" y2="56" stroke="#e2e8f0" strokeWidth="1.5" />
      </svg>
    );
  }

  // 11. Liner / Hanger / TOL / Top Fonde
  if (t.includes("liner") || t.includes("hanger") || t.includes("tol") || t.includes("fonde") || t.includes("tf") || n.includes("liner") || n.includes("hanger") || n.includes("tol") || n.includes("fonde") || n.includes("tf")) {
    return <img src="/img/liner.svg" className="w-11 h-11 object-contain" alt="Liner Hanger" />;
  }

  // 12a. Tubing Production Sabot (e.g. name contains "sabot" or "shoe" but does NOT contain "casing" or "cuvelage")
  if ((t.includes("shoe") || t.includes("sabot") || n.includes("shoe") || n.includes("sabot")) && 
      !n.includes("casing") && !n.includes("cuvelage") && !n.includes("tubage") && !t.includes("casing")) {
    return <img src="/img/sabot.svg" className="w-11 h-11 object-contain" alt="Sabot" />;
  }

  // 12b. Casing Shoe (Sabot) — contains "casing", "cuvelage", or "tubage" (renders orange triangles)
  if (t.includes("shoe") || t.includes("sabot") || n.includes("shoe") || n.includes("sabot")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        {/* Inner bore (dark) — drawn first */}
        <rect x="22" y="4" width="16" height="46" fill="#0f172a" />
        {/* Left casing steel wall */}
        <rect x="18" y="4" width="4" height="42" fill="#64748b" />
        {/* Right casing steel wall */}
        <rect x="38" y="4" width="4" height="42" fill="#64748b" />
        {/* Left shoe triangle — orange, drawn LAST so it's on top */}
        <polygon points="22,42 8,48 22,48" fill="#f97316" />
        {/* Right shoe triangle — orange, drawn LAST so it's on top */}
        <polygon points="38,42 52,48 38,48" fill="#f97316" />
      </svg>
    );
  }

  // 13. Casing
  if (t.includes("casing") || t.includes("cuvelage") || n.includes("casing") || n.includes("cuvelage")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        {/* Main Pipe background */}
        <rect x="18" y="4" width="24" height="52" fill="#64748b" stroke="#475569" strokeWidth="0.5" />
        {/* Inner Flow Hole */}
        <rect x="22" y="4" width="16" height="52" fill="#0f172a" />
        {/* Casing Thread Collar (Coupling) in the middle */}
        <rect x="15" y="20" width="30" height="20" fill="#475569" stroke="#1e293b" strokeWidth="1.2" rx="1" />
        <rect x="17" y="20" width="2" height="20" fill="#ffffff" opacity="0.3" />
        {/* Collar set screws/threads details */}
        <line x1="17" y1="24" x2="43" y2="24" stroke="#334155" strokeWidth="0.5" />
        <line x1="17" y1="36" x2="43" y2="36" stroke="#334155" strokeWidth="0.5" />
      </svg>
    );
  }

  // 14. Tubing
  if (t.includes("tubing") || t.includes("colonne") || n.includes("tubing") || n.includes("colonne")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        {/* Tubing pipe */}
        <rect x="22" y="4" width="16" height="52" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" />
        {/* Shine */}
        <rect x="24" y="4" width="3" height="52" fill="#ffffff" opacity="0.5" />
        {/* Inner Flow passage */}
        <rect x="25" y="4" width="10" height="52" fill="#0f172a" />
        {/* Upset coupling joint */}
        <rect x="20" y="22" width="20" height="16" fill="#475569" stroke="#334155" strokeWidth="1" rx="0.5" />
        <rect x="22" y="22" width="2" height="16" fill="#ffffff" opacity="0.4" />
      </svg>
    );
  }

  // 15. Borehole / Pocket / Drilled hole (Must NOT match Side-Pocket Mandrel)
  if (t.includes("drilled") || t.includes("borehole") || t.includes("foré") || n.includes("drilled") || n.includes("borehole") || n.includes("foré") || ((t.includes("pocket") || n.includes("pocket")) && !t.includes("mandrel") && !t.includes("mandrin") && !n.includes("mandrel") && !n.includes("mandrin"))) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        {/* Rock formation background with horizontal bedding lines */}
        <rect x="4" y="4" width="52" height="52" fill="#475569" rx="2" />
        <line x1="4" y1="15" x2="56" y2="15" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="4" y1="30" x2="56" y2="30" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="4" y1="45" x2="56" y2="45" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        
        {/* Open Hole Cavity (Drilled Borehole) */}
        <path d="M 18 4 L 18 40 Q 18 50 30 50 Q 42 50 42 40 L 42 4" fill="#0f172a" stroke="#020617" strokeWidth="1.5" />
        {/* Drilling fluid/mud waves inside pocket */}
        <path d="M 18 15 Q 24 12, 30 15 Q 36 18, 42 15" fill="none" stroke="#0284c7" strokeWidth="0.5" opacity="0.5" />
        <path d="M 18 30 Q 24 27, 30 30 Q 36 33, 42 30" fill="none" stroke="#0284c7" strokeWidth="0.5" opacity="0.5" />
      </svg>
    );
  }

  // 16. Tailpipe / Tube de queue
  if (t.includes("tailpipe") || t.includes("queue") || n.includes("tailpipe") || n.includes("queue")) {
    return (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        {/* Rock/borehole abstract context */}
        <rect x="22" y="4" width="16" height="52" fill="#475569" stroke="#334155" strokeWidth="0.5" />
        {/* Shine line */}
        <rect x="24" y="4" width="2" height="52" fill="#ffffff" opacity="0.4" />
        {/* Inner conduit */}
        <rect x="26" y="4" width="8" height="52" fill="#0f172a" />
        {/* Slotted perforations/joints on the tailpipe to show it's a tailpipe */}
        <rect x="22" y="14" width="2" height="6" fill="#fbbf24" rx="0.5" />
        <rect x="36" y="14" width="2" height="6" fill="#fbbf24" rx="0.5" />
        <rect x="22" y="28" width="2" height="6" fill="#fbbf24" rx="0.5" />
        <rect x="36" y="28" width="2" height="6" fill="#fbbf24" rx="0.5" />
        <rect x="22" y="42" width="2" height="6" fill="#fbbf24" rx="0.5" />
        <rect x="36" y="42" width="2" height="6" fill="#fbbf24" rx="0.5" />
        {/* Thread connection collar at the top */}
        <rect x="20" y="4" width="20" height="6" fill="#1e293b" stroke="#000000" strokeWidth="0.5" rx="0.5" />
      </svg>
    );
  }

  // 17. Fallback dynamic image matcher
  const config = resolveTubingConfig(type || name || "", name);
  if (config.renderType === "image" && config.imageUrl) {
    const viewBox = config.viewBox || "0 0 300 220";
    const parts = viewBox.split(/\s+/).map((v) => parseFloat(v));
    const vbW = parts.length === 4 && !isNaN(parts[2]) ? parts[2] : 300;
    const vbH = parts.length === 4 && !isNaN(parts[3]) ? parts[3] : 220;
    return (
      <svg viewBox={viewBox} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <image href={config.imageUrl} x="0" y="0" width={vbW} height={vbH} />
      </svg>
    );
  }

  // Default fallback
  return (
    <svg viewBox="0 0 60 60" className="w-12 h-12 text-slate-400">
      <rect x="15" y="15" width="30" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M 30 20 L 30 30 M 30 35 L 30 37" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};

interface WellboreSchematicProps {
  well: WellData;
  onChange?: (updatedWell: WellData) => void;
}

export default function WellboreSchematic({ well, onChange }: WellboreSchematicProps) {
  const [scaleMode, setScaleMode] = useState<"compact" | "linear">("compact");
  const [zoom, setZoom] = useState<number>(1.0);
  const [isA4Open, setIsA4Open] = useState(() => {
    try {
      return (
        new URLSearchParams(window.location.search).get("print") === "true"
      );
    } catch {
      return false;
    }
  });

  const [savingToSupabase, setSavingToSupabase] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveStatusMsg, setSaveStatusMsg] = useState("");

  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleSaveToSupabase = async () => {
    setDialog({
      isOpen: true,
      title: "Confirmation d'Enregistrement",
      message: "IMPORTANT :\nSi vous enregistrez, ce folio sera sauvegardé définitivement et vous ne pourrez plus le modifier.\nÊtes-vous sûr de vouloir enregistrer ?",
      onConfirm: async () => {
        setDialog(null);
        setSavingToSupabase(true);
        setSaveStatus("idle");
        setSaveStatusMsg("");
        try {
          // Send unchanged well directly to the server; it will calculate the real next Folio N°.
          const wellToSave: WellData = {
            ...well,
            updatedDate: new Date().toISOString().slice(0, 10),
            updatedAt: new Date().toISOString()
          };

          let editedBy = "";
          try {
            const savedUser = localStorage.getItem("currentUser");
            if (savedUser) {
              const parsed = JSON.parse(savedUser);
              if (parsed) {
                editedBy = parsed.nom_prenom || parsed.matricule || "";
              }
            }
          } catch (e) {
            console.warn("Could not load current user from localStorage for save:", e);
          }

          const response = await fetch("/api/supabase/push-wells", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wells: [wellToSave],
              editedBy
            })
          });

          const result = await response.json();
          const serverResult = result.results?.[0];
          if (response.ok && result.success && serverResult?.success) {
            setSaveStatus("success");
            setSaveStatusMsg("✓ Saved to cloud!");
            if (onChange) {
              const realFolio = serverResult.folio || "00";
              const realFolioToCancel = serverResult.folioToCancel || "00";
              onChange({ ...wellToSave, folio: realFolio, folioToCancel: realFolioToCancel });
            }
          } else {
            setSaveStatus("error");
            setSaveStatusMsg(result.error || result.results?.[0]?.error || "✗ Save failed");
          }
        } catch (err) {
          setSaveStatus("error");
          setSaveStatusMsg("✗ Network error");
        } finally {
          setSavingToSupabase(false);
        }
      }
    });
  };

  // Clear success/error message after 4 seconds
  React.useEffect(() => {
    if (saveStatus !== "idle") {
      const timer = setTimeout(() => {
        setSaveStatus("idle");
        setSaveStatusMsg("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const [hoveredItem, setHoveredItem] = useState<{
    name: string;
    depth: string;
    type: string;
    grade?: string;
    weight?: string | number;
    connection?: string;
    od?: string;
    minId?: string;
    boreholeSize?: string | number;
    observations?: string;
    length?: number;
    qty?: string;
    customType?: string;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = document.getElementById("schematic_container");
    if (container) {
      const rect = container.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // SVG height and width settings
  const svgWidth = 700;
  const svgHeight = 1100;
  const xCenter = svgWidth / 2;
  const leftPadding = 120;
  const rightPadding = 120;

  // Full schematic + geometry layout (Rust WASM when available)
  const { schematic, layout } = useMemo(
    () => {
      try {
        return computeSchematicFull(well, 'interactive', scaleMode) || {};
      } catch (e) {
        console.error("Error computing schematic layout:", e);
        return {} as any;
      }
    },
    [well, scaleMode]
  );
  const { maxDepth = 0, keyAnchors = [], filteredTubings = [], computedTools = [] } = schematic || {};
  const { tbgBottomDepth = 0, tbgVisualYBottom = 0 } = layout || {};
  const globalYTF: number | null = (layout?.casings || []).reduce((minY: number | null, cd) => {
    if (cd.hasTF && cd.tfVal !== null && cd.yTF !== null) {
      return minY === null ? cd.yTF : Math.min(minY, cd.yTF);
    }
    return minY;
  }, null as number | null);

  const primaryShoeY: number | null = useMemo(() => {
    const shoeTools = computedTools.filter(
      (t) =>
        t.effectiveType.toLowerCase().includes('shoe') ||
        t.effectiveType.toLowerCase().includes('sabot') ||
        (t.name || '').toLowerCase().includes('shoe') ||
        (t.name || '').toLowerCase().includes('sabot')
    );
    if (shoeTools.length === 0) return null;
    return shoeTools.reduce((min, t) => (t.visualYTop < min ? t.visualYTop : min), shoeTools[0].visualYTop);
  }, [computedTools]);

  const maxTubingY: number | null = globalYTF !== null
    ? (primaryShoeY !== null ? Math.min(globalYTF, primaryShoeY) : globalYTF)
    : primaryShoeY;

  const rightLabelYByToolId = useMemo(() => {
    const map = new Map<string, number>();
    for (const lbl of layout?.rightLabels || []) {
      map.set(lbl.id, lbl.resolvedY);
    }
    return map;
  }, [layout?.rightLabels]);

  const completionBackbones = useMemo(() => {
    const isTubingLike = (t: string) => t === 'Tubing' || t === 'Tubing Court';
    const completion = computedTools
      .filter((t) => !isTubingLike(t.effectiveType))
      .filter((t) => primaryShoeY === null || (t.visualYTop ?? 0) <= primaryShoeY)
      .sort((a, b) => (a.bottomDepth || 0) - (b.bottomDepth || 0));
    const ranges: { yStart: number; yEnd: number }[] = [];
    let groupStart = 0;
    for (let i = 1; i <= completion.length; i++) {
      const breakCluster =
        i === completion.length ||
        (completion[i].bottomDepth || 0) - (completion[groupStart].bottomDepth || 0) >= 150;
      if (breakCluster) {
        const group = completion.slice(groupStart, i);
        if (group.length > 0) {
          const yStart = Math.min(...group.map((t) => t.visualYTop ?? 0));
          const rawYEnd = Math.max(...group.map((t) => t.visualYBottom ?? 0));
          const yEnd = primaryShoeY !== null ? Math.min(rawYEnd, primaryShoeY) : rawYEnd;
          if (yStart < yEnd) {
            ranges.push({ yStart, yEnd });
          }
        }
        groupStart = i;
      }
    }
    return ranges;
  }, [computedTools, primaryShoeY]);

  const renderTubingColumn = (yStart: number, yEnd: number, key: string) => {
    const segHeight = yEnd - yStart;
    if (segHeight <= 0) return null;
    return (
      <g key={key}>
        <rect x={xCenter - 7} y={yStart} width={14} height={segHeight} fill="#f8fafc" />
        <rect x={xCenter - 7} y={yStart} width={14} height={segHeight} fill="url(#tubing-pattern)" />
        <line x1={xCenter - 7} y1={yStart} x2={xCenter - 7} y2={yEnd} stroke="#0f172a" strokeWidth="1.5" />
        <line x1={xCenter + 7} y1={yStart} x2={xCenter + 7} y2={yEnd} stroke="#0f172a" strokeWidth="1.5" />
      </g>
    );
  };

  const mapDepthToYRaw = (depth: number | string): number => {
    return mapDepthToYRawCore(depth, scaleMode, maxDepth, keyAnchors, 40, 1050);
  };

  const mapDepthToY = (depth: number | string): number => {
    return mapDepthToYCore(
      depth,
      scaleMode,
      maxDepth,
      keyAnchors,
      40,
      1050,
      tbgBottomDepth,
      tbgVisualYBottom,
      svgHeight
    );
  };

  const casingsToDraw = (layout?.casings || []).map((cd, drawIndex) => {
    const casing = (well.casings || [])[cd.casingIndex];
    return {
      casing,
      index: drawIndex,
      casingR: cd.casingR,
      boreholeR: cd.boreholeR,
      yTop: cd.yTop,
      yShoe: cd.yShoe,
      yDrilled: cd.yDrilled,
      yTOC: cd.yToc,
      hasCement: cd.hasCement,
      tocVal: cd.tocVal,
      hasLiner: cd.hasLiner,
      tolVal: cd.tolVal,
      yTOL: cd.yTol,
      hasTF: cd.hasTF,
      tfVal: cd.tfVal,
      yTF: cd.yTF,
      blockY: cd.blockY,
      prevCasingR: cd.prevCasingR,
      prevShoeY: cd.prevShoeY,
      prevDrilledY: cd.prevDrilledY,
      prevBoreholeR: cd.prevBoreholeR,
    };
  });

  return (
    <div
      className="flex flex-col items-center bg-white rounded-xl shadow-lg border border-slate-100 p-2.5 sm:p-4 w-full max-w-full mx-auto h-full select-none relative overflow-hidden"
      id="schematic_container"
    >
      {/* Schematic Toolbar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full mb-3 pb-3 border-b border-slate-100"
        id="schematic_toolbar"
      >
        <div className="flex items-center justify-between w-full sm:w-auto">
          <span className="font-sans font-bold text-slate-800 text-xs flex items-center gap-1.5">
            Coupe Schématique du Puits
            <span className="text-[9px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-full font-medium">
              SVG
            </span>
          </span>
        </div>

        {/* Toggle Scale & Zoom buttons */}
        <div
          className="flex items-center gap-2 flex-wrap justify-between sm:justify-end w-full sm:w-auto"
          id="schematic_toolbar_actions"
        >
          <div
            className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-lg gap-0.5 sm:gap-1"
            id="scale_toggle_container"
          >
            <button
              id="scale_toggle_compact"
              onClick={() => setScaleMode("compact")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs rounded-md transition font-medium ${
                scaleMode === "compact"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Focus Scale: Compacts empty intervals, focuses on completion tools"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              Focus View
            </button>
            <button
              id="scale_toggle_linear"
              onClick={() => setScaleMode("linear")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs rounded-md transition font-medium ${
                scaleMode === "linear"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="True Scale: Spacing matches actual depths linearly"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              True Scale
            </button>
          </div>

          {/* Zoom controls */}
          <div
            className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-lg gap-0.5 sm:gap-1 shadow-inner"
            id="zoom_controls_container"
          >
            <button
              id="btn_zoom_out"
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="flex items-center justify-center w-7 h-7 text-xs rounded-md transition font-medium text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-40"
              title="Zoom Out"
              disabled={zoom <= 0.5}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-600 px-1.5 min-w-[38px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              id="btn_zoom_in"
              type="button"
              onClick={() => setZoom((z) => Math.min(3.0, z + 0.25))}
              className="flex items-center justify-center w-7 h-7 text-xs rounded-md transition font-medium text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-40"
              title="Zoom In"
              disabled={zoom >= 3.0}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {zoom !== 1.0 && (
              <button
                id="btn_zoom_reset"
                type="button"
                onClick={() => setZoom(1.0)}
                className="flex items-center justify-center px-1.5 sm:px-2 h-7 text-[10px] rounded-md transition font-bold text-indigo-600 hover:bg-white hover:text-indigo-800"
                title="Reset Zoom to 100%"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Tooltip Inside the Schematic Container */}
      <div
        className={`absolute z-40 pointer-events-none bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl p-3.5 min-w-[240px] max-w-[280px] transition-all duration-300 ease-out flex flex-col gap-3 ${
          hoveredItem ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"
        }`}
        style={{
          left: `${mousePos.x + 15}px`,
          top: `${mousePos.y + 15}px`,
        }}
        id="schematic_floating_tooltip"
      >
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-lg w-14 h-14 shrink-0 flex items-center justify-center relative overflow-hidden shadow-inner">
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              backgroundImage: "radial-gradient(circle, #38bdf8 1px, transparent 1px), linear-gradient(to right, rgba(56, 189, 248, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.1) 1px, transparent 1px)",
              backgroundSize: "100% 100%, 6px 6px, 6px 6px"
            }}></div>
            <div className="relative z-10 w-11 h-11 flex items-center justify-center">
              {renderRealToolGraphic(hoveredItem?.type, hoveredItem?.name)}
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-800 text-[13px] leading-tight truncate">
              {hoveredItem?.name || "Inspect Element"}
            </span>
            <span className="text-[8px] font-extrabold text-sky-600 uppercase tracking-widest mt-1 block">
              Device Blueprint
            </span>
          </div>
        </div>

        <div className="h-px w-full bg-slate-100"></div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
             <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Component Type</span>
             <p className="text-[11px] text-slate-600 font-semibold leading-snug capitalize">
               {hoveredItem?.type || "Hover over elements for details"}
             </p>
          </div>

          <div className="bg-sky-50/50 border border-sky-100 rounded-md px-2.5 py-1.5 flex items-center justify-between mt-0.5">
            <span className="text-[8px] font-bold text-sky-600 uppercase tracking-wider">Depth (MD)</span>
            <span className="text-xs font-mono font-bold text-sky-700">
              {hoveredItem?.depth || "-"}
            </span>
          </div>
        </div>

        {/* Technical Specifications Panel */}
        {(hoveredItem?.grade || hoveredItem?.weight || hoveredItem?.connection || hoveredItem?.od || hoveredItem?.minId || hoveredItem?.boreholeSize || hoveredItem?.observations) && (
          <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5 text-[10px]">
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Detailed Specifications</span>
            <div className="grid grid-cols-2 gap-1.5">
              {hoveredItem?.od && (
                <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                  <span className="text-[8px] text-slate-400 block font-bold leading-none mb-0.5">OUTER DIAM.</span>
                  <span className="font-bold text-slate-700 font-mono text-[11px]">{hoveredItem.od}</span>
                </div>
              )}
              {hoveredItem?.minId && (
                <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                  <span className="text-[8px] text-slate-400 block font-bold leading-none mb-0.5">INNER DIAM.</span>
                  <span className="font-bold text-slate-700 font-mono text-[11px]">{hoveredItem.minId}</span>
                </div>
              )}
              {hoveredItem?.grade && (
                <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                  <span className="text-[8px] text-slate-400 block font-bold leading-none mb-0.5">STEEL GRADE</span>
                  <span className="font-bold text-slate-700 font-mono text-[11px]">{hoveredItem.grade}</span>
                </div>
              )}
              {hoveredItem?.weight !== undefined && hoveredItem?.weight !== "" && (
                <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                  <span className="text-[8px] text-slate-400 block font-bold leading-none mb-0.5">UNIT WEIGHT</span>
                  <span className="font-bold text-slate-700 font-mono text-[11px]">
                    {hoveredItem.weight} {typeof hoveredItem.weight === 'number' || !isNaN(Number(hoveredItem.weight)) ? 'lbs/ft' : ''}
                  </span>
                </div>
              )}
              {hoveredItem?.connection && (
                <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                  <span className="text-[8px] text-slate-400 block font-bold leading-none mb-0.5">CONNECTION</span>
                  <span className="font-bold text-slate-700 font-mono text-[11px]">{hoveredItem.connection}</span>
                </div>
              )}
              {hoveredItem?.boreholeSize && (
                <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                  <span className="text-[8px] text-slate-400 block font-bold leading-none mb-0.5">DRILL HOLE Ø</span>
                  <span className="font-bold text-slate-700 font-mono text-[11px]">{hoveredItem.boreholeSize}"</span>
                </div>
              )}
            </div>
            {hoveredItem?.observations && (
              <div className="bg-slate-50 p-2 rounded border border-slate-100 text-left mt-0.5">
                <span className="text-[8px] text-slate-400 block font-bold mb-1">OBSERVATIONS</span>
                <span className="text-slate-600 leading-normal block text-[10px] italic font-medium">{hoveredItem.observations}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SVG Canvas Container */}
      <div
        className={`w-full max-w-full overflow-auto flex-1 bg-slate-50/50 rounded-xl border border-slate-100 p-2 sm:p-4 scrollbar-thin flex ${zoom > 1.0 ? "justify-start" : "justify-start lg:justify-center"}`}
        id="svg_scroll_container"
        onMouseMove={handleMouseMove}
      >
        <svg
          id="well_schematic_svg"
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="font-mono bg-white rounded shadow-sm border border-slate-200/50 shrink-0 transition-all duration-200 ease-out"
          style={{
            height: `${svgHeight * zoom}px`,
            width: `${svgWidth * zoom}px`,
            minWidth: `${svgWidth * zoom}px`
          }}
        >
          {/* DEFINITIONS FOR PATTERNS AND CLIPS */}
          <defs>
            {/* Coarse Gravel / Sand Pack pattern */}
            <pattern id="gravel-pack-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect width="20" height="20" fill="#e8d5aa" />
              <circle cx="4" cy="4" r="2.0" fill="#4a3b32" opacity="0.9" />
              <circle cx="15" cy="8" r="2.8" fill="#8c7355" opacity="0.9" />
              <circle cx="8" cy="16" r="1.8" fill="#3b2f27" opacity="0.9" />
              <circle cx="17" cy="18" r="2.2" fill="#5c4a3d" opacity="0.9" />
              <circle cx="2" cy="12" r="1.5" fill="#4a3b32" opacity="0.8" />
              <circle cx="11" cy="2" r="1.6" fill="#7a6345" opacity="0.8" />
              <circle cx="9" cy="9" r="1.0" fill="#3b2f27" opacity="0.7" />
            </pattern>
            {/* Continuous steel tubing joint pattern */}
            <pattern
              id="tubing-pattern"
              x="0"
              y="0"
              width="14"
              height="80"
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${xCenter - 7}, 0)`}
            >
              <image href="/img/tubing.svg" x="-43.55" y="0" width="116.66" height="80" preserveAspectRatio="none" />
            </pattern>

            {/* Cement / Gravel Hatching pattern */}
            <pattern
              id="cement-pattern"
              width="10"
              height="10"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="10" height="10" fill="#cbd5e1" />
            </pattern>

            {/* Mud / Formation dotted pattern */}
            <pattern
              id="mud-pattern"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill="#e2e8f0" />
              <circle cx="6" cy="6" r="1" fill="#cbd5e1" />
            </pattern>

            {/* Fine Hatch for Casing */}
            <pattern
              id="casing-shading"
              width="6"
              height="6"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="#94a3b8"
                strokeWidth="1"
                opacity="0.4"
              />
            </pattern>

            {/* Sand / Sandstone reservoir dotting hatch */}
            <pattern id="sand-gravel" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.7" fill="#000000" opacity="0.6" />
              <circle cx="6" cy="6" r="0.7" fill="#000000" opacity="0.4" />
              <line x1="1" y1="5" x2="3" y2="7" stroke="#000" strokeWidth="0.4" opacity="0.3" />
            </pattern>

            {/* Markers for casing label pointer arrows */}
            <marker id="arrow-right" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#000000" />
            </marker>
          </defs>

          {/* WELLBORE / FORMATION OUTLINE (Dotted Background representation) */}
          <rect
            x={xCenter - 60}
            y={40}
            width={120}
            height={svgHeight - 100}
            fill="url(#mud-pattern)"
            opacity="0.3"
          />

          {/* DYNAMIC FORMATION GEOLOGICAL BACKGROUND FOR EACH RESERVOIR */}
          {well.perforations && well.perforations.length > 0 && (() => {
            const groups: { [key: string]: typeof well.perforations } = {};
            well.perforations.forEach(p => {
              const res = (p.reservoir || well.reservoir || 'F6').trim();
              const key = res.toUpperCase();
              if (!groups[key]) {
                groups[key] = [];
              }
              groups[key].push(p);
            });

            const deepestCsg = well.casings && well.casings.length > 0
              ? well.casings.reduce((max, c) => ((c.shoeDepth || 0) > (max.shoeDepth || 0) ? c : max), well.casings[0])
              : null;

            return Object.entries(groups).map(([resName, perfs]) => {
              const minTopDepth = Math.min(...perfs.map(p => p.topDepth || 0));
              const maxBottomDepth = Math.max(...perfs.map(p => p.bottomDepth || 0));
              const yTop = mapDepthToY(minTopDepth);
              const yBot = mapDepthToY(maxBottomDepth);

              let yBotDotted = yBot + 35;
              if (deepestCsg) {
                const yCasingShoe = mapDepthToY(deepestCsg.shoeDepth || 0);
                if (yBotDotted >= yCasingShoe - 5) {
                  yBotDotted = yCasingShoe - 5;
                }
              }
              const rectHeight = yBotDotted - (yTop - 15);

              return (
                <g key={`sand-hatch-${resName}`}>
                  <rect x={15} y={yTop - 15} width={svgWidth - 30} height={rectHeight} fill="url(#sand-gravel)" opacity="0.12" />
                  <line x1={15} y1={yTop - 15} x2={svgWidth - 15} y2={yTop - 15} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.85" />
                  <line x1={15} y1={yBotDotted} x2={svgWidth - 15} y2={yBotDotted} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.85" />
                </g>
              );
            });
          })()}

          {/* Draw Casings & Cement (Outer elements first) */}
          {!well.isCasingsCleared &&
            (well.casings || []).length > 0 && (
              <g key="casings-group-interactive">
                {casingsToDraw.map((cd) => {
                    const {
                      casing,
                      index,
                      casingR,
                      boreholeR,
                      yTop,
                      yShoe,
                      yDrilled,
                      yTOC,
                      blockY,
                      hasCement,
                      tocVal,
                      hasLiner,
                      tolVal,
                      yTOL,
                      prevCasingR,
                      prevShoeY,
                      prevDrilledY,
                      prevBoreholeR,
                      hasTF,
                      tfVal,
                      yTF,
                    } = cd;

                    return (
                      <g key={casing.id || `casing-${index}`}>
                        {/* Borehole Delineation (dashed lines on the sides) */}
                        <line
                          x1={xCenter - boreholeR}
                          y1={prevDrilledY}
                          x2={xCenter - boreholeR}
                          y2={yDrilled}
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                          strokeDasharray="4,4"
                        />
                        <line
                          x1={xCenter + boreholeR}
                          y1={prevDrilledY}
                          x2={xCenter + boreholeR}
                          y2={yDrilled}
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                          strokeDasharray="4,4"
                        />

                        {/* Cement Fill Area */}
                        {yTOC !== null && (
                          <g
                            className="cursor-pointer group"
                            onMouseEnter={() =>
                              setHoveredItem({
                                name: `Cement (Casing ${formatCasingSize(casing.casingSize)})`,
                                depth: hasCement && tocVal !== null ? `${tocVal}m - ${casing.shoeDepth}m` : `Top - ${casing.shoeDepth}m`,
                                type: `Cement behind ${formatCasingSize(casing.casingSize)} Casing`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {/* Left Cement Column (Upper part inside previous casing) */}
                            {yTOC < prevShoeY && (
                              <rect
                                x={xCenter - Math.max(boreholeR, prevCasingR)}
                                y={yTOC}
                                width={Math.max(boreholeR, prevCasingR) - casingR}
                                height={Math.max(0, prevShoeY - yTOC)}
                                fill="url(#cement-pattern)"
                                className="transition-colors group-hover:fill-slate-200"
                              />
                            )}
                            {/* Left Cement Column (Middle part inside previous borehole pocket) */}
                            {yTOC < prevDrilledY && prevDrilledY > prevShoeY && (
                              <rect
                                x={xCenter - Math.max(boreholeR, prevBoreholeR)}
                                y={Math.max(yTOC, prevShoeY)}
                                width={Math.max(boreholeR, prevBoreholeR) - casingR}
                                height={Math.max(0, prevDrilledY - Math.max(yTOC, prevShoeY))}
                                fill="url(#cement-pattern)"
                                className="transition-colors group-hover:fill-slate-200"
                              />
                            )}
                            {/* Left Cement Column (Lower part inside current borehole) */}
                            {yShoe > Math.max(yTOC, prevDrilledY) && (
                              <rect
                                x={xCenter - boreholeR}
                                y={Math.max(yTOC, prevDrilledY)}
                                width={boreholeR - casingR}
                                height={yShoe - Math.max(yTOC, prevDrilledY)}
                                fill="url(#cement-pattern)"
                                className="transition-colors group-hover:fill-slate-200"
                              />
                            )}
                            
                            {/* Right Cement Column (Upper part inside previous casing) */}
                            {yTOC < prevShoeY && (
                              <rect
                                x={xCenter + casingR}
                                y={yTOC}
                                width={Math.max(boreholeR, prevCasingR) - casingR}
                                height={Math.max(0, prevShoeY - yTOC)}
                                fill="url(#cement-pattern)"
                                className="transition-colors group-hover:fill-slate-200"
                              />
                            )}
                            {/* Right Cement Column (Middle part inside previous borehole pocket) */}
                            {yTOC < prevDrilledY && prevDrilledY > prevShoeY && (
                              <rect
                                x={xCenter + casingR}
                                y={Math.max(yTOC, prevShoeY)}
                                width={Math.max(boreholeR, prevBoreholeR) - casingR}
                                height={Math.max(0, prevDrilledY - Math.max(yTOC, prevShoeY))}
                                fill="url(#cement-pattern)"
                                className="transition-colors group-hover:fill-slate-200"
                              />
                            )}
                            {/* Right Cement Column (Lower part inside current borehole) */}
                            {yShoe > Math.max(yTOC, prevDrilledY) && (
                              <rect
                                x={xCenter + casingR}
                                y={Math.max(yTOC, prevDrilledY)}
                                width={boreholeR - casingR}
                                height={yShoe - Math.max(yTOC, prevDrilledY)}
                                fill="url(#cement-pattern)"
                                className="transition-colors group-hover:fill-slate-200"
                              />
                            )}
                          </g>
                        )}

                        {/* TF - Top Fonde Cement Plug */}
                        {hasTF && tfVal !== null && yTF !== null && (
                          <g
                            className="cursor-pointer group"
                            onMouseEnter={() =>
                              setHoveredItem({
                                name: `TF Plug (${formatCasingSize(casing.casingSize)})`,
                                depth: `${tfVal}m - ${casing.drilledDepth}m`,
                                type: `Cement plug in ${formatCasingSize(casing.casingSize)} Casing & open hole`,
                              })
                            }
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {/* Cement plug inside the casing */}
                            <rect
                              x={xCenter - casingR}
                              y={yTF}
                              width={casingR * 2}
                              height={Math.max(0, yShoe - yTF)}
                              fill="url(#cement-pattern)"
                              className="transition-colors group-hover:fill-slate-200"
                            />
                            {/* Cement plug in the open hole pocket below the shoe */}
                            <path
                              d={`M ${xCenter - boreholeR} ${yShoe} L ${xCenter - boreholeR} ${yDrilled} Q ${xCenter} ${yDrilled + 6} ${xCenter + boreholeR} ${yDrilled} L ${xCenter + boreholeR} ${yShoe} Z`}
                              fill="url(#cement-pattern)"
                              className="transition-colors group-hover:fill-slate-200"
                            />
                            {/* Top plug border line */}
                            <line
                              x1={xCenter - casingR}
                              y1={yTF}
                              x2={xCenter + casingR}
                              y2={yTF}
                              stroke="#0f172a"
                              strokeWidth="1.5"
                            />
                          </g>
                        )}

                        {/* Casing Solid Metal Wall Lines */}
                        <g
                          className="cursor-pointer group hover:opacity-80 transition-opacity"
                          onMouseEnter={() =>
                            setHoveredItem({
                              name: casing.name || "Casing String",
                              depth: `${casing.topDepth || 0}m - ${casing.shoeDepth}m`,
                              type: "casing",
                              grade: casing.grade,
                              weight: casing.weight,
                              connection: casing.connection,
                              od: String(formatCasingSize(casing.casingSize)),
                              boreholeSize: casing.boreholeSize,
                              observations: casing.observations,
                            })
                          }
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          <line
                            x1={xCenter - casingR}
                            y1={yTop}
                            x2={xCenter - casingR}
                            y2={yShoe}
                            stroke="#334155"
                            strokeWidth="2.5"
                          />
                          <line
                            x1={xCenter + casingR}
                            y1={yTop}
                            x2={xCenter + casingR}
                            y2={yShoe}
                            stroke="#334155"
                            strokeWidth="2.5"
                          />
                          {/* Invisible hit box for easier hovering on thin lines */}
                          <rect
                            x={xCenter - casingR - 4}
                            y={yTop}
                            width={8}
                            height={yShoe - yTop}
                            fill="transparent"
                          />
                          <rect
                            x={xCenter + casingR - 4}
                            y={yTop}
                            width={8}
                            height={yShoe - yTop}
                            fill="transparent"
                          />
                        </g>

                        {/* Casing Shoe (Sabot) - Triangle representations */}
                        <g
                          className="cursor-pointer hover:opacity-75 transition-opacity"
                          onMouseEnter={() =>
                            setHoveredItem({
                              name: `Casing Shoe (Sabot)`,
                              depth: `${casing.shoeDepth}m`,
                              type: "shoe",
                              grade: casing.grade,
                              od: String(formatCasingSize(casing.casingSize)),
                            })
                          }
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          {/* Left Shoe Triangle */}
                          <polygon
                            points={`${xCenter - casingR},${yShoe} ${xCenter - casingR - 8},${yShoe} ${xCenter - casingR},${yShoe - 10}`}
                            fill="#000000"
                          />
                          {/* Right Shoe Triangle */}
                          <polygon
                            points={`${xCenter + casingR},${yShoe} ${xCenter + casingR + 8},${yShoe} ${xCenter + casingR},${yShoe - 10}`}
                            fill="#000000"
                          />
                          {/* Invisible hit box for Sabot */}
                          <rect
                            x={xCenter - casingR - 10}
                            y={yShoe - 15}
                            width={casingR * 2 + 20}
                            height={20}
                            fill="transparent"
                          />
                        </g>

                        {/* Liner Hanger (TOL) */}
                        {hasLiner && yTOL !== null && (() => {
                          const coveringCasings = (layout?.casings || []).filter(item => {
                            if (item.casingIndex === index) return false;
                            const top = well.casings[item.casingIndex]?.topDepth || 0;
                            const shoe = well.casings[item.casingIndex]?.shoeDepth || 0;
                            return tolVal !== null && tolVal >= top && tolVal <= shoe;
                          });
                          let hostR = casingR;
                          if (coveringCasings.length > 0) {
                            coveringCasings.sort((a, b) => a.casingR - b.casingR);
                            hostR = coveringCasings[0].casingR;
                          }

                          return (
                            <g
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onMouseEnter={() =>
                                setHoveredItem({
                                  name: `Liner Hanger (TOL) ${formatCasingSize(casing.casingSize)}`,
                                  depth: `${tolVal}m`,
                                  type: "Liner Hanger",
                                })
                              }
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              {/* Liner Hanger sitting precisely flush between host casing wall and liner wall */}
                              {(() => {
                                const hangerW = hostR > casingR ? (hostR - casingR) : 12;
                                return (
                                  <>
                                    <image
                                      href="/img/liner.svg"
                                      preserveAspectRatio="none"
                                      x={xCenter - hostR}
                                      y={yTOL}
                                      width={hangerW}
                                      height="16"
                                    />
                                    <image
                                      href="/img/liner.svg"
                                      preserveAspectRatio="none"
                                      x={xCenter + casingR}
                                      y={yTOL}
                                      width={hangerW}
                                      height="16"
                                    />
                                  </>
                                );
                              })()}
                            </g>
                          );
                        })()}

                        {/* Drilled pocket bottom (End of borehole below shoe) */}
                        <path
                          d={`M ${xCenter - boreholeR} ${yShoe} L ${xCenter - boreholeR} ${yDrilled} Q ${xCenter} ${yDrilled + 10} ${xCenter + boreholeR} ${yDrilled} L ${xCenter + boreholeR} ${yShoe}`}
                          fill="none"
                          stroke="#64748b"
                          strokeWidth="1.5"
                          strokeDasharray="3,3"
                        />
                      </g>
                    );
                  }
                )}

                {/* OPEN HOLE / EARTH HOLE (Trou Foré sans tubage - Wavy Earth Contour & 80% Coarse / 20% Fine Gravel Pack) */}
                {well.linerCrepineParams?.drilledToDepth !== undefined &&
                 well.linerCrepineParams?.drilledToDepth !== null &&
                 !isNaN(Number(well.linerCrepineParams.drilledToDepth)) && (() => {
                  const drilledDepth = Number(well.linerCrepineParams.drilledToDepth);
                  
                  // Find where open hole begins: previous host casing shoe or TOL
                  let openHoleTop = 0;
                  const tolVal = well.linerCrepineParams?.topOfLiner != null ? Number(well.linerCrepineParams.topOfLiner) : null;
                  const shoeVal = well.linerCrepineParams?.shoeDepth != null ? Number(well.linerCrepineParams.shoeDepth) : null;
                  if (layout?.casings && layout.casings.length > 0) {
                    const coveringCasings = layout.casings.filter(cd => {
                      const top = well.casings[cd.casingIndex]?.topDepth || 0;
                      const shoe = well.casings[cd.casingIndex]?.shoeDepth || 0;
                      return tolVal !== null ? (tolVal >= top && tolVal <= shoe) : true;
                    });
                    if (coveringCasings.length > 0) {
                      openHoleTop = Math.max(...coveringCasings.map(cd => well.casings[cd.casingIndex]?.shoeDepth || 0));
                    } else {
                      openHoleTop = tolVal !== null ? tolVal : 0;
                    }
                  } else if (well.linerCrepineParams?.topOfLiner != null) {
                    openHoleTop = Number(well.linerCrepineParams.topOfLiner);
                  }

                  const yOpenTop = mapDepthToY(openHoleTop);
                  const yOpenBot = mapDepthToY(drilledDepth);
                  const openHeight = yOpenBot - yOpenTop;
                  if (openHeight <= 0) return null;

                  const holeDiamStr = String(well.linerCrepineParams.holeDiameter || '8" 1/2');
                  const holeDiamNum = parseSizeToNumber(holeDiamStr) || 8.5;

                  let radiusFactor = 3.2;
                  if (layout?.casings && layout.casings.length > 0) {
                    const firstCsg = layout.casings[0];
                    const firstSize = parseSizeToNumber(well.casings[firstCsg.casingIndex]?.casingSize);
                    if (firstSize > 0) radiusFactor = firstCsg.casingR / firstSize;
                  }
                  const openHoleR = Math.max(16, Math.min(48, holeDiamNum * radiusFactor));

                  // Calculate inner liner casing radius to bound the annulus
                  const linerDiamStr = well.linerCrepineParams?.diameter || '6"';
                  const linerDiamNum = parseSizeToNumber(linerDiamStr) || 6;
                  let innerLinerR = Math.max(10, Math.min(36, linerDiamNum * radiusFactor));
                  if (innerLinerR >= openHoleR) innerLinerR = Math.max(8, openHoleR - 8);

                  const yShoe = shoeVal != null ? mapDepthToY(shoeVal) : yOpenBot;

                  // Deterministic wave function for natural non-straight rugged borehole wall
                  const getWaveL = (y: number) => {
                    const t = y * 0.08;
                    return Math.sin(t * 0.85) * 3.2 + Math.cos(t * 1.7) * 2.0 - Math.sin(t * 0.35) * 1.5;
                  };
                  const getWaveR = (y: number) => {
                    const t = y * 0.08;
                    return Math.cos(t * 0.8) * 3.2 - Math.sin(t * 1.6) * 2.0 + Math.cos(t * 0.4) * 1.5;
                  };

                  // Build smooth left and right undulating path points
                  const step = 6;
                  const leftPoints: { x: number; y: number }[] = [];
                  for (let y = yOpenTop; y <= yOpenBot; y += step) {
                    leftPoints.push({ x: xCenter - openHoleR + getWaveL(y), y });
                  }
                  if (leftPoints[leftPoints.length - 1].y < yOpenBot) {
                    leftPoints.push({ x: xCenter - openHoleR + getWaveL(yOpenBot), y: yOpenBot });
                  }

                  const rightPoints: { x: number; y: number }[] = [];
                  for (let y = yOpenTop; y <= yOpenBot; y += step) {
                    rightPoints.push({ x: xCenter + openHoleR + getWaveR(y), y });
                  }
                  if (rightPoints[rightPoints.length - 1].y < yOpenBot) {
                    rightPoints.push({ x: xCenter + openHoleR + getWaveR(yOpenBot), y: yOpenBot });
                  }

                  const dLeft = leftPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
                  const dRight = rightPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

                  // Closed pocket path for background with inner cutout for liner casing
                  const rightReversed = [...rightPoints].reverse();
                  const closedPath = `${dLeft} Q ${xCenter} ${yOpenBot + 9} ${rightPoints[rightPoints.length - 1].x.toFixed(2)} ${yOpenBot} ` +
                    rightReversed.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
                    ` Z ` +
                    `M ${xCenter - innerLinerR} ${yOpenTop} ` +
                    `L ${xCenter + innerLinerR} ${yOpenTop} ` +
                    `L ${xCenter + innerLinerR} ${yShoe} ` +
                    `L ${xCenter - innerLinerR} ${yShoe} ` +
                    `Z`;

                  return (
                    <g
                      key="schematic-open-hole-earth-group"
                      className="cursor-pointer group"
                      onMouseEnter={() =>
                        setHoveredItem({
                          name: `Trou Foré (Open Hole) Ø ${holeDiamStr}`,
                          depth: `${openHoleTop}m - ${drilledDepth}m (${(drilledDepth - openHoleTop).toFixed(2)}m)`,
                          type: "Open Hole / Trou non tubé (Earth hole + Massif Gravier)",
                          od: holeDiamStr,
                          observations: well.linerCrepineParams?.observations || "Massif filtrant: 80% gravier gros / 20% gravier fin"
                        })
                      }
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      {/* Earth formation background */}
                      <path
                        d={closedPath}
                        fill="url(#gravel-pack-pattern)"
                        fillRule="evenodd"
                      />

                      {/* Geological Formation Cut Outward Rock Hatching (left & right rock wall) */}
                      <g key="rock-cut-hatching" stroke="#64748b" strokeWidth="1" strokeLinecap="round" opacity="0.65">
                        {leftPoints.filter((_, idx) => idx % 2 === 0).map((p, idx) => (
                          <line
                            key={`hatch-l-${idx}`}
                            x1={p.x}
                            y1={p.y}
                            x2={p.x - 5}
                            y2={p.y - 3}
                          />
                        ))}
                        {rightPoints.filter((_, idx) => idx % 2 === 0).map((p, idx) => (
                          <line
                            key={`hatch-r-${idx}`}
                            x1={p.x}
                            y1={p.y}
                            x2={p.x + 5}
                            y2={p.y - 3}
                          />
                        ))}
                        {/* Bottom rock cut hatches */}
                        <line
                          x1={xCenter - 10}
                          y1={yOpenBot + 5}
                          x2={xCenter - 10}
                          y2={yOpenBot + 10}
                        />
                        <line
                          x1={xCenter}
                          y1={yOpenBot + 7}
                          x2={xCenter}
                          y2={yOpenBot + 12}
                        />
                        <line
                          x1={xCenter + 10}
                          y1={yOpenBot + 5}
                          x2={xCenter + 10}
                          y2={yOpenBot + 10}
                        />
                      </g>

                      {/* Real Rock Hole Cut - Left rugged formation wall */}
                      <path
                        d={dLeft}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Real Rock Hole Cut - Right rugged formation wall */}
                      <path
                        d={dRight}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Real Rock Hole Cut - Bottom TD formation pocket */}
                      <path
                        d={`M ${leftPoints[leftPoints.length - 1].x.toFixed(2)} ${yOpenBot} Q ${xCenter} ${yOpenBot + 8} ${rightPoints[rightPoints.length - 1].x.toFixed(2)} ${yOpenBot}`}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })()}

                {/* DEDICATED LINER CRÉPINE CASING STRING (TOL to Sabot Crépine) */}
                {well.linerCrepineParams?.topOfLiner !== undefined &&
                 well.linerCrepineParams?.topOfLiner !== null &&
                 well.linerCrepineParams?.shoeDepth !== undefined &&
                 well.linerCrepineParams?.shoeDepth !== null &&
                 Number(well.linerCrepineParams.shoeDepth) > Number(well.linerCrepineParams.topOfLiner) && (() => {
                  const tolDepth = Number(well.linerCrepineParams.topOfLiner);
                  const shoeDepth = Number(well.linerCrepineParams.shoeDepth);
                  const yTol = mapDepthToY(tolDepth);
                  const yShoe = mapDepthToY(shoeDepth);
                  const height = yShoe - yTol;
                  if (height <= 0) return null;

                  const diamStr = well.linerCrepineParams.diameter || '6"';
                  const diamNum = parseSizeToNumber(diamStr) || 6;
                  
                  let radiusFactor = 3.2;
                  if (layout?.casings && layout.casings.length > 0) {
                    const firstCsg = layout.casings[0];
                    const firstSize = parseSizeToNumber(well.casings[firstCsg.casingIndex]?.casingSize);
                    if (firstSize > 0) radiusFactor = firstCsg.casingR / firstSize;
                  }
                  let linerR = Math.max(10, Math.min(36, diamNum * radiusFactor));
                  let hostCsgR: number | null = null;
                  if (layout?.casings && layout.casings.length > 0) {
                    const coveringCasings = layout.casings.filter(cd => {
                      const top = well.casings[cd.casingIndex]?.topDepth || 0;
                      const shoe = well.casings[cd.casingIndex]?.shoeDepth || 0;
                      return tolDepth >= top && tolDepth <= shoe;
                    });
                    if (coveringCasings.length > 0) {
                      const minCoverR = Math.min(...coveringCasings.map(c => c.casingR));
                      hostCsgR = minCoverR;
                      if (linerR >= minCoverR) linerR = Math.max(8, minCoverR - 6);
                    }
                  }

                  const anchorR = hostCsgR !== null ? hostCsgR : linerR + 6;

                  return (
                    <g key="schematic-liner-crepine-casing-group">
                      {/* Casing Solid Metal Wall Lines for Liner */}
                      <g
                        className="cursor-pointer group hover:opacity-80 transition-opacity"
                        onMouseEnter={() =>
                          setHoveredItem({
                            name: `Liner Crépine Casing ${diamStr}`,
                            depth: `${tolDepth}m - ${shoeDepth}m (${(shoeDepth - tolDepth).toFixed(2)}m)`,
                            type: "Liner Casing",
                            od: diamStr,
                            observations: well.linerCrepineParams?.observations
                          })
                        }
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <line
                          x1={xCenter - linerR}
                          y1={yTol}
                          x2={xCenter - linerR}
                          y2={yShoe}
                          stroke="#1e293b"
                          strokeWidth="2.5"
                        />
                        <line
                          x1={xCenter + linerR}
                          y1={yTol}
                          x2={xCenter + linerR}
                          y2={yShoe}
                          stroke="#1e293b"
                          strokeWidth="2.5"
                        />
                        {/* Invisible hit box */}
                        <rect
                          x={xCenter - linerR - 4}
                          y={yTol}
                          width={8}
                          height={height}
                          fill="transparent"
                        />
                        <rect
                          x={xCenter + linerR - 4}
                          y={yTol}
                          width={8}
                          height={height}
                          fill="transparent"
                        />
                      </g>

                      {/* Liner Hanger (TOL) at yTol - Connected directly to host casing wall */}
                      <g
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onMouseEnter={() =>
                          setHoveredItem({
                            name: `Liner Hanger (TOL) ${diamStr}`,
                            depth: `${tolDepth}m`,
                            type: "Liner Hanger (TOL)",
                            od: diamStr,
                          })
                        }
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        {/* Liner Hanger slips spanning precisely between host casing wall and liner casing */}
                        {(() => {
                          const hangerW = anchorR > linerR ? (anchorR - linerR) : 12;
                          return (
                            <>
                              <image
                                href="/img/liner.svg"
                                preserveAspectRatio="none"
                                x={xCenter - anchorR}
                                y={yTol}
                                width={hangerW}
                                height="16"
                              />
                              <image
                                href="/img/liner.svg"
                                preserveAspectRatio="none"
                                x={xCenter + linerR}
                                y={yTol}
                                width={hangerW}
                                height="16"
                              />
                            </>
                          );
                        })()}
                      </g>

                      {/* Sabot Liner Crépine (Shoe Triangles) at yShoe */}
                      <g
                        className="cursor-pointer hover:opacity-75 transition-opacity"
                        onMouseEnter={() =>
                          setHoveredItem({
                            name: `Sabot Liner Crépine (Shoe)`,
                            depth: `${shoeDepth}m`,
                            type: "Sabot Crépine",
                            od: diamStr
                          })
                        }
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <polygon
                          points={`${xCenter - linerR},${yShoe} ${xCenter - linerR - 8},${yShoe} ${xCenter - linerR},${yShoe - 10}`}
                          fill="#000000"
                        />
                        <polygon
                          points={`${xCenter + linerR},${yShoe} ${xCenter + linerR + 8},${yShoe} ${xCenter + linerR},${yShoe - 10}`}
                          fill="#000000"
                        />
                      </g>
                    </g>
                  );
                })()}

                {/* RENDER THE UNIFIED RESOLVED LEFT LABELS FOR INTERACTIVE CANVAS */}
                {(layout?.leftLabels || []).map((lbl, idx) => {
                    const textX = 40;
                    const labelEndX = 130;
                    const elbowX = labelEndX + 20;

                    return (
                      <g key={`interactive-left-lbl-${idx}`}>
                        <text 
                          x={textX} 
                          y={lbl.resolvedY + 3.5} 
                          fontSize="9" 
                          fontWeight="bold" 
                          className="font-sans cursor-pointer hover:fill-indigo-600 transition-colors" 
                          fill="#334155"
                          textAnchor="start"
                          onMouseEnter={() =>
                            setHoveredItem({
                              name: lbl.text,
                              depth: lbl.depthStr,
                              type: lbl.labelType,
                            })
                          }
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          {lbl.text}
                        </text>

                        <path
                          d={`M ${labelEndX} ${lbl.resolvedY} L ${elbowX} ${lbl.resolvedY} L ${lbl.targetX} ${lbl.targetY}`}
                          fill="none"
                          stroke="#64748b"
                          strokeWidth="0.8"
                          markerEnd="url(#arrow-right)"
                          className="cursor-pointer hover:stroke-indigo-600 transition-colors"
                          onMouseEnter={() =>
                            setHoveredItem({
                              name: lbl.text,
                              depth: lbl.depthStr,
                              type: lbl.labelType,
                            })
                          }
                          onMouseLeave={() => setHoveredItem(null)}
                        />
                      </g>
                    );
                  })}
              </g>
            )}

          {/* CEMENT PLUGS (B.C — Bouchon de Ciment) */}
          {(well.cementPlugs || []).map((cp: CementPlug, cpIdx: number) => {
            const yTop = mapDepthToY(cp.topDepth);
            const yBot = mapDepthToY(cp.bottomDepth);
            const plugHeight = Math.max(0, yBot - yTop);
            if (plugHeight <= 0) return null;
            const plugMidDepth = (cp.topDepth + cp.bottomDepth) / 2;
            const plugCasingR = activeCasingRadius(well, layout?.casings || [], plugMidDepth);
            const labelLineX = xCenter + plugCasingR + 4;
            const labelTextX = labelLineX + 20;

            return (
              <g
                key={cp.id || `bc-${cpIdx}`}
                className="cursor-pointer group"
                onMouseEnter={() =>
                  setHoveredItem({
                    name: `B.C — Bouchon de Ciment`,
                    depth: `Top ciment: ${cp.topDepth}m — B.C: ${cp.bottomDepth}m`,
                    type: 'Cement Plug',
                  })
                }
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Cement plug fill */}
                <rect
                  x={xCenter - plugCasingR}
                  y={yTop}
                  width={plugCasingR * 2}
                  height={plugHeight}
                  fill="url(#cement-pattern)"
                  stroke="#94a3b8"
                  strokeWidth="0.75"
                  opacity="0.92"
                  className="transition-opacity group-hover:opacity-70"
                />

                {/* Top ciment label — placed ABOVE the line to avoid overlap */}
                <line x1={labelLineX} y1={yTop} x2={labelLineX + 16} y2={yTop} stroke="#475569" strokeWidth="1.2" />
                <rect x={labelTextX - 2} y={yTop - 16} width={120} height={14} fill="white" opacity="0.85" rx="2" />
                <text
                  x={labelTextX}
                  y={yTop - 5}
                  fontSize="11"
                  fill="#1e293b"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  Top ciment à {cp.topDepth}m
                </text>

                {/* B.C bottom label — placed BELOW the bottom line */}
                <line x1={labelLineX} y1={yBot} x2={labelLineX + 16} y2={yBot} stroke="#475569" strokeWidth="1.2" />
                <rect x={labelTextX - 2} y={yBot + 3} width={100} height={14} fill="white" opacity="0.85" rx="2" />
                <text
                  x={labelTextX}
                  y={yBot + 13}
                  fontSize="11"
                  fill="#1e293b"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  B.C à {cp.bottomDepth}m
                </text>
              </g>
            );
          })}

          {/* PERFORATIONS (Grouped by Reservoir & Status) */}
          {well.perforations && well.perforations.length > 0 && (() => {
            const groupsMap = new Map<string, typeof well.perforations>();
            well.perforations.forEach(p => {
              const res = p.reservoir || well.reservoir || '';
              const key = `${res}_${p.isSqueezed ? 'sqz' : 'act'}`;
              if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
              }
              groupsMap.get(key)!.push(p);
            });

            return Array.from(groupsMap.entries()).map(([key, groupPerfs], gIdx) => {
              const isSqueezed = !!groupPerfs[0]?.isSqueezed;
              const resName = groupPerfs[0]?.reservoir || well.reservoir || '';
              const topD = Math.min(...groupPerfs.map(p => Math.min(p.topDepth || 0, p.bottomDepth || 0)));
              const bottomD = Math.max(...groupPerfs.map(p => Math.max(p.topDepth || 0, p.bottomDepth || 0)));
              const yTop = mapDepthToY(topD);
              const yBottom = mapDepthToY(bottomD);
              const height = Math.max(0, yBottom - yTop);
              const span = bottomD - topD;

              const perfMidDepth = (topD + bottomD) / 2;
              const perfCasingR = activeCasingRadius(well, layout?.casings || [], perfMidDepth);
              const arrowOuter = perfCasingR + 22;
              const arrowTip = arrowOuter + 5;

              const textRes = resName ? ` ${resName}` : '';

              const shotsCount = 3;
              const perfRows: number[] = [];
              for (let k = 0; k < shotsCount; k++) {
                const depth = topD + (span * (k + 0.5)) / shotsCount;
                perfRows.push(mapDepthToY(depth));
              }

              const conicFill = isSqueezed ? '#475569' : '#c41230';
              const conicStroke = isSqueezed ? '#0f172a' : '#7f0020';
              const bgFill = isSqueezed ? '#94a3b8' : '#fecdd3';
              const textColor = isSqueezed ? '#1e293b' : '#be123c';
              const bracketColor = isSqueezed ? '#334155' : '#c41230';

              return (
                <g
                  key={`perf-group-${gIdx}`}
                  className="cursor-pointer group hover:opacity-80 transition-opacity"
                  onMouseEnter={() =>
                    setHoveredItem({
                      name: isSqueezed ? `Zone Perforée Squeezée${textRes}` : `Zone Perforée${textRes}`,
                      depth: `${topD}m - ${bottomD}m`,
                      type: isSqueezed ? "Squeezed Perforations (Cimentation)" : "Reservoir Perforations",
                    })
                  }
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Perforation formation side highlights — strictly outside casing */}
                  {/* RED ARROWS: Cement block behind casing for squeezed perforations */}
                  <rect
                    x={xCenter - arrowOuter}
                    y={yTop}
                    width={arrowOuter - perfCasingR}
                    height={height || 4}
                    fill={isSqueezed ? "#94a3b8" : bgFill}
                    stroke={isSqueezed ? "#475569" : "none"}
                    strokeWidth={isSqueezed ? "0.8" : "0"}
                    strokeDasharray={isSqueezed ? "2,2" : "none"}
                    opacity={isSqueezed ? "0.4" : "0.25"}
                    className="transition-opacity group-hover:opacity-50"
                  />
                  <rect
                    x={xCenter + perfCasingR}
                    y={yTop}
                    width={arrowOuter - perfCasingR}
                    height={height || 4}
                    fill={isSqueezed ? "#94a3b8" : bgFill}
                    stroke={isSqueezed ? "#475569" : "none"}
                    strokeWidth={isSqueezed ? "0.8" : "0"}
                    strokeDasharray={isSqueezed ? "2,2" : "none"}
                    opacity={isSqueezed ? "0.4" : "0.25"}
                    className="transition-opacity group-hover:opacity-50"
                  />

                  {/* RED ARROWS ZONE: Squeezed cement diagonal hatch texture in formation */}
                  {isSqueezed && (
                    <g opacity="0.35">
                      <line x1={xCenter - arrowOuter + 2} y1={yTop + 2} x2={xCenter - perfCasingR - 2} y2={yBottom - 2} stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />
                      <line x1={xCenter + perfCasingR + 2} y1={yTop + 2} x2={xCenter + arrowOuter - 2} y2={yBottom - 2} stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3,3" />
                    </g>
                  )}

                  {/* Perforation conic jets distributed precisely across this zone's meter depth */}
                  {perfRows.map((yVal, i) => {
                    return (
                      <g key={i}>
                        {isSqueezed ? (
                          <>
                            {/* GREEN ARROWS: Dark gray square plug in casing cement sheath */}
                            <rect
                              x={xCenter - arrowOuter}
                              y={yVal - 3.5}
                              width={arrowOuter - perfCasingR}
                              height={7}
                              fill="#1e293b"
                              stroke="#0f172a"
                              strokeWidth="0.8"
                              rx="0.5"
                            />
                            {/* Left Squeezed Cone — Starts at end of casing cement */}
                            <polygon
                              points={`${xCenter - arrowOuter},${yVal - 5} ${xCenter - arrowOuter},${yVal + 5} ${xCenter - (arrowOuter + 10)},${yVal}`}
                              fill="#475569"
                              stroke="#0f172a"
                              strokeWidth="1.2"
                              strokeLinejoin="round"
                            />
                            {/* White cement hatch lines inside left cone */}
                            <line x1={xCenter - arrowOuter - 2} y1={yVal - 3} x2={xCenter - arrowOuter - 6} y2={yVal + 1.5} stroke="#ffffff" strokeWidth="1" />
                            <line x1={xCenter - arrowOuter - 5} y1={yVal - 2} x2={xCenter - arrowOuter - 8} y2={yVal + 0.5} stroke="#ffffff" strokeWidth="1" />

                            {/* GREEN ARROWS: Dark gray square plug in casing cement sheath */}
                            <rect
                              x={xCenter + perfCasingR}
                              y={yVal - 3.5}
                              width={arrowOuter - perfCasingR}
                              height={7}
                              fill="#1e293b"
                              stroke="#0f172a"
                              strokeWidth="0.8"
                              rx="0.5"
                            />
                            {/* Right Squeezed Cone — Starts at end of casing cement */}
                            <polygon
                              points={`${xCenter + arrowOuter},${yVal - 5} ${xCenter + arrowOuter},${yVal + 5} ${xCenter + (arrowOuter + 10)},${yVal}`}
                              fill="#475569"
                              stroke="#0f172a"
                              strokeWidth="1.2"
                              strokeLinejoin="round"
                            />
                            {/* White cement hatch lines inside right cone */}
                            <line x1={xCenter + arrowOuter + 2} y1={yVal - 3} x2={xCenter + arrowOuter + 6} y2={yVal + 1.5} stroke="#ffffff" strokeWidth="1" />
                            <line x1={xCenter + arrowOuter + 5} y1={yVal - 2} x2={xCenter + arrowOuter + 8} y2={yVal + 0.5} stroke="#ffffff" strokeWidth="1" />
                          </>
                        ) : (
                          <>
                            {/* ACTIVE DESIGN: Clean red conic jet */}
                            <polygon
                              points={`${xCenter - perfCasingR},${yVal - 5} ${xCenter - perfCasingR},${yVal + 5} ${xCenter - arrowTip},${yVal}`}
                              fill={conicFill}
                              stroke={conicStroke}
                              strokeWidth="0.8"
                              strokeLinejoin="round"
                            />
                            <polygon
                              points={`${xCenter + perfCasingR},${yVal - 5} ${xCenter + perfCasingR},${yVal + 5} ${xCenter + arrowTip},${yVal}`}
                              fill={conicFill}
                              stroke={conicStroke}
                              strokeWidth="0.8"
                              strokeLinejoin="round"
                            />
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* Annotation bracket: from arrow tip to label */}
                  <line x1={xCenter + arrowTip + 3} y1={yTop}    x2={xCenter + arrowTip + 28} y2={yTop}    stroke={bracketColor} strokeWidth="1.2" />
                  <line x1={xCenter + arrowTip + 3} y1={yBottom} x2={xCenter + arrowTip + 28} y2={yBottom} stroke={bracketColor} strokeWidth="1.2" />
                  <line x1={xCenter + arrowTip + 28} y1={yTop}   x2={xCenter + arrowTip + 28} y2={yBottom} stroke={bracketColor} strokeWidth="1" />
                  <text x={xCenter + arrowTip + 33} y={(yTop + yBottom) / 2 - 2} fontSize="10" fill={textColor} fontWeight="bold">
                    {isSqueezed ? 'PRF (SQZ):' : 'PRF:'}
                  </text>
                  <text x={xCenter + arrowTip + 33} y={(yTop + yBottom) / 2 + 10} fontSize="10" fill={textColor} fontWeight="bold">
                    {topD} - {bottomD}m{textRes}
                  </text>
                </g>
              );
            });
          })()}

          {/* LINER CRÉPINE (Screens / Slotted Intervals - Unified Single String) */}
          {(() => {
            const validCrepines = (well.linerCrepines || []).filter(
              (lc) => (lc.topDepth !== undefined && lc.topDepth !== null && lc.topDepth > 0) ||
                      (lc.bottomDepth !== undefined && lc.bottomDepth !== null && lc.bottomDepth > 0)
            );
            if (validCrepines.length === 0) return null;

            const topD = Math.min(...validCrepines.map((lc) => lc.topDepth || 0));
            const botD = Math.max(...validCrepines.map((lc) => lc.bottomDepth || 0));
            const yTop = mapDepthToY(topD);
            const yBot = mapDepthToY(botD);
            const height = Math.max(0, yBot - yTop);
            if (height <= 0) return null;

            const midDepth = (topD + botD) / 2;
            const casingR = activeCasingRadius(well, layout?.casings || [], midDepth);
            const screenR = Math.max(8, casingR - 1);
            const arrowTip = screenR + 26;
            const svgWidth = screenR * 2;
            const svgX = xCenter - screenR;

            return (
              <g
                key="schematic-liner-crepine-unified"
                className="cursor-pointer group hover:opacity-80 transition-opacity"
                onMouseEnter={() =>
                  setHoveredItem({
                    name: `Liner Crépine`,
                    depth: `De ${topD}m - A ${botD}m`,
                    type: "Liner Screen / Crépine",
                    od: well.linerCrepineParams?.diameter || '',
                    observations: `Total zones: ${validCrepines.length}`
                  })
                }
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Crépine SVG Asset (Continuous string) */}
                <image
                  href="/img/crépines.svg"
                  x={svgX}
                  y={yTop}
                  width={svgWidth}
                  height={height}
                  preserveAspectRatio="none"
                  className="transition-opacity group-hover:opacity-85"
                />

                {/* Annotation bracket: from screen to label */}
                <line x1={xCenter + screenR + 3} y1={yTop} x2={xCenter + arrowTip} y2={yTop} stroke="#0284c7" strokeWidth="1.2" />
                <line x1={xCenter + screenR + 3} y1={yBot} x2={xCenter + arrowTip} y2={yBot} stroke="#0284c7" strokeWidth="1.2" />
                <line x1={xCenter + arrowTip} y1={yTop} x2={xCenter + arrowTip} y2={yBot} stroke="#0284c7" strokeWidth="1" />
                <text x={xCenter + arrowTip + 4} y={(yTop + yBot) / 2 - 2} fontSize="9.5" fill="#0369a1" fontWeight="bold">
                  CRÉPINE:
                </text>
                <text x={xCenter + arrowTip + 4} y={(yTop + yBot) / 2 + 9} fontSize="9" fill="#0284c7" fontWeight="bold">
                  De {topD} - A {botD}
                </text>
              </g>
            );
          })()}

          {/* INNER TUBING STRING (Double central line) */}
          {(well.tubings || []).some(tool => tool.name) && (
              <g
                className="cursor-pointer group hover:opacity-80 transition-opacity"
                onMouseEnter={() => {
                  const mainTubings = (well.tubings || []).filter(t => t.type === "Tubing" || !t.type);
                  const firstTubing = mainTubings[0];
                  setHoveredItem({
                    name: `Production Tubing String`,
                    depth: `0m - ${((well.tubings || []).filter(t => t.name).length > 0 ? Math.max(...(well.tubings || []).filter(t => t.name).map((t) => typeof t.bottomDepth === "string" ? parseFloat(t.bottomDepth || "0") : (t.bottomDepth || 0)).filter(v => !isNaN(v))) : 0)}m`,
                    type: `tubing`,
                    od: firstTubing?.od || "2''7/8",
                    length: firstTubing?.length,
                    observations: firstTubing?.observations,
                    minId: firstTubing?.minId,
                  });
                }}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {(layout?.tubingSegments || []).map((seg, sIdx) => {
                  if (maxTubingY !== null && seg.yStart >= maxTubingY) return null;
                  const effectiveYEnd = maxTubingY !== null ? Math.min(seg.yEnd, maxTubingY) : seg.yEnd;
                  const segHeight = effectiveYEnd - seg.yStart;
                  if (segHeight <= 0) return null;
                  return (
                    <g key={`tbg-seg-${sIdx}`}>
                      {/* Draw tubing background (empty fluid inside) */}
                      <rect
                        x={xCenter - 7}
                        y={seg.yStart}
                        width={14}
                        height={segHeight}
                        fill="#f8fafc"
                        className="group-hover:fill-sky-50 transition-colors"
                      />

                      {/* Realistic repeating tubing joints pattern */}
                      <rect
                        x={xCenter - 7}
                        y={seg.yStart}
                        width={14}
                        height={segHeight}
                        fill="url(#tubing-pattern)"
                      />

                      {/* Left and Right tubing walls */}
                      <line
                        x1={xCenter - 7}
                        y1={seg.yStart}
                        x2={xCenter - 7}
                        y2={effectiveYEnd}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                      <line
                        x1={xCenter + 7}
                        y1={seg.yStart}
                        x2={xCenter + 7}
                        y2={effectiveYEnd}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </g>
          )}

          {/* SRP ROD STRING (Central Sucker Rods & Pump inside Tubing) */}
          {(well.srpComponents || []).length > 0 && (
            <g
              className="cursor-pointer group hover:opacity-90 transition-opacity"
              onMouseEnter={() => {
                const firstSrp = (well.srpComponents || [])[0];
                const totalLen = (well.srpComponents || []).reduce((sum, s) => sum + (s.length || 0), 0);
                setHoveredItem({
                  name: `Sucker Rod Pump String (SRP)`,
                  depth: `0m - ${totalLen.toFixed(2)}m`,
                  type: `srp`,
                  od: firstSrp?.od || "3/4''",
                  length: totalLen,
                  observations: `Composants SRP (${(well.srpComponents || []).length})`,
                });
              }}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Central polished rod / sucker rod line */}
              <line
                x1={xCenter}
                y1={layout?.yStart || 40}
                x2={xCenter}
                y2={layout?.yEnd ? layout.yEnd * 0.82 : 820}
                stroke="#d97706"
                strokeWidth="2.5"
                strokeDasharray="6 2"
              />
              {/* Top Polished Rod Head */}
              <rect
                x={xCenter - 4}
                y={(layout?.yStart || 40) - 8}
                width={8}
                height={12}
                fill="#b45309"
                rx={1}
              />
              {/* Bottom Pump (Pompe SRP) */}
              <g transform={`translate(${xCenter - 5}, ${(layout?.yEnd ? layout.yEnd * 0.82 : 820) - 12})`}>
                <rect width={10} height={24} fill="#d97706" stroke="#78350f" strokeWidth={1} rx={2} />
                <line x1={2} y1={6} x2={8} y2={6} stroke="#ffffff" strokeWidth={1} />
                <line x1={2} y1={12} x2={8} y2={12} stroke="#ffffff" strokeWidth={1} />
                <line x1={2} y1={18} x2={8} y2={18} stroke="#ffffff" strokeWidth={1} />
              </g>
            </g>
          )}

          {completionBackbones.map((range, idx) => {
            if (maxTubingY !== null && range.yStart >= maxTubingY) return null;
            const effectiveYEnd = maxTubingY !== null ? Math.min(range.yEnd, maxTubingY) : range.yEnd;
            const height = effectiveYEnd - range.yStart;
            if (height <= 0) return null;
            return renderTubingColumn(range.yStart, effectiveYEnd, `completion-backbone-${idx}`);
          })}

          {/* TUBING STRING COMPONENTS (Packers, Side pocket mandrels, Reduction, Shoes) */}
          {computedTools.map((tool, toolIdx) => {
            const yTop = tool.visualYTop ?? (tool as { visual_y_top?: number }).visual_y_top ?? 0;
            if (globalYTF !== null && yTop >= globalYTF) return null;
            const yBottom = tool.visualYBottom ?? (tool as { visual_y_bottom?: number }).visual_y_bottom ?? yTop;
            const height = Math.max(0, tool.visualHeight ?? (tool as { visual_height?: number }).visual_height ?? (yBottom - yTop));
            const effectiveType = tool.effectiveType;

            // Dynamically calculate the active inner casing radius at this tool's depth
            const toolDepth = typeof tool.bottomDepth === "string" ? parseFloat(tool.bottomDepth || "0") : (tool.bottomDepth || 0);
            const activeCsgR = activeCasingRadius(well, layout?.casings || [], toolDepth, tool.od);

            // Set up hover functions
            const hoverProps = {
              onMouseEnter: () =>
                setHoveredItem({
                  name: tool.name,
                  depth: `${tool.bottomDepth}m`,
                  type: effectiveType.toLowerCase(),
                  od: tool.od,
                  length: tool.length,
                  observations: tool.observations,
                  qty: tool.qty,
                  minId: tool.minId,
                  customType: tool.customType,
                }),
              onMouseLeave: () => setHoveredItem(null),
            };

            // Switch rendering by completion tool type dynamically from the configuration matrix (Approach A)
            const config = resolveTubingConfig(effectiveType, tool.name);

            return (
              <g
                key={tool.id || `${effectiveType.toLowerCase()}-${toolIdx}`}
                className="cursor-pointer group hover:opacity-75 transition-opacity"
                {...hoverProps}
              >
                {/* 1. RENDER GRAPHICS */}
                {(() => {
                  const isBridgePlug =
                    effectiveType === 'Bridge Plug' ||
                    effectiveType.toLowerCase().includes('bridge') ||
                    effectiveType.toLowerCase().includes('bouchon') ||
                    (tool.name || '').toLowerCase().includes('bridge') ||
                    (tool.name || '').toLowerCase().includes('bouchon') ||
                    (tool.type || '').toLowerCase().includes('bridge') ||
                    (tool.type || '').toLowerCase().includes('bouchon');

                    if (isBridgePlug) {
                      const casingInnerWidth = activeCsgR * 2 + 2.5;
                      const svgWidth = casingInnerWidth * (512 / 119.13);
                      const svgX = xCenter - (253.69 / 512) * svgWidth;
                      const plugDrawHeight = Math.max(50, height);
                      return (
                        <svg
                          x={svgX}
                          y={yTop}
                          width={svgWidth}
                          height={plugDrawHeight}
                          viewBox="0 0 512 512"
                          preserveAspectRatio="none"
                        >
                          <image
                            href="/img/bridge-plug.svg?v=10"
                            x="0"
                            y="0"
                            width="512"
                            height="512"
                            preserveAspectRatio="none"
                          />
                        </svg>
                      );
                    }

                  const isPacker =
                    config.type.toLowerCase().includes('packer') ||
                    config.type.toLowerCase().includes('pkr') ||
                    effectiveType.toLowerCase().includes('packer') ||
                    effectiveType.toLowerCase().includes('pkr') ||
                    (tool.name || '').toLowerCase().includes('packer') ||
                    (tool.name || '').toLowerCase().includes('pkr') ||
                    (tool.type || '').toLowerCase().includes('packer') ||
                    (tool.type || '').toLowerCase().includes('pkr');

                  const isMoteur =
                    config.type.toLowerCase().includes('moteur') ||
                    config.type.toLowerCase().includes('motor') ||
                    effectiveType.toLowerCase().includes('moteur') ||
                    effectiveType.toLowerCase().includes('motor') ||
                    (tool.name || '').toLowerCase().includes('moteur') ||
                    (tool.name || '').toLowerCase().includes('motor') ||
                    (tool.type || '').toLowerCase().includes('moteur') ||
                    (tool.type || '').toLowerCase().includes('motor');

                  const isPompe =
                    config.type.toLowerCase().includes('pompe') ||
                    config.type.toLowerCase().includes('pump') ||
                    effectiveType.toLowerCase().includes('pompe') ||
                    effectiveType.toLowerCase().includes('pump') ||
                    (tool.name || '').toLowerCase().includes('pompe') ||
                    (tool.name || '').toLowerCase().includes('pump') ||
                    (tool.type || '').toLowerCase().includes('pompe') ||
                    (tool.type || '').toLowerCase().includes('pump');

                  if (isPacker) {
                    const casingInnerWidth = activeCsgR * 2 + 2.5;
                    const svgWidth = casingInnerWidth * (300 / 260);
                    const svgX = xCenter - 0.5 * svgWidth;
                    const drawHeight = Math.max(45, height);
                    return (
                      <svg
                        x={svgX}
                        y={yTop}
                        width={svgWidth}
                        height={drawHeight}
                        viewBox="0 0 300 750"
                        preserveAspectRatio="none"
                      >
                        <image
                          href={config.imageUrl || "/img/packer.svg"}
                          x="0"
                          y="0"
                          width="300"
                          height="750"
                          preserveAspectRatio="none"
                        />
                      </svg>
                    );
                  }

                  if (isMoteur || isPompe) {
                    const casingInnerWidth = activeCsgR * 2;
                    const svgWidth = casingInnerWidth * 0.40;
                    const svgX = xCenter - 0.5 * svgWidth;
                    const drawHeight = Math.max(45, height);
                    const imgSrc = config.imageUrl || (isMoteur ? "/img/moteur.svg" : "/img/pompe.svg");
                    return (
                      <svg
                        x={svgX}
                        y={yTop}
                        width={svgWidth}
                        height={drawHeight}
                        viewBox="0 0 300 750"
                        preserveAspectRatio="none"
                      >
                        <image
                          href={imgSrc}
                          x="0"
                          y="0"
                          width="300"
                          height="750"
                          preserveAspectRatio="none"
                        />
                      </svg>
                    );
                  }

                  if (config.renderType === 'image') {
                    const isShoeTool = config.type === 'Shoe' || effectiveType.toLowerCase().includes('shoe') || effectiveType.toLowerCase().includes('sabot');
                    const drawHeight = Math.max(config.minHeight || 15, height) + (isShoeTool ? 2 : 0);
                    const renderYTop = isShoeTool ? yTop - 2 : yTop;
                    const scale = config.mainScale || 0.25;
                    const { width: vbW, height: vbH } = parseViewBoxSize(config.viewBox);
                    const imgWidth = vbW * scale;
                    const imgX = xCenter - (vbW * 0.4) * scale;

                    return (
                      <svg
                        x={imgX}
                        y={renderYTop}
                        width={imgWidth}
                        height={drawHeight}
                        viewBox={config.viewBox || "0 0 300 500"}
                        preserveAspectRatio="none"
                      >
                          <image
                            href={config.imageUrl}
                            x="0"
                            y="0"
                            width={vbW}
                            height={vbH}
                            preserveAspectRatio="none"
                            style={config.type === 'Shoe' ? { filter: "brightness(0)" } : undefined}
                          />
                        </svg>
                    );
                  }

                  // Vector drawings
                  switch (config.vectorType) {
                    case 'reduction': {
                      return (
                        <polygon
                          points={`${xCenter - 7},${yTop} ${xCenter + 7},${yTop} ${xCenter + 5},${yBottom} ${xCenter - 5},${yBottom}`}
                          fill={config.fillColor || "#64748b"}
                          stroke={config.strokeColor || "#0f172a"}
                          strokeWidth={config.strokeWidth || 1.5}
                        />
                      );
                    }

                    case 'tailpipe': {
                      return (
                        <>
                          <rect
                            x={xCenter - 5}
                            y={yTop}
                            width={10}
                            height={height}
                            fill={config.fillColor || "#64748b"}
                            stroke={config.strokeColor || "#0f172a"}
                            strokeWidth={config.strokeWidth || 1}
                          />
                          <rect
                            x={xCenter - 3}
                            y={yTop}
                            width={6}
                            height={height}
                            fill="#0f172a"
                          />
                          <line x1={xCenter - 5} y1={yTop + height * 0.25} x2={xCenter - 3} y2={yTop + height * 0.25} stroke="#fbbf24" strokeWidth="1" />
                          <line x1={xCenter + 3} y1={yTop + height * 0.25} x2={xCenter + 5} y2={yTop + height * 0.25} stroke="#fbbf24" strokeWidth="1" />
                          <line x1={xCenter - 5} y1={yTop + height * 0.5} x2={xCenter - 3} y2={yTop + height * 0.5} stroke="#fbbf24" strokeWidth="1" />
                          <line x1={xCenter + 3} y1={yTop + height * 0.5} x2={xCenter + 5} y2={yTop + height * 0.5} stroke="#fbbf24" strokeWidth="1" />
                          <line x1={xCenter - 5} y1={yTop + height * 0.75} x2={xCenter - 3} y2={yTop + height * 0.75} stroke="#fbbf24" strokeWidth="1" />
                          <line x1={xCenter + 3} y1={yTop + height * 0.75} x2={xCenter + 5} y2={yTop + height * 0.75} stroke="#fbbf24" strokeWidth="1" />
                        </>
                      );
                    }

                    case 'anchor-seal': {
                      return (
                        <>
                          <rect x={xCenter - 7} y={yTop} width={14} height={height} fill={config.fillColor || "#cbd5e1"} stroke={config.strokeColor || "#0f172a"} strokeWidth={config.strokeWidth || 1} />
                          <rect x={xCenter - 5} y={yTop} width={10} height={height} fill="#0f172a" />
                          <path d={`M ${xCenter - 11} ${yTop + height * 0.3} L ${xCenter - 7} ${yTop + height * 0.4} L ${xCenter - 11} ${yTop + height * 0.5}`} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                          <path d={`M ${xCenter - 11} ${yTop + height * 0.5} L ${xCenter - 7} ${yTop + height * 0.6} L ${xCenter - 11} ${yTop + height * 0.7}`} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                          <path d={`M ${xCenter + 11} ${yTop + height * 0.3} L ${xCenter + 7} ${yTop + height * 0.4} L ${xCenter + 11} ${yTop + height * 0.5}`} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                          <path d={`M ${xCenter + 11} ${yTop + height * 0.5} L ${xCenter + 7} ${yTop + height * 0.6} L ${xCenter + 11} ${yTop + height * 0.7}`} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                        </>
                      );
                    }

                    case 'tubing-court': {
                      return (
                        <>
                          <rect x={xCenter - 7} y={yTop} width={14} height={height} fill={config.fillColor || "#cbd5e1"} stroke={config.strokeColor || "#0f172a"} strokeWidth={config.strokeWidth || 1} />
                          <rect x={xCenter - 5} y={yTop} width={10} height={height} fill="#0f172a" />
                          <rect x={xCenter - 9} y={yTop} width={18} height={4} fill="#fbbf24" stroke="#0f172a" strokeWidth="1" rx="0.5" />
                          <rect x={xCenter - 9} y={yBottom - 4} width={18} height={4} fill="#fbbf24" stroke="#0f172a" strokeWidth="1" rx="0.5" />
                        </>
                      );
                    }

                    case 'sliding-sleeve': {
                      return (
                        <>
                          <rect x={xCenter - 7} y={yTop} width={14} height={height} fill={config.fillColor || "#cbd5e1"} stroke={config.strokeColor || "#0f172a"} strokeWidth={config.strokeWidth || 1.5} />
                          <rect x={xCenter - 5} y={yTop} width={10} height={height} fill="#0f172a" />
                          <rect x={xCenter - 9} y={yTop + height * 0.4} width={18} height={height * 0.2} fill="#ef4444" stroke="#0f172a" strokeWidth="1" />
                        </>
                      );
                    }

                    default: {
                      return (
                        <>
                          {/* Invisible hit box for easier hovering on regular tubing */}
                          <rect
                            x={xCenter - 14}
                            y={yTop}
                            width={28}
                            height={height}
                            fill="transparent"
                            className="group-hover:fill-sky-500/10 transition-colors"
                          />
                          <rect
                            x={xCenter - 9}
                            y={yBottom - 3}
                            width={2}
                            height={6}
                            fill="#334155"
                          />
                          <rect
                            x={xCenter + 7}
                            y={yBottom - 3}
                            width={2}
                            height={6}
                            fill="#334155"
                          />
                        </>
                      );
                    }
                  }
                })()}

                {/* 2. RENDER ANNOTATION LABEL IF EXPLICITLY ADDED */}
                {tool.isCoteProductAdded && (() => {
                  const yMid = (yTop + yBottom) / 2;
                  let anchorY = yMid;
                  let textY = yMid;
                  let linePoints = '';

                  const isMandrin = 
                    config.type.toLowerCase().includes('mandrel') || 
                    config.type.toLowerCase().includes('mandrin') || 
                    effectiveType.toLowerCase().includes('mandrel') || 
                    effectiveType.toLowerCase().includes('mandrin') ||
                    (tool.name || '').toLowerCase().includes('mandrel') ||
                    (tool.name || '').toLowerCase().includes('mandrin') ||
                    (tool.type || '').toLowerCase().includes('mandrel') ||
                    (tool.type || '').toLowerCase().includes('mandrin');

                  const isPacker =
                    config.type.toLowerCase().includes('packer') ||
                    config.type.toLowerCase().includes('pkr') ||
                    effectiveType.toLowerCase().includes('packer') ||
                    effectiveType.toLowerCase().includes('pkr') ||
                    (tool.name || '').toLowerCase().includes('packer') ||
                    (tool.name || '').toLowerCase().includes('pkr') ||
                    (tool.type || '').toLowerCase().includes('packer') ||
                    (tool.type || '').toLowerCase().includes('pkr');

                  const isSeatingNipple =
                    config.type.toLowerCase().includes('nipple') ||
                    config.type.toLowerCase().includes('siège') ||
                    config.type.toLowerCase().includes('siége') ||
                    config.type.toLowerCase().includes('siege') ||
                    effectiveType.toLowerCase().includes('nipple') ||
                    effectiveType.toLowerCase().includes('siège') ||
                    effectiveType.toLowerCase().includes('siége') ||
                    effectiveType.toLowerCase().includes('siege') ||
                    (tool.name || '').toLowerCase().includes('nipple') ||
                    (tool.name || '').toLowerCase().includes('siège') ||
                    (tool.name || '').toLowerCase().includes('siége') ||
                    (tool.name || '').toLowerCase().includes('siege') ||
                    (tool.type || '').toLowerCase().includes('nipple') ||
                    (tool.type || '').toLowerCase().includes('siège') ||
                    (tool.type || '').toLowerCase().includes('siége') ||
                    (tool.type || '').toLowerCase().includes('siege');

                  const isShoe =
                    config.type.toLowerCase().includes('shoe') ||
                    config.type.toLowerCase().includes('sabot') ||
                    effectiveType.toLowerCase().includes('shoe') ||
                    effectiveType.toLowerCase().includes('sabot') ||
                    (tool.name || '').toLowerCase().includes('shoe') ||
                    (tool.name || '').toLowerCase().includes('sabot') ||
                    (tool.type || '').toLowerCase().includes('shoe') ||
                    (tool.type || '').toLowerCase().includes('sabot');
                  
                  const isBridgePlug =
                    effectiveType === 'Bridge Plug' ||
                    effectiveType.toLowerCase().includes('bridge') ||
                    (tool.name || '').toLowerCase().includes('bridge') ||
                    (tool.type || '').toLowerCase().includes('bridge');

                  const isMoteur =
                    config.type.toLowerCase().includes('moteur') ||
                    config.type.toLowerCase().includes('motor') ||
                    effectiveType.toLowerCase().includes('moteur') ||
                    effectiveType.toLowerCase().includes('motor') ||
                    (tool.name || '').toLowerCase().includes('moteur') ||
                    (tool.name || '').toLowerCase().includes('motor') ||
                    (tool.type || '').toLowerCase().includes('moteur') ||
                    (tool.type || '').toLowerCase().includes('motor');

                  const isPompe =
                    config.type.toLowerCase().includes('pompe') ||
                    config.type.toLowerCase().includes('pump') ||
                    effectiveType.toLowerCase().includes('pompe') ||
                    effectiveType.toLowerCase().includes('pump') ||
                    (tool.name || '').toLowerCase().includes('pompe') ||
                    (tool.name || '').toLowerCase().includes('pump') ||
                    (tool.type || '').toLowerCase().includes('pompe') ||
                    (tool.type || '').toLowerCase().includes('pump');

                  if (isPacker || isBridgePlug) {
                    anchorY = yTop + (277 / 635) * Math.max(35, height);
                    textY = anchorY;
                    linePoints = `${xCenter + activeCsgR},${anchorY} ${xCenter + activeCsgR + 10},${anchorY} ${xCenter + activeCsgR + 25},${anchorY} ${xCenter + activeCsgR + 55},${anchorY}`;
                  } else if (isMoteur || isPompe) {
                    const drawHeight = Math.max(45, height);
                    anchorY = yTop + drawHeight / 2;
                    textY = anchorY;
                    const toolX = activeCsgR * 0.40;
                    linePoints = `${xCenter + toolX},${anchorY} ${xCenter + toolX + 10},${anchorY} ${xCenter + activeCsgR + 25},${anchorY} ${xCenter + activeCsgR + 55},${anchorY}`;
                  } else if (isMandrin) {
                    const drawHeight = Math.max(35, height);
                    anchorY = yTop + drawHeight / 2;
                    textY = anchorY - 20;
                    linePoints = `${xCenter + 28},${anchorY} ${xCenter + 35},${anchorY} ${xCenter + 45},${textY} ${xCenter + 75},${textY}`;
                  } else if (isSeatingNipple) {
                    anchorY = yMid;
                    textY = yMid - 15;
                    linePoints = `${xCenter + 10},${anchorY} ${xCenter + 20},${anchorY} ${xCenter + 35},${textY} ${xCenter + 75},${textY}`;
                  } else if (isShoe) {
                    anchorY = yMid;
                    textY = yMid - 15;
                    linePoints = `${xCenter + 8},${anchorY} ${xCenter + 20},${anchorY} ${xCenter + 35},${textY} ${xCenter + 75},${textY}`;
                  } else {
                    anchorY = yMid;
                    textY = yMid - 15;
                    const offsetStart = config.type === 'Reduction' ? 6 : 7;
                    linePoints = `${xCenter + offsetStart},${anchorY} ${xCenter + 20},${anchorY} ${xCenter + 35},${textY} ${xCenter + 75},${textY}`;
                  }

                  const resolvedTextY = rightLabelYByToolId.get(`tool-${tool.id}`);
                  if (resolvedTextY !== undefined) {
                    textY = resolvedTextY;
                    if (isPacker || isBridgePlug) {
                      linePoints = `${xCenter + activeCsgR},${anchorY} ${xCenter + activeCsgR + 10},${anchorY} ${xCenter + activeCsgR + 25},${textY} ${xCenter + activeCsgR + 55},${textY}`;
                    } else if (isMoteur || isPompe) {
                      const toolX = activeCsgR * 0.40;
                      linePoints = `${xCenter + toolX},${anchorY} ${xCenter + toolX + 10},${anchorY} ${xCenter + activeCsgR + 25},${textY} ${xCenter + activeCsgR + 55},${textY}`;
                    } else if (isMandrin) {
                      linePoints = `${xCenter + 28},${anchorY} ${xCenter + 35},${anchorY} ${xCenter + 45},${textY} ${xCenter + 75},${textY}`;
                    } else if (isSeatingNipple) {
                      linePoints = `${xCenter + 10},${anchorY} ${xCenter + 20},${anchorY} ${xCenter + 35},${textY} ${xCenter + 75},${textY}`;
                    } else if (isShoe) {
                      linePoints = `${xCenter + 8},${anchorY} ${xCenter + 20},${anchorY} ${xCenter + 35},${textY} ${xCenter + 75},${textY}`;
                    } else {
                      const offsetStart = config.type === 'Reduction' ? 6 : 7;
                      linePoints = `${xCenter + offsetStart},${anchorY} ${xCenter + 20},${anchorY} ${xCenter + 35},${textY} ${xCenter + 75},${textY}`;
                    }
                  }

                  const labelPrefix = config.frenchDesignation;
                  const labelText1 = `${labelPrefix}: ${tool.bottomDepth}m`;
                  const labelText2 = `Type: ${tool.customType || tool.type}`;

                  return (
                    <>
                      <polyline
                        points={linePoints}
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="1"
                      />
                      <text
                        x={xCenter + ((isPacker || isBridgePlug) ? activeCsgR + 60 : 80)}
                        y={textY}
                        fontSize="10"
                        fill="#0f172a"
                        fontWeight="bold"
                        alignmentBaseline="middle"
                      >
                        {isMandrin ? (
                          <>
                            <tspan x={xCenter + ((isPacker || isBridgePlug) ? activeCsgR + 60 : 80)} dy="-0.5em">{`${labelPrefix} ${tool.customType || tool.type}`}</tspan>
                            <tspan x={xCenter + ((isPacker || isBridgePlug) ? activeCsgR + 60 : 80)} dy="1.5em">{`${tool.bottomDepth} m`}</tspan>
                          </>
                        ) : (
                          <>
                            <tspan x={xCenter + ((isPacker || isBridgePlug) ? activeCsgR + 60 : 80)} dy="-0.5em">{labelText1}</tspan>
                            <tspan x={xCenter + ((isPacker || isBridgePlug) ? activeCsgR + 60 : 80)} dy="1.5em">{labelText2}</tspan>
                          </>
                        )}
                      </text>
                    </>
                  );
                })()}
              </g>
            );
          })}  // end of return and map

          {/* CASING STRINGS DATA CALLOUTS (CSG { Ø, Gr., Lbs. }) FOR EVERY CASING */}
          {well.casings && well.casings.map((csg, idx) => {
            const sizeNum = parseSizeToNumber(csg.casingSize);
            if (!sizeNum) return null;
            
            // Determine radius factor
            let radiusFactor = 3.2;
            if (layout?.casings && layout.casings.length > 0) {
              const firstCsg = layout.casings[0];
              const firstSize = parseSizeToNumber(well.casings[firstCsg.casingIndex]?.casingSize);
              if (firstSize > 0) radiusFactor = firstCsg.casingR / firstSize;
            }
            const csgR = Math.max(10, sizeNum * radiusFactor);
            
            const isLiner = csg.startFromTOL || (csg.topOfLiner != null && csg.topOfLiner > 0);
            const topD = isLiner ? Number(csg.topOfLiner) : (csg.topDepth || 0);
            const shoeD = csg.shoeDepth || 0;
            const labelDepth = isLiner ? Math.min(topD + 25, (topD + shoeD) / 2) : (topD + shoeD) / 2;
            const yPos = mapDepthToY(labelDepth);
            if (isNaN(yPos)) return null;

            const calloutX = xCenter + csgR + 15;

            return (
              <g key={`schematic-csg-callout-${csg.id || idx}`} transform={`translate(${calloutX}, ${yPos})`}>
                <line x1={-10} y1={0} x2={10} y2={0} stroke="#475569" strokeWidth="1" strokeDasharray="2,2" />
                <text x={14} y={4} fontSize="11" fontWeight="bold" fill="#0f172a" className="font-sans">CSG</text>
                <text x={42} y={11} fontSize="26" fontWeight="light" fill="#0f172a">{"{"}</text>
                <g transform="translate(58, -14)" fontSize="10" fontWeight="bold" fill="#0f172a" className="font-sans">
                  <text x={0} y={9}>Ø : {formatCasingSize(csg.casingSize)}</text>
                  <text x={0} y={20}>Gr. : {csg.grade || '-'}</text>
                  <text x={0} y={31}>Lbs. : {csg.weight ? `${csg.weight}` : '-'}</text>
                </g>
              </g>
            );
          })}

          {/* WELLHEAD / ELEVATIONS TEXT DECORATIONS AT THE VERY TOP */}
          <g transform="translate(0, 0)">
            {/* Wellbore Centerline indicator */}
            <line
              x1={xCenter}
              y1={20}
              x2={xCenter}
              y2={35}
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="5,3"
            />

            {/* Z sol, Z Forage label details */}
            <text x={22} y={28} fontSize="9.5" fill="#475569" fontWeight="bold">
              Z Sol: {well.elevationSol} m
            </text>
            <text x={22} y={40} fontSize="9.5" fill="#475569" fontWeight="bold">
              Z Forage: {well.elevationForage} m
            </text>
            <text x={22} y={51} fontSize="9.5" fill="#475569" fontWeight="bold">
              Z Prod: {well.elevationProduction} m
            </text>

            {/* Completion Name label */}
            <text
              x={svgWidth - 15}
              y={28}
              textAnchor="end"
              fontSize="11"
              fill="#0f172a"
              fontWeight="bold"
            >
              {well.name} ({well.reservoir})
            </text>
            <text
              x={svgWidth - 15}
              y={41}
              textAnchor="end"
              fontSize="9"
              fill="#64748b"
              fontWeight="semibold"
            >
              {well.isAbandonProvisoire ? 'Abandon provisoire (kill string)' : well.completionType}
            </text>
          </g>
        </svg>
      </div>

      {/* A4 PRINT MODAL OVERLAY */}
      {isA4Open && (
        <WellboreA4Print well={well} onClose={() => setIsA4Open(false)} />
      )}

      {/* CONFIRMATION DIALOG MODAL OVERLAY */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="custom_dialog_modal_schematic">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-sans">{dialog.title}</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed whitespace-pre-line">{dialog.message}</p>
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  dialog.onConfirm();
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition bg-[#f97316] hover:bg-[#ea580c]"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
