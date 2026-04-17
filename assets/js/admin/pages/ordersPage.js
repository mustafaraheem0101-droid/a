/**
 * ordersPage.js — الطلبات
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

  function ordersSafe(st) {
    return global.coerceApiArray ? global.coerceApiArray(st.orders) : [].concat(st.orders || []);
  }

  function createOrdersPage(deps) {
    var store = deps.store;
    var orderService = deps.orderService;
    var bound = false;
    var handlers = [];
    var rootEl = null;

    function addHandler(el, evt, fn) {
      if (!el) return;
      el.addEventListener(evt, fn);
      handlers.push({ el: el, evt: evt, fn: fn });
    }

    function render() {
      var list = document.getElementById('ordersList');
      if (!list) return;
      var orders = ordersSafe(store.getState());

      var os = document.getElementById('order-search');
      var ofs = document.getElementById('order-filter-status');
      var ofrom = document.getElementById('order-filter-from');
      var oto = document.getElementById('order-filter-to');
      var search = (os && os.value ? os.value : '').toLowerCase();
      var statusFilter = ofs && ofs.value ? ofs.value : '';
      var from = ofrom && ofrom.value ? ofrom.value : '';
      var to = oto && oto.value ? oto.value : '';

      var filtered = orders.slice();
      if (search) {
        filtered = filtered.filter(function (o) {
          return (
            (o.name || o.customer_name || '').toLowerCase().indexOf(search) !== -1 ||
            (o.phone || '').indexOf(search) !== -1 ||
            String(o.id || '').indexOf(search) !== -1
          );
        });
      }
      if (statusFilter) {
        filtered = filtered.filter(function (o) {
          return o.status === statusFilter;
        });
      }
      if (from) {
        filtered = filtered.filter(function (o) {
          var d = o.createdAt || o.created_at;
          return d && new Date(d) >= new Date(from);
        });
      }
      if (to) {
        filtered = filtered.filter(function (o) {
          var d = o.createdAt || o.created_at;
          return d && new Date(d) <= new Date(to + 'T23:59:59');
        });
      }

      var ordersN = document.getElementById('rep-orders-n');
      if (ordersN) ordersN.textContent = String(filtered.length);

      if (!filtered.length) {
        setTableBodyHtml(
          list,
          '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">لا توجد طلبات</td></tr>'
        );
        return;
      }

      var statusMap = {
        pending: 'بانتظار',
        shipped: 'قيد الشحن',
        confirmed: 'مؤكد',
        delivered: 'مُسلَّم',
        cancelled: 'ملغي'
      };
      var statusColor = {
        pending: '#f59e0b',
        shipped: '#6366f1',
        confirmed: '#3b82f6',
        delivered: '#00875a',
        cancelled: '#ef4444'
      };

      setTableBodyHtml(
        list,
        filtered
          .map(function (o) {
            var total = (o.items || []).reduce(function (s, i) {
              return s + Number(i.price || 0) * (i.qty || 1);
            }, 0);
            var opts = Object.keys(statusMap)
              .map(function (v) {
                return (
                  '<option value="' +
                  v +
                  '" ' +
                  (o.status === v ? 'selected' : '') +
                  '>' +
                  statusMap[v] +
                  '</option>'
                );
              })
              .join('');
            return (
              '<tr><td><small style="color:#64748b">#' +
              global.escHtml(String(o.id || '').slice(-6)) +
              '</small></td><td><strong>' +
              global.escHtml(o.name || o.customer_name || '—') +
              '</strong><br><small>' +
              global.escHtml(o.phone || '') +
              '</small></td><td>' +
              global.formatDate(o.createdAt || o.created_at) +
              '</td><td>' +
              (o.items || []).length +
              ' منتج</td><td><strong>' +
              global.fmt(total) +
              '</strong></td><td><select data-action="update-order-status" data-id="' +
              global.escHtml(o.id) +
              '" style="border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:12px;color:' +
              (statusColor[o.status] || '#374151') +
              '">' +
              opts +
              '</select></td><td><div style="display:flex;gap:6px">' +
              '<button type="button" class="btn-sm btn-primary" data-action="view-order" data-id="' +
              global.escHtml(o.id) +
              '">👁️</button>' +
              '<button type="button" class="btn-sm btn-danger" data-action="delete-order" data-id="' +
              global.escHtml(o.id) +
              '">🗑️</button></div></td></tr>'
            );
          })
          .join('')
      );
    }

    function onRootClick(e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('[data-action]');
      if (!btn || !rootEl || !rootEl.contains(btn)) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (action === 'view-order' && id && typeof global.openOrderModal === 'function') {
        e.preventDefault();
        global.openOrderModal(id);
        return;
      }
      if (action === 'delete-order' && id && typeof global.confirmDeleteOrder === 'function') {
        e.preventDefault();
        global.confirmDeleteOrder(id);
      }
    }

    function onRootChange(e) {
      var t = e.target;
      if (!t || !t.dataset || t.dataset.action !== 'update-order-status') return;
      if (!rootEl || !rootEl.contains(t)) return;
      var id = t.dataset.id;
      var status = t.value;
      if (!id) return;
      if (typeof global.showLoader === 'function') global.showLoader();
      orderService
        .updateStatus(id, status)
        .then(function (res) {
          if (typeof global.hideLoader === 'function') global.hideLoader();
          if (res.ok) {
            store.patchOrder(id, { status: status });
            render();
            if (typeof global.showToast === 'function') global.showToast('تم تحديث حالة الطلب');
          } else {
            if (typeof global.showToast === 'function') global.showToast(res.message || 'فشل التحديث', 'error');
            render();
          }
        })
        .catch(function () {
          if (typeof global.hideLoader === 'function') global.hideLoader();
          render();
        });
    }

    function mount() {
      if (bound) return;
      bound = true;
      rootEl = document.getElementById('page-orders');
      if (rootEl) {
        addHandler(rootEl, 'click', onRootClick);
        addHandler(rootEl, 'change', onRootChange);
      }
      ['order-search', 'order-filter-status', 'order-filter-from', 'order-filter-to'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var run =
          typeof debounce === 'function'
            ? debounce(function () {
                render();
              }, 200)
            : function () {
                render();
              };
        addHandler(el, 'input', run);
        addHandler(el, 'change', function () {
          render();
        });
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
      if (typeof global.showLoader === 'function') global.showLoader();
      orderService
        .syncToStore(store)
        .finally(function () {
          if (typeof global.hideLoader === 'function') global.hideLoader();
        })
        .then(function (res) {
          if (!res.ok && typeof global.showToast === 'function') {
            global.showToast(res.message || 'تعذر تحديث الطلبات', 'error');
          }
          render();
        });
    }

    return { mount: mount, unmount: unmount, render: render, activate: activate };
  }

  global.AdminPages = global.AdminPages || {};
  global.AdminPages.createOrdersPage = createOrdersPage;
})(typeof window !== 'undefined' ? window : global);
