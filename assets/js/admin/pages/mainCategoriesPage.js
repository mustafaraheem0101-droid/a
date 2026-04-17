/**
 * mainCategoriesPage.js — الأقسام الرئيسية (جدول + كروت موبايل، قائمة إجراءات، سحب للترتيب)
 */
'use strict';

(function (global) {
  function catsSafe(st) {
    return global.coerceApiArray ? global.coerceApiArray(st.categories) : [].concat(st.categories || []);
  }

  function closeAllMcMenus() {
    var root = document.getElementById('page-maincategories');
    if (!root) return;
    root.querySelectorAll('.mc-dd-wrap.is-open').forEach(function (w) {
      w.classList.remove('is-open');
    });
    root.querySelectorAll('.mc-dd-host-open').forEach(function (el) {
      el.classList.remove('mc-dd-host-open');
    });
  }

  function createMainCategoriesPage(deps) {
    var store = deps.store;
    var categoryService = deps.categoryService;
    var bound = false;
    var handlers = [];
    var rootEl = null;
    var dragId = null;
    var docClickBound = false;

    function addHandler(el, evt, fn) {
      if (!el) return;
      el.addEventListener(evt, fn);
      handlers.push({ el: el, evt: evt, fn: fn });
    }

    function sortCats(list) {
      return list.slice().sort(function (a, b) {
        var oa = Number(a.order) || 0;
        var ob = Number(b.order) || 0;
        if (oa !== ob) return oa - ob;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
      });
    }

    /** إيموجي افتراضي حسب slug إذا كان حقل icon فارغاً في قاعدة البيانات */
    var MAINCAT_ICON_BY_SLUG = {
      medicine: '💊',
      vitamin: '🧬',
      beauty: '💄',
      skincare: '🧴',
      haircare: '💇',
      baby: '👶',
      medical: '🩺',
      weight_management: '⚖️',
      oral_care: '🦷',
      hygiene: '🧼',
      first_aid: '🩹',
      women_health: '🌸',
      senior_care: '👴',
      cosmetics: '💄',
      vitamins: '🧬',
      kids: '👶',
      oralcare: '🦷',
      /* روابط مختصرة عربية (إن وُجدت في قاعدة البيانات) */
      'العناية-بالشعر': '💇',
      'العناية-بالفم-والأسنان': '🦷',
      'العناية-بالبشرة': '🧴',
      'الأدوية': '💊',
      'الفيتامينات-والمكملات': '🧬',
      'التجميل-والعطور': '💄',
      'مستلزمات-الأطفال': '👶',
      'أجهزة-طبية-ومستلزمات': '🩺'
    };

    function mainCatDisplayIcon(c) {
      var raw = c && c.icon != null ? String(c.icon).trim() : '';
      if (raw) return raw;
      var slug = c && c.slug ? String(c.slug).trim() : '';
      if (slug && MAINCAT_ICON_BY_SLUG[slug]) return MAINCAT_ICON_BY_SLUG[slug];
      return '📦';
    }

    function renderTableRows(sorted, st) {
      return sorted
        .map(function (c) {
          var slug = c.slug || '';
          var sid = global.escHtml(String(c.id));
          var slugEsc = global.escHtml(slug);
          var checked = st.selectedMainCats.has(String(c.id)) ? ' checked' : '';
          return (
            '<tr class="mc-row mc-row--enter" data-id="' +
            sid +
            '" draggable="true">' +
            '<td class="mc-td-chk"><input type="checkbox" class="maincat-chk" data-action="toggle-maincat-select" data-id="' +
            sid +
            '"' +
            checked +
            '></td>' +
            '<td class="mc-td-drag"><span class="mc-drag-hint" title="اسحب لإعادة الترتيب" aria-hidden="true">⠿</span></td>' +
            '<td class="mc-td-main"><span class="mc-ico">' +
            mainCatDisplayIcon(c) +
            '</span><div class="mc-name-block"><strong class="mc-name">' +
            global.escHtml(c.name || '') +
            '</strong><span class="mc-slug" title="الرابط المختصر">' +
            slugEsc +
            '</span></div></td>' +
            '<td class="mc-td-st"><span class="mc-status ' +
            (c.active !== false ? 'mc-status--on' : 'mc-status--off') +
            '">' +
            (c.active !== false ? 'نشط' : 'مخفي') +
            '</span></td>' +
            '<td class="mc-td-act">' +
            '<div class="mc-act-row">' +
            '<button type="button" class="mc-btn-edit" data-action="edit-maincat" data-id="' +
            sid +
            '">✏️ تعديل</button>' +
            '<div class="mc-dd-wrap">' +
            '<button type="button" class="mc-dd-toggle" aria-expanded="false" aria-haspopup="true" title="المزيد">⋮</button>' +
            '<div class="mc-dd-menu" role="menu">' +
            '<button type="button" role="menuitem" class="mc-dd-item" data-action="view-maincat-prods" data-id="' +
            global.escHtml(c.slug || c.id) +
            '">📦 عرض المنتجات</button>' +
            '<button type="button" role="menuitem" class="mc-dd-item mc-dd-item--danger" data-action="delete-maincat" data-id="' +
            sid +
            '">🗑️ حذف</button>' +
            '</div></div></div></td></tr>'
          );
        })
        .join('');
    }

    function renderCards(sorted, st) {
      return sorted
        .map(function (c) {
          var sid = global.escHtml(String(c.id));
          var slugEsc = global.escHtml(c.slug || '');
          var checked = st.selectedMainCats.has(String(c.id)) ? ' checked' : '';
          return (
            '<article class="mc-card mc-row--enter" data-id="' +
            sid +
            '" draggable="true">' +
            '<div class="mc-card-top">' +
            '<label class="mc-card-chk"><input type="checkbox" class="maincat-chk" data-action="toggle-maincat-select" data-id="' +
            sid +
            '"' +
            checked +
            '></label>' +
            '<span class="mc-drag-hint" title="اسحب للترتيب">⠿</span>' +
            '</div>' +
            '<div class="mc-card-body">' +
            '<span class="mc-ico mc-ico--lg">' +
            mainCatDisplayIcon(c) +
            '</span>' +
            '<div class="mc-name-block">' +
            '<strong class="mc-name">' +
            global.escHtml(c.name || '') +
            '</strong>' +
            '<span class="mc-slug">' +
            slugEsc +
            '</span>' +
            '</div>' +
            '<span class="mc-status ' +
            (c.active !== false ? 'mc-status--on' : 'mc-status--off') +
            '">' +
            (c.active !== false ? 'نشط' : 'مخفي') +
            '</span>' +
            '</div>' +
            '<div class="mc-card-actions">' +
            '<button type="button" class="mc-btn-edit mc-btn-edit--block" data-action="edit-maincat" data-id="' +
            sid +
            '">✏️ تعديل</button>' +
            '<div class="mc-dd-wrap mc-dd-wrap--block">' +
            '<button type="button" class="mc-dd-toggle mc-dd-toggle--block" aria-expanded="false">المزيد من الإجراءات ▾</button>' +
            '<div class="mc-dd-menu" role="menu">' +
            '<button type="button" class="mc-dd-item" data-action="view-maincat-prods" data-id="' +
            global.escHtml(c.slug || c.id) +
            '">📦 عرض المنتجات</button>' +
            '<button type="button" class="mc-dd-item mc-dd-item--danger" data-action="delete-maincat" data-id="' +
            sid +
            '">🗑️ حذف القسم</button>' +
            '</div></div></div></article>'
          );
        })
        .join('');
    }

    function render() {
      var list = document.getElementById('mainCatList');
      if (!list) return;
      var st = store.getState();
      var cats = catsSafe(st);
      var ms = document.getElementById('maincat-search');
      var search = (ms && ms.value ? ms.value : '').toLowerCase().trim();
      var fs = document.getElementById('maincat-filter-status');
      var fstat = fs && fs.value ? fs.value : 'all';

      var filtered = cats.filter(function (c) {
        if (search && (c.name || '').toLowerCase().indexOf(search) === -1 && (c.slug || '').toLowerCase().indexOf(search) === -1) {
          return false;
        }
        if (fstat === 'active' && c.active === false) return false;
        if (fstat === 'hidden' && c.active !== false) return false;
        return true;
      });

      var sorted = sortCats(filtered);

      if (!sorted.length) {
        list.innerHTML =
          '<div class="mc-empty mc-row--enter">' +
          '<span class="mc-empty-ico" aria-hidden="true">📭</span>' +
          '<p>لا توجد أقسام مطابقة للبحث أو الفلتر.</p>' +
          '</div>';
        var statsEl0 = document.getElementById('maincat-page-stats');
        if (statsEl0) statsEl0.textContent = cats.length ? '0 نتيجة ضمن الفلتر الحالي' : '0 أقسام';
        var bar = document.getElementById('maincatBulkBar');
        var cnt = document.getElementById('maincatBulkCount');
        var n = st.selectedMainCats.size;
        if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
        if (cnt) cnt.textContent = String(n);
        return;
      }

      list.innerHTML =
        '<div class="mc-desktop">' +
        '<table class="cp-data-table mc-table" style="width:100%;border-collapse:collapse;">' +
        '<thead><tr>' +
        '<th class="mc-th-chk" scope="col"><span class="sr-only">تحديد</span></th>' +
        '<th class="mc-th-drag" scope="col"><span class="sr-only">ترتيب</span></th>' +
        '<th scope="col">القسم</th>' +
        '<th scope="col">الحالة</th>' +
        '<th scope="col">إجراءات</th>' +
        '</tr></thead><tbody id="maincat-tbody">' +
        renderTableRows(sorted, st) +
        '</tbody></table></div>' +
        '<div class="mc-mobile">' +
        renderCards(sorted, st) +
        '</div>';

      var statsEl = document.getElementById('maincat-page-stats');
      if (statsEl) {
        var active = cats.filter(function (c) {
          return c.active !== false;
        }).length;
        var extra = filtered.length < cats.length ? ' · معروض ' + filtered.length + ' ضمن الفلتر' : '';
        statsEl.textContent = cats.length + ' قسم (' + active + ' نشط)' + extra;
      }

      var bar = document.getElementById('maincatBulkBar');
      var cnt = document.getElementById('maincatBulkCount');
      var n = st.selectedMainCats.size;
      if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
      if (cnt) cnt.textContent = String(n);

      bindDragHandlers();
    }

    function bindDragHandlers() {
      var tb = document.getElementById('maincat-tbody');
      var mobile = document.querySelector('#mainCatList .mc-mobile');
      if (tb) {
        tb.querySelectorAll('tr[data-id]').forEach(function (row) {
          row.addEventListener('dragstart', onDragStart);
          row.addEventListener('dragover', onDragOver);
          row.addEventListener('drop', onDrop);
          row.addEventListener('dragend', onDragEnd);
        });
      }
      if (mobile) {
        mobile.querySelectorAll('.mc-card[data-id]').forEach(function (card) {
          card.addEventListener('dragstart', onDragStart);
          card.addEventListener('dragover', onDragOver);
          card.addEventListener('drop', onDrop);
          card.addEventListener('dragend', onDragEnd);
        });
      }
    }

    function rowId(el) {
      var row = el.closest('[data-id]');
      return row ? row.getAttribute('data-id') : null;
    }

    function onDragStart(e) {
      dragId = rowId(e.currentTarget);
      if (dragId) {
        try {
          e.dataTransfer.setData('text/plain', dragId);
          e.dataTransfer.effectAllowed = 'move';
        } catch (err) { /* ignore */ }
      }
      e.currentTarget.classList.add('mc-dragging');
    }

    function onDragOver(e) {
      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = 'move';
      } catch (err) { /* ignore */ }
    }

    function onDrop(e) {
      e.preventDefault();
      var targetId = rowId(e.currentTarget);
      var src = dragId;
      if (!src || !targetId || src === targetId) return;
      var tbody = document.getElementById('maincat-tbody');
      var mobile = document.querySelector('#mainCatList .mc-mobile');
      var orderedIds = [];
      if (tbody) {
        tbody.querySelectorAll('tr[data-id]').forEach(function (r) {
          orderedIds.push(r.getAttribute('data-id'));
        });
        var from = orderedIds.indexOf(src);
        var to = orderedIds.indexOf(targetId);
        if (from < 0 || to < 0) return;
        orderedIds.splice(from, 1);
        orderedIds.splice(to, 0, src);
      } else if (mobile) {
        mobile.querySelectorAll('.mc-card[data-id]').forEach(function (r) {
          orderedIds.push(r.getAttribute('data-id'));
        });
        var fromM = orderedIds.indexOf(src);
        var toM = orderedIds.indexOf(targetId);
        if (fromM < 0 || toM < 0) return;
        orderedIds.splice(fromM, 1);
        orderedIds.splice(toM, 0, src);
      } else return;

      if (typeof global.persistMainCategoryOrder === 'function') {
        global.persistMainCategoryOrder(orderedIds);
      }
    }

    function onDragEnd(e) {
      e.currentTarget.classList.remove('mc-dragging');
      dragId = null;
    }

    function onRootClick(e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var toggle = t.closest('.mc-dd-toggle');
      if (toggle && rootEl && rootEl.contains(toggle)) {
        e.preventDefault();
        e.stopPropagation();
        var wrap = toggle.closest('.mc-dd-wrap');
        var open = wrap && wrap.classList.contains('is-open');
        closeAllMcMenus();
        if (wrap && !open) {
          wrap.classList.add('is-open');
          toggle.setAttribute('aria-expanded', 'true');
          var host = wrap.closest('tr.mc-row') || wrap.closest('.mc-card');
          if (host) host.classList.add('mc-dd-host-open');
        } else if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
        }
        return;
      }

      var btn = t.closest('[data-action]');
      if (!btn || !rootEl || !rootEl.contains(btn)) return;
      if (btn.classList.contains('mc-dd-toggle')) return;

      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (action === 'edit-maincat' && id && typeof global.openMainCatModal === 'function') {
        e.preventDefault();
        e.stopPropagation();
        closeAllMcMenus();
        global.openMainCatModal(id);
        return;
      }
      if (action === 'view-maincat-prods' && id && typeof global.bulkViewMainCategoryProducts === 'function') {
        e.preventDefault();
        e.stopPropagation();
        closeAllMcMenus();
        global.bulkViewMainCategoryProducts(id);
        return;
      }
      if (action === 'delete-maincat' && id && typeof global.deleteMainCat === 'function') {
        e.preventDefault();
        e.stopPropagation();
        closeAllMcMenus();
        global.deleteMainCat(id);
      }
    }

    function onRootChange(e) {
      var t = e.target;
      if (!t || !t.dataset || t.dataset.action !== 'toggle-maincat-select') return;
      if (!rootEl || !rootEl.contains(t)) return;
      var id = t.dataset.id;
      if (!id) return;
      store.toggleMainCatSelection(id);
      render();
    }

    function onDocClick(e) {
      if (!rootEl || !rootEl.contains(e.target)) return;
      if (e.target.closest('.mc-dd-wrap')) return;
      closeAllMcMenus();
    }

    function mount() {
      if (bound) return;
      bound = true;
      rootEl = document.getElementById('page-maincategories');
      if (rootEl) {
        addHandler(rootEl, 'click', onRootClick);
        addHandler(rootEl, 'change', onRootChange);
      }
      if (!docClickBound) {
        docClickBound = true;
        document.addEventListener('click', onDocClick);
      }
      var ms = document.getElementById('maincat-search');
      if (ms) {
        var fn = function () {
          render();
        };
        addHandler(ms, 'input', typeof debounce === 'function' ? debounce(fn, 200) : fn);
      }
      var fs = document.getElementById('maincat-filter-status');
      if (fs) {
        addHandler(fs, 'change', function () {
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
        } catch (e) { /* ignore */ }
      });
      handlers = [];
    }

    function activate() {
      if (!categoryService || typeof categoryService.syncMainToStore !== 'function') {
        render();
        return;
      }
      if (typeof global.showLoader === 'function') global.showLoader();
      categoryService
        .syncMainToStore(store)
        .finally(function () {
          if (typeof global.hideLoader === 'function') global.hideLoader();
        })
        .then(function (res) {
          if (res && !res.ok && typeof global.showToast === 'function') {
            global.showToast(res.message || 'تعذر تحديث الأقسام', 'error');
          }
          render();
        })
        .catch(function (err) {
          if (typeof console !== 'undefined' && console.error) console.error('[mainCategoriesPage]', err);
          if (typeof global.showToast === 'function') {
            global.showToast('تعذر تحميل الأقسام', 'error');
          }
          render();
        });
    }

    return { mount: mount, unmount: unmount, render: render, activate: activate };
  }

  global.AdminPages = global.AdminPages || {};
  global.AdminPages.createMainCategoriesPage = createMainCategoriesPage;
})(typeof window !== 'undefined' ? window : global);
