import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Save,
  PenLine,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Search,
  Wrench,
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateTubingComponentMatrix } from '../lib/wellboreEngine';

export interface CustomTool {
  id?: string;
  type: string;
  default_name: string;
  default_od: string;
  default_custom_type: string;
  default_min_id: string;
  french_designation: string;
}

interface CustomToolsModalProps {
  onUpdated?: () => void;
  canAddOrEdit?: boolean;
  canDelete?: boolean;
}

function SortableToolRow({
  tool,
  index,
  total,
  isEditing,
  editForm,
  canAddOrEdit,
  canDelete,
  onStartEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  setEditForm,
  onSave,
  onCancel,
  isSearchActive
}: {
  tool: CustomTool;
  index: number;
  total: number;
  isEditing: boolean;
  editForm: Partial<CustomTool>;
  canAddOrEdit: boolean;
  canDelete: boolean;
  onStartEdit: (tool: CustomTool) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  setEditForm: (form: Partial<CustomTool>) => void;
  onSave: (form: Partial<CustomTool>) => void;
  onCancel: () => void;
  isSearchActive: boolean;
}) {
  const toolId = tool.id || `tool-${index}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: toolId, disabled: isSearchActive });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  if (isEditing) {
    return (
      <tr ref={setNodeRef} style={style} className="bg-orange-50/40">
        <td className="p-3 sm:p-4" colSpan={5}>
          <EditForm form={editForm} onChange={setEditForm} onCancel={onCancel} onSave={() => onSave(editForm)} />
        </td>
      </tr>
    );
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-slate-50/80 group transition-colors bg-white">
      <td className="w-16 px-2 sm:px-3 py-3 text-slate-400 text-center">
        <div className="flex items-center justify-center gap-1">
          {!isSearchActive && (
            <div
              className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing p-1 rounded hover:bg-slate-100 transition"
              {...attributes}
              {...listeners}
              title="Glisser-déposer pour réorganiser"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <div className="flex flex-col">
            <button
              onClick={() => onMoveUp(index)}
              disabled={index === 0 || isSearchActive}
              className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-slate-400 transition"
              title="Monter"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onMoveDown(index)}
              disabled={index === total - 1 || isSearchActive}
              className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-slate-400 transition"
              title="Descendre"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </td>
      <td className="px-3 sm:px-4 py-3 font-semibold text-slate-800 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
          <span>{tool.french_designation || tool.type}</span>
        </div>
      </td>
      <td className="px-3 sm:px-4 py-3 text-slate-600 font-mono text-xs">
        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200/60">
          {tool.default_od || "-"}
        </span>
      </td>
      <td className="px-3 sm:px-4 py-3 text-slate-600 text-xs font-mono">
        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200/60">
          {tool.default_custom_type || "-"}
        </span>
      </td>
      <td className="px-3 sm:px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {canAddOrEdit && (
            <button
              onClick={() => onStartEdit(tool)}
              className="p-2 sm:p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition border border-transparent sm:border-0 border-slate-200"
              title="Modifier"
            >
              <PenLine className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(tool.id!)}
              className="p-2 sm:p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition border border-transparent sm:border-0 border-slate-200"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function MobileToolCard({
  tool,
  index,
  total,
  isEditing,
  editForm,
  canAddOrEdit,
  canDelete,
  onStartEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  setEditForm,
  onSave,
  onCancel,
  isSearchActive
}: {
  tool: CustomTool;
  index: number;
  total: number;
  isEditing: boolean;
  editForm: Partial<CustomTool>;
  canAddOrEdit: boolean;
  canDelete: boolean;
  onStartEdit: (tool: CustomTool) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  setEditForm: (form: Partial<CustomTool>) => void;
  onSave: (form: Partial<CustomTool>) => void;
  onCancel: () => void;
  isSearchActive: boolean;
}) {
  if (isEditing) {
    return (
      <div className="p-3 bg-orange-50/40 rounded-xl border border-orange-200 shadow-xs">
        <EditForm form={editForm} onChange={setEditForm} onCancel={onCancel} onSave={() => onSave(editForm)} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col gap-3 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
            <Wrench className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-800 truncate">
              {tool.french_designation || tool.type}
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">
              Position #{index + 1}
            </p>
          </div>
        </div>

        {/* Reordering Up/Down controls */}
        {!isSearchActive && (
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-200 transition"
              title="Monter"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onMoveDown(index)}
              disabled={index === total - 1}
              className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-200 transition"
              title="Descendre"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
        <div>
          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">OD par défaut</span>
          <span className="font-mono font-bold text-slate-700">{tool.default_od || "-"}</span>
        </div>
        <div>
          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Connexion</span>
          <span className="font-mono font-bold text-slate-700">{tool.default_custom_type || "-"}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
        {canAddOrEdit && (
          <button
            onClick={() => onStartEdit(tool)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition border border-blue-200/60"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Modifier</span>
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(tool.id!)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition border border-rose-200/60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Supprimer</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function CustomToolsModal({ onUpdated, canAddOrEdit = true, canDelete = true }: CustomToolsModalProps) {
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CustomTool>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchTools = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/supabase/custom-tool-types');
      if (!res.ok) return;
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return;

      const data = await res.json();
      if (data.success) {
        setTools(data.data);
        updateTubingComponentMatrix(data.data);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const saveOrder = async (reordered: CustomTool[]) => {
    updateTubingComponentMatrix(reordered);
    if (onUpdated) onUpdated();
    try {
      await fetch('/api/supabase/custom-tool-types/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reordered })
      });
    } catch (err) {
      console.error("Failed to persist tool reordering:", err);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTools((items) => {
        const oldIndex = items.findIndex((item, idx) => (item.id || `tool-${idx}`) === active.id);
        const newIndex = items.findIndex((item, idx) => (item.id || `tool-${idx}`) === over.id);
        if (oldIndex < 0 || newIndex < 0) return items;
        const reordered = arrayMove(items, oldIndex, newIndex);
        saveOrder(reordered);
        return reordered;
      });
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setTools((items) => {
      const reordered = arrayMove(items, index, index - 1);
      saveOrder(reordered);
      return reordered;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= tools.length - 1) return;
    setTools((items) => {
      const reordered = arrayMove(items, index, index + 1);
      saveOrder(reordered);
      return reordered;
    });
  };

  const handleSave = async (tool: Partial<CustomTool>) => {
    if (!tool.french_designation || !tool.french_designation.trim()) {
      alert("Le champ Désignation est obligatoire.");
      return;
    }
    
    // Ensure all three designation fields are aligned
    const updatedTool = {
      ...tool,
      french_designation: tool.french_designation.trim(),
      type: tool.french_designation.trim(),
      default_name: tool.french_designation.trim()
    };
    
    try {
      const isNew = !tool.id;
      const url = isNew ? '/api/supabase/custom-tool-types' : `/api/supabase/custom-tool-types/${tool.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTool)
      });
      
      if (res.ok) {
        await fetchTools();
        setEditingId(null);
        setEditForm({});
        if (onUpdated) onUpdated();
      } else {
        const err = await res.json();
        alert(err.error || "Erreur lors de la sauvegarde.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de la sauvegarde.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette désignation ?")) return;
    try {
      const res = await fetch(`/api/supabase/custom-tool-types/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchTools();
        if (onUpdated) onUpdated();
      } else {
        const err = await res.json();
        alert(err.error || "Erreur lors de la suppression.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (tool: CustomTool) => {
    setEditingId(tool.id || null);
    setEditForm({ ...tool });
  };

  const addNew = () => {
    const newId = 'new-' + Date.now();
    setEditingId(newId);
    setEditForm({
      id: undefined,
      type: '',
      default_name: '',
      default_od: "2''7/8",
      default_custom_type: 'EU',
      default_min_id: '',
      french_designation: '',
    });
  };

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const q = searchQuery.toLowerCase().trim();
    return tools.filter(
      (t) =>
        (t.french_designation && t.french_designation.toLowerCase().includes(q)) ||
        (t.type && t.type.toLowerCase().includes(q)) ||
        (t.default_od && t.default_od.toLowerCase().includes(q)) ||
        (t.default_custom_type && t.default_custom_type.toLowerCase().includes(q))
    );
  }, [tools, searchQuery]);

  const itemIds = filteredTools.map((t, idx) => t.id || `tool-${idx}`);
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full space-y-4">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 w-full flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center border border-orange-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800">Catalogue des Composants</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                  {tools.length}
                </span>
              </div>
              <p className="text-xs text-slate-500">Ajoutez, personnalisez et ordonnez les composants de complétion tubings.</p>
            </div>
          </div>

          {canAddOrEdit && (
            <button
              onClick={addNew}
              disabled={editingId !== null}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une désignation</span>
            </button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une désignation, dimension, connexion..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            {isSearchActive
              ? `${filteredTools.length} résultat(s) trouvé(s)`
              : 'Glissez ou utilisez les flèches pour définir l’ordre d’apparition.'}
          </p>
        </div>

        {/* Content View Area */}
        <div className="p-4 sm:p-6 bg-white">
          
          {/* New Item Form (when clicking Add) */}
          {editingId && editForm.id === undefined && (
            <div className="mb-4 p-4 bg-orange-50/60 border border-orange-200 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-orange-800 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Nouvelle Désignation de Composant</span>
              </div>
              <EditForm
                form={editForm}
                onChange={setEditForm}
                onCancel={() => setEditingId(null)}
                onSave={() => handleSave(editForm)}
                isNew
              />
            </div>
          )}

          {/* Loading state */}
          {loading && tools.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-xs font-medium">Chargement des désignations...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredTools.length === 0 && (
            <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6">
              <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Aucune désignation trouvée</p>
              <p className="text-xs text-slate-500 mt-1">
                {isSearchActive
                  ? "Aucun composant ne correspond à votre recherche."
                  : "Commencez par ajouter votre premier type de composant tubing."}
              </p>
            </div>
          )}

          {/* MOBILE VIEW (< md): Card List */}
          <div className="block md:hidden space-y-3">
            {filteredTools.map((tool, index) => (
              <MobileToolCard
                key={tool.id || `tool-${index}`}
                tool={tool}
                index={index}
                total={filteredTools.length}
                isEditing={editingId === tool.id}
                editForm={editForm}
                canAddOrEdit={canAddOrEdit}
                canDelete={canDelete}
                onStartEdit={startEdit}
                onDelete={handleDelete}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                setEditForm={setEditForm}
                onSave={handleSave}
                onCancel={() => setEditingId(null)}
                isSearchActive={isSearchActive}
              />
            ))}
          </div>

          {/* DESKTOP VIEW (>= md): Full Responsive Sortable Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <table className="w-full text-left text-xs text-slate-600 min-w-[550px]">
                  <thead className="bg-slate-100/90 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    <tr>
                      <th className="w-16 px-3 py-3 text-center">Ordre</th>
                      <th className="px-4 py-3">Désignation</th>
                      <th className="px-4 py-3">OD par défaut</th>
                      <th className="px-4 py-3">Connexion par défaut</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTools.map((tool, index) => (
                        <SortableToolRow
                          key={tool.id || `tool-${index}`}
                          tool={tool}
                          index={index}
                          total={filteredTools.length}
                          isEditing={editingId === tool.id}
                          editForm={editForm}
                          canAddOrEdit={canAddOrEdit}
                          canDelete={canDelete}
                          onStartEdit={startEdit}
                          onDelete={handleDelete}
                          onMoveUp={handleMoveUp}
                          onMoveDown={handleMoveDown}
                          setEditForm={setEditForm}
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                          isSearchActive={isSearchActive}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function EditForm({
  form,
  onChange,
  onCancel,
  onSave,
  isNew
}: {
  form: Partial<CustomTool>;
  onChange: (f: Partial<CustomTool>) => void;
  onCancel: () => void;
  onSave: () => void;
  isNew?: boolean;
}) {
  const handleDesignationChange = (val: string) => {
    onChange({
      ...form,
      type: val,
      french_designation: val,
      default_name: val
    });
  };

  return (
    <div className="p-3 sm:p-4 border border-slate-200 rounded-xl bg-white shadow-xs space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
        <div className="sm:col-span-6 space-y-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Désignation du composant *
          </label>
          <input
            type="text"
            className="w-full h-10 px-3 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition"
            value={form.french_designation || ''}
            onChange={(e) => handleDesignationChange(e.target.value)}
            placeholder="Ex: Anchor-seal, Side Pocket Mandrel, etc."
            autoFocus
          />
        </div>

        <div className="sm:col-span-3 space-y-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            OD (Pouces)
          </label>
          <input
            type="text"
            className="w-full h-10 px-3 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition"
            value={form.default_od || ''}
            onChange={(e) => onChange({ ...form, default_od: e.target.value })}
            placeholder="2''7/8"
          />
        </div>

        <div className="sm:col-span-3 space-y-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Connexion par défaut
          </label>
          <input
            type="text"
            className="w-full h-10 px-3 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition"
            value={form.default_custom_type || ''}
            onChange={(e) => onChange({ ...form, default_custom_type: e.target.value })}
            placeholder="EU"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition shadow-xs"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isNew ? "Créer la désignation" : "Enregistrer"}</span>
        </button>
      </div>
    </div>
  );
}
