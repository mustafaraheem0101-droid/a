<?php
/**
 * includes/api/handlers/misc.php
 * معالجات متنوعة: رفع الصور، التحليلات، الإعدادات، النسخ الاحتياطية
 */
declare(strict_types=1);

require_once __DIR__ . '/../../password_reset_repo.php';
require_once __DIR__ . '/../../pharma_mail.php';

function handle_misc(string $action, array $body, array $rawBody, string $clientIP, string $method, mixed $db): void
{
    switch ($action) {

        /* ══════ رفع صورة منتج (إدارة) ══════ */
        case 'upload_image':
            if (empty($_SESSION['admin_logged_in'])) { jsonError('غير مصرح', [], 401); }
            if ($method !== 'POST')                  { jsonError('POST فقط', [], 405); }
            if (empty($_FILES['image']) || !is_array($_FILES['image'])) { jsonError('لم يتم إرسال صورة'); }
            $check = validateUploadedImage($_FILES['image']);
            if (!$check['ok']) { jsonError($check['msg']); }
            if (!is_dir(IMAGES_DIR)) { mkdir(IMAGES_DIR, 0755, true); }
            $name   = 'prod_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $check['ext'];
            $target = IMAGES_DIR . $name;
            if (!move_uploaded_file($_FILES['image']['tmp_name'], $target)) { jsonError('تعذر حفظ الصورة على السيرفر', [], 500); }
            chmod($target, 0644);
            if (!is_file($target) || !is_readable($target)) {
                jsonError('تم رفع الملف لكن التحقق من وجوده على القرص فشل — تحقق من صلاحيات مجلد images/', [], 500);
            }
            logActivity('UPLOAD_IMAGE', "تم رفع صورة: $name", $clientIP);
            jsonSuccess(['path' => '/images/' . $name, 'name' => $name, 'url' => '/images/' . $name], '');
            break;

        /* ══════ رفع صورة تقييم ══════ */
        case 'upload_review_image':
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            if (empty($_FILES['image']) || !is_array($_FILES['image'])) { jsonError('لم يتم إرسال صورة'); }
            if (!checkReviewImageUploadRateLimit($clientIP)) { jsonError('يرجى الانتظار قليلاً قبل رفع صورة أخرى', [], 429); }
            if (($_FILES['image']['size'] ?? 0) > 3 * 1024 * 1024) { jsonError('حجم الصورة أكبر من 3 ميجابايت'); }
            $check = validateUploadedImage($_FILES['image']);
            if (!$check['ok']) { jsonError($check['msg']); }
            if (!is_dir(IMAGES_DIR)) { mkdir(IMAGES_DIR, 0755, true); }
            $name   = 'review_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $check['ext'];
            $target = IMAGES_DIR . $name;
            if (!move_uploaded_file($_FILES['image']['tmp_name'], $target)) { jsonError('تعذر حفظ الصورة على السيرفر', [], 500); }
            chmod($target, 0644);
            logActivity('UPLOAD_REVIEW_IMAGE', "رفع صورة تقييم: $name", $clientIP);
            jsonSuccess(['path' => '/images/' . $name, 'name' => $name, 'url' => '/images/' . $name], '');
            break;

        /* ══════ تسجيل الدخول ══════ */
        case 'login':
            $pass      = $body['pass'] ?? '';
            $adminHash = admin_bcrypt_hash();
            if (empty($pass) || !password_verify($pass, $adminHash)) {
                if (!pharma_login_lockout_disabled()) {
                    $count = pharma_login_record_failure($clientIP);
                    if ($count >= MAX_LOGIN_ATTEMPTS) {
                        blockIP($clientIP, BLOCK_DURATION);
                    }
                    logFailed("محاولة دخول فاشلة ($count)", $clientIP);
                    jsonError('كلمة السر غير صحيحة. محاولة ' . $count . ' من ' . MAX_LOGIN_ATTEMPTS, [], 401);
                }
                logFailed('محاولة دخول فاشلة', $clientIP);
                jsonError('كلمة السر غير صحيحة.', [], 401);
            }
            $token = generateCSRF();
            $_SESSION['admin_logged_in'] = true;
            session_regenerate_id(true);
            logActivity('LOGIN', 'دخول ناجح للإدارة', $clientIP);
            pharma_login_clear($clientIP);
            $adminCsrf = admin_csrf_token();
            jsonSuccess(['csrf' => $token, 'admin_csrf' => $adminCsrf], '');
            break;

        /* ══════ الإعدادات ══════ */
        case 'settings':
        case 'getSettings':
        case 'get_settings':
        case 'getHomepageSettings':
            jsonSuccess(['settings' => $db['settings'] ?? getDefaultSettings()], '');
            break;

        case 'saveSettings':
        case 'save_settings':
            checkAuth($clientIP);
            $newSettings = array_merge($db['settings'] ?? [], $body['settings'] ?? []);
            db_update_field('settings', $newSettings);
            jsonSuccess(['settings' => $newSettings], '');
            break;

        case 'change_pass':
            if (empty($_SESSION['admin_logged_in'])) {
                jsonError('غير مصرح', [], 401);
            }
            if ($method !== 'POST') {
                jsonError('POST فقط', [], 405);
            }
            $old = (string) ($rawBody['old_pass'] ?? $body['old_pass'] ?? '');
            $new = (string) ($rawBody['new_pass'] ?? $body['new_pass'] ?? '');
            if ($old === '' || $new === '') {
                jsonError('أدخل كلمة المرور القديمة والجديدة');
            }
            if (strlen($new) < 8) {
                jsonError('كلمة المرور الجديدة 8 أحرف على الأقل');
            }
            if (strlen($new) > 512) {
                jsonError('كلمة المرور طويلة جداً');
            }
            $curHash = admin_bcrypt_hash();
            if ($curHash === '' || !password_verify($old, $curHash)) {
                jsonError('كلمة المرور الحالية غير صحيحة', [], 403);
            }
            $newHash = password_hash($new, PASSWORD_DEFAULT);
            if (!admin_save_bcrypt_hash($newHash)) {
                jsonError('تعذر حفظ كلمة المرور على السيرفر', [], 500);
            }
            if (function_exists('logActivity')) {
                logActivity('PASSWORD', 'تغيير كلمة مرور الإدارة من لوحة التحكم', $clientIP);
            }
            jsonSuccess([], 'تم تغيير كلمة المرور');
            break;

        case 'forgot_password':
            if ($method !== 'POST') {
                jsonError('POST فقط', [], 405);
            }
            $pdo = getPdo();
            if ($pdo === null) {
                jsonError('قاعدة البيانات غير متاحة');
            }
            $adminEmail = pharma_admin_recovery_email();
            if ($adminEmail === '') {
                jsonError('لم يُضبط بريد المسؤول. أضف ADMIN_EMAIL أو MAIL_USERNAME في .env، أو أنشئ الملف private_data/admin_recovery_email.txt (سطر واحد = البريد).');
            }
            if (!pharma_mail_configured()) {
                jsonError('لم يُضبط إرسال البريد: أضف MAIL_HOST و MAIL_USERNAME و MAIL_PASSWORD في .env أو في الملف private_data/mail_smtp.env ثم نفّذ composer install على السيرفر.');
            }
            $email = strtolower(trim((string) ($rawBody['email'] ?? $body['email'] ?? '')));
            $generic = 'إن وافق البريد المسجّل لدينا، ستصلك رسالة تحتوي رابط إعادة التعيين.';
            if ($email !== $adminEmail) {
                jsonSuccess(['sent' => false], $generic);
                break;
            }
            if (!pharma_forgot_rate_allow($pdo, $clientIP)) {
                jsonError('عدد طلبات الاستعادة كبير من هذا العنوان. حاول لاحقاً.', [], 429);
            }
            $token = pharma_password_reset_create_token($pdo);
            if ($token === null) {
                jsonError('تعذر إنشاء رابط الاستعادة. حاول لاحقاً.', [], 500);
            }
            $base = pharma_public_base_url();
            $link = $base . '/reset-password.php?t=' . rawurlencode($token);
            $html = '<p style="font-family:Tahoma,sans-serif;font-size:15px;">مرحباً،</p>';
            $html .= '<p style="font-family:Tahoma,sans-serif;font-size:15px;">طُلب إعادة تعيين كلمة مرور لوحة التحكم.</p>';
            $html .= '<p><a href="' . htmlspecialchars($link, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                . '" style="color:#00875a;font-weight:bold;">اضغط هنا لاختيار كلمة مرور جديدة</a></p>';
            $html .= '<p style="font-size:13px;color:#666;">إن لم تطلب هذا، تجاهل الرسالة. الرابط صالح لمدة محدودة.</p>';
            if (!pharma_send_html_mail($adminEmail, 'إعادة تعيين كلمة مرور لوحة الإدارة', $html)) {
                jsonError('تعذر إرسال البريد. تحقق من إعدادات SMTP وكلمة مرور التطبيق في Gmail.', [], 500);
            }
            if (function_exists('logActivity')) {
                logActivity('MAIL', 'طلب إعادة تعيين كلمة مرور (إرسال بريد)', $clientIP);
            }
            jsonSuccess(['sent' => true], $generic);
            break;

        case 'reset_password':
            if ($method !== 'POST') {
                jsonError('POST فقط', [], 405);
            }
            $pdo = getPdo();
            if ($pdo === null) {
                jsonError('قاعدة البيانات غير متاحة');
            }
            $token = trim((string) ($rawBody['token'] ?? $body['token'] ?? ''));
            $new = (string) ($rawBody['new_pass'] ?? $body['new_pass'] ?? '');
            if (strlen($token) < 64) {
                jsonError('الرابط غير صالح أو منتهٍ');
            }
            if (strlen($new) < 8 || strlen($new) > 512) {
                jsonError('كلمة المرور يجب أن تكون بين 8 و512 حرفاً');
            }
            if (!pharma_password_reset_validate_and_delete($pdo, $token)) {
                jsonError('الرابط غير صالح أو منتهٍ', [], 400);
            }
            $newHash = password_hash($new, PASSWORD_DEFAULT);
            if (!admin_save_bcrypt_hash($newHash)) {
                jsonError('تعذر حفظ كلمة المرور', [], 500);
            }
            if (function_exists('logActivity')) {
                logActivity('PASSWORD', 'إعادة تعيين كلمة مرور عبر البريد', $clientIP);
            }
            jsonSuccess([], 'تم تعيين كلمة المرور الجديدة. يمكنك تسجيل الدخول الآن.');
            break;

        case 'mail_test':
            if (empty($_SESSION['admin_logged_in'])) {
                jsonError('غير مصرح', [], 401);
            }
            if ($method !== 'POST') {
                jsonError('POST فقط', [], 405);
            }
            $to = pharma_admin_recovery_email();
            if ($to === '') {
                jsonError('اضبط ADMIN_EMAIL أو MAIL_USERNAME (بريد Gmail) في .env');
            }
            if (!pharma_mail_configured()) {
                jsonError('لم يُضبط SMTP — أضف MAIL_* في .env أو private_data/mail_smtp.env');
            }
            $ok = pharma_send_html_mail(
                $to,
                'اختبار بريد — لوحة الإدارة',
                '<p>هذه رسالة تجريبية. إن وصلتك، إعداد Gmail/SMTP يعمل بشكل صحيح.</p>'
            );
            if (!$ok) {
                jsonError('فشل الإرسال — راجع السجلات أو كلمة مرور التطبيق في Gmail', [], 500);
            }
            jsonSuccess([], 'تم إرسال بريد تجريبي إلى ' . $to);
            break;

        /* ══════ بيانات شاملة ══════ */
        case 'getAllData':
        case 'get_all_data':
            checkAuth($clientIP);
            $cats = is_array($db['categories'] ?? null) ? $db['categories'] : getDefaultCategories();
            $subs = is_array($db['subcategories'] ?? null) ? $db['subcategories'] : getDefaultSubcategories();
            usort($cats, static fn($a, $b) => ($a['order'] ?? 999) - ($b['order'] ?? 999));
            usort($subs, static fn($a, $b) => ((int)($a['id'] ?? 0)) - ((int)($b['id'] ?? 0)));
            jsonSuccess(['categories' => $cats, 'subcategories' => $subs], '');
            break;

        /* ══════ إحصائيات لوحة الإدارة ══════ */
        case 'stats':
        case 'dashboard_stats':
            checkAuth($clientIP);
            $products  = $db['products'] ?? [];
            $reviews   = loadReviews();
            $range     = max(1, min(365, (int)($_GET['days'] ?? 7)));
            $analytics = pharma_admin_analytics_summary($range);
            $orderCount = getPdo() !== null
                ? pharma_orders_count(pharma_require_pdo())
                : count(is_array($db['orders'] ?? null) ? $db['orders'] : []);
            jsonSuccess([
                'counts' => [
                    'products'        => count($products),
                    'products_active' => count(array_filter($products, static fn($p) => ($p['active'] ?? true) !== false)),
                    'categories'      => count($db['categories'] ?? []),
                    'subcategories'   => count($db['subcategories'] ?? []),
                    'orders'          => $orderCount,
                    'reviews'         => count($reviews),
                ],
                'pdo_connected'                => getPdo() !== null,
                'whatsapp_clicks'              => $analytics['whatsapp_clicks'],
                'whatsapp_orders'              => $analytics['whatsapp_orders'],
                'top_ordered_products'         => $analytics['top_products'],
                'top_whatsapp_click_products'  => $analytics['top_whatsapp_click_products'],
                'analytics_days'               => $range,
            ], '');
            break;

        /* ══════ تتبع واتساب ══════ */
        case 'track_wa_event':
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            $etype  = sanitizeInput($body['event'] ?? $rawBody['event'] ?? '');
            if (!in_array($etype, ['wa_click', 'wa_order_intent'], true)) { jsonError('حدث غير صالح'); }
            $prodId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($body['product_id'] ?? $rawBody['product_id'] ?? ''));
            if ($etype === 'wa_click') {
                if (getPdo() === null) { jsonSuccess(['ok' => false], ''); break; }
                pharma_record_whatsapp_click($prodId);
                jsonSuccess(['ok' => true], '');
                break;
            }
            $meta = null;
            if (isset($rawBody['meta']) && is_array($rawBody['meta'])) { $meta = $rawBody['meta']; }
            pharma_track_analytics_event($etype, $prodId, $meta, $clientIP);
            jsonSuccess(['ok' => true], '');
            break;

        case 'log_whatsapp_intent':
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            $items = $rawBody['items'] ?? null;
            if (!is_array($items) || $items === []) { jsonError('لا توجد عناصر'); }
            $clean = [];
            foreach ($items as $it) {
                if (!is_array($it)) { continue; }
                $pid = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($it['id'] ?? ''));
                if ($pid === '') { continue; }
                $clean[] = [
                    'id'    => $pid,
                    'name'  => isset($it['name']) && is_string($it['name']) ? mb_substr(strip_tags($it['name']), 0, 200, 'UTF-8') : '',
                    'qty'   => max(1, (int)($it['qty'] ?? 1)),
                    'price' => (float)($it['price'] ?? 0),
                ];
            }
            if ($clean === []) { jsonError('بيانات غير صالحة'); }
            pharma_track_analytics_event('wa_order_intent', $clean[0]['id'], ['items' => $clean, 'source' => sanitizeInput($body['source'] ?? 'cart')], $clientIP);
            foreach ($clean as $c) { pharma_increment_product_wa_count($c['id'], 1); }
            jsonSuccess(['logged' => count($clean)], '');
            break;

        /* ══════ نسخ احتياطي / استعادة / إعادة ضبط ══════ */
        case 'backup':
            checkAuth($clientIP);
            jsonSuccess(['database' => $db], '');
            break;

        case 'restore':
            checkAuth($clientIP);
            $data = $body['data'] ?? [];
            if (!isset($data['products'])) { jsonError('ملف غير صالح'); }
            saveDBSafe($data);
            jsonSuccess([], '');
            break;

        case 'reset_products':
            checkAuth($clientIP);
            saveDBSafe([
                'products'      => getDefaultProducts(),
                'subcategories' => getDefaultSubcategories(),
                'categories'    => getDefaultCategories(),
                'settings'      => $db['settings'] ?? getDefaultSettings(),
                'orders'        => $db['orders'] ?? [],
            ]);
            jsonSuccess([], '');
            break;

        default:
            jsonError("action غير معروف في handle_misc: $action", [], 400);
    }
}
