import React, { useState, useEffect } from 'react';
import { WellData, CasingString, TubingComponent, TubingComponentType, CementPlug, BridgePlug } from '../types';
import { parseSizeToNumber, calculateCoteProducts, recalculateBottomDepths, getTubingTypeDefaults } from '../lib/wellboreEngine';
import { Layers, Plus, Trash2, ArrowUp, ArrowDown, RefreshCw, Check, Edit, Disc, AlignJustify, GripVertical } from 'lucide-react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


interface WellboreFormProps {
  well: WellData;
  onChange: (updatedWell: WellData) => void;
  canAddOrEdit?: boolean;
  canDelete?: boolean;
}

interface SortableCasingRowProps {
  c: CasingString;
  onEdit: () => void;
  onDelete: () => void;
  canAddOrEdit?: boolean;
  canDelete?: boolean;
}

function SortableCasingRow({ c, onEdit, onDelete, canAddOrEdit = true, canDelete = true }: SortableCasingRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: c.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className={`hover:bg-slate-50/50 bg-white ${isDragging ? 'shadow-lg bg-slate-50 z-10' : ''}`}>
      <td className="px-2.5 py-2.5 cursor-grab w-10 text-center" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4 text-slate-400 hover:text-slate-600 transition mx-auto" />
      </td>
      <td className="px-3 py-2.5 font-bold text-slate-900">{c.name}</td>
      <td className="px-2 py-2.5 text-center font-mono text-slate-600">{c.boreholeSize || '-'}</td>
      <td className="px-2 py-2.5 text-center font-mono text-slate-600">
        {c.startFromTOL && c.topOfLiner != null ? c.topOfLiner : (c.topDepth ?? 0)} - {c.drilledDepth || '-'}
      </td>
      <td className="px-2 py-2.5 text-center font-mono font-medium text-slate-600">{c.casingSize || '-'}</td>
      <td className="px-2 py-2.5 text-center font-mono text-slate-600">{c.weight ? `${c.weight} lb/ft` : '-'}</td>
      <td className="px-2 py-2.5 text-center font-mono text-slate-600">{c.grade || '-'}</td>
      <td className="px-2 py-2.5 text-center font-mono text-slate-600">{c.connection || '-'}</td>
      <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-800">{c.shoeDepth.toFixed(2)}</td>
      <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-800">{c.topOfFonde != null ? c.topOfFonde.toFixed(2) : '-'}</td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex justify-end items-center gap-1.5 pr-1">
          {canAddOrEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1 text-sky-500 hover:text-sky-600 hover:bg-sky-50 rounded transition"
              title="Edit Casing Phase"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
              title="Delete Casing Component"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// Helper component for sortable row
function SortableTubingRow({ t, cote, onEdit, onDelete, canAddOrEdit = true, canDelete = true }: { key?: React.Key, t: TubingComponent, cote: number, onEdit: () => void, onDelete: () => void, canAddOrEdit?: boolean, canDelete?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: t.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-slate-50/50 bg-white">
      <td className="px-1 py-2.5 cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4 text-slate-400" />
      </td>
      <td className="px-3 py-2.5">
        <span className="font-semibold text-slate-800">{t.name}</span>
      </td>
      <td className="px-2 py-2.5 text-center font-medium text-slate-700">{t.qty || '01'}</td>
      <td className="px-2 py-2.5 text-center font-mono text-slate-600">{t.customType || '-'}</td>
      <td className="px-2 py-2.5 text-center font-mono font-medium text-slate-600">{t.od}</td>
      <td className="px-2 py-2.5 text-right font-mono text-slate-600">{t.length.toFixed(2)}</td>
      <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-800">{t.isCoteProductAdded ? cote.toFixed(2) : ''}</td>
      <td className="px-2 py-2.5 text-center font-mono text-slate-600">{t.minId || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-slate-500 truncate max-w-[180px]" title={t.observations}>
        {t.observations || '-'}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex justify-end gap-2.5">
          {canAddOrEdit && (
            <button type="button" onClick={onEdit} className="text-sky-500 hover:text-sky-600 transition" title="Edit Tubing Component">
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={onDelete} className="text-slate-400 hover:text-rose-600 transition" title="Delete Tubing Component">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function WellboreForm({ well, onChange, canAddOrEdit = true, canDelete = true }: WellboreFormProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      if (String(active.id).startsWith('casing-')) {
        const casings = well.casings || [];
        const oldIndex = casings.findIndex(c => c.id === active.id);
        const newIndex = casings.findIndex(c => c.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          onChange({ ...well, casings: arrayMove(casings, oldIndex, newIndex), updatedAt: new Date().toISOString() });
        }
      } else {
        const tubings = well.tubings || [];
        const oldIndex = tubings.findIndex(t => t.id === active.id);
        const newIndex = tubings.findIndex(t => t.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          onChange({ ...well, tubings: arrayMove(tubings, oldIndex, newIndex), updatedAt: new Date().toISOString() });
        }
      }
    }
  };

  const handleMoveCasingUp = (index: number) => {
    if (index <= 0) return;
    const list = [...(well.casings || [])];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    onChange({
      ...well,
      casings: list,
      updatedAt: new Date().toISOString()
    });
  };

  const handleMoveCasingDown = (index: number) => {
    const list = [...(well.casings || [])];
    if (index >= list.length - 1) return;
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    onChange({
      ...well,
      casings: list,
      updatedAt: new Date().toISOString()
    });
  };

  // Tubing edit state
  const [editingTubingId, setEditingTubingId] = useState<string | null>(null);
  const [newTubing, setNewTubing] = useState<Partial<TubingComponent>>({
    name: "",
    type: 'Tubing',
    qty: '',
    customType: '',
    od: "",
    length: 0,
    bottomDepth: 0,
    isCoteProductAdded: false,
    minId: '',
    observations: ''
  });

  const [formMode, setFormMode] = useState<'tubing' | 'casing'>('casing');
  const [editingCasingId, setEditingCasingId] = useState<string | null>(null);

  const defaultCasing = {
    name: '',
    boreholeSize: undefined,
    casingSize: undefined,
    topDepth: 0,
    shoeDepth: 0,
    drilledDepth: 0,
    topOfCement: undefined,
    topOfLiner: undefined,
    startFromTOL: false,
    topOfFonde: undefined,
    grade: '',
    weight: undefined,
    connection: '',
    observations: ''
  };

  const [newCasing, setNewCasing] = useState<Partial<CasingString>>(defaultCasing);
  
  // Production Tubing Parameters - using the new WellData structure
  const handleProdTbgChange = (key: 'od' | 'grade' | 'weight', value: string) => {
    onChange({
      ...well,
      prodTbgParams: {
        ...(well.prodTbgParams || {}),
        [key]: value
      },
      updatedAt: new Date().toISOString()
    });
  };

  // Handle preset types changing to fill defaults


  // Handle preset types changing to fill defaults using the central configuration matrix
  const handleTubingTypeChange = (selectedType: TubingComponentType) => {
    const defaults = getTubingTypeDefaults(selectedType);

    setNewTubing(prev => ({
      ...prev,
      type: selectedType,
      name: defaults.defaultName,
      od: defaults.defaultOd,
      customType: defaults.defaultCustomType,
      minId: defaults.defaultMinId
    }));
  };

  const handleSaveCasing = () => {
    let updatedCasingsList = [...(well.casings || [])];
    if (editingCasingId) {
      updatedCasingsList = (well.casings || []).map(c => {
        if (c.id === editingCasingId) {
          return {
            ...c,
            ...newCasing,
            boreholeSize: newCasing.boreholeSize || '',
            casingSize: newCasing.casingSize || '',
            topDepth: parseFloat(String(newCasing.topDepth)) || 0,
            shoeDepth: parseFloat(String(newCasing.shoeDepth)) || 0,
            drilledDepth: parseFloat(String(newCasing.drilledDepth)) || 0,
            weight: parseFloat(String(newCasing.weight)) || 0,
            topOfCement: newCasing.topOfCement !== undefined && newCasing.topOfCement !== null && !isNaN(parseFloat(String(newCasing.topOfCement))) ? parseFloat(String(newCasing.topOfCement)) : null,
            topOfLiner: newCasing.topOfLiner !== undefined && newCasing.topOfLiner !== null && !isNaN(parseFloat(String(newCasing.topOfLiner))) ? parseFloat(String(newCasing.topOfLiner)) : null,
            startFromTOL: Boolean(newCasing.startFromTOL),
            topOfFonde: newCasing.topOfFonde !== undefined && newCasing.topOfFonde !== null && !isNaN(parseFloat(String(newCasing.topOfFonde))) ? parseFloat(String(newCasing.topOfFonde)) : null,
          } as CasingString;
        }
        return c;
      });
      setEditingCasingId(null);
    } else {
      const entry: CasingString = {
        ...(newCasing as CasingString),
        id: `casing-${Date.now()}`,
        boreholeSize: newCasing.boreholeSize || '',
        casingSize: newCasing.casingSize || '',
        topDepth: parseFloat(String(newCasing.topDepth)) || 0,
        shoeDepth: parseFloat(String(newCasing.shoeDepth)) || 0,
        drilledDepth: parseFloat(String(newCasing.drilledDepth)) || 0,
        weight: parseFloat(String(newCasing.weight)) || 0,
        topOfCement: newCasing.topOfCement !== undefined && newCasing.topOfCement !== null && !isNaN(parseFloat(String(newCasing.topOfCement))) ? parseFloat(String(newCasing.topOfCement)) : null,
        topOfLiner: newCasing.topOfLiner !== undefined && newCasing.topOfLiner !== null && !isNaN(parseFloat(String(newCasing.topOfLiner))) ? parseFloat(String(newCasing.topOfLiner)) : null,
        startFromTOL: Boolean(newCasing.startFromTOL),
        topOfFonde: newCasing.topOfFonde !== undefined && newCasing.topOfFonde !== null && !isNaN(parseFloat(String(newCasing.topOfFonde))) ? parseFloat(String(newCasing.topOfFonde)) : null,
      };
      updatedCasingsList = [...updatedCasingsList, entry];
    }
    
    onChange({
      ...well,
      casings: updatedCasingsList,
      updatedAt: new Date().toISOString()
    });
    setNewCasing(defaultCasing);
  };

  const handleSaveTubing = () => {
    let updatedTubingsList = [...(well.tubings || [])];
    const hasTubingData = newTubing.name && newTubing.length > 0;

    if (hasTubingData) {
      const length = parseFloat(String(newTubing.length)) || 0;
      const bottomDepth = newTubing.bottomDepth;

      if (editingTubingId) {
        updatedTubingsList = (well.tubings || []).map(t => {
          if (t.id === editingTubingId) {
            return {
              ...t,
              name: newTubing.name || '',
              type: newTubing.type as TubingComponentType,
              od: newTubing.od || '',
              length: length,
              bottomDepth: bottomDepth,
              isCoteProductAdded: bottomDepth !== undefined && bottomDepth !== null && bottomDepth > 0,
              qty: newTubing.qty || '01',
              customType: newTubing.customType || 'EU',
              minId: newTubing.minId || '',
              observations: newTubing.observations || ''
            };
          }
          return t;
        });
        setEditingTubingId(null);
      } else {
        const entry: TubingComponent = {
          id: `tubing-${Date.now()}`,
          name: newTubing.name || '',
          type: (newTubing.type as TubingComponentType) || 'Tubing',
          od: newTubing.od || '',
          length: length,
          bottomDepth: bottomDepth,
          isCoteProductAdded: bottomDepth !== undefined && bottomDepth !== null && bottomDepth > 0,
          qty: newTubing.qty || '01',
          customType: newTubing.customType || 'EU',
          minId: newTubing.minId || '',
          observations: newTubing.observations || ''
        };
        updatedTubingsList = [...updatedTubingsList, entry];
      }

      setNewTubing({
        name: "",
        type: 'Tubing',
        qty: '',
        customType: '',
        od: "",
        length: 0,
        bottomDepth: 0,
        isCoteProductAdded: false,
        minId: '',
        observations: ''
      });
      
      onChange({
        ...well,
        tubings: updatedTubingsList,
        updatedAt: new Date().toISOString()
      });
    }
  };

  // Helper for identifying Bridge Plug items
  const isBridgePlugItem = (t: TubingComponent) => {
    const nameLower = (t.name || '').toLowerCase();
    const typeLower = (t.type || '').toLowerCase();
    const customTypeLower = (t.customType || '').toLowerCase();
    return (
      typeLower === 'bridge plug' ||
      typeLower.includes('bridge') ||
      customTypeLower.includes('bridge') ||
      nameLower.includes('bridge') ||
      nameLower.includes('b.p') ||
      nameLower.includes('bp')
    );
  };

  // ==================== CEMENT PLUG (B.C) ====================
  const [newCementPlug, setNewCementPlug] = useState<Partial<CementPlug>>({
    topDepth: undefined,
    bottomDepth: undefined,
    observations: ''
  });
  const [showBCForm, setShowBCForm] = useState(false);

  // ==================== BRIDGE PLUG (B.P) ====================
  const [showBPForm, setShowBPForm] = useState(false);
  const [editingBPId, setEditingBPId] = useState<string | null>(null);
  const [newBP, setNewBP] = useState<{
    designation: string;
    size: string;
    type: string;
    length?: number;
    bottomDepth?: number;
    observations: string;
  }>({
    designation: 'Bridge plug',
    size: '7"',
    type: 'PERMANENT',
    length: 0.23,
    bottomDepth: undefined,
    observations: ''
  });

  const handleSaveBP = () => {
    const depth = newBP.bottomDepth;
    if (depth === undefined || isNaN(depth)) return;
    const len = newBP.length !== undefined ? parseFloat(String(newBP.length)) : 0;

    let updatedTubings = [...(well.tubings || [])];
    let updatedBridgePlugs = [...(well.bridgePlugs || [])];

    const bpItem: BridgePlug = {
      id: editingBPId || `bp-${Date.now()}`,
      designation: newBP.designation || 'Bridge plug',
      name: newBP.designation || 'Bridge plug',
      size: newBP.size || '7"',
      od: newBP.size || '7"',
      type: newBP.type || 'PERMANENT',
      customType: newBP.type || 'PERMANENT',
      length: len,
      bottomDepth: depth,
      observations: newBP.observations || ''
    };

    if (editingBPId) {
      updatedTubings = updatedTubings.map(t => {
        if (t.id === editingBPId) {
          return {
            ...t,
            name: newBP.designation || 'Bridge plug',
            type: 'Bridge Plug' as TubingComponentType,
            customType: newBP.type || 'PERMANENT',
            od: newBP.size || '7"',
            length: len,
            bottomDepth: depth,
            isCoteProductAdded: true,
            observations: newBP.observations || ''
          };
        }
        return t;
      });
      updatedBridgePlugs = updatedBridgePlugs.map(bp => bp.id === editingBPId ? bpItem : bp);
      setEditingBPId(null);
    } else {
      const entry: TubingComponent = {
        id: bpItem.id,
        name: newBP.designation || 'Bridge plug',
        type: 'Bridge Plug' as TubingComponentType,
        qty: '01',
        customType: newBP.type || 'PERMANENT',
        od: newBP.size || '7"',
        length: len,
        bottomDepth: depth,
        isCoteProductAdded: true,
        observations: newBP.observations || ''
      };
      updatedTubings.push(entry);
      updatedBridgePlugs.push(bpItem);
    }

    onChange({
      ...well,
      tubings: updatedTubings,
      bridgePlugs: updatedBridgePlugs,
      updatedAt: new Date().toISOString()
    });

    setShowBPForm(false);
    setNewBP({
      designation: 'Bridge plug',
      size: '7"',
      type: 'PERMANENT',
      length: 0.23,
      bottomDepth: undefined,
      observations: ''
    });
  };

  const handleSaveCementPlug = () => {
    const top = newCementPlug.topDepth;
    const bot = newCementPlug.bottomDepth;
    if (top === undefined || bot === undefined || isNaN(top) || isNaN(bot) || bot <= top) return;
    const entry: CementPlug = {
      id: `bc-${Date.now()}`,
      topDepth: top,
      bottomDepth: bot,
      observations: newCementPlug.observations || ''
    };
    onChange({
      ...well,
      cementPlugs: [...(well.cementPlugs || []), entry],
      updatedAt: new Date().toISOString()
    });
    setNewCementPlug({ topDepth: undefined, bottomDepth: undefined, observations: '' });
  };

  const removeCementPlug = (id: string) => {
    onChange({
      ...well,
      cementPlugs: (well.cementPlugs || []).filter(cp => cp.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  // ==================== SEPARATE ACTIONS (DELETE/MOVE) ====================
  const removeTubing = (id: string) => {
    onChange({
      ...well,
      tubings: (well.tubings || []).filter(t => t.id !== id),
      updatedAt: new Date().toISOString()
    });
  };

  const moveTubing = (index: number, direction: 'up' | 'down') => {
    const tubings = well.tubings || [];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === tubings.length - 1) return;

    const newTubings = [...tubings];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newTubings[index];
    newTubings[index] = newTubings[targetIdx];
    newTubings[targetIdx] = temp;

    // Auto-recalculate bottom depths sequentially using the core engine
    const reordered = recalculateBottomDepths(newTubings);

    onChange({
      ...well,
      tubings: reordered,
      updatedAt: new Date().toISOString()
    });
  };



  const [componentTypes, setComponentTypes] = useState<{ value: string; label: string }[]>([
    { value: 'Tubing', label: 'Tubing' }
  ]);

  useEffect(() => {
    const fetchComponentTypes = async () => {
      try {
        const response = await fetch("/api/supabase/custom-tool-types");
        if (!response.ok) return;
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return;

        const json = await response.json();
        if (json.success && json.data && json.data.length > 0) {
          const fetchedTypes = json.data.map((item: any) => ({
            value: item.type,
            label: item.french_designation || item.type
          }));
          const hasTubing = fetchedTypes.some((t: any) => t.value === 'Tubing');
          if (!hasTubing) {
            setComponentTypes([{ value: 'Tubing', label: 'Tubing' }, ...fetchedTypes]);
          } else {
            setComponentTypes(fetchedTypes);
          }
        }
      } catch (error) {
        console.warn("Could not fetch component types:", error);
      }
    };
    fetchComponentTypes();
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-5 md:p-6 space-y-5 sm:space-y-6 w-full max-w-full overflow-hidden" id="wellbore_form_root">
      
      {/* TOGGLE FORM MODE — hidden for read-only users */}
      {canAddOrEdit && (
        <div className="grid grid-cols-2 sm:flex bg-slate-100 p-1 rounded-lg w-full sm:w-fit gap-1">
          <button
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-md transition ${formMode === 'casing' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => { setFormMode('casing'); setEditingTubingId(null); }}
          >
            <Disc className="w-4 h-4 text-slate-400" />
            <span>Casing Phase</span>
          </button>
          <button
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-md transition ${formMode === 'tubing' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => { setFormMode('tubing'); setEditingCasingId(null); }}
          >
            <AlignJustify className="w-4 h-4 text-slate-400" />
            <span>Tubing Component</span>
          </button>
        </div>
      )}

      {canAddOrEdit && formMode === 'casing' && (
        <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 sm:p-4 space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              {editingCasingId ? 'Edit Casing Phase' : 'Add Casing Phase'}
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Casing Name</label>
              <input
                type="text"
                placeholder="e.g. Surface Casing"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none font-medium bg-white"
                value={newCasing.name || ''}
                onChange={(e) => setNewCasing(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Hole Size (")</label>
              <input
                type="text"
                placeholder="12.25 or 12&quot; 1/4"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono"
                value={newCasing.boreholeSize || ''}
                onChange={(e) => setNewCasing(prev => ({ ...prev, boreholeSize: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Depth (m)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  className="w-1/2 h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-emerald-800"
                  value={newCasing.topDepth ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCasing(prev => ({ ...prev, topDepth: val === '' ? undefined : parseFloat(val) }));
                  }}
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="405"
                  className="w-1/2 h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-emerald-800"
                  value={newCasing.drilledDepth ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCasing(prev => ({ ...prev, drilledDepth: val === '' ? undefined : parseFloat(val) }));
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Casing Size (")</label>
              <input
                type="text"
                placeholder="9.625 or 9&quot; 5/8"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono"
                value={newCasing.casingSize || ''}
                onChange={(e) => setNewCasing(prev => ({ ...prev, casingSize: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Weight (lb/ft)</label>
              <input
                type="number"
                step="0.1"
                placeholder="36"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono"
                value={newCasing.weight ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewCasing(prev => ({ ...prev, weight: val === '' ? undefined : parseFloat(val) }));
                }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Steel Grade</label>
              <input
                type="text"
                placeholder="J55"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white text-center font-mono"
                value={newCasing.grade || ''}
                onChange={(e) => setNewCasing(prev => ({ ...prev, grade: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Connection</label>
              <input
                type="text"
                placeholder="BTC"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white text-center font-mono"
                value={newCasing.connection || ''}
                onChange={(e) => setNewCasing(prev => ({ ...prev, connection: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Casing Shoe (Sabot) (m)</label>
              <input
                type="number"
                step="0.01"
                placeholder="400"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-emerald-800"
                value={newCasing.shoeDepth ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewCasing(prev => ({ ...prev, shoeDepth: val === '' ? undefined : parseFloat(val) }));
                }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Top of Cement (TOC) (m)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-slate-700"
                value={newCasing.topOfCement ?? ''}
                onChange={(e) => setNewCasing(prev => ({ ...prev, topOfCement: isNaN(parseFloat(e.target.value)) ? null : parseFloat(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">TF - Top Fonde (m)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 1200"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-slate-700"
                value={newCasing.topOfFonde ?? ''}
                onChange={(e) => setNewCasing(prev => ({ ...prev, topOfFonde: isNaN(parseFloat(e.target.value)) ? null : parseFloat(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Top of Liner (TOL) (m)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 1000"
                className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-slate-700"
                value={newCasing.topOfLiner ?? ''}
                onChange={(e) => {
                  const parsed = isNaN(parseFloat(e.target.value)) ? null : parseFloat(e.target.value);
                  setNewCasing(prev => ({
                    ...prev,
                    topOfLiner: parsed,
                    startFromTOL: parsed !== null && parsed > 0 ? true : prev.startFromTOL
                  }));
                }}
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="startFromTOL"
                  checked={Boolean(newCasing.startFromTOL)}
                  onChange={(e) => setNewCasing(prev => ({ ...prev, startFromTOL: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-slate-800 focus:ring-slate-500 cursor-pointer"
                />
                <label htmlFor="startFromTOL" className="text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                  Start casing from TOL
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveCasing}
              className="w-full sm:w-auto h-9 px-6 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs uppercase tracking-wider rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {editingCasingId ? 'Save Phase' : 'Add Phase'}
            </button>
          </div>
        </div>
      )}

      {canAddOrEdit && formMode === 'tubing' && (
        <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 sm:p-4 space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              {editingTubingId ? 'Edit Tubing Component' : 'Add Tubing Component'}
            </h4>
          </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-4 gap-y-3">
          {/* Production Tubing Inputs */}
          <div className="col-span-1 sm:col-span-2 md:col-span-3 xl:col-span-5 pb-3 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <h5 className="col-span-1 sm:col-span-3 text-[10px] font-bold text-slate-500 uppercase">Production Tubing Details</h5>
            <input type="text" placeholder="Ø (e.g. 2''7/8)" className="h-8 px-2 text-xs border border-slate-200 rounded bg-white" value={well.prodTbgParams?.od || ''} onChange={(e) => handleProdTbgChange('od', e.target.value)} />
            <input type="text" placeholder="Grade (e.g. J55)" className="h-8 px-2 text-xs border border-slate-200 rounded bg-white" value={well.prodTbgParams?.grade || ''} onChange={(e) => handleProdTbgChange('grade', e.target.value)} />
            <input type="text" placeholder="Lbs (e.g. 6.5)" className="h-8 px-2 text-xs border border-slate-200 rounded bg-white" value={well.prodTbgParams?.weight || ''} onChange={(e) => handleProdTbgChange('weight', e.target.value)} />
          </div>

          {/* Désignation */}
          <div className="col-span-1 sm:col-span-2 xl:col-span-2">
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Désignation</label>
            <div className="flex gap-2">
              <select
                className="h-8 px-1.5 text-xs border border-slate-200 rounded bg-white w-28 focus:outline-none focus:border-slate-400"
                value={newTubing.type}
                onChange={(e) => handleTubingTypeChange(e.target.value as TubingComponentType)}
              >
                {componentTypes.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="e.g. Tubing 2''7/8"
                className="flex-1 min-w-0 h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none font-medium bg-white"
                value={newTubing.name || ''}
                onChange={(e) => setNewTubing(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>

          {/* NB. */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">NB.</label>
            <input
              type="text"
              placeholder="01"
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white text-center font-bold"
              value={newTubing.qty || ''}
              onChange={(e) => setNewTubing(prev => ({ ...prev, qty: e.target.value }))}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Type</label>
            <input
              type="text"
              placeholder="EU"
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white text-center font-mono"
              value={newTubing.customType || ''}
              onChange={(e) => setNewTubing(prev => ({ ...prev, customType: e.target.value }))}
            />
          </div>

          {/* Diam */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Diam</label>
            <input
              type="text"
              placeholder="2''7/8"
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white text-center font-mono"
              value={newTubing.od || ''}
              onChange={(e) => setNewTubing(prev => ({ ...prev, od: e.target.value }))}
            />
          </div>

          {/* Longueur */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Longueur (m)</label>
            <input
              type="number"
              step="0.01"
              placeholder="1932.14"
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono"
              value={newTubing.length || ''}
              onChange={(e) => setNewTubing(prev => ({ ...prev, length: parseFloat(e.target.value) || 0 }))}
            />
          </div>

          {/* Cote Product */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Cote Product (m)</label>
            <input
              type="number"
              step="0.01"
              placeholder="Auto"
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-emerald-800"
              value={newTubing.bottomDepth ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setNewTubing(prev => ({ ...prev, bottomDepth: val === '' ? undefined : parseFloat(val) }));
              }}
            />
          </div>

          {/* Ø Mini */}
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Ø Mini</label>
            <input
              type="text"
              placeholder="2.441"
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white text-center font-mono"
              value={newTubing.minId || ''}
              onChange={(e) => setNewTubing(prev => ({ ...prev, minId: e.target.value }))}
            />
          </div>

          {/* Observations */}
          <div className="col-span-1 sm:col-span-2 md:col-span-3 xl:col-span-5">
            <label className="block text-[11px] font-medium text-slate-700 mb-1">Observations</label>
            <input
              type="text"
              placeholder="Observations/Notes..."
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white"
              value={newTubing.observations || ''}
              onChange={(e) => setNewTubing(prev => ({ ...prev, observations: e.target.value }))}
            />
          </div>
        </div>

        {/* ONE SAVE BUTTON + ADD B.C BUTTON + ADD B.P BUTTON */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {canAddOrEdit && (
            <>
              <button
                type="button"
                onClick={() => { setShowBPForm(v => !v); setShowBCForm(false); }}
                className={`h-9 px-3 sm:px-4 font-semibold text-xs uppercase tracking-wider rounded-lg transition shadow-2xs flex items-center justify-center gap-1.5 border ${
                  showBPForm
                    ? 'bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-[10px] font-bold bg-slate-600 text-white rounded px-1 py-0.5">BP</span>
                <span>Add B.P</span>
              </button>

              <button
                type="button"
                onClick={() => { setShowBCForm(v => !v); setShowBPForm(false); }}
                className={`h-9 px-3 sm:px-4 font-semibold text-xs uppercase tracking-wider rounded-lg transition shadow-2xs flex items-center justify-center gap-1.5 border ${
                  showBCForm
                    ? 'bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-[10px] font-bold bg-slate-600 text-white rounded px-1 py-0.5">BC</span>
                <span>Add B.C</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleSaveTubing}
            className="w-full sm:w-auto h-9 px-6 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs uppercase tracking-wider rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {editingTubingId ? 'Save Changes' : 'Add Component'}
          </button>
        </div>

        {/* B.P — BRIDGE PLUG (hidden until Add B.P clicked) */}
        {showBPForm && (
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {editingBPId ? 'Modifier Bridge Plug (B.P)' : 'Bridge Plug (B.P)'}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {/* Désignation — dropdown from Designations & Composants */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Désignation</label>
                <select
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-medium text-slate-800"
                  value={newBP.designation || 'Bridge plug'}
                  onChange={e => setNewBP(prev => ({ ...prev, designation: e.target.value }))}
                >
                  <option value="Bridge plug">Bridge plug</option>
                  {componentTypes.map(ct => (
                    <option key={ct.value} value={ct.label}>{ct.label}</option>
                  ))}
                </select>
              </div>

              {/* Taille / Size like 7" */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Taille (Size)</label>
                <input
                  type="text"
                  placeholder='ex: 7"'
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-slate-800"
                  value={newBP.size || ''}
                  onChange={e => setNewBP(prev => ({ ...prev, size: e.target.value }))}
                />
              </div>

              {/* Type: PERMANENT - RECUPERABLE - EU - NU - CTC */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Type</label>
                <select
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-semibold text-slate-800"
                  value={newBP.type || 'PERMANENT'}
                  onChange={e => setNewBP(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="PERMANENT">PERMANENT</option>
                  <option value="RÉCUPÉRABLE">RÉCUPÉRABLE</option>
                  <option value="EU">EU</option>
                  <option value="NU">NU</option>
                  <option value="CTC">CTC</option>
                </select>
              </div>

              {/* Longueur (m) */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Longueur (m)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ex: 0.23"
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-slate-800"
                  value={newBP.length ?? ''}
                  onChange={e => setNewBP(prev => ({ ...prev, length: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                />
              </div>

              {/* Cote Product (m) */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Cote Product (m)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ex: 714"
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono text-emerald-800 font-bold"
                  value={newBP.bottomDepth ?? ''}
                  onChange={e => setNewBP(prev => ({ ...prev, bottomDepth: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                />
              </div>

              {/* Observations */}
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Observations</label>
                <input
                  type="text"
                  placeholder="Notes..."
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white text-slate-800"
                  value={newBP.observations || ''}
                  onChange={e => setNewBP(prev => ({ ...prev, observations: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {editingBPId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBPId(null);
                    setNewBP({ designation: 'Bridge plug', size: '7"', type: 'PERMANENT', length: 0.23, bottomDepth: undefined, observations: '' });
                  }}
                  className="h-9 px-3 text-xs text-slate-600 hover:text-slate-800"
                >
                  Annuler
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSaveBP()}
                className="w-full sm:w-auto h-9 px-6 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs uppercase tracking-wider rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingBPId ? 'Save Changes' : 'Save B.P'}
              </button>
            </div>

            {/* Existing Bridge Plugs (B.P) list — shown when Add B.P is open */}
            {(well.tubings || []).filter(t => isBridgePlugItem(t)).length > 0 && (
              <div className="space-y-1.5 pt-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bridge Plug(s) (B.P) Enregistré(s)</p>
                {(well.tubings || []).filter(t => isBridgePlugItem(t)).map(bp => (
                  <div key={bp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 sm:px-3 sm:py-2">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono text-slate-700">
                      <span className="font-bold text-slate-900 bg-slate-200 rounded px-1.5 py-0.5 text-[10px]">{bp.name}</span>
                      <span>Taille: <strong>{bp.od || '7"'}</strong></span>
                      <span className="font-bold text-slate-800">Type: {bp.customType || bp.type || 'PERMANENT'}</span>
                      {bp.length ? <span>L: <strong>{bp.length}m</strong></span> : null}
                      <span className="text-emerald-800 font-bold">Cote: {bp.bottomDepth}m</span>
                      {bp.observations ? <span className="text-slate-500">({bp.observations})</span> : null}
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      {canAddOrEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBPId(bp.id);
                            setNewBP({
                              designation: bp.name || 'Bridge plug',
                              size: bp.od || '7"',
                              type: bp.customType || bp.type || 'PERMANENT',
                              length: bp.length || 0,
                              bottomDepth: bp.bottomDepth,
                              observations: bp.observations || ''
                            });
                          }}
                          className="p-1 text-sky-500 hover:text-sky-600 hover:bg-sky-50 rounded transition"
                          title="Modifier"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => removeTubing(bp.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* B.C — BOUCHON DE CIMENT (hidden until Add B.C clicked) */}
        {showBCForm && (
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bouchon de Ciment (B.C)</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Top Ciment — du (m)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ex: 296.89"
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono"
                  value={newCementPlug.topDepth ?? ''}
                  onChange={e => setNewCementPlug(prev => ({ ...prev, topDepth: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">B.C — à (m)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ex: 703"
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white font-mono"
                  value={newCementPlug.bottomDepth ?? ''}
                  onChange={e => setNewCementPlug(prev => ({ ...prev, bottomDepth: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Observations</label>
                <input
                  type="text"
                  placeholder="Notes..."
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded focus:border-slate-400 focus:ring-0 outline-none bg-white"
                  value={newCementPlug.observations || ''}
                  onChange={e => setNewCementPlug(prev => ({ ...prev, observations: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { handleSaveCementPlug(); setShowBCForm(false); }}
                className="w-full sm:w-auto h-9 px-6 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs uppercase tracking-wider rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save B.C
              </button>
            </div>

            {/* Existing cement plugs list */}
            {(well.cementPlugs || []).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bouchons enregistrés</p>
                {(well.cementPlugs || []).map(cp => (
                  <div key={cp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded-lg p-2 sm:px-3 sm:py-1.5">
                    <span className="text-xs font-mono text-slate-700">
                      Top ciment à <strong>{cp.topDepth}m</strong> — B.C à <strong>{cp.bottomDepth}m</strong>
                      {cp.observations ? <span className="text-slate-500 ml-2">({cp.observations})</span> : null}
                    </span>
                    {canDelete && (
                      <button type="button" onClick={() => removeCementPlug(cp.id)} className="self-end sm:self-auto text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
      )}


      {/* CASING PHASES TABLE */}
      {formMode === 'casing' && (well.casings || []).length > 0 && (
        <div className="space-y-3.5 border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2">
            <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">Casing Phases</h3>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-x-auto w-full max-w-full bg-white shadow-sm scrollbar-thin">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full min-w-[780px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 font-bold text-slate-500 uppercase text-[9px] tracking-wider">
                    <th className="w-10"></th>
                    <th className="px-3 py-2.5">Casing Name</th>
                    <th className="px-2 py-2.5 text-center">Hole Size (")</th>
                    <th className="px-2 py-2.5 text-center">Depth (m)</th>
                    <th className="px-2 py-2.5 text-center">Casing Size (")</th>
                    <th className="px-2 py-2.5 text-center">Weight</th>
                    <th className="px-2 py-2.5 text-center">Grade</th>
                    <th className="px-2 py-2.5 text-center">Connection</th>
                    <th className="px-2 py-2.5 text-right font-bold text-slate-500">Shoe Depth</th>
                    <th className="px-2 py-2.5 text-right font-bold text-slate-500">TF (m)</th>
                    <th className="px-3 py-2.5 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <SortableContext items={(well.casings || []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {(well.casings || []).map((c, index) => (
                      <SortableCasingRow
                        key={c.id}
                        c={c}
                        canAddOrEdit={canAddOrEdit}
                        canDelete={canDelete}
                        onEdit={() => {
                          setFormMode('casing');
                          setEditingCasingId(c.id);
                          setNewCasing(c);
                          document.getElementById('wellbore_form_root')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        onDelete={() => {
                          const newCasings = (well.casings || []).filter(item => item.id !== c.id);
                          onChange({
                            ...well,
                            casings: newCasings,
                            isCasingsCleared: newCasings.length === 0,
                            updatedAt: new Date().toISOString()
                          });
                        }}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        </div>
      )}

      {/* TUBING COMPLETION TABLE */}
      {formMode === 'tubing' && (
        <div className="space-y-3.5 border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">Tubing Components</h3>
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-x-auto w-full max-w-full bg-white shadow-sm scrollbar-thin">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full min-w-[840px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 font-bold text-slate-500 uppercase text-[9px] tracking-wider">
                    <th className="w-10"></th>
                    <th className="px-3 py-2.5">Désignation</th>
                    <th className="px-2 py-2.5 text-center w-14">NB.</th>
                    <th className="px-2 py-2.5 text-center w-14">TYPE</th>
                    <th className="px-2 py-2.5 text-center w-20">Diam</th>
                    <th className="px-2 py-2.5 text-right w-24">Longueur (m)</th>
                    <th className="px-2 py-2.5 text-right w-28 font-bold text-slate-500">COTE PRODUCT</th>
                    <th className="px-2 py-2.5 text-center w-24">Ø MINI</th>
                    <th className="px-3 py-2.5">Observations</th>
                    <th className="px-3 py-2.5 text-right w-20">Actions</th>
                  </tr>
                </thead>
                <SortableContext items={(well.tubings || []).filter(t => !isBridgePlugItem(t)).map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <tbody className="divide-y divide-slate-100">
                    {calculateCoteProducts(well.tubings || [], well.spoolProd)
                      .filter(t => !isBridgePlugItem(t))
                      .map((t) => {
                        return (
                          <SortableTubingRow 
                            key={t.id} 
                            t={t} 
                            cote={t.calculatedCote}
                            canAddOrEdit={canAddOrEdit}
                            canDelete={canDelete}
                            onEdit={() => {
                                setFormMode('tubing');
                                setEditingTubingId(t.id);
                                setNewTubing(t);
                                document.getElementById('wellbore_form_root')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            onDelete={() => removeTubing(t.id)}
                          />
                        );
                      })}
                    <tr className="bg-slate-100 font-bold border-t border-slate-200">
                      <td className="px-3 py-2.5" colSpan={5}></td>
                      <td className="px-2 py-2.5 text-right font-mono text-slate-800">
                        {(well.tubings || [])
                          .filter(t => !isBridgePlugItem(t))
                          .reduce((sum, t) => sum + (t.length || 0), 0)
                          .toFixed(2)}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </div>
        </div>
      )}

    </div>
  );
}
