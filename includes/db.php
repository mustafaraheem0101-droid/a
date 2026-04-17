<?php
/**
 * includes/db.php — تخزين MySQL عبر PDO (بدون ملفات JSON للبيانات)
 */
declare(strict_types=1);

require_once __DIR__ . '/../db.php';

// ── تشفير النسخ الاحتياطية (يستخدم SECRET_FILE من api.php) ─────────────

function getEncryptionKey(): string
{
    if (!defined('SECRET_FILE')) {
        throw new RuntimeException('SECRET_FILE غير معرّف');
    }
    if (file_exists(SECRET_FILE)) {
        $k = trim((string) file_get_contents(SECRET_FILE));
        if ($k !== '') {
            return $k;
        }
    }
    if (!is_dir(dirname(SECRET_FILE))) {
        mkdir(dirname(SECRET_FILE), 0700, true);
    }
    $key = bin2hex(random_bytes(32));
    file_put_contents(SECRET_FILE, $key, LOCK_EX);
    chmod(SECRET_FILE, 0600);

    return $key;
}

function encryptData(string $data): string
{
    $key  = hash('sha256', getEncryptionKey(), true);
    $iv   = random_bytes(16);
    $enc = openssl_encrypt($data, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    if ($enc === false) {
        throw new RuntimeException('فشل تشفير البيانات');
    }
    $hmac = hash_hmac('sha256', $iv . $enc, $key, true);

    return base64_encode($hmac . $iv . $enc);
}

function decryptData(string $data): ?string
{
    $raw = base64_decode($data, true);
    if ($raw === false || strlen($raw) < 48) {
        return null;
    }
    $key      = hash('sha256', getEncryptionKey(), true);
    $hmac     = substr($raw, 0, 32);
    $iv       = substr($raw, 32, 16);
    $enc      = substr($raw, 48);
    $expected = hash_hmac('sha256', $iv . $enc, $key, true);
    if (!hash_equals($hmac, $expected)) {
        return null;
    }

    return openssl_decrypt($enc, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
}

/**
 * ترقية أعمدة جدول التقييمات (آمنة عند التكرار).
 */
function pharma_reviews_table_migrate(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;
    $tbl = 'pharma_reviews';

    $addColumn = static function (PDO $pdo, string $table, string $col, string $ddl): void {
        try {
            $st = $pdo->prepare(
                'SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
            );
            $st->execute([$table, $col]);
            if ((int) $st->fetchColumn() > 0) {
                return;
            }
            $pdo->exec('ALTER TABLE `' . str_replace('`', '', $table) . '` ADD COLUMN ' . $ddl);
        } catch (Throwable $e) {
            error_log('[pharma_reviews_table_migrate] ' . $e->getMessage());
        }
    };

    $addColumn($pdo, $tbl, 'city', "city VARCHAR(80) NOT NULL DEFAULT '' AFTER name");
    $addColumn($pdo, $tbl, 'image_url', "image_url VARCHAR(512) NOT NULL DEFAULT '' AFTER comment");
    $addColumn($pdo, $tbl, 'pharmacist_reply', 'pharmacist_reply TEXT NULL DEFAULT NULL AFTER image_url');
}

function pharma_ensure_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_products (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        sort_order INT NOT NULL DEFAULT 0,
        doc LONGTEXT NOT NULL,
        KEY idx_products_sort (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_categories (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(190) NOT NULL,
        icon VARCHAR(64) NOT NULL DEFAULT \'\',
        active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        KEY idx_cat_sort (sort_order),
        KEY idx_cat_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_subcategories (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        parent VARCHAR(190) NOT NULL,
        icon VARCHAR(64) NOT NULL DEFAULT \'\',
        active TINYINT(1) NOT NULL DEFAULT 1,
        KEY idx_sub_parent (parent)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_settings (
        setting_key VARCHAR(190) NOT NULL PRIMARY KEY,
        val_json LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_orders (
        id VARCHAR(190) NOT NULL PRIMARY KEY,
        doc LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_reviews (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        product_id VARCHAR(64) NOT NULL,
        name VARCHAR(200) NOT NULL,
        city VARCHAR(80) NOT NULL DEFAULT \'\',
        rating TINYINT NOT NULL DEFAULT 5,
        comment TEXT NOT NULL,
        image_url VARCHAR(512) NOT NULL DEFAULT \'\',
        pharmacist_reply TEXT NULL,
        date DATE NOT NULL,
        verified TINYINT(1) NOT NULL DEFAULT 0,
        approved TINYINT(1) NOT NULL DEFAULT 0,
        helpful_up INT NOT NULL DEFAULT 0,
        helpful_down INT NOT NULL DEFAULT 0,
        KEY idx_rev_product (product_id),
        KEY idx_rev_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    pharma_reviews_table_migrate($pdo);

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_rate_limit (
        ip VARCHAR(45) NOT NULL PRIMARY KEY,
        req_count INT NOT NULL DEFAULT 0,
        window_start INT UNSIGNED NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_login_attempts (
        ip VARCHAR(45) NOT NULL PRIMARY KEY,
        fail_count INT NOT NULL DEFAULT 0,
        updated_at INT UNSIGNED NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_blocked_ips (
        ip VARCHAR(45) NOT NULL PRIMARY KEY,
        until_ts BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_label VARCHAR(64) NOT NULL DEFAULT \'\'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_review_rate (
        rate_key CHAR(64) NOT NULL PRIMARY KEY,
        last_ts INT UNSIGNED NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_backups (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload LONGTEXT NOT NULL,
        KEY idx_backup_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_analytics_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(40) NOT NULL,
        product_id VARCHAR(64) NOT NULL DEFAULT \'\',
        payload TEXT,
        ip_hash CHAR(64) NOT NULL DEFAULT \'\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_analytics_type_time (event_type, created_at),
        KEY idx_analytics_product (product_id),
        KEY idx_analytics_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    /* نقرات واتساب لكل منتج — صفوف بسيطة فقط (بدون JSON) */
    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_whatsapp_clicks (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_wa_clk_product (product_id),
        KEY idx_wa_clk_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_password_reset_tokens (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        token_hash CHAR(64) NOT NULL,
        expires_at INT UNSIGNED NOT NULL,
        created_at INT UNSIGNED NOT NULL,
        UNIQUE KEY uk_pwd_reset_hash (token_hash),
        KEY idx_pwd_reset_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS pharma_forgot_rate (
        ip VARCHAR(45) NOT NULL PRIMARY KEY,
        req_count INT NOT NULL DEFAULT 0,
        window_start INT UNSIGNED NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    pharma_products_ensure_slug_norm_column($pdo);
}

/**
 * عمود مُشتق + فهرس للـ slug داخل JSON (للبحث دون مسح الجدول بالكامل).
 */
function pharma_products_ensure_slug_norm_column(PDO $pdo): void
{
    static $tried = false;
    if ($tried) {
        return;
    }
    $tried = true;
    try {
        $chk = $pdo->query("SHOW COLUMNS FROM pharma_products LIKE 'slug_norm'");
        if ($chk !== false && $chk->rowCount() > 0) {
            return;
        }
        $pdo->exec(
            'ALTER TABLE pharma_products
             ADD COLUMN slug_norm VARCHAR(190)
             GENERATED ALWAYS AS (LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(doc, \'$.slug\')),\'\')))) STORED,
             ADD KEY idx_products_slug_norm (slug_norm)'
        );
    } catch (Throwable $e) {
        error_log('[pharma_products_ensure_slug_norm_column] ' . $e->getMessage());
    }
}

function pharma_products_slug_norm_available(PDO $pdo): bool
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $cache = false;
    try {
        $chk = $pdo->query("SHOW COLUMNS FROM pharma_products LIKE 'slug_norm'");
        if ($chk !== false && $chk->rowCount() > 0) {
            $cache = true;
        }
    } catch (Throwable $e) {
        $cache = false;
    }

    return $cache;
}

function pharma_json_flags(): int
{
    $f = JSON_UNESCAPED_UNICODE;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $f |= JSON_INVALID_UTF8_SUBSTITUTE;
    }

    return $f;
}

/** مفاتيح الجذر المسموح تعديلها في التخزين الكامل */
function pharma_valid_store_field(string $field): bool
{
    return in_array($field, ['products', 'categories', 'subcategories', 'settings', 'orders'], true);
}

/**
 * قفل استشاري + معاملة كتابة (تقليل تكرار saveDBSafe / db_update_*).
 *
 * @param callable(PDO):void $fn يبدأ معاملة ويثبتها داخلياً
 */
function pharma_run_locked_tx(callable $fn, string $lockWarnContext = ''): bool
{
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);
    if (!pharma_acquire_db_lock($pdo) && $lockWarnContext !== '' && function_exists('logActivity')) {
        logActivity('WARN', $lockWarnContext);
    }
    try {
        $fn($pdo);

        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[pharma_run_locked_tx] ' . $e->getMessage());

        return false;
    } finally {
        pharma_release_db_lock($pdo);
    }
}

/**
 * @return array{products: list<array>, categories: list<array>, subcategories: list<array>, settings: array<string,mixed>, orders: list<array>}
 */
function pharma_assemble_db(PDO $pdo): array
{
    pharma_ensure_schema($pdo);

    $db = [
        'products'      => [],
        'categories'    => [],
        'subcategories' => [],
        'settings'      => [],
        'orders'        => [],
    ];

    $st = $pdo->prepare('SELECT id, doc FROM pharma_products ORDER BY sort_order ASC, id ASC');
    $st->execute();
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $p = json_decode((string) $row['doc'], true);
        if (is_array($p)) {
            $db['products'][] = $p;
        }
    }

    $st = $pdo->prepare('SELECT id, name, slug, icon, active, sort_order FROM pharma_categories ORDER BY sort_order ASC, id ASC');
    $st->execute();
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $rid = $row['id'];
        $db['categories'][] = [
            'id'     => is_numeric($rid) ? (int) $rid : $rid,
            'name'   => $row['name'],
            'slug'   => $row['slug'],
            'icon'   => $row['icon'],
            'active' => (bool) (int) $row['active'],
            'order'  => (int) $row['sort_order'],
        ];
    }

    $st = $pdo->prepare('SELECT id, name, parent, icon, active FROM pharma_subcategories ORDER BY id ASC');
    $st->execute();
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $sid = $row['id'];
        $db['subcategories'][] = [
            'id'     => is_numeric($sid) ? (int) $sid : $sid,
            'name'   => $row['name'],
            'parent' => $row['parent'],
            'icon'   => $row['icon'],
            'active' => (bool) (int) $row['active'],
        ];
    }

    $st = $pdo->prepare('SELECT setting_key, val_json FROM pharma_settings');
    $st->execute();
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $k = (string) $row['setting_key'];
        if ($k === '') {
            continue;
        }
        $decoded = json_decode((string) $row['val_json'], true);
        $db['settings'][$k] = $decoded;
    }

    $st = $pdo->prepare('SELECT id, doc FROM pharma_orders ORDER BY id ASC');
    $st->execute();
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $o = json_decode((string) $row['doc'], true);
        if (is_array($o)) {
            $db['orders'][] = $o;
        }
    }

    return $db;
}

function pharma_persist_full(PDO $pdo, array $db): void
{
    pharma_ensure_schema($pdo);

    $flags = pharma_json_flags() | JSON_PRESERVE_ZERO_FRACTION;

    $ownTx = !$pdo->inTransaction();
    if ($ownTx) {
        $pdo->beginTransaction();
    }
    try {

    $pdo->exec('DELETE FROM pharma_products');
    $insP = $pdo->prepare('INSERT INTO pharma_products (id, sort_order, doc) VALUES (?,?,?)');
    $ord  = 0;
    foreach ($db['products'] ?? [] as $p) {
        if (!is_array($p)) {
            continue;
        }
        $id = (string) ($p['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $json = json_encode($p, $flags);
        if ($json === false) {
            continue;
        }
        $insP->execute([$id, $ord++, $json]);
    }

    $pdo->exec('DELETE FROM pharma_categories');
    $insC = $pdo->prepare('INSERT INTO pharma_categories (id, name, slug, icon, active, sort_order) VALUES (?,?,?,?,?,?)');
    foreach ($db['categories'] ?? [] as $c) {
        if (!is_array($c)) {
            continue;
        }
        $cid = (string) ($c['id'] ?? '');
        if ($cid === '') {
            continue;
        }
        $insC->execute([
            $cid,
            (string) ($c['name'] ?? ''),
            (string) ($c['slug'] ?? ''),
            (string) ($c['icon'] ?? ''),
            !empty($c['active']) ? 1 : 0,
            (int) ($c['order'] ?? 0),
        ]);
    }

    $pdo->exec('DELETE FROM pharma_subcategories');
    $insS = $pdo->prepare('INSERT INTO pharma_subcategories (id, name, parent, icon, active) VALUES (?,?,?,?,?)');
    foreach ($db['subcategories'] ?? [] as $s) {
        if (!is_array($s)) {
            continue;
        }
        $sid = (string) ($s['id'] ?? '');
        if ($sid === '') {
            continue;
        }
        $insS->execute([
            $sid,
            (string) ($s['name'] ?? ''),
            (string) ($s['parent'] ?? ''),
            (string) ($s['icon'] ?? ''),
            !empty($s['active']) ? 1 : 0,
        ]);
    }

    $pdo->exec('DELETE FROM pharma_settings');
    $insSet = $pdo->prepare('INSERT INTO pharma_settings (setting_key, val_json) VALUES (?,?)');
    foreach ($db['settings'] ?? [] as $k => $v) {
        if (!is_string($k) || $k === '') {
            continue;
        }
        $jv = json_encode($v, $flags);
        if ($jv === false) {
            continue;
        }
        $insSet->execute([$k, $jv]);
    }

    $pdo->exec('DELETE FROM pharma_orders');
    $insO = $pdo->prepare('INSERT INTO pharma_orders (id, doc) VALUES (?,?)');
    foreach ($db['orders'] ?? [] as $o) {
        if (!is_array($o)) {
            continue;
        }
        $oid = (string) ($o['id'] ?? '');
        if ($oid === '') {
            $oid = 'ord_' . bin2hex(random_bytes(8));
            $o['id'] = $oid;
        }
        $jo = json_encode($o, $flags);
        if ($jo === false) {
            continue;
        }
        $insO->execute([$oid, $jo]);
    }

        if ($ownTx) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($ownTx && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/**
 * GET_LOCK عبر معاملات مربوطة يفشل على بعض إصدارات MariaDB/MySQL مع PDO — نستخدم اسم قفل ثابتاً.
 */
function pharma_acquire_db_lock(PDO $pdo): bool
{
    try {
        $r = $pdo->query("SELECT GET_LOCK('pharma_db_write', 15)");
        if ($r === false) {
            return false;
        }
        $v = $r->fetchColumn();

        return (int) $v === 1;
    } catch (PDOException $e) {
        error_log('[pharma_acquire_db_lock] ' . $e->getMessage());

        return false;
    }
}

function pharma_release_db_lock(PDO $pdo): void
{
    try {
        $pdo->query("SELECT RELEASE_LOCK('pharma_db_write')");
    } catch (PDOException $e) {
        // تجاهل: الاتصال قد يكون أُغلق
    }
}

function db_read_raw(): array
{
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);

    return pharma_assemble_db($pdo);
}

function loadDB(): array
{
    $db = null;
    try {
        if (getPdo() !== null) {
            $db = db_read_raw();
        }
    } catch (Throwable $e) {
        error_log('[loadDB] ' . $e->getMessage());
    }
    if ($db === null || !is_array($db)) {
        $db = getDefaultDB();
    }

    $changed = false;
    normalizeDB($db, $changed);
    normalizeSubcategories($db, $changed);
    pruneProductSubcategoryRefs($db, $changed);
    ensureMinimumSubcategoriesPerMain($db, $changed);

    if ($changed && getPdo() !== null) {
        try {
            saveDBSafe($db);
        } catch (Throwable $e) {
            error_log('[loadDB] saveDBSafe: ' . $e->getMessage());
        }
    }

    return $db;
}

function saveDB(array $data): void
{
    saveDBSafe($data);
}

function saveDBSafe(array $data, bool $merge = false): bool
{
    return pharma_run_locked_tx(static function (PDO $pdo) use ($data, $merge): void {
        $payload = $data;
        if ($merge) {
            $payload = array_merge(pharma_assemble_db($pdo), $payload);
        }
        pharma_persist_full($pdo, $payload);
    }, 'GET_LOCK pharma_db_write فشل');
}

function db_update_field(string $field, $value): bool
{
    if (!pharma_valid_store_field($field)) {
        return false;
    }

    return pharma_run_locked_tx(static function (PDO $pdo) use ($field, $value): void {
        $db         = pharma_assemble_db($pdo);
        $db[$field] = $value;
        pharma_persist_full($pdo, $db);
    }, "db_update_field({$field}) فشل القفل");
}

function db_update_field_callback(string $field, callable $callback): bool
{
    if (!pharma_valid_store_field($field)) {
        return false;
    }

    return pharma_run_locked_tx(static function (PDO $pdo) use ($field, $callback): void {
        $db         = pharma_assemble_db($pdo);
        $db[$field] = $callback($db[$field] ?? []);
        pharma_persist_full($pdo, $db);
    }, "db_update_field_callback({$field}) فشل القفل");
}

/* ── طلبات pharma_orders فقط (بدون إعادة كتابة المنتجات/الأقسام) ── */

/**
 * @return list<array<string,mixed>>
 */
function pharma_orders_load_all(PDO $pdo): array
{
    pharma_ensure_schema($pdo);
    $out = [];
    $st  = $pdo->prepare('SELECT id, doc FROM pharma_orders ORDER BY id ASC');
    $st->execute();
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $o = json_decode((string) ($row['doc'] ?? ''), true);
        if (is_array($o)) {
            $out[] = $o;
        }
    }

    return $out;
}

function pharma_orders_count(PDO $pdo): int
{
    pharma_ensure_schema($pdo);
    $n = $pdo->query('SELECT COUNT(*) FROM pharma_orders');
    if ($n === false) {
        return 0;
    }

    return (int) $n->fetchColumn();
}

function pharma_order_upsert_row(PDO $pdo, array $order): void
{
    pharma_ensure_schema($pdo);
    $id = (string) ($order['id'] ?? '');
    if ($id === '') {
        throw new InvalidArgumentException('طلب بدون معرف');
    }
    $flags = pharma_json_flags() | JSON_PRESERVE_ZERO_FRACTION;
    $json  = json_encode($order, $flags);
    if ($json === false) {
        throw new RuntimeException('فشل ترميز JSON للطلب');
    }
    $st = $pdo->prepare(
        'INSERT INTO pharma_orders (id, doc) VALUES (?,?)
         ON DUPLICATE KEY UPDATE doc = VALUES(doc)'
    );
    $st->execute([$id, $json]);
}

function pharma_orders_next_numeric_id(PDO $pdo): string
{
    pharma_ensure_schema($pdo);
    try {
        $st = $pdo->query(
            "SELECT COALESCE(MAX(CAST(id AS UNSIGNED)), 1000) + 1 AS nxt FROM pharma_orders WHERE id REGEXP '^[0-9]+$'"
        );
        if ($st === false) {
            return '1001';
        }
        $n = (int) $st->fetchColumn();

        return (string) ($n > 0 ? $n : 1001);
    } catch (Throwable $e) {
        error_log('[pharma_orders_next_numeric_id] ' . $e->getMessage());

        return '1001';
    }
}

function pharma_order_delete_row(PDO $pdo, string $id): bool
{
    pharma_ensure_schema($pdo);
    $st = $pdo->prepare('DELETE FROM pharma_orders WHERE id = ?');
    $st->execute([$id]);

    return $st->rowCount() > 0;
}

/**
 * دمج حالة جديدة في JSON عمود doc (منطق خالص — يُختبر بدون قاعدة).
 *
 * @return non-empty-string|null JSON جديد أو null عند تعذر فك/إعادة ترميز المستند
 */
function pharma_order_status_merge_doc_json(string $docJson, string $status): ?string
{
    $doc = json_decode($docJson, true);
    if (!is_array($doc)) {
        return null;
    }
    $doc['status']     = $status;
    $doc['updated_at'] = date('Y-m-d H:i:s');
    $flags             = pharma_json_flags() | JSON_PRESERVE_ZERO_FRACTION;
    $json              = json_encode($doc, $flags);
    if ($json === false) {
        return null;
    }

    return $json;
}

/**
 * تحديث حالة طلب في pharma_orders فقط (قراءة/تعديل صف واحد).
 *
 * @return bool true عند نجاح التحديث، false إذا لم يُعثر على الطلب أو فشل القفل/المعاملة
 */
function pharma_order_update_status_mysql(string $orderId, string $status): bool
{
    if (!in_array($status, ['pending', 'shipped', 'delivered', 'cancelled'], true)) {
        return false;
    }
    $found = false;
    $ok    = pharma_run_locked_tx(static function (PDO $pdo) use ($orderId, $status, &$found): void {
        $pdo->beginTransaction();
        $st = $pdo->prepare('SELECT doc FROM pharma_orders WHERE id = ? FOR UPDATE');
        $st->execute([$orderId]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            $pdo->rollBack();

            return;
        }
        $json = pharma_order_status_merge_doc_json((string) $row['doc'], $status);
        if ($json === null) {
            $pdo->rollBack();

            return;
        }
        $up = $pdo->prepare('UPDATE pharma_orders SET doc = ? WHERE id = ?');
        $up->execute([$json, $orderId]);
        $found = true;
        $pdo->commit();
    }, 'pharma_order_update_status_mysql');

    return $ok && $found;
}

/**
 * إنشاء طلب يدوي في pharma_orders فقط.
 *
 * @param array<string,mixed> $body
 * @return array<string,mixed>|null الطلب المُنشأ أو null عند فشل القفل
 */
function pharma_orders_create_manual_mysql(array $body, string $phone): ?array
{
    $order = null;
    $ok    = pharma_run_locked_tx(static function (PDO $pdo) use ($body, $phone, &$order): void {
        $pdo->beginTransaction();
        $text = static function (mixed $v): string {
            if (!is_string($v)) {
                $v = '';
            }
            if (function_exists('sanitizeInput')) {
                return (string) sanitizeInput($v);
            }

            return strip_tags(str_replace("\0", '', trim($v)));
        };
        $id = pharma_orders_next_numeric_id($pdo);
        $order = [
            'id'            => $id,
            'created_at'    => date('Y-m-d H:i:s'),
            'customer_name' => $text($body['customer_name'] ?? ''),
            'phone'         => $phone,
            'address'       => $text($body['address'] ?? ''),
            'notes'         => $text($body['notes'] ?? ''),
            'items_summary' => $text($body['items_summary'] ?? ''),
            'total'         => max(0, (float) ($body['total'] ?? 0)),
            'status'        => 'pending',
            'source'        => 'manual',
        ];
        pharma_order_upsert_row($pdo, $order);
        $pdo->commit();
    }, 'pharma_orders_create_manual_mysql');

    return ($ok && is_array($order)) ? $order : null;
}

function loadReviews(): array
{
    if (getPdo() === null) {
        return [];
    }
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);
    $st = $pdo->prepare(
        'SELECT id, product_id, name, city, rating, comment, image_url, pharmacist_reply, date, verified, approved, helpful_up, helpful_down
         FROM pharma_reviews ORDER BY date DESC, id DESC'
    );
    $st->execute();
    $out = [];
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $out[] = [
            'id'                => $row['id'],
            'product_id'        => $row['product_id'],
            'name'              => $row['name'],
            'city'              => $row['city'] ?? '',
            'rating'            => (int) $row['rating'],
            'comment'           => $row['comment'],
            'image_url'         => $row['image_url'] ?? '',
            'pharmacist_reply'  => isset($row['pharmacist_reply']) && $row['pharmacist_reply'] !== null ? (string) $row['pharmacist_reply'] : '',
            'date'              => $row['date'],
            'verified'          => (bool) (int) $row['verified'],
            'approved'          => (bool) (int) $row['approved'],
            'helpful_up'        => (int) $row['helpful_up'],
            'helpful_down'      => (int) $row['helpful_down'],
        ];
    }

    return $out;
}

function saveReviews(array $reviews): bool
{
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);

    try {
        $pdo->beginTransaction();
        $ids = [];
        foreach ($reviews as $r) {
            if (!is_array($r)) {
                continue;
            }
            $id = (string) ($r['id'] ?? '');
            if ($id !== '') {
                $ids[] = $id;
            }
        }
        if ($ids !== []) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $pdo->prepare("DELETE FROM pharma_reviews WHERE id NOT IN ({$placeholders})")->execute($ids);
        } else {
            $pdo->exec('DELETE FROM pharma_reviews');
        }

        $upsert = $pdo->prepare(
            'INSERT INTO pharma_reviews (id, product_id, name, city, rating, comment, image_url, pharmacist_reply, date, verified, approved, helpful_up, helpful_down)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               product_id = VALUES(product_id),
               name = VALUES(name),
               city = VALUES(city),
               rating = VALUES(rating),
               comment = VALUES(comment),
               image_url = VALUES(image_url),
               pharmacist_reply = VALUES(pharmacist_reply),
               date = VALUES(date),
               verified = VALUES(verified),
               approved = VALUES(approved),
               helpful_up = VALUES(helpful_up),
               helpful_down = VALUES(helpful_down)'
        );
        foreach ($reviews as $r) {
            if (!is_array($r)) {
                continue;
            }
            $id = (string) ($r['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $reply = $r['pharmacist_reply'] ?? null;
            $upsert->execute([
                $id,
                (string) ($r['product_id'] ?? ''),
                (string) ($r['name'] ?? ''),
                (string) ($r['city'] ?? ''),
                max(1, min(5, (int) ($r['rating'] ?? 5))),
                (string) ($r['comment'] ?? ''),
                (string) ($r['image_url'] ?? ''),
                ($reply !== null && $reply !== '') ? (string) $reply : null,
                preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($r['date'] ?? '')) ? $r['date'] : date('Y-m-d'),
                !empty($r['verified']) ? 1 : 0,
                !empty($r['approved']) ? 1 : 0,
                max(0, (int) ($r['helpful_up'] ?? 0)),
                max(0, (int) ($r['helpful_down'] ?? 0)),
            ]);
        }
        $pdo->commit();

        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[saveReviews] ' . $e->getMessage());

        return false;
    }
}

/**
 * معرّف منتج آمن لربط المراجعة (يتوافق مع عمود pharma_products.id).
 */
function pharma_sanitize_product_id_for_review(string $id): string
{
    return preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
}

/**
 * هل يوجد المنتج في pharma_products؟
 */
function pharma_db_product_exists(PDO $pdo, string $productId): bool
{
    pharma_ensure_schema($pdo);
    $st = $pdo->prepare('SELECT 1 FROM pharma_products WHERE id = ? LIMIT 1');
    $st->execute([$productId]);

    return (bool) $st->fetchColumn();
}

/**
 * تقييمات منتج واحد من MySQL (أعمدة، بدون JSON).
 *
 * @return list<array<string,mixed>>
 */
function pharma_db_fetch_reviews_for_product(PDO $pdo, string $productId, bool $approvedOnly): array
{
    pharma_ensure_schema($pdo);
    if ($approvedOnly) {
        $st = $pdo->prepare(
            'SELECT id, product_id, name, city, rating, comment, image_url, pharmacist_reply, date, verified, approved, helpful_up, helpful_down
             FROM pharma_reviews WHERE product_id = ? AND approved = 1 ORDER BY date DESC, id DESC'
        );
    } else {
        $st = $pdo->prepare(
            'SELECT id, product_id, name, city, rating, comment, image_url, pharmacist_reply, date, verified, approved, helpful_up, helpful_down
             FROM pharma_reviews WHERE product_id = ? ORDER BY date DESC, id DESC'
        );
    }
    $st->execute([$productId]);
    $out = [];
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $out[] = [
            'id'               => $row['id'],
            'product_id'       => $row['product_id'],
            'name'             => $row['name'],
            'city'             => $row['city'] ?? '',
            'rating'           => (int) $row['rating'],
            'comment'          => $row['comment'],
            'image_url'        => $row['image_url'] ?? '',
            'pharmacist_reply' => isset($row['pharmacist_reply']) && $row['pharmacist_reply'] !== null ? (string) $row['pharmacist_reply'] : '',
            'date'             => $row['date'],
            'verified'         => (bool) (int) $row['verified'],
            'approved'         => (bool) (int) $row['approved'],
            'helpful_up'       => (int) $row['helpful_up'],
            'helpful_down'     => (int) $row['helpful_down'],
        ];
    }

    return $out;
}

/**
 * @return array{count:int,average:float|null}
 */
function pharma_db_review_stats_for_product(PDO $pdo, string $productId): array
{
    pharma_ensure_schema($pdo);
    $st = $pdo->prepare(
        'SELECT COUNT(*), AVG(rating) FROM pharma_reviews WHERE product_id = ? AND approved = 1'
    );
    $st->execute([$productId]);
    $row = $st->fetch(PDO::FETCH_NUM);
    $count = (int) ($row[0] ?? 0);
    $avgRaw = $row[1] ?? null;
    $average = ($count > 0 && $avgRaw !== null) ? round((float) $avgRaw, 1) : null;

    return ['count' => $count, 'average' => $average];
}

/**
 * إدراج مراجعة واحدة (INSERT مُجهّز) — لا يمس باقي الصفوف.
 */
function pharma_db_insert_review(
    PDO $pdo,
    string $productId,
    string $name,
    string $city,
    int $rating,
    string $comment,
    string $imageUrl = ''
): ?string {
    pharma_ensure_schema($pdo);
    $id = 'r' . bin2hex(random_bytes(8));
    $rating = max(1, min(5, $rating));
    $today = date('Y-m-d');
    try {
        $st = $pdo->prepare(
            'INSERT INTO pharma_reviews (id, product_id, name, city, rating, comment, image_url, date, verified, approved, helpful_up, helpful_down)
             VALUES (?,?,?,?,?,?,?,?,0,0,0,0)'
        );
        if (!$st->execute([$id, $productId, $name, $city, $rating, $comment, $imageUrl, $today])) {
            return null;
        }
    } catch (Throwable $e) {
        error_log('[pharma_db_insert_review] ' . $e->getMessage());

        return null;
    }

    return $id;
}

/**
 * تصويت مفيد على مراجعة معتمدة (UPDATE واحد).
 *
 * @return array{helpful_up:int,helpful_down:int}|null
 */
function pharma_db_review_vote(PDO $pdo, string $reviewId, string $dir): ?array
{
    if (!in_array($dir, ['up', 'down'], true)) {
        return null;
    }
    pharma_ensure_schema($pdo);
    $col = $dir === 'up' ? 'helpful_up' : 'helpful_down';
    try {
        $sql = "UPDATE pharma_reviews SET `{$col}` = `{$col}` + 1 WHERE id = ? AND approved = 1";
        $st = $pdo->prepare($sql);
        $st->execute([$reviewId]);
        if ($st->rowCount() < 1) {
            return null;
        }
        $st2 = $pdo->prepare('SELECT helpful_up, helpful_down FROM pharma_reviews WHERE id = ? LIMIT 1');
        $st2->execute([$reviewId]);
        $row = $st2->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        return [
            'helpful_up'   => (int) $row['helpful_up'],
            'helpful_down' => (int) $row['helpful_down'],
        ];
    } catch (Throwable $e) {
        error_log('[pharma_db_review_vote] ' . $e->getMessage());

        return null;
    }
}

function checkReviewSubmitRateLimit(string $ip, string $productId): bool
{
    $pid = preg_replace('/[^a-zA-Z0-9_-]/', '', $productId);
    if ($pid === '') {
        return false;
    }
    $key = hash('sha256', $ip . '|' . $pid);

    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);

    $now = time();
    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare('SELECT last_ts FROM pharma_review_rate WHERE rate_key = ? FOR UPDATE');
        $st->execute([$key]);
        $row   = $st->fetch(PDO::FETCH_ASSOC);
        $last  = $row ? (int) $row['last_ts'] : 0;
        if ($last > 0 && ($now - $last) < 180) {
            $pdo->rollBack();

            return false;
        }
        $pdo->prepare('INSERT INTO pharma_review_rate (rate_key, last_ts) VALUES (?,?) ON DUPLICATE KEY UPDATE last_ts = VALUES(last_ts)')->execute([$key, $now]);
        $pdo->prepare('DELETE FROM pharma_review_rate WHERE last_ts < ?')->execute([$now - 86400]);
        $pdo->commit();

        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[checkReviewSubmitRateLimit] ' . $e->getMessage());

        return false;
    }
}

/**
 * حد أدنى بين عمليات رفع صور التقييم لنفس عنوان IP (ثوانٍ).
 */
function checkReviewImageUploadRateLimit(string $ip): bool
{
    $key = 'upl_' . hash('sha256', $ip);

    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);

    $now = time();
    $minGap = 35;
    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare('SELECT last_ts FROM pharma_review_rate WHERE rate_key = ? FOR UPDATE');
        $st->execute([$key]);
        $row  = $st->fetch(PDO::FETCH_ASSOC);
        $last = $row ? (int) $row['last_ts'] : 0;
        if ($last > 0 && ($now - $last) < $minGap) {
            $pdo->rollBack();

            return false;
        }
        $pdo->prepare('INSERT INTO pharma_review_rate (rate_key, last_ts) VALUES (?,?) ON DUPLICATE KEY UPDATE last_ts = VALUES(last_ts)')->execute([$key, $now]);
        $pdo->prepare('DELETE FROM pharma_review_rate WHERE last_ts < ?')->execute([$now - 86400]);
        $pdo->commit();

        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[checkReviewImageUploadRateLimit] ' . $e->getMessage());

        return false;
    }
}

function createBackup(bool $encrypt = true): string
{
    $db   = loadDB();
    $json = json_encode($db, pharma_json_flags() | JSON_PRETTY_PRINT);
    if ($json === false) {
        throw new RuntimeException('createBackup: json_encode فشل');
    }
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);
    $payload = $encrypt ? encryptData($json) : $json;
    $pdo->prepare('INSERT INTO pharma_backups (payload) VALUES (?)')->execute([$payload]);
    $id = (int) $pdo->lastInsertId();
    $stKeep = $pdo->prepare('SELECT id FROM pharma_backups ORDER BY created_at DESC, id DESC LIMIT 14');
    $stKeep->execute();
    $keep = $stKeep->fetchAll(PDO::FETCH_COLUMN);
    if (is_array($keep) && $keep !== []) {
        $ph = implode(',', array_fill(0, count($keep), '?'));
        $pdo->prepare("DELETE FROM pharma_backups WHERE id NOT IN ($ph)")->execute($keep);
    }
    if (function_exists('logActivity')) {
        logActivity('BACKUP', 'تم إنشاء نسخة احتياطية في MySQL: mysql_backup_' . $id);
    }

    return 'mysql_backup_' . $id;
}

// ── أمان: حظر IP، حد الطلبات، محاولات الدخول ───────────────────────────

function pharma_ip_is_blocked(string $ip): bool
{
    try {
        $pdo = pharma_require_pdo();
        pharma_ensure_schema($pdo);
        $st = $pdo->prepare('SELECT until_ts FROM pharma_blocked_ips WHERE ip = ?');
        $st->execute([$ip]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return false;
        }
        $until = (int) $row['until_ts'];
        $now   = time();
        if ($until !== 0 && $now >= $until) {
            try {
                pharma_ip_unblock($ip);
            } catch (Throwable $e) {
                error_log('[pharma_ip_unblock] ' . $e->getMessage());
            }

            return false;
        }

        return true;
    } catch (Throwable $e) {
        error_log('[pharma_ip_is_blocked] ' . $e->getMessage());

        return false;
    }
}

function pharma_ip_block(string $ip, int $duration): void
{
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);
    $until = $duration === 0 ? 0 : time() + $duration;
    $label = date('Y-m-d H:i:s');
    $pdo->prepare('INSERT INTO pharma_blocked_ips (ip, until_ts, created_label) VALUES (?,?,?) ON DUPLICATE KEY UPDATE until_ts = VALUES(until_ts), created_label = VALUES(created_label)')
        ->execute([$ip, $until, $label]);
    if (function_exists('logActivity')) {
        logActivity('BLOCK', "حظر IP: $ip", $ip);
    }
}

function pharma_ip_unblock(string $ip): void
{
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);
    $pdo->prepare('DELETE FROM pharma_blocked_ips WHERE ip = ?')->execute([$ip]);
}

/**
 * خطوة عدّاد المعدّل بعد قراءة الصف (منطق خالص — يُختبر بدون قاعدة).
 *
 * @param array<string,mixed>|null $row صف pharma_rate_limit أو null عند غياب السجل
 *
 * @return array{count:int, window_start:int, exceeded:bool, is_new:bool}
 */
function pharma_rate_limit_compute(?array $row, int $now, int $rateWindow, int $maxRequests): array
{
    if ($row === null || $row === []) {
        return ['count' => 1, 'window_start' => $now, 'exceeded' => false, 'is_new' => true];
    }
    $count = (int) ($row['req_count'] ?? 0);
    $first = (int) ($row['window_start'] ?? 0);
    if ($now - $first > $rateWindow) {
        return ['count' => 1, 'window_start' => $now, 'exceeded' => false, 'is_new' => false];
    }
    $count++;
    $exceeded = $count > $maxRequests;

    return ['count' => $count, 'window_start' => $first, 'exceeded' => $exceeded, 'is_new' => false];
}

function pharma_rate_limit_check(string $ip): bool
{
    if (!defined('RATE_WINDOW') || !defined('MAX_REQUESTS') || !defined('BLOCK_DURATION')) {
        return true;
    }

    $pdo = null;
    try {
        $pdo = pharma_require_pdo();
        pharma_ensure_schema($pdo);
        $now = time();

        $pdo->beginTransaction();
        $st = $pdo->prepare('SELECT req_count, window_start FROM pharma_rate_limit WHERE ip = ? FOR UPDATE');
        $st->execute([$ip]);
        $row = $st->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            $next = pharma_rate_limit_compute(null, $now, (int) RATE_WINDOW, (int) MAX_REQUESTS);
            $pdo->prepare('INSERT INTO pharma_rate_limit (ip, req_count, window_start) VALUES (?,?,?)')->execute([$ip, $next['count'], $next['window_start']]);
            $pdo->commit();

            return true;
        }

        $next = pharma_rate_limit_compute($row, $now, (int) RATE_WINDOW, (int) MAX_REQUESTS);
        $pdo->prepare('UPDATE pharma_rate_limit SET req_count = ?, window_start = ? WHERE ip = ?')->execute([$next['count'], $next['window_start'], $ip]);
        $pdo->commit();

        if ($next['exceeded']) {
            $rlBlock = defined('RATE_LIMIT_BLOCK_DURATION') ? (int) RATE_LIMIT_BLOCK_DURATION : 0;
            if ($rlBlock > 0) {
                try {
                    pharma_ip_block($ip, $rlBlock);
                } catch (Throwable $e) {
                    error_log('[pharma_ip_block] ' . $e->getMessage());
                }
            }
            if (function_exists('logFailed')) {
                logFailed('Rate limit exceeded: ' . $next['count'] . ' requests', $ip);
            }

            return false;
        }

        return true;
    } catch (Throwable $e) {
        if ($pdo instanceof PDO && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[pharma_rate_limit] ' . $e->getMessage());

        return true;
    }
}

function pharma_login_record_failure(string $ip): int
{
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);
    $pdo->prepare('INSERT INTO pharma_login_attempts (ip, fail_count, updated_at) VALUES (?, 1, UNIX_TIMESTAMP())
        ON DUPLICATE KEY UPDATE fail_count = fail_count + 1, updated_at = UNIX_TIMESTAMP()')->execute([$ip]);
    $st = $pdo->prepare('SELECT fail_count FROM pharma_login_attempts WHERE ip = ?');
    $st->execute([$ip]);

    return (int) $st->fetchColumn();
}

function pharma_login_clear(string $ip): void
{
    $pdo = pharma_require_pdo();
    pharma_ensure_schema($pdo);
    $pdo->prepare('DELETE FROM pharma_login_attempts WHERE ip = ?')->execute([$ip]);
}

// لا نستدعي pharma_require_pdo() هنا: كان يسبب 500 عند فشل الاتصال قبل try في api.php
