/**
 * reviewsPage.js — التقييمات
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

  function reviewsSafe(st) {
    return global.coerceApiArray ? global.coerceApiArray(st.reviews) : [].concat(st.reviews || []);
  }

  function createReviewsPage(deps) {
    var store = deps.store;
    var reviewService = deps.reviewService;
    var bound = false;
    var handlers = [];
    var rootEl = null;

    function addHandler(el, evt, fn) {
      if (!el) return;
      el.addEventListener(evt, fn);
      handlers.push({ el: el, evt: evt, fn: fn });
    }

    function render() {
      var table = document.getElementById('reviewsAdminTable');
      if (!table) return;
      var reviews = reviewsSafe(store.getState());
      if (!reviews.length) {
        setTableBodyHtml(
          table,
          '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">لا توجد تقييمات</td></tr>'
        );
        return;
      }
      setTableBodyHtml(
        table,
        reviews
          .map(function (r, i) {
            return (
              '<tr><td><strong>' +
              global.escHtml(r.name || 'مجهول') +
              '</strong></td><td>' +
              global.escHtml(r.product_id || r.product || '—') +
              '</td><td>' +
              '⭐'.repeat(Math.min(5, r.rating || 0)) +
              '</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
              global.escHtml(r.comment || '—') +
              '</td><td>' +
              global.formatDate(r.date) +
              '</td><td><span class="status-pill ' +
              (r.approved ? 'status-active' : 'status-hidden') +
              '">' +
              (r.approved ? 'معتمد' : 'بانتظار') +
              '</span></td><td><div style="display:flex;gap:6px">' +
              '<button type="button" class="btn-sm btn-primary" data-action="edit-review" data-index="' +
              i +
              '">✏️</button>' +
              '<button type="button" class="btn-sm btn-ghost" data-action="toggle-review" data-index="' +
              i +
              '">' +
              (r.approved ? 'إلغاء اعتماد' : 'اعتماد') +
              '</button>' +
              '<button type="button" class="btn-sm btn-danger" data-action="delete-review" data-index="' +
              i +
              '">🗑️</button></div></td></tr>'
            );
          })
          .join('')
      );
    }

    function withLoader(promise) {
      if (!promise || typeof promise.then !== 'function') return promise;
      if (typeof global.showLoader === 'function') global.showLoader();
      return promise.finally(function () {
        if (typeof global.hideLoader === 'function') global.hideLoader();
      });
    }

    function onRootClick(e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('[data-action]');
      if (!btn || !rootEl || !rootEl.contains(btn)) return;
      var action = btn.dataset.action;
      var idx = btn.dataset.index !== undefined ? parseInt(btn.dataset.index, 10) : NaN;
      if (isNaN(idx)) return;
      if (action === 'edit-review' && typeof global.openReviewModal === 'function') {
        e.preventDefault();
        global.openReviewModal(idx);
        return;
      }
      if (action === 'toggle-review' && typeof global.toggleReviewApproval === 'function') {
        e.preventDefault();
        var p = global.toggleReviewApproval(idx);
        withLoader(p && typeof p.then === 'function' ? p : Promise.resolve()).then(function () {
          render();
        });
        return;
      }
      if (action === 'delete-review' && typeof global.deleteReview === 'function') {
        e.preventDefault();
        var p2 = global.deleteReview(idx);
        withLoader(p2 && typeof p2.then === 'function' ? p2 : Promise.resolve()).then(function () {
          render();
        });
      }
    }

    function mount() {
      if (bound) return;
      bound = true;
      rootEl = document.getElementById('page-reviews');
      if (rootEl) addHandler(rootEl, 'click', onRootClick);
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
      if (typeof global.showLoader === 'function') global.showLoader();
      reviewService
        .syncToStore(store)
        .finally(function () {
          if (typeof global.hideLoader === 'function') global.hideLoader();
        })
        .then(function (res) {
          if (!res.ok && typeof global.showToast === 'function') {
            global.showToast('تعذر تحميل التقييمات', 'error');
          }
          render();
        });
    }

    return { mount: mount, unmount: unmount, render: render, activate: activate };
  }

  global.AdminPages = global.AdminPages || {};
  global.AdminPages.createReviewsPage = createReviewsPage;
})(typeof window !== 'undefined' ? window : global);
