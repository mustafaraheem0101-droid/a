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

// تأكد الجدول موجود (مخطط موحّد في db.php)
try {
    pharma_ensure_sliders_table($pdo);
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
