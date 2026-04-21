<?php
declare(strict_types=1);

// يجب أن يبقى هذا الشرط مباشرة بعد declare: منع فتح التثبيت من الويب عدا تعريف ALLOW_MIGRATE لسكربت داخلي
if (php_sapi_name() !== 'cli' && !defined('ALLOW_MIGRATE')) {
    die('ممنوع تشغيل هذا الملف من المتصفح');
}

/**
 * شغّل هذا الملف مرة واحدة فقط عند التثبيت الأول (مثلاً: php sql/migrate.php من جذر المشروع).
 *
 * السبب: تجميع كل CREATE TABLE هنا يمنع تنفيذها مع كل طلب HTTP ويُبقي الاتصال أخفّ وأوضح أمنياً.
 */

$rootDir = dirname(__DIR__);
require_once $rootDir . '/env_loader.php';
pharma_load_env_sources($rootDir);
require_once $rootDir . '/db.php';

$pdo = getPdo();
if (!$pdo) {
    $err = "فشل الاتصال بقاعدة البيانات — تحقق من .env (DB_HOST, DB_NAME, DB_USER, DB_PASS)\n";
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, $err);
    } else {
        echo $err;
    }
    exit(1);
}

foreach (pharma_install_schema_statements() as $sql) {
    $pdo->exec($sql);
}

$done = "تم تنفيذ جمل إنشاء الجداول (أو كانت موجودة مسبقاً — IF NOT EXISTS).\n";
if (php_sapi_name() === 'cli') {
    echo $done;
} else {
    header('Content-Type: text/plain; charset=utf-8');
    echo $done;
}

/**
 * كل جداول التطبيق — مطابقة لما كان يُنشَأ في includes/db.php ولوحة الأدوية، دون حذف فهارس أو مفاتيح.
 *
 * @return list<string>
 */
function pharma_install_schema_statements(): array
{
    return [
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_migrations (
    id         INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
    version    VARCHAR(50)     NOT NULL UNIQUE,
    description VARCHAR(255)   NOT NULL DEFAULT '',
    applied_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_products (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    sort_order INT NOT NULL DEFAULT 0,
    doc LONGTEXT NOT NULL,
    KEY idx_products_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_categories (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(190) NOT NULL,
    icon VARCHAR(64) NOT NULL DEFAULT '',
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    KEY idx_cat_sort (sort_order),
    KEY idx_cat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_subcategories (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent VARCHAR(190) NOT NULL,
    icon VARCHAR(64) NOT NULL DEFAULT '',
    active TINYINT(1) NOT NULL DEFAULT 1,
    KEY idx_sub_parent (parent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_settings (
    setting_key VARCHAR(190) NOT NULL PRIMARY KEY,
    val_json LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_orders (
    id VARCHAR(190) NOT NULL PRIMARY KEY,
    doc LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_reviews (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    city VARCHAR(80) NOT NULL DEFAULT '',
    rating TINYINT NOT NULL DEFAULT 5,
    comment TEXT NOT NULL,
    image_url VARCHAR(512) NOT NULL DEFAULT '',
    pharmacist_reply TEXT NULL,
    date DATE NOT NULL,
    verified TINYINT(1) NOT NULL DEFAULT 0,
    approved TINYINT(1) NOT NULL DEFAULT 0,
    helpful_up INT NOT NULL DEFAULT 0,
    helpful_down INT NOT NULL DEFAULT 0,
    KEY idx_rev_product (product_id),
    KEY idx_rev_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_rate_limit (
    ip VARCHAR(45) NOT NULL PRIMARY KEY,
    req_count INT NOT NULL DEFAULT 0,
    window_start INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_login_attempts (
    ip VARCHAR(45) NOT NULL PRIMARY KEY,
    fail_count INT NOT NULL DEFAULT 0,
    updated_at INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_blocked_ips (
    ip VARCHAR(45) NOT NULL PRIMARY KEY,
    until_ts BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_label VARCHAR(64) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_review_rate (
    rate_key CHAR(64) NOT NULL PRIMARY KEY,
    last_ts INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_backups (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload LONGTEXT NOT NULL,
    KEY idx_backup_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_analytics_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(40) NOT NULL,
    product_id VARCHAR(64) NOT NULL DEFAULT '',
    payload TEXT,
    ip_hash CHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_analytics_type_time (event_type, created_at),
    KEY idx_analytics_product (product_id),
    KEY idx_analytics_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS pharma_whatsapp_clicks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_wa_clk_product (product_id),
    KEY idx_wa_clk_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
        ,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS drugs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL
    ];
}
