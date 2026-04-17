/**
 * مزامنة شريط تقدّم معالج إضافة المنتج مع data-pf-wizard-current (لوحة التحكم).
 * يُحمّل كملف خارجي لتفادي انتهاك CSP (لا سكربت مضمّن في HTML).
 */
(function () {
  function syncProgressBar(step) {
    var steps = document.querySelectorAll('.pf-progress-step');
    steps.forEach(function (btn, idx) {
      btn.classList.remove('is-active', 'is-done');
      var s = idx + 1;
      if (s < step) btn.classList.add('is-done');
      else if (s === step) btn.classList.add('is-active');
    });
  }

  var wizard = document.getElementById('product-form-wizard');
  if (!wizard) return;

  var obs = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'data-pf-wizard-current') {
        syncProgressBar(parseInt(wizard.getAttribute('data-pf-wizard-current') || '1', 10));
      }
    });
  });
  obs.observe(wizard, { attributes: true });

  document.querySelectorAll('.pf-progress-step').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var step = parseInt(this.dataset.pfWizardStep, 10);
      var tabBtn = document.querySelector('[data-pf-wizard-step="' + step + '"].pf-wizard-tab');
      if (tabBtn) tabBtn.click();
    });
  });
})();
