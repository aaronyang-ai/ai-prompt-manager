const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'assets', 'icons');
const svgPath = path.join(iconsDir, 'icon.svg');
const svgContent = fs.readFileSync(svgPath);

const sizes = [16, 48, 128];

async function generateIcons() {
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon${size}.png`);
    await sharp(svgContent)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon${size}.png`);
  }
  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
