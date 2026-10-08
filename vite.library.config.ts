import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const metadata = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  define: {
    __PACKAGE_NAME__: JSON.stringify(metadata.name),
    __PACKAGE_VERSION__: JSON.stringify(metadata.version),
  },
  plugins: [{ name: 'public-stylesheet', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'styles.css', source: readFileSync(new URL('./src/styles.css', import.meta.url), 'utf8') });
  } }],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    rollupOptions: { external: (id) => /^(react|react-dom)(\/|$)/.test(id) },
  },
});
