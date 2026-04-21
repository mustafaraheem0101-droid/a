<?php
/**
 * admin/api-drugs.php
 * API عام لجلب المنتجات من جدول drugs حسب الفئة
 *
 * GET /admin/api-drugs.php?category=cosmetics
 * GET /admin/api-drugs.php?category=kids
 * GET /admin/api-drugs.php?category=medical
 * GET /admin/api-drugs.php?category=all   (كل الأقسام)
 * GET /admin/api-drugs.php?category=cosmetics&q=كريم  (بحث)
 * GET /admin/api-drugs.php?id=5  (منتج واحد)
 */
declare(strict_types=1);

// ── Bootstrap ──────────────────────────────────────────────────────
$rootDir = dirname(__DIR__);
require_once $rootDir . '/env_loader.php';
pharma_load_env_sources($rootDir);

function json_ok(array $data, int $code = 200): void {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($code);
    echo json_encode(['status' => 'success', 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}
function json_err(string $msg, int $code = 400): void {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($code);
    echo json_encode(['status' => 'error', 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── CORS (مثل api.php — لا Wildcard) ─────────────────────────────
$allowedOrigin = trim(env('ALLOWED_ORIGIN', ''));
if ($allowedOrigin === '*' || strcasecmp($allowedOrigin, 'null') === 0) {
    $allowedOrigin = '';
}
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache');
    if ($allowedOrigin !== '' && $requestOrigin === $allowedOrigin) {
        header('Access-Control-Allow-Origin: ' . $allowedOrigin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    http_response_code(200);
    exit;
}

require_once $rootDir . '/admin_panel_auth.php';
require_once $rootDir . '/includes/security.php';

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
    json_err('غير مصرح', 403);
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache');
if ($allowedOrigin !== '' && $requestOrigin === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, OPTIONS');

require_once $rootDir . '/db.php';

// ── PDO ────────────────────────────────────────────────────────────
$pdo = getPdo();
if (!$pdo) {
    json_err('فشل الاتصال بقاعدة البيانات — تأكد من ملف .env: DB_HOST, DB_NAME, DB_USER, DB_PASS', 503);
}

function format_drug(array $row): array {
    return [
        'id'          => (int)$row['id'],
        'name'        => $row['name'],
        'price'       => (float)$row['price'],
        'image'       => $row['image'],
        'image_url'   => $row['image'] ? ('/uploads/' . $row['image']) : '',
        'category'    => $row['category'],
        'description' => $row['description'] ?? '',
        'created_at'  => $row['created_at'],
    ];
}

// ── Router ─────────────────────────────────────────────────────────
$allowed = ['medicine','beauty','medical','baby','vitamin'];
$cat     = trim((string)($_GET['category'] ?? ''));
$id      = (int)($_GET['id'] ?? 0);
$q       = trim((string)($_GET['q'] ?? ''));
$page    = max(1, (int)($_GET['page'] ?? 1));
$perPage = max(1, min(100, (int)($_GET['per_page'] ?? 50)));
$offset  = ($page - 1) * $perPage;

// ─ منتج واحد
if ($id > 0) {
    $st = $pdo->prepare("SELECT * FROM drugs WHERE id = ?");
    $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        json_err('المنتج غير موجود', 404);
    }
    $row = format_drug($row);
    json_ok(['drug' => $row]);
}

// ─ قائمة حسب الفئة
if ($cat !== 'all' && !in_array($cat, $allowed, true)) {
    json_err('الفئة غير صالحة. القيم المقبولة: medicine, beauty, medical, baby, vitamin, all');
}

// بناء الاستعلام
$where  = [];
$params = [];

if ($cat !== 'all' && $cat !== '') {
    $where[]  = 'category = ?';
    $params[] = $cat;
}
if ($q !== '') {
    $where[]  = 'name LIKE ?';
    $params[] = '%' . $q . '%';
}
$whereStr = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

// إجمالي
$stTotal = $pdo->prepare("SELECT COUNT(*) FROM drugs $whereStr");
$stTotal->execute($params);
$total = (int)$stTotal->fetchColumn();

// البيانات
$stData = $pdo->prepare("SELECT * FROM drugs $whereStr ORDER BY created_at DESC LIMIT ? OFFSET ?");
$stData->execute(array_merge($params, [$perPage, $offset]));
$drugs = $stData->fetchAll(PDO::FETCH_ASSOC);

// تنسيق
$drugs = array_map('format_drug', $drugs);

json_ok([
    'drugs' => $drugs,
    'pagination' => [
        'page'        => $page,
        'per_page'    => $perPage,
        'total'       => $total,
        'total_pages' => $total > 0 ? (int)ceil($total / $perPage) : 0,
    ],
    'category' => $cat ?: 'all',
]);
