import {resolve} from 'node:path';
import {defineConfig} from 'vite';

const root = resolve(import.meta.dirname, 'src');

/**
 * Builds the extension into dist/.
 *
 * - The service worker is emitted at a fixed path (background.js) so the
 *   manifest can reference it; it is loaded as an ES module.
 * - Extension pages are plain multi-page HTML entries.
 * - public/ (manifest, _locales, images) is copied verbatim.
 */
export default defineConfig(({mode}) => ({
  root,
  publicDir: resolve(import.meta.dirname, 'public'),
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome120',
    minify: mode !== 'development',
    sourcemap: mode === 'development' ? 'inline' : false,
    // The modulepreload polyfill touches `document`, which a service worker lacks.
    modulePreload: {polyfill: false},
    rollupOptions: {
      input: {
        background: resolve(root, 'background/index.ts'),
        options: resolve(root, 'options.html'),
        screensaver: resolve(root, 'screensaver.html'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
}));
