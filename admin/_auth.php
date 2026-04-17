<?php
/**
 * admin/_auth.php
 * حارس المصادقة — يُضمَّن في كل صفحة إدارة
 */
declare(strict_types=1);

// مسار الجذر (مجلد z/)
define('ROOT_DIR', dirname(__DIR__));

require_once ROOT_DIR . '/admin_panel_auth.php';
require_once ROOT_DIR . '/env_loader.php';
pharma_load_env_sources(ROOT_DIR);

// Session
$_isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
$_host = $_SERVER['HTTP_HOST'] ?? '';
if (is_string($_host) && strpos($_host, ':') !== false) {
    $_host = explode(':', $_host, 2)[0];
}
$_cookieDomain = (is_string($_host) && $_host !== '' && $_host !== 'localhost'
    && filter_var($_host, FILTER_VALIDATE_IP) === false) ? $_host : '';

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'domain' => $_cookieDomain,
        'secure'   => $_isSecure, 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
}

admin_restore_session_from_cookie();

if (empty($_SESSION['admin_logged_in'])) {
    // redirect نسبي يعمل بغض النظر عن domain أو subdirectory
    $loginUrl = str_repeat('../', substr_count($_SERVER['SCRIPT_NAME'] ?? '', '/') - 1) . 'login.php';
    header('Location: ' . $loginUrl);
    exit;
}

// PDO
require_once ROOT_DIR . '/db.php';

// ── مُهيّئ PDO مع إنشاء جدول drugs ─────────────────────────────────
function admin_pdo(): PDO {
    static $cachedPdo = null;
    if ($cachedPdo !== null) return $cachedPdo;

    $pdo = getPdo();
    if (!$pdo) {
        die(
            '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' .
            '<title>خطأ</title><style>body{font-family:sans-serif;padding:60px;color:#991b1b;background:#fef2f2;}</style></head>' .
            '<body><h2>❌ فشل الاتصال بقاعدة البيانات</h2>' .
            '<p>تحقق من إعدادات <code>.env</code> (DB_HOST, DB_NAME, DB_USER, DB_PASS)</p>' .
            '<p><a href="../login.php">← العودة لتسجيل الدخول</a></p></body></html>'
        );
    }
    // إنشاء جدول drugs تلقائياً إن لم يوجد
    $pdo->exec("CREATE TABLE IF NOT EXISTS drugs (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(255)  NOT NULL,
        price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        image       VARCHAR(500)  NOT NULL DEFAULT '',
        category    ENUM('medicine','beauty','medical','baby','vitamin') NOT NULL,
        description TEXT,
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_drugs_category (category),
        KEY idx_drugs_created  (created_at),
        KEY idx_drugs_name     (name(100))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $cachedPdo = $pdo;
    return $pdo;
}

// URL جذر الموقع — يُحسَب ديناميكياً ليعمل مع أي مسار
if (!defined('ROOT_DIR_URL')) {
    $proto   = $_isSecure ? 'https' : 'http';
    $host2   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $script  = $_SERVER['SCRIPT_NAME'] ?? '/admin/dashboard.php';
    // نزيل /admin/xxx.php لنحصل على الجذر
    $baseUri = rtrim(dirname(dirname($script)), '/');
    define('ROOT_DIR_URL', $proto . '://' . $host2 . $baseUri);
}

// Labels
const CATEGORY_LABELS = [
    'cosmetics' => ['ar' => 'مستحضرات التجميل', 'en' => 'Cosmetics', 'icon' => '💄', 'color' => '#e879f9'],
    'kids'      => ['ar' => 'منتجات الأطفال',     'en' => 'Kids',      'icon' => '🧸', 'color' => '#fb923c'],
    'medical'   => ['ar' => 'المستلزمات الطبية',  'en' => 'Medical',   'icon' => '🩺', 'color' => '#34d399'],
];
