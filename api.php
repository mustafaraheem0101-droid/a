<?php
/**
 * api.php — واجهة JSON موحّدة (صيدلية شهد محمد) — النسخة المُحسَّنة 2.0
 * التحسينات:
 *  - تفكيك منطق الـ API إلى handlers منفصلة (includes/api/handlers/)
 *  - إصلاح مشكلة المفاتيح العشوائية
 *  - إضافة CSP headers للـ API
 */
declare(strict_types=1);

require_once __DIR__ . '/env_loader.php';
pharma_load_env_sources(__DIR__);

define('API_DEBUG', filter_var(env('API_DEBUG', '0'), FILTER_VALIDATE_BOOLEAN));
if (API_DEBUG) { error_reporting(E_ALL); ini_set('display_errors', '1'); }
else           { error_reporting(E_ALL); ini_set('display_errors', '0'); }
ini_set('log_errors', '1');

$allowedOrigin = trim(env('ALLOWED_ORIGIN', ''));
if ($allowedOrigin === '*' || strcasecmp($allowedOrigin, 'null') === 0) {
    if ($allowedOrigin !== '') {
        error_log('[pharma] تم تجاهل ALLOWED_ORIGIN غير آمن (* أو null). اتركه فارغاً لنفس المنشأ أو ضع https://اسم-نطاقك بالضبط.');
    }
    $allowedOrigin = '';
}
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($allowedOrigin !== '' && $requestOrigin === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Vary: Origin');
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, X-CSRF-Token');
header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox");
header("Cross-Origin-Opener-Policy: same-origin");
header("Cross-Origin-Resource-Policy: same-site");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/includes/bootstrap_session.php';
pharma_init_session_secure(['lifetime' => 0]);
require_once __DIR__ . '/admin_panel_auth.php';
admin_restore_session_from_cookie();

$__ph = '/home/u678860509/private_data';
$__pl = __DIR__ . '/private_data';
define('PRIVATE_DIR', rtrim(is_dir($__ph) ? $__ph : $__pl, '/') . '/');
unset($__ph, $__pl);

pharma_load_env_sources(__DIR__, [rtrim(PRIVATE_DIR, '/\\') . DIRECTORY_SEPARATOR . '.env']);

define('HASH_FILE',   PRIVATE_DIR . 'admin_hash.txt');
define('WHITE_FILE',  PRIVATE_DIR . 'whitelist_ips.txt');
define('SECRET_FILE', PRIVATE_DIR . 'session_secret.txt');
define('LOGS_DIR',    PRIVATE_DIR . 'logs/');
define('BACKUP_DIR',  PRIVATE_DIR . 'backups/');
define('IMAGES_DIR',  __DIR__ . '/images/');

foreach ([PRIVATE_DIR, LOGS_DIR, BACKUP_DIR] as $dir) {
    if (!is_dir($dir)) { mkdir($dir, 0700, true); chmod($dir, 0700); }
}

// ✅ مفاتيح API: من .env، أو ملف يُنشأ تلقائياً في private_data (أول تشغيل)، أو قيم تطوير مع API_DEBUG
$_pubKey = env('PUBLIC_API_KEY', '');
$_admKey = env('ADMIN_API_KEY', '');
$runtimeKeyFile = PRIVATE_DIR . 'runtime_api_keys.php';
if ($_pubKey === '' || $_admKey === '') {
    if (is_readable($runtimeKeyFile)) {
        $loaded = require $runtimeKeyFile;
        if (is_array($loaded)) {
            if ($_pubKey === '' && isset($loaded['PUBLIC_API_KEY']) && is_string($loaded['PUBLIC_API_KEY'])) {
                $_pubKey = $loaded['PUBLIC_API_KEY'];
            }
            if ($_admKey === '' && isset($loaded['ADMIN_API_KEY']) && is_string($loaded['ADMIN_API_KEY'])) {
                $_admKey = $loaded['ADMIN_API_KEY'];
            }
        }
    }
}
if ($_pubKey === '' || $_admKey === '') {
    if (API_DEBUG) {
        // تطوير: pub_/adm_ + 48 hex (52 حرفاً) — في الإنتاج ضع مفاتيح عشوائية حقيقية في .env
        define('PUBLIC_API_KEY', 'pub_' . str_repeat('a', 48));
        define('ADMIN_API_KEY', 'adm_' . str_repeat('b', 48));
        error_log('[pharma] تحذير: PUBLIC_API_KEY أو ADMIN_API_KEY غير محدد في .env');
    } else {
        $_pubKey = 'pub_' . bin2hex(random_bytes(24));
        $_admKey = 'adm_' . bin2hex(random_bytes(24));
        $export = "<?php\nreturn " . var_export(['PUBLIC_API_KEY' => $_pubKey, 'ADMIN_API_KEY' => $_admKey], true) . ";\n";
        if (@file_put_contents($runtimeKeyFile, $export, LOCK_EX) !== false) {
            @chmod($runtimeKeyFile, 0600);
            error_log('[pharma] تم إنشاء مفاتيح API في private_data/runtime_api_keys.php — انسخها إلى .env للإنتاج');
        } else {
            http_response_code(503);
            echo json_encode(['status' => 'error', 'message' => 'الخادم غير مُهيَّأ — لا يمكن الكتابة في private_data. ضبط PUBLIC_API_KEY و ADMIN_API_KEY في .env أو صلاحيات المجلد.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        define('PUBLIC_API_KEY', $_pubKey);
        define('ADMIN_API_KEY',  $_admKey);
    }
} else {
    define('PUBLIC_API_KEY', $_pubKey);
    define('ADMIN_API_KEY',  $_admKey);
}
unset($_pubKey, $_admKey, $runtimeKeyFile);

define('MAX_LOGIN_ATTEMPTS',        5);
define('BLOCK_DURATION',            max(60,  (int)env('LOGIN_BLOCK_DURATION',    '3600')));
define('RATE_WINDOW',               max(30,  (int)env('RATE_LIMIT_WINDOW',       '300')));
define('MAX_REQUESTS',              max(30,  (int)env('RATE_LIMIT_MAX_REQUESTS', '250')));
define('RATE_LIMIT_BLOCK_DURATION', max(0,   (int)env('RATE_LIMIT_BLOCK_DURATION','1800')));
if (!API_DEBUG && env('RATE_LIMIT_BLOCK_DURATION', '') === '0') {
    error_log('[pharma] RATE_LIMIT_BLOCK_DURATION=0 في .env — لا يُحظر IP بعد تجاوز معدل الطلبات. القيمة الموصى بها للإنتاج: 1800.');
}
define('ADMIN_EMAIL',               env('ADMIN_EMAIL', 'info@pharma-store.me'));
define('CSRF_LIFETIME',             3600);

if (!is_dir(IMAGES_DIR)) { mkdir(IMAGES_DIR, 0755, true); }

require_once __DIR__ . '/includes/defaults.php';
require_once __DIR__ . '/includes/normalize.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/product_slug.php';
require_once __DIR__ . '/includes/analytics.php';
require_once __DIR__ . '/includes/api_public_mysql.php';
require_once __DIR__ . '/includes/api/response.php';
require_once __DIR__ . '/includes/api/handlers/products.php';
require_once __DIR__ . '/includes/api/handlers/categories.php';
require_once __DIR__ . '/includes/api/handlers/orders.php';
require_once __DIR__ . '/includes/api/handlers/reviews.php';
require_once __DIR__ . '/includes/api/handlers/misc.php';

try {
    $clientIP = getClientIP();
    $method   = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $ct        = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
    $rawInput  = pharma_read_raw_request_body();
    $rawBody   = [];

    if ($method === 'POST') {
        $cl = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($cl > 0) {
            if (str_starts_with($ct, 'multipart/form-data')) {
                $rawBody = $_POST;
            } elseif (!str_contains($ct, 'application/json')) {
                http_response_code(415);
                jsonError('Content-Type غير مدعوم — استخدم application/json أو multipart/form-data', [], 415);
            }
        }
        if (!str_starts_with($ct, 'multipart/form-data')) {
            if ($rawInput !== '') {
                $decoded = json_decode($rawInput, true);
                if (!is_array($decoded)) {
                    jsonError('جسم الطلب ليس JSON صالحاً', [], 400);
                }
                $rawBody = $decoded;
            }
        }
    } elseif ($rawInput !== '') {
        $decoded = json_decode($rawInput, true);
        if (is_array($decoded)) {
            $rawBody = $decoded;
        }
    }

    $action = sanitizeInput($_GET['action'] ?? '');
    if ($action === '' && isset($rawBody['action']) && is_string($rawBody['action']) && $rawBody['action'] !== '') {
        $action = sanitizeInput($rawBody['action']);
    }

    /* مفاتيح API الطويلة مطلوبة لمعظم الإجراءات — لا نمنع تسجيل الدخول واستعادة كلمة المرور بسببها */
    $minKeyLen = 52;
    $apiKeyLenExempt = ['login', 'forgot_password', 'reset_password'];
    if (
        !in_array(strtolower($action), $apiKeyLenExempt, true)
        && (strlen((string) PUBLIC_API_KEY) < $minKeyLen || strlen((string) ADMIN_API_KEY) < $minKeyLen)
    ) {
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status'  => 'error',
            'message' => 'مفاتيح API ضعيفة أو قصيرة. استخدم PUBLIC_API_KEY و ADMIN_API_KEY بطول ' . $minKeyLen . '+ (مثال: pub_ أو adm_ متبوعاً بـ 48 حرف hex عشوائي من bin2hex(random_bytes(24))).',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (isIPBlocked($clientIP)) {
        $authBypassActions = ['login', 'forgot_password', 'reset_password'];
        if (empty($_SESSION['admin_logged_in']) && !in_array(strtolower($action), $authBypassActions, true)) {
            http_response_code(429);
            logActivity('BLOCKED', 'محاولة وصول من IP محظور', $clientIP);
            jsonError('تم حظر هذا العنوان مؤقتاً', [], 429);
        }
    }
    if (!checkRateLimit($clientIP)) { http_response_code(429); jsonError('طلبات كثيرة جداً', [], 429); }

    $requirePublicKey = filter_var(env('REQUIRE_PUBLIC_API_KEY', '0'), FILTER_VALIDATE_BOOLEAN);
    $publicKeyBypass = ['login', 'forgot_password', 'reset_password'];
    if (
        $requirePublicKey
        && empty($_SESSION['admin_logged_in'])
        && !in_array(strtolower($action), $publicKeyBypass, true)
        && !verifyPublicAPIKey()
    ) {
        http_response_code(403);
        jsonError('مفتاح API عام غير صالح: أرسل الرأس X-API-Key مطابقاً لـ PUBLIC_API_KEY', [], 403);
    }

    $db   = loadDB();
    $body = array_map('sanitizeInput', $rawBody);

    if ($method === 'POST' && !empty($_SESSION['admin_logged_in'])) {
        $csrfExempt = [
            'login', 'forgot_password', 'reset_password',
            'submit_review', 'addreview', 'review_vote',
            'upload_review_image', 'track_wa_event', 'log_whatsapp_intent',
        ];
        if (!in_array(strtolower($action), $csrfExempt, true)) {
            pharma_api_require_admin_csrf($body);
        }
    }

    $productActions = [
        'products','getProducts','get_products','get_product','getProduct',
        'get_products_by_category','get_products_by_subcat',
        'search','search_products','search_suggest',
        'addProduct','add_product','updateProduct','update_product',
        'deleteProduct','delete_product','clear_all_products','toggle_product',
    ];
    $categoryActions = [
        'categories','getCategories','get_categories',
        'subcategories','getSubcategories','get_subcategories',
        'addCategory','add_category','updateCategory','update_category',
        'deleteCategory','delete_category','reorder_categories',
        'addSubcategory','add_subcategory','updateSubcategory','update_subcategory',
        'deleteSubcategory','delete_subcategory',
    ];
    $orderActions = [
        'admin_get_orders','admin_update_order_status',
        'admin_create_order','admin_delete_order','admin_get_customers',
    ];
    $reviewActions = [
        'get_reviews','getReviews','submit_review','addReview',
        'review_vote','admin_get_reviews','admin_save_reviews',
    ];

    if (in_array($action, $productActions, true)) {
        handle_products($action, $body, $rawBody, $clientIP, $method, $db);
    } elseif (in_array($action, $categoryActions, true)) {
        handle_categories($action, $body, $clientIP, $db);
    } elseif (in_array($action, $orderActions, true)) {
        handle_orders($action, $body, $clientIP, $method, $db);
    } elseif (in_array($action, $reviewActions, true)) {
        handle_reviews($action, $body, $rawBody, $clientIP, $method);
    } else {
        handle_misc($action, $body, $rawBody, $clientIP, $method, $db);
    }

} catch (Throwable $e) {
    if (function_exists('logActivity')) { logActivity('API_EXCEPTION', $e->getMessage(), $clientIP ?? ''); }
    $msg = API_DEBUG ? $e->getMessage() : 'حدث خطأ في الخادم';
    if (!API_DEBUG && (
        str_contains($e->getMessage(), 'قاعدة البيانات غير')
        || str_contains($e->getMessage(), 'فشل الاتصال بقاعدة البيانات')
    )) {
        $msg = 'تعذر الاتصال بقاعدة البيانات. أنشئ قاعدة MySQL من لوحة الاستضافة ثم ضع القيم في .env: DB_HOST، DB_NAME، DB_USER، DB_PASS.';
    }
    jsonError($msg, [], 500);
}
