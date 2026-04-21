<?php
/**
 * includes/migrations.php — نظام Migrations بسيط لتتبع تحديثات قاعدة البيانات
 * يُستدعى من install/ أو يدوياً من المطور
 */
declare(strict_types=1);

/**
 * يُشغّل migration إذا لم يُطبَّق بعد
 */
function pharma_run_migration(PDO $pdo, string $version, string $description, callable $fn): bool
{
    // جدول pharma_migrations يُنشَأ عبر sql/migrate.php — لا CREATE TABLE هنا حتى لا يُنفَّذ مع كل طلب
    try {
        $pdo->query('SELECT 1 FROM pharma_migrations LIMIT 1');
    } catch (Throwable $e) {
        throw new RuntimeException(
            'جدول pharma_migrations غير موجود — نفّذ التثبيت الأول: php sql/migrate.php',
            0,
            $e
        );
    }

    // تحقق إن كان طُبِّق مسبقاً
    $stmt = $pdo->prepare('SELECT id FROM pharma_migrations WHERE version = ?');
    $stmt->execute([$version]);
    if ($stmt->fetch()) {
        return false; // سبق تطبيقه
    }

    // تشغيل الـ migration
    $pdo->beginTransaction();
    try {
        $fn($pdo);
        $pdo->prepare('INSERT INTO pharma_migrations (version, description) VALUES (?, ?)')
            ->execute([$version, $description]);
        $pdo->commit();
        return true;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/**
 * قائمة Migrations المتاحة — أضف هنا عند كل تحديث للقاعدة
 */
function pharma_get_migrations(): array
{
    return [
        '2.0.0' => [
            'description' => 'إضافة أعمدة منفصلة لجدول المنتجات',
            'fn' => static function(PDO $pdo): void {
                // إضافة الأعمدة الجديدة إذا لم تكن موجودة
                $cols = ['name', 'price', 'category_slug', 'active', 'slug'];
                foreach ($cols as $col) {
                    try {
                        $pdo->exec("ALTER TABLE pharma_products ADD COLUMN $col VARCHAR(512) NOT NULL DEFAULT '' AFTER id");
                    } catch (Throwable $e) {
                        // العمود موجود مسبقاً — تجاهل
                    }
                }
            },
        ],
        '2.1.0' => [
            'description' => 'إضافة فهارس FULLTEXT للبحث',
            'fn' => static function(PDO $pdo): void {
                try {
                    $pdo->exec('ALTER TABLE pharma_products ADD FULLTEXT KEY ft_search (name, description)');
                } catch (Throwable $e) { /* موجود مسبقاً */ }
            },
        ],
    ];
}

/**
 * تشغيل كل الـ migrations المعلّقة
 */
function pharma_run_pending_migrations(PDO $pdo): array
{
    $results = [];
    foreach (pharma_get_migrations() as $version => $m) {
        try {
            $applied = pharma_run_migration($pdo, $version, $m['description'], $m['fn']);
            $results[$version] = $applied ? 'applied' : 'skipped';
        } catch (Throwable $e) {
            $results[$version] = 'error: ' . $e->getMessage();
        }
    }
    return $results;
}
