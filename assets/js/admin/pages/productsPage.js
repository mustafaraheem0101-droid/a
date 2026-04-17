/**
 * productsPage.js — صفحة المنتجات: mount / unmount / render (معزولة عن الرسم العام)
 * تدفق: API → productService → store → render
 */
'use strict';

(function (global) {
  function setTableBodyHtml(container, rowsHtml) {
    if (!container) return;
    container.innerHTML =
      '<table class="cp-data-table" style="width:100%;border-collapse:collapse;"><tbody>' +
      rowsHtml +
      '</tbody></table>';
  }

  function productsSafe(state) {
    var ca = global.coerceApiArray;
    return typeof ca === 'function' ? ca(state.products) : [].concat(state.products || []);
  }

  function resolveCpProductThumbUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    var s = raw.trim();
    if (s.indexOf('http://') === 0 || s.indexOf('https://') === 0 || s.indexOf('data:') === 0) return s;
    if (typeof global.normalizeProductImagePath === 'function') {
      s = global.normalizeProductImagePath(s);
    } else {
      s = s.replace(/(prod_\d{8})\.\.(\d+)_/gi, '$1_$2_');
    }
    if (s.indexOf('/') === 0 && typeof global.pharmaPublicAssetUrl === 'function') {
      return global.pharmaPublicAssetUrl(s);
    }
    return s;
  }

  function bindCpProductThumbFallbacks(root) {
    if (!root || !root.querySelectorAll) return;
    var imgs = root.querySelectorAll('img.cp-prod-thumb-img');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        img.addEventListener(
          'error',
          function () {
            var wrap = img.closest('.cp-prod-thumb-wrap');
            if (!wrap || !wrap.parentNode) return;
            var icon = wrap.getAttribute('data-icon') || '📦';
            var div = document.createElement('div');
            div.style.cssText =
              'width:40px;height:40px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0';
            div.textContent = icon;
            div.setAttribute('aria-hidden', 'true');
            wrap.parentNode.replaceChild(div, wrap);
          },
          { once: true }
        );
      })(imgs[i]);
    }
  }

  function createProductsPage(deps) {
    var store = deps.store;
    var productService = deps.productService;
    var bound = false;
    var handlers = [];
    var rootEl = null;

    var els = {
      list: null,
      count: null,
      bulkBar: null,
      bulkCount: null
    };

    function cacheDom() {
      rootEl = document.getElementById('page-products');
      els.list = document.getElementById('products') || document.getElementById('prodList');
      els.count = document.getElementById('prod-count');
      els.bulkBar = document.getElementById('prodBulkBar');
      els.bulkCount = document.getElementById('prodBulkCount');
    }

    function updateBulkBar() {
      var st = store.getState();
      var n = st.selectedProducts.size;
      if (els.bulkBar) els.bulkBar.style.display = n > 0 ? 'flex' : 'none';
      if (els.bulkCount) els.bulkCount.textContent = String(n);
    }

    function syncSelectAllCheckbox(items) {
      var sa = document.getElementById('prod-select-all');
      if (!sa) return;
      if (!items || !items.length) {
        sa.checked = false;
        sa.indeterminate = false;
        return;
      }
      var sel = store.getState().selectedProducts;
      var n = 0;
      for (var i = 0; i < items.length; i++) {
        if (sel.has(String(items[i].id))) n++;
      }
      sa.checked = n === items.length;
      sa.indeterminate = n > 0 && n < items.length;
    }

    function getFilteredSortedProducts(st) {
      var f = st.productListFilter || {};
      var items = productsSafe(st).slice();
      if (f.search) {
        var q = String(f.search).toLowerCase();
        items = items.filter(function (p) {
          return (p.name || '').toLowerCase().indexOf(q) !== -1 || String(p.id).indexOf(q) !== -1;
        });
      }
      if (f.cat && f.cat !== 'all') {
        var canon =
          typeof global.canonicalCategorySlug === 'function'
            ? global.canonicalCategorySlug
            : function (x) {
                return String(x || '')
                  .trim()
                  .toLowerCase();
              };
        var want = canon(f.cat);
        items = items.filter(function (p) {
          var primary = '';
          if (p.category != null && String(p.category).trim() !== '') primary = canon(p.category);
          else if (p.cat != null && String(p.cat).trim() !== '') primary = canon(p.cat);
          if (primary && primary === want) return true;
          if (Array.isArray(p.categories)) {
            for (var i = 0; i < p.categories.length; i++) {
              if (canon(p.categories[i]) === want) return true;
            }
          }
          return false;
        });
      }
      if (f.status === 'active') items = items.filter(function (p) { return p.active !== false; });
      if (f.status === 'hidden') items = items.filter(function (p) { return p.active === false; });
      if (f.stock === 'low') {
        items = items.filter(function (p) {
          return p.stock !== undefined && Number(p.stock) < 5;
        });
      }
      if (f.stock === 'out') {
        items = items.filter(function (p) {
          return p.stock !== undefined && Number(p.stock) === 0;
        });
      }
      if (f.priceMin) {
        items = items.filter(function (p) {
          return Number(p.price || 0) >= Number(f.priceMin);
        });
      }
      if (f.priceMax) {
        items = items.filter(function (p) {
          return Number(p.price || 0) <= Number(f.priceMax);
        });
      }
      function productSortTimeMs(p) {
        var t = p && (p.updatedAt || p.updated_at || p.createdAt || p.created_at);
        if (t == null || t === '') return 0;
        var n = new Date(t).getTime();
        return isNaN(n) ? 0 : n;
      }
      items.sort(function (a, b) {
        var s = f.sort;
        switch (s) {
          case 'price-asc':
          case 'price_asc':
            return Number(a.price || 0) - Number(b.price || 0);
          case 'price-desc':
          case 'price_desc':
            return Number(b.price || 0) - Number(a.price || 0);
          case 'newest':
            return productSortTimeMs(b) - productSortTimeMs(a);
          case 'name':
          case 'name_asc':
          default:
            return (a.name || '').localeCompare(b.name || '', 'ar');
        }
      });
      return items;
    }

    function showMissingListPlaceholder() {
      var page = document.getElementById('page-products');
      if (!page || document.getElementById('admin-products-container-missing')) return;
      var secBody = page.querySelector('.sec-body');
      if (!secBody) return;
      var div = document.createElement('div');
      div.id = 'admin-products-container-missing';
      div.setAttribute('role', 'alert');
      div.style.cssText =
        'padding:20px;margin:12px 0;text-align:center;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:14px;';
      div.textContent =
        'عنصر قائمة المنتجات غير موجود. أضف داخل صفحة المنتجات عنصرًا بـ id يساوي "products" أو "prodList".';
      secBody.insertBefore(div, secBody.firstChild);
    }

    function render() {
      cacheDom();
      var list = els.list;
      if (!list) {
        showMissingListPlaceholder();
        return;
      }
      var miss = document.getElementById('admin-products-container-missing');
      if (miss) miss.remove();

      var st = store.getState();
      var items = getFilteredSortedProducts(st);

      if (els.count) els.count.textContent = String(items.length);

      if (!items.length) {
        setTableBodyHtml(
          list,
          '<tr><td colspan="7" style="text-align:center;padding:32px;color:#64748b">لا توجد منتجات مطابقة</td></tr>'
        );
        syncSelectAllCheckbox([]);
        updateBulkBar();
        return;
      }

      var esc = global.escHtml;
      var fmtFn = global.fmt;
      setTableBodyHtml(
        list,
        items
          .map(function (p) {
            var active = p.active !== false;
            var stock = p.stock !== undefined ? Number(p.stock) : null;
            var lowStock = stock !== null && stock < 5;
            var imgRaw =
              p.image && typeof p.image === 'string'
                ? p.image.trim()
                : '';
            var hasRelPath =
              imgRaw &&
              (imgRaw.indexOf('http://') === 0 ||
                imgRaw.indexOf('https://') === 0 ||
                imgRaw.indexOf('/') === 0);
            var thumbSrc = hasRelPath ? resolveCpProductThumbUrl(imgRaw) : '';
            var thumbBlock =
              hasRelPath && thumbSrc
                ? '<span class="cp-prod-thumb-wrap" data-icon="' +
                  esc(p.ico || '📦') +
                  '"><img src="' +
                  esc(thumbSrc) +
                  '" class="img-cover cp-prod-thumb-img" style="width:40px;height:40px;border-radius:8px;flex-shrink:0" loading="lazy" decoding="async" alt=""></span>'
                : '<div style="width:40px;height:40px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">' +
                  (p.ico || '📦') +
                  '</div>';
            return (
              '<tr data-id="' +
              esc(p.id) +
              '" class="' +
              (active ? '' : 'row-hidden') +
              '">' +
              '<td><input type="checkbox" class="prod-chk" data-action="toggle-prod-select" data-id="' +
              esc(p.id) +
              '"' +
              (st.selectedProducts.has(String(p.id)) ? ' checked' : '') +
              '></td>' +
              '<td><div style="display:flex;align-items:center;gap:10px;">' +
              thumbBlock +
              '<div><div style="font-weight:700;font-size:13.5px">' +
              esc(p.name) +
              '</div>' +
              (p.hide_from_home
                ? '<div style="margin-top:6px"><span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;background:#e0f2fe;color:#0369a1">مخفي من «الأكثر طلباً»</span></div>'
                : '') +
              '<div style="font-size:11px;color:#64748b">#' +
              esc(p.id) +
              '</div></div></div></td>' +
              '<td>' +
              fmtFn(p.price) +
              '</td><td>' +
              (p.oldPrice
                ? '<span style="text-decoration:line-through;color:#94a3b8;font-size:12px">' +
                  fmtFn(p.oldPrice) +
                  '</span>'
                : '—') +
              '</td><td>' +
              (stock !== null
                ? '<span style="color:' +
                  (lowStock ? '#ef4444' : '#00875a') +
                  ';font-weight:700">' +
                  stock +
                  (lowStock ? ' ⚠️' : '') +
                  '</span>'
                : '—') +
              '</td><td><span class="status-pill ' +
              (active ? 'status-active' : 'status-hidden') +
              '">' +
              (active ? 'نشط' : 'مخفي') +
              '</span></td><td><div style="display:flex;gap:6px;flex-wrap:wrap">' +
              '<button type="button" class="btn-sm btn-primary" data-action="edit-product" data-id="' +
              esc(p.id) +
              '">✏️ تعديل</button>' +
              '<button type="button" class="btn-sm btn-ghost" data-action="toggle-product" data-id="' +
              esc(p.id) +
              '" data-active="' +
              (active ? '1' : '0') +
              '">' +
              (active ? 'إخفاء' : 'إظهار') +
              '</button>' +
              '<button type="button" class="btn-sm btn-danger" data-action="delete-product" data-id="' +
              esc(p.id) +
              '">🗑️</button>' +
              '</div></td></tr>'
            );
          })
          .join('')
      );

      bindCpProductThumbFallbacks(list);
      syncSelectAllCheckbox(items);
      updateBulkBar();
    }

    function withLoader(promise) {
      if (!promise || typeof promise.then !== 'function') return promise;
      if (typeof global.showLoader === 'function') global.showLoader();
      return promise.finally(function () {
        if (typeof global.hideLoader === 'function') global.hideLoader();
      });
    }

    function onDocumentKeydownSelectAll(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var key = e.key;
      if (key !== 'a' && key !== 'A') return;
      var page = document.getElementById('page-products');
      if (!page || page.offsetParent === null) return;
      var tgt = e.target;
      if (tgt) {
        var tag = tgt.tagName;
        if (tag === 'TEXTAREA') return;
        if (tag === 'INPUT' && tgt.type !== 'checkbox') return;
      }
      e.preventDefault();
      var list = getFilteredSortedProducts(store.getState());
      if (typeof store.selectAllVisibleProducts === 'function') {
        store.selectAllVisibleProducts(list);
      }
      render();
    }

    function onRootClick(e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (rootEl && rootEl.contains(t) && (e.ctrlKey || e.metaKey)) {
        if (t.closest && t.closest('a,button,textarea,select,label')) return;
        if (t.tagName === 'INPUT' || t.tagName === 'BUTTON') return;
        var tr = t.closest('tr[data-id]');
        if (tr && tr.dataset.id) {
          e.preventDefault();
          store.toggleSelectedProduct(tr.dataset.id);
          render();
          return;
        }
      }
      var btn = t.closest('[data-action]');
      if (!btn || !rootEl || !rootEl.contains(btn)) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (action === 'edit-product' && id && typeof global.openEdit === 'function') {
        e.preventDefault();
        global.openEdit(id);
        return;
      }
      if (action === 'delete-product' && id) {
        e.preventDefault();
        deleteProduct(id);
        return;
      }
      if (action === 'toggle-product' && id) {
        e.preventDefault();
        toggleProductRow(id, btn.dataset.active);
      }
    }

    function onRootChange(e) {
      var t = e.target;
      if (!t || !t.dataset || t.dataset.action !== 'toggle-prod-select') return;
      if (!rootEl || !rootEl.contains(t)) return;
      var id = t.dataset.id;
      if (!id) return;
      store.toggleSelectedProduct(id);
      render();
    }

    async function toggleProductRow(id, activeStr) {
      var nextActive = activeStr === '1' ? false : true;
      var res = await withLoader(productService.toggleProduct(id, nextActive));
      if (res.ok) {
        store.patchProduct(id, { active: nextActive });
        render();
        if (typeof global.renderDashboard === 'function') global.renderDashboard();
        if (typeof global.showToast === 'function') global.showToast(res.message || 'تم');
      } else if (typeof global.showToast === 'function') {
        global.showToast(res.message || 'خطأ', 'error');
      }
    }

    async function deleteProduct(id) {
      if (!global.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
      var res = await withLoader(productService.deleteProduct(id));
      if (res.ok) {
        store.removeProduct(id);
        render();
        if (typeof global.renderDashboard === 'function') global.renderDashboard();
        if (typeof global.showToast === 'function') global.showToast('تم الحذف');
      } else if (typeof global.showToast === 'function') {
        global.showToast(res.message || 'فشل الحذف', 'error');
      }
    }

    function addHandler(el, evt, fn) {
      if (!el) return;
      el.addEventListener(evt, fn);
      handlers.push({ el: el, evt: evt, fn: fn });
    }

    function mount() {
      if (bound) return;
      bound = true;
      cacheDom();
      rootEl = document.getElementById('page-products');
      if (rootEl) {
        addHandler(rootEl, 'click', onRootClick);
        addHandler(rootEl, 'change', onRootChange);
      }
      addHandler(document, 'keydown', onDocumentKeydownSelectAll);

      var ps = document.getElementById('prod-search');
      var debouncedSearch =
        typeof debounce === 'function'
          ? debounce(function () {
              var el = document.getElementById('prod-search');
              if (el) store.patchProductListFilter({ search: el.value.trim() });
              render();
            }, 250)
          : function () {
              var el = document.getElementById('prod-search');
              if (el) store.patchProductListFilter({ search: el.value.trim() });
              render();
            };
      addHandler(ps, 'input', debouncedSearch);

      ['filter-cat', 'filter-status', 'filter-stock', 'sort-products'].forEach(function (id) {
        var el = document.getElementById(id);
        addHandler(el, 'change', function () {
          if (!el) return;
          var patch = {};
          if (id === 'filter-cat') patch.cat = el.value;
          else if (id === 'filter-status') patch.status = el.value;
          else if (id === 'filter-stock') patch.stock = el.value;
          else if (id === 'sort-products') patch.sort = el.value;
          store.patchProductListFilter(patch);
          render();
        });
      });

      ['filter-price-min', 'filter-price-max'].forEach(function (id) {
        var el = document.getElementById(id);
        addHandler(el, 'change', function () {
          if (!el) return;
          var patch = {};
          if (id === 'filter-price-min') patch.priceMin = el.value;
          else patch.priceMax = el.value;
          store.patchProductListFilter(patch);
          render();
        });
      });

      var sa = document.getElementById('prod-select-all');
      addHandler(sa, 'change', function () {
        if (!sa) return;
        var list = productsSafe(store.getState());
        if (sa.checked) {
          if (typeof store.selectAllVisibleProducts === 'function') {
            store.selectAllVisibleProducts(list);
          }
        } else if (typeof store.clearSelectedProducts === 'function') {
          store.clearSelectedProducts();
        }
        render();
      });
    }

    function unmount() {
      bound = false;
      rootEl = null;
      handlers.forEach(function (h) {
        try {
          h.el.removeEventListener(h.evt, h.fn);
        } catch (e) { /* ignore */ }
      });
      handlers = [];
    }

    function activate() {
      if (!productService || typeof productService.syncToStore !== 'function') {
        render();
        return;
      }
      withLoader(productService.syncToStore(store))
        .then(function (res) {
          if (!res.ok && typeof global.showToast === 'function') {
            global.showToast(res.message || 'تعذر تحديث المنتجات', 'error');
          }
          try {
            render();
          } catch (re) {
            if (typeof console !== 'undefined' && console.error) console.error('[productsPage] render', re);
          }
        })
        .catch(function (e) {
          if (typeof global.showToast === 'function') {
            global.showToast(e && e.message ? e.message : 'خطأ غير متوقع أثناء تحميل المنتجات', 'error');
          }
          try {
            render();
          } catch (re) { /* ignore */ }
        });
    }

    return {
      mount: mount,
      unmount: unmount,
      activate: activate,
      render: render,
      deleteProduct: deleteProduct
    };
  }

  global.AdminPages = global.AdminPages || {};
  global.AdminPages.createProductsPage = createProductsPage;
})(typeof window !== 'undefined' ? window : global);
