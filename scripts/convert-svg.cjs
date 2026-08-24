const fs = require('fs');
const path = require('path');

const bmpPath = path.join('C:', 'Users', 'islam', 'Downloads', 'wellbore-schematic-pro (1)', 'scripts', 'extracted_ico_32x32_1.bmp');
const svgPath = path.join('C:', 'Users', 'islam', 'Downloads', 'wellbore-schematic-pro (1)', 'public', 'logo.svg');

if (!fs.existsSync(bmpPath)) {
  console.error("BMP file not found!");
  process.exit(1);
}

const buf = fs.readFileSync(bmpPath);
const pixelOffset = buf.readUInt32LE(10);
const width = buf.readInt32LE(18);
const height = buf.readInt32LE(22);
const bpp = buf.readUInt16LE(28);

console.log(`Processing: ${width}x${height}, ${bpp} bpp`);

// We want to generate an SVG representing this image.
// We will output a <rect> for each colored, non-transparent pixel.
// To optimize, we can merge consecutive horizontal pixels of the same color into a single <rect>.

let svgElements = [];
const bytesPerPixel = bpp / 8;

for (let y = height - 1; y >= 0; y--) {
  // BMP rows are bottom-to-top, but we want SVG coordinates top-to-bottom.
  // SVG y coordinate will be (height - 1 - y)
  const svgY = height - 1 - y;
  
  let currentRect = null;
  
  for (let x = 0; x < width; x++) {
    const pixelIdx = pixelOffset + (y * width + x) * bytesPerPixel;
    if (pixelIdx >= buf.length - 4) continue;
    
    const b = buf[pixelIdx];
    const g = buf[pixelIdx + 1];
    const r = buf[pixelIdx + 2];
    const a = bpp === 32 ? buf[pixelIdx + 3] : 255;
    
    const isTransparent = a < 10; // fully or mostly transparent
    const isWhite = r > 245 && g > 245 && b > 245; // background white
    
    // We only care about non-transparent, non-white pixels
    const hexColor = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    
    if (isTransparent || isWhite) {
      if (currentRect) {
        svgElements.push(currentRect);
        currentRect = null;
      }
    } else {
      if (currentRect && currentRect.color === hexColor) {
        currentRect.w++;
      } else {
        if (currentRect) {
          svgElements.push(currentRect);
        }
        currentRect = { x, y: svgY, w: 1, h: 1, color: hexColor };
      }
    }
  }
  if (currentRect) {
    svgElements.push(currentRect);
  }
}

// Write the SVG file
let svgContent = `<svg viewBox="0 0 ${width} ${width}" xmlns="http://www.w3.org/2000/svg">\n`;
svgElements.forEach(r => {
  svgContent += `  <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" />\n`;
});
svgContent += `</svg>\n`;

fs.writeFileSync(svgPath, svgContent);
console.log(`Saved SVG vector logo to: ${svgPath}`);
console.log(`Total rect elements: ${svgElements.length}`);
