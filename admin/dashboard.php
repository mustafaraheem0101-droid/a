<?php
/**
 * admin/dashboard.php — لوحة التحكم الرئيسية
 */
declare(strict_types=1);
require_once __DIR__ . '/_auth.php';

$pdo = admin_pdo();

// ── إحصائيات الأقسام ────────────────────────────────────────────────
$stCats = $pdo->query("SELECT category, COUNT(*) AS cnt FROM drugs GROUP BY category");
$totals = [];
while ($r = $stCats->fetch(PDO::FETCH_ASSOC)) {
    $totals[$r['category']] = (int)$r['cnt'];
}
$totalAll = array_sum($totals);

// ── آخر 30 يوم ──────────────────────────────────────────────────────
$stChart = $pdo->query(
    "SELECT DATE(created_at) AS day, category, COUNT(*) AS cnt
     FROM drugs
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at), category
     ORDER BY day ASC"
);
$chartRaw = [];
while ($r = $stChart->fetch(PDO::FETCH_ASSOC)) {
    $chartRaw[$r['day']][$r['category']] = (int)$r['cnt'];
}
$chartDays = $chartCosm = $chartKids = $chartMed = [];
for ($i = 29; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $chartDays[] = date('m/d', strtotime($d));
    $chartCosm[] = $chartRaw[$d]['cosmetics'] ?? 0;
    $chartKids[] = $chartRaw[$d]['kids']      ?? 0;
    $chartMed[]  = $chartRaw[$d]['medical']   ?? 0;
}

// ── هذا الشهر / هذا الأسبوع ────────────────────────────────────────
$thisMonth = (int)$pdo->query("SELECT COUNT(*) FROM drugs WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())")->fetchColumn();
$thisWeek  = (int)$pdo->query("SELECT COUNT(*) FROM drugs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)")->fetchColumn();

// ── آخر 8 منتجات ────────────────────────────────────────────────────
$recent = $pdo->query("SELECT * FROM drugs ORDER BY created_at DESC LIMIT 8")->fetchAll(PDO::FETCH_ASSOC);

ob_start(); ?>

<!-- إحصائيات سريعة -->
<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr));margin-bottom:28px;">

  <div class="stat-card" style="background:linear-gradient(135deg,#006644,#00a86e);">
    <div class="stat-icon" style="background:rgba(255,255,255,.2);">📦</div>
    <div class="stat-info">
      <div class="stat-num" style="color:#fff;"><?= $totalAll ?></div>
      <div class="stat-label" style="color:rgba(255,255,255,.75);">إجمالي المنتجات</div>
    </div>
  </div>

  <div class="stat-card">
    <div class="stat-icon" style="background:rgba(232,121,249,.12);">💄</div>
    <div class="stat-info">
      <div class="stat-num" style="color:#c026d3;"><?= $totals['cosmetics'] ?? 0 ?></div>
      <div class="stat-label">مستحضرات التجميل</div>
    </div>
  </div>

  <div class="stat-card">
    <div class="stat-icon" style="background:rgba(251,146,60,.12);">🧸</div>
    <div class="stat-info">
      <div class="stat-num" style="color:#ea580c;"><?= $totals['kids'] ?? 0 ?></div>
      <div class="stat-label">منتجات الأطفال</div>
    </div>
  </div>

  <div class="stat-card">
    <div class="stat-icon" style="background:rgba(52,211,153,.12);">🩺</div>
    <div class="stat-info">
      <div class="stat-num" style="color:#059669;"><?= $totals['medical'] ?? 0 ?></div>
      <div class="stat-label">المستلزمات الطبية</div>
    </div>
  </div>

  <div class="stat-card">
    <div class="stat-icon" style="background:#eff6ff;">📅</div>
    <div class="stat-info">
      <div class="stat-num" style="color:#3b82f6;"><?= $thisMonth ?></div>
      <div class="stat-label">مضاف هذا الشهر</div>
    </div>
  </div>

  <div class="stat-card">
    <div class="stat-icon" style="background:#fefce8;">⚡</div>
    <div class="stat-info">
      <div class="stat-num" style="color:#f59e0b;"><?= $thisWeek ?></div>
      <div class="stat-label">مضاف هذا الأسبوع</div>
    </div>
  </div>

</div>

<!-- بطاقات الأقسام -->
<div class="cat-cards" style="margin-bottom:28px;">
  <?php foreach (CATEGORY_LABELS as $slug => $info):
    $cnt = $totals[$slug] ?? 0;
    $pct = $totalAll > 0 ? round($cnt / $totalAll * 100) : 0;
  ?>
  <div class="cat-card cat-<?= $slug ?>">
    <div class="cat-card-header">
      <div class="cat-card-icon"><?= $info['icon'] ?></div>
      <div class="cat-card-info" style="flex:1;">
        <div class="cat-card-name"><?= $info['ar'] ?></div>
        <div class="cat-card-en"><?= $info['en'] ?></div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:8px;">
          <div class="cat-card-count"><?= $cnt ?></div>
          <div class="cat-card-count-label">منتج</div>
          <div style="font-size:12px;color:rgba(255,255,255,.6);margin-right:auto;"><?= $pct ?>%</div>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.2);border-radius:4px;margin-top:8px;overflow:hidden;">
          <div style="height:100%;width:<?= $pct ?>%;background:rgba(255,255,255,.75);border-radius:4px;"></div>
        </div>
      </div>
    </div>
    <div class="cat-card-footer">
      <a href="<?= $slug ?>/add.php"  class="cat-card-btn">➕ إضافة</a>
      <a href="<?= $slug ?>/list.php" class="cat-card-btn">📋 القائمة</a>
    </div>
  </div>
  <?php endforeach; ?>
</div>

<!-- رسم بياني -->
<div class="card" style="margin-bottom:28px;">
  <div class="card-header">
    <div class="card-title">📈 المنتجات المضافة — آخر 30 يوم</div>
    <div style="display:flex;gap:14px;font-size:12px;font-weight:700;">
      <span style="color:#c026d3;">● تجميل</span>
      <span style="color:#ea580c;">● أطفال</span>
      <span style="color:#059669;">● طبي</span>
    </div>
  </div>
  <div style="padding:16px 20px;">
    <canvas id="addChart" height="80"></canvas>
  </div>
</div>

<!-- آخر المنتجات -->
<div class="card">
  <div class="card-header">
    <div class="card-title">🕐 آخر المنتجات المضافة</div>
    <div style="display:flex;gap:8px;">
      <?php foreach (CATEGORY_LABELS as $slug => $info): ?>
      <a href="<?= $slug ?>/list.php" class="btn btn-secondary btn-sm"><?= $info['icon'] ?> <?= $info['en'] ?></a>
      <?php endforeach; ?>
    </div>
  </div>
  <div class="table-wrap">
    <?php if (empty($recent)): ?>
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-title">لا توجد منتجات بعد</div>
      <div class="empty-sub" style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <a href="cosmetics/add.php" class="btn btn-pink btn-sm">💄 أضف تجميل</a>
        <a href="kids/add.php"      class="btn btn-orange btn-sm">🧸 أضف أطفال</a>
        <a href="medical/add.php"   class="btn btn-teal btn-sm">🩺 أضف طبي</a>
      </div>
    </div>
    <?php else: ?>
    <table>
      <thead>
        <tr>
          <th>الصورة</th><th>اسم المنتج</th><th>القسم</th><th>السعر</th><th>التاريخ</th><th style="text-align:center;">إجراءات</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($recent as $drug):
          $cat    = $drug['category'];
          $info   = CATEGORY_LABELS[$cat] ?? ['ar'=>$cat,'icon'=>'💊'];
          $imgSrc = !empty($drug['image'])
            ? ROOT_DIR_URL . '/uploads/' . escHtml($drug['image'])
            : ROOT_DIR_URL . '/assets/img/placeholder.svg';
        ?>
        <tr>
          <td><img src="<?= $imgSrc ?>" class="td-img" alt=""
               onerror="this.src='<?= ROOT_DIR_URL ?>/assets/img/placeholder.svg'"></td>
          <td><span class="td-name"><?= escHtml($drug['name']) ?></span></td>
          <td><span class="td-cat-badge badge-<?= $cat ?>"><?= $info['icon'] ?> <?= $info['ar'] ?></span></td>
          <td><?php if ((float)$drug['price'] > 0): ?><span class="td-price"><?= number_format((float)$drug['price'], 0) ?> د.ع</span><?php else: ?><span style="color:var(--muted);font-size:12px;">—</span><?php endif; ?></td>
          <td style="color:var(--muted);font-size:12px;"><?= date('Y/m/d', strtotime($drug['created_at'])) ?></td>
          <td style="text-align:center;white-space:nowrap;">
            <a href="<?= $cat ?>/edit.php?id=<?= (int)$drug['id'] ?>" class="btn btn-secondary btn-sm" style="margin-left:6px;">✏️ تعديل</a>
            <a href="<?= $cat ?>/list.php" class="btn btn-secondary btn-sm">📋 القسم</a>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php endif; ?>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
(function(){
  const labels = <?= json_encode($chartDays, JSON_UNESCAPED_UNICODE) ?>;
  const cosm   = <?= json_encode($chartCosm) ?>;
  const kids   = <?= json_encode($chartKids) ?>;
  const med    = <?= json_encode($chartMed)  ?>;
  const noData = cosm.every(v=>v===0) && kids.every(v=>v===0) && med.every(v=>v===0);

  if (noData) {
    document.getElementById('addChart').parentElement.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted);font-size:14px;font-family:Tajawal,sans-serif;">' +
      '📊 ستظهر الرسوم البيانية بعد إضافة منتجات</div>';
    return;
  }

  new Chart(document.getElementById('addChart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'تجميل 💄', data:cosm, borderColor:'#c026d3', backgroundColor:'rgba(192,38,211,.07)', tension:.4, fill:true, pointRadius:2, borderWidth:2 },
        { label:'أطفال 🧸', data:kids, borderColor:'#ea580c', backgroundColor:'rgba(234,88,12,.07)',   tension:.4, fill:true, pointRadius:2, borderWidth:2 },
        { label:'طبي 🩺',   data:med,  borderColor:'#059669', backgroundColor:'rgba(5,150,105,.07)',   tension:.4, fill:true, pointRadius:2, borderWidth:2 },
      ]
    },
    options: {
      responsive:true,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'top', labels:{font:{family:'Tajawal',size:12}, boxWidth:10, padding:16}},
        tooltip:{rtl:true, bodyFont:{family:'Tajawal'}, titleFont:{family:'Tajawal'}},
      },
      scales:{
        y:{ beginAtZero:true, ticks:{stepSize:1, font:{family:'Tajawal',size:11}}, grid:{color:'#f3f4f6'} },
        x:{ ticks:{font:{family:'Tajawal',size:10}, maxRotation:45}, grid:{display:false} },
      }
    }
  });
})();
</script>

<?php
$bodyContent   = ob_get_clean();
$pageTitle     = 'لوحة التحكم';
$pageIcon      = '🏠';
$activeCat     = '';
$activePage    = 'dashboard';
$breadcrumbs   = [['label' => '🏠 لوحة التحكم']];
$topbarActions = '
  <a href="' . ROOT_DIR_URL . '/drugs.html" target="_blank" class="btn btn-secondary btn-sm">🌐 عرض المتجر</a>
  <a href="' . ROOT_DIR_URL . '/control-panel.php" class="btn btn-secondary btn-sm">⚙️ الإعدادات الكاملة</a>
';
require __DIR__ . '/_layout.php';
