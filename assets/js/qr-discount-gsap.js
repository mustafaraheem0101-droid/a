/**
 * صفحة عروض QR — بطاقات ثابتة (بدون GSAP / parallax / tilt).
 * بعد رسم الشبكة: إزالة reveal حتى لا تبقى البطاقات شفافة إلى أن يمرّر المستخدم.
 */
(function initQrDiscountStaticCards() {
  'use strict';

  var GRID_ID = 'qrProductGrid';
  var DONE_KEY = '__qrDiscountCardsPrepared';

  function getGrid() {
    return document.getElementById(GRID_ID);
  }

  function getProductCards(grid) {
    return grid.querySelectorAll('.pc.pc--product:not(.pc--skel)');
  }

  function prepareStatic(cards) {
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('reveal', 'in', 'qr-pc--motion', 'qr-pc--active');
      cards[i].style.opacity = '';
      cards[i].style.transform = '';
    }
  }

  function tryPrepare() {
    if (window[DONE_KEY]) return;
    var grid = getGrid();
    if (!grid || grid.getAttribute('aria-busy') === 'true') return;
    var cards = getProductCards(grid);
    if (!cards.length) return;
    window[DONE_KEY] = true;
    prepareStatic(cards);
  }

  var grid = getGrid();
  if (grid) {
    var obs = new MutationObserver(function () {
      tryPrepare();
    });
    obs.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-busy']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryPrepare);
  } else {
    tryPrepare();
  }
  window.addEventListener('load', tryPrepare);
})();
