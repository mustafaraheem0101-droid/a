/**
 * Minify JS (esbuild) + PurgeCSS + minify CSS (esbuild).
 * Run from project root: npm run build:assets
 */
import * as esbuild from 'esbuild';
import { PurgeCSS } from 'purgecss';
import fg from 'fast-glob';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

mkdirSync(join(root, 'assets', 'js', 'dist'), { recursive: true });
mkdirSync(join(root, 'assets', 'css', 'dist'), { recursive: true });

const jsFiles = ['main', 'admin', 'api', 'ui', 'utils'];
for (const name of jsFiles) {
  const entry = join(root, 'assets', 'js', `${name}.js`);
  if (!existsSync(entry)) {
    console.warn('skip missing', entry);
    continue;
  }
  await esbuild.build({
    entryPoints: [entry],
    outfile: join(root, 'assets', 'js', 'dist', `${name}.min.js`),
    minify: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    drop: ['debugger'],
    bundle: false,
    allowOverwrite: true,
    platform: 'browser',
    target: 'es2018',
    legalComments: 'none',
  });
  console.log('built', `assets/js/dist/${name}.min.js`);
}

const contentGlobs = ['**/*.{html,php,js}', '!**/node_modules/**', '!**/vendor/**', '!assets/js/dist/**'];
const contentFiles = await fg(contentGlobs, { cwd: root, absolute: true, onlyFiles: true });

const cssInputs = ['pharma-bundle.css', 'shop-bundle.css', 'store-enhancements.css'];
for (const file of cssInputs) {
  const cssPath = join(root, 'assets', 'css', file);
  if (!existsSync(cssPath)) {
    console.warn('skip missing css', cssPath);
    continue;
  }
  const purged = await new PurgeCSS().purge({
    content: contentFiles,
    css: [cssPath],
    safelist: {
      standard: [/^pharma-/, /^p-/, /^prod-/, /^gl-/, /^co($|-)/, /^cs($|-)/, /^mo$/, /^swiper/, /^is-/],
      deep: [/^tooltip/, /^modal/, /^toast/],
      greedy: [/data-[\w-]+/],
    },
  });
  const cssOut = purged[0]?.css ?? readFileSync(cssPath, 'utf8');
  const tmp = join(root, 'assets', 'css', 'dist', `${file}.tmp.css`);
  writeFileSync(tmp, cssOut, 'utf8');
  const base = file.replace(/\.css$/, '');
  await esbuild.build({
    entryPoints: [tmp],
    outfile: join(root, 'assets', 'css', 'dist', `${base}.min.css`),
    minify: true,
    allowOverwrite: true,
  });
  try {
    const { unlinkSync } = await import('fs');
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  console.log('built', `assets/css/dist/${base}.min.css`);
}
