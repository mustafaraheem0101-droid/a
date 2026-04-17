<?php
/**
 * تعيين كلمة مرور جديدة باستخدام الرمز الوارد من البريد.
 */
declare(strict_types=1);

error_reporting(0);
ini_set('display_errors', '0');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

$token = isset($_GET['t']) ? trim((string) $_GET['t']) : '';
if (strlen($token) < 64) {
    $token = '';
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>كلمة مرور جديدة — لوحة الإدارة</title>
  <link rel="icon" href="brand-logo-20260330.png?v=2" type="image/png">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css" rel="stylesheet" crossorigin="anonymous">
  <link href="assets/css/fonts-tajawal.css?v=1.0.0" rel="stylesheet">
  <style>
    html,body{min-height:100%;font-family:'Tajawal',sans-serif;background:linear-gradient(150deg,#0a1628 0%,#0f2744 55%,#0c2e20 100%);color:#fff;}
    .card-wrap{max-width:430px;margin:48px auto;padding:20px;}
    .glass{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);border-radius:22px;padding:36px 32px;backdrop-filter:blur(20px);}
    h1{font-size:20px;font-weight:900;margin-bottom:8px;}
    p.lead{font-size:13px;color:rgba(255,255,255,.55);margin-bottom:22px;}
    label{font-size:12.5px;font-weight:700;color:rgba(255,255,255,.55);}
    input[type=password]{width:100%;min-height:48px;border-radius:14px;border:1.5px solid rgba(255,255,255,.14);background:rgba(255,255,255,.09);color:#fff;padding:12px 14px;margin-top:6px;margin-bottom:12px;}
    input:focus{outline:none;border-color:rgba(0,168,110,.65);}
    .btn-go{width:100%;min-height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#00a86e,#00875a);color:#fff;font-weight:900;margin-top:8px;cursor:pointer;}
    .btn-go:disabled{opacity:.6;}
    .msg{margin-top:14px;padding:12px;border-radius:12px;font-size:13px;font-weight:700;display:none;}
    .msg.ok{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.35);color:#a7f3d0;}
    .msg.err{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.35);color:#fca5a5;}
    a.back{display:inline-block;margin-top:20px;color:rgba(255,255,255,.45);font-size:13px;text-decoration:none;}
  </style>
</head>
<body>
<div class="card-wrap">
  <div class="glass">
    <h1>كلمة مرور جديدة</h1>
    <?php if ($token === ''): ?>
      <p class="lead">الرابط غير صالح أو منتهٍ. اطلب رابطاً جديداً من صفحة «نسيت كلمة المرور».</p>
      <a href="forgot-password.php" class="back">طلب رابط جديد</a>
    <?php else: ?>
      <p class="lead">اختر كلمة مرور قوية (8 أحرف على الأقل).</p>
      <label for="p1">كلمة المرور الجديدة</label>
      <input type="password" id="p1" autocomplete="new-password" minlength="8">
      <label for="p2">تأكيد كلمة المرور</label>
      <input type="password" id="p2" autocomplete="new-password" minlength="8">
      <input type="hidden" id="reset-token" value="<?= htmlspecialchars($token, ENT_QUOTES, 'UTF-8') ?>">
      <button type="button" class="btn-go" id="btnSave">حفظ كلمة المرور</button>
      <div class="msg" id="fb" role="status"></div>
      <a href="login.php" class="back">← تسجيل الدخول</a>
    <?php endif; ?>
  </div>
</div>
<?php if ($token !== ''): ?>
<script src="assets/js/reset-password-page.js?v=1.0.0" defer></script>
<?php endif; ?>
</body>
</html>
