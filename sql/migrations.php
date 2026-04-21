<?php
/**
 * sql/migrations.php
 *
 * تعريف مخطط قاعدة البيانات (CREATE TABLE) — يُنفَّذ يدوياً مرة واحدة عند التثبيت
 * (مثلاً عبر سكربت إعداد، أو نسخ SQL إلى عميل MySQL)، وليس مع كل طلب HTTP.
 *
 * لا تُضمَّن هذه الملفات تلقائياً من صفحات الموقع ما لم تضف أنت استدعاء صريحاً للتثبيت.
 */
declare(strict_types=1);

/**
 * جمل CREATE TABLE بالترتيب المناسب للتنفيذ.
 *
 * @return list<string>
 */
function pharma_migration_sql_statements(): array
{
    return [
        <<<SQL
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
