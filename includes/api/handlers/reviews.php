<?php
/**
 * includes/api/handlers/reviews.php
 * معالج التقييمات
 */
declare(strict_types=1);

function handle_reviews(string $action, array $body, array $rawBody, string $clientIP, string $method): void
{
    switch ($action) {

        case 'get_reviews':
        case 'getReviews':
            try {
                if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
                $params = pharma_api_public_params($body);
                $pid    = pharma_sanitize_product_id_for_review((string)($params['product_id'] ?? ''));
                if ($pid === '') { jsonError('product_id مطلوب'); }
                $pdo     = pharma_require_pdo();
                $reviews = pharma_db_fetch_reviews_for_product($pdo, $pid, true);
                $stats   = pharma_db_review_stats_for_product($pdo, $pid);
                jsonSuccess(['reviews' => $reviews, 'stats' => $stats], '');
            } catch (Throwable $e) {
                error_log('[api getReviews] ' . $e->getMessage());
                jsonError(API_DEBUG ? $e->getMessage() : 'تعذر جلب التقييمات', [], 500);
            }
            break;

        case 'submit_review':
        case 'addReview':
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            try {
                if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
                $pid      = pharma_sanitize_product_id_for_review((string)($rawBody['product_id'] ?? ''));
                $name     = isset($rawBody['name']) && is_string($rawBody['name'])
                    ? mb_substr(strip_tags($rawBody['name']), 0, 120, 'UTF-8') : '';
                $city     = isset($rawBody['city']) && is_string($rawBody['city'])
                    ? mb_substr(strip_tags($rawBody['city']), 0, 80, 'UTF-8') : '';
                $rating   = max(1, min(5, (int)($rawBody['rating'] ?? 5)));
                $comment  = isset($rawBody['comment']) && is_string($rawBody['comment'])
                    ? mb_substr(strip_tags($rawBody['comment']), 0, 500, 'UTF-8') : '';
                $imageRaw = isset($rawBody['image_url']) && is_string($rawBody['image_url']) ? $rawBody['image_url'] : '';
                $imageUrl = pharma_sanitize_review_image_url($imageRaw);
                if ($pid === '' || $name === '') { jsonError('يرجى إدخال الاسم وربط المنتج'); }
                $pdo = pharma_require_pdo();
                if (!pharma_db_product_exists($pdo, $pid)) { jsonError('المنتج غير موجود', [], 404); }
                if (!checkReviewSubmitRateLimit($clientIP, $pid)) {
                    jsonError('يرجى الانتظار بضع دقائق قبل إرسال تقييم آخر');
                }
                $id = pharma_db_insert_review($pdo, $pid, $name, $city, $rating, $comment, $imageUrl);
                if ($id === null) { jsonError('تعذر حفظ التقييم في قاعدة البيانات', [], 500); }
                logActivity('REVIEW_SUBMIT', 'تقييم جديد للمنتج ' . $pid, $clientIP);
                jsonSuccess(['id' => $id], 'شكراً! سيُعرض تقييمك بعد موافقة الإدارة.');
            } catch (Throwable $e) {
                error_log('[api addReview] ' . $e->getMessage());
                jsonError(API_DEBUG ? $e->getMessage() : 'تعذر حفظ التقييم', [], 500);
            }
            break;

        case 'review_vote':
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            try {
                if (getPdo() === null) { jsonError('قاعدة البيانات غير متوفرة', [], 503); }
                $rid = isset($rawBody['review_id']) ? preg_replace('/[^a-zA-Z0-9_]/', '', (string)$rawBody['review_id']) : '';
                $dir = isset($rawBody['dir']) && in_array($rawBody['dir'], ['up', 'down'], true) ? $rawBody['dir'] : '';
                if ($rid === '' || $dir === '') { jsonError('بيانات غير صالحة'); }
                $pdo    = pharma_require_pdo();
                $counts = pharma_db_review_vote($pdo, $rid, $dir);
                if ($counts === null) { jsonError('المراجعة غير متاحة أو غير موجودة', [], 404); }
                jsonSuccess(['helpful_up' => $counts['helpful_up'], 'helpful_down' => $counts['helpful_down']], '');
            } catch (Throwable $e) {
                error_log('[api review_vote] ' . $e->getMessage());
                jsonError(API_DEBUG ? $e->getMessage() : 'تعذر حفظ التصويت', [], 500);
            }
            break;

        case 'admin_get_reviews':
            checkAuth($clientIP);
            jsonSuccess(['reviews' => loadReviews()], '');
            break;

        case 'admin_save_reviews':
            checkAuth($clientIP);
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            $list = $rawBody['reviews'] ?? null;
            if (!is_array($list)) { jsonError('قائمة غير صالحة'); }
            $clean = [];
            foreach ($list as $r) {
                if (!is_array($r)) { continue; }
                $id = isset($r['id']) ? preg_replace('/[^a-zA-Z0-9_]/', '', (string)$r['id']) : '';
                if ($id === '') { $id = 'r' . bin2hex(random_bytes(8)); }
                $pid        = pharma_sanitize_product_id_for_review((string)($r['product_id'] ?? $r['product'] ?? ''));
                $imgAdmin   = isset($r['image_url']) && is_string($r['image_url']) ? trim($r['image_url']) : '';
                if (!($imgAdmin !== '' && strlen($imgAdmin) <= 512 && preg_match('#^/images/[a-zA-Z0-9._/-]+$#', $imgAdmin))) {
                    $imgAdmin = '';
                }
                $replyRaw   = $r['pharmacist_reply'] ?? null;
                $replyClean = ($replyRaw !== null && is_string($replyRaw))
                    ? mb_substr(strip_tags($replyRaw), 0, 2000, 'UTF-8') : '';
                $clean[] = [
                    'id'               => $id,
                    'product_id'       => $pid,
                    'name'             => isset($r['name']) && is_string($r['name']) ? mb_substr(strip_tags($r['name']), 0, 120, 'UTF-8') : '',
                    'city'             => isset($r['city']) && is_string($r['city']) ? mb_substr(strip_tags($r['city']), 0, 80, 'UTF-8') : '',
                    'rating'           => max(1, min(5, (int)($r['rating'] ?? 5))),
                    'comment'          => isset($r['comment']) && is_string($r['comment']) ? mb_substr(strip_tags($r['comment']), 0, 2000, 'UTF-8') : '',
                    'image_url'        => $imgAdmin,
                    'pharmacist_reply' => $replyClean !== '' ? $replyClean : null,
                    'date'             => isset($r['date']) && is_string($r['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['date']) ? $r['date'] : date('Y-m-d'),
                    'verified'         => !empty($r['verified']),
                    'approved'         => !empty($r['approved']),
                    'helpful_up'       => max(0, (int)($r['helpful_up'] ?? 0)),
                    'helpful_down'     => max(0, (int)($r['helpful_down'] ?? 0)),
                ];
            }
            if (!saveReviews($clean)) { jsonError('تعذر حفظ المراجعات في قاعدة البيانات'); }
            logActivity('REVIEWS_SAVE', 'تحديث المراجعات', $clientIP);
            jsonSuccess(['reviews' => $clean], '');
            break;

        default:
            jsonError("action غير معروف في handle_reviews: $action", [], 400);
    }
}
