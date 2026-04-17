<?php
/**
 * admin/api-drugs-upload.php
 * يستقبل: POST إضافة منتج (multipart) أو حذف (JSON)
 * محمي بجلسة لوحة التحكم
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$rootDir = dirname(__DIR__);
require_once $rootDir . '/admin_panel_auth.php';
require_once $rootDir . '/env_loader.php';
pharma_load_env_sources($rootDir);

// ── حماية الجلسة ────────────────────────────────────────────────────
$isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
$host = $_SERVER['HTTP_HOST'] ?? '';
if (strpos($host, ':') !== false) $host = explode(':', $host)[0];
$cookieDomain = ($host && $host !== 'localhost' && !filter_var($host, FILTER_VALIDATE_IP)) ? $host : '';

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'domain' => $cookieDomain,
        'secure' => $isSecure, 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
}
admin_restore_session_from_cookie();
if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'غير مصرح'], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── PDO ────────────────────────────────────────────────────────────
require_once $rootDir . '/db.php';
$pdo = getPdo();
if (!$pdo) {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'فشل الاتصال بقاعدة البيانات'], JSON_UNESCAPED_UNICODE);
    exit;
}
// إنشاء الجدول تلقائياً
$pdo->exec("CREATE TABLE IF NOT EXISTS drugs (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL,
    price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    image       VARCHAR(500)  NOT NULL DEFAULT '',
    category    ENUM('medicine','beauty','medical','baby','vitamin') NOT NULL,
    description TEXT,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_drugs_category (category),
    KEY idx_drugs_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ════════════════════════════════════════════
// DELETE — JSON body: { action:"delete", id:5, category:"cosmetics" }
// ════════════════════════════════════════════
if ($method === 'POST') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (str_contains($contentType, 'application/json')) {
        $body = (string)file_get_contents('php://input');
        $data = json_decode($body, true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['status'=>'error','message'=>'JSON غير صالح'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if (($data['action'] ?? '') === 'delete') {
            $id  = (int)($data['id'] ?? 0);
            $cat = trim((string)($data['category'] ?? ''));
            $allowed = ['medicine','beauty','medical','baby','vitamin'];
            if ($id <= 0 || !in_array($cat, $allowed, true)) {
                echo json_encode(['status'=>'error','message'=>'بيانات غير صالحة'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            // احذف الصورة من القرص
            $st = $pdo->prepare("SELECT image FROM drugs WHERE id=? AND category=?");
            $st->execute([$id, $cat]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['image'])) {
                $imgFile = $rootDir . '/uploads/' . basename($row['image']);
                if (is_file($imgFile)) @unlink($imgFile);
            }
            $pdo->prepare("DELETE FROM drugs WHERE id=? AND category=?")->execute([$id, $cat]);
            echo json_encode(['status'=>'success','message'=>'تم الحذف'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        echo json_encode(['status'=>'error','message'=>'action غير معروف'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ════════════════════════════════════════
    // INSERT — multipart/form-data
    // ════════════════════════════════════════
    $name  = trim((string)($_POST['name'] ?? ''));
    $price = (float)str_replace(',', '', (string)($_POST['price'] ?? '0'));
    $cat   = trim((string)($_POST['category'] ?? ''));
    $desc  = trim((string)($_POST['description'] ?? ''));

    $allowed = ['medicine','beauty','medical','baby','vitamin'];
    $errors  = [];
    if ($name === '')                  $errors[] = 'اسم المنتج مطلوب';
    if (mb_strlen($name) > 255)        $errors[] = 'الاسم طويل جداً';
    if (!in_array($cat, $allowed, true)) $errors[] = 'القسم غير صالح';
    if ($price < 0)                    $errors[] = 'السعر لا يمكن أن يكون سالباً';

    // ─ رفع الصورة
    $imageName = '';
    if (!empty($_FILES['image']['tmp_name'])) {
        $file    = $_FILES['image'];
        $maxSize = 5 * 1024 * 1024;
        $finfo   = new finfo(FILEINFO_MIME_TYPE);
        $mime    = $finfo->file($file['tmp_name']);
        $allowedMime = ['image/jpeg','image/png','image/webp'];

        if ($file['size'] > $maxSize) {
            $errors[] = 'حجم الصورة يتجاوز 5MB';
        } elseif (!in_array($mime, $allowedMime, true)) {
            $errors[] = 'نوع الصورة غير مسموح (JPG/PNG/WEBP فقط)';
        } else {
            $uploadsDir = $rootDir . '/uploads/';
            if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);

            $ext = match($mime) {
                'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', default => 'jpg'
            };
            $imageName = $cat . '_' . bin2hex(random_bytes(10)) . '.' . $ext;
            $dest      = $uploadsDir . $imageName;

            // remove.bg اختياري
            $removeBgKey = (string)(getenv('REMOVEBG_API_KEY') ?: '');
            $uploaded    = false;
            if ($removeBgKey !== '' && in_array($mime, ['image/jpeg','image/png'], true)) {
                try {
                    $ch = curl_init();
                    curl_setopt_array($ch, [
                        CURLOPT_URL => 'https://api.remove.bg/v1.0/removebg',
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_POST => true,
                        CURLOPT_POSTFIELDS => [
                            'image_file' => new CURLFile($file['tmp_name'], $mime, $file['name']),
                            'size' => 'auto',
                        ],
                        CURLOPT_HTTPHEADER => ['X-Api-Key: ' . $removeBgKey],
                        CURLOPT_TIMEOUT => 30,
                    ]);
                    $result = curl_exec($ch);
                    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    if ($status === 200 && is_string($result) && strlen($result) > 1000) {
                        $imageName = $cat . '_' . bin2hex(random_bytes(10)) . '.png';
                        $dest      = $uploadsDir . $imageName;
                        file_put_contents($dest, $result);
                        $uploaded  = true;
                    }
                } catch (Throwable $e) {
                    error_log('[remove.bg] ' . $e->getMessage());
                }
            }
            if (!$uploaded && !move_uploaded_file($file['tmp_name'], $dest)) {
                $errors[] = 'فشل رفع الصورة — تحقق من صلاحيات مجلد uploads';
                $imageName = '';
            }
        }
    }

    if (!empty($errors)) {
        echo json_encode(['status'=>'error','message'=>implode(' | ', $errors)], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $pdo->prepare(
        "INSERT INTO drugs (name, price, image, category, description) VALUES (?,?,?,?,?)"
    )->execute([$name, $price, $imageName, $cat, $desc]);

    $newId = (int)$pdo->lastInsertId();
    echo json_encode([
        'status'  => 'success',
        'message' => 'تم حفظ المنتج',
        'data'    => [
            'id'        => $newId,
            'name'      => $name,
            'price'     => $price,
            'image_url' => $imageName ? '/uploads/' . $imageName : '',
            'category'  => $cat,
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['status'=>'error','message'=>'Method Not Allowed'], JSON_UNESCAPED_UNICODE);
