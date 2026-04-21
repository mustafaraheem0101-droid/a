<?php
/**
 * admin/_list_drugs.php — قالب مشترك لقائمة المنتجات
 * يُضمَّن من cosmetics/list.php أو kids/list.php أو medical/list.php
 * يتوقع: $CATEGORY string
 */
declare(strict_types=1);
if (!defined('ROOT_DIR')) die('Direct access not allowed');

$catInfo = CATEGORY_LABELS[$CATEGORY];
$pdo     = admin_pdo();

// ── حذف ─────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['_delete'])) {
    $csrf = (string)($_POST['_csrf'] ?? '');
    if (admin_csrf_verify($csrf)) {
        $delId = (int)($_POST['_delete']);
        // نحذف الصورة أيضاً
        $row = $pdo->prepare("SELECT image FROM drugs WHERE id = ? AND category = ?");
        $row->execute([$delId, $CATEGORY]);
        $delRow = $row->fetch(PDO::FETCH_ASSOC);
        if ($delRow && !empty($delRow['image'])) {
            $imgFile = ROOT_DIR . '/uploads/' . $delRow['image'];
            if (is_file($imgFile)) @unlink($imgFile);
        }
        $pdo->prepare("DELETE FROM drugs WHERE id = ? AND category = ?")->execute([$delId, $CATEGORY]);
    }
    header("Location: list.php?deleted=1");
    exit;
}

// ── جلب البيانات من MySQL ────────────────────────────────────────────
$search = trim((string)($_GET['q'] ?? ''));
$page   = max(1, (int)($_GET['page'] ?? 1));
$perPage = 20;
$offset  = ($page - 1) * $perPage;

if ($search !== '') {
    $likeVal = '%' . $search . '%';
    $total = (int)$pdo->prepare("SELECT COUNT(*) FROM drugs WHERE category=? AND name LIKE ?")
                      ->execute([$CATEGORY, $likeVal]) ? $pdo->query("SELECT FOUND_ROWS()")->fetchColumn() : 0;
    $stTotal = $pdo->prepare("SELECT COUNT(*) FROM drugs WHERE category=? AND name LIKE ?");
    $stTotal->execute([$CATEGORY, $likeVal]);
    $total = (int)$stTotal->fetchColumn();

    $st = $pdo->prepare("SELECT * FROM drugs WHERE category=? AND name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?");
    $st->execute([$CATEGORY, $likeVal, $perPage, $offset]);
} else {
    $stTotal = $pdo->prepare("SELECT COUNT(*) FROM drugs WHERE category=?");
    $stTotal->execute([$CATEGORY]);
    $total = (int)$stTotal->fetchColumn();

    $st = $pdo->prepare("SELECT * FROM drugs WHERE category=? ORDER BY created_at DESC LIMIT ? OFFSET ?");
    $st->execute([$CATEGORY, $perPage, $offset]);
}
$drugs = $st->fetchAll(PDO::FETCH_ASSOC);
$totalPages = max(1, (int)ceil($total / $perPage));

$csrfToken = admin_csrf_token();
$btnClass  = ['cosmetics'=>'btn-pink','kids'=>'btn-orange','medical'=>'btn-teal'][$CATEGORY] ?? 'btn-primary';

// ── HTML ─────────────────────────────────────────────────────────────
ob_start();
?>

<!-- إشعارات -->
<?php if (!empty($_GET['added'])): ?>
<div class="alert alert-success">✅ تم إضافة المنتج بنجاح!</div>
<?php endif; ?>
<?php if (!empty($_GET['updated'])): ?>
<div class="alert alert-success">✅ تم تحديث المنتج بنجاح!</div>
<?php endif; ?>
<?php if (!empty($_GET['deleted'])): ?>
<div class="alert alert-info">🗑️ تم حذف المنتج بنجاح.</div>
<?php endif; ?>
<?php if (!empty($_GET['err']) && $_GET['err'] === 'notfound'): ?>
<div class="alert alert-error">❌ المنتج غير موجود.</div>
<?php endif; ?>

<!-- Header بطاقة -->
<div class="card">
  <div class="card-header">
    <div class="card-title">
      <?= $catInfo['icon'] ?> منتجات <?= $catInfo['ar'] ?>
      <span style="background:var(--bg);color:var(--muted);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;">
        <?= $total ?> منتج
      </span>
    </div>
    <a href="add.php" class="btn <?= $btnClass ?>">➕ إضافة منتج جديد</a>
  </div>

  <!-- بحث -->
  <div style="padding:16px 24px;border-bottom:1px solid var(--border);background:var(--bg);">
    <form method="GET" style="display:flex;gap:10px;max-width:480px;">
      <input type="text" name="q" class="form-input" style="flex:1;"
             placeholder="🔍 بحث باسم المنتج..."
             value="<?= escHtml($search) ?>">
      <button type="submit" class="btn btn-primary">بحث</button>
      <?php if ($search !== ''): ?>
      <a href="list.php" class="btn btn-secondary">✕ إلغاء</a>
      <?php endif; ?>
    </form>
  </div>

  <!-- الجدول -->
  <div class="table-wrap">
    <?php if (empty($drugs)): ?>
    <div class="empty-state">
      <div class="empty-icon"><?= $catInfo['icon'] ?></div>
      <div class="empty-title">
        <?= $search !== '' ? 'لا توجد نتائج للبحث' : 'لا توجد منتجات في هذا القسم بعد' ?>
      </div>
      <div class="empty-sub" style="margin-top:14px;">
        <a href="add.php" class="btn <?= $btnClass ?>">➕ أضف أول منتج الآن</a>
      </div>
    </div>
    <?php else: ?>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>الصورة</th>
          <th>اسم المنتج</th>
          <th>السعر</th>
          <th>التاريخ</th>
          <th style="text-align:center;">الإجراءات</th>
        </tr>
      </thead>
      <tbody>
        <?php $listImgIdx = 0; ?>
        <?php foreach ($drugs as $i => $drug):
          $imgSrc = !empty($drug['image'])
            ? '../../uploads/' . escHtml($drug['image'])
            : '../../assets/img/placeholder.svg';
          $rowNum = $offset + $i + 1;
          $isFirstListImg = ($listImgIdx === 0);
          $listImgIdx++;
        ?>
        <tr>
          <td style="color:var(--muted);font-size:12px;width:40px;"><?= $rowNum ?></td>
          <td style="width:72px;">
            <img src="<?= $imgSrc ?>" class="td-img"
                 alt="<?= escHtml($drug['name']) ?>"
                 loading="<?= $isFirstListImg ? 'eager' : 'lazy' ?>"
                 decoding="async"
                 onerror="this.src='../../assets/img/placeholder.svg'">
          </td>
          <td>
            <div class="td-name"><?= escHtml($drug['name']) ?></div>
            <?php if (!empty($drug['description'])): ?>
            <div style="font-size:12px;color:var(--muted);margin-top:3px;">
              <?= escHtml(mb_substr($drug['description'], 0, 60)) ?>...
            </div>
            <?php endif; ?>
          </td>
          <td>
            <?php if ((float)$drug['price'] > 0): ?>
            <span class="td-price"><?= number_format((float)$drug['price'], 0) ?> د.ع</span>
            <?php else: ?>
            <span style="color:var(--muted);font-size:12px;">—</span>
            <?php endif; ?>
          </td>
          <td style="color:var(--muted);font-size:12px;white-space:nowrap;">
            <?= date('Y/m/d', strtotime($drug['created_at'])) ?>
          </td>
          <td style="text-align:center;white-space:nowrap;">
            <!-- تعديل -->
            <a href="edit.php?id=<?= (int)$drug['id'] ?>" class="btn btn-secondary btn-sm" style="margin-left:6px;">✏️ تعديل</a>
            <!-- حذف -->
            <form method="POST" style="display:inline;" onsubmit="return confirm(<?= json_encode('هل تريد حذف «' . (string) $drug['name'] . '» نهائياً؟', JSON_HEX_TAG | JSON_HEX_APOS | JSON_UNESCAPED_UNICODE) ?>)">
              <input type="hidden" name="_csrf" value="<?= escHtml($csrfToken) ?>">
              <input type="hidden" name="_delete" value="<?= (int)$drug['id'] ?>">
              <button type="submit" class="btn btn-danger btn-sm">🗑️ حذف</button>
            </form>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>

    <!-- Pagination -->
    <?php if ($totalPages > 1): ?>
    <div style="padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);">
      <div style="font-size:13px;color:var(--muted);">
        عرض <?= $offset+1 ?>–<?= min($offset+$perPage, $total) ?> من <?= $total ?> منتج
      </div>
      <div style="display:flex;gap:6px;">
        <?php if ($page > 1): ?>
        <a href="?page=<?= $page-1 ?><?= $search ? '&q='.urlencode($search) : '' ?>"
           class="btn btn-secondary btn-sm">← السابق</a>
        <?php endif; ?>
        <?php for ($p = max(1,$page-2); $p <= min($totalPages,$page+2); $p++): ?>
        <a href="?page=<?= $p ?><?= $search ? '&q='.urlencode($search) : '' ?>"
           class="btn btn-sm <?= $p === $page ? $btnClass : 'btn-secondary' ?>">
          <?= $p ?>
        </a>
        <?php endfor; ?>
        <?php if ($page < $totalPages): ?>
        <a href="?page=<?= $page+1 ?><?= $search ? '&q='.urlencode($search) : '' ?>"
           class="btn btn-secondary btn-sm">التالي →</a>
        <?php endif; ?>
      </div>
    </div>
    <?php endif; ?>
    <?php endif; ?>
  </div>
</div>

<?php
$bodyContent = ob_get_clean();
$pageTitle   = 'قائمة المنتجات — ' . $catInfo['ar'];
$pageIcon    = $catInfo['icon'];
$activeCat   = $CATEGORY;
$activePage  = 'list';
$breadcrumbs = [
    ['label' => '🏠 لوحة التحكم', 'url' => ROOT_DIR_URL . '/admin/dashboard.php'],
    ['label' => $catInfo['icon'] . ' ' . $catInfo['ar']],
    ['label' => 'قائمة المنتجات'],
];
$topbarActions = '<a href="' . ROOT_DIR_URL . '/admin/' . $CATEGORY . '/add.php" class="btn ' . $btnClass . ' btn-sm">➕ إضافة منتج</a>';
require ROOT_DIR . '/admin/_layout.php';
