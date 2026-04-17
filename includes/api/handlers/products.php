<?php
/**
 * includes/api/handlers/products.php
 * معالج منتجات API — يُستدعى من api.php
 */
declare(strict_types=1);

/**
 * يمنع حفظ مسار /images/prod_* إن لم يكن الملف موجوداً تحت IMAGES_DIR (يُفسّر 404 عند العرض).
 */
function pharma_assert_managed_product_image_file_exists(array $prod): void
{
    if (!defined('IMAGES_DIR')) {
        return;
    }
    $img = isset($prod['image']) && is_string($prod['image']) ? trim($prod['image']) : '';
    if ($img === '') {
        return;
    }
    if (preg_match('#^https?://#i', $img)) {
        return;
    }
    if (!preg_match('#^/images/prod_[a-zA-Z0-9._-]+\.(jpe?g|png|gif|webp)$#i', $img)) {
        return;
    }
    $name = basename($img);
    if ($name === '' || str_contains($name, '..')) {
        return;
    }
    $dir  = rtrim((string) IMAGES_DIR, "/\\");
    $path = $dir . DIRECTORY_SEPARATOR . $name;
    if (is_file($path) && is_readable($path)) {
        return;
    }
    jsonError(
        API_DEBUG
            ? ('ملف الصورة غير موجود: ' . $name . ' — المسار المتوقع على السيرفر: ' . $dir)
            : 'رابط الصورة يشير لملف غير موجود على السيرفر. أعد رفع الصورة من «اختر صورة» ثم احفظ. تأكد أن مجلد images/ بجوار api.php موجود ويُرفع مع الموقع عند النشر.',
        [],
        400
    );
}

function handle_products(string $action, array $body, array $rawBody, string $clientIP, string $method, mixed $db): void
{
    switch ($action) {
        /* ══════════════ عرض المنتجات (عام) ══════════════ */
        case 'products':
        case 'getProducts':
        case 'get_products':
            try {
                if (getPdo() === null) {
                    jsonSuccess(['products' => [], 'pagination' => ['page' => 1, 'per_page' => 0, 'total' => 0, 'total_pages' => 0]], '');
                    break;
                }
                $pdoConn = pharma_require_pdo();
                $params  = pharma_api_public_params($body);
                $out     = pharma_api_get_products_pdo($pdoConn, $params);
                jsonSuccess(['products' => $out['products'], 'pagination' => $out['pagination']], '');
            } catch (Throwable $e) {
                error_log('[api getProducts] ' . $e->getMessage());
                jsonError(API_DEBUG ? $e->getMessage() : 'تعذر جلب المنتجات من قاعدة البيانات', [], 500);
            }
            break;

        /* ══════════════ منتج واحد ══════════════ */
        case 'get_product':
        case 'getProduct':
            try {
                if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
                $pdoConn = pharma_require_pdo();
                $params  = pharma_api_public_params($body);
                $id      = sanitizeInput($params['id'] ?? '');
                $slug    = sanitizeInput($params['slug'] ?? '');
                if ($id === '' && $slug === '') { jsonError('أرسل معرف المنتج id أو slug'); }
                $found   = pharma_api_get_product_pdo($pdoConn, $id !== '' ? $id : null, $slug !== '' ? $slug : null);
                if ($found === null) { jsonError('المنتج غير موجود', [], 404); }
                jsonSuccess(['product' => $found], '');
            } catch (Throwable $e) {
                error_log('[api getProduct] ' . $e->getMessage());
                jsonError(API_DEBUG ? $e->getMessage() : 'تعذر جلب المنتج', [], 500);
            }
            break;

        /* ══════════════ بحث ══════════════ */
        case 'search':
        case 'search_products':
            try {
                if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
                $pdoConn = pharma_require_pdo();
                $params  = pharma_api_public_params($body);
                $q       = sanitizeInput($params['q'] ?? '');
                $isSuggest = isset($params['suggest']) && (string) $params['suggest'] === '1';
                if ($isSuggest) {
                    $limit = max(1, min(15, (int)($params['limit'] ?? 8)));
                    $rows  = pharma_db_search_suggest($pdoConn, $q, $limit);
                    jsonSuccess(['suggestions' => $rows, 'q' => $q], '');
                    break;
                }
                $filters = array_filter([
                    'min_price'    => $params['min_price'] ?? null,
                    'max_price'    => $params['max_price'] ?? null,
                    'category'     => sanitizeInput($params['category'] ?? ''),
                    'product_type' => sanitizeInput($params['product_type'] ?? ''),
                ], static fn($v) => $v !== null && $v !== '');
                $out = pharma_api_search_products_paged($pdoConn, $q, $filters, $params);
                jsonSuccess(['products' => $out['products'], 'pagination' => $out['pagination'], 'q' => $out['q']], '');
            } catch (Throwable $e) {
                error_log('[api search] ' . $e->getMessage());
                jsonError(API_DEBUG ? $e->getMessage() : 'تعذر تنفيذ البحث', [], 500);
            }
            break;

        case 'search_suggest':
            if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
            $q     = sanitizeInput($_GET['q'] ?? '');
            $limit = max(1, min(15, (int)($_GET['limit'] ?? 8)));
            $rows  = pharma_db_search_suggest(pharma_require_pdo(), $q, $limit);
            jsonSuccess(['suggestions' => $rows, 'q' => $q], '');
            break;

        /* ══════════════ منتجات بالقسم ══════════════ */
        case 'get_products_by_category':
            _handle_products_by_category($db);
            break;

        case 'get_products_by_subcat':
            $subcatId = (int)($_GET['subcat_id'] ?? 0);
            $filtered = array_values(array_filter(
                $db['products'] ?? [],
                static fn($p) => in_array($subcatId, $p['subcategories'] ?? [], true) && ($p['active'] ?? true) !== false
            ));
            jsonSuccess(['products' => $filtered], '');
            break;

        /* ══════════════ إضافة منتج (إدارة) ══════════════ */
        case 'addProduct':
        case 'add_product':
            checkAuth($clientIP);
            $prod = normalize_product_payload($body);
            if (empty($prod['name']) || !isset($prod['price'])) { jsonError('اسم المنتج والسعر مطلوبان'); }
            $prod['id']        = $prod['id'] ?? (time() * 1000 + random_int(0, 999));
            $prod['active']    = $prod['active'] ?? true;
            $prod['isCustom']  = true;
            pharma_apply_product_categories_canonical($prod);
            $prod['subcategories'] = isset($prod['subcategories']) && is_array($prod['subcategories'])
                ? array_values(array_unique(array_map('intval', $prod['subcategories']))) : [];
            unset($prod['stars'], $prod['rev']);
            $prod['created_at'] = $prod['updated_at'] = date('Y-m-d H:i:s');
            pharma_apply_product_slug($prod);
            pharma_assert_managed_product_image_file_exists($prod);
            $ok = db_update_field_callback('products', static function(array $products) use ($prod): array {
                $products[] = $prod; return $products;
            });
            if (!$ok) { jsonError('خطأ في حفظ المنتج', [], 500); }
            logActivity('ADD_PRODUCT', "تم إضافة منتج: {$prod['name']}", $clientIP);
            jsonSuccess(['product' => $prod], '');
            break;

        /* ══════════════ تحديث منتج (إدارة) ══════════════ */
        case 'updateProduct':
        case 'update_product':
            checkAuth($clientIP);
            $prod = normalize_product_payload($body);
            if (empty($prod['id'])) { jsonError('معرف المنتج مطلوب'); }
            unset($prod['stars'], $prod['rev']);
            pharma_assert_managed_product_image_file_exists($prod);
            $found = false;
            $ok = db_update_field_callback('products', static function(array $products) use ($prod, &$found): array {
                foreach ($products as &$p) {
                    if ($p['id'] == $prod['id']) {
                        $p = array_merge($p, $prod);
                        /* نموذج الإدارة يرسل دائماً image؛ إن حُذفت الصورة يجب إفراغ img/images وليس الإبقاء على القيم القديمة بعد array_merge */
                        if (array_key_exists('image', $prod)) {
                            $raw = $prod['image'];
                            $trim = is_string($raw) ? trim($raw) : '';
                            if ($raw === null || $trim === '') {
                                $p['image'] = '';
                                $p['img'] = '';
                                $p['images'] = [];
                            } else {
                                $p['image'] = $trim;
                                $p['img'] = $trim;
                                if (!array_key_exists('images', $prod)) {
                                    $p['images'] = [$trim];
                                }
                            }
                        }
                        pharma_apply_product_categories_canonical($p);
                        $p['subcategories'] = isset($p['subcategories']) && is_array($p['subcategories'])
                            ? array_values(array_unique(array_map('intval', $p['subcategories']))) : [];
                        pharma_apply_product_slug($p);
                        $p['updated_at'] = date('Y-m-d H:i:s');
                        $found = true; break;
                    }
                }
                return $products;
            });
            if (!$found) { jsonError('المنتج غير موجود'); }
            if (!$ok)    { jsonError('خطأ في الحفظ', [], 500); }
            logActivity('UPDATE_PRODUCT', "تم تعديل منتج ID: {$prod['id']}", $clientIP);
            jsonSuccess([], '');
            break;

        /* ══════════════ حذف منتج (إدارة) ══════════════ */
        case 'deleteProduct':
        case 'delete_product':
            checkAuth($clientIP);
            $id = $body['id'] ?? null;
            if (!$id) { jsonError('معرف المنتج مطلوب'); }
            $found = false;
            $ok = db_update_field_callback('products', static function(array $products) use ($id, &$found): array {
                $new   = array_values(array_filter($products, static fn($p) => $p['id'] != $id));
                $found = count($new) < count($products);
                return $new;
            });
            if (!$found) { jsonError('المنتج غير موجود'); }
            if (!$ok)    { jsonError('خطأ في الحفظ', [], 500); }
            $idStr = trim((string) $id);
            $isSeedId = false;
            foreach (getDefaultProducts() as $sp) {
                if (is_array($sp) && isset($sp['id']) && (string) $sp['id'] === $idStr) {
                    $isSeedId = true;
                    break;
                }
            }
            if ($isSeedId) {
                db_update_field_callback('settings', static function (array $settings) use ($idStr): array {
                    $list = $settings['suppressed_seed_product_ids'] ?? [];
                    if (!is_array($list)) {
                        $list = [];
                    }
                    $norm = [];
                    foreach ($list as $x) {
                        $norm[] = (string) $x;
                    }
                    if (!in_array($idStr, $norm, true)) {
                        $norm[] = $idStr;
                    }
                    $settings['suppressed_seed_product_ids'] = array_values(array_unique($norm));

                    return $settings;
                });
            }
            logActivity('DELETE_PRODUCT', "تم حذف منتج ID: $id", $clientIP);
            jsonSuccess([], '');
            break;

        /* ══════════════ حذف الكل / تفعيل ══════════════ */
        case 'clear_all_products':
            checkAuth($clientIP);
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            $n = count($db['products'] ?? []);
            db_update_field('products', []);
            db_update_field_callback('settings', static function (array $settings): array {
                unset($settings['suppressed_seed_product_ids']);

                return $settings;
            });
            logActivity('CLEAR_ALL_PRODUCTS', "تم حذف جميع المنتجات ($n)", $clientIP);
            jsonSuccess(['cleared' => $n], '');
            break;

        case 'toggle_product':
            checkAuth($clientIP);
            $id = $body['id'] ?? null;
            $active = null;
            db_update_field_callback('products', static function(array $products) use ($id, &$active): array {
                foreach ($products as &$p) {
                    if ($p['id'] == $id) {
                        $p['active']     = !($p['active'] ?? true);
                        $p['updated_at'] = date('Y-m-d H:i:s');
                        $active          = $p['active'];
                        break;
                    }
                }
                return $products;
            });
            if ($active === null) { jsonError('المنتج غير موجود'); }
            jsonSuccess(['active' => $active], '');
            break;

        default:
            jsonError("action غير معروف في handler_products: $action", [], 400);
    }
}

/* ─── دالة مساعدة لمنتجات القسم ─── */
function _handle_products_by_category(mixed $db): void
{
    $slug = sanitizeInput($_GET['slug'] ?? '');
    $slugAliases = [
        'drugs' => 'medicine', 'beauty' => 'cosmetics', 'cosmetic' => 'cosmetics',
        'vitamin' => 'vitamins', 'vitamins' => 'vitamins', 'baby' => 'kids',
        'children' => 'kids', 'oral_care' => 'oralcare',
    ];
    $slugKeyAlias = strtolower((string)$slug);
    if ($slug !== '' && isset($slugAliases[$slugKeyAlias])) { $slug = $slugAliases[$slugKeyAlias]; }
    $wantCanon   = pharma_canonical_category_slug(trim((string)$slug));
    $slugNumeric = ($slug !== '' && ctype_digit(preg_replace('/\s+/u', '', (string)$slug))) ? (string)(int)$slug : '';
    $cats        = $db['categories'] ?? getDefaultCategories();
    $category    = null;
    foreach ($cats as $c) {
        if (!is_array($c)) { continue; }
        $cid = $c['id'] ?? null;
        if ($slugNumeric !== '' && $cid !== null && $cid !== '' && is_numeric($cid)) {
            if ((string)(int)$cid === $slugNumeric) { $category = $c; break; }
        }
        $cs      = trim((string)($c['slug'] ?? ''));
        $csCanon = $cs !== '' ? pharma_canonical_category_slug($cs) : '';
        if ($wantCanon !== '' && $csCanon !== '' && $csCanon === $wantCanon) { $category = $c; break; }
    }
    if (!$category) { jsonError('القسم غير موجود'); }
    $filtered = array_values(array_filter($db['products'] ?? [], static function($p) use ($category) {
        return ($p['active'] ?? true) !== false && is_array($p) && pharma_product_in_main_category($p, $category);
    }));
    jsonSuccess(['category' => $category, 'products' => $filtered, 'randomImage' => ''], '');
}
