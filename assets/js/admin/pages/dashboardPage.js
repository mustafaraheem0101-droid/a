/**
 * dashboardPage.js — لوحة المعلومات
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

  function safe(arr) {
    return global.coerceApiArray ? global.coerceApiArray(arr) : [].concat(arr || []);
  }

  function createDashboardPage(deps) {
    var store = deps.store;

    function render() {
      var st = store.getState();
      var prods = safe(st.products);
      var orders = safe(st.orders);
      var cats = safe(st.categories);
      var activeProd = prods.filter(function (p) { return p.active !== false; }).length;
      var hiddenProd = prods.filter(function (p) { return p.active === false; }).length;
      var lowStock = prods.filter(function (p) {
        return p.stock !== undefined && Number(p.stock) < 5;
      }).length;
      var revenue = orders
        .filter(function (o) { return o.status === 'delivered'; })
        .reduce(function (s, o) {
          return (
            s +
            (o.items || []).reduce(function (a, i) {
              return a + Number(i.price || 0) * (i.qty || 1);
            }, 0)
          );
        }, 0);

      global.setText('st-total', prods.length);
      global.setText('st-active', activeProd);
      global.setText('st-hidden-products', hiddenProd);
      global.setText('st-low-stock', lowStock);
      global.setText('st-orders', orders.length);
      global.setText('st-revenue', global.fmt(revenue));
      global.setText('st-maincats', cats.length);

      var alert = document.getElementById('prodLowStockAlert');
      if (alert) alert.style.display = lowStock > 0 ? 'flex' : 'none';

      var lowList = document.getElementById('low-stock-list');
      if (lowList) {
        var lowProds = prods
          .filter(function (p) {
            return p.stock !== undefined && Number(p.stock) < 5;
          })
          .slice(0, 5);
        lowList.innerHTML = lowProds
          .map(function (p) {
            return (
              '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9">' +
              '<span style="font-weight:600">' +
              global.escHtml(p.name) +
              '</span>' +
              '<span style="color:' +
              (Number(p.stock) === 0 ? '#ef4444' : '#f59e0b') +
              ';font-weight:800">' +
              p.stock +
              ' متبقي</span></div>'
            );
          })
          .join('');
      }

      var recentOrders = document.getElementById('dash-recent-orders');
      if (recentOrders) {
        var recent = orders.slice().sort(function (a, b) {
          var tb = new Date(b.createdAt || b.created_at || 0).getTime();
          var ta = new Date(a.createdAt || a.created_at || 0).getTime();
          return tb - ta;
        }).slice(0, 5);
        if (!recent.length) {
          setTableBodyHtml(
            recentOrders,
            '<tr><td colspan="4" style="text-align:center;padding:16px;color:#64748b">لا توجد طلبات</td></tr>'
          );
        } else {
          setTableBodyHtml(
            recentOrders,
            recent
              .map(function (o) {
                var total = (o.items || []).reduce(function (s, i) {
                  return s + Number(i.price || 0) * (i.qty || 1);
                }, 0);
                var sm = {
                  pending: 'بانتظار',
                  shipped: 'قيد الشحن',
                  confirmed: 'مؤكد',
                  delivered: 'مُسلَّم',
                  cancelled: 'ملغي'
                };
                return (
                  '<tr><td><small>#' +
                  String(o.id || '').slice(-6) +
                  '</small></td><td>' +
                  global.escHtml(o.name || o.customer_name || '—') +
                  '</td><td>' +
                  global.fmt(total) +
                  '</td><td><span class="status-pill ' +
                  (o.status === 'delivered'
                    ? 'status-active'
                    : o.status === 'cancelled'
                      ? 'status-hidden'
                      : 'status-pending') +
                  '">' +
                  (sm[o.status] || o.status) +
                  '</span></td></tr>'
                );
              })
              .join('')
          );
        }
      }

      var topProds = document.getElementById('top-products');
      if (topProds) {
        var counted = {};
        orders.forEach(function (o) {
          (o.items || []).forEach(function (i) {
            counted[i.name] = (counted[i.name] || 0) + (i.qty || 1);
          });
        });
        var sorted = Object.entries(counted)
          .sort(function (a, b) {
            return b[1] - a[1];
          })
          .slice(0, 5);
        topProds.innerHTML = sorted.length
          ? sorted
              .map(function (entry) {
                return (
                  '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">' +
                  '<span>' +
                  global.escHtml(entry[0]) +
                  '</span><strong>' +
                  entry[1] +
                  ' طلب</strong></div>'
                );
              })
              .join('')
          : '<p style="color:#64748b;text-align:center;padding:16px">لا بيانات</p>';
      }

      if (global.adminFetch) {
        global.adminFetch('stats', { days: 7 }, 'GET').then(function (res) {
          if (!global.apiIsSuccess(res) || !res.data) return;
          if (global.setText) {
            global.setText('st-wa-clicks', String(res.data.whatsapp_clicks != null ? res.data.whatsapp_clicks : '0'));
            global.setText('st-wa-order-intents', String(res.data.whatsapp_orders != null ? res.data.whatsapp_orders : '0'));
          }
          var topApi = res.data.top_ordered_products || [];
          var topEl = document.getElementById('top-products');
          if (topEl && topApi.length) {
            topEl.innerHTML = topApi
              .map(function (t) {
                return (
                  '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">' +
                  '<span>' +
                  global.escHtml(t.name) +
                  '</span><strong>' +
                  t.count +
                  '</strong></div>'
                );
              })
              .join('');
          } else if (topEl) {
            topEl.innerHTML = '<p style="color:#64748b;text-align:center;padding:16px">لا بيانات نوايا طلب</p>';
          }
          var topWaEl = document.getElementById('top-wa-click-products');
          var topWa = res.data.top_whatsapp_click_products || [];
          if (topWaEl) {
            topWaEl.innerHTML = topWa.length
              ? topWa
                  .map(function (t) {
                    return (
                      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">' +
                      '<span title="' +
                      global.escHtml(t.id || '') +
                      '">' +
                      global.escHtml(t.name) +
                      '</span><strong>' +
                      t.count +
                      ' نقرة</strong></div>'
                    );
                  })
                  .join('')
              : '<p style="color:#64748b;text-align:center;padding:16px">لا نقرات في هذه الفترة</p>';
          }
        }).catch(function () {});
      }
    }

    function activate() {
      render();
    }

    function mount() {}
    function unmount() {}

    return { mount: mount, unmount: unmount, render: render, activate: activate };
  }

  global.AdminPages = global.AdminPages || {};
  global.AdminPages.createDashboardPage = createDashboardPage;
})(typeof window !== 'undefined' ? window : global);
