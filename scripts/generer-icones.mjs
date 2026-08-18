import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('./icone.svg', import.meta.url));

await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');

// Variante « maskable » : Android recadre l'icône en cercle ou en losange.
// Le contenu doit tenir dans les 80 % centraux, d'où le pochoir à 320 px sur 512.
const coeur = await sharp(svg).resize(320, 320).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#1c1917' },
})
  .composite([{ input: coeur, gravity: 'center' }])
  .png()
  .toFile('public/pwa-512-maskable.png');

console.log('Icônes générées dans public/');
