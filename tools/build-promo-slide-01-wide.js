/**
 * يبني بانر عريض slide-01-wide.png (1600×420) من الصورة المربعة slide-01.png
 * Run: node tools/build-promo-slide-01-wide.js
 */
const path = require('path');
const sharp = require('sharp');

const W = 1600;
const H = 420;

async function main() {
  const src = path.join(__dirname, '../assets/img/promo-slider/slide-01.png');
  const out = path.join(__dirname, '../assets/img/promo-slider/slide-01-wide.png');

  await sharp(src)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(out);

  console.log('✅ Created', out, `(${W}×${H})`);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
