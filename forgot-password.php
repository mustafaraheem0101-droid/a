<?php
/**
 * طلب رابط إعادة تعيين كلمة مرور الإدارة (يُرسل إلى ADMIN_EMAIL عبر SMTP).
 */
declare(strict_types=1);

error_reporting(0);
ini_set('display_errors', '0');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نسيت كلمة المرور — لوحة الإدارة</title>
  <link rel="icon" href="brand-logo-20260330.png?v=2" type="image/png">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css" rel="stylesheet" crossorigin="anonymous">
  <link href="assets/css/fonts-tajawal.css?v=1.0.0" rel="stylesheet">
  <style>
    :root{--g:#00875A;--navy:#0A1628;}
    html,body{min-height:100%;font-family:'Tajawal',sans-serif;background:linear-gradient(150deg,#0a1628 0%,#0f2744 55%,#0c2e20 100%);color:#fff;}
    .card-wrap{max-width:430px;margin:48px auto;padding:20px;}
    .glass{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);border-radius:22px;padding:36px 32px;backdrop-filter:blur(20px);}
    h1{font-size:20px;font-weight:900;margin-bottom:8px;}
    p.lead{font-size:13px;color:rgba(255,255,255,.55);margin-bottom:22px;}
    label{font-size:12.5px;font-weight:700;color:rgba(255,255,255,.55);}
    input[type=email]{width:100%;min-height:48px;border-radius:14px;border:1.5px solid rgba(255,255,255,.14);background:rgba(255,255,255,.09);color:#fff;padding:12px 14px;margin-top:6px;}
    input:focus{outline:none;border-color:rgba(0,168,110,.65);box-shadow:0 0 0 3px rgba(0,168,110,.15);}
    .btn-go{width:100%;min-height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#00a86e,#00875a);color:#fff;font-weight:900;margin-top:18px;cursor:pointer;}
    .btn-go:disabled{opacity:.6;cursor:not-allowed;}
    .msg{margin-top:14px;padding:12px;border-radius:12px;font-size:13px;font-weight:700;display:none;}
    .msg.ok{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.35);color:#a7f3d0;}
    .msg.err{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.35);color:#fca5a5;}
    a.back{display:inline-block;margin-top:20px;color:rgba(255,255,255,.45);font-size:13px;text-decoration:none;}
    a.back:hover{color:rgba(255,255,255,.75);}
  </style>
</head>
<body>
<div class="card-wrap">
  <div class="glass">
    <h1>استعادة كلمة المرور</h1>
    <p class="lead">أدخل البريد المسجّل لحساب الإدارة. إن وافق سجّلنا، ستصلك رسالة تحتوي رابطاً لاختيار كلمة مرور جديدة.</p>
    <div class="mb-2">
      <label for="em">البريد الإلكتروني</label>
      <input type="email" id="em" name="email" autocomplete="email" placeholder="البريد المسجّل في الإعدادات" dir="ltr">
    </div>
    <button type="button" class="btn-go" id="btnSend">إرسال رابط الاستعادة</button>
    <div class="msg" id="fb" role="status"></div>
    <a href="login.php" class="back">← العودة لتسجيل الدخول</a>
  </div>
</div>
<script src="assets/js/forgot-password-page.js?v=1.0.0" defer></script>
</body>
</html>
