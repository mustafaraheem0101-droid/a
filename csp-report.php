<?php
/**
 * csp-report.php — يستقبل تقارير انتهاكات CSP من المتصفح
 * أضف هذا إلى CSP: report-uri /csp-report.php
 * 
 * الاستخدام: أضف إلى CSP header:
 *   report-uri /csp-report.php
 *   أو (حديث): report-to csp-endpoint
 */
declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (
    strpos($contentType, 'application/csp-report') === false &&
    strpos($contentType, 'application/json') === false
) {
    http_response_code(400);
    exit;
}

$raw = file_get_contents('php://input');
if (empty($raw) || strlen($raw) > 10240) {
    http_response_code(400);
    exit;
}

$report = json_decode($raw, true);
if (!is_array($report)) {
    http_response_code(400);
    exit;
}

// تجاهل التقارير من extensions المتصفح (chrome-extension://, moz-extension://)
$blockedUri = $report['csp-report']['blocked-uri'] ?? '';
if (strpos($blockedUri, '-extension://') !== false) {
    http_response_code(204);
    exit;
}

// سجّل الانتهاك
$logDir  = __DIR__ . '/private_data/logs/';
$logFile = $logDir . 'csp-violations-' . date('Y-m') . '.log';

if (is_dir($logDir)) {
    $entry = [
        'time'            => date('Y-m-d H:i:s'),
        'ip'              => substr(hash('sha256', $_SERVER['REMOTE_ADDR'] ?? ''), 0, 12), // IP مُجزَّأ للخصوصية
        'blocked-uri'     => $blockedUri,
        'violated-directive' => $report['csp-report']['violated-directive'] ?? '',
        'document-uri'    => $report['csp-report']['document-uri'] ?? '',
        'referrer'        => $report['csp-report']['referrer'] ?? '',
    ];
    file_put_contents($logFile, json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

http_response_code(204);
exit;
