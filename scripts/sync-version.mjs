import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));

writeFileSync(
  path.resolve(__dirname, '../public/version.json'),
  JSON.stringify({ version: pkg.version }, null, 2) + '\n'
);

console.log(`public/version.json synced to ${pkg.version}`);
