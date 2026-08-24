#!/bin/bash
sed -i 's/Math.max(...well.tubings.filter(t => t.name).map((t) => t.bottomDepth))/(well.tubings.filter(t => t.name).length > 0 ? Math.max(...well.tubings.filter(t => t.name).map((t) => t.bottomDepth || 0)) : 0)/g' src/components/WellboreSchematic.tsx
