<?php
/**
 * includes/normalize.php
 * دوال تطبيع البيانات وضمان الاتساق
 */
declare(strict_types=1);

require_once __DIR__ . '/defaults.php';

function adminNormCatName(string $name): string {
    $name = trim($name);
    if ($name === '') return '';
    return function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
}

/**
 * مفتاح مطابقة موحّد لـ slug القسم: أحرف صغيرة بدون مسافات أو شرطات أو شرطات سفلية.
 * المعرفات الرقمية تُعاد كسلسلة أرقام موحّدة.
 */
function pharma_normalize_category_match_key(string $s): string
{
    $s = trim($s);
    if ($s === '') {
        return '';
    }
    if (ctype_digit($s)) {
        return (string) (int) $s;
    }
    $lower = function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
    $collapsed = preg_replace('/[\s\-_]+/u', '', $lower);

    return $collapsed !== null && $collapsed !== '' ? $collapsed : $lower;
}

/** قيمة مخزّنة لحقل categories[] / cat (نفس منطق المفتاح للنصوص؛ أرقام كمعرف قسم). */
function pharma_normalize_stored_category_token(string $s): string
{
    $s = trim($s);
    if ($s === '') {
        return '';
    }
    if (ctype_digit($s)) {
        return (string) (int) $s;
    }

    return pharma_normalize_category_match_key($s);
}

/**
 * يحوّل اسم عربي (أو slug عربي) إلى slug لاتيني واحد — الاسم العربي للعرض فقط في صف الأقسام.
 *
 * @return non-empty-string|null
 */
function pharma_category_arabic_to_canonical(string $raw): ?string
{
    $collapsed = preg_replace('/[\s\-_]+/u', '', trim($raw));
    static $map = [
        'العنايةبالشعر' => 'haircare',
        'الفيتامينات' => 'vitamins',
        'الأطفال' => 'kids',
        'التجميل' => 'cosmetics',
        'العنايةبالفموالأسنان' => 'oralcare',
        'العنايةبالفم' => 'oralcare',
        'المستلزماتالطبية' => 'medical',
        'الأدوية' => 'medicine',
    ];

    return isset($map[$collapsed]) ? $map[$collapsed] : null;
}

/**
 * slug قسم موحّد للمنتجات والروابط: haircare، cosmetics، vitamins، kids، oralcare، medicine، medical…
 * يزيل slugs عربية ويستبدل المرادفات (beauty→cosmetics، baby→kids، vitamin→vitamins).
 */
function pharma_canonical_category_slug(string $token): string
{
    $t = trim($token);
    if ($t === '') {
        return '';
    }
    if (ctype_digit($t)) {
        return (string) (int) $t;
    }
    if (preg_match('/\p{Arabic}/u', $t)) {
        $fromAr = pharma_category_arabic_to_canonical($t);

        return $fromAr ?? '';
    }
    $k = pharma_normalize_stored_category_token($t);
    static $map = [
        'beauty' => 'cosmetics',
        'cosmetics' => 'cosmetics',
        'cosmetic' => 'cosmetics',
        'baby' => 'kids',
        'kids' => 'kids',
        'children' => 'kids',
        'vitamin' => 'vitamins',
        'vitamins' => 'vitamins',
        'haircare' => 'haircare',
        'medicine' => 'medicine',
        'drugs' => 'medicine',
        'medical' => 'medical',
        'oralcare' => 'oralcare',
        'oral_care' => 'oralcare',
        'skincare' => 'skincare',
        'hygiene' => 'hygiene',
        'first_aid' => 'first_aid',
        'firstaid' => 'first_aid',
    ];

    return $map[$k] ?? $k;
}

/**
 * يحدّث slugs الأقسام الرئيسية والفرعية بعد تغيير التسمية الموحّدة.
 *
 * @param array<string,mixed> $db
 */
function pharma_migrate_category_slugs_in_db(array &$db, bool &$changed): void
{
    $mapOldNew = [];
    foreach ($db['categories'] ?? [] as &$c) {
        if (!is_array($c)) {
            continue;
        }
        $old = trim((string) ($c['slug'] ?? ''));
        if ($old === '') {
            continue;
        }
        $new = pharma_canonical_category_slug($old);
        if ($new !== '' && $new !== $old) {
            $mapOldNew[$old] = $new;
            $c['slug'] = $new;
            $changed = true;
        }
    }
    unset($c);

    foreach ($db['subcategories'] ?? [] as &$s) {
        if (!is_array($s)) {
            continue;
        }
        $par = trim((string) ($s['parent'] ?? ''));
        if ($par === '') {
            continue;
        }
        if (isset($mapOldNew[$par])) {
            $s['parent'] = $mapOldNew[$par];
            $changed = true;
        } else {
            $can = pharma_canonical_category_slug($par);
            if ($can !== '' && $can !== $par) {
                $s['parent'] = $can;
                $changed = true;
            }
        }
    }
    unset($s);
}

function pharma_category_debug_enabled(): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = false;
    $e = getenv('PHARMA_CATEGORY_DEBUG');
    if ($e !== false && $e !== '') {
        $cached = filter_var($e, FILTER_VALIDATE_BOOLEAN)
            || $e === '1'
            || strtolower((string) $e) === 'true';
    }
    if (!$cached && defined('API_DEBUG') && API_DEBUG) {
        $cached = true;
    }

    return $cached;
}

function pharma_category_debug_log(string $message): void
{
    if (!pharma_category_debug_enabled()) {
        return;
    }
    error_log('[pharma-category] ' . $message);
}

function normalizeProductCategories(array $p): array {
    $cats = [];
    if (isset($p['categories']) && is_array($p['categories'])) {
        foreach ($p['categories'] as $c) {
            if (is_int($c)) {
                $cats[] = (string) $c;
            } elseif (is_string($c)) {
                $t = trim($c);
                if ($t === '') {
                    continue;
                }
                $cats[] = ctype_digit($t) ? (string) (int) $t : pharma_canonical_category_slug($t);
            }
        }
    }
    $cats = array_values(array_unique(array_filter($cats, static fn ($x) => $x !== '')));
    if ($cats !== []) {
        return $cats;
    }
    if (isset($p['cat'])) {
        if (is_int($p['cat'])) {
            return [(string) $p['cat']];
        }
        if (is_string($p['cat']) && trim($p['cat']) !== '') {
            $t = trim($p['cat']);

            return [ctype_digit($t) ? (string) (int) $t : pharma_canonical_category_slug($t)];
        }
    }
    if (isset($p['category']) && is_string($p['category']) && trim($p['category']) !== '') {
        $one = pharma_canonical_category_slug(trim($p['category']));

        return $one !== '' ? [$one] : [];
    }

    return [];
}

/**
 * يطبّق تطبيع الأقسام على مرجع منتج قبل الحفظ (add/update عبر API).
 *
 * @param array<string,mixed> $prod
 */
function pharma_apply_product_categories_canonical(array &$prod): void
{
    $cats = normalizeProductCategories($prod);
    $prod['categories'] = $cats;
    $first = $cats[0] ?? '';
    $prod['cat'] = $first;
    $prod['category'] = $first;
}

/**
 * مراجع القسم الرئيسي على المنتج (slug نصي أو معرف رقمي كسلسلة).
 *
 * @return list<string>
 */
function pharma_flat_product_category_refs(array $p): array
{
    $refs = [];
    $add = static function ($v) use (&$refs) {
        if (is_int($v)) {
            $refs[] = (string) $v;

            return;
        }
        if (is_float($v) && floor($v) == $v) {
            $refs[] = (string) (int) $v;

            return;
        }
        if (!is_string($v)) {
            return;
        }
        $t = trim($v);
        if ($t === '') {
            return;
        }
        $refs[] = ctype_digit($t) ? (string) (int) $t : pharma_canonical_category_slug($t);
    };
    if (array_key_exists('category', $p)) {
        $add($p['category']);
    }
    if (array_key_exists('cat', $p)) {
        $add($p['cat']);
    }
    if (!empty($p['categories']) && is_array($p['categories'])) {
        foreach ($p['categories'] as $c) {
            $add($c);
        }
    }

    return array_values(array_unique(array_filter($refs, static fn ($x) => $x !== '')));
}

/**
 * هل ينتمي المنتج لقسم رئيسي؟ يدعم id وslug ومطابقة بدون مراعاة حالة الأحرف.
 *
 * @param array<string,mixed> $p
 * @param array<string,mixed> $category
 */
function pharma_product_in_main_category(array $p, array $category): bool
{
    $refs = pharma_flat_product_category_refs($p);
    if ($refs === []) {
        return false;
    }
    $slugRaw = trim((string) ($category['slug'] ?? ''));
    $slugCanon = $slugRaw !== '' ? pharma_canonical_category_slug($slugRaw) : '';
    $idRaw = $category['id'] ?? null;
    $idStr = '';
    if ($idRaw !== null && $idRaw !== '') {
        $idStr = is_numeric($idRaw) ? (string) (int) $idRaw : trim((string) $idRaw);
    }

    foreach ($refs as $r) {
        if ($idStr !== '' && $r === $idStr) {
            return true;
        }
        if ($slugCanon !== '' && $r === $slugCanon) {
            return true;
        }
    }

    return false;
}

/**
 * مطابقة معلمة category في getProducts (slug أو رقم معرف القسم).
 *
 * @param array<string,mixed> $p
 */
function pharma_product_matches_category_param(array $p, string $param): bool
{
    $param = trim($param);
    if ($param === '') {
        return false;
    }
    $refs = pharma_flat_product_category_refs($p);
    $paramCanon = pharma_canonical_category_slug($param);
    $paramId = ctype_digit(preg_replace('/\s+/u', '', $param)) ? (string) (int) $param : '';

    foreach ($refs as $r) {
        if ($paramId !== '' && $r === $paramId) {
            return true;
        }
        if ($paramCanon !== '' && $r === $paramCanon) {
            return true;
        }
    }

    return false;
}

/**
 * معرفات منتجات البذرة التي أزالها المشرف عن قصد — لا تُعاد إدراجها من getDefaultProducts().
 *
 * @return array<string,true>
 */
function pharma_suppressed_seed_product_id_set(array $db): array
{
    $raw = $db['settings']['suppressed_seed_product_ids'] ?? [];
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    foreach ($raw as $id) {
        $s = trim((string) $id);
        if ($s !== '') {
            $out[$s] = true;
        }
    }

    return $out;
}

/**
 * @param array<string,true> $suppressed
 * @return list<array<string,mixed>>
 */
function pharma_default_products_excluding_suppressed(array $suppressed): array
{
    $list = [];
    foreach (getDefaultProducts() as $seed) {
        if (!is_array($seed)) {
            continue;
        }
        $sid = isset($seed['id']) ? (string) $seed['id'] : '';
        if ($sid === '' || isset($suppressed[$sid])) {
            continue;
        }
        $list[] = $seed;
    }

    return $list;
}

function normalizeDB(array &$db, bool &$changed): void {
    foreach (['customers','delivery','campaigns'] as $legacyKey) {
        if (array_key_exists($legacyKey, $db)) { unset($db[$legacyKey]); $changed = true; }
    }
    if (!isset($db['orders'])   || !is_array($db['orders']))   { $db['orders']   = []; $changed = true; }
    if (!isset($db['products']) || !is_array($db['products'])) { $db['products'] = []; $changed = true; }
    if (!isset($db['categories'])|| !is_array($db['categories'])){ $db['categories']=[]; $changed=true; }
    if (empty($db['categories'])) { $db['categories'] = getDefaultCategories(); $changed = true; }

    pharma_migrate_category_slugs_in_db($db, $changed);

    $suppressedSeeds = pharma_suppressed_seed_product_id_set($db);

    /* أول تشغيل أو متجر بلا منتجات: بذور من getDefaultProducts() (مع احترام البذور التي حُذفت يدوياً) */
    if ($db['products'] === []) {
        $db['products'] = pharma_default_products_excluding_suppressed($suppressedSeeds);
        $changed = true;
    }

    /* إضافة بذور جديدة من الكود فقط إن لم تكن موجودة ولم يُحذف معرفها سابقاً */
    $seenProductIds = [];
    foreach ($db['products'] as $ex) {
        if (is_array($ex) && isset($ex['id']) && (string) $ex['id'] !== '') {
            $seenProductIds[(string) $ex['id']] = true;
        }
    }
    foreach (getDefaultProducts() as $seed) {
        if (!is_array($seed)) {
            continue;
        }
        $sid = isset($seed['id']) ? (string) $seed['id'] : '';
        if ($sid === '' || isset($seenProductIds[$sid]) || isset($suppressedSeeds[$sid])) {
            continue;
        }
        $db['products'][] = $seed;
        $seenProductIds[$sid] = true;
        $changed = true;
    }

    foreach ($db['products'] as &$p) {
        $cats = normalizeProductCategories($p);
        $p['categories'] = $cats;
        $first = $cats[0] ?? '';
        $p['cat'] = $first;
        $p['category'] = $first;
        $p['subcategories'] = isset($p['subcategories']) && is_array($p['subcategories'])
            ? array_values(array_unique(array_map('intval', $p['subcategories'])))
            : [];
        if (!isset($p['image']) && !empty($p['img'])) {
            $p['image'] = $p['img'];
            $changed = true;
        }
        if (!isset($p['img']) && !empty($p['image'])) {
            $p['img'] = $p['image'];
        }
        if (isset($p['images']) && is_array($p['images'])) {
            $p['images'] = array_values(array_filter($p['images'], static fn ($x) => is_string($x) && trim($x) !== ''));
        }
        if (empty($p['images']) && !empty($p['image'])) {
            $p['images'] = [$p['image']];
            $changed = true;
        }
        unset($p['stars'], $p['rev']);
        if (isset($p['customerReviews']) && !is_array($p['customerReviews'])) {
            unset($p['customerReviews']); $changed = true;
        }
    }
    normalizeSettings($db, $changed);
}

function normalizeSettings(array &$db, bool &$changed): void {
    $def = getDefaultSettings();
    if (!isset($db['settings']) || !is_array($db['settings'])) {
        $db['settings'] = $def; $changed = true; return;
    }
    $cur = &$db['settings'];
    foreach ($def as $k => $v) {
        if (!array_key_exists($k, $cur)) { $cur[$k] = $v; $changed = true; }
    }
}

/**
 * يدمج بذور getDefaultSubcategories() دون حذف أقسام فرعية أضافها المشرف.
 * يُضاف صف فقط إن وُجد قسم رئيسي بنفس slug وليس لديه بعد قسم فرعي بنفس الاسم.
 */
function mergeSubcategorySeedsIntoDb(array &$db, bool &$changed): void {
    if (!isset($db['subcategories']) || !is_array($db['subcategories'])) {
        $db['subcategories'] = [];
        $changed = true;
    }
    $cats = $db['categories'] ?? [];
    $slugSet = [];
    foreach ($cats as $c) {
        $sl = trim((string) ($c['slug'] ?? ''));
        if ($sl !== '') {
            $slugSet[$sl] = true;
        }
    }
    if ($slugSet === []) {
        return;
    }

    $subs = &$db['subcategories'];
    $usedIds = [];
    $keySeen = [];
    foreach ($subs as $s) {
        $id = (int) ($s['id'] ?? 0);
        if ($id > 0) {
            $usedIds[$id] = true;
        }
        $p = (string) ($s['parent'] ?? '');
        $nm = adminNormCatName((string) ($s['name'] ?? ''));
        if ($p !== '' && $nm !== '') {
            $keySeen[$p . '|' . $nm] = true;
        }
    }
    $maxId = 0;
    foreach (array_keys($usedIds) as $id) {
        $maxId = max($maxId, (int) $id);
    }

    foreach (getDefaultSubcategories() as $tpl) {
        $p = (string) ($tpl['parent'] ?? '');
        if ($p === '' || !isset($slugSet[$p])) {
            continue;
        }
        $nameRaw = trim((string) ($tpl['name'] ?? ''));
        if ($nameRaw === '') {
            continue;
        }
        $nm = adminNormCatName($nameRaw);
        $key = $p . '|' . $nm;
        if (isset($keySeen[$key])) {
            continue;
        }

        $id = (int) ($tpl['id'] ?? 0);
        if ($id <= 0 || isset($usedIds[$id])) {
            $maxId++;
            while (isset($usedIds[$maxId])) {
                $maxId++;
            }
            $id = $maxId;
        }
        $usedIds[$id] = true;
        $keySeen[$key] = true;
        $subs[] = [
            'id' => $id,
            'name' => $nameRaw,
            'parent' => $p,
            'icon' => $tpl['icon'] ?? '📁',
            'active' => $tpl['active'] ?? true,
        ];
        $changed = true;
    }

    usort($subs, static fn ($a, $b) => ((int) ($a['id'] ?? 0)) - ((int) ($b['id'] ?? 0)));
}

function normalizeSubcategories(array &$db, bool &$changed): void {
    mergeSubcategorySeedsIntoDb($db, $changed);
}

/** إزالة معرفات أقسام فرعية محذوفة من المنتجات */
function pruneProductSubcategoryRefs(array &$db, bool &$changed): void {
    $valid = [];
    foreach ($db['subcategories'] ?? [] as $s) {
        $id = (int) ($s['id'] ?? 0);
        if ($id > 0) {
            $valid[$id] = true;
        }
    }
    foreach ($db['products'] ?? [] as &$p) {
        if (!isset($p['subcategories']) || !is_array($p['subcategories'])) {
            continue;
        }
        $old = $p['subcategories'];
        $p['subcategories'] = array_values(array_unique(array_filter(
            array_map('intval', $p['subcategories']),
            static fn ($id) => isset($valid[$id])
        )));
        if ($old != $p['subcategories']) {
            $changed = true;
        }
    }
    unset($p);
}

/** الدمج الفعلي في normalizeSubcategories() */
function ensureMinimumSubcategoriesPerMain(array &$db, bool &$changed): void {
}
