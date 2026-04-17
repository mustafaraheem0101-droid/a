/**
 * settingsPage.js — إعدادات المتجر
 */
'use strict';

(function (global) {
  function createSettingsPage(deps) {
    var store = deps.store;
    var settingsService = deps.settingsService;

    /** بدون خيارات في select يبقى الحقل يبدو فارغاً مهما عُيِّنَت القيمة */
    function ensureHourSelectOptions() {
      ['s-open', 's-close'].forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel || sel.options.length > 0) return;
        for (var h = 0; h <= 24; h++) {
          var opt = document.createElement('option');
          opt.value = String(h);
          opt.textContent = (h < 10 ? '0' : '') + h + ':00';
          sel.appendChild(opt);
        }
      });
    }

    function render() {
      ensureHourSelectOptions();
      var s = store.getState().settings || {};
      if (typeof global.setVal === 'function') {
        global.setVal('s-store-name', s.storeName || 'صيدلية شهد محمد');
        global.setVal('s-phone', s.phone || '');
        global.setVal('s-wa', s.whatsapp || '');
        global.setVal('s-addr', s.address || '');
        global.setVal('s-map', s.mapUrl || '');
        global.setVal('s-open', s.openHour != null ? s.openHour : 15);
        global.setVal('s-close', s.closeHour != null ? s.closeHour : 24);
        // تحديد أيام العطلة
        var offDays = Array.isArray(s.offDays) ? s.offDays : [];
        document.querySelectorAll('.offday-cb').forEach(function(cb) {
          cb.checked = offDays.indexOf(Number(cb.value)) !== -1;
        });
      }
      if (typeof global.setChecked === 'function') {
        global.setChecked('set-site-enabled', s.siteEnabled !== false);
      }
    }

    function activate() {
      if (typeof global.showLoader === 'function') global.showLoader();
      settingsService
        .syncToStore(store)
        .finally(function () {
          if (typeof global.hideLoader === 'function') global.hideLoader();
        })
        .then(function (res) {
          if (!res.ok && typeof global.showToast === 'function') {
            global.showToast(res.message || 'تعذر تحميل الإعدادات', 'error');
          }
          render();
        });
    }

    function mount() {}
    function unmount() {}

    return { mount: mount, unmount: unmount, render: render, activate: activate };
  }

  global.AdminPages = global.AdminPages || {};
  global.AdminPages.createSettingsPage = createSettingsPage;
})(typeof window !== 'undefined' ? window : global);
