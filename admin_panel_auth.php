<?php
/**
 * مصدر واحد لهاش كلمة مرور لوحة التحكم + كوكي موقّع عند فشل الجلسة.
 * التجزئة تُقرأ من private_data/admin_hash.txt فقط (لا تُخزَّن في الكود المصدري).
 */
declare(strict_types=1);

/**
 * @return non-empty-string مسار مجلد البيانات الخاصة (متوافق مع api.php)
 */
function pharma_resolve_private_dir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $__ph = '/home/u678860509/private_data';
    $__pl = __DIR__ . '/private_data';
    $dir = rtrim(is_dir($__ph) ? $__ph : $__pl, '/\\') . DIRECTORY_SEPARATOR;

    return $dir;
}

function pharma_admin_hash_file(): string
{
    return pharma_resolve_private_dir() . 'admin_hash.txt';
}

/**
 * تجزئة bcrypt لكلمة مرور الإدارة — من الملف فقط.
 */
function admin_bcrypt_hash(): string
{
    if (isset($GLOBALS['__pharma_admin_hash_cache']) && is_string($GLOBALS['__pharma_admin_hash_cache'])) {
        return $GLOBALS['__pharma_admin_hash_cache'];
    }
    $path = pharma_admin_hash_file();
    $raw = is_readable($path) ? trim((string) file_get_contents($path)) : '';
    if ($raw !== '' && preg_match('/^\$2[ayb]\$\d{2}\$/', $raw) === 1) {
        $GLOBALS['__pharma_admin_hash_cache'] = $raw;

        return $raw;
    }
    error_log('[pharma] ملف admin_hash.txt غير موجود أو غير صالح — أنشئه في private_data/ (تجزئة bcrypt من password_hash)');
    $GLOBALS['__pharma_admin_hash_cache'] = '';

    return '';
}

function admin_bcrypt_hash_reset_cache(): void
{
    unset($GLOBALS['__pharma_admin_hash_cache']);
}

/**
 * حفظ تجزئة bcrypt جديدة في admin_hash.txt (تغيير كلمة المرور / الاستعادة عبر البريد).
 *
 * @return bool نجاح الكتابة على القرص
 */
function admin_save_bcrypt_hash(string $bcryptHash): bool
{
    $bcryptHash = trim($bcryptHash);
    if ($bcryptHash === '' || preg_match('/^\$2[ayb]\$\d{2}\$/', $bcryptHash) !== 1) {
        return false;
    }
    $path = pharma_admin_hash_file();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0700, true) && !is_dir($dir)) {
            return false;
        }
    }
    if (file_put_contents($path, $bcryptHash . "\n", LOCK_EX) === false) {
        return false;
    }
    @chmod($path, 0600);
    admin_bcrypt_hash_reset_cache();

    return true;
}

function admin_cp_sign(int $expUnix, string $bcryptHash): string
{
    $key = hash('sha256', 'cp_panel_v1|' . $bcryptHash, true);
    $payload = (string)$expUnix;
    return $payload . '.' . hash_hmac('sha256', $payload, $key);
}

function admin_cp_valid(?string $cookieVal, string $bcryptHash): bool
{
    if ($cookieVal === null || $cookieVal === '') {
        return false;
    }
    $dot = strpos($cookieVal, '.');
    if ($dot === false) {
        return false;
    }
    $exp = substr($cookieVal, 0, $dot);
    $sig = substr($cookieVal, $dot + 1);
    if ($exp === '' || $sig === '' || !ctype_digit($exp)) {
        return false;
    }
    if ((int)$exp < time()) {
        return false;
    }
    $key = hash('sha256', 'cp_panel_v1|' . $bcryptHash, true);
    return hash_equals(hash_hmac('sha256', $exp, $key), $sig);
}

function admin_cp_set_cookie(string $value, string $cookieDomain, bool $isSecure, bool $remember, int $expUnix): void
{
    setcookie('cp_auth', $value, [
        'expires' => $remember ? $expUnix : 0,
        'path' => '/',
        'domain' => $cookieDomain,
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function admin_cp_clear_cookie(string $cookieDomain, bool $isSecure): void
{
    setcookie('cp_auth', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'domain' => $cookieDomain,
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function admin_restore_session_from_cookie(): void
{
    if (!empty($_SESSION['admin_logged_in'])) {
        return;
    }
    $h = admin_bcrypt_hash();
    $raw = isset($_COOKIE['cp_auth']) ? (string)$_COOKIE['cp_auth'] : '';
    if (admin_cp_valid($raw !== '' ? $raw : null, $h)) {
        $_SESSION['admin_logged_in'] = true;
    }
}

/** رمز CSRF لواجهة API + النماذج (يُرسل في X-Admin-CSRF أو حقل _csrf في JSON). */
function admin_csrf_token(): string
{
    if (empty($_SESSION['admin_csrf']) || !is_string($_SESSION['admin_csrf'])) {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(24));
    }

    return $_SESSION['admin_csrf'];
}

function admin_csrf_verify(string $tok): bool
{
    return isset($_SESSION['admin_csrf']) && is_string($_SESSION['admin_csrf'])
        && $tok !== '' && hash_equals($_SESSION['admin_csrf'], $tok);
}
