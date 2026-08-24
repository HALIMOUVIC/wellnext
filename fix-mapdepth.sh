#!/bin/bash
# For WellboreSchematic.tsx
sed -i 's/const mapDepthToY = (depth: number): number => {/const mapDepthToY = (depth: number | string): number => {\n    const numDepth = typeof depth === "string" ? parseFloat(depth) : depth;\n    if (isNaN(numDepth)) return 40;\n    depth = numDepth;/g' src/components/WellboreSchematic.tsx

# For WellboreA4Print.tsx
sed -i 's/const mapDepthToY = (depth: number): number => {/const mapDepthToY = (depth: number | string): number => {\n    const numDepth = typeof depth === "string" ? parseFloat(depth) : depth;\n    if (isNaN(numDepth)) return 50;\n    depth = numDepth;/g' src/components/WellboreA4Print.tsx
