/* admin.js — لوحة التحكم (مدمج) */
'use strict';

/* ---------- admin-config.js ---------- */
/* admin-config.js — إعدادات لوحة التحكم */
const API = 'api.php';
const MAP_URL = 'https://maps.app.goo.gl/9YRxXPqV9qtkRKrG7';

// حالة اللوحة — إن وُجدت مسبقاً من assets/js/admin/app.js (المتجر) لا تُستبدل
if (!window._adminState || typeof window._adminState !== 'object') {
  window._adminState = {
    products: [],
    categories: [],
    subcategories: [],
    orders: [],
    reviews: [],
    settings: {},
    currentPage: 'dashboard',
    selectedProducts: new Set(),
    selectedMainCats: new Set(),
    selectedSubcats: new Set(),
    productsDirty: false,
  };
}

window.API = API;
window.MAP_URL = MAP_URL;

/** قوائم آمنة من الحالة — تمنع .filter على undefined ويدعم حقول JSON كنص */
function adminProductsSafe() {
  return typeof coerceApiArray === 'function' ? coerceApiArray(_adminState.products) : [].concat(_adminState.products || []);
}
function adminCategoriesSafe() {
  return typeof coerceApiArray === 'function' ? coerceApiArray(_adminState.categories) : [].concat(_adminState.categories || []);
}
function adminSubcategoriesSafe() {
  return typeof coerceApiArray === 'function' ? coerceApiArray(_adminState.subcategories) : [].concat(_adminState.subcategories || []);
}
function adminOrdersSafe() {
  return typeof coerceApiArray === 'function' ? coerceApiArray(_adminState.orders) : [].concat(_adminState.orders || []);
}
function adminReviewsSafe() {
  return typeof coerceApiArray === 'function' ? coerceApiArray(_adminState.reviews) : [].concat(_adminState.reviews || []);
}

/* ---------- admin-theme.js ---------- */
/* admin-theme.js — السايدبار (تمت إزالة الوضع الداكن من اللوحة) */

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebarBackdrop');
  if (!sb) return;
  const open = sb.classList.toggle('open');
  if (bd) { bd.style.display = open ? 'block' : 'none'; }
}

function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebarBackdrop');
  if (sb) sb.classList.remove('open');
  if (bd) bd.style.display = 'none';
}

function toggleSidebarGroup(name) {
  const items = document.getElementById(`sb-group-items-${name}`);
  const group = document.getElementById(`sb-group-${name}`);
  if (!items) return;
  const open = items.classList.toggle('open');
  if (group) group.classList.toggle('open', open);
}

// إغلاق السايدبار عند النقر على الـ backdrop
document.addEventListener('DOMContentLoaded', () => {
  const bd = document.getElementById('sidebarBackdrop');
  if (bd) bd.addEventListener('click', closeSidebar);
});

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleSidebarGroup = toggleSidebarGroup;

/* ---------- admin-products.js ---------- */
/* admin-products.js — إدارة المنتجات (الرسم داخل AdminApp.productsPage) */

/** صفوف الجدول داخل <table><tbody> — تجنّب وضع <tr> مباشرة داخل <div> */
function setTableBodyHtml(container, rowsHtml) {
  if (!container) return;
  container.innerHTML =
    '<table class="cp-data-table" style="width:100%;border-collapse:collapse;"><tbody>' +
    rowsHtml +
    '</tbody></table>';
}

function refreshProductsView() {
  if (window.AdminApp && window.AdminApp.productsPage && typeof window.AdminApp.productsPage.render === 'function') {
    window.AdminApp.productsPage.render();
  }
}

function refreshAfterCategoryChange() {
  var svc = window.AdminServices && window.AdminServices.categoryService;
  var storeApi = window.__adminStoreApi;
  if (!svc || !storeApi) return Promise.resolve();
  return Promise.all([svc.syncMainToStore(storeApi), svc.syncSubToStore(storeApi)]).then(function () {
    if (typeof populateCategoryCheckboxes === 'function') populateCategoryCheckboxes();
    if (window.AdminApp && window.AdminApp.mainCategoriesPage) window.AdminApp.mainCategoriesPage.render();
    if (window.AdminApp && window.AdminApp.subcategoriesPage) window.AdminApp.subcategoriesPage.render();
    if (window.AdminApp && window.AdminApp.dashboardPage) window.AdminApp.dashboardPage.render();
  });
}

function toggleProdSelect(id) {
  if (window.__adminStoreApi && typeof window.__adminStoreApi.toggleSelectedProduct === 'function') {
    window.__adminStoreApi.toggleSelectedProduct(id);
  }
  refreshProductsView();
}

function clearProductSelection() {
  if (window.__adminStoreApi && typeof window.__adminStoreApi.clearSelectedProducts === 'function') {
    window.__adminStoreApi.clearSelectedProducts();
  }
  refreshProductsView();
}

async function confirmDeleteProduct(id) {
  if (window.AdminApp && window.AdminApp.productsPage && typeof window.AdminApp.productsPage.deleteProduct === 'function') {
    await window.AdminApp.productsPage.deleteProduct(id);
  }
}

async function bulkDeleteProducts() {
  const ids = [..._adminState.selectedProducts];
  if (!ids.length) return;
  if (!confirm(`حذف ${ids.length} منتج؟`)) return;
  const svc = window.AdminServices && window.AdminServices.productService;
  const storeApi = window.__adminStoreApi;
  if (!svc || !storeApi) return;
  for (let i = 0; i < ids.length; i++) await svc.deleteProduct(ids[i]);
  storeApi.clearSelectedProducts();
  showToast('تم الحذف');
  try {
    await svc.syncToStore(storeApi);
    refreshProductsView();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch (e) {
    console.error('[admin] bulkDeleteProducts', e);
  }
}

async function bulkHideSelectedProducts() {
  const ids = [..._adminState.selectedProducts];
  const svc = window.AdminServices && window.AdminServices.productService;
  const storeApi = window.__adminStoreApi;
  if (!svc || !storeApi) return;
  for (let i = 0; i < ids.length; i++) await svc.toggleProduct(ids[i], false);
  showToast('تم الإخفاء');
  try {
    await svc.syncToStore(storeApi);
    refreshProductsView();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch (e) {
    console.error('[admin] bulkHideSelectedProducts', e);
  }
}

async function bulkShowSelectedProducts() {
  const ids = [..._adminState.selectedProducts];
  const svc = window.AdminServices && window.AdminServices.productService;
  const storeApi = window.__adminStoreApi;
  if (!svc || !storeApi) return;
  for (let i = 0; i < ids.length; i++) await svc.toggleProduct(ids[i], true);
  showToast('تم الإظهار');
  try {
    await svc.syncToStore(storeApi);
    refreshProductsView();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch (e) {
    console.error('[admin] bulkShowSelectedProducts', e);
  }
}

function openBulkProductEditModal(id) {
  const p = (_adminState.products || []).find(function (x) { return String(x.id) === String(id); });
  if (!p) return;
  setVal('em-id', p.id);
  setVal('em-name', p.name || '');
  setVal('em-price', p.price != null && p.price !== '' ? p.price : '');
  setVal('em-old', p.oldPrice != null && p.oldPrice !== '' ? p.oldPrice : '');
  setVal('em-stock', p.stock != null && p.stock !== '' ? p.stock : '');
  setVal('em-desc', p.desc || '');
  setVal('em-usage', p.usage || '');
  setVal('em-dose', p.dose || '');
  setVal('em-frequency', p.frequency || '');
  setVal('em-age', p.age || '');
  setVal('em-storage', p.storage || '');
  setVal('em-warnings', p.warnings || '');
  setVal('em-ingredients', p.ingredients || '');
  var cats = p.categories || (p.cat ? [p.cat] : []);
  document.querySelectorAll('#em-maincats-list .maincat-cb').forEach(function (cb) {
    cb.checked = cats.some(function (x) { return String(x) === String(cb.value); });
  });
  syncNestedMaincatPanels();
  var psubsEm = Array.isArray(p.subcategories) ? p.subcategories : [];
  document.querySelectorAll('#em-maincats-list .subcat-cb').forEach(function (cb) {
    cb.checked = psubsEm.some(function (x) { return String(x) === String(cb.value); });
  });
  var m = document.getElementById('editModal');
  if (m) m.style.display = 'flex';
}

function closeBulkProductEditModal() {
  var m = document.getElementById('editModal');
  if (m) m.style.display = 'none';
}

async function saveBulkProductEdit() {
  var id = getVal('em-id');
  if (!id) { showToast('خطأ في المعرّف', 'error'); return; }
  var name = getVal('em-name');
  if (!name) { showToast('اسم المنتج مطلوب', 'error'); return; }
  var p = (_adminState.products || []).find(function (x) { return String(x.id) === String(id); });
  if (!p) { showToast('المنتج غير موجود', 'error'); return; }
  var cats = [].slice.call(document.querySelectorAll('#em-maincats-list .maincat-cb:checked')).map(function (cb) { return cb.value; });
  var subcatsEm = [].slice
    .call(document.querySelectorAll('#em-maincats-list .subcat-cb:checked'))
    .map(function (cb) {
      return parseInt(cb.value, 10);
    })
    .filter(function (n) {
      return !isNaN(n);
    });
  var priceStr = getVal('em-price');
  var data = Object.assign({}, p, {
    id: p.id,
    name: name,
    price: priceStr !== '' ? Number(priceStr) : p.price,
    oldPrice: getVal('em-old') ? Number(getVal('em-old')) : undefined,
    stock: getVal('em-stock') !== '' ? Number(getVal('em-stock')) : undefined,
    desc: getVal('em-desc'),
    usage: getVal('em-usage'),
    dose: getVal('em-dose'),
    frequency: getVal('em-frequency'),
    age: getVal('em-age'),
    storage: getVal('em-storage'),
    warnings: getVal('em-warnings'),
    ingredients: getVal('em-ingredients'),
    cat: cats[0] || p.cat,
    categories: cats.length ? cats : (p.categories || (p.cat ? [p.cat] : [])),
    subcategories: subcatsEm,
  });
  var btn = document.getElementById('btn-save-edit');
  if (btn) { btn.disabled = true; }
  var r = await adminSaveProduct(data);
  if (btn) { btn.disabled = false; }
  if (apiIsSuccess(r)) {
    showToast('تم حفظ التعديلات ✓');
    closeBulkProductEditModal();
    try {
      const svc = window.AdminServices && window.AdminServices.productService;
      const storeApi = window.__adminStoreApi;
      if (svc && storeApi) await svc.syncToStore(storeApi);
      populateCategoryCheckboxes();
      refreshProductsView();
      if (typeof renderDashboard === 'function') renderDashboard();
    } catch (e) {
      console.error('[admin] saveBulkProductEdit sync', e);
    }
  } else {
    showToast(apiErrorMessage(r) || 'فشل الحفظ', 'error');
  }
}

function bulkEditSelectedProduct() {
  var ids = [..._adminState.selectedProducts];
  if (ids.length !== 1) { showToast('اختر منتجاً واحداً للتعديل', 'error'); return; }
  openBulkProductEditModal(ids[0]);
}
async function bulkChangeSelectedCategory() { showToast('ميزة قيد التطوير', 'error'); }
async function bulkChangeSelectedPrice() { showToast('ميزة قيد التطوير', 'error'); }

function resetProducts() {
  if (window.__adminStoreApi && typeof window.__adminStoreApi.resetProductListFilter === 'function') {
    window.__adminStoreApi.resetProductListFilter();
  }
  ['prod-search', 'filter-cat', 'filter-status', 'filter-stock', 'filter-price-min', 'filter-price-max', 'sort-products']
    .forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'sort-products') el.value = 'newest';
      else el.value = '';
    });
  refreshProductsView();
}

/* فلاتر المنتجات: تُربَط عند mount صفحة المنتجات (AdminApp.productsPage) — انظر assets/js/admin/pages/productsPage.js */

async function clearAllProductsAdmin() {
  if (!confirm('حذف جميع المنتجات؟ لا يمكن التراجع!')) return;
  const svc = window.AdminServices && window.AdminServices.productService;
  const storeApi = window.__adminStoreApi;
  if (!svc || typeof svc.clearAllProducts !== 'function' || !storeApi) {
    const r = await adminFetch('clear_all_products');
    if (apiIsSuccess(r)) {
      showToast('تم مسح جميع المنتجات');
      if (window.AdminServices && window.AdminServices.productService && window.__adminStoreApi) {
        try {
          await window.AdminServices.productService.syncToStore(window.__adminStoreApi);
        } catch (e) { /* ignore */ }
      }
      refreshProductsView();
      if (typeof renderDashboard === 'function') renderDashboard();
    } else showToast(apiErrorMessage(r) || 'خطأ', 'error');
    return;
  }
  const res = await svc.clearAllProducts();
  if (res.ok) {
    showToast('تم مسح جميع المنتجات');
    try {
      await svc.syncToStore(storeApi);
      refreshProductsView();
      if (typeof renderDashboard === 'function') renderDashboard();
    } catch (e) {
      console.error('[admin] clearAllProductsAdmin', e);
    }
  } else showToast(res.message || 'خطأ', 'error');
}

window.toggleProdSelect = toggleProdSelect;
window.clearProductSelection = clearProductSelection;
window.confirmDeleteProduct = confirmDeleteProduct;
window.bulkDeleteProducts = bulkDeleteProducts;
window.bulkHideSelectedProducts = bulkHideSelectedProducts;
window.bulkShowSelectedProducts = bulkShowSelectedProducts;
window.bulkEditSelectedProduct = bulkEditSelectedProduct;
window.bulkChangeSelectedCategory = bulkChangeSelectedCategory;
window.bulkChangeSelectedPrice = bulkChangeSelectedPrice;
window.resetProducts = resetProducts;
window.clearAllProductsAdmin = clearAllProductsAdmin;
window.openBulkProductEditModal = openBulkProductEditModal;
window.closeBulkProductEditModal = closeBulkProductEditModal;
window.saveBulkProductEdit = saveBulkProductEdit;

/* ---------- product-admin.js ---------- */
/* product-admin.js — نموذج إضافة/تعديل المنتج */
let _editingProductId = null;
let _uploadedImageUrl = '';

/** مسودة إضافة منتج في المتصفح (تبقى بعد إغلاق التبويب/الجلسة). لا يُحفظ المخزون أبداً. */
var CP_ADD_PRODUCT_DRAFT_KEY = 'pharma_cp_add_product_draft_v1';

function persistAddProductDraftFromForm() {
  if (_editingProductId != null) return;
  try {
    var payload = {
      v: 1,
      imageUrl: _uploadedImageUrl || '',
      name: getVal('f-name'),
      price: getVal('f-price'),
      old: getVal('f-old')
    };
    var empty =
      !((payload.imageUrl || '').trim()) &&
      !((payload.name || '').trim()) &&
      !((payload.price || '').trim()) &&
      !((payload.old || '').trim());
    if (empty) {
      localStorage.removeItem(CP_ADD_PRODUCT_DRAFT_KEY);
      return;
    }
    localStorage.setItem(CP_ADD_PRODUCT_DRAFT_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function clearAddProductDraft() {
  try {
    localStorage.removeItem(CP_ADD_PRODUCT_DRAFT_KEY);
  } catch (e) {}
}

function restoreAddProductDraftIfNewProduct() {
  if (_editingProductId != null) return;
  var priceTrim = (getVal('f-price') || '').trim();
  var priceBlocksDraft = priceTrim !== '' && priceTrim !== '1';
  var hasLocal =
    (_uploadedImageUrl || '').trim() ||
    (getVal('f-name') || '').trim() ||
    priceBlocksDraft ||
    (getVal('f-old') || '').trim();
  if (hasLocal) return;
  try {
    var raw = localStorage.getItem(CP_ADD_PRODUCT_DRAFT_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    if (!d || d.v !== 1) return;
    if (d.imageUrl) {
      _uploadedImageUrl = d.imageUrl;
      var prev = document.getElementById('imgPreviewImg');
      var prevWrap = document.getElementById('imgPreview');
      if (prev) prev.src = d.imageUrl;
      if (prevWrap) prevWrap.style.display = 'block';
    }
    if (d.name != null) setVal('f-name', d.name);
    if (d.price != null) setVal('f-price', d.price);
    if (d.old != null) setVal('f-old', d.old);
    if ((getVal('f-price') || '').trim() === '') setVal('f-price', '1');
  } catch (e) {}
}

/** سعر افتراضي لمنتج جديد — المخزون لا يُعبأ تلقائياً. */
function ensureDefaultNewProductPriceIfAdding() {
  if (_editingProductId != null) return;
  if ((getVal('f-price') || '').trim() === '') setVal('f-price', '1');
}

function resetForm() {
  _editingProductId = null;
  _uploadedImageUrl = '';
  ['f-name','f-price','f-old','f-stock','f-badge','f-desc','f-dose','f-frequency',
   'f-age','f-storage','f-warnings','f-usage','f-ingredients','f-contraindications','f-slug','f-bundle-ids','f-product-type'].forEach(id => setVal(id, ''));
  setVal('f-price', '1');
  setChecked('f-prescription', false);
  setChecked('f-hide-from-home', false);
  const prev = document.getElementById('imgPreviewImg');
  const prevWrap = document.getElementById('imgPreview');
  const prevGrid = document.getElementById('imgPreviewGrid');
  if (prev) prev.src = '';
  if (prevWrap) prevWrap.style.display = 'none';
  if (prevGrid) prevGrid.innerHTML = '';
  try {
    window.__lastPackagingImageFile = null;
  } catch (e) {
    /* ignore */
  }
  _adminState.selectedProducts.clear();

  // تحديث العنوان
  const addTitle = document.getElementById('add-title');
  if (addTitle) addTitle.textContent = '➕ إضافة منتج جديد';

  // مسح الأقسام المحددة (رئيسية + فرعية)
  document.querySelectorAll('#f-maincats-list .maincat-cb').forEach(function (cb) {
    cb.checked = false;
  });
  document.querySelectorAll('#f-maincats-list .subcat-cb').forEach(function (cb) {
    cb.checked = false;
  });
  syncNestedMaincatPanels();
  refreshNestedSubcatSummary();
  if (typeof setProductFormWizardStep === 'function') setProductFormWizardStep(1, { noScroll: true });
  var lead = document.getElementById('pf-add-lead');
  if (lead) {
    lead.textContent =
      'ثلاث خطوات: أساسيات، بيانات طبية، صور — ثم احفظ من الشريط الأخضر أسفل الصفحة.';
  }
}

var PF_WIZARD_STEPS = 3;
var SAVE_PRODUCT_BTN_LABEL = '💾 حفظ وإظهار فوراً في الموقع';

function focusProductAddField(el) {
  if (!el) return;
  try {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (e) {
    try {
      el.scrollIntoView(true);
    } catch (e2) {}
  }
  try {
    el.focus({ preventScroll: true });
  } catch (e) {
    try {
      el.focus();
    } catch (e2) {}
  }
}

function setProductFormWizardStep(step, opts) {
  var wiz = document.getElementById('product-form-wizard');
  if (!wiz) return;
  var n = Math.max(1, Math.min(PF_WIZARD_STEPS, Number(step) || 1));
  wiz.dataset.pfWizardCurrent = String(n);
  wiz.querySelectorAll('.pf-wizard-tab').forEach(function (btn) {
    var s = parseInt(btn.getAttribute('data-pf-wizard-step'), 10);
    var on = s === n;
    btn.classList.toggle('is-active', on);
    btn.classList.toggle('is-done', s < n);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.setAttribute('tabindex', on ? '0' : '-1');
  });
  wiz.querySelectorAll('.pf-wizard-pane').forEach(function (pane) {
    var s = parseInt(pane.getAttribute('data-pf-wizard-pane'), 10);
    var on = s === n;
    pane.classList.toggle('is-active', on);
    pane.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  var prev = document.getElementById('pf-wizard-prev');
  var next = document.getElementById('pf-wizard-next');
  var hint = document.getElementById('pf-wizard-step-hint');
  if (prev) prev.disabled = n <= 1;
  if (next) next.disabled = n >= PF_WIZARD_STEPS;
  if (hint) {
    hint.textContent =
      n >= PF_WIZARD_STEPS
        ? 'الخطوة ' + n + ' من ' + PF_WIZARD_STEPS + ' — جاهز للحفظ من الأسفل'
        : 'الخطوة ' + n + ' من ' + PF_WIZARD_STEPS;
  }
  var noScroll = opts && opts.noScroll;
  if (!noScroll) {
    try {
      wiz.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (e) {
      try {
        wiz.scrollIntoView(true);
      } catch (e2) {}
    }
  }
  if (opts && opts.focusFirst) {
    var pane = wiz.querySelector('.pf-wizard-pane.is-active');
    if (pane) {
      var focusable = pane.querySelector(
        'input:not([type="hidden"]):not([type="file"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (focusable) focusProductAddField(focusable);
    }
  }
}
window.setProductFormWizardStep = setProductFormWizardStep;

function openEdit(id) {
  const p = adminProductsSafe().find(x => String(x.id) === String(id));
  if (!p) return;
  _editingProductId = p.id;

  const addTitle = document.getElementById('add-title');
  if (addTitle) addTitle.textContent = '✏️ تعديل المنتج';
  var leadEd = document.getElementById('pf-add-lead');
  if (leadEd) {
    leadEd.textContent = 'راجع الخطوات ثم احفظ — يُحدَّث ظهور المنتج في المتجر فوراً.';
  }

  setVal('f-name', p.name);
  setVal('f-price', p.price);
  setVal('f-old', p.oldPrice);
  setVal('f-stock', p.stock);
  setVal('f-badge', p.badge);
  setVal('f-desc', p.desc);
  setVal('f-dose', p.dose);
  setVal('f-frequency', p.frequency);
  setVal('f-age', p.age);
  setVal('f-storage', p.storage);
  setVal('f-warnings', p.warnings);
  setVal('f-usage', p.usage);
  setVal('f-ingredients', p.ingredients);
  setVal('f-contraindications', p.contraindications || '');
  setVal('f-slug', p.slug || '');
  setVal('f-bundle-ids', Array.isArray(p.bundle_ids) ? p.bundle_ids.join(', ') : (p.bundle_ids || ''));
  setVal('f-product-type', p.product_type || '');
  setChecked('f-prescription', !!p.prescription_required);
  setChecked('f-hide-from-home', !!p.hide_from_home);
  _uploadedImageUrl = p.image || '';

  const prev = document.getElementById('imgPreviewImg');
  const prevWrap = document.getElementById('imgPreview');
  if (prev && p.image) { prev.src = (typeof safeImgSrc === 'function' ? safeImgSrc(p.image) : p.image) || ''; }
  if (prevWrap) prevWrap.style.display = p.image ? 'block' : 'none';

  showPage('add');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeEdit() {
  resetForm();
  showPage('products');
}

async function saveProduct() {
  const name = getVal('f-name');
  if (!name) {
    showToast('اسم المنتج مطلوب', 'error');
    if (typeof setProductFormWizardStep === 'function') setProductFormWizardStep(1, { noScroll: true });
    focusProductAddField(document.getElementById('f-name'));
    return;
  }
  const price = getVal('f-price');
  if (!price) {
    showToast('السعر مطلوب', 'error');
    if (typeof setProductFormWizardStep === 'function') setProductFormWizardStep(1, { noScroll: true });
    focusProductAddField(document.getElementById('f-price'));
    return;
  }

  const cats = [...document.querySelectorAll('#f-maincats-list .maincat-cb:checked')].map(cb => cb.value);
  const subcats = [...document.querySelectorAll('#f-maincats-list .subcat-cb:checked')]
    .map(function (cb) {
      return parseInt(cb.value, 10);
    })
    .filter(function (n) {
      return !isNaN(n);
    });
  if (!cats.length) {
    showToast('اختر قسمًا رئيسيًا واحدًا على الأقل', 'error');
    if (typeof setProductFormWizardStep === 'function') setProductFormWizardStep(1, { noScroll: true });
    var firstMain = document.querySelector('#f-maincats-list .maincat-cb');
    focusProductAddField(firstMain);
    return;
  }
  const existingProd =
    _editingProductId != null
      ? adminProductsSafe().find(function (x) {
          return String(x.id) === String(_editingProductId);
        })
      : null;

  const data = {
    id: _editingProductId || undefined,
    name,
    price: Number(price),
    oldPrice: getVal('f-old') ? Number(getVal('f-old')) : undefined,
    stock: getVal('f-stock') !== '' ? Number(getVal('f-stock')) : undefined,
    badge: getVal('f-badge'),
    desc: getVal('f-desc'),
    dose: getVal('f-dose'),
    frequency: getVal('f-frequency'),
    age: getVal('f-age'),
    storage: getVal('f-storage'),
    warnings: getVal('f-warnings'),
    usage: getVal('f-usage'),
    ingredients: getVal('f-ingredients'),
    contraindications: getVal('f-contraindications'),
    slug: getVal('f-slug') || undefined,
    product_type: getVal('f-product-type') || undefined,
    prescription_required: getChecked('f-prescription'),
    hide_from_home: getChecked('f-hide-from-home'),
    bundle_ids: getVal('f-bundle-ids')
      ? getVal('f-bundle-ids').split(/[,،\s]+/).map(s => s.trim()).filter(Boolean)
      : undefined,
    /* سلسلة فارغة صريحة حتى يستبدل السيرفر الصورة القديمة (JSON يتجاهل undefined) */
    image: (_uploadedImageUrl || '').trim(),
    cat: cats[0] || undefined,
    categories: cats,
    subcategories: subcats,
    active: true,
  };

  const btn = document.getElementById('saveProductBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';
  }

  const r = await adminSaveProduct(data);

  if (btn) {
    btn.disabled = false;
    btn.textContent = SAVE_PRODUCT_BTN_LABEL;
  }

  if (apiIsSuccess(r)) {
    var savedAsNewProduct = _editingProductId == null;
    showToast(_editingProductId ? 'تم تحديث المنتج ✓' : 'تم إضافة المنتج ✓');
    resetForm();
    if (savedAsNewProduct) clearAddProductDraft();
    try {
      const svc = window.AdminServices && window.AdminServices.productService;
      const storeApi = window.__adminStoreApi;
      if (svc && storeApi) await svc.syncToStore(storeApi);
      populateCategoryCheckboxes();
      showPage('products');
      refreshProductsView();
      if (typeof renderDashboard === 'function') renderDashboard();
    } catch (e) {
      console.error('[admin] saveProduct sync', e);
    }
  } else {
    showToast(apiErrorMessage(r) || 'فشل الحفظ', 'error');
  }
}

function pharmaReadFileAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result || ''));
    };
    reader.onerror = function () {
      reject(new Error('read'));
    };
    reader.readAsDataURL(file);
  });
}

/** ضغط خفيف للصور الكبيرة قبل إرسالها لتحليل Vision (يبقى الرفع الأصلي كما هو). */
function pharmaCompressDataUrlIfLarge(file, maxBytes, maxW, quality) {
  return pharmaReadFileAsDataUrl(file).then(function (dataUrl) {
    if (!dataUrl || file.size <= maxBytes || typeof document.createElement !== 'function') return dataUrl;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.width;
          var h = img.height;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          var c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          var ctx = c.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', quality));
        } catch (e) {
          resolve(dataUrl);
        }
      };
      img.onerror = function () {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  });
}

function packagingFirstString(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    var s = obj[k];
    if (s == null) continue;
    s = String(s).trim();
    if (s !== '') return s;
  }
  return '';
}

function applyPackagingAnalysisToForm(fields) {
  if (!fields || typeof fields !== 'object') return;
  var nm = fields.name_ar ? String(fields.name_ar).trim() : '';
  var br = fields.brand ? String(fields.brand).trim() : '';
  if (nm && br && nm.indexOf(br) === -1) {
    setVal('f-name', br + ' — ' + nm);
  } else if (nm) {
    setVal('f-name', nm);
  } else if (br) {
    setVal('f-name', br);
  }
  if (fields.desc) setVal('f-desc', fields.desc);
  if (fields.usage) setVal('f-usage', fields.usage);
  if (fields.dose) setVal('f-dose', fields.dose);
  if (fields.frequency) setVal('f-frequency', fields.frequency);
  var ageStr = packagingFirstString(fields, ['age', 'age_group', 'age_range', 'age_restriction']);
  if (ageStr) setVal('f-age', ageStr);
  var storageStr = packagingFirstString(fields, ['storage', 'storage_instructions', 'keep', 'keep_conditions']);
  if (storageStr) setVal('f-storage', storageStr);
  if (fields.warnings) setVal('f-warnings', fields.warnings);
  if (fields.ingredients) setVal('f-ingredients', fields.ingredients);
  if (fields.contraindications) setVal('f-contraindications', fields.contraindications);
  if (fields.product_type) {
    var sel = document.getElementById('f-product-type');
    var v = String(fields.product_type).toLowerCase();
    if (sel && ['medicine', 'cosmetic', 'device', 'supplement', 'other'].indexOf(v) !== -1) {
      sel.value = v;
    }
  }
  if (fields.quantity_label) {
    var q = String(fields.quantity_label).trim();
    var cur = (typeof getVal === 'function' ? getVal('f-desc') : '') || '';
    if (q && cur.indexOf(q) === -1) {
      setVal('f-desc', cur ? cur + '\n\nالكمية: ' + q : 'الكمية: ' + q);
    }
  }
  if (Array.isArray(fields.main_category_slugs) && fields.main_category_slugs.length) {
    var root = document.getElementById('f-maincats-list');
    if (root) {
      var esc =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? function (s) {
              return CSS.escape(String(s));
            }
          : function (s) {
              return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            };
      fields.main_category_slugs.forEach(function (slug) {
        var cb = root.querySelector('.maincat-cb[value="' + esc(slug) + '"]');
        if (cb) cb.checked = true;
      });
      if (typeof syncNestedMaincatPanels === 'function') syncNestedMaincatPanels();
      if (typeof refreshNestedSubcatSummary === 'function') refreshNestedSubcatSummary();
    }
  }
  if (typeof ensureDefaultMainCategoryIfEmpty === 'function') ensureDefaultMainCategoryIfEmpty();
}

async function tryAutoFillFromPackaging(file) {
  if (!file || typeof analyzeProductImageForAdmin !== 'function') return;
  var btn = document.getElementById('btn-packaging-ai-fill');
  if (btn) btn.disabled = true;
  showToast('جارٍ استخراج البيانات من صورة العبوة…');
  try {
    var dataUrl = await pharmaCompressDataUrlIfLarge(file, 1400000, 1600, 0.82);
    var res = await analyzeProductImageForAdmin(dataUrl);
    if (apiIsSuccess(res) && res.data && res.data.fields) {
      applyPackagingAnalysisToForm(res.data.fields);
      showToast('تم تعبئة الحقول من الصورة — راجع السعر والأقسام الفرعية ثم احفظ.');
      if (typeof setProductFormWizardStep === 'function') setProductFormWizardStep(1, { noScroll: true });
      if (typeof persistAddProductDraftFromForm === 'function') persistAddProductDraftFromForm();
    } else {
      showToast(apiErrorMessage(res) || 'تعذّر استخراج البيانات من الصورة', 'error');
    }
  } catch (e) {
    if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[admin] packaging AI', e);
    showToast('تعذّر تحليل الصورة', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function processProductImageFile(file) {
  if (!file || !file.size) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('الصورة أكبر من 5MB', 'error');
    return;
  }
  try {
    window.__lastPackagingImageFile = file;
  } catch (e) {
    /* ignore */
  }
  showToast('جاري رفع الصورة...');
  const r = await uploadImage(file);
  if (apiIsSuccess(r) && r.url) {
    _uploadedImageUrl = r.url;
    const prev = document.getElementById('imgPreviewImg');
    const prevWrap = document.getElementById('imgPreview');
    const previewSrc =
      prev && typeof pharmaPublicAssetUrl === 'function' && typeof r.url === 'string' && r.url.startsWith('/')
        ? pharmaPublicAssetUrl(r.url)
        : r.url;
    if (prev) prev.src = previewSrc;
    if (prevWrap) prevWrap.style.display = 'block';
    ensureDefaultMainCategoryIfEmpty();
    ensureDefaultNewProductPriceIfAdding();
    persistAddProductDraftFromForm();
    showToast('تم رفع الصورة ✓ — اضغط زر «استخراج البيانات من الصورة» أدناه عند الرغبة.');
  } else {
    showToast(apiErrorMessage(r) || 'فشل رفع الصورة', 'error');
  }
}

function handleImgUpload(input) {
  const file = input && input.files && input.files[0];
  if (file) processProductImageFile(file);
}

document.addEventListener('DOMContentLoaded', () => {
  const imgUpload = document.getElementById('imgUpload');

  if (imgUpload) {
    imgUpload.addEventListener('dragover', e => { e.preventDefault(); });
    imgUpload.addEventListener('drop', e => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) processProductImageFile(file);
    });
  }
});

function clearImg() {
  _uploadedImageUrl = '';
  try {
    window.__lastPackagingImageFile = null;
  } catch (e) {
    /* ignore */
  }
  const prev = document.getElementById('imgPreviewImg');
  const prevWrap = document.getElementById('imgPreview');
  if (prev) prev.src = '';
  if (prevWrap) prevWrap.style.display = 'none';
  const imgFile = document.getElementById('imgFile');
  if (imgFile) imgFile.value = '';
  persistAddProductDraftFromForm();
}

window.resetForm = resetForm;
window.openEdit = openEdit;
window.closeEdit = closeEdit;
window.saveProduct = saveProduct;
window.clearImg = clearImg;
window.handleImgUpload = handleImgUpload;
window.tryAutoFillFromPackaging = tryAutoFillFromPackaging;

/* ---------- product-form-enhance.js ---------- */
/* product-form-enhance.js — تحسينات نموذج المنتج */
// مقترحات أسماء المنتجات
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('f-name');
    const suggest = document.getElementById('product-name-suggest');
    if (input && suggest) {
      input.addEventListener('input', debounce(() => {
        const q = input.value.trim().toLowerCase();
        if (!q || q.length < 2) { suggest.innerHTML = ''; return; }
        const matches = adminProductsSafe()
          .filter(p => (p.name||'').toLowerCase().includes(q))
          .slice(0, 5);
        if (!matches.length) { suggest.innerHTML = ''; return; }
        suggest.innerHTML = matches.map(p =>
          `<div class="name-suggest-item" data-action="apply-name-suggest" data-name="${escHtml(p.name)}">
          ${(p.image && typeof p.image === 'string' && (p.image.startsWith('http://')||p.image.startsWith('https://')||p.image.startsWith('/'))) ? `<img src="${escHtml(p.image)}" class="img-cover" style="width:24px;height:24px;border-radius:4px" loading="lazy" decoding="async" alt="">` : '<span>📦</span>'}
          ${escHtml(p.name)} — ${fmt(p.price)}
        </div>`
        ).join('');
      }, 200));

      document.addEventListener('click', e => {
        if (!input.contains(e.target) && !suggest.contains(e.target)) suggest.innerHTML = '';
      });
    }

    var saveDraftDebounced =
      typeof persistAddProductDraftFromForm === 'function'
        ? typeof debounce === 'function'
          ? debounce(function () {
              persistAddProductDraftFromForm();
            }, 400)
          : function () {
              persistAddProductDraftFromForm();
            }
        : null;
    if (saveDraftDebounced) {
      ['f-name', 'f-price', 'f-old'].forEach(function (fid) {
        var fel = document.getElementById(fid);
        if (fel) fel.addEventListener('input', saveDraftDebounced);
      });
    }

    var ptypeEl = document.getElementById('f-product-type');
    if (ptypeEl) {
      ptypeEl.addEventListener('change', function () {
        if (typeof ensureDefaultMainCategoryIfEmpty === 'function') {
          ensureDefaultMainCategoryIfEmpty();
        }
      });
    }

    var ensureCatFromText =
      typeof debounce === 'function'
        ? debounce(function () {
            if (typeof ensureDefaultMainCategoryIfEmpty === 'function') {
              ensureDefaultMainCategoryIfEmpty();
            }
          }, 450)
        : null;
    if (ensureCatFromText) {
      ['f-name', 'f-desc'].forEach(function (fid) {
        var el = document.getElementById(fid);
        if (el) el.addEventListener('input', ensureCatFromText);
      });
    }

    // مؤشر قوة كلمة المرور
    const newPass = document.getElementById('new-pass');
    const bar = document.getElementById('passStrengthBar');
    const txt = document.getElementById('passStrengthText');
    if (newPass && bar) {
      newPass.addEventListener('input', () => {
        const v = newPass.value;
        let score = 0;
        if (v.length >= 8) score++;
        if (/[A-Z]/.test(v)) score++;
        if (/[0-9]/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const colors = ['#ef4444','#f97316','#eab308','#22c55e'];
        const labels = ['ضعيفة','متوسطة','جيدة','قوية'];
        bar.style.width = (score * 25) + '%';
        bar.style.background = colors[score - 1] || '#e2e8f0';
        if (txt) txt.textContent = labels[score - 1] || '';
      });
    }
  });
})();

// نافذة عرض سريع للمنتج
function closeProductQuickView() {
  const el = document.getElementById('productQuickView');
  if (el) el.style.display = 'none';
}

window.closeProductQuickView = closeProductQuickView;

/* ---------- admin-categories.js ---------- */
/* admin-categories.js — إدارة الأقسام الرئيسية والفرعية */
// ═══ أقسام رئيسية — الرسم في AdminApp.mainCategoriesPage ═══

let _editMainCatId = null;
let _maincatSlugManual = false;

const MAINCAT_ICON_CHOICES = ['💊', '💄', '🩺', '👶', '🧬', '🧴', '✨', '💪', '📦', '🌿', '💉', '🩹', '🍼', '🧸', '⚕️', '🦷', '👁️', '💧', '🔬', '🧪', '❤️', '🌡️', '💠', '🏥'];

function maincatSyncSlugFromName() {
  if (_maincatSlugManual || _editMainCatId) return;
  const name = getVal('maincat-name');
  const raw = typeof slugify === 'function' ? slugify(name) : String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
  let s = raw.replace(/^-+|-+$/g, '');
  if (!s) s = 'q-' + Date.now().toString(36);
  setVal('maincat-slug', s);
}

function openMainCatModal(id) {
  const modal = document.getElementById('mainCatModal');
  const title = document.getElementById('mainCatModalTitle');
  if (!modal) return;

  _editMainCatId = id || null;
  _maincatSlugManual = !!id;
  const catsList = adminCategoriesSafe();
  const cat = id ? catsList.find(c => String(c.id) === String(id)) : null;

  if (title) title.textContent = cat ? '✏️ تعديل القسم' : '➕ إضافة قسم رئيسي';
  setVal('maincat-id', cat && cat.id ? cat.id : '');
  setVal('maincat-name', cat && cat.name ? cat.name : '');
  setVal('maincat-slug', cat && cat.slug ? cat.slug : '');
  setVal('maincat-icon', cat && cat.icon ? cat.icon : '📦');
  setChecked('maincat-active', cat ? cat.active !== false : true);

  document.querySelectorAll('#maincat-icon-picker .maincat-ico-btn').forEach(function (b) {
    b.classList.toggle('is-picked', (cat && cat.icon ? cat.icon : '📦') === b.getAttribute('data-icon'));
  });

  modal.style.display = 'flex';
  if (!_editMainCatId) maincatSyncSlugFromName();
}

function closeMainCatModal() {
  const modal = document.getElementById('mainCatModal');
  if (modal) modal.style.display = 'none';
  _editMainCatId = null;
}

async function saveMainCategory() {
  const name = getVal('maincat-name');
  if (!name) { showToast('اسم القسم مطلوب', 'error'); return; }
  let slug = (getVal('maincat-slug') || '').trim();
  if (!slug) slug = typeof slugify === 'function' ? slugify(name) : name;
  slug = String(slug).replace(/^-+|-+$/g, '') || 'q-' + Date.now().toString(36);
  const cats = adminCategoriesSafe();
  let orderVal = 0;
  if (_editMainCatId) {
    const ec = cats.find(c => String(c.id) === String(_editMainCatId));
    orderVal = ec ? (Number(ec.order) || 0) : 0;
  } else {
    orderVal = cats.reduce(function (m, c) { return Math.max(m, Number(c.order) || 0); }, -1) + 1;
  }
  const data = {
    id: _editMainCatId || undefined,
    name,
    slug,
    icon: getVal('maincat-icon') || '📦',
    order: orderVal,
    active: getChecked('maincat-active'),
  };
  const btn = document.getElementById('btn-save-maincat');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ جاري الحفظ...';
  }
  const r = await adminSaveCategory(data);
  if (btn) {
    btn.disabled = false;
    btn.textContent = '💾 حفظ';
  }
  if (apiIsSuccess(r)) {
    showToast('تم حفظ القسم بنجاح ✓');
    closeMainCatModal();
    try {
      await refreshAfterCategoryChange();
    } catch (e) {
      console.error('[admin] saveMainCategory', e);
    }
  } else showToast(apiErrorMessage(r) || 'تعذر حفظ القسم', 'error');
}

async function persistMainCategoryOrder(orderedIds) {
  if (!orderedIds || !orderedIds.length) return;
  const cats = adminCategoriesSafe();
  if (typeof showLoader === 'function') showLoader();
  try {
    for (var i = 0; i < orderedIds.length; i++) {
      var id = orderedIds[i];
      var cat = cats.find(function (c) { return String(c.id) === String(id); });
      if (!cat) continue;
      var newOrder = i;
      if ((Number(cat.order) || 0) === newOrder) continue;
      var r = await adminSaveCategory({
        id: cat.id,
        name: cat.name,
        slug: cat.slug || String(cat.id),
        icon: cat.icon || '📦',
        order: newOrder,
        active: cat.active !== false,
      });
      if (!apiIsSuccess(r)) {
        showToast(apiErrorMessage(r) || 'تعذر حفظ الترتيب', 'error');
        if (typeof refreshAfterCategoryChange === 'function') await refreshAfterCategoryChange();
        return;
      }
    }
    showToast('تم تحديث ترتيب الأقسام ✓');
    if (typeof refreshAfterCategoryChange === 'function') await refreshAfterCategoryChange();
  } catch (e) {
    if (typeof pharmaLogError === 'function') pharmaLogError('[persistMainCategoryOrder]', e);
    showToast('تعذر حفظ الترتيب', 'error');
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
  }
}

function deleteMainCat(id) {
  const cat = adminCategoriesSafe().find(c => String(c.id) === String(id));
  const label = cat && cat.name ? '«' + cat.name + '»' : 'هذا القسم';
  const run = async function () {
    const r = await adminDeleteCategory(id);
    if (apiIsSuccess(r)) {
      showToast('تم حذف القسم');
      try {
        await refreshAfterCategoryChange();
      } catch (e) {
        console.error('[admin] deleteMainCat', e);
      }
    } else showToast(apiErrorMessage(r) || 'تعذر الحذف', 'error');
  };
  if (typeof confirmDialog === 'function') {
    confirmDialog('حذف ' + label + '؟ قد يؤثر على المنتجات المرتبطة. لا يمكن التراجع.', function () {
      run();
    });
  } else {
    if (!confirm('حذف القسم؟')) return;
    run();
  }
}

function toggleMainCatSelect(id) {
  if (window.__adminStoreApi && typeof window.__adminStoreApi.toggleMainCatSelection === 'function') {
    window.__adminStoreApi.toggleMainCatSelection(id);
  }
  if (window.AdminApp && window.AdminApp.mainCategoriesPage) window.AdminApp.mainCategoriesPage.render();
}

function clearMainCategorySelection() {
  if (window.__adminStoreApi && typeof window.__adminStoreApi.clearMainCatSelections === 'function') {
    window.__adminStoreApi.clearMainCatSelections();
  }
  document.querySelectorAll('.maincat-chk').forEach(function (c) {
    c.checked = false;
  });
  if (window.AdminApp && window.AdminApp.mainCategoriesPage) window.AdminApp.mainCategoriesPage.render();
}

async function bulkDeleteMainCategories() {
  const ids = [..._adminState.selectedMainCats];
  if (!ids.length) return;
  const run = async function () {
    for (const id of ids) await adminDeleteCategory(id);
    clearMainCategorySelection();
    showToast('تم حذف الأقسام المحددة');
    try {
      await refreshAfterCategoryChange();
    } catch (e) {
      console.error('[admin] bulkDeleteMainCategories', e);
    }
  };
  if (typeof confirmDialog === 'function') {
    confirmDialog('حذف ' + ids.length + ' قسم محدد؟ لا يمكن التراجع.', run);
  } else if (confirm('حذف ' + ids.length + ' قسم؟')) {
    await run();
  }
}

function bulkEditMainCategory() { showToast('اختر قسماً واحداً للتعديل', 'error'); }

function bulkViewMainCategoryProducts(slug) {
  const prods = adminProductsSafe().filter(p => p.cat === slug || (Array.isArray(p.categories) && p.categories.includes(slug)));
  showToast(`${prods.length} منتج في هذا القسم`);
  var fc = document.getElementById('filter-cat');
  if (fc) fc.value = slug;
  if (window.__adminStoreApi && typeof window.__adminStoreApi.patchProductListFilter === 'function') {
    window.__adminStoreApi.patchProductListFilter({ cat: slug });
  }
  showPage('products');
  refreshProductsView();
}

function openAddProductWithSubcategory() {
  if (typeof resetForm === 'function') resetForm();
  if (typeof showPage === 'function') showPage('add');
}

window.renderMainCatList = function () {
  if (window.AdminApp && window.AdminApp.mainCategoriesPage) window.AdminApp.mainCategoriesPage.render();
};
window.openMainCatModal = openMainCatModal;
window.closeMainCatModal = closeMainCatModal;
window.saveMainCategory = saveMainCategory;
window.deleteMainCat = deleteMainCat;
window.persistMainCategoryOrder = persistMainCategoryOrder;
window.toggleMainCatSelect = toggleMainCatSelect;
window.clearMainCategorySelection = clearMainCategorySelection;
window.bulkDeleteMainCategories = bulkDeleteMainCategories;
window.bulkEditMainCategory = bulkEditMainCategory;
window.bulkViewMainCategoryProducts = bulkViewMainCategoryProducts;
/* الأقسام الفرعية: openSubcatModal / saveSubcategory / … تُعرَّف في subcategoriesPage.js */
window.toggleSubcatSelect = function () {};
window.clearSubcategorySelection = function () {};
window.bulkDeleteSubcategories = function () {};
window.bulkEditSubcategory = function () {};
window.bulkViewSubcategoryProducts = function () {};
window.openAddProductWithSubcategory = openAddProductWithSubcategory;

/* ---------- category-admin.js ---------- */
/* نماذج الأقسام — أقسام رئيسية فقط (بدون فرعية) */

function buildNestedMaincatsHtml(cats) {
  const subsAll = adminSubcategoriesSafe();
  return cats
    .map(function (c) {
      const val = escHtml(c.slug || c.id);
      const slugKey = String(c.slug != null ? c.slug : c.id);
      const subs = subsAll
        .filter(function (s) {
          return String(s.parent || '') === slugKey && s.active !== false;
        })
        .slice()
        .sort(function (a, b) {
          return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
        });
      var subsBody = '';
      if (!subs.length) {
        subsBody =
          '<div class="maincat-subs-empty">لا توجد أقسام فرعية لهذا القسم. أنشئها من «الأقسام الفرعية» في القائمة.</div>';
      } else {
        subsBody = subs
          .map(function (s) {
            const sid = escHtml(String(s.id));
            return (
              '<label class="product-subcat-opt-nested">' +
              '<input type="checkbox" class="subcat-cb" value="' +
              sid +
              '" data-parent-slug="' +
              escHtml(slugKey) +
              '">' +
              '<span>' +
              (s.icon || '📁') +
              ' ' +
              escHtml(s.name || '') +
              '</span></label>'
            );
          })
          .join('');
      }
      return (
        '<div class="maincat-block" data-main-slug="' +
        escHtml(slugKey) +
        '">' +
        '<label class="maincat-row">' +
        '<input type="checkbox" class="maincat-cb" value="' +
        val +
        '">' +
        '<span>' +
        (c.icon || '📦') +
        ' ' +
        escHtml(c.name) +
        '</span></label>' +
        '<div class="maincat-subs-panel">' +
        '<div class="maincat-subs-hd">الأقسام الفرعية</div>' +
        '<div class="maincat-subs-inner maincat-subs-inner--locked" data-subs-for="' +
        escHtml(slugKey) +
        '">' +
        subsBody +
        '</div></div></div>'
      );
    })
    .join('');
}

function syncNestedMaincatPanels() {
  document.querySelectorAll('#f-maincats-list .maincat-block, #em-maincats-list .maincat-block').forEach(function (block) {
    const cb = block.querySelector('.maincat-cb');
    const inner = block.querySelector('.maincat-subs-inner');
    if (!inner) return;
    if (cb && cb.checked) {
      inner.classList.remove('maincat-subs-inner--locked');
    } else {
      inner.classList.add('maincat-subs-inner--locked');
      block.querySelectorAll('.subcat-cb').forEach(function (sc) {
        sc.checked = false;
      });
    }
  });
  refreshNestedSubcatSummary();
}

function refreshNestedSubcatSummary() {
  const el = document.getElementById('f-nested-subcat-summary');
  if (!el) return;
  const n = document.querySelectorAll('#f-maincats-list .subcat-cb:checked').length;
  if (!n) {
    el.textContent = '';
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = 'محدد: ' + n + ' قسم فرعي';
}

function bindNestedMaincatSubsOnce() {
  function bindRoot(id) {
    const root = document.getElementById(id);
    if (!root || root.dataset.nestedMainSubsBound === '1') return;
    root.dataset.nestedMainSubsBound = '1';
    root.addEventListener('change', function (e) {
      const t = e.target;
      if (!t || !t.classList) return;
      if (t.classList.contains('maincat-cb')) {
        syncNestedMaincatPanels();
      } else if (t.classList.contains('subcat-cb')) {
        refreshNestedSubcatSummary();
      }
    });
  }
  bindRoot('f-maincats-list');
  bindRoot('em-maincats-list');
}

/** يطبّق أقسام المنتج على نموذج الإضافة/التعديل (بعد إعادة بناء HTML). */
function applyNestedCategoriesFromProduct(p) {
  if (!p) return;
  const pcats = p.categories || (p.cat ? [p.cat] : []);
  document.querySelectorAll('#f-maincats-list .maincat-cb').forEach(function (cb) {
    cb.checked = pcats.some(function (x) {
      return String(x) === String(cb.value);
    });
  });
  syncNestedMaincatPanels();
  const psubs = Array.isArray(p.subcategories) ? p.subcategories : [];
  document.querySelectorAll('#f-maincats-list .subcat-cb').forEach(function (cb) {
    cb.checked = psubs.some(function (x) {
      return String(x) === String(cb.value);
    });
  });
  refreshNestedSubcatSummary();
}

function firstMaincatCbBySlugs(root, slugs) {
  if (!root || !Array.isArray(slugs)) return null;
  for (var i = 0; i < slugs.length; i++) {
    var slug = slugs[i];
    if (!slug) continue;
    var el = root.querySelector('.maincat-cb[value="' + String(slug) + '"]');
    if (el) return el;
  }
  return null;
}

/**
 * إن لم يُختر أي قسم رئيسي: نوع المنتج + تلميح من الاسم/الوصف (شعر، شامبو، أسنان، معجون…).
 * لمنتج جديد فقط.
 */
function ensureDefaultMainCategoryIfEmpty() {
  if (_editingProductId != null) return;
  const root = document.getElementById('f-maincats-list');
  if (!root || root.querySelector('.maincat-empty-state')) return;
  if (root.querySelector('.maincat-cb:checked')) return;

  var ptype = (typeof getVal === 'function' ? getVal('f-product-type') : '').trim().toLowerCase();
  var nameBlob = (
    (typeof getVal === 'function' ? getVal('f-name') : '') +
    ' ' +
    (typeof getVal === 'function' ? getVal('f-desc') : '')
  ).toLowerCase();

  var fallbackAll = ['medicine', 'medical', 'cosmetics', 'haircare', 'oralcare', 'vitamins', 'kids'];

  var preferred = null;

  if (/شعر|شامبو|بلسم|صبغ|فروة|تساقط|hair|shampoo|conditioner/i.test(nameBlob)) {
    preferred = firstMaincatCbBySlugs(root, ['haircare', 'cosmetics', 'oralcare'].concat(fallbackAll));
  } else if (/أسنان|الفم|معجون|فرشاة|غسول\s*فم|خيط\s*أسنان|mouth|tooth|dental|oral|toothpaste/i.test(nameBlob)) {
    preferred = firstMaincatCbBySlugs(root, ['oralcare', 'cosmetics', 'haircare'].concat(fallbackAll));
  } else if (
    /أطفال|رضيع|للأطفال|بودرة\s*أطفال|بيبي|حفاض|رضاعة|ببرونة|لهاية|نونو|baby|babies|infant|kids|toddler|nappy|diaper|powder\s*baby/i.test(
      nameBlob
    )
  ) {
    preferred = firstMaincatCbBySlugs(root, ['kids', 'cosmetics', 'medicine', 'medical'].concat(fallbackAll));
  }

  if (!preferred && ptype === 'cosmetic') {
    preferred = firstMaincatCbBySlugs(root, ['cosmetics', 'haircare', 'oralcare'].concat(fallbackAll));
  } else if (!preferred && (ptype === 'medicine' || ptype === 'device' || ptype === 'supplement')) {
    preferred = firstMaincatCbBySlugs(root, ['medicine', 'medical'].concat(fallbackAll));
  } else if (!preferred) {
    preferred = firstMaincatCbBySlugs(root, ['medicine', 'cosmetics', 'haircare', 'oralcare', 'medical', 'vitamins', 'kids']);
  }

  if (!preferred) {
    preferred = root.querySelector('.maincat-cb');
  }
  if (preferred) {
    preferred.checked = true;
    syncNestedMaincatPanels();
  }
}

// تعبئة قوائم الأقسام في نموذج المنتج
function populateCategoryCheckboxes() {
  const cats = adminCategoriesSafe()
    .slice()
    .sort(function (a, b) {
      const oa = Number(a.order) || 0;
      const ob = Number(b.order) || 0;
      if (oa !== ob) return oa - ob;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });

  const nestedHtml = cats.length
    ? buildNestedMaincatsHtml(cats)
    : '<div class="maincat-empty-state" style="padding:16px;text-align:center;color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;font-size:13px;">لا توجد أقسام رئيسية محمّلة. افتح «الأقسام الرئيسية» من القائمة أو انتظر اكتمال التحميل ثم حدّث الصفحة.</div>';
  ['f-maincats-list', 'em-maincats-list'].forEach(function (listId) {
    const el = document.getElementById(listId);
    if (!el) return;
    el.innerHTML = nestedHtml;
  });

  bindNestedMaincatSubsOnce();
  refreshNestedSubcatSummary();

  if (_editingProductId != null) {
    var editP = adminProductsSafe().find(function (x) {
      return String(x.id) === String(_editingProductId);
    });
    if (editP) applyNestedCategoriesFromProduct(editP);
  } else {
    ensureDefaultMainCategoryIfEmpty();
    restoreAddProductDraftIfNewProduct();
    ensureDefaultMainCategoryIfEmpty();
    ensureDefaultNewProductPriceIfAdding();
  }

  const filterCat = document.getElementById('filter-cat');
  if (filterCat) {
    const cur = filterCat.value;
    filterCat.innerHTML = `<option value="">كل الأقسام</option>` +
      adminCategoriesSafe().map(c => `<option value="${escHtml(c.slug||c.id)}" ${cur===(c.slug||c.id)?'selected':''}>${escHtml(c.name)}</option>`).join('');
  }

}

window.populateCategoryCheckboxes = populateCategoryCheckboxes;

/* ---------- admin-backup.js ---------- */
/* admin-backup.js — النسخ الاحتياطي والاستعادة */
async function downloadBackup() {
  let r;
  try {
    r = await adminBackup();
  } catch (e) {
    console.error('[admin] downloadBackup', e);
    showToast('فشل الاتصال بالخادم', 'error');
    return;
  }
  if (!apiIsSuccess(r)) { showToast(apiErrorMessage(r) || 'فشل النسخ الاحتياطي', 'error'); return; }
  const snap = (r.data && r.data.database) ? r.data.database : (r.data || {});
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('تم تحميل النسخة الاحتياطية ✓');
}

// استعادة النسخة الاحتياطية
document.addEventListener('DOMContentLoaded', () => {
  const restoreFile = document.getElementById('restoreFile');
  if (restoreFile) {
    restoreFile.addEventListener('change', async () => {
      const file = restoreFile.files[0];
      if (!file) return;
      if (!confirm('استعادة قاعدة البيانات من هذا الملف؟ سيتم الكتابة فوق البيانات الحالية.')) {
        restoreFile.value = ''; return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const r = await adminFetch('restore', { data });
        if (apiIsSuccess(r)) { showToast('تمت الاستعادة ✓'); loadAndRenderAll(); }
        else showToast(apiErrorMessage(r) || 'فشل الاستعادة', 'error');
      } catch (e) {
        showToast('ملف غير صالح', 'error');
      }
      restoreFile.value = '';
    });
  }

  const importFile = document.getElementById('importSettingsFile');
  if (importFile) {
    importFile.addEventListener('change', async () => {
      const file = importFile.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const r = await adminSaveSettings(data);
        if (apiIsSuccess(r)) { showToast('تم استيراد الإعدادات ✓'); loadAndRenderAll(); }
        else showToast(apiErrorMessage(r) || 'فشل الاستيراد', 'error');
      } catch (e) {
        showToast('ملف غير صالح', 'error');
      }
      importFile.value = '';
    });
  }
});

async function exportSettings() {
  const s = _adminState.settings;
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmacy_settings_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('تم تصدير الإعدادات ✓');
}

window.downloadBackup = downloadBackup;
window.exportSettings = exportSettings;

/* ---------- admin-homepage.js ---------- */
/* admin-homepage.js — إعدادات الصفحة الرئيسية */
function renderHomepageSettings() {
  if (!_adminState.settings || typeof _adminState.settings !== 'object') {
    _adminState.settings = {};
  }
  const s = _adminState.settings;
  if (!Array.isArray(s.heroSlides)) s.heroSlides = [];
  if (!Array.isArray(s.categorySliderItems)) s.categorySliderItems = [];

  setVal('hp-hero-ms', s.heroSliderAutoplayMs || 2000);
  setVal('hp-hero-effect', s.heroSliderEffect || 'slide');
  setVal('hp-cat-mode', s.categorySliderMode || 'manual');
  setVal('hp-sec-title', s.homeSectionCategoryTitle || 'تسوّق حسب الفئة');
  setVal('hp-sec-kicker', s.homeSectionCategoryKicker || 'تصفّح الأقسام');
  setVal('hp-sec-sub', s.homeSectionCategorySub || '');
  setVal('hp-spotlight-video-url', s.homeSpotlightVideoUrl || '');

  renderHeroSlidesList(s.heroSlides || []);
  renderCatSlidesList(s.categorySliderItems || []);
}

function renderHeroSlidesList(slides) {
  const list = document.getElementById('hpHeroList');
  if (!list) return;
  if (!slides.length) { list.innerHTML = '<p style="color:#64748b;text-align:center;padding:16px">لا توجد شرائح</p>'; return; }

  list.innerHTML = slides.map((s, i) => `<div class="hp-slide-item" style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:center">
    <span style="font-size:20px;opacity:.4;cursor:move">⋮⋮</span>
    ${(s.image && typeof s.image === 'string' && (s.image.startsWith('http://')||s.image.startsWith('https://')||s.image.startsWith('/'))) ? `<img src="${escHtml(s.image)}" class="img-cover" style="width:60px;height:40px;border-radius:6px" loading="lazy" decoding="async" alt="">` : '<div style="width:60px;height:40px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center">🖼️</div>'}
    <div style="flex:1">
      <div style="font-weight:700;font-size:13.5px">${escHtml(s.headline||s.title||'شريحة '+(i+1))}</div>
      <div style="font-size:12px;color:#64748b">${escHtml(s.subtitle||s.desc||'')}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
        <input type="checkbox" ${s.active!==false?'checked':''} data-action="toggle-hero-slide" data-index="${i}"> نشط
      </label>
      <button class="btn-sm btn-danger" data-action="remove-hero-slide" data-index="${i}">✕</button>
    </div>
  </div>`).join('');
}

function renderCatSlidesList(items) {
  const list = document.getElementById('hpCatList');
  if (!list) return;
  if (!items.length) { list.innerHTML = '<p style="color:#64748b;text-align:center;padding:16px">لا توجد عناصر</p>'; return; }

  list.innerHTML = items.map((item, i) => `<div class="hp-cat-item" style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:center">
    ${(item.image && typeof item.image === 'string' && (item.image.startsWith('http://')||item.image.startsWith('https://')||item.image.startsWith('/'))) ? `<img src="${escHtml(item.image)}" class="img-cover" style="width:60px;height:40px;border-radius:6px" loading="lazy" decoding="async" alt="">` : '<div style="width:60px;height:40px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center">🖼️</div>'}
    <div style="flex:1">
      <div style="font-weight:700;font-size:13.5px">${escHtml(item.title||'عنصر '+(i+1))}</div>
      <div style="font-size:12px;color:#64748b">${escHtml(item.subtitle||'')}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
        <input type="checkbox" ${item.active!==false?'checked':''} data-action="toggle-cat-slide" data-index="${i}"> نشط
      </label>
      <button class="btn-sm btn-danger" data-action="remove-cat-slide" data-index="${i}">✕</button>
    </div>
  </div>`).join('');
}

function toggleHeroSlide(idx, active) {
  const slides = _adminState.settings.heroSlides || [];
  if (slides[idx]) slides[idx].active = active;
}

function toggleCatSlide(idx, active) {
  const items = _adminState.settings.categorySliderItems || [];
  if (items[idx]) items[idx].active = active;
}

function removeHeroSlide(idx) {
  const slides = _adminState.settings.heroSlides || [];
  slides.splice(idx, 1);
  renderHeroSlidesList(slides);
}

function removeCatSlide(idx) {
  const items = _adminState.settings.categorySliderItems || [];
  items.splice(idx, 1);
  renderCatSlidesList(items);
}

function addHeroSlide() {
  if (!_adminState.settings.heroSlides) _adminState.settings.heroSlides = [];
  _adminState.settings.heroSlides.push({
    id: 'hero_' + Date.now(),
    headline: 'عنوان الشريحة', subtitle: 'وصف الشريحة',
    btnPrimaryText: 'اطلب الآن', btnPrimaryHref: '#prod-sec',
    active: true, order: _adminState.settings.heroSlides.length + 1
  });
  renderHeroSlidesList(_adminState.settings.heroSlides);
}

function addCatSlide() {
  if (!_adminState.settings.categorySliderItems) _adminState.settings.categorySliderItems = [];
  _adminState.settings.categorySliderItems.push({
    id: 'cslide_' + Date.now(),
    title: 'عنوان جديد', subtitle: '', icon: '📦', linkType: 'category', linkValue: '', active: true,
    order: _adminState.settings.categorySliderItems.length + 1
  });
  renderCatSlidesList(_adminState.settings.categorySliderItems);
}

async function saveHomepageSettings() {
  const s = _adminState.settings;
  s.heroSliderAutoplayMs = Number(getVal('hp-hero-ms')) || 2000;
  s.heroSliderEffect = getVal('hp-hero-effect') || 'slide';
  s.categorySliderMode = getVal('hp-cat-mode') || 'manual';
  s.homeSectionCategoryTitle = getVal('hp-sec-title');
  s.homeSectionCategoryKicker = getVal('hp-sec-kicker');
  s.homeSectionCategorySub = getVal('hp-sec-sub');
  s.homeSpotlightVideoUrl = getVal('hp-spotlight-video-url').trim();

  const r = await adminSaveSettings(s);
  if (apiIsSuccess(r)) {
    Object.assign(_adminState.settings, s);
    showToast('تم حفظ إعدادات الصفحة الرئيسية ✓');
    if (typeof renderDashboard === 'function') renderDashboard();
  } else showToast(apiErrorMessage(r) || 'فشل الحفظ', 'error');
}

window.renderHomepageSettings = renderHomepageSettings;
window.renderHeroSlidesList = renderHeroSlidesList;
window.renderCatSlidesList = renderCatSlidesList;
window.toggleHeroSlide = toggleHeroSlide;
window.toggleCatSlide = toggleCatSlide;
window.removeHeroSlide = removeHeroSlide;
window.removeCatSlide = removeCatSlide;
window.addHeroSlide = addHeroSlide;
window.addCatSlide = addCatSlide;
window.saveHomepageSettings = saveHomepageSettings;

/* ---------- hero-slider-admin.js ---------- */
/**
 * Hero Slider Admin Manager
 * Handles saving/loading slider settings from control panel
 * Works alongside existing admin-homepage.js
 */
(function(){
  'use strict';

  // Default slides data (fallback if API not available)
  var DEFAULT_SLIDES = [
    {
      id: 'slide_default_1',
      badge: 'صيدلية موثوقة — الديالى · خانقين',
      title: 'صحتك أولويتنا دائماً',
      titleEm: 'أولويتنا',
      desc: 'أدوية أصيلة ومنتجات صحية معتمدة — نوصلها أينما كنت في الديالى والمحافظات العراقية بسرعة وأمان.',
      btn1Text: 'اطلب الآن', btn1Link: '#prod-sec', btn1Style: 'primary',
      btn2Text: '💬 استشارة واتساب', btn2Link: 'wa', btn2Style: 'wa',
      image: '', bgColor: 'green',
      active: true
    },
    {
      id: 'slide_default_2',
      badge: 'أكثر من 5,000 نوع',
      title: 'فيتامينات لكل احتياج',
      titleEm: 'لكل احتياج',
      desc: 'مكملات غذائية أصيلة لصحة أفضل كل يوم — فيتامين C، D، أوميغا 3 وأكثر.',
      btn1Text: '🌿 تصفح الفيتامينات', btn1Link: 'categories.html', btn1Style: 'purple',
      btn2Text: '💬 استشارة مجانية', btn2Link: 'wa', btn2Style: 'wa',
      image: '', bgColor: 'purple',
      active: true
    },
    {
      id: 'slide_default_3',
      badge: '🚚 توصيل لكل المحافظات',
      title: 'نوصل طلبك بسرعة',
      titleEm: 'بسرعة',
      desc: 'شحن موثوق لجميع المحافظات العراقية مع تنسيق وتأكيد عبر واتساب.',
      btn1Text: '📂 تصفح المنتجات', btn1Link: 'categories.html', btn1Style: 'orange',
      btn2Text: '💬 تواصل معنا', btn2Link: 'wa', btn2Style: 'wa',
      image: '', bgColor: 'orange',
      active: true
    }
  ];

  // Expose for admin panel
  window.HeroSliderAdmin = {
    slides: [],

    init: function() {
      this.load();
    },

    load: function() {
      var self = this;
      try {
        var saved = localStorage.getItem('pharma_hero_slides_v1');
        if (saved) {
          self.slides = JSON.parse(saved);
        } else {
          self.slides = JSON.parse(JSON.stringify(DEFAULT_SLIDES));
        }
      } catch(e) {
        self.slides = JSON.parse(JSON.stringify(DEFAULT_SLIDES));
      }
      self.render();
    },

    save: function() {
      try {
        localStorage.setItem('pharma_hero_slides_v1', JSON.stringify(this.slides));
        // Also send to API if available
        if (window.adminApi && typeof window.adminApi.saveHomepageSlides === 'function') {
          window.adminApi.saveHomepageSlides(this.slides);
        }
        this.showToast('✅ تم حفظ الشرائح');
      } catch(e) {
        this.showToast('❌ خطأ في الحفظ');
      }
    },

    render: function() {
      var list = document.getElementById('hpHeroList');
      if (!list) return;
      if (!this.slides.length) {
        list.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:12px 0;">لا توجد شرائح. اضغط إضافة شريحة.</p>';
        return;
      }
      var html = '';
      this.slides.forEach(function(s, i) {
        var bgColors = {green:'#00875a', purple:'#7c3aed', orange:'#ea580c'};
        var color = bgColors[s.bgColor] || '#00875a';
        html += '<div class="hp-slide-card" data-idx="'+i+'" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;position:relative;border-right:4px solid '+color+';">';
        html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
        html += '<div style="width:10px;height:10px;border-radius:50%;background:'+(s.active?'#22c55e':'#94a3b8')+';flex-shrink:0;"></div>';
        html += '<strong style="font-size:14px;flex:1;color:#0a1628;">'+escapeHtml(s.title)+'</strong>';
        html += '<div style="display:flex;gap:6px;">';
        html += '<button type="button" data-action="hero-move-up" data-index="'+i+'" style="width:30px;height:30px;border:1px solid #e2e8f0;border-radius:8px;background:#f7f9fc;cursor:pointer;font-size:14px;" title="لأعلى">↑</button>';
        html += '<button type="button" data-action="hero-move-down" data-index="'+i+'" style="width:30px;height:30px;border:1px solid #e2e8f0;border-radius:8px;background:#f7f9fc;cursor:pointer;font-size:14px;" title="لأسفل">↓</button>';
        html += '<button type="button" data-action="hero-edit" data-index="'+i+'" style="width:30px;height:30px;border:1px solid #3b82f6;border-radius:8px;background:rgba(59,130,246,.08);color:#3b82f6;cursor:pointer;font-size:12px;" title="تعديل">✏️</button>';
        html += '<button type="button" data-action="hero-toggle" data-index="'+i+'" style="width:30px;height:30px;border:1px solid #e2e8f0;border-radius:8px;background:'+(s.active?'rgba(34,197,94,.1)':'#f7f9fc')+';cursor:pointer;font-size:12px;" title="تفعيل/إخفاء">'+(s.active?'👁':'🚫')+'</button>';
        html += '<button type="button" data-action="hero-remove" data-index="'+i+'" style="width:30px;height:30px;border:1px solid #ef4444;border-radius:8px;background:rgba(239,68,68,.08);color:#ef4444;cursor:pointer;font-size:12px;" title="حذف">🗑</button>';
        html += '</div></div>';
        html += '<div style="font-size:12px;color:#64748b;">'+escapeHtml(s.desc.substring(0,80))+'...</div>';
        html += '</div>';
      });
      list.innerHTML = html;
    },

    add: function(slideData) {
      var newSlide = Object.assign({
        id: 'slide_' + Date.now(),
        badge: 'صيدلية شهد محمد',
        title: 'عنوان الشريحة الجديدة',
        titleEm: '',
        desc: 'وصف الشريحة هنا...',
        btn1Text: 'اطلب الآن', btn1Link: '#prod-sec', btn1Style: 'primary',
        btn2Text: '💬 واتساب', btn2Link: 'wa', btn2Style: 'wa',
        image: '', bgColor: 'green', active: true
      }, slideData || {});
      this.slides.push(newSlide);
      this.render();
      this.openEditModal(this.slides.length - 1);
    },

    remove: function(idx) {
      if (!confirm('حذف هذه الشريحة؟')) return;
      this.slides.splice(idx, 1);
      this.render();
    },

    toggleActive: function(idx) {
      this.slides[idx].active = !this.slides[idx].active;
      this.render();
    },

    moveUp: function(idx) {
      if (idx === 0) return;
      var tmp = this.slides[idx];
      this.slides[idx] = this.slides[idx-1];
      this.slides[idx-1] = tmp;
      this.render();
    },

    moveDown: function(idx) {
      if (idx >= this.slides.length - 1) return;
      var tmp = this.slides[idx];
      this.slides[idx] = this.slides[idx+1];
      this.slides[idx+1] = tmp;
      this.render();
    },

    edit: function(idx) {
      this.openEditModal(idx);
    },

    openEditModal: function(idx) {
      var s = this.slides[idx];
      var modal = document.getElementById('heroSlideEditModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'heroSlideEditModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(6px);padding:16px;';
        document.body.appendChild(modal);
      }
      modal.innerHTML = `
        <div style="background:#fff;border-radius:20px;padding:28px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <h3 style="margin:0;font-size:18px;color:#0a1628;">✏️ تعديل الشريحة</h3>
            <button data-action="close-hero-edit-modal" style="width:36px;height:36px;border:1px solid #e2e8f0;border-radius:10px;background:#f7f9fc;cursor:pointer;font-size:16px;">✕</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div><label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:5px;">🏷 نص الشارة (Badge)</label>
              <input id="se-badge" type="text" value="${escapeHtml(s.badge)}" style="${inputStyle}"></div>
            <div><label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:5px;">📝 العنوان الرئيسي</label>
              <input id="se-title" type="text" value="${escapeHtml(s.title)}" style="${inputStyle}"></div>
            <div><label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:5px;">✨ الكلمة المميزة (تلوّن بالتدرج)</label>
              <input id="se-em" type="text" value="${escapeHtml(s.titleEm||'')}" style="${inputStyle}" placeholder="اتركه فارغاً إذا لا تريد تمييز كلمة"></div>
            <div><label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:5px;">📄 الوصف</label>
              <textarea id="se-desc" rows="3" style="${inputStyle}padding:10px;">${escapeHtml(s.desc)}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div><label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:5px;">🔘 زر 1 — النص</label>
                <input id="se-btn1" type="text" value="${escapeHtml(s.btn1Text)}" style="${inputStyle}"></div>
              <div><label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:5px;">🔗 زر 1 — الرابط</label>
                <input id="se-btn1link" type="text" value="${escapeHtml(s.btn1Link)}" style="${inputStyle}"></div>
            </div>
            <div><label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:5px;">🎨 لون الخلفية</label>
              <select id="se-bg" style="${inputStyle}">
                <option value="green" ${s.bgColor==='green'?'selected':''}>أخضر (افتراضي)</option>
                <option value="purple" ${s.bgColor==='purple'?'selected':''}>بنفسجي</option>
                <option value="orange" ${s.bgColor==='orange'?'selected':''}>برتقالي</option>
              </select></div>
            <div><label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:5px;">🖼 رابط صورة الخلفية (اختياري)</label>
              <input id="se-image" type="text" value="${escapeHtml(s.image||'')}" style="${inputStyle}" placeholder="https://..."></div>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="se-active" ${s.active?'checked':''} style="width:18px;height:18px;accent-color:#00875a;">
              <label for="se-active" style="font-size:13px;font-weight:700;color:#0a1628;cursor:pointer;">شريحة مفعّلة (تظهر في الموقع)</label>
            </div>
            <div style="display:flex;gap:10px;margin-top:6px;">
              <button data-action="hero-save-edit" data-index="${idx}" style="flex:1;padding:13px;background:linear-gradient(135deg,#00a86e,#00875a);color:#fff;border:none;border-radius:12px;font-family:'Tajawal',sans-serif;font-size:15px;font-weight:900;cursor:pointer;">💾 حفظ الشريحة</button>
              <button data-action="close-hero-edit-modal" style="padding:13px 20px;background:#f7f9fc;color:#64748b;border:1.5px solid #e2e8f0;border-radius:12px;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">إلغاء</button>
            </div>
          </div>
        </div>`;
      modal.style.display = 'flex';
    },

    saveEdit: function(idx) {
      var get = function(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      this.slides[idx] = Object.assign(this.slides[idx], {
        badge: get('se-badge'),
        title: get('se-title'),
        titleEm: get('se-em'),
        desc: get('se-desc'),
        btn1Text: get('se-btn1'),
        btn1Link: get('se-btn1link'),
        bgColor: get('se-bg'),
        image: get('se-image'),
        active: document.getElementById('se-active') ? document.getElementById('se-active').checked : true
      });
      document.getElementById('heroSlideEditModal') && document.getElementById('heroSlideEditModal').remove();
      this.render();
      this.showToast('✅ تم تحديث الشريحة — اضغط حفظ للتطبيق');
    },

    showToast: function(msg) {
      var t = document.getElementById('toast');
      var tm = document.getElementById('toastMsg');
      if (t && tm) { tm.textContent = msg; t.classList.add('show'); setTimeout(function(){ t.classList.remove('show'); }, 3000); }
    }
  };

  var inputStyle = 'width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:"Tajawal",sans-serif;font-size:13.5px;color:#0a1628;outline:none;background:#f7f9fc;';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Override addHeroSlide to use our admin
  window.addHeroSlide = function() { window.HeroSliderAdmin.add(); };

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ window.HeroSliderAdmin.init(); });
  } else {
    window.HeroSliderAdmin.init();
  }

})();

/* ---------- admin-reviews.js ---------- */
/* admin-reviews.js — إدارة التقييمات */
let _editReviewIdx = null;

/* التقييمات: الرسم في AdminApp.reviewsPage */

function openReviewModal(idx) {
  const modal = document.getElementById('reviewModal');
  const title = document.getElementById('reviewModalTitle');
  if (!modal) return;
  _editReviewIdx = idx;
  const r = idx !== null ? (_adminState.reviews[idx] || {}) : {};
  if (title) title.textContent = idx !== null ? 'تعديل التقييم' : 'إضافة تقييم';
  setVal('rv-name', r.name || '');
  setVal('rv-product', r.product_id || r.product || '');
  setVal('rv-city', r.city || '');
  setVal('rv-rating', r.rating || 5);
  setVal('rv-comment', r.comment || '');
  setVal('rv-image-url', r.image_url || '');
  setVal('rv-pharmacist-reply', r.pharmacist_reply || '');
  setChecked('rv-approved', r.approved !== false);
  setChecked('rv-verified', r.verified || false);
  modal.style.display = 'flex';
}

function closeReviewModal() {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.style.display = 'none';
  _editReviewIdx = null;
}

async function saveReviewFromModal() {
  const name = getVal('rv-name');
  if (!name) { showToast('اسم المراجع مطلوب', 'error'); return; }
  const pid = getVal('rv-product');
  if (!pid) { showToast('معرّف المنتج مطلوب', 'error'); return; }
  const prev = _editReviewIdx !== null ? (_adminState.reviews[_editReviewIdx] || null) : null;
  const data = {
    id: _editReviewIdx !== null ? ((prev && prev.id) || genId('rv')) : genId('rv'),
    name,
    product_id: pid,
    product: pid,
    city: getVal('rv-city'),
    rating: Number(getVal('rv-rating')) || 5,
    comment: getVal('rv-comment'),
    image_url: getVal('rv-image-url'),
    pharmacist_reply: getVal('rv-pharmacist-reply'),
    approved: getChecked('rv-approved'),
    verified: getChecked('rv-verified'),
    helpful_up: prev && prev.helpful_up != null ? Number(prev.helpful_up) || 0 : 0,
    helpful_down: prev && prev.helpful_down != null ? Number(prev.helpful_down) || 0 : 0,
    date: _editReviewIdx !== null ? ((prev && prev.date) || Date.now()) : Date.now(),
  };

  const reviews = [...(_adminState.reviews || [])];
  if (_editReviewIdx !== null) reviews[_editReviewIdx] = data;
  else reviews.push(data);

  const r = await adminSaveReviews(reviews);
  if (apiIsSuccess(r)) {
    showToast('تم الحفظ ✓');
    closeReviewModal();
    if (window.AdminServices && window.AdminServices.reviewService && window.__adminStoreApi) {
      window.AdminServices.reviewService.syncToStore(window.__adminStoreApi).then(function () {
        if (window.AdminApp && window.AdminApp.reviewsPage) window.AdminApp.reviewsPage.render();
      });
    }
  } else showToast(apiErrorMessage(r) || 'فشل الحفظ', 'error');
}

async function toggleReviewApproval(idx) {
  const reviews = [...(_adminState.reviews || [])];
  if (reviews[idx]) reviews[idx].approved = !reviews[idx].approved;
  const r = await adminSaveReviews(reviews);
  if (apiIsSuccess(r)) {
    showToast('تم التحديث ✓');
    if (window.AdminServices && window.AdminServices.reviewService && window.__adminStoreApi) {
      window.AdminServices.reviewService.syncToStore(window.__adminStoreApi).then(function () {
        if (window.AdminApp && window.AdminApp.reviewsPage) window.AdminApp.reviewsPage.render();
      });
    }
  } else showToast(apiErrorMessage(r) || 'خطأ', 'error');
}

async function deleteReview(idx) {
  if (!confirm('حذف التقييم؟')) return;
  const reviews = [...(_adminState.reviews || [])];
  reviews.splice(idx, 1);
  const r = await adminSaveReviews(reviews);
  if (apiIsSuccess(r)) {
    showToast('تم الحذف');
    if (window.AdminServices && window.AdminServices.reviewService && window.__adminStoreApi) {
      window.AdminServices.reviewService.syncToStore(window.__adminStoreApi).then(function () {
        if (window.AdminApp && window.AdminApp.reviewsPage) window.AdminApp.reviewsPage.render();
      });
    }
  } else showToast(apiErrorMessage(r) || 'فشل الحذف', 'error');
}

window.loadAndRenderReviews = function () {
  if (window.AdminApp && window.AdminApp.reviewsPage) window.AdminApp.reviewsPage.activate();
};
window.renderReviewsAdminTable = function () {
  if (window.AdminApp && window.AdminApp.reviewsPage) window.AdminApp.reviewsPage.render();
};
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.saveReviewFromModal = saveReviewFromModal;
window.toggleReviewApproval = toggleReviewApproval;
window.deleteReview = deleteReview;

/* ---------- admin-orders.js — الطلبات: الرسم في AdminApp.ordersPage ---------- */

function openOrderModal(id) {
  const modal = document.getElementById('orderModal');
  const title = document.getElementById('orderModalTitle');
  if (!modal) return;
  const o = adminOrdersSafe().find(x => String(x.id) === String(id));
  if (!o) return;
  if (title) title.textContent = `الطلب #${String(id).slice(-6)}`;

  setVal('om-name', o.name || o.customer_name || '');
  setVal('om-phone', o.phone || '');
  setVal('om-addr', o.address || '');
  setVal('om-notes', o.notes || '');

  const itemsList = document.getElementById('om-items');
  if (itemsList) {
    itemsList.innerHTML = (o.items||[]).map(i =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9">
        <span>${escHtml(i.name)} × ${i.qty||1}</span>
        <strong>${fmt(Number(i.price||0) * (i.qty||1))}</strong>
      </div>`).join('');
  }

  const total = (o.items||[]).reduce((s, i) => s + (Number(i.price||0) * (i.qty||1)), 0);
  const totEl = document.getElementById('om-total');
  if (totEl) totEl.textContent = fmt(total);

  modal.style.display = 'flex';
}

function closeOrderModal() {
  const modal = document.getElementById('orderModal');
  if (modal) modal.style.display = 'none';
}

async function confirmDeleteOrder(id) {
  if (!confirm('حذف الطلب؟')) return;
  var svc = window.AdminServices && window.AdminServices.orderService;
  var storeApi = window.__adminStoreApi;
  if (!svc || !storeApi) return;
  var res = await svc.deleteOrder(id);
  if (res.ok) {
    showToast('تم الحذف');
    try {
      await svc.syncToStore(storeApi);
      if (window.AdminApp && window.AdminApp.ordersPage) window.AdminApp.ordersPage.render();
      if (window.AdminApp && window.AdminApp.dashboardPage) window.AdminApp.dashboardPage.render();
    } catch (e) {
      console.error('[admin] confirmDeleteOrder', e);
    }
  } else showToast(res.message || 'فشل الحذف', 'error');
}

async function submitManualOrder() {
  const name = getVal('om-name');
  const phone = getVal('om-phone');
  if (!name || !phone) { showToast('الاسم والهاتف مطلوبان', 'error'); return; }
  var svc = window.AdminServices && window.AdminServices.orderService;
  var storeApi = window.__adminStoreApi;
  const r = await adminCreateOrder({
    customer_name: name,
    phone: phone,
    address: getVal('om-addr'),
    notes: getVal('om-notes'),
    items_summary: '',
    total: 0
  });
  if (apiIsSuccess(r)) {
    showToast('تم إنشاء الطلب ✓');
    closeOrderModal();
    if (svc && storeApi) {
      try {
        await svc.syncToStore(storeApi);
        if (window.AdminApp && window.AdminApp.ordersPage) window.AdminApp.ordersPage.render();
        if (window.AdminApp && window.AdminApp.dashboardPage) window.AdminApp.dashboardPage.render();
      } catch (e) {
        console.error('[admin] submitManualOrder', e);
      }
    }
  } else showToast(apiErrorMessage(r) || 'فشل الإنشاء', 'error');
}

function openOrderModal2() {
  const modal = document.getElementById('orderModal');
  const title = document.getElementById('orderModalTitle');
  if (title) title.textContent = 'إنشاء طلب يدوي';
  setVal('om-name', ''); setVal('om-phone', ''); setVal('om-addr', ''); setVal('om-notes', '');
  const itemsList = document.getElementById('om-items');
  if (itemsList) itemsList.innerHTML = '';
  const saveBtn = document.getElementById('om-save');
  if (saveBtn) { saveBtn.textContent = 'إنشاء الطلب'; saveBtn.addEventListener('click', submitManualOrder); }
  if (modal) modal.style.display = 'flex';
}

/* فلاتر الطلبات: داخل ordersPage.mount */

window.renderOrdersList = function () {
  if (window.AdminApp && window.AdminApp.ordersPage) window.AdminApp.ordersPage.render();
};
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.confirmDeleteOrder = confirmDeleteOrder;
window.submitManualOrder = submitManualOrder;
window.openOrderModal2 = openOrderModal2;

/* ---------- settings-admin.js — الحقول تُملأ عبر AdminApp.settingsPage ---------- */
function renderSettingsForm() {
  if (window.AdminApp && window.AdminApp.settingsPage) window.AdminApp.settingsPage.render();
}

function resetSettingsForm() {
  renderSettingsForm();
  showToast('تم إعادة التعيين');
}

async function saveSettings() {
  const btn = document.getElementById('saveSettingsBtn');
  const state = document.getElementById('settingsSaveState');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }

  const data = {
    ..._adminState.settings,
    storeName: getVal('s-store-name'),
    phone: getVal('s-phone'),
    whatsapp: getVal('s-wa').replace(/\D/g, ''),
    address: getVal('s-addr'),
    mapUrl: getVal('s-map'),
    openHour: Number(getVal('s-open')) || 15,
    closeHour: Number(getVal('s-close')) || 24,
    offDays: Array.from(document.querySelectorAll('.offday-cb:checked')).map(cb => Number(cb.value)),
    siteEnabled: getChecked('set-site-enabled'),
  };

  const r = await adminSaveSettings(data);

  if (btn) { btn.disabled = false; btn.textContent = 'حفظ الإعدادات'; }

  if (apiIsSuccess(r)) {
    if (window.__adminStoreApi && typeof window.__adminStoreApi.mergeSettings === 'function') {
      window.__adminStoreApi.mergeSettings(data);
    } else {
      Object.assign(_adminState.settings, data);
    }
    showToast('تم حفظ الإعدادات ✓');
    if (window.AdminApp && window.AdminApp.settingsPage) window.AdminApp.settingsPage.render();
    if (state) { state.textContent = '✓ تم الحفظ'; state.style.color = '#00875a'; setTimeout(() => { if (state) state.textContent = ''; }, 3000); }
  } else {
    showToast(apiErrorMessage(r) || 'فشل الحفظ', 'error');
  }
}

async function changePass() {
  const oldPass = getVal('old-pass');
  const newPass = getVal('new-pass');
  const confirm2 = getVal('new-pass-confirm');
  if (!oldPass || !newPass) { showToast('أدخل كلمة المرور القديمة والجديدة', 'error'); return; }
  if (newPass !== confirm2) { showToast('كلمة المرور الجديدة غير متطابقة', 'error'); return; }
  if (newPass.length < 8) { showToast('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'error'); return; }
  const r = await adminChangePass(oldPass, newPass);
  if (apiIsSuccess(r)) {
    showToast('تم تغيير كلمة المرور ✓');
    setVal('old-pass', ''); setVal('new-pass', ''); setVal('new-pass-confirm', '');
  } else {
    showToast(apiErrorMessage(r) || 'فشل تغيير كلمة المرور', 'error');
  }
}

window.renderSettingsForm = renderSettingsForm;
window.resetSettingsForm = resetSettingsForm;
window.saveSettings = saveSettings;
window.changePass = changePass;

/* ---------- admin-ui.js — لوحة المعلومات: AdminApp.dashboardPage ---------- */

function renderDashboard() {
  if (window.AdminApp && window.AdminApp.dashboardPage) window.AdminApp.dashboardPage.render();
}

function renderReports() {
  const prods = adminProductsSafe();
  const orders = adminOrdersSafe();
  const activeProd = prods.filter(function (p) {
    return p.active !== false;
  }).length;
  const revenue = orders
    .filter(function (o) {
      return o.status !== 'cancelled';
    })
    .reduce(function (sum, o) {
      return (
        sum +
        (o.items || []).reduce(function (a, i) {
          return a + Number(i.price || 0) * (i.qty || 1);
        }, 0)
      );
    }, 0);
  setText('rep-prod-n', String(activeProd));
  setText('rep-orders-n', String(orders.length));
  setText('rep-rev-n', typeof fmt === 'function' ? fmt(revenue) : String(revenue));
  setText('rep-revws-n', String(adminReviewsSafe().length));
  const hint = document.getElementById('rep-rev-hint');
  if (hint) hint.textContent = 'مجموع قيم الطلبات غير الملغاة (تقريبي)';
}

window.fetchCategoriesStateThenRender = function () {
  if (window.AdminServices && window.AdminServices.categoryService && window.__adminStoreApi) {
    return window.AdminServices.categoryService.syncMainToStore(window.__adminStoreApi).then(function () {
      if (window.AdminApp && window.AdminApp.mainCategoriesPage) window.AdminApp.mainCategoriesPage.render();
    });
  }
  return Promise.resolve();
};
window.fetchSubcategoriesStateThenRender = function () {
  if (window.AdminServices && window.AdminServices.categoryService && window.__adminStoreApi) {
    return window.AdminServices.categoryService.syncSubToStore(window.__adminStoreApi);
  }
  return Promise.resolve();
};
window.fetchOrdersStateThenRender = function () {
  if (window.AdminServices && window.AdminServices.orderService && window.__adminStoreApi) {
    return window.AdminServices.orderService.syncToStore(window.__adminStoreApi).then(function () {
      if (window.AdminApp && window.AdminApp.ordersPage) window.AdminApp.ordersPage.render();
    });
  }
  return Promise.resolve();
};
window.renderDashboard = renderDashboard;
window.renderReports = renderReports;

/* ---------- admin.js ---------- */
/* admin.js — نقطة تهيئة لوحة التحكم
 * loadAndRenderAll: يحدّث _adminState ثم يعيد رسم الصفحة النشطة (أو لوحة المعلومات).
 */
async function loadAndRenderAll() {
  showLoader();
  try {
    await adminLoadAll();
    const errs = _adminState.loadErrors;
    if (errs && errs.length) {
      console.warn('[admin] Partial API load:', errs);
      if (typeof showToast === 'function') {
        showToast('تحميل جزئي: ' + errs.length + ' طلب فشل — افتح وحدة التحكم (F12) للتفاصيل', 'error');
      }
    }
    populateCategoryCheckboxes();
    if (_adminState.currentPage) showPage(_adminState.currentPage);
    else if (window.AdminApp && window.AdminApp.dashboardPage) window.AdminApp.dashboardPage.render();
  } catch (e) {
    console.error('[admin] loadAndRenderAll', e);
    if (typeof pharmaLogError === 'function') pharmaLogError('[admin]', e);
    if (typeof showToast === 'function') showToast('خطأ في تحميل البيانات', 'error');
    try {
      if (_adminState.currentPage) showPage(_adminState.currentPage);
      else if (window.AdminApp && window.AdminApp.dashboardPage) window.AdminApp.dashboardPage.render();
    } catch (renderErr) {
      console.error('[admin] render after load failure', renderErr);
    }
  } finally {
    hideLoader();
  }
}

async function logout() {
  if (typeof logoutPhp === 'function') await logoutPhp();
  location.href = 'login.php';
}

window.loadAndRenderAll = loadAndRenderAll;
window.logout = logout;

/* ---------- cp-modal-helpers.js ---------- */
(function(){
  // Modal open/close helpers (إذا لم تكن موجودة)
  window._openModal = function(id){
    var el=document.getElementById(id);
    if(el) el.classList.add('open');
  };
  window._closeModal = function(id){
    var el=document.getElementById(id);
    if(el) el.classList.remove('open');
  };

  // Close modal on overlay click
  document.querySelectorAll('.modal-ov').forEach(function(ov){
    ov.addEventListener('click', function(e){
      if(e.target === ov) ov.classList.remove('open');
    });
  });

  // Keyboard: ESC closes modal
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      document.querySelectorAll('.modal-ov.open').forEach(function(m){ m.classList.remove('open'); });
    }
  });

  // Global search -> redirect to products page
  var gs = document.getElementById('global-admin-search');
  if(gs){
    gs.addEventListener('keydown', function(e){
      if(e.key === 'Enter' && this.value.trim()){
        if(window.showPage) { window.showPage('products'); }
        setTimeout(function(){
          var ps=document.getElementById('prod-search');
          if(ps){ ps.value=gs.value; gs.value=''; ps.dispatchEvent(new Event('input')); }
        }, 200);
      }
    });
  }

  // Accordion toggle (backup) — معالج المنتج يستخدم خطوات بدل الطي
  document.querySelectorAll('[data-pf-acc] .pf-acc-head').forEach(function(head){
    head.addEventListener('click', function(){
      if (head.closest('#product-form-wizard')) return;
      var acc = head.closest('[data-pf-acc]');
      acc.classList.toggle('pf-acc-open');
    });
  });

  (function bindProductFormWizard(){
    var wiz = document.getElementById('product-form-wizard');
    if (!wiz) return;
    function curStep() {
      return parseInt(wiz.dataset.pfWizardCurrent || '1', 10) || 1;
    }
    wiz.querySelectorAll('.pf-wizard-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = parseInt(btn.getAttribute('data-pf-wizard-step'), 10);
        if (s && typeof setProductFormWizardStep === 'function') {
          setProductFormWizardStep(s, { focusFirst: true });
        }
      });
    });
    var prev = document.getElementById('pf-wizard-prev');
    var next = document.getElementById('pf-wizard-next');
    if (prev) {
      prev.addEventListener('click', function () {
        if (typeof setProductFormWizardStep === 'function') {
          setProductFormWizardStep(curStep() - 1, { focusFirst: true });
        }
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        if (typeof setProductFormWizardStep === 'function') {
          setProductFormWizardStep(curStep() + 1, { focusFirst: true });
        }
      });
    }
  })();

  // Settings tabs
  document.querySelectorAll('.settings-tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var tab = btn.dataset.tab;
      document.querySelectorAll('.settings-tab-btn').forEach(function(b){ b.classList.remove('active'); });
      document.querySelectorAll('.settings-tab-panel').forEach(function(p){ p.classList.remove('active'); });
      btn.classList.add('active');
      var panel = document.getElementById('settings-tab-'+tab);
      if(panel) panel.classList.add('active');
    });
  });
})();

/* ---------- cp-save-override.js ---------- */
// Override saveHomepageSettings to also persist hero slider data
(function(){
  var _origSave = window.saveHomepageSettings;
  window.saveHomepageSettings = function() {
    // Save hero slides via HeroSliderAdmin
    if(window.HeroSliderAdmin) {
      window.HeroSliderAdmin.save();
    }
    // Call original if exists
    if(typeof _origSave === 'function') {
      _origSave();
    }
  };
})();


function initCpStaticBindings() {

  /* ─────────────────────────────────────────────
     مساعد: ربط حدث بأمان إذا وُجد العنصر
  ───────────────────────────────────────────── */
  function on(id, event, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  }

  function onSel(selector, event, fn) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.addEventListener(event, fn);
    });
  }

  /* ═══════════════════════════════════════════
     1) شريط التنقل الجانبي — Sidebar Navigation
  ═══════════════════════════════════════════ */

  // زر قائمة الموبايل
  on('mob-menu-btn', 'click', function () {
    if (typeof toggleSidebar === 'function') toggleSidebar();
  });

  // زر الغلاف الخلفي للسايدبار
  on('sidebarBackdrop', 'click', function () {
    if (typeof closeSidebar === 'function') closeSidebar();
  });

  // أزرار مجموعات السايدبار (accordion)
  onSel('.sb-group-toggle', 'click', function () {
    var group = this.dataset.group;
    if (group && typeof toggleSidebarGroup === 'function') {
      toggleSidebarGroup(group);
    }
  });

  // أزرار الصفحات في السايدبار
  onSel('.sb-item[data-page]', 'click', function (e) {
    e.preventDefault();
    var page = this.dataset.page;
    var nav = typeof window.showPage === 'function' ? window.showPage : showPage;
    if (page && typeof nav === 'function') nav(page);
  });

  // زر تسجيل الخروج
  on('sb-logout-btn', 'click', function () {
    if (typeof logout === 'function') logout();
  });

  /* ═══════════════════════════════════════════
     2) شريط العلوي — Top Bar
  ═══════════════════════════════════════════ */

  /* ═══════════════════════════════════════════
     3) لوحة المعلومات — Dashboard Actions
  ═══════════════════════════════════════════ */

  onSel('.dash-action-btn[data-page]', 'click', function () {
    var page = this.dataset.page;
    var nav = typeof window.showPage === 'function' ? window.showPage : showPage;
    if (page && typeof nav === 'function') nav(page);
  });

  onSel('.linkish-btn[data-page]', 'click', function () {
    var page = this.dataset.page;
    var nav = typeof window.showPage === 'function' ? window.showPage : showPage;
    if (page && typeof nav === 'function') nav(page);
  });

  /* ═══════════════════════════════════════════
     4) الطلبات — Orders
  ═══════════════════════════════════════════ */

  on('btn-open-order-modal', 'click', function () {
    if (typeof openOrderModal2 === 'function') openOrderModal2();
  });

  /* ═══════════════════════════════════════════
     5) الأقسام الرئيسية — Main Categories
  ═══════════════════════════════════════════ */

  on('btn-open-maincat-modal', 'click', function () {
    if (typeof openMainCatModal === 'function') openMainCatModal();
  });

  on('btn-bulk-view-maincat-prods', 'click', function () {
    if (typeof bulkViewMainCategoryProducts === 'function') bulkViewMainCategoryProducts();
  });

  on('btn-bulk-edit-maincat', 'click', function () {
    if (typeof bulkEditMainCategory === 'function') bulkEditMainCategory();
  });

  on('btn-bulk-delete-maincats', 'click', function () {
    if (typeof bulkDeleteMainCategories === 'function') bulkDeleteMainCategories();
  });

  on('btn-clear-maincat-selection', 'click', function () {
    if (typeof clearMainCategorySelection === 'function') clearMainCategorySelection();
  });

  (function initMainCatModalUx() {
    var pick = document.getElementById('maincat-icon-picker');
    if (pick && !pick.dataset.built) {
      pick.dataset.built = '1';
      pick.innerHTML = MAINCAT_ICON_CHOICES.map(function (ico) {
        return (
          '<button type="button" class="maincat-ico-btn" data-icon="' +
          ico.replace(/"/g, '') +
          '" title="' +
          ico +
          '">' +
          ico +
          '</button>'
        );
      }).join('');
      pick.addEventListener('click', function (e) {
        var b = e.target.closest('.maincat-ico-btn');
        if (!b) return;
        var ico = b.getAttribute('data-icon');
        if (!ico) return;
        setVal('maincat-icon', ico);
        pick.querySelectorAll('.maincat-ico-btn').forEach(function (x) {
          x.classList.toggle('is-picked', x === b);
        });
      });
    }
    var nameEl = document.getElementById('maincat-name');
    var slugEl = document.getElementById('maincat-slug');
    var debSlug =
      typeof debounce === 'function'
        ? debounce(function () {
            maincatSyncSlugFromName();
          }, 160)
        : maincatSyncSlugFromName;
    if (nameEl) {
      nameEl.addEventListener('input', function () {
        debSlug();
      });
    }
    if (slugEl) {
      slugEl.addEventListener('input', function () {
        _maincatSlugManual = true;
      });
    }
    var iconInp = document.getElementById('maincat-icon');
    if (iconInp && pick) {
      iconInp.addEventListener('input', function () {
        var v = iconInp.value.trim();
        pick.querySelectorAll('.maincat-ico-btn').forEach(function (x) {
          x.classList.toggle('is-picked', x.getAttribute('data-icon') === v);
        });
      });
    }
  })();

  /* ═══════════════════════════════════════════
     6) المنتجات — Products
  ═══════════════════════════════════════════ */

  on('btn-go-add-product', 'click', function () {
    var nav = typeof window.showPage === 'function' ? window.showPage : showPage;
    if (typeof nav === 'function') nav('add');
  });

  on('btn-clear-all-products', 'click', function () {
    if (typeof clearAllProductsAdmin === 'function') clearAllProductsAdmin();
  });

  // أزرار الجملة (Bulk)
  on('btn-bulk-delete-products', 'click', function () {
    if (typeof bulkDeleteProducts === 'function') bulkDeleteProducts();
  });
  on('btn-bulk-hide-products', 'click', function () {
    if (typeof bulkHideSelectedProducts === 'function') bulkHideSelectedProducts();
  });
  on('btn-bulk-show-products', 'click', function () {
    if (typeof bulkShowSelectedProducts === 'function') bulkShowSelectedProducts();
  });
  on('btn-bulk-edit-product', 'click', function () {
    if (typeof bulkEditSelectedProduct === 'function') bulkEditSelectedProduct();
  });
  on('btn-bulk-change-price', 'click', function () {
    if (typeof bulkChangeSelectedPrice === 'function') bulkChangeSelectedPrice();
  });
  on('btn-bulk-change-cat', 'click', function () {
    if (typeof bulkChangeSelectedCategory === 'function') bulkChangeSelectedCategory();
  });
  on('btn-clear-product-selection', 'click', function () {
    if (typeof clearProductSelection === 'function') clearProductSelection();
  });

  /* ═══════════════════════════════════════════
     7) نموذج إضافة / تعديل المنتج
  ═══════════════════════════════════════════ */

  on('imgFile', 'change', function () {
    if (typeof handleImgUpload === 'function') handleImgUpload(this);
  });

  on('btn-packaging-ai-fill', 'click', function () {
    var f = typeof window !== 'undefined' ? window.__lastPackagingImageFile : null;
    if (f && typeof tryAutoFillFromPackaging === 'function') {
      tryAutoFillFromPackaging(f);
    } else {
      showToast('ارفع صورة المنتج أولاً من المربع أعلاه', 'error');
    }
  });

  on('clearImgBtn', 'click', function () {
    if (typeof clearImg === 'function') clearImg();
  });

  on('saveProductBtn', 'click', function () {
    if (typeof saveProduct === 'function') saveProduct();
  });

  on('btn-reset-product-form', 'click', function () {
    if (typeof resetForm === 'function') resetForm();
  });

  /* ═══════════════════════════════════════════
     8) التقييمات — Reviews
  ═══════════════════════════════════════════ */

  on('btn-open-review-modal', 'click', function () {
    if (typeof openReviewModal === 'function') openReviewModal(null);
  });

  /* ═══════════════════════════════════════════
     9) الصفحة الرئيسية — Homepage Settings
  ═══════════════════════════════════════════ */

  on('btn-save-homepage', 'click', function () {
    if (typeof saveHomepageSettings === 'function') saveHomepageSettings();
  });

  on('btn-add-hero-slide', 'click', function () {
    if (typeof addHeroSlide === 'function') addHeroSlide();
  });

  on('btn-add-cat-slide', 'click', function () {
    if (typeof addCatSlide === 'function') addCatSlide();
  });

  on('btn-save-homepage-2', 'click', function () {
    if (typeof saveHomepageSettings === 'function') saveHomepageSettings();
  });

  /* ═══════════════════════════════════════════
     10) الإعدادات — Settings
  ═══════════════════════════════════════════ */

  on('btn-change-password', 'click', function () {
    if (typeof changePass === 'function') changePass();
  });

  on('saveSettingsBtn', 'click', function () {
    if (typeof saveSettings === 'function') saveSettings();
  });

  on('btn-reset-settings', 'click', function () {
    if (typeof resetSettingsForm === 'function') resetSettingsForm();
  });

  on('btn-export-settings', 'click', function () {
    if (typeof exportSettings === 'function') exportSettings();
  });

  on('importSettingsFile', 'change', function () {
    if (typeof importSettings === 'function') importSettings(this);
  });

  on('btn-import-settings', 'click', function () {
    var f = document.getElementById('importSettingsFile');
    if (f) f.click();
  });

  /* ═══════════════════════════════════════════
     11) النسخ الاحتياطي — Backup
  ═══════════════════════════════════════════ */

  on('btn-download-backup', 'click', function () {
    if (typeof downloadBackup === 'function') downloadBackup();
  });

  on('restoreFile', 'change', function () {
    if (typeof restoreBackup === 'function') restoreBackup(this);
  });

  on('btn-restore-backup', 'click', function () {
    var f = document.getElementById('restoreFile');
    if (f) f.click();
  });

  on('btn-reset-products', 'click', function () {
    if (typeof resetProducts === 'function') resetProducts();
  });

  /* ═══════════════════════════════════════════
     12) المودالات — Modals close / save buttons
  ═══════════════════════════════════════════ */

  // مراجعة Modal
  on('btn-close-review-modal', 'click', function () {
    if (typeof closeReviewModal === 'function') closeReviewModal();
  });
  on('btn-save-review', 'click', function () {
    if (typeof saveReviewFromModal === 'function') saveReviewFromModal();
  });
  on('btn-cancel-review', 'click', function () {
    if (typeof closeReviewModal === 'function') closeReviewModal();
  });

  // تعديل منتج Modal
  on('btn-close-edit-modal', 'click', function () {
    if (typeof closeBulkProductEditModal === 'function') closeBulkProductEditModal();
  });
  on('btn-save-edit', 'click', function () {
    if (typeof saveBulkProductEdit === 'function') saveBulkProductEdit();
  });
  on('btn-cancel-edit', 'click', function () {
    if (typeof closeBulkProductEditModal === 'function') closeBulkProductEditModal();
  });

  // عرض سريع Modal
  on('btn-close-quick-view', 'click', function () {
    if (typeof closeProductQuickView === 'function') closeProductQuickView();
  });

  // قسم رئيسي Modal
  on('btn-close-maincat-modal', 'click', function () {
    if (typeof closeMainCatModal === 'function') closeMainCatModal();
  });
  on('btn-save-maincat', 'click', function () {
    if (typeof saveMainCategory === 'function') saveMainCategory();
  });
  on('btn-cancel-maincat', 'click', function () {
    if (typeof closeMainCatModal === 'function') closeMainCatModal();
  });

  // طلب يدوي Modal
  on('btn-close-order-modal', 'click', function () {
    if (typeof closeOrderModal === 'function') closeOrderModal();
  });
  on('om-save', 'click', function () {
    if (typeof submitManualOrder === 'function') submitManualOrder();
  });
  on('btn-cancel-order', 'click', function () {
    if (typeof closeOrderModal === 'function') closeOrderModal();
  });

}

/* ---------- admin-main (init) ---------- */
document.addEventListener('DOMContentLoaded', async function () {
  initCpStaticBindings();

  try {
    document.body.classList.remove('dark-mode');
    localStorage.removeItem('cp_theme');
  } catch (e) { /* ignore */ }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['mainCatModal','subcatModal','reviewModal','orderModal',
     'editModal','productQuickView'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.style.display !== 'none') el.style.display = 'none';
    });
  });

  document.querySelectorAll('.modal-ov, [role="dialog"]').forEach(function (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  var settingsTabs = document.getElementById('settingsTabs');
  if (settingsTabs) {
    settingsTabs.querySelectorAll('.settings-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settingsTabs.querySelectorAll('.settings-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.settings-tab-panel').forEach(function (p) { p.style.display = 'none'; });
        btn.classList.add('active');
        var panel = document.getElementById('settings-tab-' + btn.dataset.tab);
        if (panel) panel.style.display = '';
      });
    });
    var firstBtn = settingsTabs.querySelector('.settings-tab-btn');
    if (firstBtn) firstBtn.click();
  }

  await loadAndRenderAll();
});