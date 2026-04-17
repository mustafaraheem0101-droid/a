-- ══════════════════════════════════════════════════════════════════════════════
-- schema_v2.sql — مخطط MySQL محسَّن لصيدلية شهد محمد
-- التحسين الرئيسي: pharma_products بأعمدة منفصلة بدلاً من JSON خام
-- الترميز: utf8mb4
-- ══════════════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────
-- جدول المنتجات (مُحسَّن — أعمدة قابلة للفهرسة والبحث)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_products (
    id            VARCHAR(64)    NOT NULL PRIMARY KEY,
    sort_order    INT            NOT NULL DEFAULT 0,
    name          VARCHAR(512)   NOT NULL DEFAULT '',
    name_en       VARCHAR(512)   NOT NULL DEFAULT '',
    slug          VARCHAR(512)   NOT NULL DEFAULT '',
    description   TEXT                    DEFAULT NULL,
    price         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    price_old     DECIMAL(10,2)           DEFAULT NULL,
    category      VARCHAR(190)   NOT NULL DEFAULT '',
    category_slug VARCHAR(190)   NOT NULL DEFAULT '',
    product_type  VARCHAR(64)    NOT NULL DEFAULT '',
    image_url     VARCHAR(1024)           DEFAULT NULL,
    active        TINYINT(1)     NOT NULL DEFAULT 1,
    is_rx         TINYINT(1)     NOT NULL DEFAULT 0,
    stock         INT                     DEFAULT NULL,
    wa_count      INT            NOT NULL DEFAULT 0,
    doc           LONGTEXT                DEFAULT NULL COMMENT 'بيانات إضافية (ألوان، صور متعددة، ...) — JSON',
    created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_products_sort     (sort_order),
    KEY idx_products_name     (name(100)),
    KEY idx_products_category (category_slug),
    KEY idx_products_price    (price),
    KEY idx_products_active   (active),
    KEY idx_products_type     (product_type),
    FULLTEXT KEY ft_products_search (name, name_en, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────
-- جدول الأقسام
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_categories (
    id         VARCHAR(64)   NOT NULL PRIMARY KEY,
    name       VARCHAR(255)  NOT NULL,
    slug       VARCHAR(190)  NOT NULL,
    icon       VARCHAR(64)   NOT NULL DEFAULT '',
    active     TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order INT            NOT NULL DEFAULT 0,
    KEY idx_cat_sort (sort_order),
    KEY idx_cat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────
-- جدول الأقسام الفرعية
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_subcategories (
    id     VARCHAR(64)   NOT NULL PRIMARY KEY,
    name   VARCHAR(255)  NOT NULL,
    parent VARCHAR(190)  NOT NULL,
    icon   VARCHAR(64)   NOT NULL DEFAULT '',
    active TINYINT(1)    NOT NULL DEFAULT 1,
    KEY idx_sub_parent (parent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────
-- جدول الإعدادات
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_settings (
    setting_key VARCHAR(190) NOT NULL PRIMARY KEY,
    val_json    LONGTEXT     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────
-- جدول الطلبات
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_orders (
    id            VARCHAR(190)  NOT NULL PRIMARY KEY,
    customer_name VARCHAR(255)  NOT NULL DEFAULT '',
    phone         VARCHAR(64)   NOT NULL DEFAULT '',
    address       TEXT                   DEFAULT NULL,
    notes         TEXT                   DEFAULT NULL,
    items_summary TEXT                   DEFAULT NULL,
    total         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status        ENUM('pending','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
    source        VARCHAR(64)   NOT NULL DEFAULT 'whatsapp',
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    doc           LONGTEXT               DEFAULT NULL COMMENT 'بيانات إضافية — JSON',

    KEY idx_orders_status  (status),
    KEY idx_orders_phone   (phone),
    KEY idx_orders_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────
-- جدول التقييمات
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_reviews (
    id               VARCHAR(64)  NOT NULL PRIMARY KEY,
    product_id       VARCHAR(64)  NOT NULL,
    name             VARCHAR(200) NOT NULL,
    rating           TINYINT      NOT NULL DEFAULT 5,
    comment          TEXT         NOT NULL,
    date             DATE         NOT NULL,
    verified         TINYINT(1)   NOT NULL DEFAULT 0,
    approved         TINYINT(1)   NOT NULL DEFAULT 0,
    helpful_up       INT          NOT NULL DEFAULT 0,
    helpful_down     INT          NOT NULL DEFAULT 0,
    KEY idx_rev_product  (product_id),
    KEY idx_rev_date     (date),
    KEY idx_rev_approved (approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────
-- جداول الأمان (Rate Limiting, IP Blocking, Login)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_rate_limit (
    ip           VARCHAR(45)  NOT NULL PRIMARY KEY,
    req_count    INT          NOT NULL DEFAULT 0,
    window_start INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_login_attempts (
    ip         VARCHAR(45)  NOT NULL PRIMARY KEY,
    fail_count INT          NOT NULL DEFAULT 0,
    updated_at INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_blocked_ips (
    ip            VARCHAR(45)  NOT NULL PRIMARY KEY,
    until_ts      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_label VARCHAR(64)  NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharma_review_rate (
    rate_key CHAR(64)     NOT NULL PRIMARY KEY,
    last_ts  INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────
-- جدول Analytics
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_analytics_events (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(40)     NOT NULL,
    product_id VARCHAR(64)     NOT NULL DEFAULT '',
    payload    TEXT                     DEFAULT NULL,
    ip_hash    CHAR(64)        NOT NULL DEFAULT '',
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_analytics_type_time (event_type, created_at),
    KEY idx_analytics_product   (product_id),
    KEY idx_analytics_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────
-- جدول Migrations لتتبع إصدارات قاعدة البيانات
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharma_migrations (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
    version     VARCHAR(50)     NOT NULL UNIQUE,
    description VARCHAR(255)    NOT NULL DEFAULT '',
    applied_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- تسجيل هذا الـ schema كأول migration
INSERT IGNORE INTO pharma_migrations (version, description) 
VALUES ('2.0.0', 'Schema v2 — أعمدة منفصلة للمنتجات + جدول migrations');

SET FOREIGN_KEY_CHECKS = 1;
