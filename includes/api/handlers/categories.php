<?php
/**
 * includes/api/handlers/categories.php
 * معالج الأقسام والأقسام الفرعية
 */
declare(strict_types=1);

function handle_categories(string $action, array $body, string $clientIP, mixed $db): void
{
    switch ($action) {

        /* ══════ عرض الأقسام (عام) ══════ */
        case 'categories':
        case 'getCategories':
        case 'get_categories':
            try {
                $params     = pharma_api_public_params($body);
                $activeOnly = (string)($params['active'] ?? '1') === '1';
                if (getPdo() === null) {
                    $cats = getDefaultCategories();
                    if ($activeOnly) {
                        $cats = array_values(array_filter($cats, static fn($c) => ($c['active'] ?? true) !== false));
                    }
                    jsonSuccess(['categories' => $cats], '');
                    break;
                }
                $cats = pharma_api_get_categories_pdo(pharma_require_pdo(), $activeOnly);
                jsonSuccess(['categories' => $cats], '');
            } catch (Throwable $e) {
                error_log('[api getCategories] ' . $e->getMessage());
                jsonError(API_DEBUG ? $e->getMessage() : 'تعذر جلب الأقسام', [], 500);
            }
            break;

        /* ══════ عرض الأقسام الفرعية (عام) ══════ */
        case 'subcategories':
        case 'getSubcategories':
        case 'get_subcategories':
            jsonSuccess(['subcategories' => $db['subcategories'] ?? getDefaultSubcategories()], '');
            break;

        /* ══════ إضافة قسم (إدارة) ══════ */
        case 'addCategory':
        case 'add_category':
            checkAuth($clientIP);
            $cat = $body['category'] ?? [];
            if (empty($cat['name']) || empty($cat['slug'])) { jsonError('اسم القسم والرابط المختصر مطلوبان'); }
            db_update_field_callback('categories', static function(array $cats) use ($cat): array {
                $cat['id']     = time() * 1000 + random_int(0, 999);
                $cat['active'] = $cat['active'] ?? true;
                $cat['order']  = $cat['order'] ?? count($cats) + 1;
                $cats[] = $cat;
                return $cats;
            });
            logActivity('ADD_CATEGORY', "تم إضافة قسم: {$cat['name']}", $clientIP);
            jsonSuccess([], '');
            break;

        /* ══════ تحديث قسم (إدارة) ══════ */
        case 'updateCategory':
        case 'update_category':
            checkAuth($clientIP);
            $cat = $body['category'] ?? [];
            if (empty($cat['id'])) { jsonError('معرف القسم مطلوب'); }
            $found = false;
            db_update_field_callback('categories', static function(array $cats) use ($cat, &$found): array {
                foreach ($cats as &$c) {
                    if ($c['id'] == $cat['id']) { $c = array_merge($c, $cat); $found = true; break; }
                }
                return $cats;
            });
            if (!$found) { jsonError('القسم غير موجود'); }
            jsonSuccess([], '');
            break;

        /* ══════ حذف قسم (إدارة) ══════ */
        case 'deleteCategory':
        case 'delete_category':
            checkAuth($clientIP);
            $id = $body['id'] ?? null;
            if (!$id) { jsonError('معرف القسم مطلوب'); }
            db_update_field_callback('categories', static fn(array $cats) => array_values(array_filter($cats, static fn($c) => $c['id'] != $id)));
            jsonSuccess([], '');
            break;

        /* ══════ إعادة ترتيب (إدارة) ══════ */
        case 'reorder_categories':
            checkAuth($clientIP);
            $order = $body['order'] ?? [];
            if (!is_array($order)) { jsonError('بيانات غير صالحة'); }
            db_update_field_callback('categories', static function(array $cats) use ($order): array {
                foreach ($cats as &$c) {
                    $pos = array_search($c['id'], $order, true);
                    if ($pos !== false) { $c['order'] = $pos + 1; }
                }
                return $cats;
            });
            jsonSuccess([], '');
            break;

        /* ══════ إضافة قسم فرعي (إدارة) ══════ */
        case 'addSubcategory':
        case 'add_subcategory':
            checkAuth($clientIP);
            $sub = $body['subcategory'] ?? [];
            if (empty($sub['name']) || empty($sub['parent'])) { jsonError('اسم القسم والقسم الرئيسي مطلوبان'); }
            db_update_field_callback('subcategories', static function(array $subs) use ($sub): array {
                $sub['id']     = time() * 1000 + random_int(0, 999);
                $sub['active'] = $sub['active'] ?? true;
                $subs[] = $sub;
                return $subs;
            });
            logActivity('ADD_SUBCATEGORY', "تم إضافة قسم فرعي: {$sub['name']}", $clientIP);
            jsonSuccess([], '');
            break;

        /* ══════ تحديث قسم فرعي (إدارة) ══════ */
        case 'updateSubcategory':
        case 'update_subcategory':
            checkAuth($clientIP);
            $sub = $body['subcategory'] ?? [];
            if (empty($sub['id'])) { jsonError('معرف القسم مطلوب'); }
            $found = false;
            db_update_field_callback('subcategories', static function(array $subs) use ($sub, &$found): array {
                foreach ($subs as &$s) {
                    if ($s['id'] == $sub['id']) { $s = array_merge($s, $sub); $found = true; break; }
                }
                return $subs;
            });
            if (!$found) { jsonError('القسم غير موجود'); }
            jsonSuccess([], '');
            break;

        /* ══════ حذف قسم فرعي (إدارة) ══════ */
        case 'deleteSubcategory':
        case 'delete_subcategory':
            checkAuth($clientIP);
            $id = $body['id'] ?? null;
            if (!$id) { jsonError('معرف القسم مطلوب'); }
            db_update_field_callback('subcategories', static fn(array $subs) => array_values(array_filter($subs, static fn($s) => $s['id'] != $id)));
            jsonSuccess([], '');
            break;

        default:
            jsonError("action غير معروف في handle_categories: $action", [], 400);
    }
}
