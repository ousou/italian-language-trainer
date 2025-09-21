import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig(({ command }) => ({
  root: '.',
  base: command === 'build' ? '/italian-language-trainer/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    target: 'esnext'
  }
}));
