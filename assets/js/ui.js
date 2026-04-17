/* ui.js — تطبيق الإعدادات على DOM + رسم البطاقات والـ skeletons */
'use strict';

// ══════════════════════════════════════════════
// تطبيق الإعدادات على الصفحة
// ══════════════════════════════════════════════
function applySettings() {
  const s = settings;
  const waNum = String(s.whatsapp || '9647711954040').replace(/\D/g, '');
  const waUrl = `https://wa.me/${waNum}`;
  const phone = String(s.phone || '07711954040');

  document.querySelectorAll('[data-wa-link]').forEach(el => {
    const text = el.dataset.waText || '';
    el.href = waUrl + (text ? '?text=' + encodeURIComponent(text) : '');
  });

  ['ft-wa', 'wa-float'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.hasAttribute('data-wa-link')) el.href = waUrl;
  });
  const ftWa2 = document.getElementById('ft-wa2');
  if (ftWa2) ftWa2.setAttribute('data-href', waUrl);

  const ftPhone = document.getElementById('ft-phone');
  if (ftPhone) { ftPhone.href = 'tel:' + phone.replace(/\D/g, ''); ftPhone.textContent = '📞 ' + phone; }

  const mapUrl = s.mapUrl || MAP_URL;
  const ftAddr = document.getElementById('ft-addr');
  if (ftAddr) { ftAddr.href = mapUrl; ftAddr.textContent = '📍 ' + (s.address || ''); }

  const { open, close, isOpen } = getHours();
  const fmt12 = h => h === 24 ? '12 منتصف الليل' : h === 12 ? '12 ظهراً' : h > 12 ? (h - 12) + ' مساءً' : h + ' صباحاً';
  const ftHours = document.getElementById('ft-hours');
  if (ftHours) ftHours.textContent = `🕒 ${fmt12(open)} – ${fmt12(close)}`;

  const statusEl = document.getElementById('shopStatus');
  if (statusEl) {
    statusEl.textContent = isOpen ? '🟢 مفتوح الآن' : '🔴 مغلق';
    statusEl.style.color = isOpen ? '#00a86e' : '#ef4444';
  }

  if (s.instagram) {
    document.querySelectorAll('[data-ig-link]').forEach(el => { el.href = s.instagram; el.style.display = ''; });
  }
  if (s.facebook) {
    document.querySelectorAll('[data-fb-link]').forEach(el => { el.href = s.facebook; el.style.display = ''; });
  }
}

/** إزالة وضع ليلي قديم من localStorage ومن class pharma-dark على documentElement */
function clearPharmaStoreDarkTheme() {
  document.documentElement.classList.remove('pharma-dark');
  try {
    localStorage.removeItem('pharma_store_theme');
  } catch (e) { /* ignore */ }
}

// ══════════════════════════════════════════════
// تهيئة مشتركة (الأحداث العامة تُدار من app.js)
// ══════════════════════════════════════════════
function initShopChrome() {
  if (typeof ensureGlobalLoader === 'function') ensureGlobalLoader();
  if (typeof updateCartBadge === 'function') updateCartBadge();
  applySettings();
  clearPharmaStoreDarkTheme();
}

function initImageFallbacks() {
  if (initImageFallbacks._bound) return;
  initImageFallbacks._bound = true;
  document.addEventListener(
    'error',
    function pharmaImgFallback(ev) {
      const t = ev.target;
      if (!t || t.tagName !== 'IMG') return;
      if (t.classList.contains('pc-img-el')) {
        if (typeof window.onProductCardImgError === 'function') window.onProductCardImgError(t);
        return;
      }
      if (t.classList.contains('prod-main-img')) {
        const sel = t.getAttribute('data-fallback-parent');
        const wrap = t.closest('.img-zoom-wrap') || t.parentElement;
        if (wrap && sel) {
          const fb = wrap.querySelector(sel);
          t.style.display = 'none';
          if (fb) fb.style.display = 'flex';
        }
        return;
      }
      const fbClass = t.getAttribute('data-fallback-next');
      if (fbClass && t.parentElement) {
        const fb = t.parentElement.querySelector('.' + fbClass);
        t.style.visibility = 'hidden';
        if (fb) fb.style.display = 'inline-flex';
      }
    },
    true
  );
}

// ═══ من render.js — بطاقات المنتجات والأقسام ═══

const CAT_ICON_MAP = {
  medicine: '💊', beauty: '💄', medical: '🩺',
  baby: '👶', vitamin: '🧬', other: '📦', default: '📦'
};

function getProductIcon(p) {
  if (p.ico) return p.ico;
  if (Array.isArray(p.categories) && p.categories.length) return CAT_ICON_MAP[p.categories[0]] || CAT_ICON_MAP.default;
  if (p.cat) return CAT_ICON_MAP[p.cat] || CAT_ICON_MAP.default;
  return CAT_ICON_MAP.default;
}

function productCategoryKey(p) {
  if (!p) return 'other';
  if (p.cat) {
    const k = String(p.cat).toLowerCase().trim();
    if (k) return k;
  }
  if (Array.isArray(p.categories) && p.categories.length) {
    const k = String(p.categories[0]).toLowerCase().trim();
    if (k) return k;
  }
  return 'other';
}

/** صورة افتراضية للمنتج — assets/img/default.jpg */
function getProductDefaultImageUrl() {
  var path = '/assets/img/default.jpg';
  if (typeof pharmaPublicAssetUrl === 'function') return pharmaPublicAssetUrl(path);
  return path;
}

function productPlaceholderImageUrl() {
  return getProductDefaultImageUrl();
}

function resolveProductImageUrl(p) {
  if (!p) return getProductDefaultImageUrl();
  const norm = typeof window.normalizeProductImagePath === 'function'
    ? window.normalizeProductImagePath
    : function (x) { return String(x || '').replace(/(prod_\d{8})\.\.(\d+)_/gi, '$1_$2_'); };
  const raw = (p.image != null && String(p.image).trim() !== '')
    ? norm(String(p.image).trim())
    : (p.img != null && String(p.img).trim() !== '') ? norm(String(p.img).trim()) : '';
  if (!raw) return productPlaceholderImageUrl();
  let u = typeof safeImgSrc === 'function' ? safeImgSrc(raw) : '';
  if (!u && typeof fixImgUrl === 'function') u = fixImgUrl(raw);
  if (!u && raw) {
    if (/^https?:\/\//i.test(raw)) u = raw;
    else if (raw.startsWith('/') || raw.startsWith('data:image/')) u = raw;
    else if (/\.(jpe?g|png|gif|webp|svg)(\?[^#]*)?$/i.test(raw)) {
      const fileOnly = raw.replace(/^uploads\//i, '').replace(/^images\//i, '');
      u = /^uploads\//i.test(raw) ? ('/uploads/' + fileOnly) : ('/images/' + fileOnly);
    } else u = '/' + raw.replace(/^\.\//, '');
  }
  if (!u) return productPlaceholderImageUrl();
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  if (u.startsWith('/')) {
    return typeof pharmaPublicAssetUrl === 'function' ? pharmaPublicAssetUrl(u) : u;
  }
  return productPlaceholderImageUrl();
}

function pseudoRatingForProduct(p) {
  const id = String(p && p.id != null ? p.id : '0');
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i) | 0;
  return (4.6 + (Math.abs(h) % 40) / 100).toFixed(1);
}

function pseudoReviewCountForProduct(p) {
  const id = String(p && p.id != null ? p.id : '0');
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i) | 0;
  return 5 + (Math.abs(h) % 45);
}

window.onProductCardImgError = function (img) {
  if (!img || img.tagName !== 'IMG') return;
  var def = img.getAttribute('data-default-src');
  var tried = img.getAttribute('data-img-tried-default') === '1';
  if (def && !tried) {
    img.setAttribute('data-img-tried-default', '1');
    img.src = def;
    img.style.visibility = '';
    return;
  }
  img.style.visibility = 'hidden';
  var wrap = img.closest('.pc-img');
  if (!wrap) return;
  var ico = wrap.querySelector('.pc-ico-fallback');
  if (ico) ico.style.display = 'flex';
};

/** عنوان البطاقة — حتى لو مرّ المنتج بدون تطبيع كامل */
function productCardDisplayName(p) {
  if (!p || typeof p !== 'object') return 'منتج';
  var n = p.name != null ? String(p.name).trim() : '';
  if (n) return n;
  var alt = [p.title, p.product_name, p.productName, p.label, p.name_ar, p.ar_name, p.arabic_name]
    .map(function (x) { return x != null ? String(x).trim() : ''; })
    .find(function (s) { return s !== ''; });
  if (alt) return alt;
  if (p.slug != null && String(p.slug).trim() !== '') {
    var s = String(p.slug).trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (s) return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return p.id != null ? 'منتج #' + p.id : 'منتج';
}

function buildProductCardHtml(p, opts) {
  opts = opts || {};
  const dispName = productCardDisplayName(p);
  const liked    = likes.has(p.id);
  const qrOffer = typeof isOfferQrShelfPromoUiActive === 'function'
    ? isOfferQrShelfPromoUiActive()
    : false;
  const shelfCatOk = typeof isProductCategoryEligibleForQrShelfPromo === 'function'
    ? isProductCategoryEligibleForQrShelfPromo(p)
    : false;
  const hasOffer = p.oldPrice && Number(p.oldPrice) > Number(p.price || 0);
  const discount = hasOffer ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const showStoreDeal = qrOffer && shelfCatOk && hasOffer;
  const icon     = getProductIcon(p);
  const defaultSrc = getProductDefaultImageUrl();
  const resolved = resolveProductImageUrl(p);
  const prodHref = typeof productPageUrl === 'function' ? productPageUrl(p) : ('product.html?id=' + escHtml(p.id));

  const imgHtml =
    '<img src="' +
    escHtml(resolved) +
    '" alt="' +
    escHtml(dispName) +
    '" loading="lazy" decoding="async" class="pc-img-el" data-fallback-icon="' +
    escHtml(icon) +
    '" data-default-src="' +
    escHtml(defaultSrc) +
    '">';
  const iconHtml = `<div class="pc-ico-fallback" style="display:none" aria-hidden="true">${icon}</div>`;

  const outOfStock = p.stock !== undefined && Number(p.stock) === 0;
  const lowStock   = p.stock !== undefined && Number(p.stock) > 0 && Number(p.stock) < 5;

  const mod = `${opts.trustStrip ? ' pc--trust-card' : ''}${opts.waProminent ? ' pc--wa-prominent' : ''}${opts.size === 'hot' ? ' pc--home-hot' : ''}`;
  const slugAttr = p.slug != null && String(p.slug).trim() !== ''
    ? ` data-pslug="${escHtml(String(p.slug).trim())}"`
    : '';
  const listPrice = Number(p.price);
  const promoPctShelf = qrOffer ? getShelfPromoDiscountPercent() : 0;
  const promoFinalPrice = applyShelfPromoToPrice(listPrice, promoPctShelf);
  const showShelfPromo = qrOffer && shelfCatOk && promoPctShelf > 0 && Number.isFinite(listPrice) && listPrice > 0;
  const priceForActions = showShelfPromo ? promoFinalPrice : p.price;
  const priceAttr = p.price != null ? ` data-pprice="${escHtml(String(priceForActions))}"` : '';
  const nameAttr = dispName ? ` data-pname="${escHtml(String(dispName))}"` : '';
  const priceRowInner = showShelfPromo
    ? `<span class="pc-price">${fmt(promoFinalPrice)}</span><span class="pc-old">${fmt(listPrice)}</span><span class="pc-disc">-${promoPctShelf}%</span>`
    : `<span class="pc-price">${fmt(p.price)}</span>${showStoreDeal ? `<span class="pc-old">${fmt(p.oldPrice)}</span><span class="pc-disc">-${discount}%</span>` : ''}`;
  const badgeSaleHtml = showShelfPromo
    ? `<span class="pc-badge-sale">خصم ${promoPctShelf}%</span>`
    : (showStoreDeal ? `<span class="pc-badge-sale">خصم ${discount}%</span>` : '');
  const showSaleCornerBadge = showShelfPromo || showStoreDeal;
  const ratingVal = pseudoRatingForProduct(p);
  const reviewN = pseudoReviewCountForProduct(p);
  const waSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  return `<div class="pc pc--product reveal${mod}" data-id="${escHtml(p.id)}" role="article">
  <div class="pc-top">
    <div class="pc-media-block">
      <a href="${prodHref}" class="pc-link pc-link--media" tabindex="0" aria-label="${escHtml(dispName)}">
        <div class="pc-img">
          ${opts.bestseller && !showSaleCornerBadge ? '<span class="pc-badge-bestseller">الأكثر مبيعاً</span>' : ''}
          ${imgHtml}${iconHtml}
          ${outOfStock ? '<div class="pc-stock-badge pc-stock-badge--out">نفد المخزون</div>' : ''}
          ${lowStock ? `<div class="pc-stock-badge pc-stock-badge--low">آخر ${p.stock} قطع</div>` : ''}
        </div>
      </a>
      <button type="button" class="pc-like${liked ? ' liked' : ''}" data-action="like" data-id="${escHtml(p.id)}" aria-label="${liked ? 'إزالة الإعجاب' : 'إعجاب'}" aria-pressed="${liked}">
        <svg class="pc-like__ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="pc-like__path" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      ${badgeSaleHtml}
      <button type="button" class="pc-fab-cart${outOfStock ? ' pc-fab-cart--disabled' : ''}" data-action="add-to-cart" data-id="${escHtml(p.id)}"${nameAttr}${priceAttr}${slugAttr} ${outOfStock ? 'disabled aria-disabled="true"' : ''} aria-label="أضف ${escHtml(dispName)} إلى السلة"><span class="pc-fab-cart__plus" aria-hidden="true">+</span></button>
    </div>
    <a href="${prodHref}" class="pc-link pc-link--body">
      <div class="pc-info">
        <div class="pc-name">${escHtml(dispName)}</div>
        <div class="pc-price-row">
          ${priceRowInner}
        </div>
      </div>
    </a>
  </div>
  <div class="pc-footer">
    <div class="pc-footer__tags">
      <button type="button" class="pc-wa-fab${outOfStock ? ' pc-wa-fab--disabled' : ''}" data-action="wa-order-product" data-id="${escHtml(p.id)}"${nameAttr}${priceAttr}${slugAttr} ${outOfStock ? 'disabled' : ''} aria-label="اطلب ${escHtml(dispName)} عبر واتساب">${waSvg}</button>
    </div>
    <div class="pc-footer__rating" aria-label="تقييم تقريبي من العملاء">
      <span class="pc-footer__reviews">(${escHtml(String(reviewN))})</span>
      <span class="pc-footer__score">${escHtml(ratingVal)}</span>
      <span class="pc-footer__star" aria-hidden="true">★</span>
    </div>
  </div>
</div>`;
}

var HOME_CATEGORY_IMG_DIR = 'assets/img/home-categories/';
/** تحديث عند تغيير أي صورة في المجلد أعلاه لتفادي كاش المتصفح */
var HOME_CATEGORY_IMG_VER = '20260413';

/**
 * مسار صورة قسم الرئيسية حسب slug/id، أو صورة من الـ API إن وُجدت.
 */
function resolveHomeCategoryImage(cat) {
  if (!cat || typeof cat !== 'object') return '';
  var img = cat.image != null ? String(cat.image).trim() : '';
  if (img) {
    if (typeof window.fixImgUrl === 'function') {
      var fixed = window.fixImgUrl(img);
      if (fixed) return fixed;
    }
    return img;
  }
  var raw = cat.slug != null && String(cat.slug) !== '' ? String(cat.slug) : String(cat.id != null ? cat.id : '');
  var key = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  var map = {
    medicine: 'medicine.png',
    drug: 'medicine.png',
    drugs: 'medicine.png',
    pharmacy: 'medicine.png',
    medications: 'medicine.png',
    vitamin: 'vitamin.png',
    vitamins: 'vitamin.png',
    supplements: 'vitamin.png',
    beauty: 'skincare.png',
    cosmetics: 'makeup.png',
    skincare: 'skincare.png',
    makeup: 'makeup.png',
    haircare: 'haircare.png',
    hair_care: 'haircare.png',
    'العناية_بالشعر': 'haircare.png',
    baby: 'baby.png',
    baby_care: 'baby.png',
    babycare: 'baby.png',
    kids: 'baby.png',
    children: 'baby.png',
    medical: 'medical.png',
    medical_devices: 'medical.png',
    medicaldevices: 'medical.png',
    devices: 'medical.png',
    device: 'medical.png',
    personal_care: 'personal.png',
    personalcare: 'personal.png',
    hygiene: 'medical.png',
    first_aid: 'medical.png',
    firstaid: 'medical.png',
    oral_care: 'oral_care.png',
    oralcare: 'oral_care.png',
    'العناية_بالفم_والأسنان': 'oral_care.png',
    'الفم_والأسنان': 'oral_care.png',
    mouth_care: 'oral_care.png',
    weight_management: 'vitamin.png',
    weightmanagement: 'vitamin.png',
    women_health: 'personal.png',
    womenhealth: 'personal.png',
    senior_care: 'medicine.png',
    seniorcare: 'medicine.png',
    sports: 'sports.png',
    fitness: 'sports.png'
  };
  var file = map[key];
  if (!file) return '';
  var path = (HOME_CATEGORY_IMG_DIR + file).replace(/\\/g, '/') + '?v=' + HOME_CATEGORY_IMG_VER;
  if (typeof window.pharmaPublicAssetUrl === 'function' && path.indexOf('http') !== 0) {
    return window.pharmaPublicAssetUrl(path.startsWith('/') ? path : '/' + path);
  }
  return path;
}

/**
 * صورة قسم فرعي: من الـ API، ثم تطابق اسم/سلاج مع صور محلية، ثم قسم الأب، ثم افتراضي طبي.
 */
function subcategoryLocalFileToUrl(file) {
  if (!file || typeof file !== 'string') return '';
  var path = (HOME_CATEGORY_IMG_DIR + file).replace(/\\/g, '/') + '?v=' + HOME_CATEGORY_IMG_VER;
  if (typeof window.pharmaPublicAssetUrl === 'function' && path.indexOf('http') !== 0) {
    return window.pharmaPublicAssetUrl(path.startsWith('/') ? path : '/' + path);
  }
  return path;
}

/**
 * قواعد صورة القسم الفرعي — ترتيب حرج: الأخص أولاً.
 * تجنّب مطابقة «أطفال» العامة لكل الصفوف (كانت تُرجع baby.png للجميع).
 */
var SUBCATEGORY_KEYWORD_RULES = [
  { file: 'haircare.png', needles: ['شامبو', 'صابون', 'غسول'] },
  { file: 'skincare.png', needles: ['طفح الحفاض', 'كريمات طفح', 'بشرة الرضع', 'عناية ببشرة', 'جلد الرضيع'] },
  { file: 'personal.png', needles: ['حفاضات', 'حفاض'] },
  { file: 'oral_care.png', needles: ['رضاعات', 'لهايات', 'الرضاعة'] },
  { file: 'vitamin.png', needles: ['حليب أطفال', 'فيتامينات', 'فيتامين', 'مكملات أطفال', 'مكملات غذائية', 'معادن', 'مكمل غذائي', 'طاقة ومناعة'] },
  { file: 'baby.png', needles: ['مهروسة', 'أطعمة أطفال', 'أطعمة'] },
  { file: 'medicine.png', needles: ['استشارة وتوصية', 'استشارة'] },
  { file: 'medical.png', needles: ['صيدلية معتمدة'] },
  { file: 'baby.png', needles: ['منتجات الأطفال', 'عناية الطفل'] },
  { file: 'personal.png', needles: ['دورة', 'الحيض', 'آلام الدورة', 'نسائي', 'النساء', 'الحمل', 'التوليد'] },
  { file: 'skincare.png', needles: ['أدوية الجلدية', 'الجلدية', 'جلدية', 'البشرة', 'أكزيما', 'حب الشباب', 'حكة', 'فطريات الجلد', 'الطفال الجلد', 'حساسية جلدية'] },
  { file: 'haircare.png', needles: ['عناية بالشعر', 'الشعر ', ' الشعر', 'فروة الرأس', 'الصلع'] },
  { file: 'medical.png', needles: ['مستلزمات طبية', 'مستلزم', 'جبيرة', 'شاش طبي', 'ضماد', 'أجهزة قياس', 'قياس السكر', 'قياس الضغط'] },
  { file: 'oral_care.png', needles: ['الأسنان', 'الفم', 'تبييض', 'العناية بالفم'] },
  { file: 'makeup.png', needles: ['مكياج', 'تجميل', 'أظافر'] },
  { file: 'medicine.png', needles: [
    'الجهاز التنفسي', 'تنفس', 'سعال', 'بلغم', 'الحلق', 'ربو', 'احتقان', 'الأنف', 'الجيوب', 'البرد', 'الإنفلونزا', 'إنفلونزا',
    'الهضمي', 'الجهاز الهضمي', 'هضم', 'معدة', 'حرقة', 'ارتجاع', 'مغص', 'إسهال', 'إمساك', 'غثيان', 'قيء', 'القولون', 'المريء', 'محاليل', 'جفاف',
    'مسكن', 'آلام', 'الألم', 'عضلات', 'مفاصل', 'صداع', 'مضاد حيوي', 'مضادات حيوية', 'حيوي', 'فطريات', 'فيروس',
    'القلب', 'الضغط', 'السكري', 'سيولة', 'مدر', 'سيولة الدم',
    'حساسية', 'هيستامين', 'قطرات', 'قطرة', 'العين', 'الأذن',
    'أدوية', 'دواء', 'مسكنات', 'مضادات التهاب', 'شرابات مسكن', 'تحاميل', 'خافض حرارة'
  ] },
  { file: 'baby.png', needles: ['رضيع', 'للأطفال', ' الأطفال', 'أطفال'] }
];

function resolveSubcategoryImageFromSlug(s) {
  var slug = (s.slug != null && String(s.slug) !== '') ? String(s.slug).toLowerCase().replace(/-/g, '_') : '';
  if (!slug) return '';
  var map = {
    diapers: 'personal.png', diaper: 'personal.png', nappy: 'personal.png',
    baby_milk: 'vitamin.png', formula: 'vitamin.png', infant_formula: 'vitamin.png',
    shampoo: 'haircare.png', baby_shampoo: 'haircare.png', baby_wash: 'haircare.png',
    baby_vitamins: 'vitamin.png', vitamins_kids: 'vitamin.png',
    puree: 'baby.png', baby_food: 'baby.png',
    bottles: 'oral_care.png', pacifier: 'oral_care.png',
    diaper_rash: 'skincare.png', infant_skincare: 'skincare.png',
    consultation: 'medicine.png', pharmacy_badge: 'medical.png'
  };
  return map[slug] || '';
}

function resolveSubcategoryImageFromKeywords(s) {
  var text = String(s.name || '') + ' ' + String(s.slug || '');
  if (!text.trim()) return '';
  for (var g = 0; g < SUBCATEGORY_KEYWORD_RULES.length; g++) {
    var grp = SUBCATEGORY_KEYWORD_RULES[g];
    for (var k = 0; k < grp.needles.length; k++) {
      if (text.indexOf(grp.needles[k]) >= 0) return grp.file;
    }
  }
  return '';
}

function resolveSubcategoryImage(s) {
  if (!s || typeof s !== 'object') return '';
  var img = s.image != null ? String(s.image).trim() : '';
  if (img) {
    if (typeof window.fixImgUrl === 'function') {
      var fixed = window.fixImgUrl(img);
      if (fixed) return fixed;
    }
    return img;
  }
  var fromKw = resolveSubcategoryImageFromKeywords(s);
  if (fromKw) return subcategoryLocalFileToUrl(fromKw);
  var fromSlug = resolveSubcategoryImageFromSlug(s);
  if (fromSlug) return subcategoryLocalFileToUrl(fromSlug);
  var parent = s.parent != null ? String(s.parent).trim() : '';
  if (parent) {
    var pl = parent.toLowerCase();
    if (pl !== 'baby' && pl !== 'children' && pl !== 'kids' && pl !== 'الأطفال') {
      var fromParent = resolveHomeCategoryImage({ slug: parent });
      if (fromParent) return fromParent;
    }
  }
  return subcategoryLocalFileToUrl('medicine.png');
}

/**
 * إيموجي لبطاقة القسم الفرعي (صفحة القسم) — يُفضّل حقل icon من لوحة التحكم، ثم استنتاج من الاسم/slug، ثم القسم الأب.
 * ترتيب القواعد: الأكثر تحديداً أولاً (أذن/عين/أنف/سعال/برد ثم أدوية عامة ثم تجميل/أطفال/شعر…).
 */
function subcategoryIconFieldIsEmojiLike(icon) {
  var t = icon != null ? String(icon).trim() : '';
  if (!t || t.length > 16) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(t)) return false;
  return true;
}

function subcategoryChipParentHintEmoji(parent) {
  var p = String(parent || '').toLowerCase().trim().replace(/-/g, '_');
  if (!p) return '';
  if (p.indexOf('hair') >= 0) return '💇';
  if (p.indexOf('baby') >= 0 || p.indexOf('child') >= 0 || p.indexOf('kid') >= 0 || p.indexOf('infant') >= 0) return '👶';
  if (p.indexOf('beauty') >= 0 || p.indexOf('makeup') >= 0 || p.indexOf('cosmetic') >= 0) return '💄';
  if (p.indexOf('medical') >= 0 || p.indexOf('supply') >= 0 || p.indexOf('equipment') >= 0) return '🩹';
  if (p.indexOf('vitamin') >= 0 || p.indexOf('supplement') >= 0) return '🧬';
  if (p.indexOf('medicine') >= 0 || p === 'med' || p.indexOf('drug') >= 0) return '💊';
  return '';
}

function resolveSubcategoryChipEmoji(s) {
  if (!s || typeof s !== 'object') return '📁';
  if (subcategoryIconFieldIsEmojiLike(s.icon)) return String(s.icon).trim();
  var name = String(s.name || '');
  var slug = String(s.slug != null ? s.slug : '').toLowerCase().replace(/-/g, '_');
  var t = name + ' ' + slug;
  var rules = [
    [/أذن|الأذن|أذني|أذون|otic|قطرة أذن|قطرات أذن|(?:^|_)ears?(?:$|_)|(?:^|_)otic(?:$|_)/i, '👂'],
    [/عين|العين|عيون|ophthal|قطرة عين|قطرات عين|لاصقات عين/i, '👁️'],
    [/أنف|الأنف|أنفي|جيوب|الجيوب|sinus|nasal|احتقان الأنف|الأنف والجيوب|انسداد/i, '👃'],
    [/سعال|السعال|بلغم|طارد|ربو|الحلق|التهاب الحلق|لوز|cough|expectorant|الجهاز التنفسي|تنفس/i, '🫁'],
    [/جلدية|حكة|أكزيما|حب الشباب|فطريات الجلد|البشرة|مرطب|كريم|لوشن|واقي شمس|ترطيب|skincare|eczema|acne/i, '🧴'],
    [/برد|البرد|إنفلونزا|انفلونزا|زكام|\bflu\b|\bcold\b|هيستامين|مضادات هيستامين/i, '🤧'],
    [/شعر|شامبو|صبغة|فروة|تساقط|بلسم|haircare|shampoo/i, '💇'],
    [/طفل|أطفال|رضع|حفاض|رضاعة|لهاية|مهروسة|حليب أطفال|infant|pediatric/i, '👶'],
    [/مكياج|أظافر|ماسكارا|أحمر|makeup|nail/i, '💄'],
    [/أسنان|الأسنان|فم|تبييض|معجون|فرشاة|dental|tooth/i, '🦷'],
    [/مستلزم|ضماد|جبيرة|شاش|قياس السكر|قياس الضغط|جهاز|عكاز|كرسي متحرك|first aid/i, '🩹'],
    [/فيتامين|مكمل|معادن|طاقة ومناعة|vitamin|supplement/i, '🧬'],
    [
      /مسكن|مسكنات|الألم|آلام|صداع|خافض|حرارة|مفصل|مفاصل|دواء|أدوية|شراب|تحاميل|كبسول|مضاد حيوي|مضادات حيوية|إسهال|جفاف|ORS|محاليل|معدة|حموضة|هضم|إمساك|ملين|قرحة|انتفاخ|غثيان|قيء|القولون|المريء|القلب|السكري|الضغط|مدر|التهابات المسالك|المسالك البولية|البولية|فطريات|فيروس|دوائي/i,
      '💊'
    ]
  ];
  for (var i = 0; i < rules.length; i++) {
    if (rules[i][0].test(t)) return rules[i][1];
  }
  var fromParent = subcategoryChipParentHintEmoji(s.parent);
  return fromParent || '📁';
}

/** أقسام فرعية تُعرض تحت بطاقة القسم في الرئيسية (عدد قليل) */
var HOME_CATEGORY_SUBS_MAX = 3;

/**
 * أقسام فرعية نشطة تابعة لقسم رئيسي (حسب parent = slug)
 */
function pickSubcategoriesForHomeCategory(parentSlug, subcats, limit) {
  var lim = limit != null ? Number(limit) : HOME_CATEGORY_SUBS_MAX;
  if (!Number.isFinite(lim) || lim < 1) lim = HOME_CATEGORY_SUBS_MAX;
  lim = Math.min(lim, 5);
  if (!parentSlug || !Array.isArray(subcats) || !subcats.length) return [];
  var want = typeof window.normalizeCategoryMatchKey === 'function'
    ? window.normalizeCategoryMatchKey(parentSlug)
    : String(parentSlug).toLowerCase().trim();
  return subcats
    .filter(function (s) {
      if (!s || s.active === false) return false;
      var par = s.parent != null
        ? (typeof window.normalizeCategoryMatchKey === 'function'
          ? window.normalizeCategoryMatchKey(String(s.parent))
          : String(s.parent).toLowerCase().trim())
        : '';
      return par === want;
    })
    .sort(function (a, b) {
      return (Number(a.order) || Number(a.id) || 0) - (Number(b.order) || Number(b.id) || 0);
    })
    .slice(0, lim);
}

/**
 * بطاقة قسم للصفحة الرئيسية — رابط رئيسي + روابط فرعية (بدون a داخل a)
 * @param {object} cat
 * @param {object[]|undefined} allSubcats قائمة كل الأقسام الفرعية من الـ API
 */
function buildCategoryCardHtml(cat, allSubcats) {
  var slug = cat.slug != null && String(cat.slug) !== '' ? String(cat.slug) : String(cat.id != null ? cat.id : '');
  var catHref = 'category.html?slug=' + encodeURIComponent(slug);
  var imgUrl = resolveHomeCategoryImage(cat);
  var visual = imgUrl
    ? '<div class="p-cat-visual">' +
      '<div class="p-cat-media"><img class="p-cat-img" src="' + escHtml(imgUrl) + '" alt="" width="200" height="200" loading="lazy" decoding="async"/></div>' +
      '<span class="p-cat-hoverlay" aria-hidden="true"></span></div>'
    : '<div class="p-cat-visual p-cat-visual--ico">' +
      '<span class="p-cat-ico">' + (cat.icon ? escHtml(cat.icon) : '📦') + '</span>' +
      '<span class="p-cat-hoverlay p-cat-hoverlay--ico" aria-hidden="true"></span></div>';
  var subs = pickSubcategoriesForHomeCategory(slug, allSubcats, HOME_CATEGORY_SUBS_MAX);
  var subsHtml = '';
  if (subs.length) {
    subsHtml =
      '<div class="p-cat__subs" role="group" aria-label="أقسام فرعية">' +
      subs
        .map(function (s) {
          var sid = s.id != null ? s.id : '';
          var subHref = 'subcategory.html?id=' + encodeURIComponent(String(sid));
          return (
            '<a class="p-cat__sub" href="' +
            escHtml(subHref) +
            '" aria-label="' +
            escHtml(cat.name) +
            ' — ' +
            escHtml(s.name) +
            '">' +
            escHtml(s.name) +
            '</a>'
          );
        })
        .join('') +
      '</div>';
  }
  var wrapCls = 'p-cat reveal' + (subsHtml ? ' p-cat--has-subs' : '');
  return (
    '<div class="' +
    wrapCls +
    '" data-category="' +
    escHtml(slug) +
    '">' +
    '<a class="p-cat__main" href="' +
    escHtml(catHref) +
    '" aria-label="' +
    escHtml(cat.name) +
    ' — عرض المنتجات">\n' +
    visual +
    '\n<div class="p-cat-name">' +
    escHtml(cat.name) +
    '</div>' +
    '\n<div class="p-cat-cta"><span class="p-cat-cta__text">عرض المنتجات</span><span class="p-cat-cta__arr" aria-hidden="true">←</span></div>\n</a>' +
    subsHtml +
    '</div>'
  );
}

function renderSkeletons(container, count = 6) {
  if (!container) return;
  container.setAttribute('aria-busy', 'true');
  replaceChildrenFromHtml(container, Array(count).fill(0).map(() => `
    <div class="pc pc--product pc--skel" aria-hidden="true">
      <div class="pc-top">
        <div class="pc-media-block">
          <div class="pc-link pc-link--media"><div class="pc-img skel-shimmer"></div></div>
          <div class="skel-fab skel-shimmer" aria-hidden="true"></div>
        </div>
        <div class="pc-link pc-link--body">
          <div class="pc-info">
            <div class="skel-line skel-line--md skel-shimmer"></div>
            <div class="skel-line skel-line--price skel-shimmer"></div>
          </div>
        </div>
      </div>
      <div class="pc-footer pc-footer--skel">
        <div class="skel-line skel-line--sm skel-shimmer"></div>
        <div class="skel-line skel-line--sm skel-shimmer"></div>
      </div>
    </div>`).join(''));
}

/**
 * Skeleton لبطاقات «الأقسام الرئيسية» في index — نفس شكل .p-cat (صورة مربعة + سطر نص).
 */
function renderHomeCategorySkeletons(container, count) {
  if (!container) return;
  var n = count != null ? Number(count) : 7;
  if (Number.isNaN(n) || n < 1) n = 7;
  n = Math.min(Math.max(n, 5), 12);
  var html = '';
  for (var i = 0; i < n; i++) {
    html +=
      '<div class="p-cat p-cat--skel" aria-hidden="true">' +
      '<div class="p-cat-skel-visual skel-shimmer"></div>' +
      '<div class="p-cat-skel-line skel-shimmer"></div>' +
      '<div class="p-cat-skel-cta skel-shimmer"></div>' +
      '</div>';
  }
  container.classList.add('p-cats--skel-mode');
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', 'جاري تحميل الأقسام…');
  replaceChildrenFromHtml(container, html);
}

/**
 * حالة «لا توجد منتجات» — نص + اقتراحات + أزرار (تُستخدم في الشبكة والصفحات)
 * @param {string} msg
 * @param {{ variant?: 'default'|'search'|'filter', extraHtml?: string, showSuggestions?: boolean }} [options]
 */
function buildEmptyProductsStateHtml(msg, options) {
  options = options || {};
  const esc = typeof escHtml === 'function' ? escHtml : function (s) { return String(s == null ? '' : s); };
  const safeMsg = esc(msg || 'لا توجد منتجات');
  const showSuggestions = options.showSuggestions !== false;
  let variant = options.variant;
  if (!variant) {
    const m = String(msg || '');
    if (/فلاتر|الفلاتر/.test(m)) variant = 'filter';
    else if (/بحث|تطابق/.test(m)) variant = 'search';
    else variant = 'default';
  }

  let listHtml = '';
  if (showSuggestions) {
    if (variant === 'filter') {
      listHtml = `<ul class="empty-state__list" role="list">
        <li>اضغط <strong>إعادة ضبط الفلاتر</strong> لعرض كل المنتجات المتوفرة في هذا القسم.</li>
        <li>جرّب توسيع نطاق السعر أو اختيار «الكل» للنوع إن وُجد.</li>
        <li>تصفّح <a href="categories.html">أقسامًا أخرى</a> إن لم تجد ما تبحث عنه.</li>
      </ul>`;
    } else if (variant === 'search') {
      listHtml = `<ul class="empty-state__list" role="list">
        <li>اختصر عبارة البحث أو جرّب اسمًا تجاريًا أو مكوّنًا فعالًا مختلفًا.</li>
        <li>تصفّح <a href="categories.html">جميع الأقسام</a> ثم اضغط على القسم المناسب.</li>
        <li>استخدم <strong>شريط البحث</strong> في أعلى الصفحة مع كلمات أوسع قليلًا.</li>
      </ul>`;
    } else {
      listHtml = `<ul class="empty-state__list" role="list">
        <li>تصفّح <a href="categories.html">جميع الأقسام</a> لاكتشاف منتجات بديلة.</li>
        <li>استخدم <strong>شريط البحث</strong> في أعلى الصفحة للوصول السريع لمنتج معيّن.</li>
        <li>للاستفسار عن التوفر أو البديل، راسلنا عبر <strong>واتساب</strong> من الأيقونة في الصفحة.</li>
      </ul>`;
    }
  }

  const extra = options.extraHtml ? String(options.extraHtml) : '';
  const footer = options.footerHtml ? String(options.footerHtml) : '';

  const emptyVisual = `<div class="empty-state__visual" aria-hidden="true">
    <svg class="empty-state__svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <circle cx="60" cy="60" r="52" fill="rgba(0,135,90,.07)" stroke="rgba(0,135,90,.18)" stroke-width="2"/>
      <rect x="52" y="34" width="16" height="52" rx="3" fill="#00875a" opacity=".9"/>
      <rect x="34" y="52" width="52" height="16" rx="3" fill="#00875a" opacity=".9"/>
    </svg>
    <span class="empty-state__emoji">📦</span>
  </div>`;

  return `<div class="empty-state empty-state--rich empty-state--products" style="grid-column:1/-1" role="status">
    ${emptyVisual}
    <p class="empty-state__msg">${safeMsg}</p>
    ${extra}
    ${listHtml}
    ${footer}
    <div class="empty-state__actions">
      <a href="categories.html" class="empty-state__cta-primary">تصفح الأقسام</a>
      <button type="button" class="empty-state__cta-secondary" data-action="empty-go-back">← رجوع</button>
    </div>
    <a href="index.html" class="empty-state__cta-text">الذهاب إلى الرئيسية</a>
  </div>`;
}

function renderEmptyState(container, msg = 'لا توجد منتجات حالياً') {
  if (!container) return;
  const isSearch = /بحث|تطابق/.test(msg);
  replaceChildrenFromHtml(container, buildEmptyProductsStateHtml(msg, { variant: isSearch ? 'search' : 'default' }));
}

window.applySettings   = applySettings;
window.initShopChrome  = initShopChrome;
window.initImageFallbacks = initImageFallbacks;
window.buildProductCardHtml  = buildProductCardHtml;
window.buildCategoryCardHtml = buildCategoryCardHtml;
window.resolveHomeCategoryImage = resolveHomeCategoryImage;
window.getProductDefaultImageUrl = getProductDefaultImageUrl;
window.resolveSubcategoryImage = resolveSubcategoryImage;
window.resolveSubcategoryChipEmoji = resolveSubcategoryChipEmoji;
window.renderSkeletons       = renderSkeletons;
window.renderHomeCategorySkeletons = renderHomeCategorySkeletons;
window.renderEmptyState      = renderEmptyState;
window.buildEmptyProductsStateHtml = buildEmptyProductsStateHtml;
window.getProductIcon        = getProductIcon;
window.pseudoReviewCountForProduct = pseudoReviewCountForProduct;
