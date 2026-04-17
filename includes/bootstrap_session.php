<?php
/**
 * تهيئة جلسة PHP موحّدة وآمنة (لوحة الإدارة + API).
 *
 * - Cookies: HttpOnly، SameSite=Strict، Secure عند HTTPS
 * - session.use_strict_mode
 */
declare(strict_types=1);

/**
 * @param array{lifetime?: int} $options lifetime: مدة ملف تعريف الارتباط بالثواني (0 = جلسة المتصفح فقط)
 */
function pharma_init_session_secure(array $options = []): void
{
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }

    $lifetime = (int) ($options['lifetime'] ?? 0);

    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');

    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (is_string($host) && $host !== '' && strpos($host, ':') !== false) {
        $host = explode(':', $host, 2)[0];
    }

    $cookieDomain = (is_string($host) && $host !== '' && $host !== 'localhost'
        && filter_var($host, FILTER_VALIDATE_IP) === false) ? $host : '';

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');

    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'domain' => $cookieDomain,
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    session_start();
}
