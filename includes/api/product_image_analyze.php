<?php
/**
 * استخراج بيانات منتج من صورة عبوة (Vision) — يتطلب GEMINI_API_KEY أو OPENAI_API_KEY في .env
 */
declare(strict_types=1);

/**
 * @return array{mime:string, binary:string}
 */
function pharma_api_decode_packaging_image(array $rawBody): array
{
    $img = $rawBody['image'] ?? $rawBody['imageBase64'] ?? '';
    if (!is_string($img)) {
        jsonError('أرسل حقل image كسلسلة (data URL أو base64)', [], 400);
    }
    $img = trim($img);
    if ($img === '') {
        jsonError('صورة المنتج مطلوبة', [], 400);
    }
    if (preg_match('#^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$#s', $img, $m)) {
        $mime = strtolower($m[1]);
        $bin = base64_decode(str_replace(["\r", "\n", ' '], '', $m[2]), true);
        if ($bin === false || $bin === '') {
            jsonError('فك تشفير الصورة فشل', [], 400);
        }

        return ['mime' => $mime, 'binary' => $bin];
    }
    $raw = preg_replace('#\s#', '', $img);
    if (strlen($raw) < 80) {
        jsonError('صورة غير صالحة أو قصيرة جداً', [], 400);
    }
    $bin = base64_decode($raw, true);
    if ($bin === false || $bin === '') {
        jsonError('صورة غير صالحة (توقع data:image/...;base64,...)', [], 400);
    }

    return ['mime' => 'image/jpeg', 'binary' => $bin];
}

/**
 * أول سلسلة غير فارغة من قائمة مفاتيح (لتفادي اختلاف تسميات JSON بين النماذج).
 */
function pharma_api_packaging_first_string(array $j, array $keys): string
{
    foreach ($keys as $k) {
        if (!isset($j[$k])) {
            continue;
        }
        $s = trim((string) $j[$k]);
        if ($s !== '') {
            return $s;
        }
    }

    return '';
}

/**
 * @return array<string, mixed>
 */
function pharma_api_normalize_packaging_ai_json(array $j): array
{
    $pt = isset($j['product_type']) ? strtolower((string) $j['product_type']) : '';
    $allowedPt = ['medicine', 'cosmetic', 'device', 'supplement', 'other'];
    if (!in_array($pt, $allowedPt, true)) {
        $pt = 'other';
    }
    $slugs = [];
    if (isset($j['main_category_slugs']) && is_array($j['main_category_slugs'])) {
        foreach ($j['main_category_slugs'] as $s) {
            $s = strtolower(trim((string) $s));
            $aliases = [
                'medicines' => 'medicine',
                'drugs' => 'medicine',
                'vitamin' => 'vitamins',
                'cosmetics' => 'cosmetics',
                'beauty' => 'cosmetics',
                'kids' => 'kids',
                'children' => 'kids',
                'baby' => 'kids',
                'devices' => 'medical',
            ];
            if (isset($aliases[$s])) {
                $s = $aliases[$s];
            }
            if ($s !== '') {
                $slugs[] = $s;
            }
        }
        $slugs = array_values(array_unique($slugs));
    }

    $age = pharma_api_packaging_first_string($j, [
        'age',
        'age_group',
        'age_range',
        'age_restriction',
    ]);
    $storage = pharma_api_packaging_first_string($j, [
        'storage',
        'storage_instructions',
        'keep',
        'keep_conditions',
    ]);

    /* إن بقي الحقلان فارغين بعد الاستخراج — جمل عربية قياسية آمنة للواجهة */
    if ($age === '') {
        $age = 'راجع النشرة أو العبوة لتحديد الفئة العمرية، أو استشر الصيدلاني.';
    }
    if ($storage === '') {
        $storage = 'يُحفظ في مكان بارد وجاف، بعيداً عن الحرارة المباشرة والرطوبة ومتناول الأطفال.';
    }

    return [
        'name_ar' => isset($j['name_ar']) ? trim((string) $j['name_ar']) : '',
        'brand' => isset($j['brand']) ? trim((string) $j['brand']) : '',
        'desc' => isset($j['desc']) ? trim((string) $j['desc']) : '',
        'usage' => isset($j['usage']) ? trim((string) $j['usage']) : '',
        'dose' => isset($j['dose']) ? trim((string) $j['dose']) : '',
        'frequency' => isset($j['frequency']) ? trim((string) $j['frequency']) : '',
        'age' => $age,
        'storage' => $storage,
        'warnings' => isset($j['warnings']) ? trim((string) $j['warnings']) : '',
        'ingredients' => isset($j['ingredients']) ? trim((string) $j['ingredients']) : '',
        'contraindications' => isset($j['contraindications']) ? trim((string) $j['contraindications']) : '',
        'product_type' => $pt,
        'main_category_slugs' => $slugs,
        'quantity_label' => isset($j['quantity_label']) ? trim((string) $j['quantity_label']) : '',
    ];
}

function pharma_api_json_from_ai_text(string $text): array
{
    $text = trim($text);
    if ($text === '') {
        return [];
    }
    $decoded = json_decode($text, true);
    if (is_array($decoded)) {
        return $decoded;
    }
    if (preg_match('/\{[\s\S]*\}/', $text, $m)) {
        $decoded = json_decode($m[0], true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    return [];
}

/**
 * رسالة خطأ أوضح للواجهة عند فشل Gemini (بدون كشف تفاصيل كاملة إلا مع API_DEBUG).
 */
function pharma_gemini_friendly_error(string $googleMessage, int $http): string
{
    $m = strtolower($googleMessage);
    if (str_contains($m, 'api key') || str_contains($m, 'invalid') || str_contains($m, 'permission') || $http === 403) {
        return 'مفتاح GEMINI_API_KEY غير صالح أو غير مفعّل لـ Generative Language API — راجع Google AI Studio.';
    }
    if (str_contains($m, 'not found') || str_contains($m, 'does not exist') || $http === 404) {
        return 'اسم النموذج أو إصدار الـ API غير متاح. جرّب في .env: GEMINI_API_VERSION=v1 ثم GEMINI_VISION_MODEL=gemini-2.0-flash-001 — أو فعّل API_DEBUG=1 لرؤية الخطأ من Google.';
    }
    if (str_contains($m, 'billing') || str_contains($m, 'quota')) {
        return 'حد الاستخدام أو الفوترة في مشروع Google — راجع لوحة Google Cloud.';
    }

    return 'فشل تحليل الصورة عبر Gemini. إن استمر الخطأ: عيّن API_DEBUG=1 مؤقتاً في .env لرؤية تفاصيل الخطأ.';
}

/**
 * جلب معرفات النماذج التي تدعم generateContent من واجهة Google (ListModels) — يحل اختلاف أسماء النماذج بين الحسابات.
 *
 * @return list<string>
 */
function pharma_gemini_list_generative_model_ids(string $apiKey, string $apiVersion): array
{
    $ver = ($apiVersion === 'v1') ? 'v1' : 'v1beta';
    $found = [];
    $pageToken = '';
    for ($guard = 0; $guard < 12; $guard++) {
        $query = 'pageSize=100&key=' . rawurlencode($apiKey);
        if ($pageToken !== '') {
            $query .= '&pageToken=' . rawurlencode($pageToken);
        }
        $url = 'https://generativelanguage.googleapis.com/' . $ver . '/models?' . $query;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPGET => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_CONNECTTIMEOUT => 12,
        ]);
        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($resp === false || $code !== 200) {
            break;
        }
        $j = json_decode((string) $resp, true);
        if (!is_array($j) || empty($j['models']) || !is_array($j['models'])) {
            break;
        }
        foreach ($j['models'] as $m) {
            if (!is_array($m)) {
                continue;
            }
            $methods = $m['supportedGenerationMethods'] ?? [];
            if (!is_array($methods) || !in_array('generateContent', $methods, true)) {
                continue;
            }
            $name = isset($m['name']) ? (string) $m['name'] : '';
            if ($name === '' || !preg_match('#/([^/]+)$#', $name, $mm)) {
                continue;
            }
            $short = $mm[1];
            if (stripos($short, 'gemini') === false && stripos($short, 'gemma') === false) {
                continue;
            }
            if (stripos($short, 'embedding') !== false) {
                continue;
            }
            $found[] = $short;
        }
        $pageToken = isset($j['nextPageToken']) && is_string($j['nextPageToken']) ? $j['nextPageToken'] : '';
        if ($pageToken === '') {
            break;
        }
    }

    return array_values(array_unique($found));
}

/**
 * ترتيب النماذج: Flash و2.x أولاً (مناسبة للصور والسرعة).
 *
 * @param list<string> $ids
 *
 * @return list<string>
 */
function pharma_gemini_sort_model_candidates(array $ids): array
{
    $score = static function (string $id): int {
        $l = strtolower($id);
        if (str_contains($l, 'embedding')) {
            return -999;
        }
        $s = 0;
        if (str_contains($l, 'flash')) {
            $s += 80;
        }
        if (str_contains($l, '2.0') || str_contains($l, '2-0') || str_contains($l, '2.5')) {
            $s += 60;
        }
        if (str_contains($l, '1.5')) {
            $s += 40;
        }
        if (str_contains($l, 'pro') && !str_contains($l, 'flash')) {
            $s += 15;
        }

        return $s;
    };
    $ids = array_values(array_unique($ids));
    usort($ids, static function ($a, $b) use ($score) {
        return $score($b) <=> $score($a);
    });

    return $ids;
}

/**
 * طلب واحد إلى Gemini؛ يعيد ['ok'=>bool, 'http'=>int, 'body'=>array, 'curl_err'=>string, 'text_out'=>string]
 *
 * @return array{ok:bool, http:int, body:array, curl_err:string, text_out:string}
 */
function pharma_gemini_generate_attempt(string $mime, string $binary, string $apiKey, string $model, bool $jsonMimeResponse, string $apiVersion): array
{
    $ver = ($apiVersion === 'v1') ? 'v1' : 'v1beta';
    $url = 'https://generativelanguage.googleapis.com/' . $ver . '/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);

    $prompt = <<<'PROMPT'
You assist a pharmacy admin in Iraq. Read the product packaging image carefully. Output ONE JSON object only (no markdown).

Language rule (mandatory): All human-readable text in these keys MUST be in Modern Standard Arabic (فصحى بسيطة واضحة لزبائن الصيدلية). If the pack is only in English or mixed, translate into Arabic. Do not leave English sentences in those fields.
Exception: keep brand names and international nonproprietary / chemical names as commonly printed (Latin letters OK: e.g. EPA, DHA, mg, µg, IU). Arabic explanations around them are preferred.

Keys (all strings except arrays):
- name_ar: full product title for the web store (Arabic)
- brand: brand name as on pack, or ""
- desc: 2-4 sentences in Arabic: what the product is and main benefit
- usage: indications in Arabic
- dose: dosing in Arabic if visible, else ""
- frequency: in Arabic (e.g. مرتان يومياً), else ""
- age: age group / who may use — Arabic, copied from pack if printed. If not printed, infer one short line from icons or product type (e.g. للبالغين، من 12 سنة فأكثر، للأطفال). Never leave empty.
- storage: how to store — Arabic, copied from pack if printed. If not printed, give one standard Arabic line (e.g. بارد وجاف، بعيداً عن الشمس والرطوبة ومتناول الأطفال). Never leave empty.
- warnings: warnings in Arabic if any, else ""
- ingredients: active ingredients / composition in Arabic; keep standard Latin chemical abbreviations where usual
- contraindications: who should not use, in Arabic, else ""
- product_type: exactly one of: medicine, cosmetic, device, supplement, other
- main_category_slugs: array of 1-3 slugs from: medicine, medical, cosmetics, haircare, oralcare, vitamins, kids — pick what fits
- quantity_label: pack size in Arabic if visible (e.g. 30 كبسولة), else ""
PROMPT;

    $generationConfig = [
        'temperature' => 0.15,
    ];
    if ($jsonMimeResponse) {
        $generationConfig['responseMimeType'] = 'application/json';
    }

    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt],
                    [
                        'inline_data' => [
                            'mime_type' => $mime,
                            'data' => base64_encode($binary),
                        ],
                    ],
                ],
            ],
        ],
        'generationConfig' => $generationConfig,
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = (string) curl_error($ch);
    curl_close($ch);

    if ($resp === false || $resp === '') {
        return ['ok' => false, 'http' => $code > 0 ? $code : 0, 'body' => [], 'curl_err' => $err !== '' ? $err : 'empty response', 'text_out' => ''];
    }

    $j = json_decode((string) $resp, true);
    if (!is_array($j)) {
        return ['ok' => false, 'http' => $code, 'body' => [], 'curl_err' => 'invalid json', 'text_out' => ''];
    }

    if ($code >= 400) {
        return ['ok' => false, 'http' => $code, 'body' => $j, 'curl_err' => '', 'text_out' => ''];
    }

    $text = '';
    if (isset($j['candidates'][0]['content']['parts']) && is_array($j['candidates'][0]['content']['parts'])) {
        foreach ($j['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['text']) && is_string($part['text'])) {
                $text .= $part['text'];
            }
        }
    }

    return ['ok' => true, 'http' => $code, 'body' => $j, 'curl_err' => '', 'text_out' => $text];
}

/**
 * @return array<string, mixed>
 */
function pharma_gemini_packaging_json(string $mime, string $binary, string $apiKey): array
{
    $apiKey = trim($apiKey);
    if ($apiKey === '') {
        jsonError('مفتاح Gemini فارغ بعد القص', [], 500);
    }

    $envModel = trim((string) env('GEMINI_VISION_MODEL', ''));
    /* 1) ما يحدده المستخدم  2) نماذج مكتشفة من ListModels (أسماء حقيقية لحسابك)  3) قائمة احتياطية ثابتة */
    $models = [];
    if ($envModel !== '') {
        $models[] = $envModel;
    }
    $discovered = [];
    foreach (['v1', 'v1beta'] as $listVer) {
        $discovered = array_merge($discovered, pharma_gemini_list_generative_model_ids($apiKey, $listVer));
    }
    $discovered = pharma_gemini_sort_model_candidates($discovered);
    foreach ($discovered as $mid) {
        if (!in_array($mid, $models, true)) {
            $models[] = $mid;
        }
    }
    foreach ([
        'gemini-2.0-flash-001',
        'gemini-2.0-flash',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-8b',
        'gemini-1.5-flash',
        'gemini-flash-latest',
    ] as $m) {
        if (!in_array($m, $models, true)) {
            $models[] = $m;
        }
    }

    $envVer = strtolower(trim((string) env('GEMINI_API_VERSION', '')));
    $apiVersions = [];
    if ($envVer === 'v1' || $envVer === 'v1beta') {
        $apiVersions[] = $envVer;
    }
    foreach (['v1', 'v1beta'] as $v) {
        if (!in_array($v, $apiVersions, true)) {
            $apiVersions[] = $v;
        }
    }

    /* تجنّب مهلة PHP عند وجود عشرات النماذج في الحساب */
    $models = array_slice($models, 0, 28);

    $lastGoogleMsg = '';
    $lastHttp = 0;

    foreach ($apiVersions as $apiVer) {
    foreach ($models as $model) {
        foreach ([true, false] as $jsonMode) {
            $r = pharma_gemini_generate_attempt($mime, $binary, $apiKey, $model, $jsonMode, $apiVer);
            $lastHttp = $r['http'];

            if (!empty($r['curl_err']) && $r['curl_err'] !== 'invalid json') {
                jsonError(API_DEBUG ? ('Gemini cURL: ' . $r['curl_err']) : 'تعذر الاتصال بخدمة Google (تحقق من الشبكة أو جدار الحماية)', [], 502);
            }

            if ($r['ok'] && $r['text_out'] !== '') {
                $parsed = pharma_api_json_from_ai_text($r['text_out']);
                if ($parsed !== []) {
                    return pharma_api_normalize_packaging_ai_json($parsed);
                }
            }

            if (!$r['ok']) {
                $body = $r['body'];
                $lastGoogleMsg = isset($body['error']['message']) ? (string) $body['error']['message'] : '';
                if ($lastGoogleMsg === '' && !empty($r['curl_err'])) {
                    $lastGoogleMsg = $r['curl_err'];
                }
                if ($lastHttp === 401 || $lastHttp === 403) {
                    jsonError(
                        API_DEBUG ? $lastGoogleMsg : pharma_gemini_friendly_error($lastGoogleMsg, $lastHttp),
                        [],
                        502
                    );
                }
                /* 404 = اسم نموذج خاطئ — جرّب النموذج التالي مباشرة */
                if ($lastHttp === 404) {
                    break 1;
                }
                /* 400 غالباً بسبب responseMimeType — أعد المحاولة بدون JSON schema */
                if ($lastHttp === 400 && $jsonMode) {
                    continue;
                }
                /* فشل بدون خيار آخر لهذا النموذج */
                break 1;
            }

            /* HTTP 200 لكن نص فارغ أو JSON فارغ */
            if ($r['ok'] && $r['text_out'] === '') {
                $lastGoogleMsg = 'empty candidates or blocked content';
                break 1;
            }
        }
    }
    }

    $detail = $lastGoogleMsg !== '' ? $lastGoogleMsg : ('HTTP ' . (string) $lastHttp);
    jsonError(
        API_DEBUG ? $detail : pharma_gemini_friendly_error($detail, $lastHttp),
        [],
        502
    );
}

/**
 * @return array<string, mixed>
 */
function pharma_openai_packaging_json(string $mime, string $binary, string $apiKey): array
{
    $model = trim((string) env('OPENAI_VISION_MODEL', 'gpt-4o-mini'));
    if ($model === '') {
        $model = 'gpt-4o-mini';
    }
    $dataUrl = 'data:' . $mime . ';base64,' . base64_encode($binary);

    $prompt = <<<'PROMPT'
Read this pharmacy product packaging. Reply with ONE JSON object only, no markdown.
Keys: name_ar, brand, desc, usage, dose, frequency, age, storage, warnings, ingredients, contraindications,
product_type (medicine|cosmetic|device|supplement|other),
main_category_slugs (array of slugs from: medicine, medical, cosmetics, haircare, oralcare, vitamins, kids),
quantity_label.

Mandatory: name_ar, desc, usage, dose, frequency, age, storage, warnings, ingredients, contraindications, and quantity_label must be in Modern Standard Arabic (clear for Iraqi pharmacy customers). If text on the pack is English only, translate it into Arabic. Do not output English prose in those fields. Keep brand names and usual Latin chemical names/units (EPA, DHA, mg, µg) as printed.

For "age" and "storage": always output non-empty Arabic strings. Copy from the pack when visible; otherwise infer a short sensible line (age from icons/audience; storage as standard cool/dry/away from children).
PROMPT;

    $payload = [
        'model' => $model,
        'temperature' => 0.15,
        'response_format' => ['type' => 'json_object'],
        'messages' => [
            [
                'role' => 'user',
                'content' => [
                    ['type' => 'text', 'text' => $prompt],
                    ['type' => 'image_url', 'image_url' => ['url' => $dataUrl]],
                ],
            ],
        ],
    ];

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($resp === false || $resp === '') {
        jsonError('تعذر الاتصال بـ OpenAI', [], 502);
    }
    $j = json_decode((string) $resp, true);
    if (!is_array($j)) {
        jsonError(API_DEBUG ? ('OpenAI: ' . substr((string) $resp, 0, 400)) : 'استجابة OpenAI غير صالحة', [], 502);
    }
    if ($code >= 400) {
        $msg = isset($j['error']['message']) ? (string) $j['error']['message'] : ('HTTP ' . $code);
        jsonError(API_DEBUG ? $msg : 'فشل تحليل الصورة (OpenAI)', [], 502);
    }
    $text = (string) ($j['choices'][0]['message']['content'] ?? '');
    $parsed = pharma_api_json_from_ai_text($text);
    if ($parsed === []) {
        jsonError('لم يُستخرج JSON من OpenAI', [], 422);
    }

    return pharma_api_normalize_packaging_ai_json($parsed);
}

/**
 * @return array<string, mixed>
 */
function pharma_api_run_packaging_analysis(array $rawBody): array
{
    $decoded = pharma_api_decode_packaging_image($rawBody);
    $bin = $decoded['binary'];
    if (strlen($bin) > 6 * 1024 * 1024) {
        jsonError('حجم الصورة يتجاوز 6 ميجابايت', [], 400);
    }
    $mime = $decoded['mime'];
    if (!preg_match('#^image/(jpeg|png|gif|webp)$#', $mime)) {
        $mime = 'image/jpeg';
    }

    $gem = trim((string) env('GEMINI_API_KEY', ''));
    $oai = trim((string) env('OPENAI_API_KEY', ''));
    if ($gem !== '') {
        return pharma_gemini_packaging_json($mime, $bin, $gem);
    }
    if ($oai !== '') {
        return pharma_openai_packaging_json($mime, $oai);
    }
    jsonError(
        'لم يُضبط مفتاح تحليل الصور: أضف GEMINI_API_KEY أو OPENAI_API_KEY في ملف .env على الخادم (مجلد المشروع أو private_data/.env).',
        [],
        503
    );
}
