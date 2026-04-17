/**
 * صفحة forgot-password.php — طلب رابط الاستعادة (ملف خارجي لتوافق CSP).
 */
'use strict';

(function () {
  var api = 'api.php?action=forgot_password';
  var btn = document.getElementById('btnSend');
  var em = document.getElementById('em');
  var fb = document.getElementById('fb');
  if (!btn || !em || !fb) return;

  function show(ok, text) {
    fb.style.display = 'block';
    fb.className = 'msg ' + (ok ? 'ok' : 'err');
    fb.textContent = text;
  }

  btn.addEventListener('click', function () {
    var v = (em.value || '').trim();
    if (!v) {
      show(false, 'أدخل البريد الإلكتروني');
      return;
    }
    btn.disabled = true;
    fetch(api, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: v })
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        btn.disabled = false;
        if (j && j.status === 'success') {
          show(true, j.message || 'تم');
        } else {
          show(false, j && j.message ? j.message : 'تعذر إكمال الطلب');
        }
      })
      .catch(function () {
        btn.disabled = false;
        show(false, 'خطأ في الاتصال');
      });
  });
})();
