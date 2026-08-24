import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { WellData, Perimetre } from "./types";
import WellboreSchematic from "./components/WellboreSchematic";
import WellMetadataForm from "./components/WellMetadataForm";
import WellboreForm from "./components/WellboreForm";
import PerforationForm from "./components/PerforationForm";
import LinerCrepineForm from "./components/LinerCrepineForm";
import SrpForm from "./components/SrpForm";
import WellHistory, { HistoryRecord } from "./components/WellHistory";
import WellboreA4Print from "./components/WellboreA4Print";
import WellDashboard from "./components/WellDashboard";
import Login from "./components/Login";
import CustomToolsModal from "./components/CustomToolsModal";
import EmployeeManagement from "./components/EmployeeManagement";
import PerimetresManagement from "./components/PerimetresManagement";

import { updateTubingComponentMatrix } from "./lib/wellboreEngine";
import {
  Plus,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Layers,
  Grid,
  FileText,
  Flame,
  Activity,
  Droplet,
  Database,
  Sliders,
  ChevronRight,
  Sparkles,
  Info,
  History,
  Printer,
  Save,
  Search,
  ChevronUp,
  Calendar,
  Users,
  MapPin,
  X,
  AlertCircle,
  ArrowLeft,
  Menu,
} from "lucide-react";

const getDefaultTemplateWells = (): WellData[] => {
  const defaultWell: WellData = {
    id: "well-default",
    name: "Nouveau Puits",
    purpose: "Puits Producteur",
    completionType: "COMPLETION SIMPLE",
    reservoir: "",
    field: "",
    elevationSol: 0,
    elevationForage: 0,
    elevationProduction: 0,
    spoolProd: "",
    packerType: "",
    suspTbg: "",
    etanTbg: "",
    origineCotes: "",
    folio: "01",
    folioToCancel: "00",
    casings: [],
    tubings: [],
    perforations: [],
    observations: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return [defaultWell];
};

function normalizeFolio(folio: string): string {
  const trimmed = String(folio).trim();
  const n = parseInt(trimmed, 10);
  if (isNaN(n) || n < 0) return trimmed;
  return String(n).padStart(2, "0");
}

export default function App() {
  const [wells, setWells] = useState<WellData[]>([]);
  const [activeWellId, setActiveWellId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "metadata" | "wellbore" | "perforations" | "history" | "custom_tools" | "employees" | "perimetres"
  >("dashboard");
  const [activeCategory, setActiveCategory] = useState<"params" | "architecture" | "perforations" | "liner_crepine" | "srp">("params");
  const [categoryDetailInfo, setCategoryDetailInfo] = useState<{
    label: string;
    desc: string;
    onBack: () => void;
  } | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const handleCategoryDetailChange = useCallback(
    (detail: { label: string; desc: string; onBack: () => void } | null) => {
      setCategoryDetailInfo(detail);
    },
    []
  );

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isManualSaving, setIsManualSaving] = useState<boolean>(false);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ id: number, matricule: string, nom_prenom: string, role: string } | null>(() => {
    try {
      const saved = localStorage.getItem("currentUser");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("currentUser");
    }
  }, [currentUser]);

  // Re-verify and sync currentUser role and details from live database (Supabase & SQLite)
  useEffect(() => {
    if (currentUser) {
      const query = currentUser.id
        ? `id=${currentUser.id}`
        : currentUser.matricule
        ? `matricule=${encodeURIComponent(currentUser.matricule)}`
        : `nom_prenom=${encodeURIComponent(currentUser.nom_prenom)}`;

      fetch(`/api/auth/me?${query}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            if (
              data.user.role !== currentUser.role ||
              data.user.nom_prenom !== currentUser.nom_prenom ||
              data.user.matricule !== currentUser.matricule
            ) {
              console.log(`[Auth Sync] Updated user profile from DB: role "${currentUser.role}" -> "${data.user.role}"`);
              setCurrentUser((prev) => (prev ? { ...prev, ...data.user } : null));
            }
          }
        })
        .catch((err) => console.warn("[Auth Sync] Could not refresh currentUser from DB:", err));
    }
  }, [currentUser?.id, currentUser?.matricule]);
  const [historyCache, setHistoryCache] = useState<Record<string, HistoryRecord[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  /** Set only when user clicks Edit from Historique — Save then updates that folio. */
  const [editingFolio, setEditingFolio] = useState<{ wellId: string; folio: string } | null>(null);
  const editingFolioRef = useRef<{ wellId: string; folio: string } | null>(editingFolio);
  const wellsRef = useRef<WellData[]>([]);
  const activeWellIdRef = useRef(activeWellId);

  useEffect(() => {
    editingFolioRef.current = editingFolio;
  }, [editingFolio]);

  useEffect(() => {
    wellsRef.current = wells;
  }, [wells]);

  useEffect(() => {
    activeWellIdRef.current = activeWellId;
  }, [activeWellId]);

  // States for Smart Search and perimeter / year classification
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedPerimeter, setSelectedPerimeter] = useState<string>("TOUT");
  const [selectedYear, setSelectedYear] = useState<string>("TOUT");
  const [savedPerimetres, setSavedPerimetres] = useState<string[]>([]);
  const [fullPerimetresList, setFullPerimetresList] = useState<Perimetre[]>([]);

  // Fetch perimetres from database (SQLite & Supabase)
  const fetchPerimetres = async () => {
    try {
      const res = await fetch("/api/perimetres");
      if (res.ok) {
        const data = await res.json();
        if (data.names && Array.isArray(data.names)) {
          setSavedPerimetres(data.names);
        }
        if (data.perimetres && Array.isArray(data.perimetres)) {
          setFullPerimetresList(data.perimetres);
        }
      }
    } catch (e) {
      console.warn("Could not fetch perimetres:", e);
    }
  };

  useEffect(() => {
    fetchPerimetres();
  }, []);

  // Newly created wells (before manual save) where Folio N° input remains active
  const [newWellIds, setNewWellIds] = useState<Set<string>>(new Set());

  // Toast alert notification state (slide-in from top right)
  const [toast, setToast] = useState<{
    id: number;
    title: string;
    message: string;
  } | null>(null);

  const showToast = (message: string, title = "Attention") => {
    const id = Date.now();
    setToast({ id, title, message });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  // Custom non-blocking dialog state for iframe compatibility
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: "alert" | "confirm";
    title: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  const clearEditingFolio = () => {
    editingFolioRef.current = null;
    setEditingFolio(null);
  };

  const setEditingFolioContext = (ctx: { wellId: string; folio: string }) => {
    const normalized = { wellId: ctx.wellId, folio: normalizeFolio(ctx.folio) };
    editingFolioRef.current = normalized;
    setEditingFolio(normalized);
  };

  /** Normal Fiche Technique navigation — next Save creates a new folio. */
  const openFicheTechnique = () => {
    clearEditingFolio();
    setActiveTab("metadata");
  };

  // Clear any stale edit flag left from a previous browser session
  useEffect(() => {
    try {
      sessionStorage.removeItem("wellbore_edit_folio");
    } catch {
      /* ignore */
    }
  }, []);

  const showAlert = (title: string, message: string) => {
    setDialog({
      isOpen: true,
      type: "alert",
      title,
      message,
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialog({
      isOpen: true,
      type: "confirm",
      title,
      message,
      onConfirm,
    });
  };

  // Load from Supabase (Real-time direct database fetch on mount)
  useEffect(() => {
    const loadFromSupabase = async () => {
      setIsInitialLoading(true);
      try {
        // Fetch custom tool types first to populate TUBING_COMPONENT_MATRIX
        try {
          const toolRes = await fetch("/api/supabase/custom-tool-types");
          if (toolRes.ok) {
            const contentType = toolRes.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const toolData = await toolRes.json();
              if (toolData.success && toolData.data) {
                updateTubingComponentMatrix(toolData.data);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to load custom tool types:", err);
        }

        const response = await fetch("/api/supabase/pull-wells", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const result = await response.json();
            if (result.success && result.wells && result.wells.length > 0) {
              setWells(result.wells);
              setActiveWellId(result.wells[0].id);
              console.log("Loaded wells directly from real-time database.");
            } else {
              const templates = getDefaultTemplateWells();
              setWells(templates);
              setActiveWellId(templates[0].id);
            }
          }
        } else {
          const templates = getDefaultTemplateWells();
          setWells(templates);
          setActiveWellId(templates[0].id);
        }
      } catch (err) {
        console.warn("Database retrieval failed, using fallback templates:", err);
        const templates = getDefaultTemplateWells();
        setWells(templates);
        setActiveWellId(templates[0].id);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadFromSupabase();
  }, []);

  // Get unique perimeters strictly from database (SQLite & Supabase)
  const uniquePerimeters = (
    fullPerimetresList.length > 0
      ? fullPerimetresList.map((p) => p.name.trim())
      : savedPerimetres.map((s) => s.trim())
  )
    .filter(Boolean)
    .filter((val, idx, arr) => arr.indexOf(val) === idx)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  // Get unique years from all wells
  const uniqueYears = Array.from(
    new Set(
      wells
        .map((w) => {
          if (w.createdAt) {
            try {
              const yr = new Date(w.createdAt).getFullYear();
              if (!isNaN(yr)) return String(yr);
            } catch (e) {}
          }
          return String(new Date().getFullYear());
        })
        .filter(Boolean)
    )
  ).sort((a, b) => b.localeCompare(a));

  // Filtered list of wells using Perimeter, Year and Smart Search
  const filteredWells = wells.filter((well) => {
    // 1. Perimeter filter
    if (selectedPerimeter !== "TOUT") {
      const pVal = well.field || "";
      if (pVal.trim().toLowerCase() !== selectedPerimeter.trim().toLowerCase()) {
        return false;
      }
    }

    // 2. Year filter
    if (selectedYear !== "TOUT") {
      let wellYear = String(new Date().getFullYear());
      if (well.createdAt) {
        try {
          const yr = new Date(well.createdAt).getFullYear();
          if (!isNaN(yr)) wellYear = String(yr);
        } catch (e) {}
      }
      if (wellYear !== selectedYear) {
        return false;
      }
    }

    // 3. Smart Search (searches multiple well fields)
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      const nameMatch = (well.name || "").toLowerCase().includes(q);
      const permMatch = (well.field || "").toLowerCase().includes(q);
      const resMatch = (well.reservoir || "").toLowerCase().includes(q);
      const folioMatch = (well.folio || "").toLowerCase().includes(q);
      const purposeMatch = (well.purpose || "").toLowerCase().includes(q);
      const compMatch = (well.completionType || "").toLowerCase().includes(q);

      return nameMatch || permMatch || resMatch || folioMatch || purposeMatch || compMatch;
    }

    return true;
  });

  // Historique: specific well → only that well's folios; "TOUS LES PUITS" → all wells in current périmètre/filters
  const historyWellIds = useMemo(() => {
    if (activeTab !== "history") {
      return activeWellId && activeWellId !== "TOUT" ? [activeWellId] : [];
    }
    if (activeWellId === "TOUT") {
      return filteredWells.map((w) => w.id);
    }
    if (activeWellId) {
      return [activeWellId];
    }
    return filteredWells.map((w) => w.id);
  }, [activeTab, activeWellId, filteredWells]);

  const displayedHistory = useMemo(() => {
    let records = historyWellIds.flatMap((id) => historyCache[id] || []);
    // When a single well is selected, only show folios belonging to that well
    if (activeTab === "history" && activeWellId && activeWellId !== "TOUT") {
      records = records.filter((r) => r.snapshot?.id === activeWellId);
    }
    return records.sort((a, b) => {
      const folioA = parseInt(a.folio || "0", 10);
      const folioB = parseInt(b.folio || "0", 10);
      if (folioA !== folioB) {
        return folioB - folioA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [historyWellIds, historyCache, activeTab, activeWellId]);

  // Fetch history for all wells in scope (single well or combined list)
  useEffect(() => {
    if (historyWellIds.length === 0) return;

    const missingIds = historyWellIds.filter((id) => historyCache[id] === undefined);
    if (missingIds.length === 0) {
      setLoadingHistory(false);
      return;
    }

    let isSubscribed = true;
    setLoadingHistory(true);

    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          missingIds.map(async (wellId) => {
            const res = await fetch(`/api/supabase/well-history/${wellId}`);
            if (!res.ok) return { wellId, history: [] as HistoryRecord[] };
            const data = await res.json();
            return { wellId, history: data.success ? data.history || [] : [] };
          })
        );
        if (!isSubscribed) return;
        setHistoryCache((prev) => {
          const next = { ...prev };
          for (const { wellId, history } of results) {
            next[wellId] = history;
          }
          return next;
        });
      } catch (err) {
        console.warn("Could not fetch well history:", err);
      } finally {
        if (isSubscribed) setLoadingHistory(false);
      }
    };

    fetchAll();
    return () => {
      isSubscribed = false;
    };
  }, [historyWellIds.join("|")]);

  // Find active well
  const activeWell =
    activeWellId === "TOUT"
      ? filteredWells[0] || wells[0]
      : filteredWells.find((w) => w.id === activeWellId) || filteredWells[0] || wells[0];

  // Fallback activeCategory if active well purpose is PPE (hide perforations, show liner_crepine) or not PPE (hide liner_crepine)
  useEffect(() => {
    const isPPE = activeWell?.purpose?.trim().toUpperCase() === "PPE";
    if (activeCategory === "liner_crepine" && !isPPE) {
      setActiveCategory("params");
    }
    if (activeCategory === "perforations" && isPPE) {
      setActiveCategory("params");
    }
  }, [activeWell?.purpose, activeCategory]);

  // Keep activeWellId in sync when current selection is no longer in filtered list
  useEffect(() => {
    if (activeWellId === "TOUT") return;

    // Do not auto-switch the active well if the user is currently editing it
    if (activeTab === "metadata" || activeTab === "wellbore" || activeTab === "perforations") {
      return;
    }

    const stillInList = filteredWells.some((w) => w.id === activeWellId);
    if (!stillInList && activeWell) {
      setActiveWellId(activeWell.id);
    }
  }, [activeWell, activeWellId, filteredWells, activeTab]);

  // "TOUT" is only valid on Historique tab
  useEffect(() => {
    if (activeTab !== "history" && activeWellId === "TOUT") {
      const first = filteredWells[0];
      if (first) setActiveWellId(first.id);
    }
  }, [activeTab, activeWellId, filteredWells]);

  // Check if active well name is a duplicate
  const isCurrentWellNameDuplicate = useMemo(() => {
    if (!activeWell) return false;
    const trimmed = activeWell.name.trim().toLowerCase();
    if (!trimmed) return true;
    return wells.some(
      (w) => w.id !== activeWell.id && w.name.trim().toLowerCase() === trimmed
    );
  }, [wells, activeWell]);

  // Handle active well state changes smoothly without blocking typing
  const handleWellChange = (updatedWell: WellData) => {
    const trimmed = updatedWell.name.trim();
    if (trimmed) {
      const isDuplicate = wells.some(
        (w) =>
          w.id !== updatedWell.id &&
          w.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (isDuplicate) {
        showToast(
          `Un puits nommé « ${trimmed} » existe déjà ! Veuillez choisir un nom unique.`,
          "Puits existant"
        );
      }
    }

    setWells((prev) =>
      prev.map((w) => (w.id === updatedWell.id ? updatedWell : w))
    );
  };

  // Validate well name on input blur (when user finishes editing name)
  const validateWellNameOnBlur = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !activeWellId) return;
    const isDuplicate = wells.some(
      (w) =>
        w.id !== activeWellId &&
        w.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      showToast(
        `Un puits nommé « ${trimmed} » existe déjà ! Veuillez choisir un nom unique.`,
        "Puits existant"
      );
    }
  };

  // Create a new well completion card directly & navigate to Well Identification & Parameters
  const createNewWell = () => {
    let count = wells.length + 1;
    let candidateName = `NEW WELL - ${count}`;
    while (
      wells.some(
        (w) => w.name.trim().toLowerCase() === candidateName.trim().toLowerCase()
      )
    ) {
      count++;
      candidateName = `NEW WELL - ${count}`;
    }

    const defaultField =
      selectedPerimeter !== "TOUT"
        ? selectedPerimeter
        : uniquePerimeters.length > 0
        ? uniquePerimeters[0]
        : "";

    const newWell: WellData = {
      id: `well-${Date.now()}`,
      name: candidateName,
      purpose: "PPH",
      completionType: "COMPLETION SIMPLE",
      reservoir: "",
      field: defaultField,
      elevationSol: 0,
      elevationForage: 0,
      elevationProduction: 0,
      folio: "01",
      folioToCancel: "00",
      casings: [],
      tubings: [],
      perforations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWells((prev) => [...prev, newWell]);
    setNewWellIds((prev) => new Set(prev).add(newWell.id));
    setActiveWellId(newWell.id);
    clearEditingFolio();
    setActiveTab("metadata");
    setActiveCategory("params");
  };

  // Delete a well by its ID
  const deleteWell = (id: string) => {
    const wellToDelete = wells.find((w) => w.id === id);
    if (!wellToDelete) return;
    if (wells.length <= 1) {
      showAlert(
        "Cannot Delete Well",
        "Cannot delete the only well completion card. Please create another one first."
      );
      return;
    }
    showConfirm(
      "Confirm Well Deletion",
      `Are you sure you want to permanently delete the completion card for ${wellToDelete.name}?`,
      async () => {
        const remaining = wells.filter((w) => w.id !== id);
        setWells(remaining);
        if (activeWellId === id) {
          setActiveWellId(remaining[0].id);
          clearEditingFolio();
        }

        // Delete from database directly
        try {
          const response = await fetch("/api/supabase/delete-well", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const result = await response.json();
          if (result.success) {
            console.log("Well successfully deleted from database.");
            // Clean historyCache
            setHistoryCache((prev) => {
              const updated = { ...prev };
              delete updated[id];
              return updated;
            });
          } else {
            console.error("Failed to delete well from database:", result.error);
          }
        } catch (err) {
          console.warn("Could not delete well from database:", err);
        }
      }
    );
  };

  // Delete current well
  const deleteActiveWell = () => {
    deleteWell(activeWellId);
  };

  const userRole = (currentUser?.role || "").toLowerCase().trim();
  const isUser   = userRole === "user";
  const isChief  = userRole === "chief" || userRole === "cheif";
  const isAdmin  = userRole === "admin";
  const isOwner  = userRole === "owner";

  const canViewFicheTechnique = !isUser;
  const canViewCustomTools    = !isUser;
  const canViewEmployees      = isOwner;
  const canViewPerimetres     = isOwner;
  const canAddOrEdit          = isChief || isAdmin || isOwner;
  const canDelete             = isAdmin  || isOwner;
  const canLibrary            = isAdmin  || isOwner;

  useEffect(() => {
    if (activeTab === "perimetres" && !canViewPerimetres) {
      setActiveTab("dashboard");
    }
    if (activeTab === "employees" && !canViewEmployees) {
      setActiveTab("dashboard");
    }
    if (activeTab === "metadata" && !canViewFicheTechnique) {
      setActiveTab("dashboard");
    }
    if (activeTab === "custom_tools" && !canViewCustomTools) {
      setActiveTab("dashboard");
    }
  }, [activeTab, canViewPerimetres, canViewEmployees, canViewFicheTechnique, canViewCustomTools]);

  const editHistoryRecord = (record: HistoryRecord) => {
    const snapshot = record.snapshot;
    if (!snapshot?.id) return;
    showConfirm(
      "Modifier ce folio",
      `Charger le folio N° ${record.folio} de ${snapshot.name} pour modification ? Les données actuelles seront remplacées.`,
      () => {
        setWells((prev) => prev.map((w) => (w.id === snapshot.id ? { ...snapshot } : w)));
        setActiveWellId(snapshot.id);
        setEditingFolioContext({
          wellId: snapshot.id,
          folio: record.folio || snapshot.folio || "00",
        });
        setActiveTab("metadata");
        setActiveCategory("params");
      }
    );
  };

  const deleteHistoryRecord = (record: HistoryRecord) => {
    const wellName = record.snapshot?.name || "ce puits";
    showConfirm(
      "Supprimer ce folio",
      `Supprimer définitivement le folio N° ${record.folio} de ${wellName} ?`,
      async () => {
        try {
          const res = await fetch(`/api/supabase/well-history/${record.id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok || !data.success) {
            showAlert("Erreur", data.error || "Impossible de supprimer ce folio.");
            return;
          }
          const wellKey = record.snapshot?.id;
          if (wellKey) {
            setHistoryCache((prev) => ({
              ...prev,
              [wellKey]: (prev[wellKey] || []).filter((r) => r.id !== record.id),
            }));
          }
        } catch (err) {
          console.warn("Could not delete history record:", err);
          showAlert("Erreur", "Impossible de supprimer ce folio.");
        }
      }
    );
  };

  // Manual save of active well to Supabase
  const saveWellToDb = async () => {
    const currentWellId = activeWellIdRef.current;
    const activeWell = wellsRef.current.find((w) => w.id === currentWellId);
    if (!activeWell) return;

    const trimmedName = activeWell.name.trim();
    if (!trimmedName) {
      showToast("Veuillez saisir un nom pour le puits.", "Nom requis");
      return;
    }

    const isDuplicate = wellsRef.current.some(
      (w) =>
        w.id !== currentWellId &&
        w.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      showToast(
        `Un puits nommé « ${trimmedName} » existe déjà ! Veuillez choisir un nom unique.`,
        "Puits existant"
      );
      return;
    }

    const ctxAtClick = editingFolioRef.current;
    const wellIdAtClick = activeWellIdRef.current;
    const isUpdatingAtClick =
      ctxAtClick?.wellId === wellIdAtClick && !!ctxAtClick?.folio;

    showConfirm(
      "Confirmation d'Enregistrement",
      isUpdatingAtClick
        ? `Enregistrer les modifications dans le Folio N° ${ctxAtClick!.folio} ?\nLe folio existant sera mis à jour (aucun nouveau folio ne sera créé).`
        : "IMPORTANT :\nSi vous enregistrez, un nouveau folio sera créé dans l'historique.\nÊtes-vous sûr de vouloir enregistrer ?",
      async () => {
        const ctx = editingFolioRef.current;
        const currentWellId = activeWellIdRef.current;
        const activeWell = wellsRef.current.find((w) => w.id === currentWellId);
        if (!activeWell) return;

        const isUpdatingFolio = ctx?.wellId === currentWellId && !!ctx?.folio;
        const folioToUpdate = isUpdatingFolio ? normalizeFolio(ctx!.folio) : undefined;

        const { saveAsFolio: _ignored, ...wellBase } = activeWell as WellData & {
          saveAsFolio?: string;
        };
        const wellToSave: WellData & { saveAsFolio?: string } = {
          ...wellBase,
          updatedDate: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString(),
          ...(folioToUpdate ? { saveAsFolio: folioToUpdate } : {}),
        };

        setIsManualSaving(true);
        try {
          const response = await fetch("/api/supabase/push-wells", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wells: [wellToSave],
              editedBy: currentUser?.nom_prenom || "Abdelhalim",
              ...(folioToUpdate
                ? { updateFolio: folioToUpdate, updateWellId: currentWellId }
                : {}),
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const serverResult = result.results?.[0];
            if (result.success && serverResult?.success) {
              const realFolio = serverResult.folio || "00";
              const realFolioToCancel = serverResult.folioToCancel || "00";
              const wellWithRealFolio = {
                ...wellToSave,
                folio: realFolio,
                folioToCancel: realFolioToCancel,
              };

              setWells((prev) =>
                prev.map((w) => (w.id === currentWellId ? wellWithRealFolio : w))
              );
              setNewWellIds((prev) => {
                const next = new Set(prev);
                next.delete(currentWellId);
                return next;
              });

              clearEditingFolio();

              showAlert(
                "Enregistrement Réussi",
                isUpdatingFolio
                  ? `Le Folio N° ${realFolio} de ${wellWithRealFolio.name} a été mis à jour.`
                  : `Les données du puits ${wellWithRealFolio.name} ont été enregistrées. Nouveau Folio N°: ${realFolio}`
              );

              try {
                const hRes = await fetch(`/api/supabase/well-history/${currentWellId}`);
                if (hRes.ok) {
                  const hData = await hRes.json();
                  if (hData.success) {
                    setHistoryCache((prev) => ({
                      ...prev,
                      [currentWellId]: hData.history || [],
                    }));
                  }
                }
              } catch (hErr) {
                console.warn("Could not refresh history on save:", hErr);
              }
            } else {
              showAlert(
                "Erreur de Sauvegarde",
                result.error || result.results?.[0]?.error || "Impossible de sauvegarder."
              );
            }
          } else {
            showAlert(
              "Erreur de Sauvegarde",
              "Une erreur est survenue lors de la sauvegarde."
            );
          }
        } catch (err) {
          showAlert(
            "Erreur de Connexion",
            "Impossible de contacter le serveur de base de données."
          );
        } finally {
          setIsManualSaving(false);
        }
      }
    );
  };

  // Export Well Data as a JSON file
  const exportWellJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(wells, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `wellbore_schematic_export_${new Date().toISOString().slice(0, 10)}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download complete Database backup JSON file
  const downloadDbBackup = async () => {
    try {
      const res = await fetch("/api/backup-db");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `wellbore_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Fallback for standalone environment
        const backupPayload = {
          app: "Wellbore Pro",
          version: "1.0.5",
          exportedAt: new Date().toISOString(),
          wells: wells
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `wellbore_db_backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch {
      const backupPayload = {
        app: "Wellbore Pro",
        version: "1.0.5",
        exportedAt: new Date().toISOString(),
        wells: wells
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `wellbore_db_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  // Clear all data
  const clearAllData = () => {
      const newWell: WellData = {
        id: `well-${Date.now()}`,
        name: `NEW WELL`,
        purpose: "Oil Producer",
        completionType: "COMPLETION SIMPLE",
        reservoir: "",
        field: "",
        elevationSol: 0,
        elevationForage: 0,
        elevationProduction: 0,
        folio: "00",
        folioToCancel: "00",
        casings: [],
        tubings: [],
        perforations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setWells([newWell]);
      setActiveWellId(newWell.id);
      clearEditingFolio();
  };

  // Import Well Data from JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
            setWells(parsed);
            setActiveWellId(parsed[0].id);
            showAlert("Import Successful", "Wellbore completion library imported successfully!");
          } else {
            showAlert("Import Failed", "Invalid format. Expected an array of well completions.");
          }
        } catch (error) {
          showAlert("Import Error", "Error parsing JSON file. Please verify its content.");
        }
      };
    }
  };

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  return (
    <div
      className="min-h-screen md:h-screen md:overflow-hidden bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row font-sans relative"
      id="app_root"
    >
      {/* MOBILE TOP BAR (visible only on mobile screens < md) */}
      <div className="md:hidden bg-[#0c1222] border-b border-slate-800/80 px-4 py-3 flex items-center justify-between z-30 shrink-0 sticky top-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            id="mobile_hamburger_btn"
            onClick={() => setIsMobileNavOpen(true)}
            className="p-2 rounded-lg bg-slate-800/90 text-slate-200 hover:text-white hover:bg-slate-700 transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Ouvrir le menu de navigation"
            aria-expanded={isMobileNavOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" className="w-7 h-7 object-contain shrink-0" alt="Logo" />
            <h1 className="text-white font-bold tracking-wider text-xs font-sans uppercase">
              Wellbore Pro
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-orange-500/10 text-[#f97316] border border-orange-500/20">
            {activeTab === "dashboard" && "Tableau de Bord"}
            {activeTab === "metadata" && "Fiche Technique"}
            {activeTab === "history" && "Historique"}
            {activeTab === "custom_tools" && "Désignations"}
            {activeTab === "perimetres" && "Périmètres"}
            {activeTab === "employees" && "Employés"}
          </span>
          <div className="w-7 h-7 rounded-full bg-[#f97316] text-white font-extrabold flex items-center justify-center text-xs shadow-xs uppercase">
            {currentUser.nom_prenom.includes(" ") ? currentUser.nom_prenom.split(" ")[1].charAt(0) : currentUser.nom_prenom.charAt(0)}
          </div>
        </div>
      </div>

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR NAVIGATION (Drawer on mobile, fixed column on desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#121a2d] text-slate-300 flex flex-col justify-between border-r border-slate-800/60 shadow-2xl transition-transform duration-300 ease-in-out md:static md:w-64 lg:w-72 md:translate-x-0 md:h-screen md:shrink-0 md:shadow-xl ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        id="app_sidebar"
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800/40 flex items-center justify-between bg-[#0c1222] shrink-0">
            <div className="flex items-center gap-3.5">
              <img src="/logo.svg" className="w-10 h-10 object-contain shrink-0" alt="Logo" />
              <div>
                <h1 className="text-white font-bold tracking-wider text-sm font-sans uppercase">
                  Wellbore Pro
                </h1>
              </div>
            </div>
            {/* Close Button on Mobile */}
            <button
              onClick={() => setIsMobileNavOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Nav Links */}
          <div className="flex-1 py-5 px-4 space-y-1.5 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">
              Navigation Principale
            </p>

            <button
              id="sidebar_tab_dashboard"
              onClick={() => {
                setActiveTab("dashboard");
                setIsMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-lg transition-all ${
                activeTab === "dashboard"
                  ? "bg-[#f97316] text-white shadow-md shadow-[#f97316]/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Tableau de Bord</span>
            </button>

            {canViewFicheTechnique && (
              <button
                id="sidebar_tab_metadata"
                onClick={() => {
                  openFicheTechnique();
                  setIsMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "metadata"
                    ? "bg-[#f97316] text-white shadow-md shadow-[#f97316]/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Fiche Technique</span>
              </button>
            )}

            <button
              id="sidebar_tab_history"
              onClick={() => {
                setActiveTab("history");
                setIsMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-lg transition-all ${
                activeTab === "history"
                  ? "bg-[#f97316] text-white shadow-md shadow-[#f97316]/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Historique</span>
            </button>

            {canViewCustomTools && (
              <button
                onClick={() => {
                  setActiveTab("custom_tools");
                  setIsMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-bold rounded-lg transition-all text-left ${
                  activeTab === "custom_tools"
                    ? "bg-[#f97316] text-white shadow-md shadow-[#f97316]/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Désignations & Composants</span>
              </button>
            )}

            {canViewPerimetres && (
              <button
                id="sidebar_tab_perimetres"
                onClick={() => {
                  setActiveTab("perimetres");
                  setIsMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "perimetres"
                    ? "bg-[#f97316] text-white shadow-md shadow-[#f97316]/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Gestion des Périmètres</span>
              </button>
            )}

            {canViewEmployees && (
              <button
                id="sidebar_tab_employees"
                onClick={() => {
                  setActiveTab("employees");
                  setIsMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "employees"
                    ? "bg-[#f97316] text-white shadow-md shadow-[#f97316]/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Gestion des Employés</span>
              </button>
            )}
          </div>

          {/* Library Section (Bottom half of Sidebar) — Shown only for Admins/Owners */}
          {canLibrary && (
            <div className="px-4 py-4 border-t border-slate-800/40 space-y-2 shrink-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
                Bibliothèque
              </p>

              <button
                id="sidebar_action_download_db"
                onClick={() => {
                  downloadDbBackup();
                  setIsMobileNavOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 transition-all text-left"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Download DB</span>
              </button>

              <button
                id="sidebar_action_export"
                onClick={() => {
                  exportWellJson();
                  setIsMobileNavOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all text-left"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter Données</span>
              </button>

              <label
                htmlFor="import_json_input_sidebar"
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold rounded-md text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all text-left cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer JSON</span>
                <input
                  id="import_json_input_sidebar"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    handleImportJson(e);
                    setIsMobileNavOpen(false);
                  }}
                />
              </label>

              <button
                id="sidebar_action_reset"
                onClick={() => {
                  clearAllData();
                  setIsMobileNavOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[11px] font-bold rounded-md text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-all text-left"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            </div>
          )}
        </div>

        {/* Profile Container at Sidebar bottom */}
        <div className="p-4 bg-[#0c1222] border-t border-slate-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#f97316] text-white font-extrabold flex items-center justify-center text-sm shadow-sm uppercase">
              {currentUser.nom_prenom.includes(" ") ? currentUser.nom_prenom.split(" ")[1].charAt(0) : currentUser.nom_prenom.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-white font-sans truncate max-w-[120px]" title={currentUser.nom_prenom}>
                {currentUser.nom_prenom.includes(" ") ? currentUser.nom_prenom.split(" ").slice(1).join(" ") : currentUser.nom_prenom}
              </p>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider uppercase font-mono">
                {currentUser.role}
              </p>
            </div>
          </div>
          <button onClick={() => { setCurrentUser(null); setIsMobileNavOpen(false); }} className="p-1.5 hover:bg-slate-800 rounded-md transition text-slate-400 hover:text-white" title="Se déconnecter">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </aside>

      {/* RIGHT SIDE CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 md:h-full md:overflow-hidden" id="main_content_wrapper">
        {/* MAIN PAGE HEADER BAR */}
        {activeTab !== "employees" && (
          <header className="px-4 sm:px-6 py-4 sm:py-6 border-b border-slate-200/60 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-3">
                {activeTab === "dashboard" && categoryDetailInfo && (
                  <button
                    onClick={categoryDetailInfo.onBack}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Retour
                  </button>
                )}
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 font-sans tracking-tight">
                  {activeTab === "dashboard" && (
                    categoryDetailInfo
                      ? `${categoryDetailInfo.label} - ${categoryDetailInfo.desc} Details`
                      : "Tableau de Bord des Puits"
                  )}
                  {activeTab === "history" && "Historique"}
                  {activeTab === "metadata" && "Fiche Technique"}
                  {activeTab === "custom_tools" && "Désignations & Composants"}
                  {activeTab === "perimetres" && "Gestion des Périmètres"}
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {activeTab === "dashboard" && (
                  categoryDetailInfo
                    ? "High fidelity asset management"
                    : "Aperçu global, caractéristiques techniques et indicateurs clés de l'ensemble des puits."
                )}
                {activeTab === "history" && "Suivi, consultations et rapports des folios générés pour votre structure."}
                {activeTab === "metadata" && "Suivi, consultations, caractéristiques techniques, architecture de puits, casings, tubings et perforations."}
                {activeTab === "custom_tools" && "Gérez les types de composants tubings et leurs désignations."}
                {activeTab === "perimetres" && "Associez des abréviations de puits aux périmètres pour la détection automatique lors de la saisie."}
              </p>
            </div>
          </header>
        )}

        {/* WORKSPACE & SCHEMATIC WRAPPER */}
        {activeWell ? (
          <main className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto" id="app_main_content">
            {/* SEARCH & FILTERS BAR ROW */}
            {activeTab !== "dashboard" && activeTab !== "custom_tools" && activeTab !== "employees" && activeTab !== "perimetres" && (
              <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/60 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 w-full max-w-full overflow-hidden" id="well_filters_row">
                <div className="flex flex-1 flex-wrap items-center gap-2.5 sm:gap-3 w-full">
                  {/* Smart Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Recherche intelligente..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-orange-500 focus:bg-white transition-all text-slate-800"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Périmètre selector */}
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 gap-2 grow sm:grow-0">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-sans shrink-0">
                      Périmètre:
                    </span>
                    <select
                      className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer pr-4 border-none py-0.5 w-full sm:w-auto"
                      value={selectedPerimeter}
                      onChange={(e) => setSelectedPerimeter(e.target.value)}
                    >
                      <option value="TOUT">TOUS LES PÉRIMÈTRES</option>
                      {uniquePerimeters.map((perm) => (
                        <option key={perm} value={perm}>
                          {perm.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Year picker */}
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 gap-2 grow sm:grow-0">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-sans shrink-0">
                      Année:
                    </span>
                    <select
                      className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer pr-4 border-none py-0.5 w-full sm:w-auto"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      <option value="TOUT">TOUTES LES ANNÉES</option>
                      {uniqueYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Well select list */}
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 gap-2 grow sm:grow-0">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-sans shrink-0">
                      Puits Actif:
                    </span>
                    <select
                      id="header_well_selector"
                      className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer pr-4 border-none py-0.5 w-full sm:w-auto"
                      value={activeWellId}
                      onChange={(e) => {
                        clearEditingFolio();
                        setActiveWellId(e.target.value);
                      }}
                    >
                      {activeTab === "history" && (
                        <option value="TOUT" className="text-slate-800 bg-white">
                          TOUS LES PUITS
                        </option>
                      )}
                      {filteredWells.map((w) => (
                        <option key={w.id} value={w.id} className="text-slate-800 bg-white">
                          {w.name}
                        </option>
                      ))}
                      {activeWell && activeWellId !== "TOUT" && !filteredWells.some((w) => w.id === activeWellId) && (
                        <option value={activeWellId} className="text-slate-800 bg-white">
                          {activeWell.name}
                        </option>
                      )}
                      {filteredWells.length === 0 && !activeWell && (
                        <option value="" disabled className="text-slate-400 bg-white">
                          Aucun puits
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Add & Delete Controls */}
                <div className="flex items-center justify-end gap-2 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {editingFolio?.wellId === activeWellId && (
                    <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                      Modif. Folio {editingFolio.folio}
                    </span>
                  )}
                  {canAddOrEdit && (
                    <button
                      id="header_btn_create"
                      onClick={createNewWell}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 transition shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Ajouter un Puits</span>
                      <span className="xs:hidden">Ajouter</span>
                    </button>
                  )}

                  <button
                    onClick={() => setIsPrintOpen(true)}
                    className="flex items-center justify-center bg-[#f97316] hover:bg-[#ea580c] active:scale-95 text-white p-2 sm:p-2.5 rounded-lg transition shadow-2xs"
                    title="Imprimer Rapport A4"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {canAddOrEdit && (
                    <button
                      onClick={saveWellToDb}
                      disabled={isManualSaving}
                      className={`flex items-center justify-center ${
                        isManualSaving
                          ? "bg-slate-300 cursor-not-allowed text-slate-500"
                          : "bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white"
                      } p-2 sm:p-2.5 rounded-lg transition shadow-2xs`}
                      title={
                        isManualSaving
                          ? "Enregistrement..."
                          : editingFolio?.wellId === activeWellId
                            ? `Mettre à jour le Folio N° ${editingFolio.folio}`
                            : "Enregistrer (nouveau folio)"
                      }
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      id="header_btn_delete"
                      onClick={deleteActiveWell}
                      className={`bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 text-xs font-bold p-2 sm:p-2.5 rounded-lg border border-slate-200 transition ${activeTab === "history" ? "hidden" : ""}`}
                      title="Supprimer le Puits actif"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TWO-COLUMN GRID: TAB CORES AND WELL SCHEMATIC */}
            <div className={activeTab === "dashboard" || activeTab === "history" || activeTab === "custom_tools" || activeTab === "employees" || activeTab === "perimetres" ? "w-full" : "grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch w-full min-w-0 max-w-full"}>
              {/* Left Column: Form Editors */}
              <section className={activeTab === "dashboard" || activeTab === "history" || activeTab === "custom_tools" || activeTab === "employees" || activeTab === "perimetres" ? "w-full" : "lg:col-span-7 xl:col-span-7 min-w-0 flex flex-col"} id="left_form_workspace">
                <div className="min-h-[500px] flex flex-col h-full" id="tab_panels_scroller">
                  {activeTab === "custom_tools" && (
                    <CustomToolsModal canAddOrEdit={canAddOrEdit} canDelete={canDelete} />
                  )}
                  {activeTab === "dashboard" && (
                    <WellDashboard
                      wells={wells}
                      activeWellId={activeWellId}
                      onSelectWell={(id) => setActiveWellId(id)}
                      onNavigateToTab={(tab) => {
                        if (tab === "wellbore") {
                          clearEditingFolio();
                          setActiveTab("metadata");
                          setActiveCategory("architecture");
                        } else if (tab === "perforations") {
                          clearEditingFolio();
                          setActiveTab("metadata");
                          setActiveCategory("perforations");
                        } else {
                          if (tab === "metadata") clearEditingFolio();
                          setActiveTab(tab);
                        }
                      }}
                      onCreateNewWell={createNewWell}
                      onDeleteWell={deleteWell}
                      onCategoryDetailChange={handleCategoryDetailChange}
                    />
                  )}
                  {activeTab === "metadata" && (
                    <div className="space-y-4 sm:space-y-6">
                      {/* Sub-categories Category Bar */}
                      <div className="flex overflow-x-auto sm:flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-xl border border-slate-200/50 scrollbar-none w-full" id="metadata_subcategories_tabs">
                        <button
                          onClick={() => setActiveCategory("params")}
                          className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                            activeCategory === "params"
                              ? "bg-[#f97316] text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                          }`}
                        >
                          <span>Paramètres</span>
                        </button>
                        
                        <button
                          onClick={() => setActiveCategory("architecture")}
                          className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                            activeCategory === "architecture"
                              ? "bg-[#f97316] text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                          }`}
                        >
                          <span>Wellbore</span>
                        </button>

                        {/* Perforations tab - HIDDEN when purpose is PPE */}
                        {activeWell?.purpose?.trim().toUpperCase() !== "PPE" && (
                          <button
                            onClick={() => setActiveCategory("perforations")}
                            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                              activeCategory === "perforations"
                                ? "bg-[#f97316] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                            }`}
                          >
                            <span>Perforations</span>
                          </button>
                        )}

                        {/* Liner Crépine tab - ONLY visible when purpose is PPE */}
                        {activeWell?.purpose?.trim().toUpperCase() === "PPE" && (
                          <button
                            onClick={() => setActiveCategory("liner_crepine")}
                            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                              activeCategory === "liner_crepine"
                                ? "bg-[#f97316] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                            }`}
                          >
                            <span>Liner Crépine</span>
                          </button>
                        )}

                        {/* SRP tab - ONLY visible when purpose is PPH (SRP) or has srpComponents */}
                        {(activeWell?.purpose?.includes("SRP") || (activeWell?.srpComponents || []).length > 0) && (
                          <button
                            onClick={() => setActiveCategory("srp")}
                            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                              activeCategory === "srp"
                                ? "bg-[#f97316] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                            }`}
                          >
                            <span>SRP</span>
                          </button>
                        )}
                      </div>

                      {/* Display the active Category form */}
                      <div className="transition-all duration-300">
                        {activeCategory === "params" && (
                          <WellMetadataForm
                            well={activeWell}
                            onChange={handleWellChange}
                            isFolioEditable={activeWell ? newWellIds.has(activeWell.id) : false}
                            onValidateName={validateWellNameOnBlur}
                            isDuplicateName={isCurrentWellNameDuplicate}
                            perimetersList={uniquePerimeters}
                            fullPerimetres={fullPerimetresList}
                          />
                        )}
                        {activeCategory === "architecture" && (
                          <WellboreForm
                            well={activeWell}
                            onChange={handleWellChange}
                            canAddOrEdit={canAddOrEdit}
                            canDelete={canDelete}
                          />
                        )}
                        {activeCategory === "perforations" && activeWell?.purpose?.trim().toUpperCase() !== "PPE" && (
                          <PerforationForm
                            well={activeWell}
                            onChange={handleWellChange}
                            canAddOrEdit={canAddOrEdit}
                            canDelete={canDelete}
                          />
                        )}
                        {activeCategory === "liner_crepine" && activeWell?.purpose?.trim().toUpperCase() === "PPE" && (
                          <LinerCrepineForm
                            well={activeWell}
                            onChange={handleWellChange}
                            canAddOrEdit={canAddOrEdit}
                            canDelete={canDelete}
                          />
                        )}
                        {activeCategory === "srp" && (activeWell?.purpose?.includes("SRP") || (activeWell?.srpComponents || []).length > 0) && (
                          <SrpForm
                            well={activeWell}
                            onChange={handleWellChange}
                            canAddOrEdit={canAddOrEdit}
                            canDelete={canDelete}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  {activeTab === "history" && (
                    <WellHistory
                      wellId={activeWellId}
                      history={displayedHistory}
                      loading={loadingHistory}
                      combinedView={activeWellId === "TOUT"}
                      isAdmin={canDelete}
                      onEdit={canAddOrEdit ? editHistoryRecord : undefined}
                      onDelete={canDelete ? deleteHistoryRecord : undefined}
                    />
                  )}

                  {activeTab === "perimetres" && canViewPerimetres && (
                    <PerimetresManagement onPerimetresUpdated={fetchPerimetres} />
                  )}

                  {activeTab === "employees" && canViewEmployees && (
                    <EmployeeManagement currentUserId={currentUser?.id} />
                  )}
                </div>
              </section>

              {/* Right Column: Schematic Draw Box */}
              {activeTab !== "dashboard" && activeTab !== "history" && activeTab !== "custom_tools" && activeTab !== "employees" && activeTab !== "perimetres" && (
                <section className="lg:col-span-5 xl:col-span-5 w-full min-w-0 flex flex-col" id="right_schematic_rail">
                  <div className="sticky top-6 h-full flex flex-col" id="sticky_rail_wrapper">
                    <WellboreSchematic well={activeWell} onChange={handleWellChange} />
                  </div>
                </section>
              )}
            </div>
          </main>
        ) : (
          <div
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
            id="empty_state"
          >
            <Database className="w-12 h-12 text-slate-300 animate-pulse mb-3" />
            <h3 className="font-sans font-bold text-slate-800 text-sm">
              Initializing Wellbore Database...
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Please wait while the platform loads completion tallies and renders
              structural schematics.
            </p>
          </div>
        )}


      </div>

      {/* GLOBAL PRINT MODAL OVERLAY */}
      {isPrintOpen && (
        <WellboreA4Print
          well={activeWell}
          onClose={() => setIsPrintOpen(false)}
        />
      )}

      {/* Custom Dialog Modal */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="custom_dialog_modal">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-sans">{dialog.title}</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{dialog.message}</p>
            </div>
            <div className="flex justify-end gap-2.5">
              {dialog.type === "confirm" && (
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (dialog.type === "confirm" && dialog.onConfirm) {
                    dialog.onConfirm();
                  }
                  setDialog(null);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition ${
                  dialog.type === "confirm" && dialog.title.includes("Delete")
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-[#f97316] hover:bg-[#ea580c]"
                }`}
              >
                {dialog.type === "confirm" ? "Confirm" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-Right Slide-in Toast Notification for Errors & Duplicate Alerts */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 120, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="fixed top-5 right-5 z-[9999] max-w-sm w-full pointer-events-auto"
            id="toast_alert_container"
          >
            <div className="bg-[#121a2d] text-white border border-rose-500/40 rounded-xl shadow-2xl p-4 overflow-hidden relative backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg shrink-0 border border-rose-500/30">
                  <AlertCircle className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-sans">
                      {toast.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1.5 leading-relaxed font-medium">
                    {toast.message.split(/(«[^»]+»)/g).map((part, idx) =>
                      part.startsWith("«") && part.endsWith("»") ? (
                        <span key={idx} className="font-bold text-[#f97316] px-0.5">
                          {part}
                        </span>
                      ) : (
                        <span key={idx}>{part}</span>
                      )
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition shrink-0"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress timer bar */}
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4.5, ease: "linear" }}
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-orange-500"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
