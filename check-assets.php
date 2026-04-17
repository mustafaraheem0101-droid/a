<?php
// Diagnostic file - DELETE AFTER CHECKING
// Visit: https://pharma-store.me/check-assets.php
header('Content-Type: text/plain; charset=utf-8');
echo "=== SERVER DIAGNOSTIC ===\n\n";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "\n";
echo "Script Filename: " . $_SERVER['SCRIPT_FILENAME'] . "\n";
echo "PHP SAPI: " . php_sapi_name() . "\n\n";

echo "=== ASSET FILE CHECK ===\n";
$files = [
    'assets/js/utils.js',
    'assets/js/ui.js',
    'assets/js/api.js',
    'assets/js/main.js',
    'assets/js/admin.js',
    'assets/js/app.js',
    'assets/css/shop-bundle.css',
    'assets/css/admin.css',
    '.htaccess',
];
foreach ($files as $f) {
    $path = __DIR__ . '/' . $f;
    $exists = file_exists($path);
    $size = $exists ? filesize($path) : 0;
    echo ($exists ? "✅" : "❌") . " $f" . ($exists ? " ($size bytes)" : " MISSING") . "\n";
}

echo "\n=== DIRECTORY LISTING ===\n";
$dirs = ['assets', 'assets/js', 'assets/css'];
foreach ($dirs as $d) {
    $path = __DIR__ . '/' . $d;
    if (is_dir($path)) {
        $count = count(glob($path . '/*'));
        echo "✅ $d/ exists ($count files)\n";
    } else {
        echo "❌ $d/ MISSING\n";
    }
}
