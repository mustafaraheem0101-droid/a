-- ═══════════════════════════════════════════════════════════════════
-- جدول drugs — لنظام الإدارة المقسّم بالفئات
-- نفّذ هذا الملف مرة واحدة على قاعدة البيانات
-- ═══════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS drugs (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    image       VARCHAR(500) NOT NULL DEFAULT '',
    category    ENUM('cosmetics','kids','medical') NOT NULL,
    description TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_drugs_category (category),
    KEY idx_drugs_created  (created_at),
    KEY idx_drugs_name     (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='منتجات الصيدلية مقسّمة بالفئات';

-- مثال على بيانات تجريبية (احذف هذا القسم في الإنتاج)
-- INSERT INTO drugs (name, price, image, category, description) VALUES
-- ('كريم مرطّب للوجه', 12500, '', 'cosmetics', 'مرطّب يومي للبشرة الجافة'),
-- ('شامبو للأطفال', 8000, '', 'kids', 'شامبو لطيف بدون دموع'),
-- ('مقياس حرارة رقمي', 15000, '', 'medical', 'مقياس حرارة إلكتروني دقيق');
