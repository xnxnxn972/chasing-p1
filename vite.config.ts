import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the built app works on GitHub Pages subpaths.
  base: './',
  plugins: [react()],
  server: { port: 5174, host: true }
});
