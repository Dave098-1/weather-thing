import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the site works from a sub-folder,
  // e.g. https://<user>.github.io/weather-thing/
  base: './',
  build: {
    // The 3D globe (three.js) is a separate chunk that only loads when opened.
    chunkSizeWarningLimit: 700,
  },
});
