import React, { useState, useEffect } from 'react';
import { WellData, TubingComponent } from '../types';
import { calculateCoteProducts, recalculateBottomDepths } from '../lib/wellboreCore';
import { Settings2, Plus, Trash2, Check, Edit, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SrpFormProps {
  well: WellData;
  onChange: (updatedWell: WellData) => void;
  canAddOrEdit?: boolean;
  canDelete?: boolean;
}

function SortableSrpRow({
  item,
  idx,
  total,
  canAddOrEdit,
  canDelete,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown
}: {
  item: TubingComponent & { calculatedCote?: number };
  idx: number;
  total: number;
  canAddOrEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-amber-50/20 bg-white transition-colors">
      <td className="py-2 px-1 text-center w-20">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            className="cursor-grab text-slate-300 hover:text-slate-600 active:cursor-grabbing p-0.5"
            {...attributes}
            {...listeners}
            title="Glisser-déposer"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          {canAddOrEdit && (
            <>
              <button
                type="button"
                onClick={onMoveUp}
                disabled={idx === 0}
                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded transition"
                title="Monter"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={idx === total - 1}
                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded transition"
                title="Descendre"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 font-bold text-slate-900">{item.name}</td>
      <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-700">{item.qty || '01'}</td>
      <td className="px-2 py-2.5 text-center font-mono text-slate-600">{item.customType || '-'}</td>
      <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-800">{item.od || ''}</td>
      <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-800">
        {(item.length || 0).toFixed(2)}
      </td>
      <td className="px-2 py-2.5 text-right font-mono font-black text-amber-800">
        {item.calculatedCote !== undefined ? item.calculatedCote.toFixed(2) : ''}
      </td>
      <td className="px-3 py-2.5 text-slate-500 text-[11px]">{item.observations || ''}</td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {canAddOrEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded transition"
              title="Modifier"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function SrpForm({ well, onChange, canAddOrEdit = true, canDelete = true }: SrpFormProps) {
  const [editingSrpId, setEditingSrpId] = useState<string | null>(null);
  const [componentTypes, setComponentTypes] = useState<Array<{
    value: string;
    label: string;
    default_name?: string;
    default_od?: string;
    default_custom_type?: string;
    default_min_id?: string;
  }>>([]);

  const [newSrp, setNewSrp] = useState<Partial<TubingComponent>>({
    name: '',
    qty: '01',
    type: '',
    customType: '-',
    od: '',
    length: 0,
    observations: '',
    isCoteProductAdded: true
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const fetchComponentTypes = async () => {
      try {
        const response = await fetch("/api/supabase/custom-tool-types");
        if (!response.ok) return;
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return;

        const json = await response.json();
        let rawData: any[] = [];
        if (json.success && json.data && Array.isArray(json.data)) {
          rawData = json.data;
        } else if (Array.isArray(json)) {
          rawData = json;
        }

        if (rawData.length > 0) {
          const fetchedTypes = rawData.map((item: any) => ({
            value: item.type || item.french_designation || '',
            label: item.french_designation || item.default_name || item.type || '',
            default_name: item.default_name || item.french_designation || item.type || '',
            default_od: item.default_od || '',
            default_custom_type: item.default_custom_type || '',
            default_min_id: item.default_min_id || ''
          }));
          setComponentTypes(fetchedTypes);

          // Set default initial name from the first database item if empty
          if (!newSrp.name && fetchedTypes[0]) {
            setNewSrp(prev => ({
              ...prev,
              name: fetchedTypes[0].default_name || fetchedTypes[0].label,
              type: fetchedTypes[0].value,
              customType: fetchedTypes[0].default_custom_type || '-',
              od: fetchedTypes[0].default_od || ''
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch component types from database:", error);
      }
    };
    fetchComponentTypes();
  }, []);

  const srpList = well.srpComponents || [];

  const handleSelectDesignation = (selectedValue: string) => {
    const found = componentTypes.find(c => c.value === selectedValue || c.label === selectedValue);
    if (found) {
      setNewSrp(prev => ({
        ...prev,
        name: found.default_name || found.label,
        type: found.value,
        customType: found.default_custom_type || prev.customType || '-',
        od: found.default_od !== undefined && found.default_od !== '' ? found.default_od : prev.od
      }));
    } else {
      setNewSrp(prev => ({
        ...prev,
        name: selectedValue
      }));
    }
  };

  const handleSaveSrp = () => {
    if (!newSrp.name || newSrp.name.trim() === '') return;

    const itemToSave: TubingComponent = {
      id: editingSrpId || `srp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newSrp.name || '',
      qty: newSrp.qty || '01',
      type: newSrp.type || newSrp.name || 'SRP',
      customType: newSrp.customType || '-',
      od: newSrp.od || '',
      length: typeof newSrp.length === 'number' ? newSrp.length : parseFloat(String(newSrp.length || 0)),
      bottomDepth: newSrp.bottomDepth || 0,
      isCoteProductAdded: newSrp.isCoteProductAdded ?? true,
      minId: '',
      observations: newSrp.observations || ''
    };

    let updatedList: TubingComponent[];
    if (editingSrpId) {
      updatedList = srpList.map(item => item.id === editingSrpId ? itemToSave : item);
    } else {
      updatedList = [...srpList, itemToSave];
    }

    updatedList = recalculateBottomDepths(updatedList);

    onChange({
      ...well,
      srpComponents: updatedList,
      updatedAt: new Date().toISOString()
    });

    setEditingSrpId(null);
    const defaultTool = componentTypes[0];
    setNewSrp({
      name: defaultTool ? (defaultTool.default_name || defaultTool.label) : '',
      qty: '01',
      type: defaultTool ? defaultTool.value : 'SRP',
      customType: defaultTool ? (defaultTool.default_custom_type || '-') : '-',
      od: defaultTool ? (defaultTool.default_od || '') : '',
      length: 0,
      observations: '',
      isCoteProductAdded: true
    });
  };

  const removeSrpItem = (id: string) => {
    const updatedList = recalculateBottomDepths(srpList.filter(item => item.id !== id));
    onChange({
      ...well,
      srpComponents: updatedList,
      updatedAt: new Date().toISOString()
    });
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === srpList.length - 1)
    ) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newList = arrayMove([...srpList], index, targetIndex);

    const renumberedList = recalculateBottomDepths(newList);
    onChange({
      ...well,
      srpComponents: renumberedList,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = srpList.findIndex(item => item.id === active.id);
    const newIndex = srpList.findIndex(item => item.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      const newList = arrayMove([...srpList], oldIndex, newIndex);
      const renumberedList = recalculateBottomDepths(newList);
      onChange({
        ...well,
        srpComponents: renumberedList,
        updatedAt: new Date().toISOString()
      });
    }
  };

  const calculatedSrpList = calculateCoteProducts(srpList, well.spoolProd);
  const totalSrpLength = srpList.reduce((sum, item) => sum + (item.length || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-5 md:p-6 space-y-5 sm:space-y-6 w-full max-w-full overflow-hidden" id="srp_form_root">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-amber-600 animate-pulse shrink-0" />
          <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">
            Colonne SRP (PPH / SRP)
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
          Puits Surface Rod Pump
        </span>
      </div>

      {canAddOrEdit && (
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {editingSrpId ? "Modifier un composant SRP" : "Ajouter un composant Colonne SRP"}
            </h4>
            {editingSrpId && (
              <button
                type="button"
                onClick={() => {
                  setEditingSrpId(null);
                  const defaultTool = componentTypes[0];
                  setNewSrp({
                    name: defaultTool ? (defaultTool.default_name || defaultTool.label) : '',
                    qty: '01',
                    type: defaultTool ? defaultTool.value : 'SRP',
                    customType: defaultTool ? (defaultTool.default_custom_type || '-') : '-',
                    od: defaultTool ? (defaultTool.default_od || '') : '',
                    length: 0,
                    observations: '',
                    isCoteProductAdded: true
                  });
                }}
                className="text-[10px] text-slate-500 hover:text-slate-700 font-bold underline capitalize"
              >
                Annuler
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Désignation */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Désignation *
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="w-full sm:w-1/2 h-8 px-2 text-xs font-semibold bg-white border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  value={componentTypes.find(ct => ct.label === newSrp.name || ct.default_name === newSrp.name || ct.value === newSrp.type)?.value || ''}
                  onChange={e => {
                    if (e.target.value) {
                      handleSelectDesignation(e.target.value);
                    }
                  }}
                >
                  {componentTypes.map(ct => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Nom composant..."
                  className="w-full sm:w-1/2 h-8 px-2 text-xs font-bold bg-white border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  value={newSrp.name || ''}
                  onChange={e => setNewSrp(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>

            {/* Nb. */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Nb. (Quantité)
              </label>
              <input
                type="text"
                placeholder="ex: 01, 04, 86"
                className="w-full h-8 px-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                value={newSrp.qty || ''}
                onChange={e => setNewSrp(prev => ({ ...prev, qty: e.target.value }))}
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Type
              </label>
              <input
                type="text"
                placeholder="ex: 2''1/4, 3/4'', EU"
                className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
                value={newSrp.customType || ''}
                onChange={e => setNewSrp(prev => ({ ...prev, customType: e.target.value }))}
              />
            </div>

            {/* Diam */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Diam (Diamètre / OD)
              </label>
              <input
                type="text"
                placeholder="ex: 2''1/4, 1''1/2, 3/4''"
                className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono font-bold"
                value={newSrp.od || ''}
                onChange={e => setNewSrp(prev => ({ ...prev, od: e.target.value }))}
              />
            </div>

            {/* Longueur (m) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Longueur (m) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Longueur en mètres"
                className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono font-bold text-slate-800"
                value={newSrp.length ?? ''}
                onChange={e => setNewSrp(prev => ({
                  ...prev,
                  length: e.target.value === '' ? 0 : parseFloat(e.target.value)
                }))}
              />
            </div>

            {/* Cote Product (m) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Cote Product. (m)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Auto"
                className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono font-black text-amber-800"
                value={newSrp.bottomDepth ?? ''}
                onChange={e => setNewSrp(prev => ({
                  ...prev,
                  bottomDepth: e.target.value === '' ? undefined : parseFloat(e.target.value)
                }))}
              />
            </div>

            {/* Observations */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Observations
              </label>
              <input
                type="text"
                placeholder="Notes..."
                className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                value={newSrp.observations || ''}
                onChange={e => setNewSrp(prev => ({ ...prev, observations: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleSaveSrp}
              className="w-full sm:w-auto px-6 h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition shadow-2xs flex items-center justify-center gap-1.5"
            >
              {editingSrpId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingSrpId ? "Enregistrer Modifications" : "Ajouter au SRP"}
            </button>
          </div>
        </div>
      )}

      {/* TABLE COLONNE SRP */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span>COLONNE SRP</span>
            <span className="text-[10px] font-mono text-slate-500 font-normal">
              ({srpList.length} composant{srpList.length > 1 ? 's' : ''})
            </span>
          </h4>
          <span className="text-xs font-mono font-bold text-amber-800">
            Longueur Totale: {totalSrpLength.toFixed(2)} m
          </span>
        </div>

        <div className="overflow-x-auto w-full max-w-full scrollbar-thin">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full min-w-[760px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] tracking-wider">
                  <th className="w-20 text-center py-2.5 whitespace-nowrap">Ordre</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Désignation</th>
                  <th className="px-2 py-2.5 text-center w-14 whitespace-nowrap">Nb.</th>
                  <th className="px-2 py-2.5 text-center w-20 whitespace-nowrap">Type</th>
                  <th className="px-2 py-2.5 text-center w-20 whitespace-nowrap">Diam</th>
                  <th className="px-2 py-2.5 text-right w-24 whitespace-nowrap">Longueur (m)</th>
                  <th className="px-2 py-2.5 text-right w-28 font-bold text-amber-800 whitespace-nowrap">Cote Product. (m)</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Observations</th>
                  <th className="px-3 py-2.5 text-right w-20 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <SortableContext items={calculatedSrpList.map(item => item.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-slate-100">
                  {calculatedSrpList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-xs text-slate-400 italic">
                        Aucun composant de Colonne SRP défini.
                      </td>
                    </tr>
                  ) : (
                    calculatedSrpList.map((item, idx) => (
                      <SortableSrpRow
                        key={item.id}
                        item={item}
                        idx={idx}
                        total={calculatedSrpList.length}
                        canAddOrEdit={canAddOrEdit}
                        canDelete={canDelete}
                        onEdit={() => {
                          setEditingSrpId(item.id);
                          setNewSrp(item);
                        }}
                        onDelete={() => removeSrpItem(item.id)}
                        onMoveUp={() => moveItem(idx, 'up')}
                        onMoveDown={() => moveItem(idx, 'down')}
                      />
                    ))
                  )}
                  {srpList.length > 0 && (
                    <tr className="bg-amber-50/60 font-bold border-t border-slate-200">
                      <td className="px-3 py-2.5 whitespace-nowrap" colSpan={5}>
                        TOTAL COLONNE SRP
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-amber-900 font-black whitespace-nowrap">
                        {totalSrpLength.toFixed(2)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
