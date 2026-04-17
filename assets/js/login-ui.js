/**
 * login-ui.js — واجهة صفحة تسجيل الدخول
 * إظهار/إخفاء كلمة المرور + تعطيل الزر عند الإرسال
 */
(function () {
  var toggleBtn = document.getElementById('togglePw');
  var passEl    = document.getElementById('adminPass');
  if (toggleBtn && passEl) {
    toggleBtn.addEventListener('click', function () {
      var show = passEl.type === 'password';
      passEl.type           = show ? 'text' : 'password';
      toggleBtn.textContent = show ? '\uD83D\uDE48' : '\uD83D\uDC41';
    });
  }
  var form = document.getElementById('loginForm');
  var btn  = document.getElementById('loginBtn');
  if (form && btn) {
    form.addEventListener('submit', function () {
      btn.disabled    = true;
      btn.textContent = '\u23F3 جاري الدخول...';
    });
  }
})();
