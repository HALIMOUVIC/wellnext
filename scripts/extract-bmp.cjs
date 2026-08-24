const fs = require('fs');
const path = require('path');

const icoPath = path.join('C:', 'Users', 'islam', 'Downloads', 'wellbore-schematic-pro (1)', 'wellborePro.ico');
const outputDir = path.join(__dirname);

const buf = fs.readFileSync(icoPath);

// Read ICO header
const numImages = buf.readUInt16LE(4);
console.log(`Number of images: ${numImages}`);

for (let i = 0; i < numImages; i++) {
  const entryOffset = 6 + i * 16;
  const width = buf[entryOffset] || 256;
  const height = buf[entryOffset + 1] || 256;
  const size = buf.readUInt32LE(entryOffset + 8);
  const offset = buf.readUInt32LE(entryOffset + 12);
  
  console.log(`Image #${i}: ${width}x${height}, size: ${size} bytes, offset: ${offset}`);
  
  // Extract DIB data
  const dib = buf.subarray(offset, offset + size);
  
  // In an ICO, the height in the BITMAPINFOHEADER is doubled because of the AND mask.
  // Let's create a BITMAPFILEHEADER (14 bytes)
  const fileHeader = Buffer.alloc(14);
  fileHeader.write('BM', 0); // Signature
  fileHeader.writeUInt32LE(14 + size, 2); // File size
  
  // The offset to pixel data is 14 + headerSize (usually 40) + colorTableSize.
  // Let's read the header size from DIB:
  const headerSize = dib.readUInt32LE(0);
  const numColors = dib.readUInt32LE(32);
  const bpp = dib.readUInt16LE(14);
  
  let colorTableSize = 0;
  if (bpp <= 8) {
    colorTableSize = (numColors || (1 << bpp)) * 4;
  }
  
  const pixelOffset = 14 + headerSize + colorTableSize;
  fileHeader.writeUInt32LE(pixelOffset, 10);
  
  // We can write it out as a bmp, but we need to fix the height inside the DIB header
  // (divide it by 2). The height is at offset 8 of DIB, 4 bytes.
  const dibCopy = Buffer.from(dib);
  const originalBmpHeight = dibCopy.readInt32LE(8);
  dibCopy.writeInt32LE(originalBmpHeight / 2, 8);
  
  const bmpData = Buffer.concat([fileHeader, dibCopy]);
  const outPath = path.join(outputDir, `extracted_ico_${width}x${height}_${i}.bmp`);
  fs.writeFileSync(outPath, bmpData);
  console.log(`Saved bmp to: ${outPath}`);
}
