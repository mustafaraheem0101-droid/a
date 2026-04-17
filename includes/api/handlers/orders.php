<?php
/**
 * includes/api/handlers/orders.php
 * معالج الطلبات (إدارة) — قراءة/كتابة مباشرة على pharma_orders عند توفر PDO.
 */
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/orders_customers_aggregate.php';

function handle_orders(string $action, array $body, string $clientIP, string $method, mixed $db): void
{
    switch ($action) {

        case 'admin_get_orders':
            checkAuth($clientIP);
            if (getPdo() === null) {
                jsonError('قاعدة البيانات غير متوفرة', [], 503);
            }
            $orders = pharma_orders_load_all(pharma_require_pdo());
            usort($orders, static fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
            jsonSuccess(['orders' => array_values($orders)], '');
            break;

        case 'admin_update_order_status':
            checkAuth($clientIP);
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            $oid    = (string) ($body['id'] ?? '');
            $status = sanitizeInput($body['status'] ?? '');
            if ($oid === '' || !in_array($status, ['pending', 'shipped', 'delivered', 'cancelled'], true)) {
                jsonError('بيانات غير صالحة');
            }
            if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
            $ok = pharma_order_update_status_mysql($oid, $status);
            if (!$ok) { jsonError('الطلب غير موجود أو تعذر الحفظ', [], 404); }
            logActivity('ORDER_STATUS', "تحديث طلب {$oid} إلى {$status}", $clientIP);
            jsonSuccess([], '');
            break;

        case 'admin_create_order':
            checkAuth($clientIP);
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            $phone = sanitizeInput($body['phone'] ?? '');
            if ($phone === '') { jsonError('رقم الهاتف مطلوب'); }
            if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
            $order = pharma_orders_create_manual_mysql($body, $phone);
            if ($order === null) { jsonError('خطأ في الحفظ', [], 500); }
            logActivity('ORDER_CREATE', "طلب يدوي #{$order['id']}", $clientIP);
            jsonSuccess(['order' => $order], '');
            break;

        case 'admin_delete_order':
            checkAuth($clientIP);
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            $oid = (string) ($body['id'] ?? '');
            if ($oid === '') { jsonError('طلب غير صالح'); }
            if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
            $found = false;
            $ok    = pharma_run_locked_tx(static function (PDO $pdo) use ($oid, &$found): void {
                $pdo->beginTransaction();
                $found = pharma_order_delete_row($pdo, $oid);
                $pdo->commit();
            }, 'admin_delete_order');
            if (!$ok) { jsonError('خطأ في الحفظ', [], 500); }
            if (!$found) { jsonError('الطلب غير موجود'); }
            logActivity('ORDER_DELETE', "حذف طلب {$oid}", $clientIP);
            jsonSuccess([], '');
            break;

        case 'admin_get_customers':
            checkAuth($clientIP);
            if (getPdo() === null) {
                jsonError('قاعدة البيانات غير متوفرة', [], 503);
            }
            $orders    = pharma_orders_load_all(pharma_require_pdo());
            $customers = pharma_aggregate_customers_from_orders($orders);
            jsonSuccess(['customers' => $customers], '');
            break;

        default:
            jsonError("action غير معروف في handle_orders: $action", [], 400);
    }
}
