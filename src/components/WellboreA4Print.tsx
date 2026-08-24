import React, { useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import packageJson from '../../package.json';
import { WellData, CasingString, TubingComponent, PerforationZone, CementPlug } from '../types';
import {
  parseSizeToNumber,
  formatDepth,
  formatCasingSize,
  computeSchematicFull,
  activeCasingRadius,
  mapDepthToYRaw as mapDepthToYRawCore,
  mapDepthToY as mapDepthToYCore,
  getFrenchDesignation,
  getFrenchType,
  calculateCoteProducts,
  resolveTubingConfig,
  getImageSourceHeight,
  parseViewBoxSize,
} from '../lib/wellboreEngine';
import { Printer, X, Download, FileText, ExternalLink, Ruler, ZoomIn, Maximize2 } from 'lucide-react';

interface WellboreA4PrintProps {
  well: WellData;
  onClose: () => void;
  hideSchematic?: boolean;
}

export default function WellboreA4Print({ well: wellProp, onClose, hideSchematic }: WellboreA4PrintProps) {
  // Defensive: if snapshot arrives as a JSON string (double-encoded), parse it
  const well: WellData = typeof wellProp === 'string' ? JSON.parse(wellProp as unknown as string) : wellProp;
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [scaleMode, setScaleMode] = useState<'compact' | 'linear'>(() => {
    try {
      const mode = new URLSearchParams(window.location.search).get("scaleMode");
      return (mode === 'linear' || mode === 'compact') ? mode : 'compact';
    } catch {
      return 'compact';
    }
  });

  const [zoomMode, setZoomMode] = useState<'fit' | '100%'>('fit');
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1024;
  });

  useEffect(() => {
    const updateDimensions = () => {
      setViewportWidth(window.innerWidth);
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const isSmallScreen = viewportWidth < 860;
  // Calculate exact scale factor so the 820px sheet fits on mobile displays (320px - 820px)
  const autoFitScale = Math.min(1, Math.max(0.32, (viewportWidth - (viewportWidth < 640 ? 20 : 48)) / 820));
  const effectiveScale = zoomMode === 'fit' && isSmallScreen ? autoFitScale : 1;

  const perfsForRes = well.perforations || [];
  const reservoirNames = Array.from(new Set(perfsForRes.map(p => p.reservoir || well.reservoir || 'Général').filter(Boolean)));

  const [selectedPerfRes, setSelectedPerfRes] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    reservoirNames.forEach(res => {
      map[res] = true;
    });
    return map;
  });

  const [showReservoirInPerfHeader, setShowReservoirInPerfHeader] = useState(false);
  const [showCementPlugsTable, setShowCementPlugsTable] = useState(true);
  const [showBridgePlugsTable, setShowBridgePlugsTable] = useState(true);

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const isEmbedded = (() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  })();

  const newTabUrl = (() => {
    try {
      return window.location.origin + window.location.pathname + `?print=true&scaleMode=${scaleMode}`;
    } catch {
      return `?print=true&scaleMode=${scaleMode}`;
    }
  })();

  // Helper to get pressure input or empty if none
  const getPressureDisplay = (pressure: string | undefined): string => {
    return pressure || '';
  };

  // Helper to get brand input or empty if none
  const getBrandDisplay = (brand: string | undefined): string => {
    return brand || '';
  };

  // Map depths to standard vertical Y coordinate in blueprint drawing
  const svgWidth = 350;
  const svgHeight = 940;
  const xCenter = 150;

  const { schematic, layout } = React.useMemo(
    () => computeSchematicFull(well, 'print', scaleMode),
    [well, scaleMode]
  );
  const { maxDepth, keyAnchors, computedTools } = schematic;
  const { tbgBottomDepth, tbgVisualYBottom, tubingSegments } = layout;
  const globalYTF = layout.casings.reduce<number | null>((minY, cd) => {
    if (cd.hasTF && cd.tfVal !== null && cd.yTF !== null) {
      return minY === null ? cd.yTF : Math.min(minY, cd.yTF);
    }
    return minY;
  }, null);

  const primaryShoeY: number | null = React.useMemo(() => {
    const shoeTools = computedTools.filter(
      (t) =>
        t.effectiveType.toLowerCase().includes('shoe') ||
        t.effectiveType.toLowerCase().includes('sabot') ||
        (t.name || '').toLowerCase().includes('shoe') ||
        (t.name || '').toLowerCase().includes('sabot')
    );
    if (shoeTools.length === 0) return null;
    return shoeTools.reduce((min, t) => (t.visualYTop < min ? t.visualYTop : min), shoeTools[0].visualYTop);
  }, [computedTools]);

  const maxTubingY: number | null = globalYTF !== null
    ? (primaryShoeY !== null ? Math.min(globalYTF, primaryShoeY) : globalYTF)
    : primaryShoeY;

  const completionBackbones = React.useMemo(() => {
    const isTubingLike = (t: string) => t === 'Tubing' || t === 'Tubing Court';
    const completion = computedTools
      .filter((t) => !isTubingLike(t.effectiveType))
      .filter((t) => primaryShoeY === null || (t.visualYTop ?? 0) <= primaryShoeY)
      .sort((a, b) => (a.bottomDepth || 0) - (b.bottomDepth || 0));
    const ranges: { yStart: number; yEnd: number }[] = [];
    let groupStart = 0;
    for (let i = 1; i <= completion.length; i++) {
      const breakCluster =
        i === completion.length ||
        (completion[i].bottomDepth || 0) - (completion[groupStart].bottomDepth || 0) >= 150;
      if (breakCluster) {
        const group = completion.slice(groupStart, i);
        if (group.length > 0) {
          const yStart = Math.min(...group.map((t) => t.visualYTop ?? 0));
          const rawYEnd = Math.max(...group.map((t) => t.visualYBottom ?? 0));
          const yEnd = primaryShoeY !== null ? Math.min(rawYEnd, primaryShoeY) : rawYEnd;
          if (yStart < yEnd) ranges.push({ yStart, yEnd });
        }
        groupStart = i;
      }
    }
    return ranges;
  }, [computedTools, primaryShoeY]);

  const renderPrintTubingColumn = (yStart: number, yEnd: number, key: string, tbgR: number) => {
    const segHeight = yEnd - yStart;
    if (segHeight <= 0) return null;
    return (
      <g key={key}>
        <rect x={xCenter - tbgR} y={yStart} width={tbgR * 2} height={segHeight} fill="#ffffff" />
        <rect x={xCenter - tbgR} y={yStart} width={tbgR * 2} height={segHeight} fill="url(#tubing-pattern-print)" />
        <line x1={xCenter - tbgR} y1={yStart} x2={xCenter - tbgR} y2={yEnd} stroke="#000" strokeWidth="1.5" />
        <line x1={xCenter + tbgR} y1={yStart} x2={xCenter + tbgR} y2={yEnd} stroke="#000" strokeWidth="1.5" />
      </g>
    );
  };

  const mapDepthToYRaw = (depth: number | string): number => {
    return mapDepthToYRawCore(depth, scaleMode, maxDepth, keyAnchors, 50, 915);
  };

  // Calculate Cote Product for tubing table
  const tubingsForTable = calculateCoteProducts(well.tubings || [], well.spoolProd);

  const topmostPerf = React.useMemo(() => {
    if (!well.perforations || well.perforations.length === 0) return null;
    return well.perforations.reduce((min, p) => ((p.topDepth || 0) < (min.topDepth || 0) ? p : min), well.perforations[0]);
  }, [well.perforations]);

  const mapDepthToY = (depth: number | string): number => {
    return mapDepthToYCore(
      depth,
      scaleMode,
      maxDepth,
      keyAnchors,
      50,
      915,
      tbgBottomDepth,
      tbgVisualYBottom,
      svgHeight
    );
  };

  const printCasingsData = (layout?.casings || []).map((cd) => {
    const casing = (well.casings || [])[cd.casingIndex];
    return { casing, i: cd.casingIndex, csgR: cd.casingR, holeR: cd.boreholeR, yTop: cd.yTop, yShoe: cd.yShoe, yDrilled: cd.yDrilled, yTOC: cd.yToc, hasCement: cd.hasCement, tocVal: cd.tocVal, hasLiner: cd.hasLiner, tolVal: cd.tolVal, yTOL: cd.yTol, hasTF: cd.hasTF, tfVal: cd.tfVal, yTF: cd.yTF };
  });

  const sortedCasings = (layout?.sortedCasingIndices || []).map((i) => (well.casings || [])[i]).filter(Boolean);
  const surfaceCsg = sortedCasings.find(c => (c?.name || '').toLowerCase().includes('surface') || parseSizeToNumber(c?.casingSize) > 9);
  const prodCsg = sortedCasings.find(c => (c?.name || '').toLowerCase().includes('production') || (parseSizeToNumber(c?.casingSize) > 5 && parseSizeToNumber(c?.casingSize) < 8));

  // Observations fallbacks
  const observationText = well.observations || '';

  // Find primary production tubing component dynamically
  const primaryTbg = (well.tubings || []).find(t => t.type === 'Tubing' && t.length > 100) || (well.tubings || []).find(t => t.type === 'Tubing');
  const parsedTbgInfo = (() => {
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

  // Overlapping Right-Side Labels Resolution Logic
  interface ResolutionLabel {
    id: string;
    targetY: number;
    anchorY?: number;
    height: number;
    startX: number;
    markerStart: string;
    isSpecial?: boolean;
    isDotted?: boolean;
    lineXEnd?: number;
    renderText: (y: number) => React.JSX.Element;
  }

  const resolvedLabels = (() => {
    // Dynamic braced CSG labels for ALL casing strings added to the well
    const bracedCsgLabelList: ResolutionLabel[] = [];
    sortedCasings
      .filter(c => parseSizeToNumber(c.casingSize) > 0)
      .forEach((csg, index) => {
        let csgR = parseSizeToNumber(csg.casingSize) * 4.5;
        if (printCasingsData && printCasingsData.length > 0) {
          const matched = printCasingsData.find(d => d.casing.id === csg.id || d.casing.casingSize === csg.casingSize);
          if (matched) csgR = matched.csgR;
        }

        const isLiner = csg.startFromTOL || (csg.topOfLiner != null && csg.topOfLiner > 0);
        const topD = isLiner ? Number(csg.topOfLiner) : (csg.topDepth || 0);
        const shoeD = csg.shoeDepth || 0;
        const labelDepth = isLiner ? Math.min(topD + 25, (topD + shoeD) / 2) : (topD + shoeD) / 2;
        const targetY = mapDepthToY(labelDepth);

        const minTextX = Math.max(212, (xCenter + (csgR > 0 ? csgR : 15)) + 22);
        const bracketX = minTextX + 26;
        const detailsX = minTextX + 42;
        const csgLineXEnd = minTextX - 2;

        bracedCsgLabelList.push({
          id: `csg-label-braced-${index}`,
          targetY: isNaN(targetY) ? (100 + index * 100) : targetY,
          anchorY: isNaN(targetY) ? (100 + index * 100) : targetY,
          height: 42,
          startX: xCenter + (csgR > 0 ? csgR + 2 : 15),
          markerStart: 'none',
          isSpecial: true,
          isDotted: true,
          lineXEnd: csgLineXEnd,
          renderText: (y: number) => (
            <g key={`csg-label-braced-${index}`}>
              <text x={minTextX} y={y + 4} fontSize="12" fontWeight="bold" className="font-sans">CSG</text>
              <text x={bracketX} y={y + 12} fontSize="28" fontWeight="light" fill="#000">{"{"}</text>
              <g transform={`translate(${detailsX}, ${y - 14})`} fontSize="11" fontWeight="bold" className="font-sans" fill="#000">
                <text x={0} y={10}>Ø : {formatCasingSize(csg.casingSize)}</text>
                <text x={0} y={22}>Gr. : {csg.grade || '-'}</text>
                <text x={0} y={34}>Lbs. : {csg.weight ? `${csg.weight}` : '-'}</text>
              </g>
            </g>
          )
        });
      });

    // Dynamic braced TBG label
    const tbgLabelList: ResolutionLabel[] = [];
    const sevenInchCsg = sortedCasings.find(c => parseSizeToNumber(c.casingSize) === 7);
    const hasTbgParams = well.prodTbgParams && (well.prodTbgParams.od || well.prodTbgParams.grade || well.prodTbgParams.weight);
    
    const displayOd = hasTbgParams ? well.prodTbgParams?.od : (sevenInchCsg ? formatCasingSize(sevenInchCsg.casingSize) : '');
    const displayGrade = hasTbgParams ? well.prodTbgParams?.grade : (sevenInchCsg ? sevenInchCsg.grade : '');
    const displayWeight = hasTbgParams ? well.prodTbgParams?.weight : (sevenInchCsg ? sevenInchCsg.weight : '');

    if (well.prodTbgParams || sevenInchCsg) {
      const tbgR = 5;
      tbgLabelList.push({
        id: 'blueprint-tbg-brace',
        targetY: 135,
        height: 42,
        startX: xCenter + tbgR,
        markerStart: 'url(#arrow-left)',
        isSpecial: true,
        lineXEnd: 210,
        renderText: (y: number) => (
          <g key="blueprint-tbg-brace-text">
            <text x={212} y={y + 4} fontSize="12" fontWeight="bold" className="font-sans">TBG</text>
            <text x={238} y={y + 12} fontSize="28" fontWeight="light" fill="#000">{"{"}</text>
            <g transform={`translate(254, ${y - 14})`} fontSize="11" fontWeight="bold" className="font-sans" fill="#000">
              <text x={0} y={10}>Ø : {displayOd || '-'}</text>
              <text x={0} y={22}>Gr. : {displayGrade || '-'}</text>
              <text x={0} y={34}>Lbs. : {displayWeight || '-'}</text>
            </g>
          </g>
        )
      });
    }

    const toolLabels: ResolutionLabel[] = computedTools
      .filter((tool) => globalYTF === null || (tool.visualYTop ?? 0) < globalYTF)
      .map((tool) => {
      const yBottom = tool.visualYBottom;
      const yTop = tool.visualYTop;
      const height = tool.visualHeight;
      const effectiveType = tool.effectiveType;

      const config = resolveTubingConfig(effectiveType, tool.name);
      if (!config) return null;

      const isMandrin = 
        config.type.toLowerCase().includes('mandrel') || 
        config.type.toLowerCase().includes('mandrin') || 
        effectiveType.toLowerCase().includes('mandrel') || 
        effectiveType.toLowerCase().includes('mandrin') ||
        (tool.name || '').toLowerCase().includes('mandrel') ||
        (tool.name || '').toLowerCase().includes('mandrin') ||
        (tool.type || '').toLowerCase().includes('mandrel') ||
        (tool.type || '').toLowerCase().includes('mandrin');

      const isPacker =
        config.type.toLowerCase().includes('packer') ||
        config.type.toLowerCase().includes('pkr') ||
        effectiveType.toLowerCase().includes('packer') ||
        effectiveType.toLowerCase().includes('pkr') ||
        (tool.name || '').toLowerCase().includes('packer') ||
        (tool.name || '').toLowerCase().includes('pkr') ||
        (tool.type || '').toLowerCase().includes('packer') ||
        (tool.type || '').toLowerCase().includes('pkr');

      const isMoteur =
        config.type.toLowerCase().includes('moteur') ||
        config.type.toLowerCase().includes('motor') ||
        effectiveType.toLowerCase().includes('moteur') ||
        effectiveType.toLowerCase().includes('motor') ||
        (tool.name || '').toLowerCase().includes('moteur') ||
        (tool.name || '').toLowerCase().includes('motor') ||
        (tool.type || '').toLowerCase().includes('moteur') ||
        (tool.type || '').toLowerCase().includes('motor');

      const isPompe =
        config.type.toLowerCase().includes('pompe') ||
        config.type.toLowerCase().includes('pump') ||
        effectiveType.toLowerCase().includes('pompe') ||
        effectiveType.toLowerCase().includes('pump') ||
        (tool.name || '').toLowerCase().includes('pompe') ||
        (tool.name || '').toLowerCase().includes('pump') ||
        (tool.type || '').toLowerCase().includes('pompe') ||
        (tool.type || '').toLowerCase().includes('pump');

      const isSeatingNipple =
        config.type.toLowerCase().includes('nipple') ||
        config.type.toLowerCase().includes('siège') ||
        config.type.toLowerCase().includes('siége') ||
        config.type.toLowerCase().includes('siege') ||
        effectiveType.toLowerCase().includes('nipple') ||
        effectiveType.toLowerCase().includes('siège') ||
        effectiveType.toLowerCase().includes('siége') ||
        effectiveType.toLowerCase().includes('siege') ||
        (tool.name || '').toLowerCase().includes('nipple') ||
        (tool.name || '').toLowerCase().includes('siège') ||
        (tool.name || '').toLowerCase().includes('siége') ||
        (tool.name || '').toLowerCase().includes('siege') ||
        (tool.type || '').toLowerCase().includes('nipple') ||
        (tool.type || '').toLowerCase().includes('siège') ||
        (tool.type || '').toLowerCase().includes('siége') ||
        (tool.type || '').toLowerCase().includes('siege');

      const isShoe =
        config.type.toLowerCase().includes('shoe') ||
        config.type.toLowerCase().includes('sabot') ||
        effectiveType.toLowerCase().includes('shoe') ||
        effectiveType.toLowerCase().includes('sabot') ||
        (tool.name || '').toLowerCase().includes('shoe') ||
        (tool.name || '').toLowerCase().includes('sabot') ||
        (tool.type || '').toLowerCase().includes('shoe') ||
        (tool.type || '').toLowerCase().includes('sabot');

      let anchorY = (yTop + yBottom) / 2;
      let startX = xCenter + 5;
      let markerStart = 'url(#arrow-left)';

      if (isPacker) {
        const drawHeight = Math.max(35, height);
        anchorY = yTop + (277 / 635) * drawHeight;
        const toolDepth = typeof tool.bottomDepth === "string" ? parseFloat(tool.bottomDepth || "0") : (tool.bottomDepth || 0);
        const activeCsgR = activeCasingRadius(well, layout?.casings || [], toolDepth, tool.od);
        startX = xCenter + activeCsgR;
      } else if (isMoteur || isPompe) {
        const drawHeight = Math.max(45, height);
        anchorY = yTop + drawHeight / 2;
        const toolDepth = typeof tool.bottomDepth === "string" ? parseFloat(tool.bottomDepth || "0") : (tool.bottomDepth || 0);
        const activeCsgR = activeCasingRadius(well, layout?.casings || [], toolDepth, tool.od);
        startX = xCenter + (activeCsgR * 0.40);
      } else if (isMandrin) {
        startX = xCenter + 15;
      } else if (isSeatingNipple) {
        anchorY = yTop + height / 2;
        startX = xCenter + 10;
      } else if (isShoe) {
        anchorY = (yTop + yBottom) / 2;
      } else if (config.type === 'Reduction') {
        markerStart = 'url(#dot)';
      }

      // Initial targetY set ABOVE anchorY so leader lines slant UPWARDS to text labels
      const targetY = anchorY - 20;

      // Format texts
      let prefix = config.frenchDesignation;
      if (isSeatingNipple) {
        prefix = '= Siège';
      } else if (isShoe) {
        prefix = '▼ Sabot';
      } else if (config.type === 'Reduction') {
        prefix = 'Réd';
      } else if (config.type === 'Tailpipe') {
        prefix = 'Tube de queue';
      } else if (config.type === 'Anchor-seal') {
        prefix = 'Ancrage';
      } else if (config.type === 'Tubing Court') {
        prefix = 'Joint court';
      } else if (isMandrin) {
        prefix = 'Mandrin';
      } else if (isPacker) {
        prefix = 'Packer';
      } else if (isMoteur) {
        prefix = 'Moteur';
      } else if (isPompe) {
        prefix = 'Pompe';
      }

      // Format Mandrin as a special tool label style (prefix on line 1, depth on line 2)
      const isSpecialLabelStyle = isPacker || isMoteur || isPompe || isSeatingNipple || isShoe || isMandrin;

      return {
        id: `blueprint-${config.type.replace(/\s+/g, '-').toLowerCase()}-${tool.id}`,
        targetY,
        anchorY,
        height: 22,
        startX,
        markerStart,
        isSpecial: isSpecialLabelStyle,
        renderText: (y: number) => {
          if (isSpecialLabelStyle) {
            return (
              <text key={`${tool.id}-lbl`} x={215} y={y + 3.5} textAnchor="start" fontSize="11.5" fontWeight="bold">
                <tspan x={215} dy="0">{prefix} {tool.customType || tool.type}</tspan>
                <tspan x={215} dy="1.2em">{formatDepth(tool.bottomDepth)} m</tspan>
              </text>
            );
          } else {
            return (
              <text key={`${tool.id}-lbl`} x={239} y={y + 3.5} textAnchor="start" fontSize="11.5" fontWeight="bold">
                <tspan x={239} dy="0">{prefix}: {formatDepth(tool.bottomDepth)}m</tspan>
                <tspan x={239} dy="1.2em">Type: {tool.customType || tool.type}</tspan>
              </text>
            );
          }
        }
      };
    }).filter(Boolean) as ResolutionLabel[];

    const allLabels: ResolutionLabel[] = [...tbgLabelList, ...bracedCsgLabelList, ...toolLabels];

    // Add top hanger label if we have tubings
    if ((well.tubings || []).length > 0) {
      allLabels.push({
        id: 'blueprint-top-hanger',
        targetY: 55,
        height: 20,
        startX: xCenter,
        markerStart: 'url(#dot)',
        isSpecial: true,
        renderText: (y: number) => (
          <g key="blueprint-top-hanger-text">
            <text x={225} y={y - 5} textAnchor="start" fontSize="11.5" fontWeight="bold">
              {(() => {
                const val = well.spoolProd || '0.58';
                if (/^[0-9]/.test(val)) {
                  return `+ ${val}`;
                }
                return val;
              })()} Sp.att. tbg
            </text>
          </g>
        )
      });
    }

    const isFixedLabel = (l: ResolutionLabel) => l.id === 'blueprint-top-hanger';

    const adjusted = allLabels.map(l => ({
      ...l,
      y: l.targetY
    }));
    const iterations = 150;
    
    for (let iter = 0; iter < iterations; iter++) {
      // Sort by current Y position to evaluate spatially adjacent items
      adjusted.sort((a, b) => a.y - b.y);

      // Lock fixed labels (only top hanger) to exact Y
      adjusted.forEach(l => {
        if (isFixedLabel(l)) {
          l.y = l.targetY;
        }
      });

      // Backward pass (bottom-to-top): fan tools UPWARDS into open well space
      for (let i = adjusted.length - 1; i > 0; i--) {
        const prev = adjusted[i - 1];
        const current = adjusted[i];

        const extraPadding = (prev.id.includes('csg') || current.id.includes('csg') ||
                              prev.id.includes('perf') || current.id.includes('perf')) ? 12 : 8;
        const requiredDist = (prev.height + current.height) / 2 + extraPadding;
        const actualDist = current.y - prev.y;

        if (actualDist < requiredDist) {
          const overlap = requiredDist - actualDist;
          const prevFixed = isFixedLabel(prev);
          const currentFixed = isFixedLabel(current);

          if (prevFixed && !currentFixed) {
            current.y += overlap;
          } else if (!prevFixed && currentFixed) {
            prev.y -= overlap;
          } else if (!prevFixed && !currentFixed) {
            // Push upper label UPWARDS to fan into open space above
            prev.y -= overlap;
          }
        }
      }

      // Forward pass (top-to-bottom): resolve any remaining top boundary or header collisions
      for (let i = 0; i < adjusted.length - 1; i++) {
        const current = adjusted[i];
        const next = adjusted[i + 1];

        const extraPadding = (current.id.includes('csg') || next.id.includes('csg') ||
                              current.id.includes('perf') || next.id.includes('perf')) ? 12 : 8;
        const requiredDist = (current.height + next.height) / 2 + extraPadding;
        const actualDist = next.y - current.y;

        if (actualDist < requiredDist) {
          const overlap = requiredDist - actualDist;
          const currentFixed = isFixedLabel(current);
          const nextFixed = isFixedLabel(next);

          if (currentFixed && !nextFixed) {
            next.y += overlap;
          } else if (!currentFixed && nextFixed) {
            current.y -= overlap;
          } else if (!currentFixed && !nextFixed) {
            current.y -= overlap * 0.5;
            next.y += overlap * 0.5;
          }
        }
      }

      // Bound labels below top hanger
      adjusted.forEach(l => {
        if (!isFixedLabel(l) && l.y < 55) {
          l.y = 55;
        }
      });
    }
    return adjusted;
  })();

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-50 overflow-y-auto p-2 sm:p-4 md:p-8 flex flex-col items-center print:p-0 print:bg-white select-none" id="a4_print_wrapper">
      
      {/* Dynamic Printing Ruleset */}
      <style>{`
         @media print {
           html, body, #root {
             margin: 0 !important;
             padding: 0 !important;
             width: 100% !important;
             height: 100% !important;
             overflow: hidden !important;
             background-color: white !important;
             color: black !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
           }
           #a4_print_wrapper {
             visibility: visible !important;
             display: block !important;
             position: fixed !important;
             left: 0 !important;
             top: 0 !important;
             width: 100% !important;
             height: 100% !important;
             background: white !important;
             padding: 0 !important;
             margin: 0 !important;
             overflow: hidden !important;
             z-index: 99999999 !important;
           }
           #a4_print_wrapper * {
             visibility: visible !important;
           }
           #print_controls_bar, #print_controls_bar * {
             display: none !important;
             visibility: hidden !important;
           }
           #a4_scale_viewport {
             overflow: visible !important;
             padding: 0 !important;
             margin: 0 !important;
             width: auto !important;
             display: block !important;
           }
           #a4_scale_viewport > div {
             transform: none !important;
             margin-bottom: 0 !important;
           }
           .a4-print-card {
             box-shadow: none !important;
             border: none !important;
             margin: 0 !important;
             width: 820px !important;
             height: 1160px !important;
             min-height: 1160px !important;
             position: absolute !important;
             left: 50% !important;
             top: 15px !important;
             transform: translateX(-50%) scale(0.94) !important;
             transform-origin: top center !important;
             page-break-after: avoid !important;
             page-break-inside: avoid !important;
             background-color: white !important;
           }
           @page {
             size: A4 portrait;
             margin: 0;
           }
         }
      `}</style>

      {/* Floater Header bar */}
      <div 
        className="w-full max-w-[820px] bg-white/95 backdrop-blur-md border border-slate-200/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 flex flex-col print:hidden relative z-10 shadow-lg" 
        id="print_controls_bar"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="bg-gradient-to-b from-slate-100 to-slate-50 border border-slate-200 text-slate-600 p-2 sm:p-2.5 rounded-xl shadow-sm shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm sm:text-[15px] font-extrabold text-slate-800 font-sans tracking-tight">Print & Export Viewer</h2>
                <p className="text-[11px] sm:text-[12px] text-slate-500 font-medium">Fiche Technique A4 — {well.name}</p>
              </div>
            </div>

            {/* Mobile-only Close button */}
            <button
              id="btn_close_print_mobile"
              onClick={onClose}
              className="sm:hidden flex items-center justify-center bg-slate-100 hover:bg-rose-500 hover:text-white border border-slate-200 w-8 h-8 rounded-lg text-slate-600 transition shadow-sm"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Scale Toggle inside Header Bar */}
            <div className="flex items-center bg-slate-100/80 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 shadow-inner">
              <div className="px-2 sm:px-3 hidden xs:flex items-center gap-1.5 text-slate-400 border-r border-slate-200/80 mr-1">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold">Échelle</span>
              </div>
              <button
                onClick={() => setScaleMode("compact")}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-bold rounded-lg transition-all ${
                  scaleMode === "compact"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
                title="Échelle compacte"
              >
                Compacte
              </button>
              <button
                onClick={() => setScaleMode("linear")}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-bold rounded-lg transition-all ${
                  scaleMode === "linear"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
                title="Vraie échelle linéaire"
              >
                Vraie Échelle
              </button>
            </div>

            {/* Responsive Zoom Controls */}
            {isSmallScreen && (
              <div className="flex items-center bg-slate-100/80 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 shadow-inner">
                <button
                  onClick={() => setZoomMode('fit')}
                  className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-bold rounded-lg transition-all ${
                    zoomMode === 'fit'
                      ? "bg-white text-slate-800 shadow-sm border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Ajuster à l'écran mobile"
                >
                  Ajuster
                </button>
                <button
                  onClick={() => setZoomMode('100%')}
                  className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-bold rounded-lg transition-all ${
                    zoomMode === '100%'
                      ? "bg-white text-slate-800 shadow-sm border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Taille réelle 100% (zoom)"
                >
                  100%
                </button>
              </div>
            )}

            <div className="hidden sm:block w-px h-7 bg-slate-200"></div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                id="btn_print_trigger"
                onClick={handlePrint}
                className="flex items-center gap-1.5 sm:gap-2 bg-orange-500 hover:bg-orange-600 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-white font-sans font-bold text-xs transition shadow-sm shrink-0"
                title="Imprimer le document A4"
              >
                <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Imprimer</span>
              </button>

              {isEmbedded && (
                <a
                  href={newTabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-bold text-xs px-3 py-2.5 rounded-xl transition border border-slate-200 shrink-0"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Nouvel Onglet</span>
                </a>
              )}

              <button
                id="btn_close_print"
                onClick={onClose}
                className="hidden sm:flex items-center justify-center bg-white border border-slate-200 hover:bg-orange-500 hover:border-orange-500 w-10 h-10 rounded-xl text-slate-400 hover:text-white transition shadow-sm shrink-0"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Options :</span>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 text-xs">
              <input
                type="checkbox"
                checked={showCementPlugsTable}
                onChange={(e) => setShowCementPlugsTable(e.target.checked)}
                className="rounded text-orange-600 focus:ring-orange-500 w-3.5 h-3.5"
              />
              Bouchon(s) (B.C)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 text-xs">
              <input
                type="checkbox"
                checked={showBridgePlugsTable}
                onChange={(e) => setShowBridgePlugsTable(e.target.checked)}
                className="rounded text-orange-600 focus:ring-orange-500 w-3.5 h-3.5"
              />
              Barrière Fond (B.P)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 text-xs">
              <input
                type="checkbox"
                checked={showReservoirInPerfHeader}
                onChange={(e) => setShowReservoirInPerfHeader(e.target.checked)}
                className="rounded text-orange-600 focus:ring-orange-500 w-3.5 h-3.5"
              />
              En-tête « — RÉS. »
            </label>
          </div>
          {reservoirNames.length > 1 && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Réservoirs :</span>
              {reservoirNames.map(res => (
                <label key={res} className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedPerfRes[res] ?? true}
                    onChange={(e) => setSelectedPerfRes(prev => ({ ...prev, [res]: e.target.checked }))}
                    className="rounded text-orange-600 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  {res}
                </label>
              ))}
            </div>
          )}
        </div>

        {isEmbedded && (
          <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-2.5 sm:p-3 mt-2.5 flex items-start gap-2.5 shadow-sm">
            <div className="bg-amber-100 p-1.5 rounded-lg shrink-0 mt-0.5 text-amber-600">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs sm:text-sm font-bold text-amber-900">Aperçu Navigateur</span>
              <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed font-medium">
                Pour une impression optimale en pleine page, ouvrez le document dans un <strong>Nouvel Onglet</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* A4 PAPER CONTAINER & RESPONSIVE SCALING VIEWPORT */}
      <div 
        className="w-full flex flex-col items-center overflow-x-auto pb-10 print:overflow-visible print:pb-0"
        id="a4_scale_viewport"
      >
        <div
          style={{
            width: 820,
            minWidth: 820,
            height: 1164,
            minHeight: 1164,
            transform: effectiveScale < 1 ? `scale(${effectiveScale})` : undefined,
            transformOrigin: 'top center',
            marginBottom: effectiveScale < 1 ? `-${Math.round(1164 * (1 - effectiveScale))}px` : 0,
            transition: 'transform 0.2s ease-out',
          }}
          className="print:!transform-none print:!m-0 print:!w-[820px] print:!min-w-[820px]"
        >
          {/* A4 PAPER FRAME: Exact aspect ratio matching 210mm x 297mm */}
          <div 
            ref={printAreaRef}
            className="a4-print-card w-[820px] h-[1164px] min-h-[1164px] bg-white border border-black text-black p-4 relative flex flex-col font-sans shrink-0 print:border-none print:shadow-none shadow-2xl rounded-xs"
            id="a4_print_card_element"
          >
            {/* VINTAGE CAD BLUEPRINT BORDER INSETS */}
            <div className="absolute inset-2.5 border border-black pointer-events-none" />
            <div className="absolute inset-3 border-2 border-black pointer-events-none" />

            {/* INNER CONTAINER LAYOUT */}
            <div className="w-full h-full flex flex-col p-2 relative z-10">
          
          {/* I. CARTOUCHE / TECHNICAL CARD HEADER (TOP 2 ROWS) */}
          <div className="w-full border border-black text-[12px] grid grid-cols-12 shrink-0 mb-2 leading-tight" id="cartouche_header_rows">
            {/* Row 1 */}
            <div className="col-span-4 border-r border-b border-black p-1 font-mono font-bold flex justify-start items-baseline gap-1.5">
              <span>Folio N°</span>
              <span className="text-xs font-black">{well.folio || '02'}</span>
            </div>
            <div className="col-span-8 border-b border-black p-1 text-center font-extrabold text-base tracking-[0.25em] font-sans">
              EQUIPEMENT DE PUITS
            </div>

            {/* Row 2 */}
            <div className="col-span-4 border-r border-black p-1.5 flex flex-col justify-center bg-white">
              <span className="text-[11px] font-bold text-black font-mono">WELL/PUITS</span>
              <span className="text-xl font-black text-black font-sans leading-none tracking-tight">{well.name}</span>
            </div>
            <div className="col-span-3 border-r border-black p-1 flex flex-col justify-between items-center text-center">
              <span className="text-[9.5px] font-bold text-black font-mono block self-start">TYPE DE PUITS</span>
              {(() => {
                const p = (well.purpose || 'PPH').trim().toUpperCase();
                let title = "PUITS PRODUCTEUR HUILE";
                let code = "(PPH)";

                if (p === 'PIE' || p.includes('PIE') || p.includes('INJECTEUR')) {
                  title = "PUITS INJECTEUR D’EAU";
                  code = "(PIE)";
                } else if (p === 'PPE') {
                  title = "PUITS INJECTEUR D’EAU";
                  code = "(PPE)";
                } else if (p === 'PPG') {
                  title = "PUITS PRODUCTEUR GAZ";
                  code = "(PPG)";
                } else if (p === 'PPH (SRP)') {
                  title = "PUITS PRODUCTEUR HUILE (SRP)";
                  code = "(PPH)";
                } else if (p === 'ESP') {
                  title = "PUITS PRODUCTEUR HUILE (ESP)";
                  code = "(ESP)";
                } else if (p === 'PPH') {
                  title = "PUITS PRODUCTEUR HUILE";
                  code = "(PPH)";
                } else {
                  title = `PUITS PRODUCTEUR HUILE`;
                  code = `(${p})`;
                }

                return (
                  <div className="font-bold text-[11px] text-black uppercase leading-tight">
                    <div>{title}</div>
                    <div className="text-black font-extrabold text-[10px] mt-0.5">{code}</div>
                  </div>
                );
              })()}
            </div>
            <div className="col-span-3 border-r border-black p-1 flex flex-col justify-center items-center text-center">
              {well.isAbandonProvisoire ? (
                <>
                  <span className="font-extrabold text-[12px] text-black uppercase leading-tight tracking-wide">ABANDON PROVISOIRE</span>
                  <span className="font-bold text-[11px] text-black">(KILL STRING)</span>
                </>
              ) : (
                <>
                  <span className="text-[9.5px] font-bold text-black font-mono block self-start">COMPLETION DESIGN</span>
                  <span className="font-bold text-[11.5px] text-black uppercase">{well.completionType || 'COMPLETION SIMPLE'}</span>
                </>
              )}
            </div>
            <div className="col-span-2 p-1 flex flex-col justify-between items-center text-center">
              <span className="text-[9.5px] font-bold text-black font-mono block self-start">RESERVOIR :</span>
              <span className="font-bold text-[12px] text-black font-mono uppercase">{well.reservoir || 'F6'}</span>
            </div>
          </div>

          {/* II. MAIN SPLIT BODY (Left Column for Tables, Right Column for Drawing) */}
          <div className={`flex-1 w-full grid ${hideSchematic ? 'grid-cols-1' : 'grid-cols-[65fr_35fr]'} gap-x-2.5 min-h-0`}>
            
            {/* COLUMN 1: LEFT SIDE - ENGINEERING & HEADERS TABLES */}
            <div className="flex flex-col min-h-0 h-full justify-start gap-y-1.5">
              
              {/* BOX 1: TETE D'ERUPTION AND VANNES TABLE */}
              <div className="border border-black border-solid flex flex-col shrink-0 bg-white" id="print_tete_deruption_and_vannes">
                <div className="border-b border-black border-solid bg-gray-200 py-1 text-center font-sans font-black text-[10px] uppercase tracking-[0.2em] text-black">
                  TETE D'ERUPTION
                </div>
                
                {/* SINGLE UNIFIED TABLE FOR TETE D'ERUPTION METADATA & VANNES TO ENSURE PERFECT VERTICAL ALIGNMENT */}
                <table className="w-full table-fixed border-collapse text-center font-mono">
                  <colgroup>
                    <col className="w-[15%]" />
                    <col className="w-[17%]" />
                    <col className="w-[17%]" />
                    <col className="w-[17%]" />
                    <col className="w-[17%]" />
                    <col className="w-[17%]" />
                  </colgroup>
                  <tbody>
                    {/* Row 1: TETE D'ERUPTION Metadata Row 1 */}
                    <tr className="text-[9.5px] leading-tight text-left">
                      <td colSpan={2} className="border-r border-b border-black p-1 whitespace-nowrap">
                        <span className="text-black text-[8px] font-bold">Marque :</span>
                        <span className="font-bold text-[9px] text-black ml-1">{getBrandDisplay(well.xmasTreeBrand)}</span>
                      </td>
                      <td className="border-r border-b border-black p-1 whitespace-nowrap">
                        <span className="text-black text-[8px] font-bold">Type :</span>
                        <span className="font-bold text-[9px] text-black ml-1">{well.xmasTreeType || ''}</span>
                      </td>
                      <td colSpan={2} className="border-r border-b border-black p-1 whitespace-nowrap">
                        <span className="text-black text-[8px] font-bold">Ract. Sup. :</span>
                        <span className="font-bold text-[9px] text-black ml-1">{well.xmasTreeRactSup || ''}</span>
                      </td>
                      <td className="border-b border-black p-1 text-center align-middle bg-white font-sans font-black text-[8.5px] uppercase tracking-wider">
                        <span className="text-black font-black">SUSP : </span>
                        <span className="ml-1">{well.suspTbg || 'S./TBG'}</span>
                      </td>
                    </tr>

                    {/* Row 2: TETE D'ERUPTION Metadata Row 2 */}
                    <tr className="text-[9.5px] leading-tight text-left">
                      <td colSpan={2} className="border-r border-b border-black p-1 whitespace-nowrap">
                        <span className="text-black text-[8px] font-bold">Pression :</span>
                        <span className="font-bold text-[9px] text-black ml-1">{getPressureDisplay(well.xmasTreePressure)}</span>
                      </td>
                      <td colSpan={3} className="border-r border-b border-black p-1 whitespace-nowrap">
                        <span className="text-black text-[8px] font-bold">Attache Tbg :</span>
                        <span className="font-bold text-[9px] text-black ml-1">{well.xmasTreeAttacheTbg || ''}</span>
                      </td>
                      <td rowSpan={2} className="border-b border-black p-1 text-left pl-2 align-middle bg-white">
                        <div className="text-left pl-1">
                          <span className="font-mono text-[8px] font-bold text-black block mb-1">Olive :</span>
                          <span className="font-mono text-[8px] font-bold text-black block leading-tight whitespace-pre-line">
                            {well.xmasTreeOlive || ''}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Row 3: TETE D'ERUPTION Metadata Row 3 */}
                    <tr className="text-[9.5px] leading-tight text-left">
                      <td colSpan={2} className="border-r border-b border-black p-1 whitespace-nowrap">
                        <span className="text-black text-[8px] font-bold">Embase :</span>
                        <span className="font-bold text-[9px] text-black ml-1">{well.xmasTreeEmbase || ''}</span>
                      </td>
                      <td colSpan={3} className="border-r border-b border-black p-1 whitespace-nowrap">
                        <span className="text-black text-[8px] font-bold">Réduction :</span>
                        <span className="font-bold text-[8.5px] text-black ml-1 truncate">{well.xmasTreeReduction || ''}</span>
                      </td>
                    </tr>

                    {/* Row 4: VANNES Headers */}
                    <tr className="text-[9px] font-black uppercase bg-white">
                      <td className="border-r border-b border-black p-1 font-sans text-[9px] text-left font-normal bg-gray-200">VANNES</td>
                      <td className="border-r border-b border-black p-1 text-center bg-gray-200">SAS</td>
                      <td className="border-r border-b border-black p-1 text-center bg-gray-200">Maitresse</td>
                      <td className="border-r border-b border-black p-1 text-center bg-gray-200">LAT-TBG</td>
                      <td className="border-r border-b border-black p-1 text-center bg-gray-200">LAT-CSG.</td>
                      <td className="border-l border-b border-black bg-white text-center font-sans font-bold text-[7.5px] text-black px-0.5 py-1 select-none leading-none align-middle">
                        ETAN. S/ TBG - PKR de tête
                      </td>
                    </tr>

                    {/* Row 5: Vannes Marque */}
                    <tr className="text-[9px] font-bold h-[20px]">
                      <td className="border-r border-b border-black p-0.5 font-sans text-left text-[8.5px] uppercase text-black font-normal bg-gray-200">MARQUE</td>
                      <td className="border-r border-b border-black p-0.5 text-black text-center">{well.vannesSasMarque || ''}</td>
                      <td className="border-r border-b border-black p-0.5 text-black text-center">{well.vannesMaitresseMarque || ''}</td>
                      <td className="border-r border-b border-black p-0.5 text-black text-center">{well.vannesLatTbgMarque || ''}</td>
                      <td className="border-r border-b border-black p-0.5 text-black text-center">{well.vannesLatCsgMarque || ''}</td>
                      <td className="border-l border-black bg-white text-center font-mono font-bold text-[9.5px] text-black align-middle py-0.5">
                        {well.packerType || well.etanTbg || '//'}
                      </td>
                    </tr>

                    {/* Row 6: Vannes Nombre */}
                    <tr className="text-[9px] font-bold h-[20px]">
                      <td className="border-r border-b border-black p-0.5 font-sans text-left text-[8.5px] uppercase text-black font-normal bg-gray-200">NOMBRE</td>
                      <td className="border-r border-b border-black p-0.5 text-black font-black text-center">{well.vannesSasNombre || ''}</td>
                      <td className="border-r border-b border-black p-0.5 text-black font-black text-center">{well.vannesMaitresseNombre || ''}</td>
                      <td className="border-r border-b border-black p-0.5 text-black font-black text-center">{well.vannesLatTbgNombre || ''}</td>
                      <td className="border-r border-b border-black p-0.5 text-black font-black text-center">{well.vannesLatCsgNombre || ''}</td>
                      <td rowSpan={2} className="border-l border-black bg-white"></td>
                    </tr>

                    {/* Row 7: Vannes Ø et Série */}
                    <tr className="text-[9px] font-bold h-[20px]">
                      <td className="border-r border-black p-0.5 font-sans text-left text-[8.5px] uppercase text-black font-normal bg-gray-200">Ø et Série</td>
                      <td className="border-r border-black p-0.5 text-black text-center">{well.vannesSasSerie || ''}</td>
                      <td className="border-r border-black p-0.5 text-black text-center">{well.vannesMaitresseSerie || ''}</td>
                      <td className="border-r border-black p-0.5 text-black text-center">{well.vannesLatTbgSerie || ''}</td>
                      <td className="border-r border-black p-0.5 text-black text-center">{well.vannesLatCsgSerie || ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TABLE A: COLONNE TUBING */}
              <div className="border border-black border-solid flex flex-col bg-white mb-1.5 print-color-adjust" id="print_colonne_tubing_table">
                <div className="border-b border-black border-solid bg-gray-200 py-0.5 text-center font-sans font-black text-[10px] uppercase tracking-[0.2em] text-black">
                  COLONNE TUBING
                </div>
                
                <div className="w-full">
                  <table className="w-full text-left font-mono text-[10px] border-collapse text-black">
                    <thead>
                      <tr className="border-b border-black border-solid text-[9px] font-bold uppercase bg-gray-200 text-black">
                        <th className="border-r border-black px-1 py-0.5 text-center w-[65px]">Désignation</th>
                        <th className="border-r border-black px-1 py-0.5 text-center w-[20px]">Nb.</th>
                        <th className="border-r border-black px-1 py-0.5 text-center w-[24px]">Type</th>
                        <th className="border-r border-black px-1 py-0.5 text-center w-[30px]">Diam</th>
                        <th className="border-r border-black px-1 py-0.5 text-center w-[40px]">Longueur</th>
                        <th className="border-r border-black px-1 py-0.5 text-center w-[50px]">Cote Product</th>
                        <th className="border-r border-black px-1 py-0.5 text-center w-[22px]">Ø Mini</th>
                        <th className="px-1 py-0.5">Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tubingsForTable
                        .filter((tool) => {
                          const effectiveType = (tool.customType || tool.type || '').toLowerCase();
                          const name = (tool.name || '').toLowerCase();
                          return (
                            effectiveType !== 'bridge plug' &&
                            !effectiveType.includes('bridge') &&
                            !name.includes('bridge') &&
                            !name.includes('b.p') &&
                            !name.includes('bp')
                          );
                        })
                        .map((tool, idx) => {
                        const isBlank = !tool.name;
                        const rowMeta = layout.printTableRows.find((r) => r.toolId === tool.id);
                        const displayOd = rowMeta?.displayOd ?? tool.od;
                        const displayType = rowMeta?.displayType ?? getFrenchType(tool.type, tool.name);
                        const qty = rowMeta?.qty ?? (tool.qty || '01');
                        const showsCote = rowMeta?.showsCote ?? (!isBlank && tool.isCoteProductAdded);

                        return (
                          <tr key={tool.id} className="border-b border-black border-solid hover:bg-slate-50 text-[9.5px] h-[20px] text-black">
                            <td className="border-r border-black border-solid px-1 font-sans font-semibold text-black leading-tight">
                              {isBlank ? '' : tool.name}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center text-black font-bold">
                              {isBlank ? '' : qty}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center font-medium text-black">
                              {isBlank ? '' : displayType}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center font-bold text-black">
                              {isBlank ? '' : displayOd}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-right font-bold text-black">
                              {isBlank ? '' : formatDepth(tool.length)}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-right font-black text-black">
                              {showsCote ? formatDepth((tool as any).calculatedCote) : ''}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center text-black">
                              {isBlank ? '' : (tool.minId || '')}
                            </td>
                            <td className="px-1 text-black text-[9.5px] font-medium break-words whitespace-normal leading-tight py-0.5" title={tool.observations}>
                              {isBlank ? '' : (tool.observations || '')}
                            </td>
                          </tr>
                        );
                      })}

                      {/* B.C — Bouchon de Ciment rows */}
                      {showCementPlugsTable && (well.cementPlugs || []).length > 0 && (
                        <>
                          <tr className="border-b border-black border-solid bg-gray-100">
                            <td colSpan={8} className="px-2 py-0.5 font-sans font-black text-[9px] uppercase tracking-wider text-black">
                              Bouchon(s) de Ciment (B.C)
                            </td>
                          </tr>
                          {(well.cementPlugs || []).map((cp: CementPlug, idx: number) => (
                            <tr key={cp.id || `bc-row-${idx}`} className="border-b border-black border-solid text-[10px] h-[22px] text-black">
                              <td className="border-r border-black border-solid px-1 font-sans font-bold text-black">B.C</td>
                              <td className="border-r border-black border-solid px-1 text-center text-black font-bold">01</td>
                              <td className="border-r border-black border-solid px-1 text-center font-medium text-black">—</td>
                              <td className="border-r border-black border-solid px-1 text-center font-bold text-black">—</td>
                              <td className="border-r border-black border-solid px-1 text-right font-bold text-black">
                                {formatDepth(cp.bottomDepth - cp.topDepth)}
                              </td>
                              <td className="border-r border-black border-solid px-1 text-right font-black text-black">
                                {cp.topDepth}→{cp.bottomDepth}
                              </td>
                              <td className="border-r border-black border-solid px-1 text-center text-black">—</td>
                              <td className="px-1 text-black text-[9.5px] font-medium">
                                Top ciment: {cp.topDepth}m — B.C: {cp.bottomDepth}m{cp.observations ? ` | ${cp.observations}` : ''}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}

                      {/* B.P — Barrière de Fond (Bridge Plug) rows */}
                      {showBridgePlugsTable &&
                        (well.tubings || []).filter((t) => {
                          const effectiveType = (t.customType || t.type || '').toLowerCase();
                          const name = (t.name || '').toLowerCase();
                          return (
                            effectiveType === 'bridge plug' ||
                            effectiveType.includes('bridge') ||
                            name.includes('bridge') ||
                            name.includes('b.p') ||
                            name.includes('bp')
                          );
                        }).length > 0 && (
                          <>
                            <tr className="border-b border-black border-solid bg-gray-100">
                              <td colSpan={8} className="px-2 py-0.5 font-sans font-black text-[9px] uppercase tracking-wider text-black">
                                Barrière de Fond (B.P)
                              </td>
                            </tr>
                            {(well.tubings || [])
                              .filter((t) => {
                                const effectiveType = (t.customType || t.type || '').toLowerCase();
                                const name = (t.name || '').toLowerCase();
                                return (
                                  effectiveType === 'bridge plug' ||
                                  effectiveType.includes('bridge') ||
                                  name.includes('bridge') ||
                                  name.includes('b.p') ||
                                  name.includes('bp')
                                );
                              })
                              .map((bp: TubingComponent, idx: number) => {
                                const rowMeta = layout.printTableRows.find((r) => r.toolId === bp.id);
                                const qty = rowMeta?.qty ?? (bp.qty || '01');
                                const displayOd = bp.od ? `Taille: ${bp.od}` : '';
                                const displayType = bp.customType || bp.type ? `Type: ${bp.customType || bp.type}` : '';
                                const obsList = [bp.name || 'Bridge plug', displayOd, displayType, bp.observations].filter(Boolean).join(' | ');

                                return (
                                  <tr key={bp.id || `bp-row-${idx}`} className="border-b border-black border-solid text-[10px] h-[22px] text-black">
                                    <td className="border-r border-black border-solid px-1 font-sans font-bold text-black">B.P</td>
                                    <td className="border-r border-black border-solid px-1 text-center text-black font-bold">{qty}</td>
                                    <td className="border-r border-black border-solid px-1 text-center font-medium text-black">—</td>
                                    <td className="border-r border-black border-solid px-1 text-center font-medium text-black">—</td>
                                    <td className="border-r border-black border-solid px-1 text-center font-medium text-black">—</td>
                                    <td className="border-r border-black border-solid px-1 text-right font-black text-black">
                                      {formatDepth(bp.bottomDepth)}m
                                    </td>
                                    <td className="border-r border-black border-solid px-1 text-center text-black">—</td>
                                    <td className="px-1 text-black text-[9.5px] font-medium">
                                      {obsList}
                                    </td>
                                  </tr>
                                );
                              })}
                          </>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABLE: COLONNE SRP */}
              {(well.srpComponents || []).length > 0 && (
                <div className="border border-black border-solid flex flex-col bg-white mb-1.5 print-color-adjust" id="print_colonne_srp_table">
                  <div className="border-b border-black border-solid bg-gray-200 py-0.5 text-center font-sans font-black text-[10px] uppercase tracking-[0.2em] text-black">
                    COLONNE SRP
                  </div>
                  
                  <div className="w-full">
                    <table className="w-full text-left font-mono text-[10px] border-collapse text-black">
                      <thead>
                        <tr className="border-b border-black border-solid text-[9px] font-bold uppercase bg-gray-200 text-black">
                          <th className="border-r border-black px-1 py-0.5 text-center w-[65px]">Désignation</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[20px]">Nb.</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[24px]">Type</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[30px]">Diam</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[40px]">Longueur</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[50px]">Cote Product</th>
                          <th className="px-1 py-0.5">Observations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculateCoteProducts(well.srpComponents || [], well.spoolProd).map((tool) => (
                          <tr key={tool.id} className="border-b border-black border-solid hover:bg-slate-50 text-[9.5px] h-[20px] text-black">
                            <td className="border-r border-black border-solid px-1 font-sans font-semibold text-black leading-tight">
                              {tool.name}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center text-black font-bold">
                              {tool.qty || '01'}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center font-medium text-black">
                              {tool.customType || '-'}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center font-bold text-black">
                              {tool.od || ''}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-right font-bold text-black">
                              {formatDepth(tool.length)}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-right font-black text-black">
                              {tool.calculatedCote !== undefined ? formatDepth(tool.calculatedCote) : ''}
                            </td>
                            <td className="px-1 text-black text-[9.5px] font-medium break-words whitespace-normal leading-tight py-0.5" title={tool.observations}>
                              {tool.observations || ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}


              {/* TABLE B: PERFORATIONS (Separated by Reservoir) */}
              {well.purpose !== 'PPE' && (() => {
                const perfs = well.perforations || [];
                if (perfs.length === 0) {
                  return (
                    <div className="border border-black border-solid flex flex-col shrink-0 bg-white mb-2 print-color-adjust" id="print_perforations_table">
                      <div className="border-b border-black border-solid bg-gray-200 py-0.5 text-center font-sans font-black text-[10px] uppercase tracking-[0.2em] text-black">
                        PERFORATIONS
                      </div>
                      <div className="p-2 text-center text-[10px] text-gray-500 italic">Aucune perforation définie</div>
                    </div>
                  );
                }

                const groups = new Map<string, typeof perfs>();
                perfs.forEach(p => {
                  const res = p.reservoir || well.reservoir || 'Général';
                  if (!groups.has(res)) {
                    groups.set(res, []);
                  }
                  groups.get(res)!.push(p);
                });

                const visibleGroups = Array.from(groups.entries()).filter(([resName]) => selectedPerfRes[resName] ?? true);

                if (visibleGroups.length === 0) {
                  return null;
                }

                return visibleGroups.map(([resName, groupPerfs], gIdx) => (
                  <div key={`print-perf-table-${gIdx}`} className="border border-black border-solid flex flex-col shrink-0 bg-white mb-1.5 print-color-adjust" id={`print_perforations_table_${gIdx}`}>
                    <div className="border-b border-black border-solid bg-gray-200 py-0.5 text-center font-sans font-black text-[10px] uppercase tracking-[0.2em] text-black">
                      PERFORATIONS {showReservoirInPerfHeader && resName ? `— RÉS. ${resName}` : ''}
                    </div>
                    <table className="w-full text-left font-mono text-[10px] border-collapse text-black">
                      <thead>
                        <tr className="border-b border-black border-solid text-[9px] font-bold uppercase bg-gray-200 text-black">
                          <th className="border-r border-black px-1.5 py-0.5 text-center w-[120px]">NIVEAUX PERFORES</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[45px]">Hauteur</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[70px]">Type de Perfo.</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[80px]">Diamètre du Perfo.</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[70px]">Densité au m.</th>
                          <th className="border-r border-black px-1 py-0.5 text-center w-[35px]">Calage</th>
                          <th className="px-1.5 py-0.5 text-center w-[60px]">Nbr. de Cps. Tirés</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupPerfs.map((perf, idx) => (
                          <tr key={perf.id || idx} className="border-b border-black border-solid h-[20px] text-[9.5px] text-black">
                            <td className="border-r border-black border-solid px-1.5 font-bold text-center text-black">
                              {`De ${formatDepth(perf.topDepth)} à ${formatDepth(perf.bottomDepth)}`}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center font-bold text-black">
                              {`${perf.height % 1 === 0 ? perf.height : parseFloat(perf.height.toFixed(2))}m`}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center text-black uppercase">
                              {perf.perfoType || ''}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center font-bold text-black">
                              {perf.diameter || ''}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center text-black">
                              {perf.density !== undefined ? perf.density : ''}
                            </td>
                            <td className="border-r border-black border-solid px-1 text-center text-black">
                              {perf.calage || ''}
                            </td>
                            <td className="px-1.5 text-center font-bold text-black">
                              {perf.shots !== undefined && perf.shots !== null ? (perf.shots % 1 === 0 ? perf.shots : parseFloat(perf.shots.toFixed(2))) : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ));
              })()}

              {/* TABLE B2: LINER CRÉPINE */}
              {(() => {
                const lcs = well.linerCrepines || [];
                const lcp = well.linerCrepineParams;
                const hasLcp = lcp && (lcp.topOfLiner != null || lcp.shoeDepth != null);
                if (lcs.length === 0 && !hasLcp) return null;

                return (
                  <div className="border border-black border-solid flex flex-col shrink-0 bg-white mb-2 print-color-adjust" id="print_liner_crepine_table">
                    <div className="border-b border-black border-solid bg-gray-200 py-0.5 text-center font-sans font-black text-[10px] uppercase tracking-[0.2em] text-black">
                      LINER CRÉPINE
                    </div>
                    {hasLcp && well.purpose !== 'PPE' && (
                      <div className="border-b border-black p-1 bg-slate-50 text-[9px] font-mono grid grid-cols-2 gap-x-2 gap-y-0.5 text-black">
                        <div><span className="font-bold">Début (TOL):</span> {lcp?.topOfLiner != null ? `${formatDepth(lcp.topOfLiner)} m` : '—'} {lcp?.diameter ? `(Ø ${lcp.diameter})` : ''}</div>
                        <div><span className="font-bold">Sabot Crépine:</span> {lcp?.shoeDepth != null ? `${formatDepth(lcp.shoeDepth)} m` : '—'} {lcp?.length != null ? `(Long: ${formatDepth(lcp.length)} m)` : ''}</div>
                      </div>
                    )}
                    {lcs.length > 0 && (
                      <table className="w-full text-left font-mono text-[9.5px] border-collapse text-black">
                        <thead>
                          <tr className="border-b border-black border-solid text-[8.5px] font-bold uppercase bg-gray-200 text-black">
                            <th className="border-r border-black px-1.5 py-0.5 text-center w-[110px]">Niveaux Crépinés</th>
                            <th className="border-r border-black px-1 py-0.5 text-center w-[45px]">Hauteur</th>
                            <th className="border-r border-black px-1 py-0.5 text-center w-[65px]">Type Crépine</th>
                            <th className="border-r border-black px-1 py-0.5 text-center w-[55px]">Ø. crépine</th>
                            <th className="border-r border-black px-1 py-0.5 text-center w-[45px]">Slot</th>
                            <th className="border-r border-black px-1 py-0.5 text-center w-[45px]">ID mi</th>
                            <th className="px-1.5 py-0.5 text-center w-[55px]">Nbre. Coups</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lcs.map((lc, idx) => (
                            <tr key={lc.id || idx} className="border-b border-black border-solid h-[22px] text-[9px] text-black">
                              <td className="border-r border-black border-solid px-1.5 font-bold text-center text-black">
                                {`De ${formatDepth(lc.topDepth)} à ${formatDepth(lc.bottomDepth)}`}
                              </td>
                              <td className="border-r border-black border-solid px-1 text-center font-bold text-black">
                                {`${lc.height % 1 === 0 ? lc.height : parseFloat(lc.height.toFixed(2))}m`}
                              </td>
                              <td className="border-r border-black border-solid px-1 text-center text-black uppercase font-bold">
                                {lc.typeCrepine || ''}
                              </td>
                              <td className="border-r border-black border-solid px-1 text-center font-bold text-black">
                                {lc.diameter || ''}
                              </td>
                              <td className="border-r border-black border-solid px-1 text-center text-black">
                                {lc.slot || ''}
                              </td>
                              <td className="border-r border-black border-solid px-1 text-center text-black">
                                {lc.idMi || ''}
                              </td>
                              <td className="px-1.5 text-center font-bold text-black">
                                {lc.nbreCoups !== undefined ? lc.nbreCoups : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })()}

              {/* TABLE C: OBSERVATIONS FOOTNOTES */}
              <div className="border border-black p-1.5 shrink-0 bg-white" id="print_observations_box">
                <span className="text-[10px] font-extrabold text-black uppercase block tracking-wider mb-0.5">OBSERVATIONS :</span>
                <div 
                  className="text-[10.5px] leading-tight text-black font-normal [&_p]:my-0 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4"
                  dangerouslySetInnerHTML={{ __html: observationText || '' }}
                />
              </div>

            </div>

            {/* COLUMN 2: RIGHT SIDE - THE GRAPHICAL WELLBORE SCHEMATIC SECTION */}
            <div className={`border border-black bg-white flex flex-col justify-between p-1.5 relative h-full ${hideSchematic ? 'hidden' : ''}`}>
              
              {/* Graphic section title */}
              <div className="border-b border-black pb-1 mb-1 text-center shrink-0">
                <span className="font-sans font-black text-[11.5px] uppercase tracking-wider block text-slate-900">
                  COUPE SCHEMATIQUE DU PUITS
                </span>
                <span className="font-sans font-semibold text-[9.5px] text-slate-600 uppercase block leading-none mt-0.5">
                  Échelle : {scaleMode === 'linear' ? 'Proportionnelle (Vraie Échelle)' : 'Schématique (Focus)'}
                </span>
              </div>

              {/* Elevations & Head Equipment Table */}
              <div className="border border-black grid grid-cols-2 text-[10.5px] font-mono leading-tight mb-2 shrink-0 bg-white">
                {/* Row 1 */}
                <div className="border-r border-b border-black p-1 flex justify-between items-baseline">
                  <span className="text-black font-sans text-[9.5px] font-bold">Z Sol:</span>
                  <span className="font-bold text-black">{formatDepth(well.elevationSol)}</span>
                </div>
                <div className="border-b border-black p-1 flex justify-between items-baseline">
                  <span className="text-black font-sans text-[9.5px] font-bold">Origine cotes:</span>
                  <span className="font-bold text-black truncate max-w-[80px]" title={well.origineCotes || ''}>{well.origineCotes || ''}</span>
                </div>

                {/* Row 2 */}
                <div className="border-r border-b border-black p-1 flex justify-between items-baseline">
                  <span className="text-black font-sans text-[9.5px] font-bold">Z Forage:</span>
                  <span className="font-bold text-black">{formatDepth(well.elevationForage)}</span>
                </div>
                <div className="border-b border-black p-1 flex justify-between items-baseline">
                  <span className="text-black font-sans text-[9.5px] font-bold">Spool Prod:</span>
                  <span className="font-bold text-black truncate max-w-[80px]" title={well.spoolProd || 'CB 15A'}>{well.spoolProd || 'CB 15A'}</span>
                </div>

                {/* Row 3 */}
                <div className="border-r border-black p-1 flex justify-between items-baseline">
                  <span className="text-black font-sans text-[9.5px] font-bold">Z Prod:</span>
                  <span className="font-bold text-black">{formatDepth(well.elevationProduction)}</span>
                </div>
                <div className="p-1"></div>
              </div>

              {/* Dynamic Blueprint Graphic SVG */}
              <div className="flex-1 w-full overflow-hidden flex justify-center relative bg-white pt-2" id="print_canvas_pane">
                <svg
                  id="print_card_vector_schematic"
                  width={svgWidth}
                  height={svgHeight}
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  preserveAspectRatio="xMidYMin meet"
                  className="font-mono"
                  style={{ width: '100%', height: '100%', maxHeight: '950px' }}
                >
                  <defs>
                    {/* Coarse Gravel / Sand Pack pattern */}
                    <pattern id="gravel-pack-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <rect width="20" height="20" fill="#e8d5aa" />
                      <circle cx="4" cy="4" r="2.0" fill="#4a3b32" opacity="0.9" />
                      <circle cx="15" cy="8" r="2.8" fill="#8c7355" opacity="0.9" />
                      <circle cx="8" cy="16" r="1.8" fill="#3b2f27" opacity="0.9" />
                      <circle cx="17" cy="18" r="2.2" fill="#5c4a3d" opacity="0.9" />
                      <circle cx="2" cy="12" r="1.5" fill="#4a3b32" opacity="0.8" />
                      <circle cx="11" cy="2" r="1.6" fill="#7a6345" opacity="0.8" />
                      <circle cx="9" cy="9" r="1.0" fill="#3b2f27" opacity="0.7" />
                    </pattern>
                    {/* True vintage diagonal hatch for concrete cement slurry */}
                    <pattern id="slurry-diagonal" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                      <rect width="10" height="10" fill="#cbd5e1" />
                    </pattern>
                    
                    {/* Sand / Sandstone reservoir dotting hatch */}
                    <pattern id="sand-gravel" width="8" height="8" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="0.7" fill="#000000" opacity="0.6" />
                      <circle cx="6" cy="6" r="0.7" fill="#000000" opacity="0.4" />
                      <line x1="1" y1="5" x2="3" y2="7" stroke="#000" strokeWidth="0.4" opacity="0.3" />
                    </pattern>

                    {/* Continuous steel tubing joint pattern */}
                    <pattern id="tubing-pattern-print" x="0" y="0" width="10" height="80" patternUnits="userSpaceOnUse" patternTransform={`translate(${xCenter - 5}, 0)`}>
                      <image href="/img/tubing.svg" x="-31.11" y="0" width="83.33" height="80" preserveAspectRatio="none" />
                    </pattern>

                    {/* Left and right pointing annotations markers */}
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

                  {/* CENTERLINE (Spans completely down the vertical layout) */}
                  <line x1={xCenter} y1={50} x2={xCenter} y2={svgHeight - 15} stroke="#111" strokeWidth="0.8" strokeDasharray="6,3,1,3" />

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
                          {/* Continuous sandstone shading block spanning all perforations */}
                          <rect x={15} y={yTop - 15} width={svgWidth - 30} height={rectHeight} fill="url(#sand-gravel)" opacity="0.12" />
                          
                          {/* Only two boundary lines total, framing the entire formation zone */}
                          <line x1={15} y1={yTop - 15} x2={svgWidth - 15} y2={yTop - 15} stroke="#000" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
                          <line x1={15} y1={yBotDotted} x2={svgWidth - 15} y2={yBotDotted} stroke="#000" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
                        </g>
                      );
                    });
                  })()}

                  {/* CASINGS RENDERING */}
                  {(() => {
                    const casingsData = printCasingsData;

                    // Generate unified Left-Hand Labels list
                    const rawLeftLabels: { 
                      lines: string[]; 
                      targetY: number; 
                      targetX: number; 
                      isTOC?: boolean;
                      isBorehole?: boolean;
                      isShoe?: boolean;
                    }[] = [];

                    casingsData.forEach((cd) => {
                      const { casing, i, csgR, holeR, yTop, yShoe, yDrilled, yTOC, hasCement, tocVal, hasLiner, tolVal, yTOL, hasTF, tfVal, yTF } = cd;
                      
                      const csgSizeFormatted = formatCasingSize(casing.casingSize);
                      const holeSizeClean = String(casing.boreholeSize).replace(/['"]/g, '').trim();

                      if (i === 0) {
                        // 2. ciment (if hasCement)
                        if (hasCement) {
                          rawLeftLabels.push({
                            lines: ["ciment"],
                            targetY: (yTOC + yShoe) / 2 + 8,
                            targetX: xCenter - (holeR + csgR) / 2,
                            isTOC: true,
                          });
                        }

                        // 3. Sbt: ...
                        rawLeftLabels.push({
                          lines: ["Sbt:", `${formatDepth(casing.shoeDepth)} m`],
                          targetY: yShoe,
                          targetX: xCenter - csgR,
                          isShoe: true,
                        });

                        // 4. foré jusqu' à (drilled depth, if it extends deeper than shoe)
                        if (yDrilled > yShoe + 1) {
                          rawLeftLabels.push({
                            lines: ["foré jusqu' à :", `${formatDepth(casing.drilledDepth)} m`],
                            targetY: yDrilled,
                            targetX: xCenter - holeR,
                          });
                        }
                      } else {
                        // For subsequent casings
                        // 1. TOC (if cement is there)
                        if (hasCement && tocVal !== null) {
                          rawLeftLabels.push({
                            lines: [`TOC ${csgSizeFormatted} :`, `${formatDepth(tocVal)} m`],
                            targetY: yTOC,
                            targetX: xCenter - (holeR + csgR) / 2,
                            isTOC: true,
                          });
                        }

                        // TOL (if liner is there)
                        if (hasLiner && tolVal !== null && yTOL !== null) {
                          rawLeftLabels.push({
                            lines: [`TOL ${csgSizeFormatted} :`, `${formatDepth(tolVal)} m`],
                            targetY: yTOL,
                            targetX: xCenter - (holeR + csgR) / 2,
                          });
                        }

                        // TF - Top Fonde (if set)
                        if (hasTF && tfVal !== null && yTF !== null) {
                          rawLeftLabels.push({
                            lines: [`TF ${csgSizeFormatted} :`, `${formatDepth(tfVal)} m`],
                            targetY: yTF,
                            targetX: xCenter - (holeR + csgR) / 2,
                          });
                        }

                        // 3. Sabot / Sbt
                        rawLeftLabels.push({
                          lines: [`Sbt:`, `${formatDepth(casing.shoeDepth)} m`],
                          targetY: yShoe,
                          targetX: xCenter - csgR,
                          isShoe: true,
                        });

                        // 4. foré à (drilled depth, if it extends deeper than shoe)
                        if (yDrilled > yShoe + 1) {
                          rawLeftLabels.push({
                            lines: ["foré jusqu' à :", `${formatDepth(casing.drilledDepth)} m`],
                            targetY: yDrilled,
                            targetX: xCenter - holeR,
                          });
                        }
                      }
                    });

                    // Liner Crépine Left-hand annotations (TOL & Sabot Crépine)
                    if (well.linerCrepineParams?.topOfLiner != null && !isNaN(well.linerCrepineParams.topOfLiner)) {
                      const tolVal = Number(well.linerCrepineParams.topOfLiner);
                      const yTOL = mapDepthToY(tolVal);
                      const diam = well.linerCrepineParams.diameter ? ` ${well.linerCrepineParams.diameter}` : '';
                      rawLeftLabels.push({
                        lines: [`TOL${diam} :`, `${formatDepth(tolVal)} m`],
                        targetY: yTOL,
                        targetX: xCenter - 14,
                      });
                    }

                    if (well.linerCrepineParams?.shoeDepth != null && !isNaN(well.linerCrepineParams.shoeDepth)) {
                      const shoeVal = Number(well.linerCrepineParams.shoeDepth);
                      const yShoe = mapDepthToY(shoeVal);
                      const diam = well.linerCrepineParams.diameter ? ` ${well.linerCrepineParams.diameter}` : '';
                      rawLeftLabels.push({
                        lines: [`Sbt Crépine${diam} :`, `${formatDepth(shoeVal)} m`],
                        targetY: yShoe,
                        targetX: xCenter - 14,
                        isShoe: true,
                      });
                    }

                    if (well.linerCrepineParams?.drilledToDepth != null && !isNaN(Number(well.linerCrepineParams.drilledToDepth))) {
                      const drilledVal = Number(well.linerCrepineParams.drilledToDepth);
                      const yDrilled = mapDepthToY(drilledVal);
                      const diam = well.linerCrepineParams.holeDiameter ? ` Ø ${well.linerCrepineParams.holeDiameter}` : '';
                      rawLeftLabels.push({
                        lines: [`foré${diam} jusqu' à :`, `${formatDepth(drilledVal)} m`],
                        targetY: yDrilled,
                        targetX: xCenter - 18,
                      });
                    }

                    // Spacing resolution algorithm for Left-Hand Labels to avoid any overlap
                    const spacingY = 28; // Increased spacing for clear readability
                    const resolvedLabels = rawLeftLabels.map((rl) => ({ ...rl, resolvedY: rl.targetY }));
                    
                    // Sort by targetY descending/ascending
                    resolvedLabels.sort((a, b) => a.targetY - b.targetY);

                    // Relax resolvedY coordinates to prevent overlaps
                    for (let iter = 0; iter < 120; iter++) {
                      let changed = false;
                      for (let j = 0; j < resolvedLabels.length - 1; j++) {
                        if (resolvedLabels[j + 1].resolvedY - resolvedLabels[j].resolvedY < spacingY) {
                          const overlap = spacingY - (resolvedLabels[j + 1].resolvedY - resolvedLabels[j].resolvedY);
                          resolvedLabels[j].resolvedY -= overlap / 2;
                          resolvedLabels[j + 1].resolvedY += overlap / 2;
                          changed = true;
                        }
                      }
                      // Keep them within safe vertical boundaries
                      for (let j = 0; j < resolvedLabels.length; j++) {
                        if (resolvedLabels[j].resolvedY < 55) {
                          resolvedLabels[j].resolvedY = 55;
                          changed = true;
                        }
                        if (resolvedLabels[j].resolvedY > svgHeight - 25) {
                          resolvedLabels[j].resolvedY = svgHeight - 25;
                          changed = true;
                        }
                      }
                      if (!changed) break;
                    }

                    return (
                      <g key="all-casings-group">
                        {casingsData.map((cd) => {
                          const { casing, i, csgR, holeR, yTop, yShoe, yDrilled, yTOC, hasCement, hasLiner, yTOL, hasTF, tfVal, yTF } = cd;
                          const previousCsg = i > 0 ? casingsData[i - 1] : null;
                          const prevShoeY = previousCsg ? previousCsg.yShoe : yTop;
                          const prevDrilledY = previousCsg ? previousCsg.yDrilled : yTop;
                          const prevCsgR = previousCsg ? previousCsg.csgR : holeR;
                          const prevHoleR = previousCsg ? previousCsg.holeR : holeR;
                          const holeYTop = prevDrilledY;
                          return (
                            <g key={`casing-lines-${i}`}>
                              {/* Borehole hole boundary */}
                              <line x1={xCenter - holeR} y1={holeYTop} x2={xCenter - holeR} y2={yDrilled} stroke="#333" strokeWidth="0.8" strokeDasharray="3,2" />
                              <line x1={xCenter + holeR} y1={holeYTop} x2={xCenter + holeR} y2={yDrilled} stroke="#333" strokeWidth="0.8" strokeDasharray="3,2" />
                              {/* Slurry cement shading */}
                              {yTOC !== null && (
                                <>
                                  {/* Left Cement Column (Upper part inside previous casing) */}
                                  {yTOC < prevShoeY && (
                                    <rect x={xCenter - Math.max(holeR, prevCsgR)} y={yTOC} width={Math.max(holeR, prevCsgR) - csgR} height={Math.max(0, prevShoeY - yTOC)} fill="url(#slurry-diagonal)" />
                                  )}
                                  {/* Left Cement Column (Middle part inside previous borehole pocket) */}
                                  {yTOC < prevDrilledY && prevDrilledY > prevShoeY && (
                                    <rect x={xCenter - Math.max(holeR, prevHoleR)} y={Math.max(yTOC, prevShoeY)} width={Math.max(holeR, prevHoleR) - csgR} height={Math.max(0, prevDrilledY - Math.max(yTOC, prevShoeY))} fill="url(#slurry-diagonal)" />
                                  )}
                                  {/* Left Cement Column (Lower part inside current borehole) */}
                                  {yShoe > Math.max(yTOC, prevDrilledY) && (
                                    <rect x={xCenter - holeR} y={Math.max(yTOC, prevDrilledY)} width={holeR - csgR} height={yShoe - Math.max(yTOC, prevDrilledY)} fill="url(#slurry-diagonal)" />
                                  )}
                                  
                                  {/* Right Cement Column (Upper part inside previous casing) */}
                                  {yTOC < prevShoeY && (
                                    <rect x={xCenter + csgR} y={yTOC} width={Math.max(holeR, prevCsgR) - csgR} height={Math.max(0, prevShoeY - yTOC)} fill="url(#slurry-diagonal)" />
                                  )}
                                  {/* Right Cement Column (Middle part inside previous borehole pocket) */}
                                  {yTOC < prevDrilledY && prevDrilledY > prevShoeY && (
                                    <rect x={xCenter + csgR} y={Math.max(yTOC, prevShoeY)} width={Math.max(holeR, prevHoleR) - csgR} height={Math.max(0, prevDrilledY - Math.max(yTOC, prevShoeY))} fill="url(#slurry-diagonal)" />
                                  )}
                                  {/* Right Cement Column (Lower part inside current borehole) */}
                                  {yShoe > Math.max(yTOC, prevDrilledY) && (
                                    <rect x={xCenter + csgR} y={Math.max(yTOC, prevDrilledY)} width={holeR - csgR} height={yShoe - Math.max(yTOC, prevDrilledY)} fill="url(#slurry-diagonal)" />
                                  )}
                                </>
                              )}

                              {/* TF - Top Fonde Cement Plug */}
                              {hasTF && tfVal !== null && yTF !== null && (
                                <>
                                  {/* Cement plug inside the casing */}
                                  <rect
                                    x={xCenter - csgR}
                                    y={yTF}
                                    width={csgR * 2}
                                    height={Math.max(0, yShoe - yTF)}
                                    fill="url(#slurry-diagonal)"
                                  />
                                  {/* Cement plug in the open hole pocket below the shoe */}
                                  <path
                                    d={`M ${xCenter - holeR} ${yShoe} L ${xCenter - holeR} ${yDrilled} Q ${xCenter} ${yDrilled + 6} ${xCenter + holeR} ${yDrilled} L ${xCenter + holeR} ${yShoe} Z`}
                                    fill="url(#slurry-diagonal)"
                                  />
                                  {/* Top plug border line */}
                                  <line
                                    x1={xCenter - csgR}
                                    y1={yTF}
                                    x2={xCenter + csgR}
                                    y2={yTF}
                                    stroke="#000"
                                    strokeWidth="1.5"
                                  />
                                </>
                              )}

                              {/* Casing wall heavy solid lines */}
                              <line x1={xCenter - csgR} y1={yTop} x2={xCenter - csgR} y2={yShoe} stroke="#000" strokeWidth="2.5" />
                              <line x1={xCenter + csgR} y1={yTop} x2={xCenter + csgR} y2={yShoe} stroke="#000" strokeWidth="2.5" />

                              {/* Casing shoe triangles */}
                              <polygon points={`${xCenter - csgR},${yShoe} ${xCenter - csgR - 8},${yShoe} ${xCenter - csgR},${yShoe - 8}`} fill="#000" />
                              <polygon points={`${xCenter + csgR},${yShoe} ${xCenter + csgR + 8},${yShoe} ${xCenter + csgR},${yShoe - 8}`} fill="#000" />

                              {/* Liner Hanger (TOL) */}
                              {hasLiner && yTOL !== null && (() => {
                                const tolDepth = casing.topOfLiner != null ? Number(casing.topOfLiner) : Number(casing.topDepth || 0);
                                const coveringCasings = casingsData.filter((item, cIdx) => {
                                  if (cIdx === i) return false;
                                  const top = item.casing.topDepth || 0;
                                  const shoe = item.casing.shoeDepth || 0;
                                  return tolDepth >= top && tolDepth <= shoe;
                                });
                                let hostR = csgR;
                                if (coveringCasings.length > 0) {
                                  coveringCasings.sort((a, b) => a.csgR - b.csgR);
                                  hostR = coveringCasings[0].csgR;
                                }

                                return (
                                  <g>
                                    {/* SVG spans precisely from host casing wall to liner casing */}
                                    {(() => {
                                      const hangerW = hostR > csgR ? (hostR - csgR) : 12;
                                      return (
                                        <>
                                          <image
                                            href="/img/liner.svg"
                                            preserveAspectRatio="none"
                                            x={xCenter - hostR}
                                            y={yTOL}
                                            width={hangerW}
                                            height="16"
                                          />
                                          <image
                                            href="/img/liner.svg"
                                            preserveAspectRatio="none"
                                            x={xCenter + csgR}
                                            y={yTOL}
                                            width={hangerW}
                                            height="16"
                                          />
                                        </>
                                      );
                                    })()}
                                  </g>
                                );
                              })()}

                              {/* Drilled borehole pocket */}
                              <path d={`M ${xCenter - holeR} ${yShoe} L ${xCenter - holeR} ${yDrilled} Q ${xCenter} ${yDrilled + 6} ${xCenter + holeR} ${yDrilled} L ${xCenter + holeR} ${yShoe}`} fill="none" stroke="#111" strokeWidth="0.8" strokeDasharray="2,2" />
                            </g>
                          );
                        })}

                        {/* OPEN HOLE / EARTH HOLE (Trou Foré sans tubage - Wavy Earth Contour & 80% Coarse / 20% Fine Gravel Pack) */}
                        {well.linerCrepineParams?.drilledToDepth != null &&
                         !isNaN(Number(well.linerCrepineParams.drilledToDepth)) && (() => {
                          const drilledDepth = Number(well.linerCrepineParams.drilledToDepth);

                          // Find where open hole begins: previous host casing shoe or TOL
                          let openHoleTop = 0;
                          const tolVal = well.linerCrepineParams?.topOfLiner != null ? Number(well.linerCrepineParams.topOfLiner) : null;
                          const shoeVal = well.linerCrepineParams?.shoeDepth != null ? Number(well.linerCrepineParams.shoeDepth) : null;
                          const coveringCasings = casingsData.filter(cd => {
                            const top = cd.casing.topDepth || 0;
                            const shoe = cd.casing.shoeDepth || 0;
                            return tolVal !== null ? (tolVal >= top && tolVal <= shoe) : true;
                          });
                          if (coveringCasings.length > 0) {
                            openHoleTop = Math.max(...coveringCasings.map(cd => cd.casing.shoeDepth || 0));
                          } else {
                            openHoleTop = tolVal !== null ? tolVal : 0;
                          }

                          const yOpenTop = mapDepthToY(openHoleTop);
                          const yOpenBot = mapDepthToY(drilledDepth);
                          const openHeight = yOpenBot - yOpenTop;
                          if (openHeight <= 0) return null;

                          const holeDiamStr = String(well.linerCrepineParams.holeDiameter || '8" 1/2');
                          const holeDiamNum = parseSizeToNumber(holeDiamStr) || 8.5;

                          let radiusFactor = 3.2;
                          if (casingsData.length > 0) {
                            const firstCsg = casingsData[0];
                            const firstSize = parseSizeToNumber(firstCsg.casing.casingSize);
                            if (firstSize > 0) radiusFactor = firstCsg.csgR / firstSize;
                          }
                          const openHoleR = Math.max(16, Math.min(48, holeDiamNum * radiusFactor));

                          const linerDiamStr = well.linerCrepineParams?.diameter || '6"';
                          const linerDiamNum = parseSizeToNumber(linerDiamStr) || 6;
                          let innerLinerR = Math.max(10, Math.min(36, linerDiamNum * radiusFactor));
                          if (innerLinerR >= openHoleR) innerLinerR = Math.max(8, openHoleR - 8);

                          const yShoe = shoeVal != null ? mapDepthToY(shoeVal) : yOpenBot;

                          // Deterministic wave function for natural non-straight rugged borehole wall
                          const getWaveL = (y: number) => {
                            const t = y * 0.08;
                            return Math.sin(t * 0.85) * 3.2 + Math.cos(t * 1.7) * 2.0 - Math.sin(t * 0.35) * 1.5;
                          };
                          const getWaveR = (y: number) => {
                            const t = y * 0.08;
                            return Math.cos(t * 0.8) * 3.2 - Math.sin(t * 1.6) * 2.0 + Math.cos(t * 0.4) * 1.5;
                          };

                          // Build smooth left and right undulating path points
                          const step = 6;
                          const leftPoints: { x: number; y: number }[] = [];
                          for (let y = yOpenTop; y <= yOpenBot; y += step) {
                            leftPoints.push({ x: xCenter - openHoleR + getWaveL(y), y });
                          }
                          if (leftPoints[leftPoints.length - 1].y < yOpenBot) {
                            leftPoints.push({ x: xCenter - openHoleR + getWaveL(yOpenBot), y: yOpenBot });
                          }

                          const rightPoints: { x: number; y: number }[] = [];
                          for (let y = yOpenTop; y <= yOpenBot; y += step) {
                            rightPoints.push({ x: xCenter + openHoleR + getWaveR(y), y });
                          }
                          if (rightPoints[rightPoints.length - 1].y < yOpenBot) {
                            rightPoints.push({ x: xCenter + openHoleR + getWaveR(yOpenBot), y: yOpenBot });
                          }

                          const dLeft = leftPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
                          const dRight = rightPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

                          // Closed pocket path for background with inner cutout for liner casing
                          const rightReversed = [...rightPoints].reverse();
                          const closedPath = `${dLeft} Q ${xCenter} ${yOpenBot + 9} ${rightPoints[rightPoints.length - 1].x.toFixed(2)} ${yOpenBot} ` +
                            rightReversed.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
                            ` Z ` +
                            `M ${xCenter - innerLinerR} ${yOpenTop} ` +
                            `L ${xCenter + innerLinerR} ${yOpenTop} ` +
                            `L ${xCenter + innerLinerR} ${yShoe} ` +
                            `L ${xCenter - innerLinerR} ${yShoe} ` +
                            `Z`;

                          return (
                            <g key="print-open-hole-earth-group">
                              {/* Earth formation background */}
                              <path
                                d={closedPath}
                                fill="url(#gravel-pack-pattern)"
                                fillRule="evenodd"
                              />

                              {/* Geological Formation Cut Outward Rock Hatching */}
                              <g key="print-rock-cut-hatching" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" opacity="0.65">
                                {leftPoints.filter((_, idx) => idx % 2 === 0).map((p, idx) => (
                                  <line
                                    key={`print-hatch-l-${idx}`}
                                    x1={p.x}
                                    y1={p.y}
                                    x2={p.x - 4.5}
                                    y2={p.y - 2.5}
                                  />
                                ))}
                                {rightPoints.filter((_, idx) => idx % 2 === 0).map((p, idx) => (
                                  <line
                                    key={`print-hatch-r-${idx}`}
                                    x1={p.x}
                                    y1={p.y}
                                    x2={p.x + 4.5}
                                    y2={p.y - 2.5}
                                  />
                                ))}
                                {/* Bottom rock cut hatches */}
                                <line
                                  x1={xCenter - 8}
                                  y1={yOpenBot + 4}
                                  x2={xCenter - 8}
                                  y2={yOpenBot + 8}
                                />
                                <line
                                  x1={xCenter}
                                  y1={yOpenBot + 6}
                                  x2={xCenter}
                                  y2={yOpenBot + 10}
                                />
                                <line
                                  x1={xCenter + 8}
                                  y1={yOpenBot + 4}
                                  x2={xCenter + 8}
                                  y2={yOpenBot + 8}
                                />
                              </g>

                              {/* Real Rock Hole Cut - Left rugged formation wall */}
                              <path
                                d={dLeft}
                                fill="none"
                                stroke="#111827"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* Real Rock Hole Cut - Right rugged formation wall */}
                              <path
                                d={dRight}
                                fill="none"
                                stroke="#111827"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* Real Rock Hole Cut - Bottom TD formation pocket */}
                              <path
                                d={`M ${leftPoints[leftPoints.length - 1].x.toFixed(2)} ${yOpenBot} Q ${xCenter} ${yOpenBot + 8} ${rightPoints[rightPoints.length - 1].x.toFixed(2)} ${yOpenBot}`}
                                fill="none"
                                stroke="#111827"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </g>
                          );
                        })()}

                        {/* DEDICATED LINER CRÉPINE CASING STRING (TOL to Sabot Crépine) */}
                        {well.linerCrepineParams?.topOfLiner != null &&
                         well.linerCrepineParams?.shoeDepth != null &&
                         Number(well.linerCrepineParams.shoeDepth) > Number(well.linerCrepineParams.topOfLiner) && (() => {
                          const tolDepth = Number(well.linerCrepineParams.topOfLiner);
                          const shoeDepth = Number(well.linerCrepineParams.shoeDepth);
                          const yTol = mapDepthToY(tolDepth);
                          const yShoe = mapDepthToY(shoeDepth);
                          const height = yShoe - yTol;
                          if (height <= 0) return null;

                          const diamStr = well.linerCrepineParams.diameter || '6"';
                          const diamNum = parseSizeToNumber(diamStr) || 6;

                          let radiusFactor = 3.2;
                          if (casingsData.length > 0) {
                            const firstCsg = casingsData[0];
                            const firstSize = parseSizeToNumber(firstCsg.casing.casingSize);
                            if (firstSize > 0) radiusFactor = firstCsg.csgR / firstSize;
                          }
                          let linerCsgR = Math.max(10, Math.min(36, diamNum * radiusFactor));

                          let hostCsgR: number | null = null;
                          const coveringCasings = casingsData.filter(cd => {
                            const top = cd.casing.topDepth || 0;
                            const shoe = cd.casing.shoeDepth || 0;
                            return tolDepth >= top && tolDepth <= shoe;
                          });
                          if (coveringCasings.length > 0) {
                            coveringCasings.sort((a, b) => a.csgR - b.csgR);
                            hostCsgR = coveringCasings[0].csgR;
                            if (linerCsgR >= hostCsgR) linerCsgR = Math.max(8, hostCsgR - 6);
                          }

                          const anchorR = hostCsgR !== null ? hostCsgR : linerCsgR + 6;

                          return (
                            <g key="print-liner-crepine-casing-group">
                              {/* Casing wall solid lines for Liner */}
                              <line x1={xCenter - linerCsgR} y1={yTol} x2={xCenter - linerCsgR} y2={yShoe} stroke="#000" strokeWidth="2.5" />
                              <line x1={xCenter + linerCsgR} y1={yTol} x2={xCenter + linerCsgR} y2={yShoe} stroke="#000" strokeWidth="2.5" />

                              {/* Liner Hanger (TOL) at yTol - Connected to host casing */}
                              {(() => {
                                const hangerW = anchorR > linerCsgR ? (anchorR - linerCsgR) : 12;
                                return (
                                  <>
                                    <image
                                      href="/img/liner.svg"
                                      preserveAspectRatio="none"
                                      x={xCenter - anchorR}
                                      y={yTol}
                                      width={hangerW}
                                      height="16"
                                    />
                                    <image
                                      href="/img/liner.svg"
                                      preserveAspectRatio="none"
                                      x={xCenter + linerCsgR}
                                      y={yTol}
                                      width={hangerW}
                                      height="16"
                                    />
                                  </>
                                );
                              })()}

                              {/* Sabot Crépine shoe triangles at yShoe */}
                              <polygon points={`${xCenter - linerCsgR},${yShoe} ${xCenter - linerCsgR - 8},${yShoe} ${xCenter - linerCsgR},${yShoe - 8}`} fill="#000" />
                              <polygon points={`${xCenter + linerCsgR},${yShoe} ${xCenter + linerCsgR + 8},${yShoe} ${xCenter + linerCsgR},${yShoe - 8}`} fill="#000" />
                            </g>
                          );
                        })()}

                        {/* RENDER THE UNIFIED RESOLVED LEFT LABELS */}
                        {resolvedLabels.map((lbl, idx) => {
                          const textX = 5; // Static left margin for clean vertical baseline alignment (as requested)
                          const labelEndX = 48; // Label horizontal leader line ending x (compact to avoid borehole overlap)
                          const elbowX = 53; // Label horizontal elbow x

                          return (
                            <g key={`left-lbl-${idx}`}>
                              {/* Multi-line Label Text aligned left (matches hand-drawn style perfectly) */}
                              {lbl.lines.map((lineText, lineIdx) => {
                                const lineY = lbl.lines.length === 1 
                                  ? lbl.resolvedY + 3.5 
                                  : lbl.resolvedY - 3 + (lineIdx * 9.5);
                                return (
                                  <text 
                                    key={`${idx}-line-${lineIdx}`}
                                    x={textX} 
                                    y={lineY} 
                                    fontSize="10" 
                                    fontWeight="bold" 
                                    className="font-sans" 
                                    fill="#000"
                                    textAnchor="start"
                                  >
                                    {lineText}
                                  </text>
                                );
                              })}

                              {/* Beautiful classic CAD leader line */}
                              <path
                                d={`M ${labelEndX} ${lbl.resolvedY} L ${elbowX} ${lbl.resolvedY} L ${lbl.targetX} ${lbl.targetY}`}
                                fill="none"
                                stroke="#000"
                                strokeWidth="0.6"
                                markerEnd="url(#arrow-right)"
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* CENTRAL TUBING ELEMENT INNER STRING (Continuous down to bottom Shoe) */}
                  {(() => {
                    const tbgR = 5;

                    return (
                      <g key="tubing-string-blueprint">
                        {tubingSegments.map((seg, sIdx) => {
                          if (maxTubingY !== null && seg.yStart >= maxTubingY) return null;
                          const effectiveYEnd = maxTubingY !== null ? Math.min(seg.yEnd, maxTubingY) : seg.yEnd;
                          const segHeight = effectiveYEnd - seg.yStart;
                          if (segHeight <= 0) return null;
                          return renderPrintTubingColumn(seg.yStart, effectiveYEnd, `tbg-seg-print-${sIdx}`, tbgR);
                        })}

                        {/* Tubing through completion clusters (mandrel, nipple, packer, shoe) */}
                        {completionBackbones.map((range, idx) => {
                          if (maxTubingY !== null && range.yStart >= maxTubingY) return null;
                          const effectiveYEnd = maxTubingY !== null ? Math.min(range.yEnd, maxTubingY) : range.yEnd;
                          const height = effectiveYEnd - range.yStart;
                          if (height <= 0) return null;
                          return renderPrintTubingColumn(range.yStart, effectiveYEnd, `completion-backbone-print-${idx}`, tbgR);
                        })}
                      </g>
                    );
                  })()}

                  {/* INTERACTIVE TUBING TOOL ATTACHMENTS (Mandrels, Packers, Reductions, Shoes) */}
                  {computedTools.map((tool, toolIdx) => {
                    const yTop = tool.visualYTop ?? (tool as { visual_y_top?: number }).visual_y_top ?? 0;
                    if (globalYTF !== null && yTop >= globalYTF) return null;
                    const yBottom = tool.visualYBottom ?? (tool as { visual_y_bottom?: number }).visual_y_bottom ?? yTop;
                    const height = Math.max(0, tool.visualHeight ?? (tool as { visual_height?: number }).visual_height ?? (yBottom - yTop));
                    const effectiveType = tool.effectiveType;

                    // Dynamically calculate the active inner casing radius at this tool's depth
                    const toolDepth = typeof tool.bottomDepth === "string" ? parseFloat(tool.bottomDepth || "0") : (tool.bottomDepth || 0);
                    const activeCsgR = activeCasingRadius(well, layout?.casings || [], toolDepth, tool.od);

                    const isBridgePlug =
                      effectiveType === 'Bridge Plug' ||
                      effectiveType.toLowerCase().includes('bridge') ||
                      effectiveType.toLowerCase().includes('bouchon') ||
                      (tool.name || '').toLowerCase().includes('bridge') ||
                      (tool.name || '').toLowerCase().includes('bouchon') ||
                      (tool.type || '').toLowerCase().includes('bridge') ||
                      (tool.type || '').toLowerCase().includes('bouchon');

                    if (isBridgePlug) {
                      const casingInnerWidth = activeCsgR * 2 + 2.5;
                      const svgWidth = casingInnerWidth * (512 / 119.13);
                      const svgX = xCenter - (253.69 / 512) * svgWidth;
                      const plugDrawHeight = Math.max(50, height);
                      return (
                        <g key={`blueprint-img-${tool.id}`}>
                          <svg
                            x={svgX}
                            y={yTop}
                            width={svgWidth}
                            height={plugDrawHeight}
                            viewBox="0 0 512 512"
                            preserveAspectRatio="none"
                          >
                            <image
                              href="/img/bridge-plug.svg?v=10"
                              x="0"
                              y="0"
                              width="512"
                              height="512"
                              preserveAspectRatio="none"
                            />
                          </svg>
                        </g>
                      );
                    }

                    const config = resolveTubingConfig(effectiveType, tool.name);

                    const isPacker =
                      config.type.toLowerCase().includes('packer') ||
                      config.type.toLowerCase().includes('pkr') ||
                      effectiveType.toLowerCase().includes('packer') ||
                      effectiveType.toLowerCase().includes('pkr') ||
                      (tool.name || '').toLowerCase().includes('packer') ||
                      (tool.name || '').toLowerCase().includes('pkr') ||
                      (tool.type || '').toLowerCase().includes('packer') ||
                      (tool.type || '').toLowerCase().includes('pkr');

                    const isMoteur =
                      config.type.toLowerCase().includes('moteur') ||
                      config.type.toLowerCase().includes('motor') ||
                      effectiveType.toLowerCase().includes('moteur') ||
                      effectiveType.toLowerCase().includes('motor') ||
                      (tool.name || '').toLowerCase().includes('moteur') ||
                      (tool.name || '').toLowerCase().includes('motor') ||
                      (tool.type || '').toLowerCase().includes('moteur') ||
                      (tool.type || '').toLowerCase().includes('motor');

                    const isPompe =
                      config.type.toLowerCase().includes('pompe') ||
                      config.type.toLowerCase().includes('pump') ||
                      effectiveType.toLowerCase().includes('pompe') ||
                      effectiveType.toLowerCase().includes('pump') ||
                      (tool.name || '').toLowerCase().includes('pompe') ||
                      (tool.name || '').toLowerCase().includes('pump') ||
                      (tool.type || '').toLowerCase().includes('pompe') ||
                      (tool.type || '').toLowerCase().includes('pump');

                    if (isPacker) {
                      const casingInnerWidth = activeCsgR * 2 + 2.5;
                      const svgWidth = casingInnerWidth * (300 / 260);
                      const svgX = xCenter - 0.5 * svgWidth;
                      const drawHeight = Math.max(45, height);
                      return (
                        <g key={`blueprint-packer-${tool.id}`}>
                          <svg
                            x={svgX}
                            y={yTop}
                            width={svgWidth}
                            height={drawHeight}
                            viewBox="0 0 300 750"
                            preserveAspectRatio="none"
                          >
                            <image
                              href={config.imageUrl || "/img/packer.svg"}
                              x="0"
                              y="0"
                              width="300"
                              height="750"
                              preserveAspectRatio="none"
                            />
                          </svg>
                        </g>
                      );
                    }

                    if (isMoteur || isPompe) {
                      const casingInnerWidth = activeCsgR * 2;
                      const svgWidth = casingInnerWidth * 0.40;
                      const svgX = xCenter - 0.5 * svgWidth;
                      const drawHeight = Math.max(45, height);
                      const imgSrc = config.imageUrl || (isMoteur ? "/img/moteur.svg" : "/img/pompe.svg");
                      const keyPrefix = isMoteur ? 'moteur' : 'pompe';
                      return (
                        <g key={`blueprint-${keyPrefix}-${tool.id}`}>
                          <svg
                            x={svgX}
                            y={yTop}
                            width={svgWidth}
                            height={drawHeight}
                            viewBox="0 0 300 750"
                            preserveAspectRatio="none"
                          >
                            <image
                              href={imgSrc}
                              x="0"
                              y="0"
                              width="300"
                              height="750"
                              preserveAspectRatio="none"
                            />
                          </svg>
                        </g>
                      );
                    }

                    if (config.renderType === 'image') {
                      const isShoeTool = config.type === 'Shoe' || effectiveType.toLowerCase().includes('shoe') || effectiveType.toLowerCase().includes('sabot');
                      const drawHeight = Math.max(config.minHeight || 15, height) + (isShoeTool ? 2 : 0);
                      const renderYTop = isShoeTool ? yTop - 2 : yTop;
                      const scale = config.printScale || 0.25;
                      const { width: vbW, height: vbH } = parseViewBoxSize(config.viewBox);
                      const imgWidth = vbW * scale;
                      const imgX = xCenter - (vbW * 0.4) * scale;
                      return (
                        <g key={`blueprint-img-${tool.id}`}>
                          <svg
                            x={imgX}
                            y={renderYTop}
                            width={imgWidth}
                            height={drawHeight}
                            viewBox={config.viewBox || "0 0 300 500"}
                            preserveAspectRatio="none"
                          >
                            <image
                              href={config.imageUrl}
                              x="0"
                              y="0"
                              width={vbW}
                              height={vbH}
                              preserveAspectRatio="none"
                              style={config.type === 'Shoe' ? { filter: "brightness(0)" } : undefined}
                            />
                          </svg>
                        </g>
                      );
                    }

                    // Vector drawings for print
                    switch (config.vectorType) {
                      case 'reduction': {
                        return (
                          <g key={`blueprint-reduction-${tool.id}`}>
                            <polygon points={`${xCenter - 6},${yTop} ${xCenter + 6},${yTop} ${xCenter + 4},${yBottom} ${xCenter - 4},${yBottom}`} fill="#cbd5e1" stroke="#000" strokeWidth="1.2" />
                            <line x1={xCenter - 5} y1={yTop} x2={xCenter - 3.8} y2={yBottom} stroke="#000" strokeWidth="0.8" />
                            <line x1={xCenter + 5} y1={yTop} x2={xCenter + 3.8} y2={yBottom} stroke="#000" strokeWidth="0.8" />
                            <polygon points={`${xCenter - 8.5},${yTop + 2} ${xCenter + 8.5},${yTop + 2} ${xCenter},${yBottom - 2}`} fill="none" stroke="#000" strokeWidth="0.8" />
                          </g>
                        );
                      }

                      case 'tailpipe': {
                        return (
                          <g key={`blueprint-tailpipe-${tool.id}`}>
                            <rect x={xCenter - 4} y={yTop} width={8} height={height} fill="#e2e8f0" stroke="#000" strokeWidth="0.8" />
                            <line x1={xCenter - 2} y1={yTop} x2={xCenter - 2} y2={yTop + height} stroke="#000" strokeWidth="0.5" />
                            <line x1={xCenter + 2} y1={yTop} x2={xCenter + 2} y2={yTop + height} stroke="#000" strokeWidth="0.5" />
                            <line x1={xCenter - 4} y1={yTop + height * 0.25} x2={xCenter - 2} y2={yTop + height * 0.25} stroke="#000" strokeWidth="0.8" />
                            <line x1={xCenter + 2} y1={yTop + height * 0.25} x2={xCenter + 4} y2={yTop + height * 0.25} stroke="#000" strokeWidth="0.8" />
                            <line x1={xCenter - 4} y1={yTop + height * 0.5} x2={xCenter - 2} y2={yTop + height * 0.5} stroke="#000" strokeWidth="0.8" />
                            <line x1={xCenter + 2} y1={yTop + height * 0.5} x2={xCenter + 4} y2={yTop + height * 0.5} stroke="#000" strokeWidth="0.8" />
                            <line x1={xCenter - 4} y1={yTop + height * 0.75} x2={xCenter - 2} y2={yTop + height * 0.75} stroke="#000" strokeWidth="0.8" />
                            <line x1={xCenter + 2} y1={yTop + height * 0.75} x2={xCenter + 4} y2={yTop + height * 0.75} stroke="#000" strokeWidth="0.8" />
                          </g>
                        );
                      }

                      case 'anchor-seal': {
                        return (
                          <g key={`blueprint-anchor-${tool.id}`}>
                            <rect x={xCenter - 5.5} y={yTop} width={11} height={height} fill="#e2e8f0" stroke="#000" strokeWidth="0.8" />
                            <rect x={xCenter - 6.5} y={yTop + 1} width={13} height={1.5} fill="#1e293b" stroke="#000" strokeWidth="0.4" />
                            <rect x={xCenter - 6.5} y={yTop + 3.5} width={13} height={1.5} fill="#1e293b" stroke="#000" strokeWidth="0.4" />
                            <g stroke="#000" strokeWidth="0.6" fill="none">
                              <path d={`M ${xCenter - 5.5} ${yTop + 7} L ${xCenter - 4} ${yTop + 8} L ${xCenter - 5.5} ${yTop + 9}`} />
                              <path d={`M ${xCenter + 5.5} ${yTop + 7} L ${xCenter + 4} ${yTop + 8} L ${xCenter + 5.5} ${yTop + 9}`} />
                              <path d={`M ${xCenter - 5.5} ${yTop + 10} L ${xCenter - 4} ${yTop + 11} L ${xCenter - 5.5} ${yTop + 12}`} />
                              <path d={`M ${xCenter + 5.5} ${yTop + 10} L ${xCenter + 4} ${yTop + 11} L ${xCenter + 5.5} ${yTop + 12}`} />
                              <path d={`M ${xCenter - 5.5} ${yTop + 13} L ${xCenter - 4} ${yTop + 14} L ${xCenter - 5.5} ${yTop + 15}`} />
                              <path d={`M ${xCenter + 5.5} ${yTop + 13} L ${xCenter + 4} ${yTop + 14} L ${xCenter + 5.5} ${yTop + 15}`} />
                            </g>
                          </g>
                        );
                      }

                      case 'tubing-court': {
                        return (
                          <g key={`blueprint-court-${tool.id}`}>
                            <rect x={xCenter - 5} y={yTop} width={10} height={height} fill="#e2e8f0" stroke="#000" strokeWidth="0.8" />
                            <rect x={xCenter - 2} y={yTop} width={4} height={height} fill="#000" />
                            <rect x={xCenter - 7} y={yTop} width={14} height={4} fill="#fbbf24" stroke="#000" strokeWidth="0.8" rx="0.5" />
                            <line x1={xCenter - 7} y1={yTop + 2} x2={xCenter + 7} y2={yTop + 2} stroke="#000" strokeWidth="0.5" />
                            <rect x={xCenter - 7} y={yBottom - 4} width={14} height={4} fill="#fbbf24" stroke="#000" strokeWidth="0.8" rx="0.5" />
                            <line x1={xCenter - 7} y1={yBottom - 2} x2={xCenter + 7} y2={yBottom - 2} stroke="#000" strokeWidth="0.5" />
                          </g>
                        );
                      }

                      default: {
                        if (config.type === 'Other' && ((tool.name || '').toLowerCase().includes('olive') || (tool.name || '').toLowerCase().includes('hanger'))) {
                          return (
                            <g key={`blueprint-hanger-${tool.id}`}>
                              <polygon points={`${xCenter - 14},${yTop} ${xCenter + 14},${yTop} ${xCenter + 5},${yBottom} ${xCenter - 5},${yBottom}`} fill="#64748b" stroke="#000" strokeWidth="1" />
                              <rect x={xCenter - 5} y={yTop} width={10} height={height} fill="#ffffff" stroke="#000" strokeWidth="0.8" />
                              <circle cx={xCenter - 9} cy={(yTop + yBottom)/2} r="1.2" fill="#000" />
                              <circle cx={xCenter + 9} cy={(yTop + yBottom)/2} r="1.2" fill="#000" />
                            </g>
                          );
                        }
                        return null;
                      }
                    }
                  })}

                  {/* RESOLVED RIGHT HAND LABELS (Spaced perfectly without overlaps) */}
                  {resolvedLabels.map((label) => {
                    const startY = label.anchorY ?? label.targetY;
                    const endY = label.y;
                    const hasSlant = Math.abs(endY - startY) >= 1;

                    if (label.isDotted) {
                      const lineXEnd = label.lineXEnd ?? 210;
                      const elbowX = lineXEnd - 10;
                      const clearCsgX = Math.max(label.startX + 8, xCenter + 36);
                      const exitX = Math.min(clearCsgX, elbowX - 6);

                      return (
                        <g key={`resolved-label-${label.id}`}>
                          {hasSlant ? (
                            <path
                              d={`M ${label.startX} ${startY} H ${exitX} L ${elbowX} ${endY} H ${lineXEnd}`}
                              fill="none"
                              stroke="#475569"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                          ) : (
                            <line
                              x1={label.startX}
                              y1={startY}
                              x2={lineXEnd}
                              y2={startY}
                              stroke="#475569"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                          )}
                          {label.renderText(endY)}
                        </g>
                      );
                    }

                    const lineXEnd = label.isSpecial ? 214 : 238;
                    const elbowX = lineXEnd - 10;
                    const clearCsgX = Math.max(label.startX + 8, xCenter + 36);
                    const exitX = Math.min(clearCsgX, elbowX - 6);
                    return (
                      <g key={`resolved-label-${label.id}`}>
                        {hasSlant ? (
                          <path
                            d={`M ${label.startX} ${startY} H ${exitX} L ${elbowX} ${endY} H ${lineXEnd}`}
                            fill="none"
                            stroke="#000"
                            strokeWidth="0.8"
                            markerStart={label.markerStart}
                          />
                        ) : (
                          <path
                            d={`M ${label.startX} ${startY} H ${lineXEnd}`}
                            fill="none"
                            stroke="#000"
                            strokeWidth="0.8"
                            markerStart={label.markerStart}
                          />
                        )}
                        {label.renderText(endY)}
                      </g>
                    );
                  })}

                  {/* CEMENT PLUGS (B.C — Bouchon de Ciment) */}
                  {(well.cementPlugs || []).map((cp: CementPlug, cpIdx: number) => {
                    const yTop = mapDepthToY(cp.topDepth);
                    const yBot = mapDepthToY(cp.bottomDepth);
                    const plugHeight = Math.max(0, yBot - yTop);
                    if (plugHeight <= 0) return null;
                    const plugMidDepth = (cp.topDepth + cp.bottomDepth) / 2;
                    const plugCasingR = activeCasingRadius(well, layout?.casings || [], plugMidDepth);
                    const labelLineX = xCenter + plugCasingR + 4;
                    const labelTextX = labelLineX + 16;

                    return (
                      <g key={cp.id || `bc-print-${cpIdx}`}>
                        {/* Cement fill */}
                        <rect
                          x={xCenter - plugCasingR}
                          y={yTop}
                          width={plugCasingR * 2}
                          height={plugHeight}
                          fill="url(#slurry-diagonal)"
                          stroke="#94a3b8"
                          strokeWidth="0.75"
                          opacity="0.92"
                        />
                        {/* Top ciment label — above the line */}
                        <line x1={labelLineX} y1={yTop} x2={labelLineX + 14} y2={yTop} stroke="#475569" strokeWidth="1" />
                        <rect x={labelTextX - 2} y={yTop - 14} width={105} height={12} fill="white" opacity="0.9" rx="1.5" />
                        <text
                          x={labelTextX}
                          y={yTop - 4}
                          fontSize="10"
                          fill="#0f172a"
                          fontFamily="monospace"
                          fontWeight="700"
                        >
                          Top ciment à {cp.topDepth}m
                        </text>
                        {/* B.C label — below the bottom line */}
                        <line x1={labelLineX} y1={yBot} x2={labelLineX + 14} y2={yBot} stroke="#475569" strokeWidth="1" />
                        <rect x={labelTextX - 2} y={yBot + 3} width={90} height={12} fill="white" opacity="0.9" rx="1.5" />
                        <text
                          x={labelTextX}
                          y={yBot + 12}
                          fontSize="10"
                          fill="#0f172a"
                          fontFamily="monospace"
                          fontWeight="700"
                        >
                          B.C à {cp.bottomDepth}m
                        </text>
                      </g>
                    );
                  })}

                  {/* PERFORATIONS — Grouped by Reservoir & Status */}
                  {well.perforations && well.perforations.length > 0 && (() => {
                    const groupsMap = new Map<string, typeof well.perforations>();
                    well.perforations.forEach(p => {
                      const res = p.reservoir || well.reservoir || '';
                      const key = `${res}_${p.isSqueezed ? 'sqz' : 'act'}`;
                      if (!groupsMap.has(key)) {
                        groupsMap.set(key, []);
                      }
                      groupsMap.get(key)!.push(p);
                    });

                    return Array.from(groupsMap.entries()).map(([key, groupPerfs], gIdx) => {
                      const isSqueezed = !!groupPerfs[0]?.isSqueezed;
                      const resName = groupPerfs[0]?.reservoir || well.reservoir || '';
                      const topD = Math.min(...groupPerfs.map(p => Math.min(p.topDepth || 0, p.bottomDepth || 0)));
                      const bottomD = Math.max(...groupPerfs.map(p => Math.max(p.topDepth || 0, p.bottomDepth || 0)));
                      const yTop = mapDepthToY(topD);
                      const yBottom = mapDepthToY(bottomD);
                      const height = Math.max(0, yBottom - yTop);
                      const span = bottomD - topD;

                      // Compute active casing radius at perforation mid-depth
                      const perfMidDepth = (topD + bottomD) / 2;
                      const coveringCasings = printCasingsData.filter(cd => {
                        const top = cd.casing.topDepth || 0;
                        const shoe = cd.casing.shoeDepth || 0;
                        return perfMidDepth >= top && perfMidDepth <= shoe;
                      });
                      let perfCsgR = printCasingsData.length > 0
                        ? Math.min(...printCasingsData.map(cd => cd.csgR))
                        : 11;
                      if (coveringCasings.length > 0) {
                        coveringCasings.sort((a, b) => a.csgR - b.csgR);
                        perfCsgR = coveringCasings[0].csgR;
                      }
                      const arrowOuter = perfCsgR + 16;
                      const arrowTip   = arrowOuter + 4;

                      // Use exactly 3 conics for clean schematic rendering
                      const shotsCount = 3;
                      const perfRows: number[] = [];
                      for (let k = 0; k < shotsCount; k++) {
                        const depth = topD + (span * (k + 0.5)) / shotsCount;
                        perfRows.push(mapDepthToY(depth));
                      }

                      const textRes = resName ? ` ${resName}` : '';
                      const midY = (yTop + yBottom) / 2;

                      const conicFill = isSqueezed ? '#475569' : '#dc2626';
                      const conicStroke = isSqueezed ? '#0f172a' : '#991b1b';
                      const bgFill = isSqueezed ? '#94a3b8' : '#dc2626';
                      const bracketColor = isSqueezed ? '#334155' : '#c41230';
                      const textColor = isSqueezed ? '#1e293b' : '#c41230';

                      return (
                        <g key={`print-perf-group-${gIdx}`}>
                          {/* Perforation formation side highlights — strictly outside casing */}
                          {/* RED ARROWS: Cement block behind casing for squeezed perforations */}
                          <rect
                            x={xCenter - arrowOuter}
                            y={yTop}
                            width={arrowOuter - perfCsgR}
                            height={height || 2}
                            fill={isSqueezed ? "#94a3b8" : bgFill}
                            stroke={isSqueezed ? "#475569" : "none"}
                            strokeWidth={isSqueezed ? "0.6" : "0"}
                            strokeDasharray={isSqueezed ? "2,2" : "none"}
                            opacity={isSqueezed ? "0.35" : "0.08"}
                          />
                          <rect
                            x={xCenter + perfCsgR}
                            y={yTop}
                            width={arrowOuter - perfCsgR}
                            height={height || 2}
                            fill={isSqueezed ? "#94a3b8" : bgFill}
                            stroke={isSqueezed ? "#475569" : "none"}
                            strokeWidth={isSqueezed ? "0.6" : "0"}
                            strokeDasharray={isSqueezed ? "2,2" : "none"}
                            opacity={isSqueezed ? "0.35" : "0.08"}
                          />

                          {/* RED ARROWS ZONE: Squeezed cement diagonal hatch texture in formation */}
                          {isSqueezed && (
                            <g opacity="0.3">
                              <line x1={xCenter - arrowOuter + 1} y1={yTop + 1} x2={xCenter - perfCsgR - 1} y2={yBottom - 1} stroke="#1e293b" strokeWidth="0.6" strokeDasharray="2,2" />
                              <line x1={xCenter + perfCsgR + 1} y1={yTop + 1} x2={xCenter + arrowOuter - 1} y2={yBottom - 1} stroke="#1e293b" strokeWidth="0.6" strokeDasharray="2,2" />
                            </g>
                          )}

                          {/* Conic jets — base at casing wall (green arrows), tip pointing outward */}
                          {perfRows.map((yVal, rIdx) => {
                            return (
                              <g key={`shot-${rIdx}`}>
                                {isSqueezed ? (
                                  <>
                                    {/* GREEN ARROWS: Dark gray square plug in casing cement sheath */}
                                    <rect
                                      x={xCenter - arrowOuter}
                                      y={yVal - 3}
                                      width={arrowOuter - perfCsgR}
                                      height={6}
                                      fill="#1e293b"
                                      stroke="#0f172a"
                                      strokeWidth="0.6"
                                      rx="0.5"
                                    />
                                    {/* Left Squeezed Cone — Starts at end of casing cement */}
                                    <polygon
                                      points={`${xCenter - arrowOuter},${yVal - 4} ${xCenter - arrowOuter},${yVal + 4} ${xCenter - (arrowOuter + 8)},${yVal}`}
                                      fill="#475569"
                                      stroke="#0f172a"
                                      strokeWidth="0.8"
                                      strokeLinejoin="round"
                                    />
                                    {/* White cement hatch lines inside left cone */}
                                    <line x1={xCenter - arrowOuter - 2} y1={yVal - 2} x2={xCenter - arrowOuter - 5} y2={yVal + 1} stroke="#ffffff" strokeWidth="0.8" />

                                    {/* GREEN ARROWS: Dark gray square plug in casing cement sheath */}
                                    <rect
                                      x={xCenter + perfCsgR}
                                      y={yVal - 3}
                                      width={arrowOuter - perfCsgR}
                                      height={6}
                                      fill="#1e293b"
                                      stroke="#0f172a"
                                      strokeWidth="0.6"
                                      rx="0.5"
                                    />
                                    {/* Right Squeezed Cone — Starts at end of casing cement */}
                                    <polygon
                                      points={`${xCenter + arrowOuter},${yVal - 4} ${xCenter + arrowOuter},${yVal + 4} ${xCenter + (arrowOuter + 8)},${yVal}`}
                                      fill="#475569"
                                      stroke="#0f172a"
                                      strokeWidth="0.8"
                                      strokeLinejoin="round"
                                    />
                                    {/* White cement hatch lines inside right cone */}
                                    <line x1={xCenter + arrowOuter + 2} y1={yVal - 2} x2={xCenter + arrowOuter + 5} y2={yVal + 1} stroke="#ffffff" strokeWidth="0.8" />
                                  </>
                                ) : (
                                  <>
                                    {/* ACTIVE DESIGN: Clean red conic jet */}
                                    <polygon
                                      points={`${xCenter - perfCsgR},${yVal - 4} ${xCenter - perfCsgR},${yVal + 4} ${xCenter - arrowTip},${yVal}`}
                                      fill={conicFill}
                                      stroke={conicStroke}
                                      strokeWidth="0.6"
                                      strokeLinejoin="round"
                                    />
                                    <polygon
                                      points={`${xCenter + perfCsgR},${yVal - 4} ${xCenter + perfCsgR},${yVal + 4} ${xCenter + arrowTip},${yVal}`}
                                      fill={conicFill}
                                      stroke={conicStroke}
                                      strokeWidth="0.6"
                                      strokeLinejoin="round"
                                    />
                                  </>
                                )}
                              </g>
                            );
                          })}

                          {/* Bracket & Label for perforation depth zone (matches Coupe schématique du puits) */}
                          <g>
                            <line x1={xCenter + arrowTip + 3} y1={yTop} x2={xCenter + arrowTip + 18} y2={yTop} stroke={bracketColor} strokeWidth="1" />
                            <line x1={xCenter + arrowTip + 3} y1={yBottom} x2={xCenter + arrowTip + 18} y2={yBottom} stroke={bracketColor} strokeWidth="1" />
                            <line x1={xCenter + arrowTip + 18} y1={yTop} x2={xCenter + arrowTip + 18} y2={yBottom} stroke={bracketColor} strokeWidth="1" />

                            <text x={xCenter + arrowTip + 22} y={midY - 2} fontSize="9.5" fill={textColor} fontWeight="bold" className="font-mono">
                              {isSqueezed ? 'PRF (SQZ):' : 'PRF:'}
                            </text>
                            <text x={xCenter + arrowTip + 22} y={midY + 9} fontSize="9.5" fill={textColor} fontWeight="bold" className="font-mono">
                              {formatDepth(topD)} - {formatDepth(bottomD)}m{textRes}
                            </text>
                          </g>
                        </g>
                      );
                    });
                  })()}

                  {/* ACTIVE LINER CRÉPINES (Screens - Unified Single Continuous String) */}
                  {(() => {
                    const validCrepines = (well.linerCrepines || []).filter(
                      (lc) => (lc.topDepth !== undefined && lc.topDepth !== null && lc.topDepth > 0) ||
                              (lc.bottomDepth !== undefined && lc.bottomDepth !== null && lc.bottomDepth > 0)
                    );
                    if (validCrepines.length === 0) return null;

                    const topD = Math.min(...validCrepines.map((lc) => lc.topDepth || 0));
                    const botD = Math.max(...validCrepines.map((lc) => lc.bottomDepth || 0));
                    const yTop = mapDepthToY(topD);
                    const yBot = mapDepthToY(botD);
                    const height = Math.max(0, yBot - yTop);
                    if (height <= 0) return null;

                    const midDepth = (topD + botD) / 2;
                    const coveringCasings = printCasingsData.filter(cd => {
                      const top = cd.casing.topDepth || 0;
                      const shoe = cd.casing.shoeDepth || 0;
                      return midDepth >= top && midDepth <= shoe;
                    });
                    let csgR = printCasingsData.length > 0
                      ? Math.min(...printCasingsData.map(cd => cd.csgR))
                      : 11;
                    if (coveringCasings.length > 0) {
                      coveringCasings.sort((a, b) => a.csgR - b.csgR);
                      csgR = coveringCasings[0].csgR;
                    }
                    const screenR = Math.max(7, csgR - 1);
                    const midY = (yTop + yBot) / 2;
                    const offsetH = 222;
                    const textX = offsetH + 8;
                    const svgWidth = screenR * 2;
                    const svgX = xCenter - screenR;

                    return (
                      <g key="print-liner-crepine-unified">
                        {/* Crépine SVG Asset (Continuous string) */}
                        <image
                          href="/img/crépines.svg"
                          x={svgX}
                          y={yTop}
                          width={svgWidth}
                          height={height}
                          preserveAspectRatio="none"
                        />

                        {/* Bracket and Screen depth label */}
                        <g>
                          <path
                            d={`M ${xCenter + screenR + 3} ${yTop} H ${offsetH} M ${xCenter + screenR + 3} ${yBot} H ${offsetH} M ${offsetH} ${yTop} V ${yBot} M ${offsetH} ${midY} H ${offsetH + 5}`}
                            fill="none"
                            stroke="#0284c7"
                            strokeWidth="1"
                          />
                          <text x={textX} y={midY - 2} textAnchor="start" fontSize="10" fontWeight="bold" fill="#0369a1" className="font-mono tracking-tighter">
                            CRÉPINE:
                          </text>
                          <text x={textX} y={midY + 10} textAnchor="start" fontSize="10" fontWeight="bold" fill="#0284c7" className="font-mono tracking-tighter">
                            De {formatDepth(topD)} - A {formatDepth(botD)}
                          </text>
                        </g>
                      </g>
                    );
                  })()}

                </svg>
              </div>

              {/* V. SIGNATURES AND OFFICIAL RELEASES BLOCK */}
              <div className="border border-black border-solid p-2 shrink-0 bg-white flex flex-col text-[11px] leading-tight text-black" id="print_signatures_block">
                <div className="flex flex-col space-y-0.5 font-mono">
                  <div>Annule le folio N°: <span className="font-bold">{well.folioToCancel || '01'}</span></div>
                  <div>Mis à jour le : <span className="font-bold">{well.updatedDate ? new Date(well.updatedDate).toLocaleDateString('fr-FR') : (well.updatedAt ? new Date(well.updatedAt).toLocaleDateString('fr-FR') : '')}</span></div>
                  <div>Fin opération le : <span className="font-bold">{well.endOperationDate ? new Date(well.endOperationDate).toLocaleDateString('fr-FR') : '19/02/2007'}</span></div>
                </div>
                <div className="mt-2 pt-1 pb-8 border-t border-black border-solid flex justify-start">
                  <div className="font-serif italic font-bold text-black">Vu {well.vuBy || 'A.HALIM'}</div>
                </div>
              </div>

            </div>
          </div>

          {/* BLUEPRINT FOOTER BAR */}
          <div className="w-full mt-2 pt-2 border-t border-slate-300 flex items-end justify-between text-[9.5px] text-slate-500 shrink-0 font-mono" id="a4_page_footer">
            <div className="flex flex-col items-start leading-tight">
              <span className="font-bold text-slate-700 text-[8.5px] tracking-wide">
                &copy; {new Date().getFullYear()} OULEDHAIMOUDA Abdelhalim
              </span>
              <span className="text-[7px] text-slate-400 font-medium tracking-widest mt-[1px]">
                v{packageJson.version}
              </span>
            </div>
            <span className="font-bold text-black mb-[1px]">
              {(() => {
                let userStr = "A. HALIM";
                try {
                  const stored = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
                  if (stored) {
                    const u = JSON.parse(stored);
                    if (u && u.nom_prenom) userStr = u.nom_prenom;
                  }
                } catch {
                  /* ignore */
                }
                const nowStr = new Date().toLocaleString('fr-FR', {
                  timeZone: 'Africa/Algiers',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                return `Imprimé par : ${userStr} — Le : ${nowStr}`;
              })()}
            </span>
          </div>

        </div>
      </div>
    </div>
  </div>
</div>
  );
}
