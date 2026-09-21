import { readFileSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  base: '/tafelkampioen/',
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // Set DISABLE_HMR=true to turn off hot module reload, e.g. to avoid
    // flickering while an external tool is editing files.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
