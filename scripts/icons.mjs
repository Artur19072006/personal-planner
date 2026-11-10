import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../assets/branding/planner-icon-v2-source.png', import.meta.url));
for (const [name, size] of [
  ['planner-icon-v2-192.png', 192],
  ['planner-icon-v2-512.png', 512],
  ['planner-icon-v2-maskable-512.png', 512],
  ['planner-apple-touch-v2-180.png', 180],
  ['planner-brand-v2-64.png', 64],
  ['planner-brand-v2-128.png', 128],
  ['planner-favicon-v2-32.png', 32],
]) {
  await sharp(source).resize(size, size, { fit: 'contain' }).png({ compressionLevel: 9, palette: true, quality: 100 }).toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url)));
}
