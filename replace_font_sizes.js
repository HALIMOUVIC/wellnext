const fs = require('fs');

const file = 'src/components/WellboreA4Print.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Replace text-[Xpx] with text-[X+2px]
content = content.replace(/text-\[([0-9.]+)px\]/g, (match, p1) => {
    const newSize = parseFloat(p1) + 2;
    return `text-[${newSize}px]`;
});

// Replace fontSize="X" with fontSize="X+2"
// (we don't want to change large sizes like fontSize="34" too much, maybe just add 2 to sizes < 15)
content = content.replace(/fontSize="([0-9.]+)"/g, (match, p1) => {
    const size = parseFloat(p1);
    if (size < 20) {
        return `fontSize="${size + 2}"`;
    }
    return match;
});

fs.writeFileSync(file, content);
console.log('Font sizes increased');
