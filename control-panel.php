<?php
/**
 * control-panel.php — لوحة الإدارة المحمية
 * يعيد التوجيه لـ login.php (وليس login.html) عند عدم المصادقة
 */
declare(strict_types=1);

require_once __DIR__ . '/env_loader.php';
pharma_load_env_sources(__DIR__);

require_once __DIR__ . '/includes/bootstrap_session.php';
pharma_init_session_secure(['lifetime' => 0]);

require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/admin_panel_auth.php';
admin_restore_session_from_cookie();
checkAuth(getClientIP(), false);

error_reporting(0);
ini_set('display_errors', '0');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('Pragma: no-cache');
header('Expires: 0');

$_ADMIN_API_CSRF = admin_csrf_token();

// ── عرض لوحة التحكم ─────────────────────────────────────────────────
include __DIR__ . '/control-panel.html';
