<?php
// logout.php - إنهاء جلسة لوحة الإدارة
require_once __DIR__ . '/admin_panel_auth.php';

error_reporting(0);
ini_set('display_errors', 0);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('Pragma: no-cache');
header('Expires: 0');

$isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
$host = $_SERVER['HTTP_HOST'] ?? '';
$cookieDomain = '';
if (is_string($host) && $host !== '' && strpos($host, ':') !== false) {
    $host = explode(':', $host, 2)[0];
}
if (is_string($host) && $host !== '' && filter_var($host, FILTER_VALIDATE_IP) === false && $host !== 'localhost') {
    $cookieDomain = $host;
}

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => $cookieDomain,
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    session_start();
}

admin_cp_clear_cookie($cookieDomain, $isSecure);

// مسح بيانات الجلسة بالكامل
$_SESSION = [];
session_unset();

// حذف cookie الخاصة بالجلسة بشكل آمن
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    $cookieParams = [
        'expires' => time() - 42000,
        'path' => $params['path'] ?? '/',
        'secure' => $params['secure'] ?? false,
        'httponly' => true,
        'samesite' => 'Strict',
    ];
    if (!empty($params['domain'])) {
        $cookieParams['domain'] = $params['domain'];
    }
    setcookie(session_name(), '', $cookieParams);
}

session_destroy();

header('Location: login.php');
exit;
?>

