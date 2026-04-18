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
    'assets/js/dist/utils.min.js',
    'assets/js/dist/ui.min.js',
    'assets/js/dist/api.min.js',
    'assets/js/dist/main.min.js',
    'assets/js/dist/admin.min.js',
    'assets/js/app.js',
    'assets/css/dist/shop-bundle.min.css',
    'assets/css/dist/store-enhancements.min.css',
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
