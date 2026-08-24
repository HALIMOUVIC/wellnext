const fs = require('fs');
const path = require('path');

const bmpPath = path.join('C:', 'Users', 'islam', 'Downloads', 'wellbore-schematic-pro (1)', 'scripts', 'extracted_ico_32x32_1.bmp');

if (!fs.existsSync(bmpPath)) {
  console.error("BMP file not found!");
  process.exit(1);
}

const buf = fs.readFileSync(bmpPath);

// A standard BMP file header is 14 bytes.
// The DIB header starts at 14. We can get the pixel offset from offset 10 (4 bytes).
const pixelOffset = buf.readUInt32LE(10);
const width = buf.readInt32LE(18);
const height = buf.readInt32LE(22);
const bpp = buf.readUInt16LE(28);

console.log(`BMP Info: ${width}x${height}, ${bpp} bpp, pixelOffset: ${pixelOffset}`);

// For a 32x32 32bpp BMP, each pixel is 4 bytes (BGRA or BGR0).
// In BMP, rows are stored bottom-to-top.
for (let y = height - 1; y >= 0; y--) {
  let line = '';
  for (let x = 0; x < width; x++) {
    const pixelIdx = pixelOffset + (y * width + x) * (bpp / 8);
    if (pixelIdx >= buf.length - 4) {
      line += ' ';
      continue;
    }
    const b = buf[pixelIdx];
    const g = buf[pixelIdx + 1];
    const r = buf[pixelIdx + 2];
    const a = bpp === 32 ? buf[pixelIdx + 3] : 255;
    
    // Check if the pixel is transparent or near-white
    const isTransparent = a < 50;
    const isWhite = r > 240 && g > 240 && b > 240;
    const isDark = r < 50 && g < 50 && b < 50;
    
    if (isTransparent || isWhite) {
      line += '  '; // Empty space
    } else if (isDark) {
      line += '██'; // Dark fill
    } else {
      line += '▒▒'; // Colored/Gray fill
    }
  }
  console.log(line);
}
