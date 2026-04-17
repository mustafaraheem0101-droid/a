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

// ── Headers (CORS مثل api.php — لا Wildcard) ───────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache');
$allowedOrigin = trim(env('ALLOWED_ORIGIN', ''));
if ($allowedOrigin === '*' || strcasecmp($allowedOrigin, 'null') === 0) {
    $allowedOrigin = '';
}
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($allowedOrigin !== '' && $requestOrigin === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200); exit;
}
require_once $rootDir . '/db.php';

function json_ok(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode(['status' => 'success', 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}
function json_err(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['status' => 'error', 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── PDO ────────────────────────────────────────────────────────────
$pdo = getPdo();
if (!$pdo) json_err('فشل الاتصال بقاعدة البيانات — تأكد من ملف .env: DB_HOST, DB_NAME, DB_USER, DB_PASS', 503);

// إنشاء الجدول إن لم يوجد
$pdo->exec("CREATE TABLE IF NOT EXISTS drugs (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    image VARCHAR(500) NOT NULL DEFAULT '',
    category ENUM('medicine','beauty','medical','baby','vitamin') NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_drugs_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

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
    if (!$row) json_err('المنتج غير موجود', 404);
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

// ── Helper ─────────────────────────────────────────────────────────
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
