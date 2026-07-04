// Rasterizes public/icons/icon.svg into the PNG sizes the manifest and iOS
// need. Run once via `npm run icons` (output is committed, so builds don't
// depend on this).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, '..', 'public', 'icons');
const svg = readFileSync(join(iconsDir, 'icon.svg'));

// Maskable icons need the artwork inside the central 80% "safe zone", so pad
// the base art on a solid background.
async function maskable(size, out) {
  const inner = Math.round(size * 0.72);
  const art = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: '#0f1e17' },
  })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toFile(join(iconsDir, out));
}

await sharp(svg).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(join(iconsDir, 'icon-512.png'));
await sharp(svg).resize(180, 180).flatten({ background: '#0f1e17' }).png()
  .toFile(join(iconsDir, 'apple-touch-icon.png'));
await maskable(512, 'maskable-512.png');
console.log('icons generated');
