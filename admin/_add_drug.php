<?php
/**
 * admin/_add_drug.php — قالب مشترك لإضافة منتج
 * يُضمَّن من cosmetics/add.php أو kids/add.php أو medical/add.php
 * يتوقع: $CATEGORY string (cosmetics|kids|medical)
 */
declare(strict_types=1);
if (!defined('ROOT_DIR')) die('Direct access not allowed');

$catInfo = CATEGORY_LABELS[$CATEGORY];
$pdo     = admin_pdo();
$msg     = '';
$msgType = '';

// ── معالجة الإرسال ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrf = (string)($_POST['_csrf'] ?? '');
    if (!admin_csrf_verify($csrf)) {
        $msg = 'خطأ: انتهت صلاحية الجلسة. أعد المحاولة.';
        $msgType = 'error';
    } else {
        $name  = trim((string)($_POST['name'] ?? ''));
        $price = (float)str_replace(',', '', (string)($_POST['price'] ?? '0'));
        $desc  = trim((string)($_POST['description'] ?? ''));

        // ─ التحقق
        $errors = [];
        if ($name === '')                   $errors[] = 'اسم المنتج مطلوب.';
        if (mb_strlen($name) > 255)         $errors[] = 'اسم المنتج طويل جداً.';
        if ($price < 0)                     $errors[] = 'السعر يجب أن يكون صفراً أو أكثر.';

        // ─ رفع الصورة
        $imagePath = '';
        if (!empty($_FILES['image']['tmp_name'])) {
            $file  = $_FILES['image'];
            $maxSz = 5 * 1024 * 1024; // 5 MB
            $allowed = ['image/jpeg', 'image/png', 'image/webp'];
            $exts    = ['jpg','jpeg','png','webp'];

            if ($file['size'] > $maxSz) {
                $errors[] = 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت.';
            } else {
                // تحقق MIME حقيقي
                $finfo = new finfo(FILEINFO_MIME_TYPE);
                $mime  = $finfo->file($file['tmp_name']);
                if (!in_array($mime, $allowed, true)) {
                    $errors[] = 'نوع الصورة غير مسموح — JPG أو PNG أو WEBP فقط.';
                } else {
                    // مجلد uploads
                    $uploadsDir = ROOT_DIR . '/uploads/';
                    if (!is_dir($uploadsDir)) {
                        mkdir($uploadsDir, 0755, true);
                    }
                    $ext      = match($mime){
                        'image/jpeg' => 'jpg',
                        'image/png'  => 'png',
                        'image/webp' => 'webp',
                        default      => 'jpg',
                    };
                    $filename = $CATEGORY . '_' . bin2hex(random_bytes(10)) . '.' . $ext;
                    $destPath = $uploadsDir . $filename;

                    // ─ remove.bg (اختياري)
                    $removeBgKey = getenv('REMOVEBG_API_KEY') ?: '';
                    $usedRemoveBg = false;
                    if ($removeBgKey !== '' && in_array($mime, ['image/jpeg','image/png'], true)) {
                        try {
                            $ch = curl_init();
                            curl_setopt_array($ch, [
                                CURLOPT_URL            => 'https://api.remove.bg/v1.0/removebg',
                                CURLOPT_RETURNTRANSFER => true,
                                CURLOPT_POST           => true,
                                CURLOPT_POSTFIELDS     => [
                                    'image_file' => new CURLFile($file['tmp_name'], $mime, $file['name']),
                                    'size'       => 'auto',
                                ],
                                CURLOPT_HTTPHEADER     => ['X-Api-Key: ' . $removeBgKey],
                                CURLOPT_TIMEOUT        => 30,
                            ]);
                            $result = curl_exec($ch);
                            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                            curl_close($ch);
                            if ($status === 200 && is_string($result) && strlen($result) > 1000) {
                                file_put_contents($destPath, $result);
                                $filename     = pathinfo($filename, PATHINFO_FILENAME) . '.png';
                                $destPath     = $uploadsDir . $filename;
                                file_put_contents($destPath, $result);
                                $usedRemoveBg = true;
                            }
                        } catch (Throwable $e) {
                            error_log('[remove.bg] ' . $e->getMessage());
                        }
                    }

                    if (!$usedRemoveBg) {
                        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
                            $errors[] = 'فشل رفع الصورة. تحقق من صلاحيات مجلد uploads.';
                        }
                    }
                    $imagePath = $filename;
                }
            }
        }

        // ─ حفظ في MySQL
        if (empty($errors)) {
            $stmt = $pdo->prepare(
                "INSERT INTO drugs (name, price, image, category, description)
                 VALUES (:name, :price, :image, :category, :desc)"
            );
            $stmt->execute([
                ':name'     => $name,
                ':price'    => $price,
                ':image'    => $imagePath,
                ':category' => $CATEGORY,
                ':desc'     => $desc,
            ]);
            $newId = $pdo->lastInsertId();
            // إعادة توجيه بعد الحفظ (Post/Redirect/Get)
            header("Location: list.php?added=1");
            exit;
        } else {
            $msg     = implode('<br>', $errors);
            $msgType = 'error';
        }
    }
}

// ── بناء المحتوى ────────────────────────────────────────────────────
ob_start();
$csrfToken = admin_csrf_token();
$btnClass  = ['cosmetics'=>'btn-pink','kids'=>'btn-orange','medical'=>'btn-teal'][$CATEGORY] ?? 'btn-primary';
?>

<?php if ($msg !== ''): ?>
<div class="alert alert-<?= $msgType === 'error' ? 'error' : 'success' ?>">
  <?= $msgType === 'error' ? '❌' : '✅' ?> <?= $msg ?>
</div>
<?php endif; ?>

<div class="card">
  <div class="card-header">
    <div class="card-title">
      <?= $catInfo['icon'] ?> إضافة منتج جديد — <?= $catInfo['ar'] ?>
    </div>
    <a href="list.php" class="btn btn-secondary btn-sm">📋 عرض القائمة</a>
  </div>
  <div class="card-body">
    <form method="POST" enctype="multipart/form-data" id="addForm" novalidate>
      <input type="hidden" name="_csrf" value="<?= escHtml($csrfToken) ?>">
      <input type="hidden" name="category" value="<?= $CATEGORY ?>">

      <div class="form-grid">

        <!-- اسم المنتج -->
        <div class="form-group">
          <label class="form-label">اسم المنتج <span class="req">*</span></label>
          <input type="text" name="name" class="form-input"
                 placeholder="مثال: كريم مرطّب للوجه"
                 maxlength="255" required
                 value="<?= escHtml($_POST['name'] ?? '') ?>">
          <div class="form-hint">أدخل الاسم التجاري الكامل للمنتج</div>
        </div>

        <!-- السعر -->
        <div class="form-group">
          <label class="form-label">السعر (دينار عراقي) <span class="req">*</span></label>
          <input type="number" name="price" class="form-input"
                 placeholder="مثال: 15000"
                 min="0" step="0.01"
                 value="<?= escHtml($_POST['price'] ?? '') ?>">
          <div class="form-hint">اتركه صفراً إن لم يكن له سعر محدد</div>
        </div>

        <!-- الوصف -->
        <div class="form-group full">
          <label class="form-label">وصف المنتج (اختياري)</label>
          <textarea name="description" class="form-textarea"
                    placeholder="اكتب وصفاً مختصراً للمنتج، الاستخدامات، المكونات..."
                    rows="3"><?= escHtml($_POST['description'] ?? '') ?></textarea>
        </div>

        <!-- الصورة -->
        <div class="form-group full">
          <label class="form-label">صورة المنتج</label>
          <div class="upload-area" id="uploadArea">
            <input type="file" name="image" id="imageInput"
                   accept="image/jpeg,image/png,image/webp"
                   onchange="previewImage(this)">
            <div id="uploadPlaceholder">
              <div class="upload-icon">🖼️</div>
              <div class="upload-text">اسحب الصورة هنا أو انقر للاختيار</div>
              <div class="upload-sub">JPG • PNG • WEBP — الحد الأقصى 5 ميغابايت</div>
            </div>
            <div id="uploadPreview" style="display:none;">
              <img id="previewImg" class="preview-img" src="" alt="معاينة">
              <div id="previewName" style="font-size:13px;color:var(--muted);"></div>
              <button type="button" onclick="clearImage()"
                      style="margin-top:8px;background:none;border:none;color:var(--red);font-size:13px;cursor:pointer;font-weight:700;">
                ✕ إزالة الصورة
              </button>
            </div>
          </div>
          <?php if (!empty(getenv('REMOVEBG_API_KEY'))): ?>
          <div class="form-hint" style="color:var(--g);font-weight:700;">
            ✨ ستتم إزالة خلفية الصورة تلقائياً عبر remove.bg
          </div>
          <?php else: ?>
          <div class="form-hint">إضافة صورة المنتج (اختياري) — إذا أردت إزالة الخلفية أضف REMOVEBG_API_KEY في .env</div>
          <?php endif; ?>
        </div>

      </div><!-- .form-grid -->

      <!-- زر الإرسال -->
      <div style="margin-top:24px;display:flex;gap:12px;align-items:center;">
        <button type="submit" class="btn <?= $btnClass ?> btn-lg" id="submitBtn">
          <?= $catInfo['icon'] ?> حفظ المنتج في <?= $catInfo['ar'] ?>
        </button>
        <a href="list.php" class="btn btn-secondary btn-lg">إلغاء</a>
      </div>
    </form>
  </div>
</div>

<script>
function previewImage(input) {
  const file = input.files[0];
  if (!file) return;
  // تحقق من النوع
  const allowed = ['image/jpeg','image/png','image/webp'];
  if (!allowed.includes(file.type)) {
    alert('نوع الملف غير مسموح. استخدم JPG أو PNG أو WEBP فقط.');
    input.value = '';
    return;
  }
  // تحقق من الحجم
  if (file.size > 5 * 1024 * 1024) {
    alert('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('previewName').textContent = file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)';
    document.getElementById('uploadPlaceholder').style.display = 'none';
    document.getElementById('uploadPreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}
function clearImage() {
  document.getElementById('imageInput').value = '';
  document.getElementById('uploadPlaceholder').style.display = 'block';
  document.getElementById('uploadPreview').style.display = 'none';
}
// Drag & Drop
const area = document.getElementById('uploadArea');
area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag'); });
area.addEventListener('dragleave', () => area.classList.remove('drag'));
area.addEventListener('drop', e => {
  e.preventDefault(); area.classList.remove('drag');
  const input = document.getElementById('imageInput');
  const dt = e.dataTransfer;
  if (dt.files.length) {
    input.files = dt.files;
    previewImage(input);
  }
});
// تعطيل الزر أثناء الرفع
document.getElementById('addForm').addEventListener('submit', function(e) {
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '⏳ جاري الحفظ...';
});
</script>
<?php
$bodyContent = ob_get_clean();
$pageTitle   = 'إضافة منتج — ' . $catInfo['ar'];
$pageIcon    = $catInfo['icon'];
$activeCat   = $CATEGORY;
$activePage  = 'add';
$breadcrumbs = [
    ['label' => '🏠 لوحة التحكم', 'url' => ROOT_DIR_URL . '/admin/dashboard.php'],
    ['label' => $catInfo['icon'] . ' ' . $catInfo['ar'], 'url' => ROOT_DIR_URL . '/admin/' . $CATEGORY . '/list.php'],
    ['label' => 'إضافة منتج'],
];
$topbarActions = '<a href="list.php" class="btn btn-secondary btn-sm">📋 قائمة المنتجات</a>';
require ROOT_DIR . '/admin/_layout.php';
