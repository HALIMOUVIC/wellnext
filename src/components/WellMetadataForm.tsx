import React, { useEffect } from 'react';
import { Settings, Ruler, Building, Tag, FileText, MapPin, AlertCircle, Sparkles } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { WellData, Perimetre } from '../types';

interface WellMetadataFormProps {
  well: WellData;
  onChange: (updatedWell: WellData) => void;
  isFolioEditable?: boolean;
  onValidateName?: (name: string) => void;
  isDuplicateName?: boolean;
  perimetersList?: string[];
  fullPerimetres?: Perimetre[];
}

export function inferPerimeterFromWellName(wellName: string, perimetres: Perimetre[] = []): string | null {
  if (!wellName || !wellName.trim()) return null;
  const upper = wellName.trim().toUpperCase();

  // 1. Match by abbreviation first (longer abbreviations prioritized)
  const withAbbr = perimetres.filter((p) => p.abbreviation && p.abbreviation.trim());
  withAbbr.sort((a, b) => (b.abbreviation?.trim().length || 0) - (a.abbreviation?.trim().length || 0));

  for (const p of withAbbr) {
    const abbr = p.abbreviation!.trim().toUpperCase();
    if (!abbr) continue;
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}([\\s\\-_\\.\\d]|$)`, 'i');
    if (regex.test(upper) || upper.startsWith(abbr)) {
      return p.name;
    }
  }

  // 2. Match by perimeter name (longer names prioritized)
  const sortedByName = [...perimetres].sort((a, b) => b.name.trim().length - a.name.trim().length);
  for (const p of sortedByName) {
    const pName = p.name.trim().toUpperCase();
    if (!pName) continue;
    const escaped = pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}([\\s\\-_\\.\\d]|$)`, 'i');
    if (regex.test(upper) || upper.startsWith(pName)) {
      return p.name;
    }
  }

  return null;
}

export default function WellMetadataForm({
  well,
  onChange,
  isFolioEditable = false,
  onValidateName,
  isDuplicateName = false,
  perimetersList = [],
  fullPerimetres = [],
}: WellMetadataFormProps) {
  const handleChange = (field: keyof WellData, value: any) => {
    onChange({
      ...well,
      [field]: value,
      updatedAt: new Date().toISOString()
    });
  };

  const handleNameChange = (val: string) => {
    const detectedField = inferPerimeterFromWellName(val, fullPerimetres);
    onChange({
      ...well,
      name: val,
      field: detectedField !== null ? detectedField : (val.trim() === '' ? '' : well.field || ''),
      updatedAt: new Date().toISOString()
    });
  };

  // Automatically update field if well.name has a match in perimetres and field is out of sync or empty
  useEffect(() => {
    if (well.name && fullPerimetres.length > 0) {
      const detected = inferPerimeterFromWellName(well.name, fullPerimetres);
      if (detected && detected !== well.field) {
        onChange({
          ...well,
          field: detected,
          updatedAt: new Date().toISOString()
        });
      }
    }
  }, [well.name, fullPerimetres]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-5 md:p-6 space-y-5 sm:space-y-6 w-full max-w-full overflow-hidden" id="metadata_form_container">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 shrink-0" id="metadata_form_header">
        <div>
          <h3 className="font-sans font-semibold text-slate-800 text-sm">Well Identification & Parameters</h3>
          <p className="text-xs text-slate-400">Specify general metadata, locations, and elevations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" id="metadata_fields_grid">
        {/* Folio N° */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="well_folio">Folio N°</label>
          <input
            type="text"
            id="well_folio"
            className={`w-full px-3 py-1.5 h-8 text-xs border border-slate-200 rounded-lg focus:outline-none font-medium ${
              isFolioEditable
                ? "bg-white text-slate-900 focus:ring-2 focus:ring-sky-500"
                : "bg-slate-100 text-slate-500 cursor-not-allowed"
            }`}
            value={well.folio || '00'}
            onChange={(e) => isFolioEditable && handleChange('folio', e.target.value)}
            disabled={!isFolioEditable}
            placeholder="e.g. 02"
            title={isFolioEditable ? "Numéro de Folio (saisissable pour un nouveau puits)" : "Numéro de Folio (verrouillé après sauvegarde)"}
          />
        </div>
        
        {/* Well Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="well_name">Well Name (GARA 2)</label>
          <div className="relative">
            <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${isDuplicateName ? 'text-rose-500' : 'text-slate-400'}`}>
              <Tag className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              id="well_name"
              className={`w-full pl-9 pr-3 py-1.5 h-8 text-xs border rounded-lg focus:outline-none font-medium transition-colors ${
                isDuplicateName
                  ? "border-rose-500 ring-2 ring-rose-500/20 text-rose-900 bg-rose-50/20 focus:ring-rose-500/40 focus:border-rose-600"
                  : "border-slate-200 focus:ring-2 focus:ring-sky-500"
              }`}
              value={well.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => onValidateName?.(well.name)}
              placeholder="e.g. DL 6, ASS 1, H 6..."
            />
          </div>
          {isDuplicateName && (
            <p className="text-[10px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
              Un puits portant ce nom existe déjà !
            </p>
          )}
        </div>

        {/* Périmètre (Automatique / Non éditable) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="well_field">
            Périmètre <span className="text-[10px] text-slate-400 font-normal">(Auto-détecté)</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
              <MapPin className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              id="well_field"
              readOnly
              disabled
              className="w-full pl-9 pr-3 py-1.5 h-8 text-xs border border-slate-200 rounded-lg font-bold bg-slate-100/90 text-slate-700 cursor-not-allowed select-none focus:outline-none"
              value={well.field || ''}
              placeholder="Détecté automatiquement..."
              title="Le périmètre est déterminé automatiquement à partir du nom du puits et de la table des périmètres"
            />
          </div>
        </div>

        {/* Reservoir */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="well_reservoir">Reservoir</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Building className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              id="well_reservoir"
              className="w-full pl-9 pr-3 py-1.5 h-8 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              value={well.reservoir}
              onChange={(e) => handleChange('reservoir', e.target.value)}
              placeholder="e.g. F6"
            />
          </div>
        </div>

        {/* Completion Type */}
        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
            <label className="block text-xs font-semibold text-slate-600" htmlFor="well_completion">Completion Type</label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-rose-600 cursor-pointer select-none">
              <input
                type="checkbox"
                id="well_abandon_toggle"
                checked={!!well.isAbandonProvisoire}
                onChange={(e) => handleChange('isAbandonProvisoire', e.target.checked)}
                className="w-3.5 h-3.5 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
              />
              <span>Abandon provisoire (kill string)</span>
            </label>
          </div>
          <input
            type="text"
            id="well_completion"
            className="w-full px-3 py-1.5 h-8 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            value={well.completionType}
            onChange={(e) => handleChange('completionType', e.target.value)}
            placeholder="e.g. COMPLETION SIMPLE"
          />
        </div>

        {/* Purpose */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Well Purpose (Puits Type)</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none bg-white px-2 py-1.5 rounded border border-slate-200/80 shadow-2xs hover:border-sky-300">
              <input
                type="radio"
                name="well_purpose"
                value="PPH"
                checked={well.purpose === 'PPH' || well.purpose === 'Puits Producteur Huile (PPH)'}
                onChange={() => handleChange('purpose', 'PPH')}
                className="w-3.5 h-3.5 text-sky-500 border-slate-300 focus:ring-sky-500"
              />
              <span>PPH</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none bg-white px-2 py-1.5 rounded border border-slate-200/80 shadow-2xs hover:border-sky-300">
              <input
                type="radio"
                name="well_purpose"
                value="PPH (SRP)"
                checked={well.purpose === 'PPH (SRP)'}
                onChange={() => handleChange('purpose', 'PPH (SRP)')}
                className="w-3.5 h-3.5 text-sky-500 border-slate-300 focus:ring-sky-500"
              />
              <span className="truncate">PPH (SRP)</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none bg-white px-2 py-1.5 rounded border border-slate-200/80 shadow-2xs hover:border-sky-300">
              <input
                type="radio"
                name="well_purpose"
                value="PPG"
                checked={well.purpose === 'PPG'}
                onChange={() => handleChange('purpose', 'PPG')}
                className="w-3.5 h-3.5 text-sky-500 border-slate-300 focus:ring-sky-500"
              />
              <span>PPG</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none bg-white px-2 py-1.5 rounded border border-slate-200/80 shadow-2xs hover:border-sky-300">
              <input
                type="radio"
                name="well_purpose"
                value="PPE"
                checked={well.purpose === 'PPE'}
                onChange={() => handleChange('purpose', 'PPE')}
                className="w-3.5 h-3.5 text-sky-500 border-slate-300 focus:ring-sky-500"
              />
              <span>PPE</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none bg-white px-2 py-1.5 rounded border border-slate-200/80 shadow-2xs hover:border-sky-300">
              <input
                type="radio"
                name="well_purpose"
                value="PIE"
                checked={well.purpose === 'PIE' || well.purpose === 'Injecteur' || well.purpose === 'PIE (Injecteur)'}
                onChange={() => handleChange('purpose', 'PIE')}
                className="w-3.5 h-3.5 text-sky-500 border-slate-300 focus:ring-sky-500"
              />
              <span>PIE</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none bg-white px-2 py-1.5 rounded border border-slate-200/80 shadow-2xs hover:border-sky-300">
              <input
                type="radio"
                name="well_purpose"
                value="ESP"
                checked={well.purpose === 'ESP'}
                onChange={() => handleChange('purpose', 'ESP')}
                className="w-3.5 h-3.5 text-sky-500 border-slate-300 focus:ring-sky-500"
              />
              <span>ESP</span>
            </label>
          </div>
        </div>

        {/* Spool / Rig Details */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="well_spool">Sp.att tbg</label>
          <input
            type="text"
            id="well_spool"
            className="w-full px-3 py-1.5 h-8 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            value={well.spoolProd || ''}
            onChange={(e) => handleChange('spoolProd', e.target.value)}
            placeholder="e.g. + 0.68"
          />
        </div>

        {/* SUSP. TBG - Olive */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="well_x_olive">SUSP. TBG - Olive</label>
          <input
            type="text"
            id="well_x_olive"
            className="w-full px-3 py-1.5 h-8 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            value={well.xmasTreeOlive || ''}
            onChange={(e) => handleChange('xmasTreeOlive', e.target.value)}
            placeholder='e.g. CAM A403 Taraudée en 2" 7/8 EU'
          />
        </div>

        {/* ETAN. S/ TBG - PKR de tête */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="well_packer_type">ETAN. S/ TBG - PKR de tête</label>
          <input
            type="text"
            id="well_packer_type"
            className="w-full px-3 py-1.5 h-8 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            value={well.packerType || well.etanTbg || ''}
            onChange={(e) => {
              onChange({
                ...well,
                packerType: e.target.value,
                etanTbg: e.target.value,
                updatedAt: new Date().toISOString()
              });
            }}
            placeholder="e.g. //"
          />
        </div>
      </div>

      {/* TETE D'ERUPTION / CHRISTMAS TREE DETAILS */}
      <div className="bg-slate-50/70 rounded-xl border border-slate-200/70 p-3 sm:p-4 space-y-3" id="tete_deruption_container">
        <span className="text-xs font-bold text-slate-700 block">
          Tête d'Éruption (Christmas Tree Specifications)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="well_x_marque">Marque</label>
            <input
              type="text"
              id="well_x_marque"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-white"
              value={well.xmasTreeBrand || ''}
              onChange={(e) => handleChange('xmasTreeBrand', e.target.value)}
              placeholder="e.g. CROWN"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="well_x_type">Type</label>
            <input
              type="text"
              id="well_x_type"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-white"
              value={well.xmasTreeType || ''}
              onChange={(e) => handleChange('xmasTreeType', e.target.value)}
              placeholder="e.g. CTCM"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="well_x_ract">Ract. Sup.</label>
            <input
              type="text"
              id="well_x_ract"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-white"
              value={well.xmasTreeRactSup || ''}
              onChange={(e) => handleChange('xmasTreeRactSup', e.target.value)}
              placeholder="e.g. CB 15A"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="well_x_pression">Pression service</label>
            <input
              type="text"
              id="well_x_pression"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-white"
              value={well.xmasTreePressure || ''}
              onChange={(e) => handleChange('xmasTreePressure', e.target.value)}
              placeholder="e.g. 2000"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="well_x_attache">Attache Tbg</label>
            <input
              type="text"
              id="well_x_attache"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-white"
              value={well.xmasTreeAttacheTbg || ''}
              onChange={(e) => handleChange('xmasTreeAttacheTbg', e.target.value)}
              placeholder="e.g. OLIVE"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="well_x_embase">Embase</label>
            <input
              type="text"
              id="well_x_embase"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-white"
              value={well.xmasTreeEmbase || ''}
              onChange={(e) => handleChange('xmasTreeEmbase', e.target.value)}
              placeholder='e.g. 11" 2000'
            />
          </div>
          <div className="col-span-2 sm:col-span-3 md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="well_x_reduction">Réduction</label>
            <input
              type="text"
              id="well_x_reduction"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-white"
              value={well.xmasTreeReduction || ''}
              onChange={(e) => handleChange('xmasTreeReduction', e.target.value)}
              placeholder='e.g. 7"1/16 X 2"9/16. 2000'
            />
          </div>
        </div>
      </div>

      {/* VANNES / VALVES FORM SECTION */}
      <div className="bg-slate-50/70 rounded-xl border border-slate-200/70 p-3 sm:p-4 space-y-3" id="vannes_specification_container">
        <span className="text-xs font-bold text-slate-700 block">
          Vannes de Tête d'Éruption (Valves Specifications)
        </span>
        <div className="space-y-3">
          {[
            { label: "SAS", marque: well.vannesSasMarque, nombre: well.vannesSasNombre, serie: well.vannesSasSerie, kMarque: 'vannesSasMarque', kNombre: 'vannesSasNombre', kSerie: 'vannesSasSerie' },
            { label: "Maitresse", marque: well.vannesMaitresseMarque, nombre: well.vannesMaitresseNombre, serie: well.vannesMaitresseSerie, kMarque: 'vannesMaitresseMarque', kNombre: 'vannesMaitresseNombre', kSerie: 'vannesMaitresseSerie' },
            { label: "LAT-TBG", marque: well.vannesLatTbgMarque, nombre: well.vannesLatTbgNombre, serie: well.vannesLatTbgSerie, kMarque: 'vannesLatTbgMarque', kNombre: 'vannesLatTbgNombre', kSerie: 'vannesLatTbgSerie' },
            { label: "LAT-CSG.", marque: well.vannesLatCsgMarque, nombre: well.vannesLatCsgNombre, serie: well.vannesLatCsgSerie, kMarque: 'vannesLatCsgMarque', kNombre: 'vannesLatCsgNombre', kSerie: 'vannesLatCsgSerie' },
          ].map((v) => (
            <div key={v.label} className="flex flex-col sm:grid sm:grid-cols-4 gap-1.5 sm:gap-2 sm:items-center bg-white sm:bg-transparent p-2.5 sm:p-0 rounded-lg border sm:border-0 border-slate-200/70 shadow-2xs sm:shadow-none">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide shrink-0">{v.label}</span>
              <div className="grid grid-cols-3 sm:col-span-3 gap-1.5 sm:gap-2">
                <input
                  type="text"
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium placeholder:text-slate-400"
                  placeholder="Marque"
                  value={v.marque || ''}
                  onChange={(e) => handleChange(v.kMarque as keyof WellData, e.target.value)}
                  title={`${v.label} Marque`}
                />
                <input
                  type="text"
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium placeholder:text-slate-400"
                  placeholder="Nombre"
                  value={v.nombre || ''}
                  onChange={(e) => handleChange(v.kNombre as keyof WellData, e.target.value)}
                  title={`${v.label} Nombre`}
                />
                <input
                  type="text"
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium placeholder:text-slate-400"
                  placeholder="Ø et Série"
                  value={v.serie || ''}
                  onChange={(e) => handleChange(v.kSerie as keyof WellData, e.target.value)}
                  title={`${v.label} Ø et Série`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ELEVATIONS AND REFERENCE POINTS */}
      <div className="bg-slate-50/70 rounded-xl border border-slate-200/70 p-3 sm:p-4 space-y-3" id="elevations_container">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
          Elevations & Depth Origins (m)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="elev_sol">Z Sol (GL)</label>
            <input
              type="number"
              step="0.01"
              id="elev_sol"
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              value={well.elevationSol}
              onChange={(e) => handleChange('elevationSol', parseFloat(e.target.value) || 0)}
              placeholder="e.g. 523.52"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="elev_forage">Z Forage (KB)</label>
            <input
              type="number"
              step="0.01"
              id="elev_forage"
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              value={well.elevationForage}
              onChange={(e) => handleChange('elevationForage', parseFloat(e.target.value) || 0)}
              placeholder="e.g. 527.08"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="elev_prod">Z Production</label>
            <input
              type="number"
              step="0.01"
              id="elev_prod"
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              value={well.elevationProduction}
              onChange={(e) => handleChange('elevationProduction', parseFloat(e.target.value) || 0)}
              placeholder="e.g. 522.82"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-0.5" htmlFor="origine_cotes">Origine cotes</label>
            <input
              type="text"
              id="origine_cotes"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white font-medium"
              value={well.origineCotes || ''}
              onChange={(e) => handleChange('origineCotes', e.target.value)}
              placeholder="e.g. KB"
            />
          </div>
        </div>
      </div>

      {/* GENERAL OBSERVATIONS */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="well_obs">General Notes / Observations</label>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm max-w-full">
          <RichTextEditor 
            value={well.observations || ''}
            onChange={(value) => handleChange('observations', value)}
          />
        </div>
      </div>

      {/* Signatures & Revisions Block */}
      <div className="pt-2 mt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">Official Validations</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Annule le folio N°</label>
            <input
              type="text"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-slate-100 text-slate-500 cursor-not-allowed"
              value={well.folioToCancel || '00'}
              disabled
              placeholder="e.g. 01"
              title="Automatically tracks previous folio on update"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Mis à jour le</label>
            <input
              type="date"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-slate-50"
              value={well.updatedDate || ''}
              onChange={(e) => handleChange('updatedDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Fin opération le</label>
            <input
              type="date"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-slate-50"
              value={well.endOperationDate || ''}
              onChange={(e) => handleChange('endOperationDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Vu par</label>
            <input
              type="text"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium bg-slate-50 uppercase"
              value={well.vuBy || ''}
              onChange={(e) => handleChange('vuBy', e.target.value)}
              placeholder="Nom"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
