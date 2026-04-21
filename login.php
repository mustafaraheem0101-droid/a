<?php
declare(strict_types=1);

require_once __DIR__ . '/admin_panel_auth.php';
require_once __DIR__ . '/includes/bootstrap_session.php';
require_once __DIR__ . '/env_loader.php';
pharma_load_env_sources(__DIR__);
if (!defined('BLOCK_DURATION')) {
    define('BLOCK_DURATION', max(60, (int) env('LOGIN_BLOCK_DURATION', '3600')));
}
if (!defined('CSRF_LIFETIME')) {
    define('CSRF_LIFETIME', 3600);
}
$__pharmaLogs = __DIR__ . '/private_data/logs/';
if (!defined('LOGS_DIR')) {
    define('LOGS_DIR', rtrim($__pharmaLogs, '/\\') . '/');
}
unset($__pharmaLogs);
if (!is_dir(LOGS_DIR)) {
    @mkdir(LOGS_DIR, 0700, true);
}
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/security.php';

error_reporting(0);
ini_set('display_errors', '0');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');

// ── Session (موحّد مع api.php عبر bootstrap_session) ─────────────────
$remember = (isset($_POST['remember']) && $_POST['remember'] === '1');
$lifetime = $remember ? (30 * 24 * 3600) : 0;

$isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
$host = $_SERVER['HTTP_HOST'] ?? '';
if (is_string($host) && strpos($host, ':') !== false) {
    $host = explode(':', $host, 2)[0];
}
$cookieDomain = (is_string($host) && $host !== '' && $host !== 'localhost'
    && filter_var($host, FILTER_VALIDATE_IP) === false) ? $host : '';

pharma_init_session_secure(['lifetime' => $lifetime]);

// ── طوارئ: ملف فارغ `clear_my_login_block.txt` في مجلد البيانات الخاصة → يُزال حظر IP الزائر فور تحميل الصفحة ثم يُحذف الملف
$__clearBlockFile = pharma_resolve_private_dir() . 'clear_my_login_block.txt';
if (is_file($__clearBlockFile) && is_readable($__clearBlockFile)) {
    $clientIp = getClientIP();
    if (getPdo() !== null) {
        try {
            pharma_ip_unblock($clientIp);
            pharma_login_clear($clientIp);
        } catch (Throwable $e) {
            error_log('[login] clear_my_login_block: ' . $e->getMessage());
        }
    }
    unset($_SESSION['login_attempts'], $_SESSION['login_lock_until']);
    @unlink($__clearBlockFile);
}

// ── CSRF ────────────────────────────────────────────────────────────
function csrf_make(): string {
    try   { $t = bin2hex(random_bytes(32)); }
    catch (Throwable $e) { $t = bin2hex(openssl_random_pseudo_bytes(32)); }
    $_SESSION['csrf_token']      = $t;
    $_SESSION['csrf_token_time'] = time();
    return $t;
}
function csrf_get(): string {
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) return csrf_make();
    if ((time() - (int)($_SESSION['csrf_token_time'] ?? 0)) > 3600) return csrf_make();
    return $_SESSION['csrf_token'];
}

// ── JSON API ─────────────────────────────────────────────────────────
if (isset($_GET['check']) && $_GET['check'] === '1') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'logged_in' => !empty($_SESSION['admin_logged_in']), 'csrf_token' => csrf_get()], JSON_UNESCAPED_UNICODE);
    session_write_close();
    exit;
}

// ── إذا مسجّل دخول → لوحة التحكم ────────────────────────────────────
admin_restore_session_from_cookie();
if (!empty($_SESSION['admin_logged_in'])) {
    header('Location: control-panel.php');
    exit;
}

// ── متغيرات الأخطاء ──────────────────────────────────────────────────
$errorMsg = '';
$lockMsg  = '';

// ── POST handler ─────────────────────────────────────────────────────
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $now          = time();
    $maxAttempts  = max(1, (int) env('MAX_LOGIN_ATTEMPTS', '5'));
    $lockSeconds  = max(60, (int) env('LOGIN_LOCK_SECONDS', '300'));
    $clientIp     = getClientIP();
    $noLoginLockout = pharma_login_lockout_disabled();
    $useDbThrottle = getPdo() !== null && !$noLoginLockout;

    if (!$noLoginLockout && $useDbThrottle && isIPBlocked($clientIp)) {
        $lockMsg = 'تم تجاوز عدد المحاولات. حاول مجدداً لاحقاً.';
    } elseif (!$noLoginLockout && !$useDbThrottle) {
        $attempts  = (int) ($_SESSION['login_attempts'] ?? 0);
        $lockUntil = (int) ($_SESSION['login_lock_until'] ?? 0);
        if ($lockUntil > 0 && $lockUntil <= $now) {
            $attempts = 0;
            $lockUntil = 0;
            $_SESSION['login_attempts'] = 0;
            $_SESSION['login_lock_until'] = 0;
        }
        if ($lockUntil > $now) {
            $mins    = (int) ceil(($lockUntil - $now) / 60);
            $lockMsg = "تم تجاوز عدد المحاولات. حاول مجدداً بعد {$mins} دقيقة.";
        }
    }

    if ($lockMsg === '') {
        $submittedCsrf = (string) ($_POST['csrf_token'] ?? '');
        $sessionCsrf   = (string) ($_SESSION['csrf_token'] ?? '');
        $csrfAge       = $now - (int) ($_SESSION['csrf_token_time'] ?? 0);
        $csrfValid     = ($submittedCsrf !== '' && $sessionCsrf !== '' && $csrfAge < 3600
            && hash_equals($sessionCsrf, $submittedCsrf));
        csrf_make();

        if (!$csrfValid) {
            $errorMsg = 'انتهت صلاحية الجلسة. أعد المحاولة.';
        } else {
          $pass = (string) ($_POST['pass'] ?? $_POST['password'] ?? '');
            if (strlen($pass) > 512) {
                $pass = '';
            }
            $hash = admin_bcrypt_hash();
            $authOk = ($pass !== '' && $hash !== '' && password_verify($pass, $hash));
            if ($authOk) {
                session_regenerate_id(true);
                $_SESSION['admin_logged_in'] = true;
                unset($_SESSION['login_attempts'], $_SESSION['login_lock_until']);
                admin_csrf_token();
                if (getPdo() !== null) {
                    pharma_login_clear($clientIp);
                }
                $expUnix = $now + ($remember ? (30 * 86400) : (12 * 3600));
                $hash = admin_bcrypt_hash();
                admin_cp_set_cookie(admin_cp_sign($expUnix, $hash), $cookieDomain, $isSecure, $remember, $expUnix);
                header('Location: control-panel.php');
                exit;
            }

            if ($noLoginLockout) {
                $errorMsg = 'كلمة المرور غير صحيحة.';
            } elseif ($useDbThrottle) {
                $count = pharma_login_record_failure($clientIp);
                if ($count >= $maxAttempts) {
                    blockIP($clientIp, BLOCK_DURATION);
                    $lockMsg = 'تم تجاوز عدد المحاولات. حاول مجدداً لاحقاً.';
                } else {
                    $remaining = $maxAttempts - $count;
                    $errorMsg  = "كلمة المرور غير صحيحة. ({$remaining} محاولة متبقية)";
                }
            } else {
                $attempts = (int) ($_SESSION['login_attempts'] ?? 0) + 1;
                $_SESSION['login_attempts'] = $attempts;
                $remaining = $maxAttempts - $attempts;
                if ($attempts >= $maxAttempts) {
                    $_SESSION['login_lock_until'] = $now + $lockSeconds;
                    $lockMsg = 'تم تجاوز عدد المحاولات. حاول مجدداً بعد 5 دقائق.';
                } else {
                    $errorMsg = "كلمة المرور غير صحيحة. ({$remaining} محاولة متبقية)";
                }
            }
        }
    }
}

$csrfToken = csrf_get();
$errHtml   = escHtml($errorMsg);
$lockHtml  = escHtml($lockMsg);
$csrfHtml  = escHtml($csrfToken);
$disabled  = $lockMsg !== '' ? ' disabled' : '';
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0, private">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>تسجيل دخول — لوحة الإدارة</title>
  <link rel="icon" href="brand-logo-20260330.png?v=2" type="image/png">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css" rel="stylesheet" crossorigin="anonymous">
  <!-- CSS unified - build tools/build-css.js -->
  <link href="assets/css/dist/base-final.min.css" rel="stylesheet">
  <link href="mobile.css?v=20260326-2" rel="stylesheet">
  <link href="desktop.css?v=20260326-1" rel="stylesheet">
  <style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
:root{--g:#00875A;--g2:#006644;--navy:#0A1628;}
html{
  font-size:16px;
  -webkit-text-size-adjust:100%;
  scroll-padding-bottom:max(100px,env(safe-area-inset-bottom,0px));
}
html,body{min-height:100%;font-family:'Tajawal',sans-serif;direction:rtl;-webkit-font-smoothing:antialiased;}
body{
  min-height:100vh;
  min-height:100dvh;
  background:
    radial-gradient(ellipse at 65% -10%,rgba(0,168,110,.22),transparent 55%),
    radial-gradient(ellipse at 20% 110%,rgba(0,100,68,.25),transparent 50%),
    linear-gradient(150deg,#0a1628 0%,#0f2744 55%,#0c2e20 100%);
  display:flex;align-items:center;justify-content:center;padding:20px;
  position:relative;overflow:hidden;
}
body::before{content:'';position:absolute;inset:0;
  background-image:linear-gradient(rgba(0,135,90,.05) 1px,transparent 1px),
    linear-gradient(90deg,rgba(0,135,90,.05) 1px,transparent 1px);
  background-size:50px 50px;pointer-events:none;}
body::after{content:'';position:absolute;width:500px;height:500px;border-radius:50%;
  background:radial-gradient(circle,rgba(0,168,110,.12),transparent 70%);
  top:-150px;right:-100px;pointer-events:none;
  animation:floatOrb 10s ease-in-out infinite alternate;}
@keyframes floatOrb{from{transform:translate(0,0);}to{transform:translate(30px,25px);}}
.login-card{
  position:relative;z-index:1;
  background:rgba(255,255,255,.07);
  backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  border:1px solid rgba(255,255,255,.13);
  border-radius:26px;padding:44px 40px;
  width:100%;max-width:430px;
  box-shadow:0 32px 80px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.05);
  animation:cardIn .45s cubic-bezier(.4,0,.2,1) both;}
@keyframes cardIn{from{opacity:0;transform:translateY(28px) scale(.97);}to{opacity:1;transform:none;}}
.login-head{text-align:center;margin-bottom:32px;}
.login-logo-wrap{width:78px;height:78px;border-radius:22px;background:transparent;
  margin:0 auto 16px;display:flex;align-items:center;justify-content:center;
  box-shadow:0 10px 32px rgba(0,135,90,.45);overflow:hidden;}
.login-logo-wrap img{width:100%;height:100%;object-fit:contain;}
.login-head h1{font-size:22px;font-weight:900;color:#fff;margin-bottom:5px;}
.login-head p{font-size:13px;color:rgba(255,255,255,.5);}
.field{margin-bottom:18px;}
.field label{display:block;font-size:12.5px;font-weight:800;color:rgba(255,255,255,.55);margin-bottom:8px;letter-spacing:.02em;}
.field-wrap{position:relative;}
.field input{
  width:100%;min-height:48px;height:auto;
  background:rgba(255,255,255,.09);
  border:1.5px solid rgba(255,255,255,.14);
  border-radius:14px;padding:12px 16px 12px 46px;
  font-family:'Tajawal',sans-serif;font-size:16px;
  color:#fff;outline:none;transition:all .25s;}
.field input::placeholder{color:rgba(255,255,255,.32);}
.field input:focus{background:rgba(255,255,255,.14);border-color:rgba(0,168,110,.65);box-shadow:0 0 0 4px rgba(0,168,110,.15);}
.field input:disabled{opacity:.5;cursor:not-allowed;}
.toggle-pw{position:absolute;left:8px;top:50%;transform:translateY(-50%);
  background:none;border:none;color:rgba(255,255,255,.35);cursor:pointer;font-size:18px;padding:8px;min-width:44px;min-height:44px;border-radius:10px;transition:color .2s,background .2s;}
.toggle-pw:hover{color:rgba(255,255,255,.7);}
.err-msg{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);
  border-radius:12px;padding:12px 16px;color:#fca5a5;font-size:13px;font-weight:700;
  margin-bottom:16px;animation:shake .3s ease;}
.lock-msg{background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);
  border-radius:12px;padding:12px 16px;color:#fde68a;font-size:13px;font-weight:700;margin-bottom:16px;}
@keyframes shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);}}
.remember-row{display:flex;align-items:center;gap:8px;margin-bottom:18px;}
.remember-row input[type=checkbox]{width:16px;height:16px;accent-color:var(--g);cursor:pointer;}
.remember-row label{font-size:13px;color:rgba(255,255,255,.5);cursor:pointer;user-select:none;}
.login-btn{
  width:100%;min-height:56px;
  background:linear-gradient(135deg,#00a86e,#00875a);
  border:none;border-radius:15px;
  color:#fff;font-family:'Tajawal',sans-serif;
  font-size:17px;font-weight:900;cursor:pointer;
  transition:all .25s;
  box-shadow:0 8px 28px rgba(0,135,90,.45);}
.login-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 36px rgba(0,135,90,.55);}
.login-btn:disabled{opacity:.6;cursor:not-allowed;}
.back-link{display:flex;align-items:center;justify-content:center;gap:6px;
  margin-top:22px;color:rgba(255,255,255,.38);font-size:13px;text-decoration:none;transition:color .2s;}
.back-link:hover{color:rgba(255,255,255,.65);}
  </style>
</head>
<body>

<div class="login-card shadow-lg">
  <div class="login-head">
    <div class="login-logo-wrap">
      <img src="brand-logo-20260330.png?v=2" alt="صيدلية شهد محمد" width="78" height="78"
           onerror="this.style.display='none';var fb=this.parentNode.querySelector('.logo-fb');if(fb)fb.style.display='inline';"><span class="logo-fb" aria-hidden="true" style="display:none;font-size:42px">💊</span>
    </div>
    <h1>لوحة الإدارة</h1>
    <p>صيدلية شهد محمد — pharma-store.me</p>
  </div>

  <?php if ($lockHtml !== ''): ?>
    <div class="lock-msg" role="alert">🔒 <?= $lockHtml ?></div>
  <?php elseif ($errHtml !== ''): ?>
    <div class="err-msg" role="alert">⚠️ <?= $errHtml ?></div>
  <?php endif; ?>

  <form method="POST" action="login.php" id="loginForm">
    <input type="hidden" name="csrf_token" value="<?= $csrfHtml ?>">

    <div class="field">
      <label for="adminPass">🔒 كلمة المرور</label>
      <div class="field-wrap">
        <input type="password" id="adminPass" name="pass"
               autocomplete="current-password" placeholder="••••••••"
               required autofocus<?= $disabled ?>>
        <button type="button" class="toggle-pw" id="togglePw" aria-label="إظهار كلمة المرور">👁</button>
      </div>
    </div>

    <div class="remember-row">
      <input type="checkbox" id="rememberMe" name="remember" value="1">
      <label for="rememberMe">تذكّرني لمدة 30 يوماً</label>
    </div>

    <button type="submit" class="login-btn" id="loginBtn"<?= $disabled ?>>
      دخول إلى لوحة الإدارة
    </button>
  </form>

  <a href="/" class="back-link">← العودة إلى الموقع</a>
</div>

<script src="assets/js/login-ui.js?v=1.0.0"></script>

</body>
</html>
