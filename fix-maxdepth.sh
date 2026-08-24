#!/bin/bash
sed -i 's/return depths.length > 0 ? Math.max(...depths, 100) : 2100;/const validDepths = depths.filter(d => typeof d === "number" \&\& !isNaN(d));\n    return validDepths.length > 0 ? Math.max(...validDepths, 100) : 2100;/g' src/components/WellboreA4Print.tsx
