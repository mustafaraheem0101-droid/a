/**
 * صفحة reset-password.php — تعيين كلمة مرور جديدة (ملف خارجي لتوافق CSP).
 */
'use strict';

(function () {
  var inp = document.getElementById('reset-token');
  var btn = document.getElementById('btnSave');
  var p1 = document.getElementById('p1');
  var p2 = document.getElementById('p2');
  var fb = document.getElementById('fb');
  if (!inp || !btn || !p1 || !p2 || !fb) return;

  var tok = (inp.value || '').trim();
  if (tok.length < 64) return;

  var api = 'api.php?action=reset_password';

  function show(ok, text) {
    fb.style.display = 'block';
    fb.className = 'msg ' + (ok ? 'ok' : 'err');
    fb.textContent = text;
  }

  btn.addEventListener('click', function () {
    var a = p1.value || '';
    var b = p2.value || '';
    if (a.length < 8 || b.length < 8) {
      show(false, '8 أحرف على الأقل');
      return;
    }
    if (a !== b) {
      show(false, 'التأكيد غير متطابق');
      return;
    }
    btn.disabled = true;
    fetch(api, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tok, new_pass: a })
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        btn.disabled = false;
        if (j && j.status === 'success') {
          show(true, j.message || 'تم');
          setTimeout(function () {
            window.location.href = 'login.php?reset=ok';
          }, 1200);
        } else {
          show(false, j && j.message ? j.message : 'فشل التحديث');
        }
      })
      .catch(function () {
        btn.disabled = false;
        show(false, 'خطأ في الاتصال');
      });
  });
})();
