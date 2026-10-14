import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));

writeFileSync(
  path.join(publicDir, 'version.json'),
  JSON.stringify({ version: pkg.version }, null, 2) + '\n'
);

console.log(`public/version.json synced to ${pkg.version}`);

// Geef elk icoon in het manifest een vingerafdruk van zijn inhoud (?v=...).
// Verandert een icoon, dan verandert ook het manifest, zodat Chrome het
// icoon van de geïnstalleerde app bijwerkt. Ongewijzigde iconen houden
// dezelfde URL.
const manifestPath = path.join(publicDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
for (const icon of manifest.icons ?? []) {
  const [src] = icon.src.split('?');
  const file = path.join(publicDir, path.basename(src));
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);
  icon.src = `${src}?v=${hash}`;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log('public/manifest.json icon URLs fingerprinted');
