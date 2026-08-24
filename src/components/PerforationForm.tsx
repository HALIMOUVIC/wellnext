import React, { useState } from 'react';
import { WellData, PerforationZone } from '../types';
import { calculatePerforationFields, savePerforation, squeezePerforations, removePerforationFromWell } from '../lib/wellboreEngine';
import { Flame, Plus, Trash2, Check, Edit, Lock, Unlock } from 'lucide-react';

interface PerforationFormProps {
  well: WellData;
  onChange: (updatedWell: WellData) => void;
  canAddOrEdit?: boolean;
  canDelete?: boolean;
}

export default function PerforationForm({ well, onChange, canAddOrEdit = true, canDelete = true }: PerforationFormProps) {
  // Perforation edit state
  const [editingPerfId, setEditingPerfId] = useState<string | null>(null);
  const [newPerf, setNewPerf] = useState<Partial<PerforationZone>>({
    topDepth: undefined,
    bottomDepth: undefined,
    height: undefined,
    perfoType: '',
    diameter: '',
    density: undefined,
    calage: '',
    shots: undefined,
    observations: '',
    reservoir: well.reservoir || '',
    isSqueezed: false
  });

  // We calculate height and shots on inputs' onChange now so that manual edits to the height field are preserved.

  const handleSavePerf = () => {
    if (
      newPerf.topDepth === undefined ||
      newPerf.bottomDepth === undefined ||
      newPerf.topDepth === null ||
      newPerf.bottomDepth === null ||
      isNaN(newPerf.topDepth) ||
      isNaN(newPerf.bottomDepth)
    ) {
      return;
    }

    const updatedWell = savePerforation(well, newPerf, editingPerfId);
    onChange(updatedWell);

    if (editingPerfId) {
      setEditingPerfId(null);
    }

    setNewPerf({
      topDepth: undefined,
      bottomDepth: undefined,
      height: undefined,
      perfoType: '',
      diameter: '',
      density: undefined,
      calage: '',
      shots: undefined,
      observations: '',
      reservoir: well.reservoir || '',
      isSqueezed: false
    });
  };

  const removePerforation = (id: string) => {
    const updatedWell = removePerforationFromWell(well, id);
    onChange(updatedWell);
  };

  const toggleSqueezeAll = () => {
    if (well.perforations.length === 0) return;
    const allSqueezed = well.perforations.every(p => p.isSqueezed);
    const updated = squeezePerforations(well, well.perforations.map(p => p.id), !allSqueezed);
    onChange(updated);
  };


  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-5 md:p-6 space-y-5 sm:space-y-6 w-full max-w-full overflow-hidden" id="perforation_form_root">
      
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-rose-600 animate-pulse" />
          <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">3. Perforations</h3>
        </div>
        {well.perforations.some(p => p.isSqueezed) && (
          <span className="px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            {well.perforations.filter(p => p.isSqueezed).length} Zone(s) Squeezée(s)
          </span>
        )}
      </div>

      {canAddOrEdit && (
        <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 sm:p-4 space-y-4 shrink-0">
          <div className="border-b border-slate-200 pb-2">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                {editingPerfId ? "Edit Perforation Zone Data" : "Add Perforation Zone Data"}
              </h4>
              {editingPerfId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPerfId(null);
                    setNewPerf({ topDepth: undefined, bottomDepth: undefined, height: undefined, perfoType: '', diameter: '', density: undefined, calage: '', shots: undefined, observations: '', reservoir: well.reservoir || '', isSqueezed: false });
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold underline capitalize"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          {/* ALL PERFORATION INPUTS GROUPED TOGETHER AS REQUESTED BY THE USER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            
            {/* input: De */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                De (m) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Top depth"
                className="w-full h-8 px-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.topDepth !== undefined && newPerf.topDepth !== null ? newPerf.topDepth : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const updatedTop = val;
                  const currentBottom = newPerf.bottomDepth;
                  let updatedHeight = newPerf.height;
                  let updatedShots = newPerf.shots;

                  if (updatedTop !== undefined && currentBottom !== undefined && !isNaN(updatedTop) && !isNaN(currentBottom)) {
                    const fields = calculatePerforationFields(updatedTop, currentBottom, newPerf.height, newPerf.density, newPerf.shots);
                    updatedHeight = fields.height;
                    updatedShots = fields.shots;
                  }

                  setNewPerf(prev => ({
                    ...prev,
                    topDepth: val,
                    height: updatedHeight,
                    shots: updatedShots
                  }));
                }}
              />
            </div>

            {/* input: À */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                À (m) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Bottom depth"
                className="w-full h-8 px-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.bottomDepth !== undefined && newPerf.bottomDepth !== null ? newPerf.bottomDepth : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const updatedBottom = val;
                  const currentTop = newPerf.topDepth;
                  let updatedHeight = newPerf.height;
                  let updatedShots = newPerf.shots;

                  if (currentTop !== undefined && updatedBottom !== undefined && !isNaN(currentTop) && !isNaN(updatedBottom)) {
                    const fields = calculatePerforationFields(currentTop, updatedBottom, newPerf.height, newPerf.density, newPerf.shots);
                    updatedHeight = fields.height;
                    updatedShots = fields.shots;
                  }

                  setNewPerf(prev => ({
                    ...prev,
                    bottomDepth: val,
                    height: updatedHeight,
                    shots: updatedShots
                  }));
                }}
              />
            </div>

            {/* input: Réservoir */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Réservoir
              </label>
              <input
                type="text"
                placeholder="ex: F6, TAGI..."
                className="w-full h-8 px-2 text-xs font-bold text-rose-700 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.reservoir || ''}
                onChange={(e) => setNewPerf(prev => ({ ...prev, reservoir: e.target.value }))}
              />
            </div>

            {/* input: Hauteur */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Hauteur (m)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Height"
                className="w-full h-8 px-2 text-xs font-mono bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.height !== undefined && newPerf.height !== null ? newPerf.height : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const top = newPerf.topDepth || 0;
                  const bottom = newPerf.bottomDepth || 0;
                  const fields = calculatePerforationFields(top, bottom, val, newPerf.density, newPerf.shots);
                  setNewPerf(prev => ({
                    ...prev,
                    height: val,
                    shots: fields.shots
                  }));
                }}
              />
            </div>

            {/* input: Type de Perfo. */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Type de Perfo.
              </label>
              <input
                type="text"
                placeholder="e.g. CC, TCP"
                className="w-full h-8 px-2 text-xs uppercase bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.perfoType || ''}
                onChange={(e) => setNewPerf(prev => ({ ...prev, perfoType: e.target.value }))}
              />
            </div>

            {/* input: Diamètre du Perfo. */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Diamètre du Perfo.
              </label>
              <input
                type="text"
                placeholder="e.g. 4''1/2"
                className="w-full h-8 px-2 text-xs font-mono bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.diameter || ''}
                onChange={(e) => setNewPerf(prev => ({ ...prev, diameter: e.target.value }))}
              />
            </div>

            {/* input: Densité au m. */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Densité (cps/m)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Shots per meter"
                className="w-full h-8 px-2 text-xs font-mono bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.density !== undefined && newPerf.density !== null ? newPerf.density : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  const top = newPerf.topDepth || 0;
                  const bottom = newPerf.bottomDepth || 0;
                  const fields = calculatePerforationFields(top, bottom, newPerf.height, val, undefined);
                  setNewPerf(prev => ({
                    ...prev,
                    density: val,
                    shots: fields.shots
                  }));
                }}
              />
            </div>

            {/* input: Calage */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Calage
              </label>
              <input
                type="text"
                placeholder="e.g. CCL"
                className="w-full h-8 px-2 text-xs font-mono bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.calage || ''}
                onChange={(e) => setNewPerf(prev => ({ ...prev, calage: e.target.value }))}
              />
            </div>

            {/* input: Nbr. de Cps. Tirés */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Nbr. de Cps. Tirés
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Total shots"
                className="w-full h-8 px-2 text-xs font-mono font-bold text-rose-600 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#f97316]"
                value={newPerf.shots !== undefined && newPerf.shots !== null ? newPerf.shots : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  setNewPerf(prev => ({ ...prev, shots: val }));
                }}
              />
            </div>

            {/* Checkbox input: Squeezed / Bouchée */}
            <div className="flex items-center gap-2 pt-2 sm:pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={!!newPerf.isSqueezed}
                  onChange={(e) => setNewPerf(prev => ({ ...prev, isSqueezed: e.target.checked }))}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <span className={`px-2.5 py-1 rounded text-[11px] uppercase tracking-wider flex items-center gap-1.5 font-bold border transition ${newPerf.isSqueezed ? 'text-amber-800 bg-amber-100 border-amber-300' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                  <Lock className="w-3.5 h-3.5 text-amber-600" /> Squeezed
                </span>
              </label>
            </div>

            {/* Save Button */}
            <div className="flex items-end sm:col-span-2 lg:col-span-2 pt-2 sm:pt-0">
              <button
                type="button"
                onClick={handleSavePerf}
                className="w-full sm:w-auto px-6 h-8 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                {editingPerfId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {editingPerfId ? "Update Perforation Zone" : "Add Perforation Zone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE PERFORATION LEVELS TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs shrink-0">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Perforation Intervals & Guns Tally</h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            {well.perforations.length} Total Zones
          </span>
        </div>

        <div className="overflow-x-auto w-full max-w-full scrollbar-thin">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-100/60 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-center whitespace-nowrap" title="Cocher pour squeezer / unsqueezer">
                  <div className="flex items-center justify-center gap-1.5 cursor-pointer" onClick={toggleSqueezeAll}>
                    <input
                      type="checkbox"
                      checked={well.perforations.length > 0 && well.perforations.every(p => p.isSqueezed)}
                      onChange={toggleSqueezeAll}
                      className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Squeezed</span>
                  </div>
                </th>
                <th className="px-3 py-2 whitespace-nowrap">De (m)</th>
                <th className="px-3 py-2 whitespace-nowrap">À (m)</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Statut</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Réservoir</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Hauteur (m)</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Type de Perfo.</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Diamètre</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Densité</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Calage</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">Nbr. de Cps.</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {well.perforations.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-xs text-slate-400 italic bg-white">
                    No perforation levels defined.
                  </td>
                </tr>
              ) : (
                well.perforations.map((perf) => {
                  return (
                    <tr
                      key={perf.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        perf.isSqueezed ? 'bg-amber-50/30' : 'bg-white'
                      }`}
                    >
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={!!perf.isSqueezed}
                          onChange={() => {
                            const updated = squeezePerforations(well, [perf.id], !perf.isSqueezed);
                            onChange(updated);
                          }}
                          className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                          title={perf.isSqueezed ? "Dé-squeezer cette zone" : "Squeezer cette zone"}
                        />
                      </td>
                      <td className="px-3 py-3.5 font-bold text-slate-800 whitespace-nowrap">{perf.topDepth.toFixed(2)}</td>
                      <td className="px-3 py-3.5 font-bold text-slate-800 whitespace-nowrap">{perf.bottomDepth.toFixed(2)}</td>
                      <td className="px-2 py-3.5 text-center whitespace-nowrap">
                        {perf.isSqueezed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-full whitespace-nowrap shadow-2xs">
                            <Lock className="w-3 h-3 text-amber-700 shrink-0" /> Squeezée
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full whitespace-nowrap shadow-2xs">
                            <Flame className="w-3 h-3 text-emerald-600 shrink-0" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3.5 text-center whitespace-nowrap">
                        <span className="px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded whitespace-nowrap">
                          {perf.reservoir || well.reservoir || '—'}
                        </span>
                      </td>
                      <td className="px-2 py-3.5 text-center font-mono font-bold text-slate-800 whitespace-nowrap">{perf.height % 1 === 0 ? perf.height : parseFloat(perf.height.toFixed(2))}m</td>
                      <td className="px-2 py-3.5 text-center text-slate-700 uppercase font-bold whitespace-nowrap">{perf.perfoType || ''}</td>
                      <td className="px-2 py-3.5 text-center font-mono text-slate-600 whitespace-nowrap">{perf.diameter || ''}</td>
                      <td className="px-2 py-3.5 text-center font-mono text-slate-600 whitespace-nowrap">{perf.density !== undefined ? perf.density : ''}</td>
                      <td className="px-2 py-3.5 text-center font-mono text-slate-600 whitespace-nowrap">{perf.calage || ''}</td>
                      <td className="px-2 py-3.5 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                        {perf.shots !== undefined && perf.shots !== null ? (perf.shots % 1 === 0 ? perf.shots : parseFloat(perf.shots.toFixed(2))) : ''}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          {canAddOrEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = squeezePerforations(well, [perf.id], !perf.isSqueezed);
                                onChange(updated);
                              }}
                              title={perf.isSqueezed ? "Unsqueezer" : "Squeezer perfo"}
                              className={`p-1 rounded transition ${
                                perf.isSqueezed
                                   ? 'text-amber-600 hover:text-amber-700 bg-amber-50'
                                   : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                              }`}
                            >
                              {perf.isSqueezed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {canAddOrEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPerfId(perf.id);
                                setNewPerf(perf);
                              }}
                              className="p-1 text-sky-500 hover:text-sky-600 transition hover:bg-sky-50 rounded"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => removePerforation(perf.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
  );
}
