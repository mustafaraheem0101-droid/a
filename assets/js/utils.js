/* utils.js — دوال مشتركة — نسخة احترافية */
'use strict';

var __offerCountdownTimer = null;

/** يمنع تشغيل مزامنة العرض أكثر من مرة (تكرار تحميل utils أو استدعاء يدوي). */
function markOfferSyncDone() {
  try {
    window.__pharmaOfferSyncDone = true;
  } catch (e) { /* ignore */ }
}

function hasOfferSyncAlreadyRun() {
  try {
    return window.__pharmaOfferSyncDone === true;
  } catch (e) {
    return false;
  }
}

/** قراءة فقط — لا تمسح التخزين (يُستخدم لكل التحقق من العرض). */
function readOfferSessionActive() {
  try {
    return sessionStorage.getItem('activeOffer') === 'true';
  } catch (e) {
    return false;
  }
}

function stopOfferCountdownUiCleanup() {
  if (__offerCountdownTimer) {
    clearInterval(__offerCountdownTimer);
    __offerCountdownTimer = null;
  }
  try {
    var b = document.getElementById('offerCountdownBar');
    if (b) b.remove();
    if (document.body) {
      document.body.classList.remove('pharma-offer-active', 'pharma-offer-urgent');
    }
  } catch (e) { /* ignore */ }
}

/**
 * يمسح خصم العرض بالكامل: localStorage + علامة الجلسة activeOffer + شريط العد التنازلي.
 */
function clearShelfPromoStorage() {
  try {
    localStorage.removeItem('discount');
    localStorage.removeItem('expiry');
    localStorage.removeItem('fromOffer');
    sessionStorage.removeItem('activeOffer');
  } catch (e) { /* ignore */ }
  stopOfferCountdownUiCleanup();
}

/** اسم واضح لاستدعاء واحد بعد الطلب — يعادل clearShelfPromoStorage */
function revokeDiscountAccess() {
  clearShelfPromoStorage();
}

/**
 * مرة واحدة لكل تحميل: يعتمد على localStorage أولاً (عرض QR صالح حتى انتهاء المدة).
 * إذا وُجدت بيانات صالحة ولم تكن جلسة المتصفح تحمل activeOffer (تحديث، تبويب جديد نفس الموقع) — يُعاد تفعيلها.
 * سابقاً كان يُمسح الخصم عند أي تحديث لأن sessionStorage قد لا يُنسخ بين التبويبات بينما localStorage يبقى.
 */
function syncOfferStorageOnPageLoad() {
  if (hasOfferSyncAlreadyRun()) return;
  markOfferSyncDone();
  try {
    const exp = localStorage.getItem('expiry');
    const expMs = exp != null ? parseInt(exp, 10) : NaN;
    const expValid = Number.isFinite(expMs) && Date.now() < expMs;
    const fromOffer = localStorage.getItem('fromOffer') === 'true';
    const raw = localStorage.getItem('discount');
    const n = raw != null ? parseInt(raw, 10) : NaN;
    const discValid = raw != null && raw !== '' && !Number.isNaN(n) && n > 0;
    const bundleOk = fromOffer && expValid && discValid;

    if (bundleOk) {
      try {
        sessionStorage.setItem('activeOffer', 'true');
      } catch (e2) { /* ignore */ }
      return;
    }

    if (!readOfferSessionActive()) {
      localStorage.removeItem('discount');
      localStorage.removeItem('expiry');
      localStorage.removeItem('fromOffer');
      return;
    }
    clearShelfPromoStorage();
  } catch (e) { /* ignore */ }
}
syncOfferStorageOnPageLoad();

/** هل تدفق العرض نشط؟ للقراءة فقط — لا يمسح التخزين (يمنع الوميض). */
function isOfferQrFlowActive() {
  try {
    if (!readOfferSessionActive()) return false;
    if (localStorage.getItem('fromOffer') !== 'true') return false;
    const exp = localStorage.getItem('expiry');
    if (exp == null || exp === '') return false;
    const expMs = parseInt(exp, 10);
    if (!Number.isFinite(expMs) || Date.now() >= expMs) return false;
    const raw = localStorage.getItem('discount');
    if (raw == null || raw === '') return false;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n <= 0) return false;
    return true;
  } catch (e) {
    return false;
  }
}

/** صفحة عروض QR فقط — ليس الرئيسية ولا الأقسام الأخرى. */
function isQrDiscountLandingPage() {
  try {
    var path = typeof location !== 'undefined' && location.pathname ? String(location.pathname) : '';
    return /qr-discount\.html$/i.test(path) || path.indexOf('qr-discount.html') !== -1;
  } catch (e) {
    return false;
  }
}

/**
 * شارات الخصم وأسعار الرف على البطاقات وصفحة المنتج — فقط على qr-discount.html.
 * جلسة العرض (السلة) تبقى عبر isOfferQrFlowActive + getShelfPromoDiscountPercent.
 */
function isOfferQrShelfPromoUiActive() {
  return typeof isOfferQrFlowActive === 'function' && isOfferQrFlowActive() && isQrDiscountLandingPage();
}

// ─── تنسيق السعر ─────────────────────────────────────────────────
function fmt(p) {
  if (!p && p !== 0) return 'السعر عند الطلب';
  const n = Number(p);
  if (isNaN(n)) return 'السعر عند الطلب';
  return n.toLocaleString('ar-IQ') + ' د.ع';
}

// ─── تنظيف HTML (منع XSS) ────────────────────────────────────────
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── تحويل النص إلى slug ─────────────────────────────────────────
function slugify(text) {
  return String(text || '').trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '');
}

// ─── تأخير تنفيذ دالة (debounce) ────────────────────────────────
function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── تنفيذ مرة واحدة فقط (throttle) ────────────────────────────
function throttle(fn, ms) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last < ms) return;
    last = now;
    return fn.apply(this, args);
  };
}

// ─── ساعات العمل ─────────────────────────────────────────────────
function getHours() {
  const open = settings.openHour ?? 15;
  const close = settings.closeHour ?? 24;
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Sunday .. 6=Saturday
  const offDays = Array.isArray(settings.offDays) ? settings.offDays : [];
  const isHoliday = offDays.includes(dayOfWeek);
  const isOpen = !isHoliday && hour >= open && hour < close;
  return { open, close, isOpen, isHoliday };
}

// ─── رابط واتساب ─────────────────────────────────────────────────
/**
 * تطبيع خفيف لنص واتساب (BOM، نقاط زخرفية) — يُبقى الإيموجي لأن واتساب يعرضه بشكل صحيح مع UTF-8.
 */
function sanitizeWhatsAppPrefillText(s) {
  if (s == null || s === '') return '';
  var t = String(s).replace(/\uFEFF/g, '');
  t = t.replace(/[\u2022\u2023\u2043\u2219\u25AA\u25AB\u25CF\u30FB]/g, '-');
  t = t.replace(/\u2014|\u2013|\u2010/g, ' - ');
  return t.replace(/\n{6,}/g, '\n\n\n\n\n').trim();
}

function buildWaUrl(text) {
  const waRaw = (typeof settings !== 'undefined' && settings && settings.whatsapp) ? settings.whatsapp : '9647711954040';
  const num = String(waRaw).replace(/\D/g, '');
  const safe = text ? sanitizeWhatsAppPrefillText(String(text)) : '';
  return 'https://wa.me/' + num + (safe ? '?text=' + encodeURIComponent(safe) : '');
}

/**
 * خصم العرض — للقراءة فقط؛ التنظيف يتم في syncOfferStorageOnPageLoad أو انتهاء العد التنازلي.
 */
function getShelfPromoDiscountPercent() {
  try {
    if (!readOfferSessionActive()) return 0;
    if (localStorage.getItem('fromOffer') !== 'true') return 0;
    const exp = localStorage.getItem('expiry');
    if (exp == null || exp === '') return 0;
    const expMs = parseInt(exp, 10);
    if (!Number.isFinite(expMs) || Date.now() >= expMs) return 0;
    const raw = localStorage.getItem('discount');
    if (raw == null || raw === '') return 0;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.min(100, Math.max(0, n));
  } catch (e) {
    return 0;
  }
}

function applyShelfPromoToPrice(basePrice, promoPct) {
  const b = Number(basePrice);
  if (!Number.isFinite(b) || b <= 0) return b;
  if (!promoPct || promoPct <= 0) return Math.round(b * 100) / 100;
  return Math.round(b * (1 - promoPct / 100) * 100) / 100;
}

/**
 * مفتاح مطابقة موحّد لـ slug القسم: أحرف صغيرة، إزالة مسافات وشرطات وشرطات سفلية؛ معرف رقمي كسلسلة موحّدة.
 * يضمن تطابق hair-care و hair_care و Hair Care مع haircare.
 */
function normalizeCategoryMatchKey(s) {
  if (s == null) return '';
  var t = String(s).trim();
  if (t === '') return '';
  if (/^\d+$/.test(t)) return String(parseInt(t, 10));
  return t.toLowerCase().replace(/[\s\-_]+/g, '');
}

/**
 * slug قسم موحّد يطابق الخادم (pharma_canonical_category_slug): cosmetics، vitamins، kids، oralcare، …
 */
function canonicalCategorySlug(s) {
  if (s == null) return '';
  var t = String(s).trim();
  if (t === '') return '';
  if (/^\d+$/.test(t)) return String(parseInt(t, 10));
  var k = normalizeCategoryMatchKey(t);
  var MAP = {
    beauty: 'cosmetics',
    cosmetic: 'cosmetics',
    cosmetics: 'cosmetics',
    baby: 'kids',
    children: 'kids',
    kids: 'kids',
    vitamin: 'vitamins',
    vitamins: 'vitamins',
    haircare: 'haircare',
    medicine: 'medicine',
    drugs: 'medicine',
    medical: 'medical',
    oral_care: 'oralcare',
    oralcare: 'oralcare',
    skincare: 'skincare',
    hygiene: 'hygiene',
    first_aid: 'first_aid',
    firstaid: 'first_aid'
  };
  if (MAP[k]) return MAP[k];
  if (/[\u0600-\u06FF]/.test(t)) {
    var collapsed = t.replace(/[\s\-_]+/g, '');
    var AR = {
      العنايةبالشعر: 'haircare',
      الفيتامينات: 'vitamins',
      الأطفال: 'kids',
      التجميل: 'cosmetics',
      العنايةبالفموالأسنان: 'oralcare',
      المستلزماتالطبية: 'medical',
      الأدوية: 'medicine'
    };
    if (AR[collapsed]) return AR[collapsed];
    return '';
  }
  return k;
}

/** أقسام مسموح بها لخصم QR — تجميل، عناية بالشعر، فيتامينات، أطفال (لا أدوية). */
var PHARMA_QR_SHELF_ALLOWED_CATEGORY_SLUGS = ['cosmetics', 'haircare', 'vitamins', 'kids'];

/**
 * يوحّد slug القسم مع ما يُخزَّن في المنتجات ومع includes/defaults.php:
 * الفيتامينات = vitamin | vitamins — الأطفال = baby — الأدوية = medicine | drugs — إلخ.
 * يدعم أيضاً عناوين عربية إن وُضعت في حقل cat.
 */
function normalizeQrShelfCategorySlug(slug) {
  var raw = String(slug == null ? '' : slug).trim();
  if (!raw) return '';
  var low = raw.toLowerCase();
  if (low === 'medicine' || low === 'drugs' || low === 'drug') return 'medicine';
  if (raw === 'الأدوية') return 'medicine';
  if (low === 'beauty' || low === 'cosmetics' || low === 'cosmetic') return 'cosmetics';
  if (low === 'vitamin' || low === 'vitamins') return 'vitamins';
  if (low === 'haircare') return 'haircare';
  if (low === 'baby' || low === 'kids' || low === 'children') return 'kids';
  if (raw === 'التجميل') return 'cosmetics';
  if (raw === 'العناية بالشعر') return 'haircare';
  if (raw === 'الفيتامينات' || raw === 'الفيتامين') return 'vitamins';
  if (raw === 'الأطفال') return 'kids';
  if (typeof canonicalCategorySlug === 'function') {
    var c = canonicalCategorySlug(raw);
    if (c) return c;
  }
  var collapsed = normalizeCategoryMatchKey(raw);
  return collapsed || low;
}

function isQrShelfMedicineCategorySlug(slug) {
  return normalizeQrShelfCategorySlug(slug) === 'medicine';
}

function isQrShelfCategorySlugAllowed(slug) {
  var s = normalizeQrShelfCategorySlug(slug);
  if (!s || s === 'medicine') return false;
  return PHARMA_QR_SHELF_ALLOWED_CATEGORY_SLUGS.indexOf(s) !== -1;
}

/** سطر سلة / منتج بقسم واحد فقط — بدون مصفوفة categories كاملة */
function isQrShelfLineSlugEligibleForPromo(slug) {
  if (!slug || String(slug).trim() === '') return false;
  if (isQrShelfMedicineCategorySlug(slug)) return false;
  return isQrShelfCategorySlugAllowed(slug);
}

function productPrimaryCategorySlugs(p) {
  if (!p || typeof p !== 'object') return [];
  if (Array.isArray(p.categories) && p.categories.length) {
    return p.categories.map(function (c) { return String(c); }).filter(function (x) { return x && String(x).trim() !== ''; });
  }
  if (p.cat != null && String(p.cat).trim() !== '') return [String(p.cat).trim()];
  if (p.category != null && String(p.category).trim() !== '') return [String(p.category).trim()];
  return [];
}

function isProductCategoryEligibleForQrShelfPromo(p) {
  var slugs = productPrimaryCategorySlugs(p);
  if (!slugs.length) return false;
  var i;
  for (i = 0; i < slugs.length; i++) {
    if (isQrShelfMedicineCategorySlug(slugs[i])) return false;
  }
  for (i = 0; i < slugs.length; i++) {
    if (isQrShelfCategorySlugAllowed(slugs[i])) return true;
  }
  return false;
}

/**
 * شريط عدّ تنازلي (30 دقيقة): تحديث كل ثانية؛ ≤5 دقائق = تحذير أحمر؛ عند الانتهاء ⛔ ثم إعادة تحميل.
 */
function initOfferCountdownUi() {
  stopOfferCountdownUiCleanup();
  if (typeof document === 'undefined' || !document.body) return;
  if (typeof isQrDiscountLandingPage === 'function' && !isQrDiscountLandingPage()) return;
  if (typeof isOfferQrFlowActive !== 'function' || !isOfferQrFlowActive()) return;

  var discountPageHref = 'qr-discount.html';
  try {
    discountPageHref = new URL('qr-discount.html', String(window.location.href)).href;
  } catch (e0) { /* keep relative */ }

  const bar = document.createElement('div');
  bar.id = 'offerCountdownBar';
  bar.className = 'offer-countdown-bar';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.innerHTML =
    '<a class="offer-countdown-bar__link" href="' + String(discountPageHref).replace(/"/g, '&quot;') + '" aria-label="فتح صفحة عروض QR الحصرية">' +
    '<div class="offer-countdown-bar__inner">' +
    '<span class="offer-countdown-bar__timer" id="offerCountdownTimer"></span>' +
    '<span class="offer-countdown-bar__warn" id="offerCountdownWarn" hidden>🔴 العرض على وشك الانتهاء!</span>' +
    '</div></a>';
  document.body.insertBefore(bar, document.body.firstChild);

  const timerEl = document.getElementById('offerCountdownTimer');
  const warnEl = document.getElementById('offerCountdownWarn');

  function tick() {
    if (typeof isOfferQrFlowActive !== 'function' || !isOfferQrFlowActive()) {
      if (typeof clearShelfPromoStorage === 'function') clearShelfPromoStorage();
      return;
    }
    const r = localStorage.getItem('expiry');
    const end = r != null ? parseInt(r, 10) : NaN;
    if (!Number.isFinite(end)) {
      if (typeof clearShelfPromoStorage === 'function') clearShelfPromoStorage();
      return;
    }
    const rem = end - Date.now();
    if (rem <= 0) {
      if (__offerCountdownTimer) {
        clearInterval(__offerCountdownTimer);
        __offerCountdownTimer = null;
      }
      if (timerEl) timerEl.textContent = '⛔ انتهى العرض';
      if (warnEl) warnEl.hidden = true;
      bar.classList.add('offer-countdown-bar--expired');
      document.body.classList.remove('pharma-offer-active', 'pharma-offer-urgent');
      try {
        localStorage.removeItem('discount');
        localStorage.removeItem('expiry');
        localStorage.removeItem('fromOffer');
        sessionStorage.removeItem('activeOffer');
      } catch (e) { /* ignore */ }
      if (typeof showToast === 'function') showToast('⛔ انتهى العرض', 'error');
      window.setTimeout(function () {
        stopOfferCountdownUiCleanup();
        window.location.reload();
      }, 750);
      return;
    }
    const totalSec = Math.max(0, Math.floor(rem / 1000));
    const m = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    const urgent = rem <= 5 * 60 * 1000;
    if (timerEl) timerEl.textContent = '⏳ باقي ' + mm + ':' + ss;
    bar.classList.toggle('offer-countdown-bar--urgent', urgent);
    document.body.classList.add('pharma-offer-active');
    document.body.classList.toggle('pharma-offer-urgent', urgent);
    if (warnEl) warnEl.hidden = !urgent;
  }

  tick();
  __offerCountdownTimer = setInterval(tick, 1000);
}

// ─── التحقق من صحة URL ────────────────────────────────────────────
function safeHref(val, fallback) {
  fallback = fallback !== undefined ? fallback : '#';
  if (!val || typeof val !== 'string') return fallback;
  const t = val.trim();
  if (!t) return fallback;
  // رفض الإيموجي
  if (/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/u.test(t)) return fallback;
  if (
    t.startsWith('http://') || t.startsWith('https://') ||
    t.startsWith('/') || t.startsWith('#') ||
    t.startsWith('tel:') || t.startsWith('mailto:') ||
    /^[a-zA-Z0-9_\-\.\/]+\.(html|php)(\?[^\s]*)?$/.test(t)
  ) return t;
  return fallback;
}

// ─── التحقق من src الصورة ────────────────────────────────────────
function safeImgSrc(val) {
  if (!val || typeof val !== 'string') return '';
  const t = val.trim();
  if (!t) return '';
  if (/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(t)) return '';
  if (t.startsWith('http://') || t.startsWith('https://') ||
      t.startsWith('/') || t.startsWith('data:image/')) return t;
  if (/^(images|uploads|assets)\//i.test(t)) {
    return typeof pharmaPublicAssetUrl === 'function' ? pharmaPublicAssetUrl('/' + t) : '/' + t;
  }
  return '';
}

/**
 * مجلد التطبيق على الخادم (مثال: /1/ عند فتح index من مجلد فرعي).
 * اختياري: <meta name="pharma-base-path" content="/myshop/"> لتثبيت المسار يدوياً.
 */
function getPharmaPublicBase() {
  try {
    const m = document.querySelector('meta[name="pharma-base-path"]');
    if (m) {
      const c = String(m.getAttribute('content') || '').trim();
      if (c) return c.endsWith('/') ? c : c + '/';
    }
  } catch (e) { /* ignore */ }
  const pathname = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '/';
  const i = pathname.lastIndexOf('/');
  if (i <= 0) return '/';
  return pathname.slice(0, i + 1);
}

/**
 * يضيف بادئة المجلد الفرعي لمسارات الصور والملفات العامة (/images/…، /assets/…).
 */
function pharmaPublicAssetUrl(path) {
  if (!path || typeof path !== 'string') return '';
  let t = path.trim().replace(/\\/g, '/');
  if (!t) return '';
  if (/^https?:\/\//i.test(t) || t.startsWith('data:')) return t;
  let base = getPharmaPublicBase();
  if (base === '/') base = '';
  else if (base.endsWith('/')) base = base.slice(0, -1);
  if (t.startsWith('/')) return (base || '') + t;
  return (base ? base + '/' : '/') + t.replace(/^\.\//, '');
}

/** يصلح مسارات محفوظة بخطأ مثل prod_YYYYMMDD..NNNN_ (نقطتان بدل _) */
function normalizeProductImagePath(path) {
  if (!path || typeof path !== 'string') return path;
  return path.replace(/(prod_\d{8})\.\.(\d+)_/gi, '$1_$2_');
}

/**
 * رقم هاتف لرسالة الطلب: يدعم 07XXXXXXXXX، +964 / 964، والأرقام العربية.
 * يُرجع سلسلة فارغة إذا كان الحقل فارغاً أو لا يحتوي أرقاماً كافية.
 */
function normalizeOrderPhoneForWa(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (!s) return '';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  let digits = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c >= '0' && c <= '9') digits += c;
    else {
      const j = ar.indexOf(c);
      if (j >= 0) digits += String(j);
    }
  }
  if (!digits) return '';
  let d = digits;
  if (d.startsWith('00964')) d = d.slice(5);
  else if (d.startsWith('964')) d = d.slice(3);
  if (d.length === 11 && d.startsWith('07')) return d;
  if (d.length > 11 && d.startsWith('07')) return d.slice(0, 11);
  if (d.length >= 10 && d[0] === '7') d = '0' + d.slice(0, 10);
  if (/^07\d{9}$/.test(d)) return d;
  if (/^7\d{9}$/.test(d)) return '0' + d;
  if (digits.length >= 6) return digits;
  return '';
}

// ─── توليد ID فريد ───────────────────────────────────────────────
function genId(prefix) {
  return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// ─── تنسيق التاريخ ───────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('ar-IQ', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── DOM helpers ─────────────────────────────────────────────────
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; }
function setVal(id, val)  { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function getVal(id)       { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function setChecked(id, v){ const el = document.getElementById(id); if (el) el.checked = !!v; }
function getChecked(id)   { const el = document.getElementById(id); return el ? el.checked : false; }
function showEl(id)       { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hideEl(id)       { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function toggleEl(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; }

// ─── HTML → children (template fragment، تحديث واحد للعقد) ────────
function replaceChildrenFromHtml(el, html) {
  if (!el) return;
  if (!html) {
    if (el.replaceChildren) el.replaceChildren();
    else el.innerHTML = '';
    return;
  }
  const t = document.createElement('template');
  t.innerHTML = html;
  if (el.replaceChildren) el.replaceChildren(t.content);
  else el.innerHTML = html;
}

// ─── تسجيل اختياري (لا يظهر في الطرفية إلا عند التفعيل) ───────────
function isPharmaDebugEnabled() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__PHARMA_DEBUG__ === true) return true;
    return window.localStorage.getItem('pharmaDebug') === '1';
  } catch (_) {
    return false;
  }
}

/** تحذيرات/أخطاء التطوير: localStorage.pharmaDebug = '1' أو window.__PHARMA_DEBUG__ = true */
function pharmaLogWarn(scope, ...args) {
  if (isPharmaDebugEnabled()) console.warn(scope, ...args);
}

function pharmaLogError(scope, err) {
  if (isPharmaDebugEnabled()) console.error(scope, err);
}

// ─── Toast / loader (مشترك: المتجر + لوحة التحكم) ───────────────
function showToast(msg, type = 'success', duration = 2600) {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'show' + (type === 'error' ? ' toast--error' : type === 'info' ? ' toast--info' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/**
 * يحمّل أنماط الـ loader من ملف خارجي (بدون حقن عنصر style — CSP).
 */
function ensurePharmaCspJsShimCss() {
  if (document.getElementById('pharma-csp-js-shim')) return;
  const link = document.createElement('link');
  link.id = 'pharma-csp-js-shim';
  link.rel = 'stylesheet';
  const href = typeof pharmaPublicAssetUrl === 'function'
    ? pharmaPublicAssetUrl('/assets/css/csp-js-shim.css')
    : '/assets/css/csp-js-shim.css';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * شاشة تحميل عامة على الصفحات التي لا تتضمن #_globalLoader في HTML.
 */
function ensureGlobalLoader() {
  if (document.getElementById('_globalLoader')) return;
  ensurePharmaCspJsShimCss();
  const el = document.createElement('div');
  el.id = '_globalLoader';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'جارٍ التحميل');
  el.innerHTML = '<div class="gl-spin" aria-hidden="true"></div>';
  const first = document.body && document.body.firstChild;
  if (first) document.body.insertBefore(el, first);
  else document.body.appendChild(el);
}

let _loaderCount = 0;

function showLoader(targetId) {
  _loaderCount++;
  if (targetId) {
    const el = document.getElementById(targetId);
    if (el) el.setAttribute('aria-busy', 'true');
  }
  const gl = document.getElementById('_globalLoader');
  if (gl) gl.classList.add('is-active');
}

function hideLoader(targetId) {
  _loaderCount = Math.max(0, _loaderCount - 1);
  if (targetId) {
    const el = document.getElementById(targetId);
    if (el) el.removeAttribute('aria-busy');
  }
  if (_loaderCount === 0) {
    const gl = document.getElementById('_globalLoader');
    if (gl) gl.classList.remove('is-active');
  }
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.textContent = '⏳ جارٍ الحفظ...';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.origText || btn.textContent;
    btn.disabled = false;
  }
}

function confirmDialog(msg, onConfirm) {
  let dlg = document.getElementById('_confirmDlg');
  if (!dlg) {
    dlg = document.createElement('div');
    dlg.id = '_confirmDlg';
    dlg.className = 'modal-ov';
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    dlg.innerHTML = `<div class="modal-box" style="max-width:380px;text-align:center">
      <p id="_confirmMsg" style="font-size:16px;font-weight:700;margin:0 0 24px;color:#0a1628"></p>
      <div style="display:flex;gap:12px;justify-content:center">
        <button id="_confirmOk" class="btn-sm btn-danger" style="padding:10px 28px;font-size:14px">تأكيد الحذف</button>
        <button id="_confirmCancel" class="btn-sm btn-ghost" style="padding:10px 28px;font-size:14px">إلغاء</button>
      </div>
    </div>`;
    document.body.appendChild(dlg);
    document.getElementById('_confirmCancel').addEventListener('click', () => { dlg.style.display = 'none'; });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.style.display = 'none'; });
  }
  document.getElementById('_confirmMsg').textContent = msg;
  dlg.style.display = 'flex';
  const okBtn = document.getElementById('_confirmOk');
  const newOk = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  newOk.addEventListener('click', () => { dlg.style.display = 'none'; onConfirm(); });
}

// ─── روابط المنتج + واتساب ───────────────────────────────────────
/**
 * رابط صفحة المنتج: يفضّل ?slug=كلمة-وصفية عند وجود slug (أقصر وأوضح من الرقم)
 * وإلا يستخدم ?id= المعرف الداخلي فقط.
 */
function productPageUrl(p) {
  if (!p || p.id == null) return 'product.html';
  const slug = p.slug && String(p.slug).trim();
  if (slug) return 'product.html?slug=' + encodeURIComponent(slug);
  return 'product.html?id=' + encodeURIComponent(p.id);
}

function resolveProductPublicUrl(p) {
  try {
    return new URL(productPageUrl(p), window.location.href).href;
  } catch (e) {
    return productPageUrl(p);
  }
}

function buildProductWaOrderText(p) {
  const name = (p && p.name) ? String(p.name).trim() : 'المنتج';
  const priceLine = typeof fmt === 'function' ? fmt(p.price) : String(p.price ?? '');
  const url = resolveProductPublicUrl(p);
  /* سطور بعناوين عربية + رابط في سطر منفصل يقلّل خلط الاتجاه (RTL/LTR) في معاينة واتساب */
  return [
    'مرحباً،',
    '',
    'أود طلب المنتج التالي:',
    '',
    '📦 المنتج: ' + name,
    '💰 السعر: ' + priceLine,
    '',
    '🔗 رابط الصفحة:',
    url,
    '',
    'هل المنتج متوفر؟ يرجى التأكيد وسأكمل الطلب بعد موافقتكم.',
    '',
    'شكراً لكم 🙏'
  ].join('\n');
}

/**
 * نص واتساب لزر «اسأل صيدلي» — منتج + رابط الصفحة + طلب استشارة قبل الشراء.
 */
function buildProductPharmacistConsultText(p) {
  const name = (p && p.name) ? String(p.name).trim() : 'المنتج';
  let url = '';
  try {
    url = typeof resolveProductPublicUrl === 'function' ? resolveProductPublicUrl(p) : '';
  } catch (e) {
    url = '';
  }
  if (!url && typeof productPageUrl === 'function' && p) {
    url = productPageUrl(p);
  }
  return [
    '🩺 استفسار صيدلاني',
    '',
    'المنتج: ' + name,
    'الرابط: ' + (url || ''),
    '',
    'أحتاج استشارة قبل الشراء'
  ].join('\n').trim();
}

/** نص واتساب للاستشارة من الصفحة الرئيسية / بانر الهيرو (بدون منتج محدد). */
function buildSitePharmacistConsultText() {
  var pageUrl = '';
  try {
    if (typeof window !== 'undefined' && window.location && window.location.href) {
      pageUrl = String(window.location.href).split('#')[0];
    }
  } catch (e) {
    pageUrl = '';
  }
  return [
    '🩺 استفسار صيدلاني',
    '',
    'الرابط: ' + pageUrl,
    '',
    'أحتاج استشارة قبل الشراء'
  ].join('\n').trim();
}

/**
 * رابط صورة مطلق لبند السلة (واتساب لا يُرفق ملفات عبر الرابط — نرسل الرابط لمعاينة الصورة).
 */
function cartItemAbsoluteImageUrl(it) {
  if (typeof window === 'undefined') return '';
  const raw = it && (it.image || it.img) ? String(it.image || it.img).trim() : '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  var rel = '';
  try {
    rel = typeof pharmaPublicAssetUrl === 'function' ? pharmaPublicAssetUrl(raw) : '';
  } catch (e) {
    rel = '';
  }
  if (!rel) rel = raw.indexOf('/') === 0 ? raw : '/' + raw.replace(/^\.\//, '');
  try {
    return new URL(rel, window.location.origin).href;
  } catch (e2) {
    return '';
  }
}

/** كمية وسعر وحدة ومجموع سطر للسلة (واتساب + ملخص النافذة) */
function cartItemQtyUnitSubtotal(it) {
  const qty = Math.max(1, parseInt(String((it && it.qty) || 1), 10) || 1);
  const unitNum = Number(it && it.price != null ? it.price : 0);
  const subtotal = unitNum * qty;
  var unitDisplay = '';
  try {
    unitDisplay = unitNum.toLocaleString('ar-IQ');
  } catch (e) {
    unitDisplay = String(unitNum);
  }
  return { qty: qty, unitNum: unitNum, unitDisplay: unitDisplay, subtotal: subtotal };
}

/**
 * قسم المنتجات فقط (نفس تنسيق رسالة الطلب الطويلة)
 */
function buildCartItemsDetailsForWa(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return items.map(function (it) {
    return formatWaCartItemBlock(it);
  }).join('\n\n');
}

function formatWaCartItemBlock(it) {
  const name = (it && it.name) ? String(it.name) : 'منتج';
  const u = cartItemQtyUnitSubtotal(it);
  const listU = Number(it.listPrice != null ? it.listPrice : u.unitNum);
  const listUnitSafe = Number.isFinite(listU) && listU >= 0 ? listU : u.unitNum;
  const lineBefore = listUnitSafe * u.qty;
  const lineAfter = u.subtotal;
  var block = '* ' + name + '\n';
  block += '  السعر: ' + (typeof fmt === 'function' ? fmt(lineAfter) : String(lineAfter)) + '\n';
  block += '  السعر قبل الخصم: ' + (typeof fmt === 'function' ? fmt(lineBefore) : String(lineBefore));
  return block;
}

/** هل تُعرض جملة «تم استخدام خصم QR Code» في رسالة واتساب؟ */
function shouldShowWaCartQrDiscountLine(items) {
  if (!Array.isArray(items) || !items.length) return false;
  return items.some(function (it) { return it && it.isDiscounted === true; });
}

/** عنصر `<li>` لملخص الطلب في نافذة التأكيد (نفس الأرقام والرموز) */
function cartItemModalSummaryLiHtml(i) {
  const name = (i && i.name) ? String(i.name) : 'منتج';
  const u = cartItemQtyUnitSubtotal(i);
  var strikeLine = '';
  if (i && i.isDiscounted) {
    var lu = Number(i.listPrice != null ? i.listPrice : u.unitNum);
    if (Number.isFinite(lu) && lu > u.unitNum) {
      var subAtList = lu * u.qty;
      strikeLine = '<div class="mo-sum-strike">' + (typeof fmt === 'function' ? fmt(subAtList) : String(subAtList)) + '</div>';
    }
  }
  return '<li class="mo-sum-item">' +
    '<div>📦 ' + escHtml(name) + '</div>' +
    strikeLine +
    '<div>🔢 ' + u.qty + ' × ' + u.unitDisplay + ' د.ع</div>' +
    '<div>💰 ' + (typeof fmt === 'function' ? fmt(u.subtotal) : String(u.subtotal)) + '</div>' +
    '</li>';
}

/**
 * قالب واتساب لزوار عرض QR (localStorage.fromOffer) — تفاصيل سطر السعر قبل/بعد + جملة الخصم عند وجود خصم فعلي.
 */
function buildWhatsAppCartOrderMessageQrOffer(params) {
  params = params || {};
  const name = params.name != null ? String(params.name).trim() : '';
  const phone = params.phone != null ? String(params.phone) : '';
  const addr = params.addr != null ? String(params.addr) : '';
  const notes = params.notes != null ? String(params.notes) : '';
  const cart = Array.isArray(params.cart) ? params.cart : [];
  const total = typeof params.total === 'number' && !isNaN(params.total) ? params.total : 0;
  const lines = [];
  lines.push('مرحبا 👋');
  lines.push('أرغب بطلب المنتجات التالية:');
  lines.push('');
  if (name) lines.push('👤 الاسم: ' + name);
  if (phone) lines.push('📞 الهاتف: ' + phone);
  if (addr) lines.push('📍 العنوان: ' + addr);
  if (name || phone || addr) lines.push('');
  lines.push('🛒 الطلب:');
  lines.push('');
  if (cart.length) {
    lines.push(buildCartItemsDetailsForWa(cart));
    lines.push('');
  }
  lines.push('💰 المجموع: ' + (typeof fmt === 'function' ? fmt(total) : String(total)));
  lines.push('');
  if (shouldShowWaCartQrDiscountLine(cart)) {
    lines.push('🎁 تم استخدام خصم QR Code');
    lines.push('');
  }
  lines.push('📍 الرجاء تأكيد توفر المنتجات وإتمام الطلب');
  lines.push('شكراً لكم 🙏');
  if (notes) {
    lines.push('');
    lines.push('📝 ملاحظات: ' + notes);
  }
  return lines.join('\n');
}

/**
 * رسالة طلب السلة لواتساب — للزوار العاديين بدون قالب عرض QR؛ معطيات الاتصال + أسماء المنتجات بدون جملة خصم QR.
 */
function buildWhatsAppCartOrderMessage(params) {
  params = params || {};
  var fromOffer = false;
  try {
    fromOffer = localStorage.getItem('fromOffer') === 'true';
  } catch (e) {
    fromOffer = false;
  }
  if (fromOffer) {
    return buildWhatsAppCartOrderMessageQrOffer(params);
  }

  const name = params.name != null ? String(params.name) : '';
  const phone = params.phone != null ? String(params.phone) : '';
  const addr = params.addr != null ? String(params.addr) : '';
  const notes = params.notes != null ? String(params.notes) : '';
  const cart = Array.isArray(params.cart) ? params.cart : [];
  const total = typeof params.total === 'number' && !isNaN(params.total) ? params.total : 0;
  const lines = [];
  lines.push('مرحبا 👋');
  lines.push('أرغب بطلب المنتجات التالية:');
  lines.push('');
  if (name) lines.push('👤 الاسم: ' + name);
  if (phone) lines.push('📞 الهاتف: ' + phone);
  if (addr) lines.push('📍 العنوان: ' + addr);
  if (name || phone || addr) lines.push('');
  lines.push('🛒 الطلب:');
  lines.push('');
  if (cart.length) {
    lines.push(buildCartItemsDetailsForWa(cart));
    lines.push('');
  }
  lines.push('💰 المجموع: ' + (typeof fmt === 'function' ? fmt(total) : String(total)));
  lines.push('');
  lines.push('📍 الرجاء تأكيد توفر المنتجات وإتمام الطلب');
  lines.push('شكراً لكم 🙏');
  if (notes) {
    lines.push('');
    lines.push('📝 ملاحظات: ' + notes);
  }
  return lines.join('\n');
}

/**
 * رسالة جاهزة لعدة منتجات (مشاركة سريعة / نسخ) — بدون دفع
 */
function buildMultiProductWaOrderText(items) {
  if (!Array.isArray(items) || !items.length) return '';
  const sep = '━━━━━━━━━━━━━━━';
  return [
    '📦 *استفسار عن منتجات:*',
    '',
    sep,
    '',
    buildCartItemsDetailsForWa(items),
    '',
    sep,
    '',
    '📲 *يرجى تأكيد التوفر والسعر*'
  ].join('\n');
}

function trackWaClick(productId) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('track_wa_event', { event: 'wa_click', product_id: String(productId || '') }, 'POST').catch(function () {});
}

function logWhatsappCartIntent(items) {
  if (typeof apiFetch !== 'function' || !items || !items.length) return;
  apiFetch('log_whatsapp_intent', { items: items, source: 'cart' }, 'POST').catch(function () {});
}

// ─── احتفال دخول الصفحة الرئيسية عبر رابط QR ─────────────────────
var PHARMA_INDEX_QR_WELCOME_KEY = 'pharma_index_qr_welcome_v1';

function prefersReducedMotionIndexQr() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

/** يُستخدم في QR للرئيسية: ?from=qr أو ?qr=welcome أو ?utm_source=qr */
function isIndexQrWelcomeQuery() {
  try {
    var sp = new URL(window.location.href).searchParams;
    if (sp.get('from') === 'qr') return true;
    if (sp.get('welcome') === 'qr') return true;
    if (sp.get('utm_source') === 'qr') return true;
    var qv = sp.get('qr');
    if (qv === '1' || qv === 'true' || qv === 'welcome') return true;
    return false;
  } catch (e) {
    return false;
  }
}

function stripIndexQrWelcomeParamsFromUrl() {
  try {
    var u = new URL(window.location.href);
    var sp = u.searchParams;
    var changed = false;
    if (sp.get('from') === 'qr') {
      sp.delete('from');
      changed = true;
    }
    if (sp.get('welcome') === 'qr') {
      sp.delete('welcome');
      changed = true;
    }
    if (sp.get('utm_source') === 'qr') {
      sp.delete('utm_source');
      changed = true;
    }
    var qv = sp.get('qr');
    if (qv === '1' || qv === 'true' || qv === 'welcome') {
      sp.delete('qr');
      changed = true;
    }
    if (!changed) return;
    var qs = sp.toString();
    window.history.replaceState({}, '', u.pathname + (qs ? '?' + qs : '') + u.hash);
  } catch (e) { /* ignore */ }
}

function launchIndexQrWelcomeConfetti() {
  if (typeof document === 'undefined' || !document.body) return;
  if (prefersReducedMotionIndexQr()) return;
  var layer = document.createElement('div');
  layer.className = 'index-qr-welcome-layer';
  layer.setAttribute('aria-hidden', 'true');
  var colors = ['#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#eab308', '#a855f7', '#ef4444'];
  var n = 52;
  var i;
  for (i = 0; i < n; i++) {
    var piece = document.createElement('span');
    piece.className = 'index-qr-welcome-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[i % colors.length];
    var dur = 1.4 + Math.random() * 1.4;
    var dx = (Math.random() * 200 - 100).toFixed(1) + 'px';
    var rot = Math.floor(360 + Math.random() * 720) + 'deg';
    piece.style.setProperty('--iq-dx', dx);
    piece.style.setProperty('--iq-rot', rot);
    piece.style.animation = 'index-qr-confetti-fall ' + dur + 's linear forwards';
    piece.style.animationDelay = Math.random() * 0.28 + 's';
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  window.setTimeout(function () {
    if (layer.parentNode) layer.parentNode.removeChild(layer);
  }, 3600);
}

function playIndexQrWelcomeChime() {
  if (prefersReducedMotionIndexQr()) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    function ding() {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      var t0 = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, t0);
      osc.frequency.exponentialRampToValueAtTime(659.25, t0 + 0.08);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.065, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    }
    var p = ctx.resume ? ctx.resume() : Promise.resolve();
    p.then(ding).catch(ding);
  } catch (e) { /* ignore */ }
}

/**
 * استدعاء من الصفحة الرئيسية فقط: إن وُجدت معلمات دخول QR يُعرض احتفال مرة واحدة لكل جلسة.
 * مثال رابط للطباعة على QR: https://نطاقك/?from=qr
 */
function initIndexQrWelcomeCelebration() {
  if (!isIndexQrWelcomeQuery()) return;
  try {
    if (sessionStorage.getItem(PHARMA_INDEX_QR_WELCOME_KEY) === '1') return;
  } catch (e) { /* ignore */ }
  try {
    sessionStorage.setItem(PHARMA_INDEX_QR_WELCOME_KEY, '1');
  } catch (e2) { /* ignore */ }

  stripIndexQrWelcomeParamsFromUrl();

  window.requestAnimationFrame(function () {
    if (prefersReducedMotionIndexQr()) {
      if (typeof showToast === 'function') showToast('🎉 أهلاً بك — سعداء بزيارتك عبر رمز QR!');
      return;
    }
    launchIndexQrWelcomeConfetti();
    if (typeof showToast === 'function') {
      showToast('🎉 أهلاً بك — سعداء بزيارتك عبر رمز QR!');
    }
    playIndexQrWelcomeChime();
  });
}

// ─── expose ──────────────────────────────────────────────────────
window.fmt        = fmt;
window.escHtml    = escHtml;
window.slugify    = slugify;
window.debounce   = debounce;
window.throttle   = throttle;
window.getHours   = getHours;
window.buildWaUrl = buildWaUrl;
window.getShelfPromoDiscountPercent = getShelfPromoDiscountPercent;
window.applyShelfPromoToPrice = applyShelfPromoToPrice;
window.isQrShelfCategorySlugAllowed = isQrShelfCategorySlugAllowed;
window.isQrShelfLineSlugEligibleForPromo = isQrShelfLineSlugEligibleForPromo;
window.productPrimaryCategorySlugs = productPrimaryCategorySlugs;
window.isProductCategoryEligibleForQrShelfPromo = isProductCategoryEligibleForQrShelfPromo;
window.normalizeCategoryMatchKey = normalizeCategoryMatchKey;
window.canonicalCategorySlug = canonicalCategorySlug;
window.clearShelfPromoStorage = clearShelfPromoStorage;
window.revokeDiscountAccess = revokeDiscountAccess;
window.syncOfferStorageOnPageLoad = syncOfferStorageOnPageLoad;
window.stopOfferCountdownUiCleanup = stopOfferCountdownUiCleanup;
window.initOfferCountdownUi = initOfferCountdownUi;
window.isOfferQrFlowActive = isOfferQrFlowActive;
window.isQrDiscountLandingPage = isQrDiscountLandingPage;
window.isOfferQrShelfPromoUiActive = isOfferQrShelfPromoUiActive;
window.sanitizeWhatsAppPrefillText = sanitizeWhatsAppPrefillText;
window.safeHref   = safeHref;
window.safeImgSrc = safeImgSrc;
window.getPharmaPublicBase = getPharmaPublicBase;
window.pharmaPublicAssetUrl = pharmaPublicAssetUrl;
window.normalizeProductImagePath = normalizeProductImagePath;
window.normalizeOrderPhoneForWa = normalizeOrderPhoneForWa;
window.genId      = genId;
window.formatDate = formatDate;
window.setText    = setText;
window.setVal     = setVal;
window.getVal     = getVal;
window.setChecked = setChecked;
window.getChecked = getChecked;
window.showEl     = showEl;
window.hideEl     = hideEl;
window.toggleEl   = toggleEl;
window.replaceChildrenFromHtml = replaceChildrenFromHtml;
window.isPharmaDebugEnabled   = isPharmaDebugEnabled;
window.pharmaLogWarn          = pharmaLogWarn;
window.pharmaLogError         = pharmaLogError;
window.showToast              = showToast;
window.showLoader             = showLoader;
window.hideLoader             = hideLoader;
window.ensurePharmaCspJsShimCss = ensurePharmaCspJsShimCss;
window.ensureGlobalLoader      = ensureGlobalLoader;
window.setButtonLoading       = setButtonLoading;
window.confirmDialog          = confirmDialog;
window.productPageUrl         = productPageUrl;
window.resolveProductPublicUrl = resolveProductPublicUrl;
window.buildProductWaOrderText = buildProductWaOrderText;
window.buildProductPharmacistConsultText = buildProductPharmacistConsultText;
window.buildSitePharmacistConsultText = buildSitePharmacistConsultText;
window.buildMultiProductWaOrderText = buildMultiProductWaOrderText;
window.buildCartItemsDetailsForWa = buildCartItemsDetailsForWa;
window.buildWhatsAppCartOrderMessage = buildWhatsAppCartOrderMessage;
window.buildWhatsAppCartOrderMessageQrOffer = buildWhatsAppCartOrderMessageQrOffer;
window.cartItemModalSummaryLiHtml = cartItemModalSummaryLiHtml;
window.cartItemAbsoluteImageUrl = cartItemAbsoluteImageUrl;
window.trackWaClick           = trackWaClick;
window.logWhatsappCartIntent  = logWhatsappCartIntent;
window.initIndexQrWelcomeCelebration = initIndexQrWelcomeCelebration;
