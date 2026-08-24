import React, { useState, useEffect } from "react";
import { Perimetre } from "../types";
import {
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Search,
  CheckCircle2,
  RefreshCw
} from "lucide-react";

interface PerimetresManagementProps {
  onPerimetresUpdated?: () => void;
}

export default function PerimetresManagement({ onPerimetresUpdated }: PerimetresManagementProps) {
  const [perimetres, setPerimetres] = useState<Perimetre[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // New Perimetre Form State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newAbbr, setNewAbbr] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Edit Mode State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editAbbr, setEditAbbr] = useState<string>("");

  // Delete Modal State
  const [perimetreToDelete, setPerimetreToDelete] = useState<Perimetre | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchPerimetres = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/perimetres");
      if (!res.ok) throw new Error("Impossible de charger les périmètres.");
      const data = await res.json();
      if (data.perimetres && Array.isArray(data.perimetres)) {
        setPerimetres(data.perimetres);
      }
    } catch (err: any) {
      setError(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerimetres();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/perimetres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          abbreviation: newAbbr.trim() ? newAbbr.trim().toUpperCase() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'ajout du périmètre.");
      }

      setNewName("");
      setNewAbbr("");
      setShowAddForm(false);
      await fetchPerimetres();
      onPerimetresUpdated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (p: Perimetre) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditAbbr(p.abbreviation || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditAbbr("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/perimetres/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          abbreviation: editAbbr.trim() ? editAbbr.trim().toUpperCase() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de la mise à jour.");
      }
      setEditingId(null);
      await fetchPerimetres();
      onPerimetresUpdated?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteClick = (p: Perimetre) => {
    setError(null);
    setPerimetreToDelete(p);
  };

  const confirmDeletePerimetre = async () => {
    if (!perimetreToDelete) return;
    setIsDeleting(true);
    setError(null);
    const p = perimetreToDelete;
    const idOrName = p.id || p.name;

    try {
      const res = await fetch(`/api/perimetres/${encodeURIComponent(idOrName)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Impossible de supprimer le périmètre "${p.name}".`);
      }

      setPerimetres((prev) => prev.filter((item) => item.id !== p.id && item.name.toLowerCase() !== p.name.toLowerCase()));
      setPerimetreToDelete(null);
      await fetchPerimetres();
      onPerimetresUpdated?.();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPerimetres = perimetres.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.abbreviation && p.abbreviation.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 w-full flex flex-col overflow-hidden">
        {/* Card Header matching Catalogue des Composants style */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Catalogue des Périmètres</h2>
            <p className="text-xs text-slate-500">
              Ajoutez, modifiez ou supprimez les périmètres et leurs abréviations de puits.
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex-1 overflow-auto p-6 bg-white space-y-6">
          {/* Error alert */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between font-medium">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Control Bar: Subtitle & Orange "Ajouter un périmètre" Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-700">Liste des périmètres</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-[#f97316] hover:bg-orange-600 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? "Fermer le formulaire" : "Ajouter un périmètre"}</span>
            </button>
          </div>

          {/* Inline Add Form */}
          {showAddForm && (
            <form onSubmit={handleAdd} className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Nouveau Périmètre
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Nom du Périmètre <span className="text-orange-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: EDJELEH, TIGUENTOURINE..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Abréviation Puits (Prefix)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: DL, TG, ASK..."
                    value={newAbbr}
                    onChange={(e) => setNewAbbr(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-orange-600 uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newName.trim()}
                    className="w-full py-1.5 bg-[#f97316] hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Enregistrer</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Search bar & count */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par périmètre ou abréviation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">
                Total: <strong className="text-slate-800">{filteredPerimetres.length}</strong> périmètre(s)
              </span>
              <button
                onClick={fetchPerimetres}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                title="Rafraîchir"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Perimetres Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 min-w-[500px]">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Nom du Périmètre</th>
                  <th className="py-2.5 px-4">Abréviation du Puits</th>
                  <th className="py-2.5 px-4 text-center">Statut Détection</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                      Chargement des périmètres...
                    </td>
                  </tr>
                ) : filteredPerimetres.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                      Aucun périmètre trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredPerimetres.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="px-2 py-1 bg-white border border-orange-500 rounded text-xs font-bold text-slate-900 focus:outline-none w-full max-w-xs"
                            />
                          ) : (
                            <span className="font-bold text-slate-900 text-xs">{p.name}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editAbbr}
                              onChange={(e) => setEditAbbr(e.target.value.toUpperCase())}
                              placeholder="ex: DL"
                              className="px-2 py-1 bg-white border border-orange-500 rounded text-xs font-mono font-bold text-orange-600 uppercase focus:outline-none w-28"
                            />
                          ) : p.abbreviation ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 font-mono font-bold text-xs">
                              {p.abbreviation}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">— Non définie —</span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          {p.abbreviation ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Actif ({p.abbreviation})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] font-medium">Inactif</span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleSaveEdit(p.id)}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
                                title="Enregistrer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition"
                                title="Annuler"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleStartEdit(p)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Modifier"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(p)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {perimetreToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-slate-800 animate-in fade-in zoom-in-95 duration-150 relative">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Confirmer la suppression</h3>
              <p className="text-[11px] font-medium text-slate-500">Périmètre : {perimetreToDelete.name}</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le périmètre <strong className="text-slate-900 font-bold">"{perimetreToDelete.name}"</strong> {perimetreToDelete.abbreviation ? `(Abréviation : ${perimetreToDelete.abbreviation})` : ""} ?
            </p>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setPerimetreToDelete(null); setError(null); }}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeletePerimetre}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition"
              >
                {isDeleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
