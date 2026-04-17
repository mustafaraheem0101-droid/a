<?php
/**
 * db.php — اتصال PDO بـ MySQL (إلزامي لتشغيل المتجر)
 *
 * الاستضافة المشتركة (مثل Hostinger): ضع القيم في `.env` بجانب المشروع (مستبعد من Git)، مثلاً:
 *   DB_HOST=localhost
 *   DB_NAME=your_database
 *   DB_USER=your_user
 *   DB_PASS=your_password
 *   DB_PORT=3306
 *   DB_CHARSET=utf8mb4
 *
 * أو DSN كامل:
 *   DB_DSN=mysql:host=localhost;dbname=your_database;charset=utf8mb4
 *
 * بديل اختياري: انسخ `db.local.example.php` إلى `db.local.php` وعبّئ المصفوفة (الملف في .gitignore).
 */
declare(strict_types=1);

require_once __DIR__ . '/env_loader.php';
pharma_load_env_sources(__DIR__);
// إن عُرّف PRIVATE_DIR قبل تضمين هذا الملف (مثل api.php)، أو وُجد private_data محلياً — إعادة تحميل .env من هناك
if (defined('PRIVATE_DIR')) {
    pharma_load_env_sources(__DIR__, [rtrim((string) PRIVATE_DIR, '/\\') . DIRECTORY_SEPARATOR . '.env']);
} else {
    $__pl = __DIR__ . DIRECTORY_SEPARATOR . 'private_data';
    if (is_dir($__pl)) {
        pharma_load_env_sources(__DIR__, [rtrim($__pl, '/\\') . DIRECTORY_SEPARATOR . '.env']);
    }
}

/** @var array<string,string>|false $cfg */
$__pharmaDbLocal = __DIR__ . '/db.local.php';
if (is_readable($__pharmaDbLocal)) {
    $cfg = require $__pharmaDbLocal;
    if (is_array($cfg)) {
        foreach ($cfg as $key => $val) {
            if (!is_string($key) || !str_starts_with($key, 'DB_') || $val === '' || $val === null) {
                continue;
            }
            $s = is_scalar($val) ? (string) $val : '';
            if ($s === '') {
                continue;
            }
            $_ENV[$key] = $s;
            putenv($key . '=' . $s);
        }
    }
}
unset($__pharmaDbLocal, $cfg);

/**
 * @return PDO|null
 */
function getPdo(): ?PDO
{
    static $pdo = null;
    static $attempted = false;

    if ($attempted) {
        return $pdo;
    }
    $attempted = true;

    $dsn = trim((string) env('DB_DSN', ''));
    if ($dsn === '') {
        $host = trim((string) env('DB_HOST', ''));
        $name = trim((string) env('DB_NAME', ''));
        if ($host !== '' && $name !== '') {
            $port    = trim((string) env('DB_PORT', '3306')) ?: '3306';
            $charset = trim((string) env('DB_CHARSET', 'utf8mb4')) ?: 'utf8mb4';
            $dsn     = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                $host,
                $port,
                $name,
                $charset
            );
        }
    }
    if ($dsn === '') {
        $GLOBALS['PHARMA_DB_FAIL'] = 'missing_config';
        $GLOBALS['PHARMA_PDO_LAST_ERR'] = 'لم يُحمّل DB_HOST و DB_NAME (أو DB_DSN) من ملف .env — ضع الملف بجانب api.php أو في ../private_data/.env';

        return null;
    }

    $user = (string) env('DB_USER', '');
    $pass = (string) env('DB_PASS', '');

    $opts = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_PERSISTENT         => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $opts);
    } catch (PDOException $e) {
        error_log('[db.php] PDO: ' . $e->getMessage());
        $GLOBALS['PHARMA_DB_FAIL'] = 'connect_failed';
        $GLOBALS['PHARMA_PDO_LAST_ERR'] = $e->getMessage();
        $pdo = null;
        // Hostinger/Linux: أحياناً localhost يستخدم سوكيت مختلفاً عن 127.0.0.1 (TCP)
        if ($pdo === null && str_contains($dsn, 'host=localhost')) {
            $dsnAlt = preg_replace('/host=localhost\b/', 'host=127.0.0.1', $dsn, 1);
            if ($dsnAlt !== $dsn) {
                try {
                    $pdo = new PDO($dsnAlt, $user, $pass, $opts);
                    unset($GLOBALS['PHARMA_DB_FAIL'], $GLOBALS['PHARMA_PDO_LAST_ERR']);
                } catch (PDOException $e2) {
                    error_log('[db.php] PDO (127.0.0.1): ' . $e2->getMessage());
                    $GLOBALS['PHARMA_PDO_LAST_ERR'] = $e2->getMessage();
                    $pdo = null;
                }
            }
        }
    }

    return $pdo;
}

/**
 * @throws RuntimeException
 */
function pharma_require_pdo(): PDO
{
    $p = getPdo();
    if ($p === null) {
        $fail = (string) ($GLOBALS['PHARMA_DB_FAIL'] ?? '');
        if ($fail === 'missing_config') {
            throw new RuntimeException(
                'قاعدة البيانات غير مُعدّة: عيّن DB_HOST و DB_NAME و DB_USER و DB_PASS (أو DB_DSN) في ملف .env'
            );
        }
        $detail = (string) ($GLOBALS['PHARMA_PDO_LAST_ERR'] ?? '');
        throw new RuntimeException(
            'فشل الاتصال بقاعدة البيانات — تحقق من DB_HOST واسم القاعدة والمستخدم وكلمة المرور من لوحة الاستضافة. ' . ($detail !== '' ? '(' . $detail . ')' : '')
        );
    }

    return $p;
}
