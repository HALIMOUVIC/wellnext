import React, { useState, useEffect } from 'react';
import { WellData, LinerCrepineZone, LinerCrepineParams } from '../types';
import {
  saveLinerCrepine,
  removeLinerCrepineFromWell,
  calculateLinerCrepineHeaderParams,
  saveLinerCrepineParams
} from '../lib/wellboreEngine';
import { Plus, Trash2, Check, Edit, Layers, Save, Sliders, Anchor, Gauge, CircleDot, Disc } from 'lucide-react';

interface LinerCrepineFormProps {
  well: WellData;
  onChange: (updatedWell: WellData) => void;
  canAddOrEdit?: boolean;
  canDelete?: boolean;
}

export default function LinerCrepineForm({
  well,
  onChange,
  canAddOrEdit = true,
  canDelete = true
}: LinerCrepineFormProps) {
  // ─── 1. GENERAL LINER CRÉPINE & CONNECTED TUBING PARAMS ──────────────────
  const [headerParams, setHeaderParams] = useState<Partial<LinerCrepineParams>>({
    topOfLiner: well.linerCrepineParams?.topOfLiner,
    shoeDepth: well.linerCrepineParams?.shoeDepth,
    diameter: well.linerCrepineParams?.diameter || '',
    length: well.linerCrepineParams?.length,
    tubingSabotDepth: well.linerCrepineParams?.tubingSabotDepth,
    tubingDiameter: well.linerCrepineParams?.tubingDiameter || '',
    tubingLength: well.linerCrepineParams?.tubingLength,
    observations: well.linerCrepineParams?.observations || '',
    holeDiameter: well.linerCrepineParams?.holeDiameter || '',
    drilledToDepth: well.linerCrepineParams?.drilledToDepth
  });

  const [headerSaved, setHeaderSaved] = useState(false);

  useEffect(() => {
    setHeaderParams({
      topOfLiner: well.linerCrepineParams?.topOfLiner,
      shoeDepth: well.linerCrepineParams?.shoeDepth,
      diameter: well.linerCrepineParams?.diameter || '',
      length: well.linerCrepineParams?.length,
      tubingSabotDepth: well.linerCrepineParams?.tubingSabotDepth,
      tubingDiameter: well.linerCrepineParams?.tubingDiameter || '',
      tubingLength: well.linerCrepineParams?.tubingLength,
      observations: well.linerCrepineParams?.observations || '',
      holeDiameter: well.linerCrepineParams?.holeDiameter || '',
      drilledToDepth: well.linerCrepineParams?.drilledToDepth
    });
  }, [well.linerCrepineParams]);

  // Recalculate auto lengths on param changes
  const handleParamChange = (field: keyof LinerCrepineParams, value: any) => {
    setHeaderParams(prev => {
      const next = { ...prev, [field]: value };
      const { linerLength, tubingLength } = calculateLinerCrepineHeaderParams(
        next.topOfLiner,
        next.shoeDepth,
        next.tubingSabotDepth,
        well.spoolProd
      );
      if (linerLength !== undefined) next.length = linerLength;
      if (tubingLength !== undefined) next.tubingLength = tubingLength;
      return next;
    });
    setHeaderSaved(false);
  };

  const handleSaveHeaderParams = () => {
    const updatedWell = saveLinerCrepineParams(well, headerParams);
    onChange(updatedWell);
    setHeaderSaved(true);
    setTimeout(() => setHeaderSaved(false), 3000);
  };

  // ─── 2. INTERVAL ZONES (CRÉPINES) ──────────────────────────────────────────
  const [editingLCId, setEditingLCId] = useState<string | null>(null);
  const [newLC, setNewLC] = useState<Partial<LinerCrepineZone>>({
    topDepth: undefined,
    bottomDepth: undefined,
    height: undefined,
    typeCrepine: '',
    diameter: '',
    slot: '',
    idMi: '',
    nbreCoups: undefined,
    observations: ''
  });

  const handleSaveLC = () => {
    if (
      newLC.topDepth === undefined ||
      newLC.bottomDepth === undefined ||
      newLC.topDepth === null ||
      newLC.bottomDepth === null ||
      isNaN(newLC.topDepth) ||
      isNaN(newLC.bottomDepth)
    ) {
      return;
    }

    const updatedWell = saveLinerCrepine(well, newLC, editingLCId);
    onChange(updatedWell);

    setEditingLCId(null);
    setNewLC({
      topDepth: undefined,
      bottomDepth: undefined,
      height: undefined,
      typeCrepine: '',
      diameter: '',
      slot: '',
      idMi: '',
      nbreCoups: undefined,
      observations: ''
    });
  };

  const removeLC = (id: string) => {
    const updatedWell = removeLinerCrepineFromWell(well, id);
    onChange(updatedWell);
    if (editingLCId === id) {
      setEditingLCId(null);
      setNewLC({
        topDepth: undefined,
        bottomDepth: undefined,
        height: undefined,
        typeCrepine: '',
        diameter: '',
        slot: '',
        idMi: '',
        nbreCoups: undefined,
        observations: ''
      });
    }
  };

  const formatMeters = (val?: number | null) =>
    val !== undefined && val !== null && !isNaN(val) ? `${val.toFixed(2)} m` : '—';

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full overflow-hidden" id="liner_crepine_container">
      {/* ─── SECTION 1: CONFIGURATION LINER CRÉPINE (TOL / SABOT CRÉPINE / OPEN HOLE) ─── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 shadow-2xs space-y-4" id="liner_crepine_header_section">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                1. Configuration Liner Crépine (TOL / Sabot)
              </h3>
              <p className="text-[11px] text-slate-500">
                Définissez la cote de départ (TOL), le sabot crépine, le diamètre du liner, ainsi que le trou foré (Hole Ø & foré jusqu'à).
              </p>
            </div>
          </div>
          {headerSaved && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> Enregistré
            </span>
          )}
        </div>

        {/* Quick summary strip */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 sm:p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Début (TOL)</span>
            <span className="font-mono font-bold text-slate-800">{formatMeters(headerParams.topOfLiner)}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Sabot Crépine</span>
            <span className="font-mono font-bold text-slate-800">{formatMeters(headerParams.shoeDepth)}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Long. Crépine</span>
            <span className="font-mono font-bold text-indigo-600">{formatMeters(headerParams.length)}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Ø. Liner Crépine</span>
            <span className="font-mono font-bold text-sky-600">{headerParams.diameter || '—'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Hole Ø (Trou)</span>
            <span className="font-mono font-bold text-amber-600">{headerParams.holeDiameter || '—'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Foré jusqu'à</span>
            <span className="font-mono font-bold text-amber-700">{formatMeters(headerParams.drilledToDepth)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
          {/* Top of Liner (TOL) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Anchor className="w-3 h-3 text-indigo-500" />
              Début Liner Crépine (TOL) (m)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="ex: 166.00"
              className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
              value={headerParams.topOfLiner !== undefined && headerParams.topOfLiner !== null ? headerParams.topOfLiner : ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                handleParamChange('topOfLiner', val);
              }}
            />
          </div>

          {/* Shoe Depth (Sabot Crépine) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-indigo-500" />
              Sabot Liner Crépine (m)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="ex: 273.40"
              className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
              value={headerParams.shoeDepth !== undefined && headerParams.shoeDepth !== null ? headerParams.shoeDepth : ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                handleParamChange('shoeDepth', val);
              }}
            />
          </div>

          {/* Liner Diameter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Ø. Liner Crépine
            </label>
            <input
              type="text"
              placeholder="ex: 6'', 7'', 4''1/2"
              className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
              value={headerParams.diameter || ''}
              onChange={(e) => handleParamChange('diameter', e.target.value)}
            />
          </div>

          {/* Liner Length (auto or editable) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Longueur Crépine (m) <span className="text-[10px] text-slate-400 font-normal">(Calculée)</span>
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="ex: 107.40"
              className="w-full h-8 px-2 text-xs font-mono font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-200 rounded focus:outline-none focus:border-indigo-500"
              value={headerParams.length !== undefined && headerParams.length !== null ? headerParams.length : ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                handleParamChange('length', val);
              }}
            />
          </div>

          {/* Hole Ø (Diamètre Trou Foré / Open Hole) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <CircleDot className="w-3 h-3 text-amber-500" />
              Hole Ø (Diamètre trou)
            </label>
            <input
              type="text"
              id="input_open_hole_diameter"
              placeholder="ex: 8'' 1/2"
              className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-amber-50/30 border border-amber-200 rounded focus:outline-none focus:border-amber-500"
              value={headerParams.holeDiameter !== undefined && headerParams.holeDiameter !== null ? headerParams.holeDiameter : ''}
              onChange={(e) => handleParamChange('holeDiameter', e.target.value)}
            />
          </div>

          {/* Foré jusqu'à (Profondeur forée / Open Hole Depth) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Disc className="w-3 h-3 text-amber-500" />
              Foré jusqu'à (m)
            </label>
            <input
              type="number"
              step="0.01"
              id="input_open_hole_depth"
              placeholder="ex: 275.00"
              className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-amber-50/30 border border-amber-200 rounded focus:outline-none focus:border-amber-500"
              value={headerParams.drilledToDepth !== undefined && headerParams.drilledToDepth !== null ? headerParams.drilledToDepth : ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                handleParamChange('drilledToDepth', val);
              }}
            />
          </div>

          {/* Save Header Params Button */}
          {canAddOrEdit && (
            <div className="flex items-end sm:col-span-2 lg:col-span-2 pt-1 justify-end">
              <button
                type="button"
                id="btn_save_liner_params"
                onClick={handleSaveHeaderParams}
                className="w-full sm:w-auto px-6 h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                Enregistrer Configuration
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── SECTION 2: AJOUTER NIVEAUX CRÉPINÉS (LINER CRÉPINE) ─────────── */}
      {canAddOrEdit && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 shadow-2xs space-y-4" id="liner_crepine_intervals_section">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                {editingLCId ? "Éditer Niveau Crépiné" : "2. Ajouter Niveaux Crépinés (Liner Crépine)"}
              </h3>
            </div>
            {editingLCId && (
              <button
                type="button"
                onClick={() => {
                  setEditingLCId(null);
                  setNewLC({
                    topDepth: undefined,
                    bottomDepth: undefined,
                    height: undefined,
                    typeCrepine: '',
                    diameter: '',
                    slot: '',
                    idMi: '',
                    nbreCoups: undefined,
                    observations: ''
                  });
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Annuler l'édition
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
            {/* Top Depth */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">De (m) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="254.57"
                className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                value={newLC.topDepth !== undefined && newLC.topDepth !== null ? newLC.topDepth : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const top = val ?? 0;
                  const bot = newLC.bottomDepth ?? 0;
                  const calcH = Math.abs(bot - top);
                  setNewLC(prev => ({
                    ...prev,
                    topDepth: val,
                    height: calcH > 0 ? parseFloat(calcH.toFixed(2)) : prev.height
                  }));
                }}
              />
            </div>

            {/* Bottom Depth */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">À (m) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="260.83"
                className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                value={newLC.bottomDepth !== undefined && newLC.bottomDepth !== null ? newLC.bottomDepth : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const bot = val ?? 0;
                  const top = newLC.topDepth ?? 0;
                  const calcH = Math.abs(bot - top);
                  setNewLC(prev => ({
                    ...prev,
                    bottomDepth: val,
                    height: calcH > 0 ? parseFloat(calcH.toFixed(2)) : prev.height
                  }));
                }}
              />
            </div>

            {/* Height */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Hauteur (m)</label>
              <input
                type="number"
                step="0.01"
                placeholder="6.26"
                className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                value={newLC.height !== undefined && newLC.height !== null ? newLC.height : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  setNewLC(prev => ({ ...prev, height: val }));
                }}
              />
            </div>

            {/* Type Crépine */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Type Crépine</label>
              <input
                type="text"
                placeholder="JOHNSON, //"
                className="w-full h-8 px-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500 uppercase"
                value={newLC.typeCrepine || ''}
                onChange={(e) => setNewLC(prev => ({ ...prev, typeCrepine: e.target.value }))}
              />
            </div>

            {/* Diamètre */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Ø. Crépine</label>
              <input
                type="text"
                placeholder={headerParams.diameter || "ex: 6''"}
                className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                value={newLC.diameter !== undefined ? newLC.diameter : ''}
                onChange={(e) => setNewLC(prev => ({ ...prev, diameter: e.target.value }))}
              />
            </div>

            {/* Slot */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Slot</label>
              <input
                type="text"
                placeholder="0.020"
                className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                value={newLC.slot || ''}
                onChange={(e) => setNewLC(prev => ({ ...prev, slot: e.target.value }))}
              />
            </div>

            {/* ID mi */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">ID mi</label>
              <input
                type="text"
                placeholder="ID mi"
                className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                value={newLC.idMi || ''}
                onChange={(e) => setNewLC(prev => ({ ...prev, idMi: e.target.value }))}
              />
            </div>

            {/* Nbre Coups */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Nbre. Coups</label>
              <input
                type="number"
                placeholder="100"
                className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-sky-500"
                value={newLC.nbreCoups !== undefined && newLC.nbreCoups !== null ? newLC.nbreCoups : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  setNewLC(prev => ({ ...prev, nbreCoups: val }));
                }}
              />
            </div>

            {/* Save Button */}
            <div className="flex items-end sm:col-span-2 lg:col-span-4 pt-2">
              <button
                type="button"
                id="btn_add_liner_interval"
                onClick={handleSaveLC}
                className="w-full sm:w-auto px-6 h-8 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                {editingLCId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {editingLCId ? "Mettre à jour Niveau Crépiné" : "Ajouter Niveau Crépiné"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION 3: ACTIVE LINER CREPINE TABLE ───────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs shrink-0" id="liner_crepine_table_card">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Liner Crépine (Niveaux Crépinés)</h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            {(well.linerCrepines || []).length} Zones
          </span>
        </div>

        <div className="overflow-x-auto w-full max-w-full scrollbar-thin">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead className="bg-slate-100/60 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 whitespace-nowrap">Niveaux Crépinés</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Hauteur (m)</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Type Crépine</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Ø. crépine</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Slot</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">ID mi</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Nbre. Coups</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!well.linerCrepines || well.linerCrepines.length === 0) ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400 italic bg-white">
                    Aucun niveau crépiné défini.
                  </td>
                </tr>
              ) : (
                well.linerCrepines.map((lc) => (
                  <tr key={lc.id} className="hover:bg-slate-50/50 bg-white">
                    <td className="px-4 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                      De {lc.topDepth.toFixed(2)} à {lc.bottomDepth.toFixed(2)}
                    </td>
                    <td className="px-2 py-3.5 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                      {lc.height % 1 === 0 ? lc.height : parseFloat(lc.height.toFixed(2))}m
                    </td>
                    <td className="px-2 py-3.5 text-center text-slate-700 font-bold uppercase whitespace-nowrap">{lc.typeCrepine || '—'}</td>
                    <td className="px-2 py-3.5 text-center font-mono text-slate-600 whitespace-nowrap">{lc.diameter || '—'}</td>
                    <td className="px-2 py-3.5 text-center font-mono text-slate-600 whitespace-nowrap">{lc.slot || '—'}</td>
                    <td className="px-2 py-3.5 text-center font-mono text-slate-600 whitespace-nowrap">{lc.idMi || '—'}</td>
                    <td className="px-2 py-3.5 text-center font-mono font-bold text-sky-600 whitespace-nowrap">{lc.nbreCoups !== undefined ? lc.nbreCoups : '—'}</td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2.5">
                        {canAddOrEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLCId(lc.id);
                              setNewLC(lc);
                            }}
                            className="text-sky-500 hover:text-sky-600 transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => removeLC(lc.id)}
                            className="text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

