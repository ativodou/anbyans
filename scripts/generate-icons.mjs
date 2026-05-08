/**
 * PWA Icon Generator for Anbyans
 *
 * Usage:
 *   node scripts/generate-icons.mjs [source-image]
 *
 * If no source image is provided, defaults to apps/web/public/logo.jpg
 *
 * Requires: npm install sharp -D  (run from the monorepo root)
 */

import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'apps/web/public/icons');
const SOURCE = process.argv[2] ?? resolve(ROOT, 'apps/web/public/logo.jpg');

const THEME = '#0D9488';
const BG = '#0A1628';

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

if (!existsSync(SOURCE)) {
  console.error(`Source image not found: ${SOURCE}`);
  console.error('Provide a square PNG/JPG (1024×1024 recommended) as argument.');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

async function generateRegular(size) {
  await sharp(SOURCE)
    .resize(size, size, { fit: 'contain', background: BG })
    .png()
    .toFile(resolve(OUT_DIR, `icon-${size}x${size}.png`));
  console.log(`  ✓ icon-${size}x${size}.png`);
}

// Maskable icons: logo fills 80% safe zone, themed background fills the rest
async function generateMaskable(size) {
  const innerSize = Math.round(size * 0.8);
  const padding = Math.round((size - innerSize) / 2);

  const inner = await sharp(SOURCE)
    .resize(innerSize, innerSize, { fit: 'contain', background: THEME })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: THEME },
  })
    .composite([{ input: inner, top: padding, left: padding }])
    .png()
    .toFile(resolve(OUT_DIR, `icon-maskable-${size}x${size}.png`));
  console.log(`  ✓ icon-maskable-${size}x${size}.png`);
}

console.log(`\nGenerating icons from: ${SOURCE}`);
console.log(`Output directory: ${OUT_DIR}\n`);

await Promise.all([
  ...SIZES.map(generateRegular),
  ...MASKABLE_SIZES.map(generateMaskable),
]);

console.log('\nDone. All icons generated successfully.');
console.log('\nNext steps:');
console.log('  1. Add screenshots to apps/web/public/screenshots/');
console.log('     - screen-narrow-1.png (1080×1920)');
console.log('     - screen-narrow-2.png (1080×1920)');
console.log('  2. Deploy to https://anbyans.events');
console.log('  3. Run Lighthouse PWA audit to verify installability');
console.log('  4. Use https://www.pwabuilder.com to package for Google Play');
console.log('  5. Fill in .well-known/assetlinks.json with your Play Console SHA-256 fingerprint');
