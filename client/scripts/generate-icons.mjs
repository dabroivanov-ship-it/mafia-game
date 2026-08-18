import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'icon.svg');
const svg = fs.readFileSync(svgPath);

const sizes = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'favicon-32x32.png', size: 32 },
];

for (const { name, size } of sizes) {
  await sharp(svg).resize(size, size).png().toFile(path.join(publicDir, name));
  console.log(`Created ${name}`);
}

await sharp(svg).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.ico'));

const ogWidth = 1200;
const ogHeight = 630;
const ogIconSize = 280;
const ogIcon = await sharp(svg).resize(ogIconSize, ogIconSize).png().toBuffer();
await sharp({
  create: {
    width: ogWidth,
    height: ogHeight,
    channels: 3,
    background: { r: 15, g: 17, b: 23 },
  },
})
  .composite([
    {
      input: ogIcon,
      top: Math.round((ogHeight - ogIconSize) / 2),
      left: Math.round((ogWidth - ogIconSize) / 2),
    },
  ])
  .png()
  .toFile(path.join(publicDir, 'og-image.png'));
console.log('Created og-image.png');
