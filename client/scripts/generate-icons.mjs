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
