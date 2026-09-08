import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webConfig from './vite.static.config.ts';

// Same application and engine; only the delivery format changes.
export default mergeConfig(
  { ...webConfig, plugins: [react()] },
  defineConfig({
    base: './',
    build: {
      outDir: 'dist/standalone',
      cssCodeSplit: false,
      rolldownOptions: { output: { codeSplitting: false } },
    },
  }),
);
