<?php
/**
 * admin/_edit_drug.php — قالب مشترك لتعديل منتج
 * يُضمَّن من cosmetics/edit.php أو kids/edit.php أو medical/edit.php
 * يتوقع: $CATEGORY string
 */
declare(strict_types=1);
if (!defined('ROOT_DIR')) die('Direct access not allowed');

$catInfo = CATEGORY_LABELS[$CATEGORY];
$pdo     = admin_pdo();
$msg     = '';
$msgType = '';

// ── جلب المنتج ──────────────────────────────────────────────────────
$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) {
    header('Location: ' . ROOT_DIR_URL . '/admin/' . $CATEGORY . '/list.php');
    exit;
}
$stFetch = $pdo->prepare("SELECT * FROM drugs WHERE id = ? AND category = ?");
$stFetch->execute([$id, $CATEGORY]);
$drug = $stFetch->fetch(PDO::FETCH_ASSOC);
if (!$drug) {
    header('Location: ' . ROOT_DIR_URL . '/admin/' . $CATEGORY . '/list.php?err=notfound');
    exit;
}

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

        $errors = [];
        if ($name === '')          $errors[] = 'اسم المنتج مطلوب.';
        if (mb_strlen($name) > 255) $errors[] = 'اسم المنتج طويل جداً.';
        if ($price < 0)            $errors[] = 'السعر يجب أن يكون صفراً أو أكثر.';

        // ─ رفع صورة جديدة (اختياري)
        $newImage = $drug['image']; // الاحتفاظ بالقديمة افتراضياً
        $deleteOldImage = false;

        if (!empty($_FILES['image']['tmp_name'])) {
            $file    = $_FILES['image'];
            $maxSz   = 5 * 1024 * 1024;
            $allowed = ['image/jpeg', 'image/png', 'image/webp'];

            if ($file['size'] > $maxSz) {
                $errors[] = 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت.';
            } else {
                $finfo = new finfo(FILEINFO_MIME_TYPE);
                $mime  = $finfo->file($file['tmp_name']);
                if (!in_array($mime, $allowed, true)) {
                    $errors[] = 'نوع الصورة غير مسموح — JPG أو PNG أو WEBP فقط.';
                } else {
                    $uploadsDir = ROOT_DIR . '/uploads/';
                    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);

                    $ext      = match($mime){
                        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', default => 'jpg'
                    };
                    $filename  = $CATEGORY . '_' . bin2hex(random_bytes(10)) . '.' . $ext;
                    $destPath  = $uploadsDir . $filename;

                    // remove.bg اختياري
                    $removeBgKey = getenv('REMOVEBG_API_KEY') ?: '';
                    $usedRemoveBg = false;
                    if ($removeBgKey !== '' && in_array($mime, ['image/jpeg','image/png'], true)) {
                        try {
                            $ch = curl_init();
                            curl_setopt_array($ch, [
                                CURLOPT_URL            => 'https://api.remove.bg/v1.0/removebg',
                                CURLOPT_RETURNTRANSFER => true,
                                CURLOPT_POST           => true,
                                CURLOPT_POSTFIELDS     => ['image_file' => new CURLFile($file['tmp_name'], $mime, $file['name']), 'size' => 'auto'],
                                CURLOPT_HTTPHEADER     => ['X-Api-Key: ' . $removeBgKey],
                                CURLOPT_TIMEOUT        => 30,
                            ]);
                            $result = curl_exec($ch);
                            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                            curl_close($ch);
                            if ($status === 200 && is_string($result) && strlen($result) > 1000) {
                                $filename = pathinfo($filename, PATHINFO_FILENAME) . '.png';
                                $destPath = $uploadsDir . $filename;
                                file_put_contents($destPath, $result);
                                $usedRemoveBg = true;
                            }
                        } catch (Throwable $e) { error_log('[remove.bg] ' . $e->getMessage()); }
                    }
                    if (!$usedRemoveBg && !move_uploaded_file($file['tmp_name'], $destPath)) {
                        $errors[] = 'فشل رفع الصورة.';
                    } else {
                        $newImage = $filename;
                        $deleteOldImage = true;
                    }
                }
            }
        }

        // ─ حذف الصورة القديمة إن طُلب
        if (isset($_POST['remove_image']) && $_POST['remove_image'] === '1') {
            $newImage = '';
            $deleteOldImage = true;
        }

        // ─ حفظ في MySQL
        if (empty($errors)) {
            $pdo->prepare(
                "UPDATE drugs SET name=:name, price=:price, image=:image, description=:desc WHERE id=:id AND category=:cat"
            )->execute([':name'=>$name, ':price'=>$price, ':image'=>$newImage, ':desc'=>$desc, ':id'=>$id, ':cat'=>$CATEGORY]);

            // حذف الصورة القديمة من الملفات
            if ($deleteOldImage && !empty($drug['image']) && $drug['image'] !== $newImage) {
                $oldFile = ROOT_DIR . '/uploads/' . $drug['image'];
                if (is_file($oldFile)) @unlink($oldFile);
            }

            header("Location: list.php?updated=1");
            exit;
        } else {
            $msg     = implode('<br>', $errors);
            $msgType = 'error';
            // تحديث البيانات المحلية لإعادة عرض النموذج
            $drug['name']        = $name;
            $drug['price']       = $price;
            $drug['description'] = $desc;
        }
    }
}

// ── بناء المحتوى ────────────────────────────────────────────────────
ob_start();
$csrfToken = admin_csrf_token();
$btnClass  = ['cosmetics'=>'btn-pink','kids'=>'btn-orange','medical'=>'btn-teal'][$CATEGORY] ?? 'btn-primary';
$currentImg = !empty($drug['image']) ? ROOT_DIR_URL . '/uploads/' . escHtml($drug['image']) : '';
?>

<?php if ($msg !== ''): ?>
<div class="alert alert-<?= $msgType === 'error' ? 'error' : 'success' ?>">
  <?= $msgType === 'error' ? '❌' : '✅' ?> <?= $msg ?>
</div>
<?php endif; ?>

<div class="card">
  <div class="card-header">
    <div class="card-title">
      <?= $catInfo['icon'] ?> تعديل منتج — <span style="color:var(--muted);font-weight:600;"><?= escHtml($drug['name']) ?></span>
    </div>
    <div style="display:flex;gap:8px;">
      <a href="list.php" class="btn btn-secondary btn-sm">📋 القائمة</a>
      <a href="add.php"  class="btn <?= $btnClass ?> btn-sm">➕ منتج جديد</a>
    </div>
  </div>
  <div class="card-body">
    <form method="POST" enctype="multipart/form-data" id="editForm" novalidate>
      <input type="hidden" name="_csrf"     value="<?= escHtml($csrfToken) ?>">
      <input type="hidden" name="remove_image" value="0" id="removeImageFlag">

      <div class="form-grid">

        <!-- اسم المنتج -->
        <div class="form-group">
          <label class="form-label">اسم المنتج <span class="req">*</span></label>
          <input type="text" name="name" class="form-input"
                 placeholder="مثال: كريم مرطّب للوجه"
                 maxlength="255" required
                 value="<?= escHtml($drug['name']) ?>">
        </div>

        <!-- السعر -->
        <div class="form-group">
          <label class="form-label">السعر (دينار عراقي)</label>
          <input type="number" name="price" class="form-input"
                 placeholder="مثال: 15000"
                 min="0" step="0.01"
                 value="<?= escHtml((string)$drug['price']) ?>">
        </div>

        <!-- الوصف -->
        <div class="form-group full">
          <label class="form-label">وصف المنتج (اختياري)</label>
          <textarea name="description" class="form-textarea"
                    placeholder="اكتب وصفاً مختصراً..."
                    rows="3"><?= escHtml($drug['description'] ?? '') ?></textarea>
        </div>

        <!-- الصورة الحالية + رفع جديدة -->
        <div class="form-group full">
          <label class="form-label">صورة المنتج</label>

          <?php if ($currentImg !== ''): ?>
          <!-- عرض الصورة الحالية -->
          <div id="currentImgWrap" style="display:flex;align-items:center;gap:16px;margin-bottom:16px;
               padding:14px;background:var(--g-bg);border-radius:12px;border:2px solid var(--g-pale);">
            <img src="<?= $currentImg ?>" id="currentImgEl"
                 style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:2px solid var(--g);"
                 onerror="this.src='<?= ROOT_DIR_URL ?>/assets/img/placeholder.svg'">
            <div>
              <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:4px;">الصورة الحالية</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:8px;"><?= escHtml($drug['image']) ?></div>
              <button type="button" onclick="removeCurrentImage()"
                      class="btn btn-danger btn-sm">🗑️ حذف الصورة الحالية</button>
            </div>
          </div>
          <?php endif; ?>

          <!-- منطقة رفع صورة جديدة -->
          <div class="upload-area" id="uploadArea">
            <input type="file" name="image" id="imageInput"
                   accept="image/jpeg,image/png,image/webp"
                   onchange="previewImage(this)">
            <div id="uploadPlaceholder">
              <div class="upload-icon">🖼️</div>
              <div class="upload-text"><?= $currentImg ? 'استبدل الصورة (اختياري)' : 'اسحب الصورة هنا أو انقر للاختيار' ?></div>
              <div class="upload-sub">JPG • PNG • WEBP — الحد الأقصى 5 ميغابايت</div>
            </div>
            <div id="uploadPreview" style="display:none;">
              <img id="previewImg" class="preview-img" src="" alt="معاينة">
              <div id="previewName" style="font-size:13px;color:var(--muted);"></div>
              <button type="button" onclick="clearImage()"
                      style="margin-top:8px;background:none;border:none;color:var(--red);font-size:13px;cursor:pointer;font-weight:700;">
                ✕ إلغاء الاختيار
              </button>
            </div>
          </div>
        </div>

      </div><!-- .form-grid -->

      <!-- معلومات إضافية -->
      <div style="margin:20px 0;padding:14px;background:var(--bg);border-radius:10px;
           font-size:12.5px;color:var(--muted);display:flex;gap:20px;flex-wrap:wrap;">
        <span>🆔 رقم المنتج: <strong style="color:var(--navy);">#<?= $drug['id'] ?></strong></span>
        <span>📁 القسم: <strong style="color:var(--navy);"><?= $catInfo['ar'] ?></strong></span>
        <span>📅 تاريخ الإضافة: <strong style="color:var(--navy);"><?= date('Y/m/d H:i', strtotime($drug['created_at'])) ?></strong></span>
      </div>

      <div style="display:flex;gap:12px;align-items:center;">
        <button type="submit" class="btn <?= $btnClass ?> btn-lg" id="submitBtn">
          💾 حفظ التعديلات
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
  const allowed = ['image/jpeg','image/png','image/webp'];
  if (!allowed.includes(file.type)) {
    alert('نوع الملف غير مسموح. استخدم JPG أو PNG أو WEBP فقط.');
    input.value = ''; return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.');
    input.value = ''; return;
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
function removeCurrentImage() {
  if (!confirm('هل تريد حذف الصورة الحالية نهائياً؟')) return;
  document.getElementById('removeImageFlag').value = '1';
  const wrap = document.getElementById('currentImgWrap');
  if (wrap) {
    wrap.style.opacity = '.4';
    wrap.innerHTML += '<div style="color:var(--red);font-size:13px;font-weight:800;margin-top:8px;">⚠️ ستُحذف عند الحفظ</div>';
  }
}
const area = document.getElementById('uploadArea');
area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag'); });
area.addEventListener('dragleave', () => area.classList.remove('drag'));
area.addEventListener('drop', e => {
  e.preventDefault(); area.classList.remove('drag');
  const input = document.getElementById('imageInput');
  if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; previewImage(input); }
});
document.getElementById('editForm').addEventListener('submit', function() {
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '⏳ جاري الحفظ...';
});
</script>
<?php
$bodyContent = ob_get_clean();
$pageTitle   = 'تعديل: ' . escHtml((string) $drug['name']);
$pageIcon    = $catInfo['icon'];
$activeCat   = $CATEGORY;
$activePage  = 'list';
$breadcrumbs = [
    ['label' => '🏠 لوحة التحكم', 'url' => ROOT_DIR_URL . '/admin/dashboard.php'],
    ['label' => $catInfo['icon'] . ' ' . $catInfo['ar'], 'url' => ROOT_DIR_URL . '/admin/' . $CATEGORY . '/list.php'],
    ['label' => 'تعديل منتج'],
];
$topbarActions = '<a href="' . ROOT_DIR_URL . '/admin/' . $CATEGORY . '/list.php" class="btn btn-secondary btn-sm">📋 القائمة</a>';
require ROOT_DIR . '/admin/_layout.php';
