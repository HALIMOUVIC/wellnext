import React, { useState, useEffect, useRef } from "react";
import { WellData } from "../types";
import { Search, ListFilter, MapPin, ArrowLeft, ExternalLink, Filter, Layers, Database, Activity } from "lucide-react";

interface WellDashboardProps {
  wells: WellData[];
  activeWellId: string;
  onSelectWell: (id: string) => void;
  onNavigateToTab: (tab: "metadata" | "wellbore" | "perforations" | "history") => void;
  onCreateNewWell: () => void;
  onDeleteWell?: (id: string) => void;
  onCategoryDetailChange?: (detail: { label: string; desc: string; onBack: () => void } | null) => void;
}

/* Cache-bust timestamp — re-evaluated on every server restart so
   swapped SVG files in /img/ are always picked up fresh.            */
const BUILD_TS = Date.now();

/* ── Donut Chart ─────────────────────────────────────────────── */
function DonutChart({ slices, total }: { slices: { label: string; value: number; color: string }[]; total: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 100); return () => clearTimeout(t); }, []);
  const S = 160, cx = S / 2, cy = S / 2, R = 58, r = 38, sw = R - r;
  let cur = -Math.PI / 2;
  const arcs = slices.map(d => {
    const angle = total > 0 ? (d.value / total) * 2 * Math.PI : 0;
    const sa = cur; cur += angle;
    return { ...d, sa, angle };
  });
  const arc = (sa: number, angle: number) => {
    const m = r + sw / 2, x1 = cx + m * Math.cos(sa), y1 = cy + m * Math.sin(sa);
    const x2 = cx + m * Math.cos(sa + angle), y2 = cy + m * Math.sin(sa + angle);
    return `M ${x1} ${y1} A ${m} ${m} 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
  };
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
      <circle cx={cx} cy={cy} r={r + sw / 2} fill="none" stroke="#f1f5f9" strokeWidth={sw + 4} />
      <circle cx={cx} cy={cy} r={r + sw / 2} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
      {arcs.map((a, i) => (
        <path key={i} d={arc(a.sa, Math.max(a.angle - 0.06, 0.01))} fill="none" stroke={a.color}
          strokeWidth={sw} strokeLinecap="round"
          style={{ opacity: on ? 1 : 0, transition: `opacity 0.5s ease ${i * 0.12}s` }} />
      ))}
      {/* center white circle */}
      <circle cx={cx} cy={cy} r={r - 1} fill="white" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="800" fill="#0f172a" fontFamily="'Inter',sans-serif">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fontWeight="600" fill="#94a3b8" fontFamily="'Inter',sans-serif" letterSpacing="1.5">PUITS</text>
    </svg>
  );
}

/* ── Animated fill bar ───────────────────────────────────────── */
function FillBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), delay); return () => clearTimeout(t); }, [pct, delay]);
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: `${color}18` }}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${w}%`, background: `linear-gradient(90deg,${color}80,${color})` }} />
    </div>
  );
}

/* ── Depth row ───────────────────────────────────────────────── */
function DepthRow({ name, depth, pct, color, delay }: { name: string; depth: number; pct: number; color: string; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), delay); return () => clearTimeout(t); }, [pct, delay]);
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-12 text-right text-[10px] font-semibold shrink-0 truncate text-slate-500" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{name}</span>
      <div className="flex-1 rounded-md overflow-hidden" style={{ height: 20, background: "#f1f5f9" }}>
        <div className="h-full rounded-md flex items-center justify-end px-2 transition-all duration-700 ease-out"
          style={{ width: `${w}%`, background: `linear-gradient(90deg,${color}50,${color})`, minWidth: depth > 0 ? 32 : 0 }}>
          <span className="text-[9px] font-bold text-white whitespace-nowrap" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            {depth > 0 ? `${depth.toFixed(0)}m` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────── */
export default function WellDashboard({ wells, activeWellId, onSelectWell, onNavigateToTab, onCategoryDetailChange }: WellDashboardProps) {
  const [search, setSearch] = useState("");
  const [filterP, setFilterP] = useState("ALL");
  const [selectedTypeDetail, setSelectedTypeDetail] = useState<string | null>(null);

  // Filters inside dedicated category view
  const [typeSearch, setTypeSearch] = useState("");
  const [typeFieldFilter, setTypeFieldFilter] = useState("ALL");
  const [typeResFilter, setTypeResFilter] = useState("ALL");

  const onCategoryDetailChangeRef = useRef(onCategoryDetailChange);
  useEffect(() => {
    onCategoryDetailChangeRef.current = onCategoryDetailChange;
  });

  useEffect(() => {
    if (selectedTypeDetail) {
      const typeKpisMap: Record<string, { label: string; desc: string }> = {
        pph: { label: "PPH", desc: "Puits Producteurs d'Huile" },
        ppg: { label: "PPG", desc: "Puits Producteurs de Gaz" },
        ppe: { label: "PPE", desc: "Puits Injecteurs d'Eau" },
        esp: { label: "ESP", desc: "Puits Équipés en Pompage Électrique" },
        pie: { label: "PIE", desc: "Puits Injecteurs d'Eau / Gaz" },
      };
      const info = typeKpisMap[selectedTypeDetail] || { label: selectedTypeDetail.toUpperCase(), desc: "Puits Category" };
      onCategoryDetailChangeRef.current?.({
        label: info.label,
        desc: info.desc,
        onBack: () => {
          setSelectedTypeDetail(null);
          setTypeSearch("");
          setTypeFieldFilter("ALL");
          setTypeResFilter("ALL");
        },
      });
    } else {
      onCategoryDetailChangeRef.current?.(null);
    }

    return () => {
      onCategoryDetailChangeRef.current?.(null);
    };
  }, [selectedTypeDetail]);

  const getNorm = (p: string) => {
    const pl = (p || "").toLowerCase();
    if (pl.includes("pph") || pl.includes("huile") || pl.includes("oil")) return "PPH";
    if (pl.includes("ppg") || pl.includes("gaz") || pl.includes("gas")) return "PPG";
    if (pl.includes("ppe") || (pl.includes("eau") && !pl.includes("inject"))) return "PPE";
    if (pl.includes("pie") || pl.includes("pig") || pl.includes("inject")) return "PIE";
    if (pl.includes("esp")) return "ESP";
    return p || "Autre";
  };

  const isPPH = (w: WellData) => {
    const p = (w.purpose || "").toLowerCase().trim();
    return p.includes("pph") || p.includes("huile") || p.includes("oil");
  };

  const isPPG = (w: WellData) => {
    const p = (w.purpose || "").toLowerCase().trim();
    return p.includes("ppg") || p.includes("gaz") || p.includes("gas");
  };

  const isPPE = (w: WellData) => {
    const p = (w.purpose || "").toLowerCase().trim();
    return p.includes("ppe") || p.includes("producteur eau") || p === "ppe";
  };

  const isESP = (w: WellData) => {
    const p = (w.purpose || "").toLowerCase().trim();
    return p.includes("esp") || p === "esp";
  };

  const isPIE = (w: WellData) => {
    const p = (w.purpose || "").toLowerCase().trim();
    return p.includes("pie") || p.includes("inject") || p === "pie";
  };

  const matchesWellType = (w: WellData, typeKey: string) => {
    if (typeKey === "pph") return isPPH(w);
    if (typeKey === "ppg") return isPPG(w);
    if (typeKey === "ppe") return isPPE(w);
    if (typeKey === "esp") return isESP(w);
    if (typeKey === "pie") return isPIE(w);
    return false;
  };

  const getWellStatus = (w: WellData): "po" | "pf" | "ap" | "ad" => {
    const cType = (w.completionType || "").toLowerCase().trim();
    const purp = (w.purpose || "").toLowerCase().trim();
    const obs = (w.observations || "").toLowerCase().trim();

    if (
      cType.includes("définitif") || cType.includes("definitif") || cType === "ad" || cType.includes("abandon definitif") ||
      purp.includes("définitif") || purp.includes("definitif") || obs.includes("définitif")
    ) {
      return "ad";
    }

    if (
      w.isAbandonProvisoire || cType.includes("provisoire") || cType === "ap" || cType.includes("abandon provisoire") ||
      purp.includes("provisoire") || obs.includes("provisoire")
    ) {
      return "ap";
    }

    if (
      cType.includes("fermé") || cType.includes("ferme") || cType.includes("closed") || cType === "pf" ||
      purp.includes("fermé") || purp.includes("ferme") || obs.includes("fermé")
    ) {
      return "pf";
    }

    return "po";
  };

  const getDepth = (w: WellData) => Math.max(
    w.casings?.reduce((m, c) => Math.max(m, c.shoeDepth || 0), 0) || 0,
    w.tubings?.reduce((m, t) => Math.max(m, t.bottomDepth || 0), 0) || 0
  );

  const total = wells.length;
  const resCnt: Record<string, number> = {};
  const purpCnt: Record<string, number> = {};
  const statusCounts = { po: 0, pf: 0, ap: 0, ad: 0 };
  const typeCounts = { pph: 0, ppg: 0, ppe: 0, esp: 0, pie: 0 };

  wells.forEach(w => {
    const r = w.reservoir || "N/A"; resCnt[r] = (resCnt[r] || 0) + 1;
    const p = getNorm(w.purpose); purpCnt[p] = (purpCnt[p] || 0) + 1;
    const st = getWellStatus(w); statusCounts[st]++;

    if (isPPH(w)) typeCounts.pph++;
    if (isPPG(w)) typeCounts.ppg++;
    if (isPPE(w)) typeCounts.ppe++;
    if (isESP(w)) typeCounts.esp++;
    if (isPIE(w)) typeCounts.pie++;
  });

  const PC: Record<string, string> = { "PPH": "#f97316", "PPG": "#3b82f6", "PPE": "#06b6d4", "PIE": "#10b981", "ESP": "#8b5cf6", "Autre": "#64748b" };
  const RC = ["#f97316","#3b82f6","#10b981","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#6366f1"];

  const donutSlices = Object.entries(purpCnt).map(([l, v]) => ({ label: l, value: v, color: PC[l] || "#94a3b8" }));
  const depthTop = [...wells].sort((a, b) => getDepth(b) - getDepth(a)).slice(0, 8);
  const maxD = Math.max(...depthTop.map(getDepth), 1);
  const DC = ["#f97316","#3b82f6","#10b981","#8b5cf6","#f43f5e","#f59e0b","#06b6d4","#6366f1"];

  const filtered = wells.filter(w => {
    const p = getNorm(w.purpose);
    const matchesSearch = (
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.reservoir || "").toLowerCase().includes(search.toLowerCase()) ||
      (w.field || "").toLowerCase().includes(search.toLowerCase()) ||
      p.toLowerCase().includes(search.toLowerCase()) ||
      (w.completionType || "").toLowerCase().includes(search.toLowerCase())
    );
    const matchesPurpose = filterP === "ALL" || p === filterP;
    return matchesSearch && matchesPurpose;
  });

  /* Status cards (NOT clickable as requested) */
  const statusKpis = [
    {
      id: "po",
      label: "Puits Ouvert",
      sub: "Active:",
      value: statusCounts.po,
      imgSrc: `/img/po.svg?t=${BUILD_TS}`,
    },
    {
      id: "pf",
      label: "Puits Fermé",
      sub: "Closed:",
      value: statusCounts.pf,
      imgSrc: `/img/pf.svg?t=${BUILD_TS}`,
    },
    {
      id: "ap",
      label: "Abondon Provisoire",
      sub: "Paused:",
      value: statusCounts.ap,
      imgSrc: `/img/ap.svg?t=${BUILD_TS}`,
    },
    {
      id: "ad",
      label: "Abondon Définitif",
      sub: "Capped:",
      value: statusCounts.ad,
      imgSrc: `/img/ad.svg?t=${BUILD_TS}`,
    },
  ];

  /* Type cards (CLICKABLE -> opens dedicated detail page) */
  const typeKpis = [
    {
      id: "pph",
      label: "PPH",
      sub: "Producteur Huile",
      desc: "Puits Producteurs d'Huile",
      value: typeCounts.pph,
      imgSrc: `/img/pph.svg?t=${BUILD_TS}`,
      accent: "#f97316",
    },
    {
      id: "ppg",
      label: "PPG",
      sub: "Producteur Gaz",
      desc: "Puits Producteurs de Gaz",
      value: typeCounts.ppg,
      imgSrc: `/img/PPG.svg?t=${BUILD_TS}`,
      accent: "#3b82f6",
    },
    {
      id: "ppe",
      label: "PPE",
      sub: "Producteur Eau",
      desc: "Puits Producteurs d'Eau",
      value: typeCounts.ppe,
      imgSrc: `/img/PPE.svg?t=${BUILD_TS}`,
      accent: "#06b6d4",
    },
    {
      id: "esp",
      label: "ESP",
      sub: "Pompage Électrique",
      desc: "Puits Équipés en Pompage Électrique",
      value: typeCounts.esp,
      imgSrc: `/img/ESP.svg?t=${BUILD_TS}`,
      accent: "#8b5cf6",
    },
    {
      id: "pie",
      label: "PIE",
      sub: "Puits Injecteur",
      desc: "Puits Injecteurs d'Eau / Gaz",
      value: typeCounts.pie,
      imgSrc: `/img/PIE.svg?t=${BUILD_TS}`,
      accent: "#10b981",
    },
  ];

  // ═════════════════════════════════════════════════════════════
  // ══ DEDICATED TYPE DETAILS PAGE VIEW ══
  // ═════════════════════════════════════════════════════════════
  if (selectedTypeDetail) {
    const currentKpi = typeKpis.find(k => k.id === selectedTypeDetail) || typeKpis[0];
    const categoryWells = wells.filter(w => matchesWellType(w, selectedTypeDetail));

    // Unique perimètres / fields in this category
    const uniqueFields = Array.from(new Set(categoryWells.map(w => w.field || "Non Spécifié"))).sort();
    const uniqueReservoirs = Array.from(new Set(categoryWells.map(w => w.reservoir || "N/A"))).sort();

    // Category status counts
    const catStatusCounts = {
      po: categoryWells.filter(w => getWellStatus(w) === "po").length,
      pf: categoryWells.filter(w => getWellStatus(w) === "pf").length,
      ap: categoryWells.filter(w => getWellStatus(w) === "ap").length,
      ad: categoryWells.filter(w => getWellStatus(w) === "ad").length,
    };

    // Filtered wells inside this category
    const categoryFiltered = categoryWells.filter(w => {
      const fieldVal = w.field || "Non Spécifié";
      const resVal = w.reservoir || "N/A";

      const matchesTxt = (
        w.name.toLowerCase().includes(typeSearch.toLowerCase()) ||
        (w.folio || "").toLowerCase().includes(typeSearch.toLowerCase()) ||
        (w.reservoir || "").toLowerCase().includes(typeSearch.toLowerCase()) ||
        (w.field || "").toLowerCase().includes(typeSearch.toLowerCase()) ||
        (w.completionType || "").toLowerCase().includes(typeSearch.toLowerCase()) ||
        (w.observations || "").toLowerCase().includes(typeSearch.toLowerCase())
      );

      const matchesField = typeFieldFilter === "ALL" || fieldVal === typeFieldFilter;
      const matchesRes = typeResFilter === "ALL" || resVal === typeResFilter;

      return matchesTxt && matchesField && matchesRes;
    });

    return (
      <div className="space-y-4 w-full" style={{ fontFamily: "'Inter',sans-serif" }}>

        {/* 4 Status Cards directly on canvas - 100% full width */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full">
            {/* Ouvert */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 overflow-hidden min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-600 truncate">Ouvert</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mt-0.5 font-sans">
                  {catStatusCounts.po.toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center pointer-events-none">
                <img src={`/img/po.svg?t=${BUILD_TS}`} alt="Ouvert" className="w-full h-full object-contain max-h-full" />
              </div>
            </div>

            {/* Fermé */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 overflow-hidden min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-600 truncate">Fermé</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mt-0.5 font-sans">
                  {catStatusCounts.pf.toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center pointer-events-none">
                <img src={`/img/pf.svg?t=${BUILD_TS}`} alt="Fermé" className="w-full h-full object-contain max-h-full" />
              </div>
            </div>

            {/* Abondon Provisoire */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 overflow-hidden min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-600 truncate" title="Abondon Provisoire">Abondon Provisoire</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mt-0.5 font-sans">
                  {catStatusCounts.ap.toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center pointer-events-none">
                <img src={`/img/ap.svg?t=${BUILD_TS}`} alt="Abondon Provisoire" className="w-full h-full object-contain max-h-full" />
              </div>
            </div>

            {/* Abondon Définitif */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 overflow-hidden min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-600 truncate" title="Abondon Définitif">Abondon Définitif</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mt-0.5 font-sans">
                  {catStatusCounts.ad.toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center pointer-events-none">
                <img src={`/img/ad.svg?t=${BUILD_TS}`} alt="Abondon Définitif" className="w-full h-full object-contain max-h-full" />
              </div>
            </div>
          </div>

        {/* Main Card Panel containing Search, Filters & Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          {/* Toolbar & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Périmètre:</span>
                <select
                  className="bg-transparent focus:outline-none text-xs font-semibold text-slate-700 cursor-pointer"
                  value={typeFieldFilter}
                  onChange={e => setTypeFieldFilter(e.target.value)}
                >
                  <option value="ALL">Tous les Périmètres ({uniqueFields.length})</option>
                  {uniqueFields.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Réservoir:</span>
                <select
                  className="bg-transparent focus:outline-none text-xs font-semibold text-slate-700 cursor-pointer"
                  value={typeResFilter}
                  onChange={e => setTypeResFilter(e.target.value)}
                >
                  <option value="ALL">Tous les Réservoirs</option>
                  {uniqueReservoirs.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {(typeSearch || typeFieldFilter !== "ALL" || typeResFilter !== "ALL") && (
                <button
                  onClick={() => { setTypeSearch(""); setTypeFieldFilter("ALL"); setTypeResFilter("ALL"); }}
                  className="px-2.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-all cursor-pointer"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Search Input Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={typeSearch}
                onChange={e => setTypeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 transition-all"
              />
            </div>
          </div>

          {/* Table matching screenshot */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-slate-700">Well Name</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700">Status</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700">Mode / Complétion</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700">Périmètre / Location</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700">Réservoir</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700 text-center">Profondeur Max</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-700 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryFiltered.length > 0 ? (
                  categoryFiltered.map(well => {
                    const depth = getDepth(well);
                    const isActive = well.id === activeWellId;
                    const st = getWellStatus(well);
                    const statusConfig = {
                      po: { name: "Ouvert", badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80" },
                      pf: { name: "Fermé", badge: "bg-rose-50 text-rose-700 border-rose-200/80" },
                      ap: { name: "Abondon Provisoire", badge: "bg-amber-50 text-amber-700 border-amber-200/80" },
                      ad: { name: "Abondon Définitif", badge: "bg-slate-100 text-slate-700 border-slate-200" },
                    }[st] || { name: "—", badge: "bg-slate-50 text-slate-600 border-slate-200" };

                    return (
                      <tr
                        key={well.id}
                        onClick={() => { onSelectWell(well.id); onNavigateToTab("metadata"); }}
                        className={`hover:bg-orange-50/40 transition-colors cursor-pointer group ${isActive ? "bg-orange-50/60" : ""}`}
                      >
                        <td className="py-3.5 px-4 font-bold text-xs text-slate-900 group-hover:text-orange-600 transition-colors">
                          <div>
                            <span>{well.name}</span>
                            <span className="block text-[10px] font-mono text-slate-400 font-normal">
                              Folio: {well.folio || "—"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${statusConfig.badge}`}>
                            {statusConfig.name}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-medium text-slate-700 uppercase font-mono">
                          {well.completionType || "—"}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-700">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 font-medium rounded-lg text-slate-800">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {well.field || "Non Spécifié"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-mono font-bold text-slate-700">
                          {well.reservoir || "—"}
                        </td>

                        <td className="py-3.5 px-4 text-center text-xs font-mono font-bold text-slate-800">
                          {depth > 0 ? `${depth.toFixed(1)} m` : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectWell(well.id);
                              onNavigateToTab("metadata");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white text-xs font-bold rounded-lg transition-all"
                          >
                            Fiche
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      Aucun puit de type <span className="font-bold text-slate-700">{currentKpi.label}</span> ne correspond aux critères de recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // ══ MAIN DASHBOARD VIEW ══
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="space-y-3" style={{ fontFamily: "'Inter',sans-serif" }} id="well_dashboard_root">

      {/* ══ STATUS KPI CARDS (NOT CLICKABLE) ══ */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5" id="dashboard_stats_grid">
        {statusKpis.map(({ id, label, sub, value, imgSrc }) => {
          return (
            <div
              key={id}
              className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200 shadow-2xs flex items-center justify-between gap-3 select-none"
            >
              {/* 3D SVG Icon */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center pointer-events-none">
                <img
                  src={imgSrc}
                  alt={label}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Card Text Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-slate-800 leading-snug font-sans truncate" title={label}>
                  {label}
                </h3>
                <p className="text-[10px] font-medium text-slate-500">
                  {sub}
                </p>
                <p className="text-base sm:text-lg font-bold text-slate-900 leading-none mt-0.5 font-sans">
                  {value.toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ TYPE & MODE KPI CARDS (CLICKABLE -> Opens Dedicated Details Page) ══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5" id="dashboard_type_stats_grid">
        {typeKpis.map(({ id, label, sub, value, imgSrc }) => {
          return (
            <div
              key={id}
              onClick={() => setSelectedTypeDetail(id)}
              className="bg-white rounded-xl p-2 sm:p-2.5 border border-slate-200 shadow-2xs hover:border-orange-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer select-none flex items-center justify-between gap-2.5 group"
            >
              {/* 3D SVG Icon */}
              <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center pointer-events-none group-hover:scale-105 transition-transform">
                <img
                  src={imgSrc}
                  alt={label}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Card Text Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-slate-800 leading-snug font-sans truncate group-hover:text-orange-600 transition-colors" title={label}>
                  {label}
                </h3>
                <p className="text-[9.5px] font-medium text-slate-500 truncate" title={sub}>
                  {sub}
                </p>
                <p className="text-sm sm:text-base font-bold text-slate-900 leading-none mt-0.5 font-sans">
                  {value.toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ CHARTS ROW ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Donut */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800" style={{ fontFamily: "'Inter',sans-serif" }}>Objectifs de Production</h3>
              <p className="text-[9px] text-slate-400 mt-0.5">Répartition par type de puits</p>
            </div>
          </div>
          {total > 0 ? (
            <div className="flex items-center gap-5 justify-center">
              <div className="shrink-0">
                <DonutChart slices={donutSlices} total={total} />
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                {donutSlices.map((d, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-[10px] font-semibold text-slate-700 truncate" style={{ fontFamily: "'Inter',sans-serif" }}>{d.label}</span>
                      </div>
                      <span className="text-[10px] font-black shrink-0 ml-2" style={{ color: d.color, fontFamily: "'JetBrains Mono',monospace" }}>
                        {d.value} <span className="font-normal text-slate-400">/ {total}</span>
                      </span>
                    </div>
                    <FillBar pct={Math.round((d.value / total) * 100)} color={d.color} delay={200 + i * 100} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-300 text-xs">Aucune donnée</div>
          )}
        </div>

        {/* Depth bars */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-slate-800" style={{ fontFamily: "'Inter',sans-serif" }}>Profondeurs Comparées</h3>
            <p className="text-[9px] text-slate-400 mt-0.5">Top {depthTop.length} puits par profondeur maximale</p>
          </div>
          {depthTop.length > 0 ? (
            <div className="space-y-2.5">
              {depthTop.map((w, i) => (
                <DepthRow key={w.id} name={w.name} depth={getDepth(w)} pct={(getDepth(w) / maxD) * 100}
                  color={DC[i % DC.length]} delay={150 + i * 60} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-300 text-xs">Aucune donnée</div>
          )}
        </div>
      </div>

      {/* ══ RESERVOIRS ══ */}
      {Object.keys(resCnt).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-800" style={{ fontFamily: "'Inter',sans-serif" }}>Répartition par Réservoir</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(resCnt).map(([name, count], i) => {
              const color = RC[i % RC.length];
              const pct = Math.round((count / total) * 100);
              return (
                <div key={name} className="rounded-xl p-3.5 space-y-2.5"
                  style={{ background: `${color}0d`, border: `1.5px solid ${color}22` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-[10px] font-bold text-slate-800" style={{ fontFamily: "'Inter',sans-serif" }}>Rés. {name}</span>
                    </div>
                    <span className="text-[9px] font-black text-white px-1.5 py-0.5 rounded-full" style={{ background: color, fontFamily: "'JetBrains Mono',monospace" }}>{count}</span>
                  </div>
                  <FillBar pct={pct} color={color} delay={200} />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-400" style={{ fontFamily: "'Inter',sans-serif" }}>{count} {count > 1 ? "puits" : "puit"}</span>
                    <span className="text-[9px] font-bold" style={{ color, fontFamily: "'JetBrains Mono',monospace" }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TABLE ══ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-bold text-slate-800" style={{ fontFamily: "'Inter',sans-serif" }}>Inventaire des Puits</h3>
            <p className="text-[9px] text-slate-400 mt-0.5">Cliquer sur une ligne pour accéder à la fiche technique</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Rechercher..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 w-36 transition-all" />
            </div>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
              <ListFilter className="w-3 h-3 text-slate-400 shrink-0" />
              <select className="bg-transparent focus:outline-none text-[10px] font-medium text-slate-600 cursor-pointer max-w-[120px]"
                value={filterP} onChange={e => setFilterP(e.target.value)}>
                <option value="ALL">Tous les Usages</option>
                {Object.keys(purpCnt).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Puits", "Objectif", "Mode / Complétion", "Réservoir", "Prof. Max", "Z Sol", "Z Forage", "Z Prod", "Csg / Tbg"].map((h, i) => (
                  <th key={h} className={`py-2.5 px-4 text-[9px] font-semibold uppercase tracking-widest text-slate-400 ${i > 2 ? "text-center" : ""}`}
                    style={{ fontFamily: "'Inter',sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((well, ri) => {
                const isActive = well.id === activeWellId;
                const depth = getDepth(well);
                const purpose = getNorm(well.purpose);
                const pc = PC[purpose] || "#94a3b8";
                return (
                  <tr key={well.id}
                    onClick={() => { onSelectWell(well.id); onNavigateToTab("metadata"); }}
                    className={`cursor-pointer border-b border-slate-50 transition-all hover:bg-slate-50/80 ${isActive ? "bg-orange-50/60" : ri % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1 h-8 rounded-full shrink-0" style={{ background: isActive ? "#f97316" : "#e2e8f0" }} />
                        <div>
                          <p className="text-[11px] font-bold text-slate-800" style={{ fontFamily: "'Inter',sans-serif" }}>{well.name}</p>
                          <p className="text-[9px] text-slate-400" style={{ fontFamily: "'JetBrains Mono',monospace" }}>Folio {well.folio || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: pc, background: `${pc}15`, border: `1px solid ${pc}25` }}>{purpose}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded uppercase font-mono">
                        {well.completionType || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{well.reservoir || "—"}</span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-[10px] font-bold text-slate-700" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{depth > 0 ? `${depth.toFixed(1)} m` : "—"}</td>
                    <td className="py-2.5 px-4 text-center text-[10px] text-slate-500" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{well.elevationSol ?? "—"}</td>
                    <td className="py-2.5 px-4 text-center text-[10px] text-slate-500" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{well.elevationForage ?? "—"}</td>
                    <td className="py-2.5 px-4 text-center text-[10px] text-slate-500" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{well.elevationProduction ?? "—"}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                        {well.casings?.length || 0}C / {well.tubings?.length || 0}T
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={9} className="py-12 text-center text-[11px] text-slate-400">Aucun puits ne correspond à votre recherche.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
