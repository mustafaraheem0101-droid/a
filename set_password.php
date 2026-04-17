<?php
/**
 * set_password.php — تعيين كلمة مرور جديدة مباشرة
 * ارفعه على public_html، افتحه في المتصفح، ثم يحذف نفسه تلقائياً
 */
 
$newPassword = 'Admin@2026#Pharma';
 
// تحديد مسار الهاش
$paths = [
    '/home/u678860509/private_data/admin_hash.txt',
    __DIR__ . '/private_data/admin_hash.txt',
];
 
$newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
 
$results = [];
foreach ($paths as $path) {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    if (file_put_contents($path, $newHash . "\n", LOCK_EX) !== false) {
        @chmod($path, 0600);
        $results[] = ['path' => $path, 'ok' => true];
    } else {
        $results[] = ['path' => $path, 'ok' => false];
    }
}
 
// التحقق
$verify = password_verify($newPassword, $newHash);
 
echo '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<style>body{font-family:Tahoma,sans-serif;background:#0a1628;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:40px;max-width:500px;width:90%;}
h2{color:#00d68a;margin-bottom:20px;}
.ok{color:#22c55e;font-weight:bold;}
.err{color:#ef4444;font-weight:bold;}
.pass{background:rgba(0,214,138,.15);border:2px solid #00d68a;border-radius:12px;padding:16px;margin:20px 0;font-size:22px;font-weight:900;letter-spacing:2px;color:#00d68a;text-align:center;}
a{display:block;margin-top:24px;background:#00875a;color:#fff;padding:16px;border-radius:14px;text-decoration:none;font-weight:bold;font-size:16px;text-align:center;}
</style></head><body><div class="box">';
 
if ($verify) {
    echo '<h2>✅ تم تعيين كلمة المرور بنجاح</h2>';
    echo '<div class="pass">🔑 ' . htmlspecialchars($newPassword) . '</div>';
    foreach ($results as $r) {
        $short = str_replace('/home/u678860509/', '~/', $r['path']);
        echo '<p class="' . ($r['ok'] ? 'ok' : 'err') . '">' . ($r['ok'] ? '✅' : '❌') . ' ' . htmlspecialchars($short) . '</p>';
    }
    echo '<p style="color:#94a3b8;font-size:13px;">⚠️ الملف يحذف نفسه الآن تلقائياً</p>';
    echo '<a href="/login.php">← تسجيل الدخول الآن</a>';
} else {
    echo '<h2 class="err">❌ فشل إنشاء الهاش</h2>';
}
 
echo '</div></body></html>';
 
@unlink(__FILE__);