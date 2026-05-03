/**
 * يحمّل رابط إنستغرام من الإعدادات ويُظهر عناصر [data-ig-link] — للصفحات الخفيفة (خصوصية، نصائح) بدون ui.js.
 */
(function () {
  function normalizeInstagramUrl(raw) {
    if (raw == null) return '';
    var t = String(raw).trim();
    if (!t) return '';
    if (/^https?:\/\//i.test(t)) return t;
    t = t.replace(/^@+/, '');
    if (/instagram\.com/i.test(t)) {
      return /^https?:\/\//i.test(t) ? t : 'https://' + t.replace(/^\/+/, '');
    }
    var handle = t.replace(/^\/+|\/+$/g, '').replace(/\?.*$/, '');
    if (!handle) return '';
    if (/^[a-z0-9._]+$/i.test(handle)) return 'https://www.instagram.com/' + handle + '/';
    return 'https://www.instagram.com/' + handle + '/';
  }

  function run() {
    var api = 'api.php?action=get_settings';
    fetch(api, { credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || j.status !== 'success' || !j.data || !j.data.settings) return;
        var url = normalizeInstagramUrl(j.data.settings.instagram);
        if (!url) return;
        document.querySelectorAll('[data-ig-link]').forEach(function (el) {
          el.href = url;
          el.hidden = false;
          try {
            el.removeAttribute('aria-hidden');
          } catch (e) { /* ignore */ }
        });
      })
      .catch(function () { /* ignore */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
