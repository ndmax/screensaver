import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig, type Plugin} from 'vite';

const root = resolve(import.meta.dirname, 'src');

/** Copy MediaPipe's WebAssembly runtime (used by face detection) into the build. */
function mediapipeWasm(): Plugin {
  const dir = resolve(import.meta.dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
  return {
    name: 'mediapipe-wasm',
    generateBundle() {
      for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
        this.emitFile({type: 'asset', fileName: `mediapipe/wasm/${file}`, source: readFileSync(resolve(dir, file))});
      }
    },
  };
}

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
  plugins: [mediapipeWasm()],
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
