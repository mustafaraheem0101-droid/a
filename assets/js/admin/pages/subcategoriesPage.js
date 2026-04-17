/**
 * subcategoriesPage.js — الأقسام الفرعية (ربط بالقسم الرئيسي عبر parent = slug)
 */
'use strict';

(function (global) {
  function catsSafe(st) {
    return global.coerceApiArray ? global.coerceApiArray(st.categories) : [].concat(st.categories || []);
  }

  function subsSafe(st) {
    return global.coerceApiArray ? global.coerceApiArray(st.subcategories) : [].concat(st.subcategories || []);
  }

  function sortSubs(list) {
    return list.slice().sort(function (a, b) {
      var pa = String(a.parent || '');
      var pb = String(b.parent || '');
      if (pa !== pb) return pa.localeCompare(pb, 'ar');
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });
  }

  function createSubcategoriesPage(deps) {
    var store = deps.store;
    var categoryService = deps.categoryService;
    var bound = false;
    var handlers = [];
    var rootEl = null;
    var _editSubId = null;

    function addHandler(el, evt, fn) {
      if (!el) return;
      el.addEventListener(evt, fn);
      handlers.push({ el: el, evt: evt, fn: fn });
    }

    function fillParentSelect() {
      var sel = document.getElementById('subcat-parent');
      if (!sel) return;
      var st = store.getState();
      var cats = sortCatsForSelect(catsSafe(st));
      var cur = sel.value;
      sel.innerHTML =
        '<option value="">— اختر القسم الرئيسي —</option>' +
        cats
          .map(function (c) {
            var slug = global.escHtml(String(c.slug || c.id || ''));
            var nm = global.escHtml(String(c.name || slug));
            return '<option value="' + slug + '">' + nm + '</option>';
          })
          .join('');
      if (cur) sel.value = cur;
    }

    function sortCatsForSelect(list) {
      return list.slice().sort(function (a, b) {
        var oa = Number(a.order) || 0;
        var ob = Number(b.order) || 0;
        if (oa !== ob) return oa - ob;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
      });
    }

    function openSubcatModal(id) {
      var modal = document.getElementById('subcatModal');
      var title = document.getElementById('subcatModalTitle');
      if (!modal) return;
      fillParentSelect();
      _editSubId = id != null && id !== '' ? String(id) : null;
      var subs = subsSafe(store.getState());
      var s = _editSubId ? subs.find(function (x) { return String(x.id) === _editSubId; }) : null;
      if (title) title.textContent = s ? '✏️ تعديل قسم فرعي' : '➕ إضافة قسم فرعي';
      if (typeof global.setVal === 'function') {
        global.setVal('subcat-id', s && s.id != null ? String(s.id) : '');
        global.setVal('subcat-name', s && s.name ? s.name : '');
        global.setVal('subcat-icon', s && s.icon ? s.icon : '📁');
        global.setVal('subcat-parent', s && s.parent ? String(s.parent) : '');
      }
      var act = document.getElementById('subcat-active');
      if (act) act.value = s && s.active === false ? '0' : '1';
      modal.style.display = 'flex';
    }

    function closeSubcatModal() {
      var modal = document.getElementById('subcatModal');
      if (modal) modal.style.display = 'none';
      _editSubId = null;
    }

    async function saveSubcategoryFromForm() {
      var name = typeof global.getVal === 'function' ? global.getVal('subcat-name') : '';
      var parent = typeof global.getVal === 'function' ? global.getVal('subcat-parent') : '';
      var icon = typeof global.getVal === 'function' ? global.getVal('subcat-icon') : '📁';
      var actEl = document.getElementById('subcat-active');
      var active = actEl ? actEl.value !== '0' : true;
      var idRaw = typeof global.getVal === 'function' ? global.getVal('subcat-id') : '';
      if (!name || !parent) {
        if (typeof global.showToast === 'function') global.showToast('اسم القسم الفرعي والقسم الرئيسي مطلوبان', 'error');
        return;
      }
      var payload = { name: name, parent: parent, icon: icon || '📁', active: active };
      if (idRaw) payload.id = isNaN(Number(idRaw)) ? idRaw : Number(idRaw);
      var btn = document.getElementById('btn-save-subcat');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ جاري الحفظ...';
      }
      var res =
        categoryService && typeof categoryService.saveSubcategoryAdmin === 'function'
          ? await categoryService.saveSubcategoryAdmin(payload)
          : { ok: false, message: 'الخدمة غير متوفرة' };
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 حفظ';
      }
      if (res.ok) {
        if (typeof global.showToast === 'function') global.showToast('تم حفظ القسم الفرعي ✓');
        closeSubcatModal();
        if (typeof global.refreshAfterCategoryChange === 'function') {
          await global.refreshAfterCategoryChange();
        } else if (categoryService && typeof categoryService.syncSubToStore === 'function') {
          await categoryService.syncSubToStore(global.__adminStoreApi);
        }
        render();
      } else if (typeof global.showToast === 'function') {
        global.showToast(res.message || 'تعذر الحفظ', 'error');
      }
    }

    function deleteSubcat(id) {
      if (!id) return;
      var run = async function () {
        var res =
          categoryService && typeof categoryService.deleteSubcategoryAdmin === 'function'
            ? await categoryService.deleteSubcategoryAdmin(id)
            : { ok: false };
        if (res.ok) {
          if (typeof global.showToast === 'function') global.showToast('تم حذف القسم الفرعي');
          if (typeof global.refreshAfterCategoryChange === 'function') {
            await global.refreshAfterCategoryChange();
          }
          render();
        } else if (typeof global.showToast === 'function') {
          global.showToast(res.message || 'تعذر الحذف', 'error');
        }
      };
      if (typeof global.confirmDialog === 'function') {
        global.confirmDialog('حذف هذا القسم الفرعي؟ قد يؤثر على ربط المنتجات.', run);
      } else if (global.confirm && global.confirm('حذف القسم الفرعي؟')) {
        run();
      }
    }

    function parentLabel(slug, cats) {
      var c = cats.find(function (x) {
        return String(x.slug || x.id) === String(slug);
      });
      return c && c.name ? c.name + ' (' + slug + ')' : slug;
    }

    function render() {
      var list = document.getElementById('subcatList');
      if (!list) return;
      var st = store.getState();
      var cats = catsSafe(st);
      var subs = subsSafe(st);
      var fp = document.getElementById('subcat-filter-parent');
      var parentFilter = fp && fp.value ? fp.value : '';
      var ms = document.getElementById('subcat-search');
      var search = (ms && ms.value ? ms.value : '').toLowerCase().trim();

      var filtered = subs.filter(function (s) {
        if (parentFilter && String(s.parent || '') !== parentFilter) return false;
        if (search) {
          var nm = (s.name || '').toLowerCase();
          var pr = (s.parent || '').toLowerCase();
          if (nm.indexOf(search) === -1 && pr.indexOf(search) === -1) return false;
        }
        return true;
      });
      var sorted = sortSubs(filtered);

      if (!sorted.length) {
        list.innerHTML =
          '<div class="mc-empty mc-row--enter">' +
          '<span class="mc-empty-ico" aria-hidden="true">📂</span>' +
          '<p>لا توجد أقسام فرعية مطابقة. أضف قسماً أو غيّر الفلتر.</p>' +
          '</div>';
        var stats = document.getElementById('subcat-page-stats');
        if (stats) stats.textContent = subs.length ? '0 نتيجة ضمن الفلتر' : '0 أقسام فرعية';
        return;
      }

      var rows = sorted
        .map(function (s) {
          var sid = global.escHtml(String(s.id));
          var nm = global.escHtml(String(s.name || ''));
          var pl = global.escHtml(parentLabel(String(s.parent || ''), cats));
          var ic = s.icon || '📁';
          var on = s.active !== false;
          return (
            '<tr data-id="' +
            sid +
            '">' +
            '<td><span class="mc-ico">' +
            ic +
            '</span> <strong>' +
            nm +
            '</strong></td>' +
            '<td><span class="mc-slug">' +
            pl +
            '</span></td>' +
            '<td><span class="mc-status ' +
            (on ? 'mc-status--on' : 'mc-status--off') +
            '">' +
            (on ? 'نشط' : 'مخفي') +
            '</span></td>' +
            '<td><div class="mc-act-row">' +
            '<button type="button" class="mc-btn-edit" data-action="edit-subcat" data-id="' +
            sid +
            '">✏️ تعديل</button>' +
            '<button type="button" class="mc-btn-edit mc-dd-item--danger" data-action="delete-subcat" data-id="' +
            sid +
            '" style="border-color:#fecaca;color:#b91c1c">🗑️ حذف</button>' +
            '</div></td></tr>'
          );
        })
        .join('');

      list.innerHTML =
        '<div class="mc-desktop">' +
        '<table class="cp-data-table mc-table" style="width:100%;border-collapse:collapse;">' +
        '<thead><tr>' +
        '<th scope="col">القسم الفرعي</th>' +
        '<th scope="col">القسم الرئيسي</th>' +
        '<th scope="col">الحالة</th>' +
        '<th scope="col">إجراءات</th>' +
        '</tr></thead><tbody id="subcat-tbody">' +
        rows +
        '</tbody></table></div>';

      var statsEl = document.getElementById('subcat-page-stats');
      if (statsEl) {
        statsEl.textContent = subs.length + ' قسم فرعي — معروض ' + sorted.length;
      }
    }

    function syncParentFilterOptions() {
      var fp = document.getElementById('subcat-filter-parent');
      if (!fp) return;
      var cur = fp.value;
      var cats = sortCatsForSelect(catsSafe(store.getState()));
      fp.innerHTML =
        '<option value="">كل الأقسام الرئيسية</option>' +
        cats
          .map(function (c) {
            var slug = global.escHtml(String(c.slug || c.id || ''));
            var nm = global.escHtml(String(c.name || slug));
            return '<option value="' + slug + '">' + nm + '</option>';
          })
          .join('');
      if (cur) fp.value = cur;
    }

    function onRootClick(e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn || !rootEl || !rootEl.contains(btn)) return;
      var action = btn.getAttribute('data-action');
      var id = btn.getAttribute('data-id');
      if (action === 'edit-subcat') {
        e.preventDefault();
        openSubcatModal(id);
        return;
      }
      if (action === 'delete-subcat') {
        e.preventDefault();
        deleteSubcat(id);
      }
    }

    function mount() {
      if (bound) return;
      bound = true;
      rootEl = document.getElementById('page-subcategories');
      if (rootEl) addHandler(rootEl, 'click', onRootClick);
      var openBtn = document.getElementById('btn-open-subcat-modal');
      if (openBtn) {
        addHandler(openBtn, 'click', function () {
          openSubcatModal(null);
        });
      }
      var saveBtn = document.getElementById('btn-save-subcat');
      if (saveBtn) addHandler(saveBtn, 'click', saveSubcategoryFromForm);
      var closeBtn = document.getElementById('btn-close-subcat-modal');
      if (closeBtn) addHandler(closeBtn, 'click', closeSubcatModal);
      var cancelBtn = document.getElementById('btn-cancel-subcat');
      if (cancelBtn) addHandler(cancelBtn, 'click', closeSubcatModal);
      var fp = document.getElementById('subcat-filter-parent');
      if (fp) addHandler(fp, 'change', render);
      var ms = document.getElementById('subcat-search');
      if (ms) {
        addHandler(ms, 'input', function () {
          render();
        });
      }
    }

    function unmount() {
      bound = false;
      rootEl = null;
      handlers.forEach(function (h) {
        try {
          h.el.removeEventListener(h.evt, h.fn);
        } catch (err) { /* ignore */ }
      });
      handlers = [];
    }

    function activate() {
      if (!categoryService) {
        render();
        return;
      }
      if (typeof global.showLoader === 'function') global.showLoader();
      Promise.all([
        categoryService.syncMainToStore(store),
        categoryService.syncSubToStore(store)
      ])
        .finally(function () {
          if (typeof global.hideLoader === 'function') global.hideLoader();
        })
        .then(function () {
          syncParentFilterOptions();
          fillParentSelect();
          render();
        })
        .catch(function (err) {
          if (typeof console !== 'undefined' && console.error) console.error('[subcategoriesPage]', err);
          if (typeof global.showToast === 'function') global.showToast('تعذر تحميل الأقسام الفرعية', 'error');
          render();
        });
    }

    global.openSubcatModal = openSubcatModal;
    global.closeSubcatModal = closeSubcatModal;
    global.saveSubcategory = saveSubcategoryFromForm;
    global.deleteSubcat = deleteSubcat;
    global.renderSubcatList = render;

    return { mount: mount, unmount: unmount, render: render, activate: activate };
  }

  global.AdminPages = global.AdminPages || {};
  global.AdminPages.createSubcategoriesPage = createSubcategoriesPage;
})(typeof window !== 'undefined' ? window : global);
