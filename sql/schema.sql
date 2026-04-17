-- مخطط MySQL لمتجر الصيدلية (بدون ملفات JSON)
-- الترميز: utf8mb4
-- نفّذ هذا الملف مرة واحدة على السيرفر، أو اترك التطبيق ينشئ الجداول تلقائياً عبر pharma_ensure_schema()

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS pharma_products (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    sort_order INT NOT NULL DEFAULT 0,
    doc LONGTEXT NOT NULL,
    KEY idx_products_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_categories (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(190) NOT NULL,
    icon VARCHAR(64) NOT NULL DEFAULT '',
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    KEY idx_cat_sort (sort_order),
    KEY idx_cat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_subcategories (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent VARCHAR(190) NOT NULL,
    icon VARCHAR(64) NOT NULL DEFAULT '',
    active TINYINT(1) NOT NULL DEFAULT 1,
    KEY idx_sub_parent (parent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_settings (
    setting_key VARCHAR(190) NOT NULL PRIMARY KEY,
    val_json LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_orders (
    id VARCHAR(190) NOT NULL PRIMARY KEY,
    doc LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_reviews (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    rating TINYINT NOT NULL DEFAULT 5,
    comment TEXT NOT NULL,
    date DATE NOT NULL,
    verified TINYINT(1) NOT NULL DEFAULT 0,
    approved TINYINT(1) NOT NULL DEFAULT 0,
    helpful_up INT NOT NULL DEFAULT 0,
    helpful_down INT NOT NULL DEFAULT 0,
    KEY idx_rev_product (product_id),
    KEY idx_rev_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_rate_limit (
    ip VARCHAR(45) NOT NULL PRIMARY KEY,
    req_count INT NOT NULL DEFAULT 0,
    window_start INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_login_attempts (
    ip VARCHAR(45) NOT NULL PRIMARY KEY,
    fail_count INT NOT NULL DEFAULT 0,
    updated_at INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_blocked_ips (
    ip VARCHAR(45) NOT NULL PRIMARY KEY,
    until_ts BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_label VARCHAR(64) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_review_rate (
    rate_key CHAR(64) NOT NULL PRIMARY KEY,
    last_ts INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_backups (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload LONGTEXT NOT NULL,
    KEY idx_backup_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
