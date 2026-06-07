-- جدول السلايدرات الترويجية
CREATE TABLE IF NOT EXISTS pharma_sliders (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
