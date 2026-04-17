<?php
/**
 * تتبع أحداث الواتساب والطلبات — تخزين MySQL فقط
 */
declare(strict_types=1);

/**
 * @param array<string,mixed>|null $payload
 */
/**
 * تسجيل نقرة واتساب على منتج — INSERT سريع في pharma_whatsapp_clicks (بدون JSON).
 */
function pharma_record_whatsapp_click(string $productId): bool
{
    $pid = preg_replace('/[^a-zA-Z0-9_-]/', '', $productId);
    if ($pid === '') {
        return false;
    }
    try {
        $pdo = pharma_require_pdo();
        pharma_ensure_schema($pdo);
        $st = $pdo->prepare('INSERT INTO pharma_whatsapp_clicks (product_id) VALUES (?)');

        return $st->execute([$pid]);
    } catch (Throwable $e) {
        error_log('[pharma_record_whatsapp_click] ' . $e->getMessage());

        return false;
    }
}

function pharma_track_analytics_event(string $eventType, string $productId = '', ?array $payload = null, ?string $clientIp = null): bool
{
    try {
        $pdo = pharma_require_pdo();
        pharma_ensure_schema($pdo);
        $ip = $clientIp ?? (function_exists('getClientIP') ? getClientIP() : '');
        $hash = hash('sha256', (string) $ip . '|pharma');
        $json = '';
        if ($payload !== null && $payload !== []) {
            $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
            if ($json === false) {
                $json = '';
            }
        }
        $st = $pdo->prepare(
            'INSERT INTO pharma_analytics_events (event_type, product_id, payload, ip_hash, created_at) VALUES (?,?,?,?,NOW())'
        );

        return $st->execute([$eventType, $productId, $json, $hash]);
    } catch (Throwable $e) {
        error_log('[pharma_track_analytics_event] ' . $e->getMessage());

        return false;
    }
}

/**
 * زيادة عدّاد طلبات الواتساب على المنتج (حقل wa_order_count داخل doc)
 */
function pharma_increment_product_wa_count(string $productId, int $delta = 1): void
{
    if ($delta < 1) {
        return;
    }
    $pid = preg_replace('/[^a-zA-Z0-9_-]/', '', $productId);
    if ($pid === '') {
        return;
    }
    db_update_field_callback('products', static function (array $products) use ($pid, $delta): array {
        foreach ($products as &$p) {
            if (!is_array($p) || (string) ($p['id'] ?? '') !== $pid) {
                continue;
            }
            $p['wa_order_count'] = max(0, (int) ($p['wa_order_count'] ?? 0)) + $delta;
            $p['updated_at'] = date('Y-m-d H:i:s');
            break;
        }

        return $products;
    });
}

/**
 * بحث في جدول المنتجات (حقل doc) + تطبيق فلاتر على الكائنات المفكوكة
 *
 * @return list<array<string,mixed>>
 */
function pharma_db_search_products(PDO $pdo, string $q, array $filters = []): array
{
    pharma_ensure_schema($pdo);
    $q = trim($q);
    $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';

    if ($q === '') {
        $st = $pdo->query('SELECT doc FROM pharma_products ORDER BY sort_order ASC, id ASC LIMIT 500');
    } else {
        $st = $pdo->prepare('SELECT doc FROM pharma_products WHERE doc LIKE ? ORDER BY sort_order ASC, id ASC LIMIT 200');
        $st->execute([$like]);
    }

    $out = [];
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $p = json_decode((string) $row['doc'], true);
        if (!is_array($p)) {
            continue;
        }
        if (($p['active'] ?? true) === false) {
            continue;
        }
        if ($q !== '') {
            $hay = mb_strtolower(
                ($p['name'] ?? '') . ' ' . ($p['desc'] ?? '') . ' ' . ($p['cat'] ?? '') . ' ' . implode(' ', $p['categories'] ?? []),
                'UTF-8'
            );
            if (mb_strpos($hay, mb_strtolower($q, 'UTF-8'), 0, 'UTF-8') === false) {
                continue;
            }
        }
        $price = (float) ($p['price'] ?? 0);
        if (isset($filters['min_price']) && $price < (float) $filters['min_price']) {
            continue;
        }
        if (isset($filters['max_price']) && $price > (float) $filters['max_price']) {
            continue;
        }
        $catSlug = (string) ($filters['category'] ?? '');
        if ($catSlug !== '') {
            $cats = [];
            if (!empty($p['categories']) && is_array($p['categories'])) {
                $cats = $p['categories'];
            } elseif (!empty($p['cat'])) {
                $cats = [(string) $p['cat']];
            }
            if (!in_array($catSlug, $cats, true)) {
                continue;
            }
        }
        $ptype = (string) ($filters['product_type'] ?? '');
        if ($ptype !== '' && (string) ($p['product_type'] ?? '') !== $ptype) {
            continue;
        }
        $out[] = $p;
    }

    return $out;
}

/**
 * اقتراحات سريعة (أسماء فقط)
 *
 * @return list<array{id:string,name:string,price:mixed,image?:string}>
 */
function pharma_db_search_suggest(PDO $pdo, string $q, int $limit = 8): array
{
    $all = pharma_db_search_products($pdo, $q, []);
    $slice = array_slice($all, 0, max(1, min(20, $limit)));
    $rows = [];
    foreach ($slice as $p) {
        $rows[] = [
            'id' => (string) ($p['id'] ?? ''),
            'name' => (string) ($p['name'] ?? ''),
            'price' => $p['price'] ?? 0,
            'image' => $p['image'] ?? ($p['img'] ?? ''),
            'slug' => (string) ($p['slug'] ?? ''),
        ];
    }

    return $rows;
}

/**
 * أسماء المنتجات لقائمة معرفات (من عمود doc).
 *
 * @param list<string> $ids
 * @return array<string,string>
 */
function pharma_product_names_by_ids(PDO $pdo, array $ids): array
{
    $ids = array_values(array_unique(array_filter($ids, static fn ($x) => $x !== '')));
    if ($ids === []) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $st = $pdo->prepare("SELECT id, doc FROM pharma_products WHERE id IN ({$placeholders})");
    $st->execute($ids);
    $out = [];
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $id = (string) $row['id'];
        $doc = json_decode((string) $row['doc'], true);
        $out[$id] = is_array($doc) ? (string) ($doc['name'] ?? $id) : $id;
    }

    return $out;
}

/**
 * إحصائيات للوحة التحكم: نقرات واتساب حسب الفترة + أكثر المنتجات طلباً
 *
 * @return array{whatsapp_clicks:int,whatsapp_orders:int,top_products:list<array{id:string,name:string,count:int}>,top_whatsapp_click_products:list<array{id:string,name:string,count:int}>}
 */
function pharma_admin_analytics_summary(int $days = 7): array
{
    $dbForTop = loadDB();
    $productsForTop = $dbForTop['products'] ?? [];
    $rankedFromDoc = static function (array $products): array {
        $ranked = [];
        foreach ($products as $p) {
            if (!is_array($p)) {
                continue;
            }
            $ranked[] = [
                'id'    => (string) ($p['id'] ?? ''),
                'name'  => (string) ($p['name'] ?? ''),
                'count' => (int) ($p['wa_order_count'] ?? 0),
            ];
        }
        usort($ranked, static fn ($a, $b) => $b['count'] <=> $a['count']);

        return array_slice($ranked, 0, 15);
    };

    if (getPdo() === null) {
        return [
            'whatsapp_clicks'             => 0,
            'whatsapp_orders'             => 0,
            'top_products'                => $rankedFromDoc($productsForTop),
            'top_whatsapp_click_products' => [],
        ];
    }

    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);
    $since = date('Y-m-d H:i:s', time() - max(1, $days) * 86400);

    $waClicks = 0;
    $waOrders = 0;
    $topWaClicks = [];
    try {
        $st = $pdo->prepare('SELECT COUNT(*) FROM pharma_whatsapp_clicks WHERE created_at >= ?');
        $st->execute([$since]);
        $waClicks = (int) $st->fetchColumn();

        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM pharma_analytics_events WHERE event_type = ? AND created_at >= ?'
        );
        $st->execute(['wa_order_intent', $since]);
        $waOrders = (int) $st->fetchColumn();

        $lim = 15;
        $st = $pdo->prepare(
            "SELECT product_id, COUNT(*) AS cnt FROM pharma_whatsapp_clicks WHERE created_at >= ? GROUP BY product_id ORDER BY cnt DESC LIMIT {$lim}"
        );
        $st->execute([$since]);
        $rows = [];
        while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
            $rows[] = [
                'product_id' => (string) $row['product_id'],
                'count'      => (int) $row['cnt'],
            ];
        }
        $ids = array_column($rows, 'product_id');
        $names = pharma_product_names_by_ids($pdo, $ids);
        foreach ($rows as $r) {
            $pid = $r['product_id'];
            $topWaClicks[] = [
                'id'    => $pid,
                'name'  => $names[$pid] ?? $pid,
                'count' => $r['count'],
            ];
        }
    } catch (Throwable $e) {
        error_log('[pharma_admin_analytics_summary] ' . $e->getMessage());
    }

    $top = $rankedFromDoc($productsForTop);

    return [
        'whatsapp_clicks'             => $waClicks,
        'whatsapp_orders'             => $waOrders,
        'top_products'                => $top,
        'top_whatsapp_click_products' => $topWaClicks,
    ];
}
