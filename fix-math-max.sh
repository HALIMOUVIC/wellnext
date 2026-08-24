#!/bin/bash
sed -i 's/\.map((t) => t.bottomDepth || 0)/\.map((t) => typeof t.bottomDepth === "string" ? parseFloat(t.bottomDepth || "0") : (t.bottomDepth || 0)).filter(v => !isNaN(v))/g' src/components/WellboreSchematic.tsx
sed -i 's/Math.max(...depths, 100)/Math.max(...depths.map(d => typeof d === "string" ? parseFloat(d) : d).filter(d => !isNaN(d)), 100)/g' src/components/WellboreSchematic.tsx
