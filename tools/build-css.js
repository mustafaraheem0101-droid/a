/**
 * Concatenates and minifies CSS groups into assets/css/dist/
 * Run: node tools/build-css.js
 *
 * base-final: fonts + CSP shim + shared UI (premium, mobile) — load first everywhere.
 * store-final: Task 2 list + pharma-bundle; site-desktop-unified.css is linked separately in HTML (cascade after inline <style> on some pages).
 * admin-final: admin + dashboard + responsive + admin-v2 (admin panel).
 */
const fs = require('fs');
const path = require('path');

const groups = {
  'base-final': ['fonts-tajawal.css', 'csp-js-shim.css', 'premium-ui.css', 'mobile-ux.css'],
  'store-final': [
    'pharma-bundle.css',
    'shop-bundle.css',
    'store-enhancements.css',
    'responsive.css',
    'icons-inline.css',
  ],
  'admin-final': ['admin.css', 'dashboard.css', 'responsive.css', 'admin-v2.css'],
};

const cssDir = path.join(__dirname, '../assets/css');
const distDir = path.join(__dirname, '../assets/css/dist');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

Object.entries(groups).forEach(([name, files]) => {
  let combined = '';
  files.forEach((file) => {
    const filePath = path.join(cssDir, file);
    if (fs.existsSync(filePath)) {
      combined += `\n/* === ${file} === */\n`;
      combined += fs.readFileSync(filePath, 'utf8');
    } else {
      console.warn(`⚠️ ملف غير موجود: ${file}`);
    }
  });

  const minified = combined
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*{\s*/g, '{')
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*;\s*/g, ';')
    .trim();

  const outPath = path.join(distDir, `${name}.min.css`);
  fs.writeFileSync(outPath, minified);
  const size = (minified.length / 1024).toFixed(1);
  console.log(`✅ ${name}.min.css — ${size} KB`);
});

console.log('\n✅ CSS build completed!');
