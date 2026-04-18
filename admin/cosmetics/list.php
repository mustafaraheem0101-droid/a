<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/_auth.php';
if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(403);
    exit;
}
$CATEGORY = 'cosmetics';
require ROOT_DIR . '/admin/_list_drugs.php';
