/* api.js — استدعاءات API المركزية — استجابة موحّدة { status, data, message } */
'use strict';

if (typeof window.API === 'undefined') window.API = 'api.php';

const _pendingRequests = new Map();

/** رمز CSRF للوحة التحكم (meta في control-panel أو window.__ADMIN_API_CSRF بعد login عبر API). */
function adminApiGetCsrf() {
  var m = document.querySelector('meta[name="admin-api-csrf"]');
  if (m && m.content) return String(m.content).trim();
  if (typeof window.__ADMIN_API_CSRF === 'string' && window.__ADMIN_API_CSRF) {
    return String(window.__ADMIN_API_CSRF).trim();
  }
  return '';
}

/** يجب أن يطابق PRODUCTS_PER_PAGE في main.js — قسم «كل المنتجات» في الرئيسية */
var HOME_ALL_PRODUCTS_PAGE_SIZE = 8;

/** نجاح الاستجابة من api.php */
function apiIsSuccess(res) {
  return res && res.status === 'success';
}

/** رسالة خطأ آمنة للعرض */
function apiErrorMessage(res) {
  if (!res) return 'خطأ غير معروف';
  return res.message || res.error || '';
}

/**
 * مصفوفة المنتجات من كائن data لاستجابة getProducts.
 * يدعم { products } و { data: { products } } (تعشيش زائد من بعض البروكسيات/النسخ القديمة).
 */
function pickAdminProductsFromData(d) {
  if (!d || typeof d !== 'object') return [];
  if (Array.isArray(d.products)) return d.products;
  if (d.data && typeof d.data === 'object' && Array.isArray(d.data.products)) {
    return d.data.products;
  }
  return [];
}

/** حقول pagination من استجابة getProducts (page / per_page أو limit / total / total_pages) */
function pickProductsPaginationFromData(d) {
  if (!d || typeof d !== 'object') return null;
  var p = d.pagination;
  if (!p || typeof p !== 'object') return null;
  var total = Number(p.total);
  if (!Number.isFinite(total)) total = 0;
  var per = Number(p.per_page);
  if (!Number.isFinite(per) || per < 1) per = 8;
  var page = Number(p.page);
  if (!Number.isFinite(page) || page < 1) page = 1;
  var tp = Number(p.total_pages);
  if (!Number.isFinite(tp) || tp < 0) {
    tp = total > 0 ? Math.max(1, Math.ceil(total / per)) : 0;
  }
  return { page: page, per_page: per, total: total, total_pages: tp };
}

/** حقل من data عند النجاح فقط — المصفوفات تُمرَّر عبر coerceApiArray (يدعم JSON كنص) */
function apiPick(res, key, fallback) {
  if (!apiIsSuccess(res) || !res.data) return fallback;
  var v = res.data[key];
  var listKeys = {
    products: 1,
    categories: 1,
    subcategories: 1,
    orders: 1,
    reviews: 1,
    customers: 1
  };
  if (listKeys[key]) {
    return coerceApiArray(v !== undefined && v !== null ? v : fallback);
  }
  return v !== undefined && v !== null ? v : fallback;
}

/**
 * تفعيل السجلات: localStorage.setItem('pharma_api_debug', '1') ثم أعد تحميل الصفحة
 * (أو عيّن القيمة ثم نفّذ طلبات جديدة — يُقرأ localStorage في كل مرة).
 */
function getApiDebug() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('pharma_api_debug') === '1';
  } catch (e) {
    return false;
  }
}

/** طباعة آمنة للكونسول بدون طيّ `{...}` — نص JSON كامل (مع حد أقصى للحجم) */
function stringifyDebugPayload(obj, maxLen) {
  var lim = maxLen != null ? maxLen : 200000;
  try {
    var s = JSON.stringify(obj, null, 2);
    if (s.length > lim) return s.slice(0, lim) + '\n… [مقصوص — زِد الحد في stringifyDebugPayload إن لزم]';
    return s;
  } catch (e) {
    try {
      return String(obj);
    } catch (e2) {
      return '[تعذر التحويل لنص]';
    }
  }
}

/** متوافق مع الكود القديم */
function apiDebugEnabled() {
  try {
    if (typeof window !== 'undefined' && window.__PHARMA_API_DEBUG === true) return true;
  } catch (e) { /* ignore */ }
  return getApiDebug();
}

function logAPIRequest(name, info) {
  if (!getApiDebug()) return;
  if (info != null && typeof info === 'object') {
    console.log('[Pharma API → REQUEST] ' + name + '\n' + stringifyDebugPayload(info));
  } else {
    console.log('[Pharma API → REQUEST] ' + name, info);
  }
}

function logAPI(name, response) {
  if (!getApiDebug()) return;
  if (response != null && typeof response === 'object') {
    console.log('[Pharma API] ' + name + '\n' + stringifyDebugPayload(response));
  } else {
    console.log('[Pharma API] ' + name, response);
  }
}

/**
 * يحوّل قيمة من الـ API إلى مصفوفة (يدعم JSON كنص).
 */
function coerceApiArray(val) {
  if (Array.isArray(val)) return val;
  if (val == null || val === '') return [];
  if (typeof val === 'string') {
    var t = val.trim();
    if (t.charAt(0) === '[' || t.charAt(0) === '{') {
      try {
        var p = JSON.parse(t);
        return Array.isArray(p) ? p : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }
  return [];
}

function normalizeProductFromApi(p) {
  if (!p || typeof p !== 'object') return p;
  var o = Object.assign({}, p);
  /** بعض السجلات القديمة أو الاستيراد تترك name فارغاً — الواجهة تعتمد على name للعنوان */
  (function resolveProductName() {
    var nm = o.name != null ? String(o.name).trim() : '';
    if (nm === '') {
      var alt = [o.title, o.product_name, o.productName, o.label, o.name_ar, o.ar_name, o.arabic_name]
        .map(function (x) { return x != null ? String(x).trim() : ''; })
        .find(function (s) { return s !== ''; });
      if (alt) o.name = alt;
      nm = o.name != null ? String(o.name).trim() : '';
    }
    if (nm === '' && o.slug != null && String(o.slug).trim() !== '') {
      var s = String(o.slug).trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (s) o.name = s.charAt(0).toUpperCase() + s.slice(1);
      nm = o.name != null ? String(o.name).trim() : '';
    }
    if (nm === '') {
      o.name = o.id != null && String(o.id).trim() !== '' ? 'منتج #' + String(o.id) : 'منتج';
    }
  })();
  if (typeof o.cat === 'string' && o.cat.trim().charAt(0) === '[') {
    var ac0 = coerceApiArray(o.cat);
    if (ac0.length) o.cat = ac0[0];
  }
  var normCat =
    typeof window !== 'undefined' && typeof window.normalizeCategoryMatchKey === 'function'
      ? window.normalizeCategoryMatchKey
      : function (x) {
        var t = String(x == null ? '' : x).trim();
        if (t === '') return '';
        if (/^\d+$/.test(t)) return String(parseInt(t, 10));
        return t.toLowerCase().replace(/[\s\-_]+/g, '');
      };
  var canon =
    typeof window !== 'undefined' && typeof window.canonicalCategorySlug === 'function'
      ? window.canonicalCategorySlug
      : normCat;
  var rawCats = coerceApiArray(o.categories);
  var seen = Object.create(null);
  o.categories = [];
  for (var ci = 0; ci < rawCats.length; ci++) {
    var tok = canon(rawCats[ci]);
    if (tok && !seen[tok]) {
      seen[tok] = true;
      o.categories.push(tok);
    }
  }
  if (o.category != null && String(o.category).trim() !== '') {
    var pk = canon(o.category);
    if (pk && !seen[pk]) {
      o.categories.unshift(pk);
      seen[pk] = true;
    }
  }
  if (o.categories.length === 0 && o.cat != null && String(o.cat).trim() !== '') {
    var ck = canon(o.cat);
    if (ck) {
      o.categories.push(ck);
    }
  }
  o.category = o.categories[0] || '';
  o.cat = o.category;
  o.subcategories = coerceApiArray(o.subcategories).map(function (x) {
    var n = Number(x);
    return Number.isNaN(n) ? x : n;
  });
  if (o.images && !Array.isArray(o.images)) o.images = coerceApiArray(o.images);
  (function syncLegacyImgKeys() {
    var pi = o.image != null ? String(o.image).trim() : '';
    var gi = o.img != null ? String(o.img).trim() : '';
    if (pi === '' && gi !== '') o.image = o.img;
    if (gi === '' && pi !== '') o.img = o.image;
  })();
  var altImg = o.image_url || o.thumbnail || o.photo || o.picture;
  var primaryEmpty = o.image == null || String(o.image).trim() === '';
  if (altImg && String(altImg).trim() !== '' && primaryEmpty) {
    o.image = String(altImg).trim();
    o.img = o.image;
  }
  function normalizeProductImageField(im) {
    if (!im || typeof im !== 'string') return im;
    var t = im.trim();
    if (!t || /^https?:\/\//i.test(t) || t.startsWith('/') || t.startsWith('data:')) return t;
    if (/^(images|uploads|assets)\//i.test(t)) return '/' + t.replace(/^\/+/, '');
    return t;
  }
  if (o.image) o.image = normalizeProductImageField(o.image);
  if (o.img) o.img = normalizeProductImageField(o.img);
  (function syncProductPrimaryImage() {
    function phIsPl(s) {
      if (!s || typeof s !== 'string') return true;
      var t = s.toLowerCase();
      return t.indexOf('placeholder.svg') !== -1 || t.indexOf('placeholder.png') !== -1;
    }
    if (phIsPl(o.img) && o.image && !phIsPl(String(o.image))) {
      o.img = o.image;
    }
    if ((!o.image || phIsPl(String(o.image))) && o.img && !phIsPl(String(o.img))) {
      o.image = o.img;
    }
    if (Array.isArray(o.images)) {
      o.images = o.images
        .map(function (im) {
          return normalizeProductImageField(im);
        })
        .filter(function (im) {
          return im && typeof im === 'string' && String(im).trim() !== '' && !phIsPl(String(im));
        });
    }
    if ((!o.images || !o.images.length) && o.image && !phIsPl(String(o.image))) {
      o.images = [o.image];
    }
  })();
  if (o.prescription_required === '1' || o.prescription_required === 1) o.prescription_required = true;
  if (o.hide_from_home === '1' || o.hide_from_home === 1) o.hide_from_home = true;
  if (o.hide_from_home === '0' || o.hide_from_home === 0) o.hide_from_home = false;
  if (o.bundle_ids && !Array.isArray(o.bundle_ids)) o.bundle_ids = coerceApiArray(o.bundle_ids);
  if (!o.createdAt && o.created_at) o.createdAt = o.created_at;
  if (!o.updatedAt && o.updated_at) o.updatedAt = o.updated_at;
  return o;
}

function normalizeOrderFromApi(o) {
  if (!o || typeof o !== 'object') return o;
  var x = Object.assign({}, o);
  if (!x.name && x.customer_name) x.name = x.customer_name;
  if (!x.createdAt && x.created_at) x.createdAt = x.created_at;
  x.items = coerceApiArray(x.items);
  return x;
}

/**
 * طلب JSON موحّد: fetch → json، إعادة المحاولة عند 5xx/شبكة
 * يمرّ كل طلب إلى api.php عبر هنا — السجلات تُفعَّل بـ logAPI / logAPIRequest
 * @returns {Promise<object>}
 */
async function fetchApiJson(url, fetchOpts = {}, options = {}) {
  var retries = options.retries !== undefined ? options.retries : 1;
  var logPrefix = options.logPrefix || 'api';
  var logContext = options.logContext || '';
  var timeoutMs = options.timeoutMs || 0;
  const actionName = logContext || (function (u) {
    var m = u.match(/[?&]action=([^&]*)/);
    return m ? decodeURIComponent(m[1]) : 'api';
  })(url);
  var rel = String(url).replace(/^\/+/, '');
  var pref = '';
  if (typeof getPharmaPublicBase === 'function') {
    var pb = getPharmaPublicBase();
    if (pb && pb !== '/') {
      pref = pb.endsWith('/') ? pb.slice(0, -1) : pb;
    }
  }
  url = pref ? (pref + '/' + rel) : ('/' + rel);

  const execute = async (attempt = 0) => {
    var merged = Object.assign({ credentials: 'same-origin' }, fetchOpts);
    var timeoutId = null;
    if (timeoutMs > 0 && typeof AbortController !== 'undefined' && !merged.signal) {
      var toCtrl = new AbortController();
      merged.signal = toCtrl.signal;
      timeoutId = setTimeout(function () {
        try {
          toCtrl.abort();
        } catch (e) { /* ignore */ }
      }, timeoutMs);
    }
    logAPIRequest(actionName, {
      phase: 'before_fetch',
      method: merged.method || 'GET',
      url: url,
      attempt: attempt
    });

    try {
      const r = await fetch(url, merged);
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      let body = null;

      if (ct.includes('application/json')) {
        try {
          body = await r.json();
        } catch (parseErr) {
          if (typeof pharmaLogWarn === 'function') {
            pharmaLogWarn('[' + logPrefix + ']', actionName, 'Invalid JSON body');
          }
          const errObj = { status: 'error', data: [], message: 'استجابة غير صالحة من الخادم' };
          logAPI(actionName, errObj);
          return errObj;
        }
      } else {
        const text = await r.text();
        if (!r.ok) {
          if (r.status >= 500 && attempt < retries) {
            await new Promise(function (res) { setTimeout(res, 600 * (attempt + 1)); });
            return execute(attempt + 1);
          }
          const errObj = { status: 'error', data: [], message: text ? text.slice(0, 200) : ('HTTP ' + r.status) };
          logAPI(actionName, errObj);
          return errObj;
        }
        const errObj = { status: 'error', data: [], message: 'توقع JSON ولم يُستلم' };
        logAPI(actionName, errObj);
        return errObj;
      }

      if (!r.ok) {
        if (r.status >= 500 && attempt < retries) {
          await new Promise(function (res) { setTimeout(res, 600 * (attempt + 1)); });
          return execute(attempt + 1);
        }
        const msg = (body && (body.message || body.msg)) ? (body.message || body.msg) : ('HTTP ' + r.status);
        if (body && body.status === 'error') {
          logAPI(actionName, body);
          return body;
        }
        const errObj = { status: 'error', data: (body && body.data) || [], message: String(msg) };
        logAPI(actionName, errObj);
        return errObj;
      }

      if (body && body.status) {
        logAPI(actionName, body);
        return body;
      }
      const bad = { status: 'error', data: [], message: 'شكل استجابة غير متوقع' };
      logAPI(actionName, bad);
      return bad;
    } catch (e) {
      if (attempt < retries && e.name !== 'AbortError') {
        await new Promise(function (res) { setTimeout(res, 600 * (attempt + 1)); });
        return execute(attempt + 1);
      }
      if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[' + logPrefix + ']', actionName, e.message || e);
      var abortMsg = e && e.name === 'AbortError'
        ? 'انتهت مهلة الطلب أو أُلغي'
        : (e.message || String(e));
      const errObj = { status: 'error', data: [], message: abortMsg };
      logAPI(actionName, errObj);
      return errObj;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };
  return execute();
}

/**
 * apiFetch — واجهة عامة (api.php)
 */
async function apiFetch(action, params = {}, method = 'GET', opts = {}) {
  const { retries = 1, dedup = false } = opts;
  const dedupKey = dedup ? action + '-' + JSON.stringify(params) : null;
  if (dedupKey && _pendingRequests.has(dedupKey)) return _pendingRequests.get(dedupKey);

  let url = API + '?action=' + encodeURIComponent(action);
  const fetchOpts = { method: method, credentials: 'same-origin' };
  if (method === 'POST') {
    fetchOpts.headers = { 'Content-Type': 'application/json' };
    fetchOpts.body = JSON.stringify(params);
  } else {
    Object.entries(params).forEach(function (kv) {
      const k = kv[0];
      const v = kv[1];
      if (v !== undefined && v !== null) url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
    });
  }

  const promise = fetchApiJson(url, fetchOpts, { retries: retries, logPrefix: 'api', logContext: action });
  if (dedupKey) {
    _pendingRequests.set(dedupKey, promise);
    promise.finally(function () { _pendingRequests.delete(dedupKey); });
  }
  return promise;
}

async function adminFetch(action, data, method, fetchOptions) {
  if (method === undefined) method = 'POST';
  if (data === undefined || data === null) data = {};
  if (fetchOptions === undefined) fetchOptions = {};
  let url = API + '?action=' + encodeURIComponent(action);
  const fetchOpts = { method: method, credentials: 'same-origin' };
  if (method === 'POST') {
    var csrf = adminApiGetCsrf();
    var payload = data && typeof data === 'object' && !Array.isArray(data) ? Object.assign({}, data) : {};
    if (csrf) {
      payload._csrf = csrf;
    }
    fetchOpts.headers = { 'Content-Type': 'application/json' };
    if (csrf) {
      fetchOpts.headers['X-Admin-CSRF'] = csrf;
    }
    fetchOpts.body = JSON.stringify(payload);
  } else {
    Object.keys(data).forEach(function (k) {
      url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
    });
  }
  var timeoutMs = fetchOptions.timeoutMs !== undefined ? fetchOptions.timeoutMs : 0;
  return fetchApiJson(url, fetchOpts, {
    retries: 1,
    logPrefix: 'admin-api',
    logContext: action,
    timeoutMs: timeoutMs
  });
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  var csrfUp = adminApiGetCsrf();
  if (csrfUp) {
    formData.append('_csrf', csrfUp);
  }
  const url = API + '?action=upload_image';
  const name = 'upload_image';
  logAPIRequest(name, { phase: 'before_fetch', method: 'POST', url: url, body: 'FormData(image)' });
  try {
    const r = await fetch(url, { method: 'POST', body: formData, credentials: 'same-origin' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
      if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[admin-api] upload_image', 'Non-JSON response');
      const errObj = { status: 'error', data: [], message: 'HTTP ' + r.status };
      logAPI(name, errObj);
      return errObj;
    }
    const j = await r.json();
    logAPI(name, j && typeof j === 'object' ? j : { status: 'error', data: [], message: 'Invalid JSON' });
    if (!r.ok) {
      const msg = (j && j.message) ? j.message : ('HTTP ' + r.status);
      return { status: 'error', data: (j && j.data) || [], message: msg };
    }
    if (apiIsSuccess(j) && j.data) {
      const u = j.data.url || j.data.path;
      return { status: 'success', data: j.data, message: j.message || '', url: u };
    }
    return j;
  } catch (e) {
    if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[admin-api] upload_image', e.message || e);
    const errObj = { status: 'error', data: [], message: String(e) };
    logAPI(name, errObj);
    return errObj;
  }
}

async function logoutPhp() {
  const name = 'logout.php';
  logAPIRequest(name, { phase: 'before_fetch', method: 'GET', url: 'logout.php' });
  try {
    const r = await fetch('logout.php', { credentials: 'same-origin' });
    logAPIRequest(name, { phase: 'after_fetch', httpStatus: r.status, ok: r.ok });
  } catch (e) {
    if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[api] logout.php', e.message || e);
    logAPIRequest(name, { phase: 'error', message: e.message || String(e) });
  }
}

async function fetchProductReviews(productId) {
  return apiFetch('getReviews', { product_id: productId });
}

async function uploadReviewImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const url = API + '?action=upload_review_image';
  const name = 'upload_review_image';
  logAPIRequest(name, { phase: 'before_fetch', method: 'POST', url: url, body: 'FormData(image)' });
  try {
    const r = await fetch(url, { method: 'POST', body: formData, credentials: 'same-origin' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
      if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[api] upload_review_image', 'Non-JSON response');
      const errObj = { status: 'error', data: [], message: 'HTTP ' + r.status };
      logAPI(name, errObj);
      return errObj;
    }
    const j = await r.json();
    logAPI(name, j && typeof j === 'object' ? j : { status: 'error', data: [], message: 'Invalid JSON' });
    if (!r.ok) {
      const msg = (j && j.message) ? j.message : ('HTTP ' + r.status);
      return { status: 'error', data: (j && j.data) || [], message: msg };
    }
    if (apiIsSuccess(j) && j.data) {
      const u = j.data.url || j.data.path;
      return { status: 'success', data: j.data, message: j.message || '', url: u };
    }
    return j;
  } catch (e) {
    if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[api] upload_review_image', e.message || e);
    const errObj = { status: 'error', data: [], message: String(e) };
    logAPI(name, errObj);
    return errObj;
  }
}

async function submitProductReview(payload) {
  const product_id = payload.product_id;
  const name = payload.name;
  const city = payload.city;
  const comment = payload.comment;
  const rating = payload.rating;
  const image_url = payload.image_url;
  return apiFetch('addReview', {
    product_id: product_id,
    name: name,
    city: city != null ? city : '',
    comment: comment != null ? comment : '',
    rating: rating != null ? rating : 5,
    image_url: image_url != null ? image_url : ''
  }, 'POST');
}

async function fetchHomepageSettings() {
  return apiFetch('getHomepageSettings');
}

async function fetchProductsBySubcategory(subcatId) {
  return apiFetch('get_products_by_subcat', { subcat_id: subcatId });
}

/**
 * يحوّل slugs ودية في الرابط إلى slug القسم المعتمد في قاعدة البيانات.
 * مثال: drugs→medicine، cosmetics→beauty، vitamins→vitamin
 */
function resolveCategorySlugAlias(slug) {
  if (slug == null || String(slug).trim() === '') return slug;
  const s = String(slug).trim().toLowerCase();
  const map = {
    drugs: 'medicine',
    beauty: 'cosmetics',
    cosmetic: 'cosmetics',
    vitamins: 'vitamins',
    vitamin: 'vitamins',
    baby: 'kids',
    children: 'kids',
    oral_care: 'oralcare'
  };
  const raw = Object.prototype.hasOwnProperty.call(map, s) ? map[s] : slug;
  if (typeof window !== 'undefined' && typeof window.canonicalCategorySlug === 'function') {
    return window.canonicalCategorySlug(String(raw));
  }
  return raw;
}

/** منتجات قسم كامل من MySQL عبر get_products_by_category */
async function fetchProductsByCategorySlug(slug) {
  const canon = typeof resolveCategorySlugAlias === 'function' ? resolveCategorySlugAlias(slug) : slug;
  return apiFetch('get_products_by_category', { slug: canon != null ? canon : slug });
}

async function loadSettings() {
  const d = await apiFetch('getSettings');
  if (apiIsSuccess(d) && d.data && d.data.settings) {
    Object.assign(settings, d.data.settings);
    return d.data.settings;
  }
  return null;
}

async function loadProducts(activeOnly) {
  if (activeOnly === undefined) activeOnly = true;
  const d = await apiFetch('getProducts', { active: activeOnly ? 1 : 0 });
  if (apiIsSuccess(d) && d.data) {
    var list = coerceApiArray(pickAdminProductsFromData(d.data)).map(normalizeProductFromApi);
    if (typeof setShopProducts === 'function') {
      setShopProducts(list, { view: 'api-loadProducts', notify: false });
    } else if (typeof window !== 'undefined' && Array.isArray(window.prods)) {
      window.prods.length = 0;
      list.forEach(function (p) { window.prods.push(p); });
    }
    return list;
  }
  return [];
}

async function loadCategories(activeOnly) {
  if (activeOnly === undefined) activeOnly = true;
  const d = await apiFetch('getCategories', { active: activeOnly ? 1 : 0 });
  return coerceApiArray(apiPick(d, 'categories', []));
}

async function loadSubcategories() {
  const d = await apiFetch('getSubcategories');
  return coerceApiArray(apiPick(d, 'subcategories', []));
}

async function loadAllData() {
  const d = await apiFetch('getAllData');
  if (!apiIsSuccess(d) || !d.data) return null;
  return {
    status: d.status,
    message: d.message,
    data: {
      categories: coerceApiArray(d.data.categories),
      subcategories: coerceApiArray(d.data.subcategories)
    }
  };
}

/** ترتيب عشوائي (Fisher–Yates) على نسخة — «كل المنتجات» تُعرض بترتيب مختلف في كل تحميل */
function shuffleProductsArray(arr) {
  var a = Array.isArray(arr) ? arr.slice() : [];
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

async function loadHomepageData() {
  var perPage =
    typeof window !== 'undefined' && window.HOME_ALL_PRODUCTS_PAGE_SIZE
      ? window.HOME_ALL_PRODUCTS_PAGE_SIZE
      : HOME_ALL_PRODUCTS_PAGE_SIZE;
  var results = await Promise.allSettled([
    apiFetch('getSettings'),
    /* بدون home:1 — قائمة «كل المنتجات» تعرض كل النشطين؛ إخفاء الرئيسية يُطبَّق على قسم «الأكثر طلباً» في main.js */
    apiFetch('getProducts', { active: 1, page: 1, per_page: perPage }),
    apiFetch('getProducts', { active: 1 }),
    apiFetch('getCategories', { active: 1 }),
    apiFetch('getSubcategories')
  ]);
  var safe = function (r) {
    return (r.status === 'fulfilled' && r.value && apiIsSuccess(r.value)) ? r.value.data : {};
  };
  var sd = safe(results[0]);
  var pdPage = safe(results[1]);
  var pdAll = safe(results[2]);
  var cd = safe(results[3]);
  var subd = safe(results[4]);
  var rawPage = coerceApiArray(pickAdminProductsFromData(pdPage)).map(normalizeProductFromApi);
  var allForExtras = coerceApiArray(pickAdminProductsFromData(pdAll)).map(normalizeProductFromApi);
  if (!allForExtras.length && rawPage.length) {
    allForExtras = rawPage.slice();
  }
  var homeGridFull = shuffleProductsArray(allForExtras);
  var pageProducts = homeGridFull.slice(0, perPage);
  var total = homeGridFull.length;
  var productPagination = {
    page: 1,
    per_page: perPage,
    total: total,
    total_pages: total ? Math.max(1, Math.ceil(total / perPage)) : 0
  };
  return {
    settings: sd.settings && typeof sd.settings === 'object' ? sd.settings : {},
    products: pageProducts,
    productPagination: productPagination,
    homeGridFull: homeGridFull,
    allProductsForExtras: allForExtras,
    categories: coerceApiArray(cd.categories),
    subcategories: coerceApiArray(subd.subcategories)
  };
}

window.apiFetch = apiFetch;
window.adminFetch = adminFetch;
window.fetchApiJson = fetchApiJson;
window.uploadImage = uploadImage;
window.logoutPhp = logoutPhp;
window.fetchProductReviews = fetchProductReviews;
window.uploadReviewImage = uploadReviewImage;
window.submitProductReview = submitProductReview;
window.fetchHomepageSettings = fetchHomepageSettings;
window.fetchProductsBySubcategory = fetchProductsBySubcategory;
window.resolveCategorySlugAlias = resolveCategorySlugAlias;
window.fetchProductsByCategorySlug = fetchProductsByCategorySlug;
window.loadSettings = loadSettings;
window.loadProducts = loadProducts;
window.loadCategories = loadCategories;
window.loadSubcategories = loadSubcategories;
window.loadAllData = loadAllData;
window.loadHomepageData = loadHomepageData;
window.apiIsSuccess = apiIsSuccess;
window.apiErrorMessage = apiErrorMessage;
window.apiPick = apiPick;
window.apiDebugEnabled = apiDebugEnabled;
window.getApiDebug = getApiDebug;
window.logAPI = logAPI;
window.logAPIRequest = logAPIRequest;
window.coerceApiArray = coerceApiArray;
window.normalizeProductFromApi = normalizeProductFromApi;
window.normalizeOrderFromApi = normalizeOrderFromApi;
window.pickAdminProductsFromData = pickAdminProductsFromData;
window.pickProductsPaginationFromData = pickProductsPaginationFromData;

async function adminLoadAll() {
  const st = _adminState;
  st.loadErrors = [];
  const tasks = [
    { key: 'products', action: 'getProducts', params: { active: 0 }, method: 'GET' },
    { key: 'categories', action: 'getCategories', params: { active: 0 }, method: 'GET' },
    { key: 'subcategories', action: 'getSubcategories', params: {}, method: 'GET' },
    { key: 'orders', action: 'admin_get_orders', params: {}, method: 'GET' },
    { key: 'settings', action: 'getSettings', params: {}, method: 'GET' }
  ];
  const settled = await Promise.allSettled(tasks.map(function (t) {
    return adminFetch(t.action, t.params, t.method);
  }));

  settled.forEach(function (out, i) {
    var t = tasks[i];
    var res = out.status === 'fulfilled' ? out.value : null;
    if (out.status === 'rejected') {
      console.error('[Pharma API] adminLoadAll', t.action, out.reason);
      st.loadErrors.push(t.key + ': ' + (out.reason && out.reason.message ? out.reason.message : String(out.reason)));
      return;
    }
    if (!apiIsSuccess(res)) {
      var msg = apiErrorMessage(res) || 'طلب فاشل';
      console.warn('[Pharma API] adminLoadAll', t.action, msg, res);
      st.loadErrors.push(t.key + ': ' + msg);
      return;
    }
    if (!res.data || typeof res.data !== 'object') {
      console.warn('[Pharma API] adminLoadAll', t.action, 'missing data object', res);
      st.loadErrors.push(t.key + ': لا يوجد data');
      return;
    }
    var d = res.data;
    if (t.key === 'products') {
      st.products = coerceApiArray(pickAdminProductsFromData(d)).map(normalizeProductFromApi);
    } else if (t.key === 'categories') {
      st.categories = coerceApiArray(d.categories);
    } else if (t.key === 'subcategories') {
      var dsub = d.subcategories;
      if (dsub == null && d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
        dsub = d.data.subcategories;
      }
      st.subcategories = coerceApiArray(dsub);
    } else if (t.key === 'orders') {
      st.orders = coerceApiArray(d.orders).map(normalizeOrderFromApi);
    } else if (t.key === 'settings') {
      st.settings = d.settings && typeof d.settings === 'object' ? d.settings : {};
    }
  });

  return st;
}

async function adminSaveProduct(data) {
  const action = data.id ? 'updateProduct' : 'addProduct';
  return await adminFetch(action, data);
}

async function adminDeleteProduct(id) {
  return await adminFetch('deleteProduct', { id: id });
}

async function adminToggleProduct(id, active) {
  return await adminFetch('toggle_product', { id: id, active: active });
}

async function adminSaveCategory(data) {
  const action = data.id ? 'updateCategory' : 'addCategory';
  return await adminFetch(action, { category: data });
}

async function adminDeleteCategory(id) {
  return await adminFetch('deleteCategory', { id: id });
}

async function adminSaveSubcategory(data) {
  const action = data.id ? 'updateSubcategory' : 'addSubcategory';
  return await adminFetch(action, { subcategory: data });
}

async function adminDeleteSubcategory(id) {
  return await adminFetch('deleteSubcategory', { id: id });
}

async function adminSaveSettings(data) {
  return await adminFetch('saveSettings', { settings: data });
}

async function adminChangePass(oldPass, newPass) {
  return await adminFetch('change_pass', { old_pass: oldPass, new_pass: newPass });
}

async function adminBackup() {
  return await adminFetch('backup', {}, 'GET');
}

async function adminRestore(data) {
  return await adminFetch('restore', data);
}

async function adminGetReviews() {
  try {
    var r = await adminFetch('admin_get_reviews', {}, 'GET');
    if (!apiIsSuccess(r) || !r.data) {
      console.warn('[Pharma API] admin_get_reviews', apiErrorMessage(r));
      return [];
    }
    return coerceApiArray(r.data.reviews);
  } catch (e) {
    console.error('[Pharma API] admin_get_reviews', e);
    return [];
  }
}

async function adminSaveReviews(reviews) {
  return await adminFetch('admin_save_reviews', { reviews: reviews });
}

async function adminUpdateOrderStatus(id, status) {
  return await adminFetch('admin_update_order_status', { id: id, status: status });
}

async function adminDeleteOrder(id) {
  return await adminFetch('admin_delete_order', { id: id });
}

async function adminCreateOrder(data) {
  return await adminFetch('admin_create_order', data);
}

async function adminGetCustomers() {
  try {
    var r = await adminFetch('admin_get_customers', {}, 'GET');
    if (!apiIsSuccess(r) || !r.data) {
      console.warn('[Pharma API] admin_get_customers', apiErrorMessage(r));
      return [];
    }
    return coerceApiArray(r.data.customers);
  } catch (e) {
    console.error('[Pharma API] admin_get_customers', e);
    return [];
  }
}

window.adminLoadAll = adminLoadAll;
window.adminSaveProduct = adminSaveProduct;
window.adminDeleteProduct = adminDeleteProduct;
window.adminToggleProduct = adminToggleProduct;
window.adminSaveCategory = adminSaveCategory;
window.adminDeleteCategory = adminDeleteCategory;
window.adminSaveSubcategory = adminSaveSubcategory;
window.adminDeleteSubcategory = adminDeleteSubcategory;
window.adminSaveSettings = adminSaveSettings;
window.adminChangePass = adminChangePass;
window.adminBackup = adminBackup;
window.adminRestore = adminRestore;
window.adminGetReviews = adminGetReviews;
window.adminSaveReviews = adminSaveReviews;
window.adminUpdateOrderStatus = adminUpdateOrderStatus;
window.adminDeleteOrder = adminDeleteOrder;
window.adminCreateOrder = adminCreateOrder;
window.adminGetCustomers = adminGetCustomers;

(function bindPharmaImageFallback() {
  if (window.__pharmaImgFallbackBound) return;
  window.__pharmaImgFallbackBound = true;

  var PLACEHOLDER = (typeof pharmaPublicAssetUrl === 'function')
    ? pharmaPublicAssetUrl('/assets/img/placeholder.svg')
    : '/assets/img/placeholder.svg';

  function finalize(img) {
    img.dataset.imgFallbackStep = 'done';
    img.style.display = 'none';

    if (img.dataset.fallbackParent) {
      var scope = img.parentElement;
      var t = scope && scope.querySelector(img.dataset.fallbackParent);
      if (t) { t.style.display = 'flex'; }
      return;
    }

    var sib = img.nextElementSibling;
    if (sib && sib.classList.contains('pc-ico-fallback')) {
      sib.style.display = 'flex';
      return;
    }

    if (img.dataset.fallbackNext) {
      var par = img.parentElement;
      var el = par && par.querySelector('.' + img.dataset.fallbackNext);
      if (el) el.style.display = el.classList.contains('sim-img-fb') ? 'block' : 'flex';
      return;
    }

    if (img.dataset.fallbackIcon) {
      var wrap = document.createElement('div');
      wrap.className = 'pc-ico-fallback';
      wrap.style.display = 'flex';
      wrap.textContent = img.dataset.fallbackIcon;
      img.parentNode.insertBefore(wrap, img.nextSibling);
      return;
    }

    var cartCell = img.closest('.cs-item-img');
    if (cartCell && !cartCell.querySelector('.cs-item-img-fallback')) {
      var sp = document.createElement('span');
      sp.className = 'cs-item-img-fallback';
      sp.setAttribute('aria-hidden', 'true');
      sp.textContent = '📦';
      cartCell.appendChild(sp);
      return;
    }

  }

  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.dataset.skipImgFallback === '1') return;
    /* سلايدرات الصفحة الرئيسية — لا تستبدل بـ placeholder حتى لا يظهر «لا توجد صورة» عند 404 مؤقت أو مسار فرعي */
    if (img.classList.contains('brand-showcase-img') || img.classList.contains('promo-slide-img') || img.classList.contains('spotlight-slider-img')) return;
    if (img.id === 'imgModalImg' || (img.closest && img.closest('.img-modal'))) return;

    var srcAttr = img.getAttribute('src');
    if (srcAttr === null || String(srcAttr).trim() === '') return;

    var step = img.dataset.imgFallbackStep || '0';
    if (step === 'done') return;

    if (step === '0') {
      img.dataset.imgFallbackStep = '1';
      var cur = String(img.currentSrc || img.src || '');
      if (cur.indexOf('placeholder.svg') !== -1 || cur.indexOf('placeholder.png') !== -1) {
        finalize(img);
        return;
      }
      img.src = PLACEHOLDER;
      return;
    }

    if (step === '1') {
      finalize(img);
    }
  }, true);
})();