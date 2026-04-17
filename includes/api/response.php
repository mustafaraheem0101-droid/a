<?php
/**
 * استجابات JSON موحّدة لـ api.php
 *
 * يُحمّل بعد تعريف API_DEBUG والثوابت المشتركة.
 */
declare(strict_types=1);

/**
 * @param string               $status  success|error
 * @param array|\stdClass|list $data
 */
function jsonResponse(string $status, $data = [], string $message = '', ?int $httpCode = null): void
{
    if ($httpCode !== null) {
        http_response_code($httpCode);
    }
    $payload = ['status' => $status, 'data' => $data, 'message' => $message];
    if ($status === 'error' && defined('API_DEBUG') && API_DEBUG && isset($GLOBALS['__api_debug_detail'])) {
        $payload['debug'] = $GLOBALS['__api_debug_detail'];
    }
    $flags = JSON_UNESCAPED_UNICODE;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
    }
    echo json_encode($payload, $flags);
    exit;
}

function jsonSuccess($data = [], string $message = ''): void
{
    jsonResponse('success', $data, $message);
}

function jsonError(string $message, array $data = [], int $http = 400): void
{
    jsonResponse('error', $data, $message, $http);
}

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err === null) {
        return;
    }
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($err['type'], $fatalTypes, true)) {
        return;
    }
    if (headers_sent()) {
        return;
    }
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    $msg = 'خطأ فادح في الخادم';
    if (defined('API_DEBUG') && API_DEBUG) {
        $msg = $err['message'] . ' in ' . $err['file'] . ':' . $err['line'];
    }
    echo json_encode(['status' => 'error', 'data' => [], 'message' => $msg], JSON_UNESCAPED_UNICODE);
});

/**
 * @param array<string,mixed> $body
 * @return array<string,mixed>
 */
function normalize_product_payload(array $body): array
{
    if (isset($body['product']) && is_array($body['product'])) {
        return $body['product'];
    }

    return $body;
}

/** مسار صورة تقييم مرفوعة عبر upload_review_image فقط */
function pharma_sanitize_review_image_url(string $url): string
{
    $url = trim($url);
    if ($url === '' || strlen($url) > 512) {
        return '';
    }
    if (!preg_match('#^/images/review_[a-zA-Z0-9._-]+\.(jpe?g|png|gif|webp)$#i', $url)) {
        return '';
    }

    return $url;
}
