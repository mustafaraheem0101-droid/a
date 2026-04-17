<?php
/**
 * فك حظر تسجيل الدخول لعنوان IP الحالي (بعد تجاوز المحاولات).
 *
 * 1) في `.env` على السيرفر أضف سطراً مثل:
 *    LOGIN_UNBLOCK_TOKEN=ضع_هنا_سلسلة_عشوائية_طويلة_48_حرفاً_على_الأقل
 *    (توليد: php -r "echo bin2hex(random_bytes(32));")
 * 2) افتح من نفس الجهاز/المتصفح الذي حُظر:
 *    https://نطاقك/unblock_login.php?token=نفس_السلسلة
 * 3) بعد النجاح: احذف هذا الملف من السيرفر أو أزل LOGIN_UNBLOCK_TOKEN من .env
 *
 * بديل فوري بدون رمز: أنشئ ملفًا فارغًا باسم clear_my_login_block.txt داخل مجلد البيانات الخاصة
 * (نفس مسار admin_hash.txt) ثم افتح login.php مرة واحدة.
 */
declare(strict_types=1);

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

require_once __DIR__ . '/env_loader.php';
pharma_load_env_sources(__DIR__);

$expected = trim(env('LOGIN_UNBLOCK_TOKEN', ''));
$got      = isset($_GET['token']) ? trim((string) $_GET['token']) : '';

if ($expected === '' || strlen($expected) < 32 || $got === '' || !hash_equals($expected, $got)) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ممنوع</title></head><body style="font-family:sans-serif;padding:2rem;">غير مصرح.</body></html>';
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/security.php';

if (getPdo() === null) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>خطأ</title></head><body style="font-family:sans-serif;padding:2rem;">تعذّر الاتصال بقاعدة البيانات.</body></html>';
    exit;
}

$ip = getClientIP();
try {
    pharma_ip_unblock($ip);
    pharma_login_clear($ip);
} catch (Throwable $e) {
    error_log('[unblock_login] ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>خطأ</title></head><body style="font-family:sans-serif;padding:2rem;">حدث خطأ أثناء فك الحظر.</body></html>';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
echo '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>تم</title></head><body style="font-family:sans-serif;padding:2rem;max-width:40rem;">';
echo '<h1>تم فك الحظر</h1><p>عنوان IP: <code>' . htmlspecialchars($ip, ENT_QUOTES, 'UTF-8') . '</code></p>';
echo '<p>يمكنك الآن <a href="login.php">العودة إلى تسجيل الدخول</a>.</p>';
echo '<p style="color:#666;font-size:14px;">احذف ملف <code>unblock_login.php</code> من السيرفر أو أزل <code>LOGIN_UNBLOCK_TOKEN</code> من <code>.env</code> بعد الانتهاء.</p>';
echo '</body></html>';
