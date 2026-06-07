<?php
/**
 * api-sliders.php — واجهة JSON عامة لجلب السلايدرات النشطة
 * GET /api-sliders.php  → JSON array
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');

define('ROOT_DIR', __DIR__);
require_once __DIR__ . '/db.php';

$pdo = getPdo();
if (!$pdo) {
    echo json_encode([]);
    exit;
}

// تأكد الجدول موجود
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS pharma_sliders (
        id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        title       VARCHAR(255) NOT NULL DEFAULT '',
        link_url    VARCHAR(500) NOT NULL DEFAULT '',
        img_desktop VARCHAR(500) NOT NULL DEFAULT '',
        img_mobile  VARCHAR(500) NOT NULL DEFAULT '',
        alt_text    VARCHAR(255) NOT NULL DEFAULT '',
        sort_order  INT NOT NULL DEFAULT 0,
        active      TINYINT(1) NOT NULL DEFAULT 1,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sliders_sort   (sort_order),
        KEY idx_sliders_active (active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Exception $e) {}

try {
    $rows = $pdo->query(
        "SELECT id, title, link_url, img_desktop, img_mobile, alt_text
         FROM pharma_sliders
         WHERE active = 1
         ORDER BY sort_order ASC, id ASC"
    )->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode([]);
}
