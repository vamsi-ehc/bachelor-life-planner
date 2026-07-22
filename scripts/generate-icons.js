import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, 'icon-source.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const { file, size } of targets) {
    await sharp(svgPath).resize(size, size).png().toFile(path.join(outDir, file));
  }
  console.log(`Generated ${targets.length} icons in ${outDir}`);
}

main();
