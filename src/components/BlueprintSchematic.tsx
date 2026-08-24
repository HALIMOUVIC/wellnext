import React from 'react';
import { WellData, CasingString, TubingComponent, PerforationZone, parseSizeToNumber } from '../types';

interface BlueprintSchematicProps {
  well: WellData;
  svgWidth: number;
  svgHeight: number;
  mapDepthToY: (depth: number) => number;
  xCenter: number;
}

export default function BlueprintSchematic({ well, svgWidth, svgHeight, mapDepthToY, xCenter }: BlueprintSchematicProps) {
  const sortedCasings = [...well.casings].sort((a, b) => parseSizeToNumber(b.casingSize) - parseSizeToNumber(a.casingSize));
  const surfaceCsg = sortedCasings.find(c => (c.name || '').toLowerCase().includes('surface') || parseSizeToNumber(c.casingSize) > 9);
  const prodCsg = sortedCasings.find(c => (c.name || '').toLowerCase().includes('production') || (parseSizeToNumber(c.casingSize) > 5 && parseSizeToNumber(c.casingSize) < 8));
  
  const topmostPerf = React.useMemo(() => {
    if (!well.perforations || well.perforations.length === 0) return null;
    return well.perforations.reduce((min, p) => ((p.topDepth || 0) < (min.topDepth || 0) ? p : min), well.perforations[0]);
  }, [well.perforations]);
  
  const parsedTbgInfo = (() => {
    const primaryTbg = well.tubings.find(t => t.type === 'Tubing' && t.length > 100) || well.tubings.find(t => t.type === 'Tubing');
    if (!primaryTbg) return null;
    
    let od = primaryTbg.od || '';
    let grade = '';
    let weight = '';
    
    const obs = primaryTbg.observations || '';
    const parts = obs.split('-').map(p => p.trim());
    
    if (parts.length > 0 && parts[0]) {
      if (parts[0].match(/^[A-Z]\d+$/i) || parts[0].includes('J55') || parts[0].includes('N80') || parts[0].includes('L80') || parts[0].includes('P110')) {
        grade = parts[0];
      }
    }
    
    if (parts.length > 1 && parts[1]) {
      const wtMatch = parts[1].match(/[\d\.]+/);
      if (wtMatch) {
        weight = wtMatch[0];
      }
    }
    
    if (!grade) {
      const gMatch = obs.match(/(J55|N80|L80|P110|C90|K55|H40)/i);
      if (gMatch) grade = gMatch[0].toUpperCase();
    }
    if (!weight) {
      const wMatch = obs.match(/([\d\.]+)\s*(#|lbs)/i);
      if (wMatch) weight = wMatch[1];
    }
    
    return { od, grade, weight };
  })();

  return (
    <svg
      id="print_card_vector_schematic"
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="font-mono"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <pattern id="slurry-diagonal" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#cbd5e1" />
          <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" strokeWidth="1.8" />
        </pattern>
        <pattern id="sand-gravel" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.7" fill="#000000" opacity="0.6" />
          <circle cx="6" cy="6" r="0.7" fill="#000000" opacity="0.4" />
          <line x1="1" y1="5" x2="3" y2="7" stroke="#000" strokeWidth="0.4" opacity="0.3" />
        </pattern>
        <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4">
          <circle cx="5" cy="5" r="3" fill="#000000" />
        </marker>
        <marker id="arrow-left" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 5 L 10 1.5 L 10 8.5 z" fill="#000" />
        </marker>
        <marker id="arrow-right" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#000" />
        </marker>
      </defs>

      {/* CENTERLINE */}
      <line x1={xCenter} y1={25} x2={xCenter} y2={svgHeight - 40} stroke="#111" strokeWidth="0.8" strokeDasharray="6,3,1,3" />

      {/* DYNAMIC FORMATION GEOLOGICAL BACKGROUND FOR EACH RESERVOIR */}
      {well.perforations && well.perforations.length > 0 && (() => {
        const groups: { [key: string]: typeof well.perforations } = {};
        well.perforations.forEach(p => {
          const res = (p.reservoir || well.reservoir || 'F6').trim();
          const key = res.toUpperCase();
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(p);
        });

        const deepestCsg = well.casings && well.casings.length > 0
          ? well.casings.reduce((max, c) => ((c.shoeDepth || 0) > (max.shoeDepth || 0) ? c : max), well.casings[0])
          : null;
        const yCasingShoe = deepestCsg ? mapDepthToY(deepestCsg.shoeDepth || 0) : null;

        return Object.entries(groups).map(([resName, perfs]) => {
          const minTopDepth = Math.min(...perfs.map(p => p.topDepth || 0));
          const maxBottomDepth = Math.max(...perfs.map(p => p.bottomDepth || 0));
          const yTop = mapDepthToY(minTopDepth);
          const yBot = mapDepthToY(maxBottomDepth);

          let yBotDotted = yBot + 35;
          if (yCasingShoe !== null && yBotDotted >= yCasingShoe - 5) {
            yBotDotted = yCasingShoe - 5;
          }
          const rectHeight = yBotDotted - (yTop - 15);

          return (
            <g key={`sand-hatch-${resName}`}>
              <rect x={15} y={yTop - 15} width={svgWidth - 30} height={rectHeight} fill="url(#sand-gravel)" opacity="0.12" />
              <line x1={15} y1={yTop - 15} x2={svgWidth - 15} y2={yTop - 15} stroke="#000" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
              <line x1={15} y1={yBotDotted} x2={svgWidth - 15} y2={yBotDotted} stroke="#000" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
            </g>
          );
        });
      })()}

      {/* Render casings and tubing here, copied from WellboreA4Print... This is a lot of code. */}
    </svg>
  );
}
