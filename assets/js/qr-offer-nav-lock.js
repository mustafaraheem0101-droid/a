/**
 * قفل تنقل صفحة عروض QR — يُحمّل فقط من qr-discount.html
 * يسمح بـ: نفس الصفحة، روابط واتساب، هاتف/بريد، مراسي داخلية (#)
 * الروابط المحظورة تُلغى بصمت — بدون toast
 */
(function () {
  'use strict';

  var OFFER_FILE = 'qr-discount.html';

  function isWhatsAppHost(host) {
    if (!host) return false;
    var h = String(host).toLowerCase();
    return h === 'wa.me' || h.indexOf('whatsapp.com') !== -1;
  }

  function isOfferPathname(pathname) {
    var seg = String(pathname || '').split('/').pop() || '';
    return seg.toLowerCase() === OFFER_FILE;
  }

  function allowedAnchor(a) {
    if (!a || a.tagName !== 'A') return true;
    if (a.hasAttribute('data-qr-nav-allow')) return true;

    if (a.hasAttribute('data-wa-link')) return true;

    var hrefAttr = a.getAttribute('href');
    if (hrefAttr == null) return true;

    var raw = String(hrefAttr).trim();
    if (raw === '' || raw === '#' || /^#[^\s#]+$/.test(raw)) return true;

    try {
      var u = new URL(a.href, window.location.href);
      var proto = u.protocol.toLowerCase();

      if (proto === 'tel:' || proto === 'mailto:') return true;

      if (proto === 'http:' || proto === 'https:') {
        if (isWhatsAppHost(u.hostname)) return true;
        if (u.origin === window.location.origin && isOfferPathname(u.pathname)) return true;
        return false;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  function blockIfNeeded(e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (allowedAnchor(a)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  document.addEventListener('click', blockIfNeeded, true);
  document.addEventListener('auxclick', function (e) {
    if (e.button !== 1) return;
    blockIfNeeded(e);
  }, true);
})();
