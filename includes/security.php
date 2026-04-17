<?php
/**
 * includes/security.php
 *
 * طبقة مساعدة: IP، rate limit، CSRF، تسجيل، sanitize للمدخلات النصية.
 *
 * **قاعدة البيانات:** كل الاستعلامات الحرجة في المشروع تمر عبر PDO مع
 * `prepare()` + معاملات مربوطة — هذا هو الخط الدفاعي الأساسي ضد SQL Injection.
 * الدوال هنا تقلل المحتوى الضار (مثل وسوم HTML) قبل التخزين؛ عرض HTML يُهرب في الواجهة.
 */
declare(strict_types=1);

/**
 * تنظيف نصي للمدخلات في الـ API: يزيل وسوم HTML والمسارات الخطرة والبايت الفارغ.
 * الحماية من SQLi تكون عبر PDO ومعاملات مربوطة فقط — لا تُحذف كلمات مثل SELECT من نصوص مشروعة.
 * عند العرض في HTML استخدم التهريب في الواجهة (مثل escHtml في الويب).
 */
function sanitizeInput($input) {
    if (is_array($input)) {
        return array_map('sanitizeInput', $input);
    }
    if (!is_string($input)) {
        return $input;
    }
    if (str_starts_with($input, 'data:image/')) {
        return trim($input);
    }
    $input = str_replace(['../', '.\\', '..\\', '%2e%2e%2f'], '', $input);
    $input = str_replace(chr(0), '', $input);
    $input = strip_tags(trim($input));

    return mb_substr($input, 0, 5000, 'UTF-8');
}

function getClientIP(): string {
    $headers = ['HTTP_CF_CONNECTING_IP','HTTP_X_REAL_IP','HTTP_X_FORWARDED_FOR','REMOTE_ADDR'];
    foreach ($headers as $h) {
        if (!empty($_SERVER[$h])) {
            $ip = trim(explode(',', $_SERVER[$h])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE))
                return $ip;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function logActivity(string $type, string $msg, string $ip = ''): void {
    $ip      = $ip ?: getClientIP();
    $logFile = LOGS_DIR . 'activity_' . date('Y-m') . '.log';
    $line    = '[' . date('Y-m-d H:i:s') . '] [' . strtoupper($type) . '] IP:' . $ip . ' | ' . $msg . PHP_EOL;
    file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    @chmod($logFile, 0600);
    if (@filesize($logFile) > 10 * 1024 * 1024) rename($logFile, $logFile . '.old');
}

function logFailed(string $reason, string $ip = ''): void {
    $ip      = $ip ?: getClientIP();
    $logFile = LOGS_DIR . 'failed_' . date('Y-m') . '.log';
    $line    = '[' . date('Y-m-d H:i:s') . '] IP:' . $ip . ' | ' . $reason . PHP_EOL;
    file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    @chmod($logFile, 0600);
}

function isIPBlocked(string $ip): bool {
    return pharma_ip_is_blocked($ip);
}

function blockIP(string $ip, int $duration = BLOCK_DURATION): void {
    pharma_ip_block($ip, $duration);
}

function unblockIP(string $ip): void {
    pharma_ip_unblock($ip);
}

/** عند true: لا حظر لمحاولات تسجيل الدخول (من .env DISABLE_LOGIN_LOCKOUT=1) — للاستخدام المحلي/الطوارئ فقط. */
function pharma_login_lockout_disabled(): bool
{
    if (!function_exists('env')) {
        return false;
    }
    $v = strtolower(trim((string) env('DISABLE_LOGIN_LOCKOUT', '0')));

    return in_array($v, ['1', 'true', 'yes', 'on'], true);
}

function checkRateLimit(string $ip): bool {
    return pharma_rate_limit_check($ip);
}

function generateCSRF(): string {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['httponly' => true, 'secure' => true, 'samesite' => 'Strict']);
        session_start();
    }
    $token = bin2hex(random_bytes(32));
    if (!isset($_SESSION['csrf_tokens'])) $_SESSION['csrf_tokens'] = [];
    $_SESSION['csrf_tokens'][] = ['token' => $token, 'time' => time()];
    if (count($_SESSION['csrf_tokens']) > 10) array_shift($_SESSION['csrf_tokens']);
    return $token;
}

function verifyCSRF(string $token): bool {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['httponly' => true, 'secure' => true, 'samesite' => 'Strict']);
        session_start();
    }
    if (empty($_SESSION['csrf_tokens'])) return false;
    $now = time();
    foreach ($_SESSION['csrf_tokens'] as $k => $t) {
        if ($now - $t['time'] > CSRF_LIFETIME) { unset($_SESSION['csrf_tokens'][$k]); continue; }
        if (hash_equals($t['token'], $token)) { unset($_SESSION['csrf_tokens'][$k]); return true; }
    }
    return false;
}

/**
 * يتحقق من تطابق رأس X-API-Key مع PUBLIC_API_KEY (توقيت ثابت).
 * لتفعيل الإلزام على كل الطلبات العامة: REQUIRE_PUBLIC_API_KEY=1 في .env
 * ثم أرسل المفتاح من الواجهة/العميل في رأس X-API-Key.
 */
function verifyPublicAPIKey(): bool
{
    if (!defined('PUBLIC_API_KEY')) {
        return false;
    }
    $expected = (string) PUBLIC_API_KEY;
    if ($expected === '') {
        return false;
    }
    $sent = trim((string) ($_SERVER['HTTP_X_API_KEY'] ?? ''));

    return $sent !== '' && hash_equals($expected, $sent);
}

function verifyAdminAPIKey(): bool {
    $key = $_SERVER['HTTP_X_API_KEY'] ?? '';
    return hash_equals(ADMIN_API_KEY, $key);
}

/**
 * طلبات POST للإدارة (بعد تسجيل الدخول) تتطلب رمز CSRF من لوحة التحكم:
 * رأس X-Admin-CSRF أو الحقل _csrf في JSON / multipart.
 *
 * @param array<string,mixed> $body جسم مُصفّى (sanitizeInput)
 */
function pharma_api_require_admin_csrf(array $body): void
{
    if (empty($_SESSION['admin_logged_in']) || !function_exists('admin_csrf_verify')) {
        return;
    }
    $tok = trim((string) ($_SERVER['HTTP_X_ADMIN_CSRF'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
    if ($tok === '') {
        foreach (['_csrf', 'csrf_token', 'csrf'] as $k) {
            if (!empty($body[$k]) && is_string($body[$k])) {
                $tok = trim($body[$k]);
                break;
            }
        }
    }
    if ($tok === '' && !empty($_POST['_csrf']) && is_string($_POST['_csrf'])) {
        $tok = trim((string) $_POST['_csrf']);
    }
    if (!admin_csrf_verify($tok)) {
        http_response_code(403);
        if (function_exists('jsonError')) {
            jsonError('رمز CSRF مطلوب أو غير صالح (X-Admin-CSRF أو _csrf)', [], 403);
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'error', 'message' => 'رمز CSRF مطلوب أو غير صالح'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function checkAuth(string $ip): void {
    if (!empty($_SESSION['admin_logged_in'])) {
        return;
    }
    logFailed('وصول API غير مصرح بدون جلسة إدارة', $ip);
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    if (function_exists('jsonResponse')) {
        jsonResponse('error', [], 'غير مصرح');
    }
    echo json_encode(['status' => 'error', 'data' => [], 'message' => 'غير مصرح'], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * التحقق الصارم من نوع الملف المرفوع عبر MIME الحقيقي + الامتداد
 */
function validateUploadedImage(array $file): array {
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'msg' => 'فشل رفع الصورة (كود: ' . ($file['error'] ?? -1) . ')'];
    }
    if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
        return ['ok' => false, 'msg' => 'حجم الصورة أكبر من 5MB'];
    }

    // ─── التحقق من MIME الحقيقي (finfo) ─────────────────────────
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!isset($allowed[$mime])) {
        return ['ok' => false, 'msg' => 'صيغة الصورة غير مدعومة (MIME: ' . $mime . ')'];
    }

    // ─── التحقق من الامتداد أيضاً (حماية مضاعفة) ───────────────
    $ext        = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    $allowedExt = ['jpg','jpeg','png','webp','gif'];
    if (!in_array($ext, $allowedExt, true)) {
        return ['ok' => false, 'msg' => 'امتداد الملف غير مسموح به'];
    }

    // ─── التحقق من أن المحتوى صورة فعلاً (getimagesize) ────────
    $imgInfo = @getimagesize($file['tmp_name']);
    if ($imgInfo === false) {
        return ['ok' => false, 'msg' => 'الملف المرفوع ليس صورة صالحة'];
    }

    return ['ok' => true, 'mime' => $mime, 'ext' => $allowed[$mime]];
}
