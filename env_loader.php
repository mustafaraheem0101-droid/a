<?php
/**
 * env_loader.php - تحميل الإعدادات البيئية بأمان
 * يقرأ من ملف .env إذا وُجد، وإلا يرجع إلى متغيرات البيئة
 */
declare(strict_types=1);

// PHP < 8.0 على بعض الاستضافات: بدون هذه الدوال يحدث خطأ فادح ويُرجع api.php حالة 500 لكل الطلبات
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool
    {
        return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}
if (!function_exists('str_contains')) {
    function str_contains(string $haystack, string $needle): bool
    {
        return $needle === '' || strpos($haystack, $needle) !== false;
    }
}

/**
 * دمج سطور ملف .env في $_ENV (يستبدل المفاتيح السابقة لنفس الملف لاحقاً في السلسلة).
 */
function pharma_merge_env_file(string $path): void
{
    if (!is_readable($path)) {
        return;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return;
    }
    // UTF-8 BOM (شائع عند حفظ .env من Notepad/Windows) يفسد مفتاح السطر الأول
    if (str_starts_with($raw, "\xEF\xBB\xBF")) {
        $raw = substr($raw, 3);
    }
    $lines = preg_split('/\r\n|\r|\n/', $raw);
    if ($lines === false) {
        return;
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (!str_contains($line, '=')) {
            continue;
        }
        [$key, $val] = explode('=', $line, 2);
        $key = trim($key);
        $val = trim($val, " \t\n\r\0\x0B\"'");
        if ($key === '' || !preg_match('/^[A-Z][A-Z0-9_]*$/', $key)) {
            continue;
        }
        $_ENV[$key] = $val;
        @putenv($key . '=' . $val);
    }
}

/**
 * تحميل عدة ملفات .env بالترتيب؛ الملفات اللاحقة تُحدّث نفس المفتاح (مناسب لـ Hostinger).
 *
 * @param list<string> $extraPaths مسارات إضافية تُحمَّل في النهاية (أعلى أولوية)
 */
function pharma_load_env_sources(string $projectRoot, array $extraPaths = []): void
{
    $root = rtrim($projectRoot, '/\\');
    $parent = dirname($root);
    $candidates = [
        $root . DIRECTORY_SEPARATOR . '.env',
        $root . DIRECTORY_SEPARATOR . 'private_data' . DIRECTORY_SEPARATOR . '.env',
        $parent . DIRECTORY_SEPARATOR . '.env',
        // شائع في Hostinger: مجلد private_data بجانب public_html (وليس داخله)
        $parent . DIRECTORY_SEPARATOR . 'private_data' . DIRECTORY_SEPARATOR . '.env',
    ];
    $seen = [];
    foreach (array_merge($candidates, $extraPaths) as $p) {
        $real = @realpath($p);
        if ($real === false || !is_readable($real)) {
            continue;
        }
        if (isset($seen[$real])) {
            continue;
        }
        $seen[$real] = true;
        pharma_merge_env_file($real);
    }
}

function loadEnvFile(string $path = ''): void
{
    $envFile = $path !== '' ? $path : __DIR__ . DIRECTORY_SEPARATOR . '.env';
    $altPath  = '';
    $altPath2 = '';
    if (defined('PRIVATE_DIR')) {
        $altPath  = rtrim((string) PRIVATE_DIR, '/\\') . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '.env';
        $altPath2 = rtrim((string) PRIVATE_DIR, '/\\') . DIRECTORY_SEPARATOR . '.env';
    }

    $file = '';
    if ($envFile !== '' && is_readable($envFile)) {
        $file = $envFile;
    } elseif ($altPath2 !== '' && is_readable($altPath2)) {
        $file = $altPath2;
    } elseif ($altPath !== '' && is_readable($altPath)) {
        $file = $altPath;
    }

    if ($file === '') {
        return;
    }

    pharma_merge_env_file($file);
}

function env(string $key, string $default = ''): string
{
    if (array_key_exists($key, $_ENV)) {
        return (string) $_ENV[$key];
    }
    $g = getenv($key);

    return ($g !== false && $g !== '') ? (string) $g : $default;
}
