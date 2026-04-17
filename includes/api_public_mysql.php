<?php
/**
 * نقاط نهاية عامة: قراءة من MySQL عبر PDO فقط (جمل مُجهّزة).
 */
declare(strict_types=1);

/**
 * قراءة جسم الطلب الخام بدون file_get_contents (php://input كمجرى).
 */
function pharma_read_raw_request_body(): string
{
    $h = @fopen('php://input', 'rb');
    if ($h === false) {
        return '';
    }
    $data = stream_get_contents($h);
    fclose($h);

    return $data !== false ? $data : '';
}

/**
 * دمج معاملات الطلب العامة (GET يطغى على جسم JSON لنفس المفتاح).
 *
 * @param array<string,mixed> $bodySanitized
 * @return array<string,mixed>
 */
function pharma_api_public_params(array $bodySanitized): array
{
    return array_merge($bodySanitized, $_GET);
}

/**
 * شروط SQL للمنتجات العامة (فلترة في الخادم — لا تحميل كل الصفوف في الذاكرة).
 *
 * @param array<string,mixed> $params
 * @return array{0:string,1:list<mixed>}
 */
function pharma_api_products_public_where_sql(array $params): array
{
    $conds = [];
    $bind  = [];

    $activeOnly = (string) ($params['active'] ?? '1') === '1';
    if ($activeOnly) {
        $conds[] = 'NOT ('
            . 'JSON_EXTRACT(doc, \'$.active\') = JSON_EXTRACT(\'false\', \'$\')'
            . ' OR JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.active\')) IN (\'0\',\'false\')'
            . ')';
    }

    if ((string) ($params['home'] ?? '') === '1') {
        $conds[] = 'NOT ('
            . 'JSON_EXTRACT(doc, \'$.hide_from_home\') = JSON_EXTRACT(\'true\', \'$\')'
            . ' OR JSON_EXTRACT(doc, \'$.hide_from_home\') = true'
            . ' OR JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.hide_from_home\')) IN (\'1\',\'true\')'
            . ')';
    }

    $ptype = isset($params['product_type']) ? trim((string) $params['product_type']) : '';
    if ($ptype !== '') {
        $conds[] = 'JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.product_type\')) = ?';
        $bind[]  = $ptype;
    }

    if (isset($params['min_price']) && $params['min_price'] !== '') {
        $conds[] = 'CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.price\')),\'0\') AS DECIMAL(12,2)) >= ?';
        $bind[]  = (float) $params['min_price'];
    }
    if (isset($params['max_price']) && $params['max_price'] !== '') {
        $conds[] = 'CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.price\')),\'0\') AS DECIMAL(12,2)) <= ?';
        $bind[]  = (float) $params['max_price'];
    }

    $catSlug = isset($params['category']) ? trim((string) $params['category']) : '';
    if ($catSlug !== '') {
        $candidates = [$catSlug];
        if (function_exists('pharma_canonical_category_slug')) {
            $canon = pharma_canonical_category_slug($catSlug);
            if ($canon !== '' && $canon !== $catSlug) {
                $candidates[] = $canon;
            }
        }
        $paramId = ctype_digit(preg_replace('/\s+/u', '', $catSlug)) ? (string) (int) $catSlug : '';
        if ($paramId !== '') {
            $candidates[] = $paramId;
        }
        $seen = [];
        $uniq = [];
        foreach ($candidates as $c) {
            if ($c === '' || isset($seen[$c])) {
                continue;
            }
            $seen[$c] = true;
            $uniq[] = $c;
        }

        $orParts = [];
        foreach ($uniq as $c) {
            $orParts[] = '(JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.category\')) = ? OR JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.cat\')) = ?)';
            $bind[] = $c;
            $bind[] = $c;
            $jEnc = ctype_digit((string) $c) ? json_encode((int) $c, JSON_UNESCAPED_UNICODE) : json_encode($c, JSON_UNESCAPED_UNICODE);
            if ($jEnc !== false) {
                $orParts[] = 'JSON_CONTAINS(COALESCE(JSON_EXTRACT(doc, \'$.categories\'), JSON_EXTRACT(\'[]\', \'$\')), JSON_EXTRACT(?, \'$\'), \'$\')';
                $bind[]    = $jEnc;
            }
        }
        $conds[] = '(' . implode(' OR ', $orParts) . ')';
    }

    $where = $conds === [] ? '1=1' : implode(' AND ', $conds);

    return [$where, $bind];
}

/**
 * @param array<string,mixed> $params
 * @return array{products: list<array<string,mixed>>, pagination: array{page:int,per_page:int,total:int,total_pages:int}}
 */
function pharma_api_get_products_pdo(PDO $pdo, array $params): array
{
    pharma_ensure_schema($pdo);
    [$where, $bind] = pharma_api_products_public_where_sql($params);

    $sqlCount = 'SELECT COUNT(*) FROM pharma_products WHERE ' . $where;
    $stc      = $pdo->prepare($sqlCount);
    $stc->execute($bind);
    $total = (int) $stc->fetchColumn();

    $wantPage = isset($params['page']) || isset($params['per_page']) || isset($params['limit']);

    $fetchRows = static function (PDO $pdoConn, string $w, array $b, ?int $limit, ?int $offset): array {
        $sql = 'SELECT doc FROM pharma_products WHERE ' . $w . ' ORDER BY sort_order ASC, id ASC';
        $pb  = $b;
        if ($limit !== null) {
            $sql .= ' LIMIT ? OFFSET ?';
            $pb[] = $limit;
            $pb[] = $offset ?? 0;
        }
        $st = $pdoConn->prepare($sql);
        $st->execute($pb);
        $out = [];
        while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
            $p = json_decode((string) $row['doc'], true);
            if (is_array($p)) {
                $out[] = $p;
            }
        }

        return $out;
    };

    if (!$wantPage) {
        $products = $fetchRows($pdo, $where, $bind, null, null);

        return [
            'products'   => $products,
            'pagination' => [
                'page'        => 1,
                'per_page'    => $total,
                'total'       => $total,
                'total_pages' => $total > 0 ? 1 : 0,
            ],
        ];
    }

    $page       = max(1, (int) ($params['page'] ?? 1));
    $perPageRaw = $params['per_page'] ?? $params['limit'] ?? 50;
    $perPage    = max(1, min(100, (int) $perPageRaw));
    $offset     = ($page - 1) * $perPage;
    $products   = $fetchRows($pdo, $where, $bind, $perPage, $offset);
    $totalPages = $total > 0 ? (int) ceil($total / $perPage) : 0;

    return [
        'products'   => array_values($products),
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => $totalPages,
        ],
    ];
}

/**
 * منتج واحد بالمعرّف و/أو الـ slug (نشط فقط)، عبر PDO.
 * يُجرّب المعرّف أولاً ثم الـ slug إن وُجد ولم يُعثر على منتج.
 */
function pharma_api_get_product_pdo(PDO $pdo, ?string $id, ?string $slug): ?array
{
    pharma_ensure_schema($pdo);
    $id = $id !== null ? trim($id) : '';
    $slug = $slug !== null ? trim($slug) : '';

    if ($id !== '') {
        $st = $pdo->prepare('SELECT doc FROM pharma_products WHERE id = ? LIMIT 1');
        $st->execute([$id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $p = json_decode((string) $row['doc'], true);
            if (is_array($p) && ($p['active'] ?? true) !== false) {
                return $p;
            }
        }
    }

    if ($slug === '') {
        return null;
    }

    $bySlug = pharma_api_find_active_product_by_slug_pdo($pdo, $slug);

    return $bySlug;
}

/**
 * بحث منتج نشط بالـ slug (استعلام JSON ثم مسح احتياطي).
 */
function pharma_api_find_active_product_by_slug_pdo(PDO $pdo, string $slug): ?array
{
    pharma_ensure_schema($pdo);

    if (function_exists('pharma_products_slug_norm_available') && pharma_products_slug_norm_available($pdo)) {
        try {
            $st = $pdo->prepare(
                'SELECT doc FROM pharma_products WHERE slug_norm = LOWER(?) LIMIT 1'
            );
            $st->execute([$slug]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $p = json_decode((string) $row['doc'], true);
                if (is_array($p) && ($p['active'] ?? true) !== false) {
                    return $p;
                }
            }
        } catch (Throwable $e) {
            error_log('[pharma_api_find_active_product_by_slug_pdo slug_norm] ' . $e->getMessage());
        }
    }

    try {
        $st = $pdo->prepare(
            'SELECT doc FROM pharma_products WHERE JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.slug\')) = ? LIMIT 1'
        );
        $st->execute([$slug]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $p = json_decode((string) $row['doc'], true);
            if (is_array($p) && ($p['active'] ?? true) !== false) {
                return $p;
            }
        }
    } catch (Throwable $e) {
        error_log('[pharma_api_get_product_pdo JSON_EXTRACT] ' . $e->getMessage());
    }

    try {
        $st = $pdo->prepare(
            'SELECT doc FROM pharma_products WHERE LOWER(JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.slug\'))) = LOWER(?) LIMIT 1'
        );
        $st->execute([$slug]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $p = json_decode((string) $row['doc'], true);
            if (is_array($p) && ($p['active'] ?? true) !== false) {
                return $p;
            }
        }
    } catch (Throwable $e) {
        error_log('[pharma_api_get_product_pdo JSON LOWER] ' . $e->getMessage());
    }

    return null;
}

/**
 * @return list<array<string,mixed>>
 */
function pharma_api_get_categories_pdo(PDO $pdo, bool $activeOnly): array
{
    pharma_ensure_schema($pdo);
    if ($activeOnly) {
        $st = $pdo->prepare(
            'SELECT id, name, slug, icon, active, sort_order FROM pharma_categories WHERE active = 1 ORDER BY sort_order ASC, id ASC'
        );
        $st->execute();
    } else {
        $st = $pdo->prepare(
            'SELECT id, name, slug, icon, active, sort_order FROM pharma_categories ORDER BY sort_order ASC, id ASC'
        );
        $st->execute();
    }

    $cats = [];
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $rid = $row['id'];
        $cats[] = [
            'id' => is_numeric($rid) ? (int) $rid : $rid,
            'name' => $row['name'],
            'slug' => $row['slug'],
            'icon' => $row['icon'],
            'active' => (bool) (int) $row['active'],
            'order' => (int) $row['sort_order'],
        ];
    }

    return $cats;
}

/**
 * بحث مع ترقيم بعد تطبيق الفلاتر (نفس منطق pharma_db_search_products).
 *
 * @param array<string,mixed> $params
 * @return array{products: list<array<string,mixed>>, pagination: array{page:int,per_page:int,total:int,total_pages:int}, q: string}
 */
function pharma_api_search_products_paged(PDO $pdo, string $q, array $filters, array $params): array
{
    $list = pharma_db_search_products($pdo, $q, $filters);
    $total = count($list);
    $wantPage = isset($params['page']) || isset($params['per_page']);

    if (!$wantPage) {
        return [
            'products' => array_values($list),
            'pagination' => [
                'page' => 1,
                'per_page' => $total,
                'total' => $total,
                'total_pages' => $total > 0 ? 1 : 0,
            ],
            'q' => $q,
        ];
    }

    $page = max(1, (int) ($params['page'] ?? 1));
    $perPage = max(1, min(100, (int) ($params['per_page'] ?? 50)));
    $offset = ($page - 1) * $perPage;
    $slice = array_slice($list, $offset, $perPage);
    $totalPages = $total > 0 ? (int) ceil($total / $perPage) : 0;

    return [
        'products' => array_values($slice),
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => $totalPages,
        ],
        'q' => $q,
    ];
}
