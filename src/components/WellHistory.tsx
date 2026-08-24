import React, { useState, useEffect } from "react";
import { WellData } from "../types";
import { Eye, Clock, Pencil, Trash2, Database } from "lucide-react";
import WellboreA4Print from "./WellboreA4Print";

export interface HistoryRecord {
  id: string;
  folio: string;
  snapshot: WellData;
  created_at: string;
  updated_at?: string;
  edited_by?: string;
}

interface WellHistoryProps {
  wellId: string;
  history?: HistoryRecord[];
  loading?: boolean;
  combinedView?: boolean;
  isAdmin?: boolean;
  onEdit?: (record: HistoryRecord) => void;
  onDelete?: (record: HistoryRecord) => void;
}

export default function WellHistory({
  wellId,
  history: propHistory,
  loading: propLoading,
  combinedView,
  isAdmin = false,
  onEdit,
  onDelete,
}: WellHistoryProps) {
  const [history, setHistory] = useState<HistoryRecord[]>(propHistory || []);
  const [loading, setLoading] = useState<boolean>(propLoading !== undefined ? propLoading : !propHistory);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<WellData | null>(null);

  useEffect(() => {
    if (propHistory) {
      setHistory(propHistory);
    }
  }, [propHistory]);

  useEffect(() => {
    if (propLoading !== undefined) {
      setLoading(propLoading);
    }
  }, [propLoading]);

  useEffect(() => {
    if (propHistory) return;

    async function fetchHistory() {
      if (!wellId || wellId === "TOUT") return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/supabase/well-history/${wellId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch history");
        }
        const data = await res.json();
        if (data.success) {
          setHistory(data.history || []);
        } else {
          throw new Error(data.error || "Failed to fetch history");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [wellId, propHistory]);

  if (selectedSnapshot) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/70 overflow-auto flex items-start justify-center">
        <WellboreA4Print
          well={selectedSnapshot}
          onClose={() => setSelectedSnapshot(null)}
          hideSchematic={false}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            Well History & Folio Tracking
          </h2>
          {loading && history.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-500 animate-pulse font-medium bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 ml-2">
              <Database className="w-3 h-3 animate-spin" />
              Mise à jour...
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 bg-slate-50/50">
        {loading && history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Database className="w-8 h-8 animate-pulse mb-3 opacity-50" />
            <p className="text-sm font-medium">Loading history records...</p>
          </div>
        ) : error && history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-rose-500">
            <p className="text-sm font-medium">⚠️ {error}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Clock className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">
              {combinedView ? "No history recorded for any well yet." : "No history recorded yet for this well."}
            </p>
            <p className="text-xs mt-1 text-slate-400">History is saved automatically when folios are updated.</p>
          </div>
        ) : (
          <div className="grid gap-1 w-full">
            {history.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-lg border border-slate-200 p-2 flex items-center justify-between hover:shadow-sm hover:border-indigo-200 transition-all group"
              >
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 min-w-0 flex-1 mr-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 whitespace-nowrap">
                      Folio N° {record.folio || "00"}
                    </h3>
                  </div>
                  
                  {/* Date de création */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 shrink-0" title="Date de création du folio">
                    <span className="font-semibold text-slate-400">Créé le :</span>
                    <span className="flex items-center gap-1 font-medium font-mono">
                      <Clock className="w-3 h-3 opacity-60 text-slate-400" />
                      {new Date(record.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  {/* Dernière modification */}
                  <div className="text-[11px] text-slate-600 flex items-center gap-1.5 shrink-0" title="Dernière modification">
                    <span className="font-semibold text-indigo-500">Modifié le :</span>
                    <span className="flex items-center gap-1 font-medium font-mono text-slate-700">
                      <Clock className="w-3 h-3 opacity-60 text-indigo-400" />
                      {new Date(record.updated_at || record.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  {/* Modifié par */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 shrink-0" title="Éditeur">
                    <span className="font-semibold text-slate-400">Par :</span>
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100/55 px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wide">
                      {record.edited_by || "Abdelhalim"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-500 font-medium">{record.snapshot?.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {record.snapshot?.isAbandonProvisoire ? 'ABANDON PROVISOIRE (KILL STRING)' : record.snapshot?.completionType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSnapshot(record.snapshot)}
                    className="p-2 bg-slate-800 hover:bg-indigo-600 text-white rounded-lg transition"
                    title="Aperçu A4"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {isAdmin && onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(record)}
                      className="p-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-500 rounded-lg border border-slate-200 transition"
                      title="Modifier ce folio"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(record)}
                      className="p-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 rounded-lg border border-slate-200 transition"
                      title="Supprimer ce folio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
