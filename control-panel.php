<?php
/**
 * control-panel.php — لوحة الإدارة المحمية
 * يعيد التوجيه لـ login.php (وليس login.html) عند عدم المصادقة
 */
declare(strict_types=1);
require_once __DIR__ . '/admin_panel_auth.php';

error_reporting(0);
ini_set('display_errors', '0');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('Pragma: no-cache');
header('Expires: 0');

// ── Session ──────────────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (is_string($host) && strpos($host, ':') !== false) {
        $host = explode(':', $host, 2)[0];
    }
    $cookieDomain = (is_string($host) && $host !== '' && $host !== 'localhost'
        && filter_var($host, FILTER_VALIDATE_IP) === false) ? $host : '';

    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'domain' => $cookieDomain,
        'secure'   => $isSecure, 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
}

admin_restore_session_from_cookie();

// ── حماية: إعادة التوجيه لـ login.php عند عدم المصادقة ──────────────
if (empty($_SESSION['admin_logged_in'])) {
    header('Location: login.php');
    exit;
}

$_ADMIN_API_CSRF = admin_csrf_token();

require_once __DIR__ . '/env_loader.php';
pharma_load_env_sources(__DIR__);
require_once __DIR__ . '/includes/pharma_mail.php';
$_ADMIN_RECOVERY_EMAIL = pharma_admin_recovery_email();
$_ADMIN_MAIL_READY = pharma_mail_configured() ? '1' : '0';

// ── عرض لوحة التحكم ─────────────────────────────────────────────────
include __DIR__ . '/control-panel.html';
