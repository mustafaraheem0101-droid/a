<?php
/**
 * admin/_layout.php
 * قالب HTML مشترك لكل صفحات الإدارة
 *
 * المتغيرات المطلوبة قبل include:
 *   $pageTitle   string  عنوان الصفحة
 *   $activeCat   string  الفئة النشطة ('cosmetics'|'kids'|'medical'|'')
 *   $activePage  string  'dashboard'|'add'|'list'
 *   $bodyContent string  HTML المحتوى الرئيسي
 */
declare(strict_types=1);
if (!defined('ROOT_DIR')) die('Direct access not allowed');

$_csrf = admin_csrf_token();
$_cat  = $activeCat ?? '';
$_page = $activePage ?? '';
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate">
<title><?= htmlspecialchars($pageTitle ?? 'لوحة الإدارة', ENT_QUOTES) ?> — صيدلية شهد محمد</title>
<link href="/assets/css/fonts-tajawal.css?v=1.0.0" rel="stylesheet">
<link href="/assets/css/mobile-ux.css?v=1.0.1" rel="stylesheet">
<style>
/* ═══════════════════════════════ RESET & BASE ═══════════════════════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --g:#00875A;--g2:#006644;--g3:#004d33;--gl:#00a86e;--mint:#7fffc4;
  --g-bg:#f0faf5;--g-pale:#e4f5ec;
  --navy:#0a1628;--slate:#1e293b;--muted:#64748b;--soft:#94a3b8;
  --border:#e2e8f0;--bg:#f0f4f8;--white:#fff;
  --red:#ef4444;--amber:#f59e0b;--blue:#3b82f6;
  --pink:#e879f9;--orange:#fb923c;--teal:#34d399;
  --r:12px;--r-lg:18px;
  --sh:0 2px 12px rgba(0,0,0,.07);--sh-lg:0 8px 32px rgba(0,0,0,.12);
  --tr:all .2s cubic-bezier(.4,0,.2,1);
  --sidebar-w:260px;
}
html{font-family:'Tajawal',sans-serif;font-size:16px;background:var(--bg);}
body{min-height:100vh;color:var(--navy);}
a{text-decoration:none;color:inherit;}
img{max-width:100%;height:auto;display:block;}
button{cursor:pointer;font-family:inherit;}

/* ══════════════════════════════════ LAYOUT ══════════════════════════════════ */
.layout{display:flex;min-height:100vh;}

/* ── SIDEBAR ── */
.sidebar{
  width:var(--sidebar-w);flex-shrink:0;
  background:var(--navy);
  display:flex;flex-direction:column;
  position:sticky;top:0;height:100vh;overflow-y:auto;
  box-shadow:4px 0 24px rgba(0,0,0,.15);
  z-index:100;
}
.sb-brand{
  padding:24px 20px;border-bottom:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;gap:12px;
}
.sb-brand-icon{
  width:44px;height:44px;background:var(--g);border-radius:12px;
  display:flex;align-items:center;justify-content:center;font-size:22px;
  flex-shrink:0;
}
.sb-brand-text{line-height:1.3;}
.sb-brand-name{font-size:14px;font-weight:900;color:#fff;}
.sb-brand-sub{font-size:11px;color:rgba(255,255,255,.4);}

.sb-nav{padding:16px 12px;flex:1;}
.sb-section{margin-bottom:8px;}
.sb-section-label{
  font-size:10px;font-weight:800;color:rgba(255,255,255,.3);
  letter-spacing:.08em;padding:0 8px 6px;text-transform:uppercase;
}
.sb-link{
  display:flex;align-items:center;gap:10px;
  padding:10px 12px;border-radius:10px;
  font-size:13.5px;font-weight:600;color:rgba(255,255,255,.6);
  transition:var(--tr);margin-bottom:2px;
}
.sb-link:hover{background:rgba(255,255,255,.08);color:#fff;}
.sb-link.active{background:var(--g);color:#fff;box-shadow:0 4px 16px rgba(0,135,90,.35);}
.sb-link-icon{font-size:16px;width:20px;text-align:center;flex-shrink:0;}

.sb-cat-section{margin-top:8px;}
.sb-cat-header{
  display:flex;align-items:center;gap:8px;
  padding:8px 12px;font-size:11px;font-weight:800;
  color:rgba(255,255,255,.3);letter-spacing:.05em;text-transform:uppercase;
}
.sb-cat-block{
  border-radius:10px;overflow:hidden;margin-bottom:4px;
  border:1px solid rgba(255,255,255,.06);
}
.sb-cat-title{
  display:flex;align-items:center;gap:9px;
  padding:10px 12px;font-size:13px;font-weight:800;
  color:rgba(255,255,255,.75);background:rgba(255,255,255,.04);
}
.sb-cat-title .cat-badge{
  font-size:10px;background:rgba(255,255,255,.1);
  border-radius:6px;padding:2px 7px;margin-right:auto;
  color:rgba(255,255,255,.5);
}
.sb-cat-links{padding:4px 8px 8px;}
.sb-cat-link{
  display:flex;align-items:center;gap:8px;
  padding:8px 10px;border-radius:8px;
  font-size:12.5px;font-weight:600;color:rgba(255,255,255,.5);
  transition:var(--tr);
}
.sb-cat-link:hover{background:rgba(255,255,255,.07);color:#fff;}
.sb-cat-link.active{color:#fff;font-weight:800;}
.sb-cat-link.active.cosmetics{background:rgba(232,121,249,.15);color:#e879f9;}
.sb-cat-link.active.kids{background:rgba(251,146,60,.15);color:#fb923c;}
.sb-cat-link.active.medical{background:rgba(52,211,153,.15);color:#34d399;}

.sb-footer{
  padding:16px 12px;border-top:1px solid rgba(255,255,255,.08);
}
.sb-logout{
  display:flex;align-items:center;gap:8px;width:100%;
  padding:10px 12px;border-radius:10px;background:none;border:none;
  font-size:13px;font-weight:700;color:rgba(255,255,255,.45);
  transition:var(--tr);
}
.sb-logout:hover{background:rgba(239,68,68,.15);color:#fca5a5;}

/* ── MAIN ── */
.main{flex:1;display:flex;flex-direction:column;min-width:0;}
.topbar{
  background:var(--white);border-bottom:1px solid var(--border);
  padding:0 28px;height:64px;display:flex;align-items:center;
  justify-content:space-between;position:sticky;top:0;z-index:50;
  box-shadow:var(--sh);
}
.topbar-title{
  display:flex;align-items:center;gap:10px;
  font-size:18px;font-weight:900;color:var(--navy);
}
.topbar-title .page-icon{font-size:22px;}
.breadcrumb{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;}
.breadcrumb a{color:var(--g);font-weight:700;}
.breadcrumb a:hover{text-decoration:underline;}
.breadcrumb .sep{color:var(--border);}

.topbar-actions{display:flex;align-items:center;gap:10px;}
.page-content{padding:28px;flex:1;}

/* ══════════════════════════════════ CARDS ═══════════════════════════════════ */
.card{background:var(--white);border-radius:var(--r-lg);box-shadow:var(--sh);overflow:hidden;}
.card-header{
  padding:20px 24px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
}
.card-title{font-size:16px;font-weight:900;color:var(--navy);display:flex;align-items:center;gap:8px;}
.card-body{padding:24px;}

/* ══════════════════════════════════ BUTTONS ═════════════════════════════════ */
.btn{
  display:inline-flex;align-items:center;gap:7px;
  padding:10px 20px;border-radius:10px;border:none;
  font-family:inherit;font-size:13.5px;font-weight:800;
  transition:var(--tr);white-space:nowrap;
}
.btn-primary{background:var(--g);color:#fff;box-shadow:0 4px 16px rgba(0,135,90,.3);}
.btn-primary:hover{background:var(--g2);transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,135,90,.4);}
.btn-secondary{background:var(--g-pale);color:var(--g);border:1.5px solid var(--g-pale);}
.btn-secondary:hover{background:var(--g-bg);border-color:var(--g);}
.btn-danger{background:#fef2f2;color:var(--red);border:1.5px solid #fecaca;}
.btn-danger:hover{background:var(--red);color:#fff;}
.btn-sm{padding:7px 14px;font-size:12.5px;border-radius:8px;}
.btn-lg{padding:14px 28px;font-size:15px;border-radius:12px;}
.btn-pink{background:rgba(232,121,249,.12);color:#c026d3;border:1.5px solid rgba(232,121,249,.3);}
.btn-pink:hover{background:#e879f9;color:#fff;}
.btn-orange{background:rgba(251,146,60,.12);color:#ea580c;border:1.5px solid rgba(251,146,60,.3);}
.btn-orange:hover{background:#fb923c;color:#fff;}
.btn-teal{background:rgba(52,211,153,.12);color:#059669;border:1.5px solid rgba(52,211,153,.3);}
.btn-teal:hover{background:#34d399;color:#fff;}

/* ══════════════════════════════════ FORMS ═══════════════════════════════════ */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.form-grid.single{grid-template-columns:1fr;}
.form-group{display:flex;flex-direction:column;gap:6px;}
.form-group.full{grid-column:1/-1;}
.form-label{font-size:13px;font-weight:800;color:var(--slate);}
.form-label .req{color:var(--red);}
.form-input{
  height:48px;padding:0 14px;
  background:var(--bg);border:2px solid var(--border);
  border-radius:10px;font-family:inherit;font-size:14px;
  color:var(--navy);outline:none;transition:var(--tr);
}
.form-input:focus{border-color:var(--g);background:var(--white);box-shadow:0 0 0 4px rgba(0,135,90,.1);}
.form-textarea{
  min-height:100px;padding:12px 14px;resize:vertical;
  background:var(--bg);border:2px solid var(--border);
  border-radius:10px;font-family:inherit;font-size:14px;
  color:var(--navy);outline:none;transition:var(--tr);
}
.form-textarea:focus{border-color:var(--g);background:var(--white);box-shadow:0 0 0 4px rgba(0,135,90,.1);}
.form-hint{font-size:11.5px;color:var(--muted);}

/* Upload area */
.upload-area{
  border:2.5px dashed var(--border);border-radius:14px;
  padding:32px;text-align:center;cursor:pointer;
  transition:var(--tr);position:relative;background:var(--bg);
}
.upload-area:hover,.upload-area.drag{border-color:var(--g);background:var(--g-bg);}
.upload-area input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;}
.upload-icon{font-size:36px;margin-bottom:10px;}
.upload-text{font-size:14px;font-weight:700;color:var(--navy);margin-bottom:4px;}
.upload-sub{font-size:12px;color:var(--muted);}
.preview-img{
  width:120px;height:120px;object-fit:cover;border-radius:12px;
  border:3px solid var(--g);box-shadow:var(--sh);
  margin:0 auto 10px;
}

/* ══════════════════════════════════ TABLE ═══════════════════════════════════ */
.table-wrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;}
th{
  text-align:right;padding:12px 16px;
  background:var(--bg);border-bottom:2px solid var(--border);
  font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.04em;
  white-space:nowrap;
}
td{padding:14px 16px;border-bottom:1px solid var(--border);font-size:13.5px;vertical-align:middle;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:#fafbfc;}
.td-img{width:56px;height:56px;object-fit:cover;border-radius:10px;border:2px solid var(--border);}
.td-name{font-weight:800;color:var(--navy);}
.td-price{font-weight:900;color:var(--g);font-size:14px;}
.td-cat-badge{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 10px;border-radius:20px;font-size:11.5px;font-weight:800;
}
.badge-cosmetics{background:rgba(232,121,249,.12);color:#c026d3;}
.badge-kids{background:rgba(251,146,60,.12);color:#ea580c;}
.badge-medical{background:rgba(52,211,153,.12);color:#059669;}

/* ══════════════════════════════════ ALERTS ══════════════════════════════════ */
.alert{padding:14px 18px;border-radius:12px;font-size:13.5px;font-weight:700;margin-bottom:20px;display:flex;align-items:center;gap:10px;}
.alert-success{background:#f0fdf4;color:#166534;border:1.5px solid #bbf7d0;}
.alert-error{background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;}
.alert-info{background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;}

/* ══════════════════════════════════ STAT CARDS ══════════════════════════════ */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:28px;}
.stat-card{
  background:var(--white);border-radius:var(--r-lg);padding:22px;
  box-shadow:var(--sh);display:flex;align-items:center;gap:16px;
  transition:var(--tr);
}
.stat-card:hover{transform:translateY(-3px);box-shadow:var(--sh-lg);}
.stat-icon{
  width:52px;height:52px;border-radius:14px;
  display:flex;align-items:center;justify-content:center;font-size:24px;
  flex-shrink:0;
}
.stat-info{}
.stat-num{font-size:26px;font-weight:900;color:var(--navy);line-height:1;}
.stat-label{font-size:12px;color:var(--muted);font-weight:600;margin-top:4px;}

/* ══════════════════════════════════ CAT CARDS ═══════════════════════════════ */
.cat-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:32px;}
.cat-card{
  border-radius:var(--r-lg);overflow:hidden;
  box-shadow:var(--sh);transition:var(--tr);
}
.cat-card:hover{transform:translateY(-4px);box-shadow:var(--sh-lg);}
.cat-card-header{padding:24px;display:flex;align-items:center;gap:14px;}
.cat-card-icon{font-size:32px;width:60px;height:60px;border-radius:16px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;}
.cat-card-info{flex:1;}
.cat-card-name{font-size:17px;font-weight:900;color:#fff;}
.cat-card-en{font-size:12px;color:rgba(255,255,255,.65);margin-top:2px;}
.cat-card-count{font-size:28px;font-weight:900;color:#fff;margin-top:2px;}
.cat-card-count-label{font-size:11px;color:rgba(255,255,255,.6);}
.cat-card-footer{background:rgba(255,255,255,.08);padding:14px 20px;display:flex;gap:10px;}
.cat-card-btn{
  flex:1;padding:9px;border-radius:9px;border:none;
  font-family:inherit;font-size:13px;font-weight:800;
  background:rgba(255,255,255,.15);color:#fff;
  transition:var(--tr);text-align:center;
}
.cat-card-btn:hover{background:rgba(255,255,255,.28);}

/* cosmetics */
.cat-cosmetics .cat-card-header{background:linear-gradient(135deg,#9333ea,#e879f9);}
/* kids */
.cat-kids .cat-card-header{background:linear-gradient(135deg,#ea580c,#fb923c);}
/* medical */
.cat-medical .cat-card-header{background:linear-gradient(135deg,#059669,#34d399);}

/* ══════════════════════════════════ EMPTY STATE ═════════════════════════════ */
.empty-state{text-align:center;padding:60px 20px;}
.empty-icon{font-size:52px;margin-bottom:14px;}
.empty-title{font-size:18px;font-weight:800;color:var(--navy);margin-bottom:6px;}
.empty-sub{font-size:13px;color:var(--muted);}

/* ══════════════════════════════════ RESPONSIVE ══════════════════════════════ */
@media(max-width:900px){
  .sidebar{display:none;}
  .cat-cards{grid-template-columns:1fr;}
  .form-grid{grid-template-columns:1fr;}
  .page-content{padding:16px;}
  .stats-grid{grid-template-columns:1fr 1fr;}
}
@media(max-width:500px){
  .stats-grid{grid-template-columns:1fr;}
  .topbar{padding:0 16px;}
  .topbar-title{font-size:15px;}
}
</style>
</head>
<body>
<div class="layout">

<!-- ════════════════════ SIDEBAR ════════════════════ -->
<aside class="sidebar">
  <div class="sb-brand">
    <div class="sb-brand-icon">💊</div>
    <div class="sb-brand-text">
      <div class="sb-brand-name">صيدلية شهد محمد</div>
      <div class="sb-brand-sub">لوحة الإدارة</div>
    </div>
  </div>

  <nav class="sb-nav">
    <div class="sb-section">
      <div class="sb-section-label">الرئيسية</div>
      <a href="<?= ROOT_DIR_URL ?>/admin/dashboard.php" class="sb-link <?= ($_page === 'dashboard') ? 'active' : '' ?>">
        <span class="sb-link-icon">🏠</span> لوحة التحكم
      </a>
    </div>

    <div class="sb-cat-section">
      <div class="sb-cat-header">📦 إدارة الأقسام</div>

      <?php foreach (CATEGORY_LABELS as $slug => $info): ?>
      <div class="sb-cat-block">
        <div class="sb-cat-title">
          <span><?= $info['icon'] ?></span>
          <span><?= $info['ar'] ?></span>
          <span class="cat-badge"><?= $info['en'] ?></span>
        </div>
        <div class="sb-cat-links">
          <a href="<?= ROOT_DIR_URL ?>/admin/<?= $slug ?>/add.php"
             class="sb-cat-link <?= $slug ?> <?= ($_cat === $slug && $_page === 'add') ? 'active ' . $slug : '' ?>">
            ➕ إضافة منتج
          </a>
          <a href="<?= ROOT_DIR_URL ?>/admin/<?= $slug ?>/list.php"
             class="sb-cat-link <?= $slug ?> <?= ($_cat === $slug && $_page === 'list') ? 'active ' . $slug : '' ?>">
            📋 قائمة المنتجات
          </a>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </nav>

  <div class="sb-footer">
    <a href="<?= ROOT_DIR_URL ?>/control-panel.php" class="sb-logout" style="display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.5);margin-bottom:6px;">
      ⚙️ لوحة التحكم الكاملة
    </a>
    <a href="<?= ROOT_DIR_URL ?>/logout.php" class="sb-logout">
      🚪 تسجيل الخروج
    </a>
  </div>
</aside>

<!-- ════════════════════ MAIN ════════════════════ -->
<main class="main">
  <div class="topbar">
    <div>
      <div class="topbar-title">
        <span class="page-icon"><?= $pageIcon ?? '🏥' ?></span>
        <?= htmlspecialchars($pageTitle ?? 'لوحة الإدارة', ENT_QUOTES) ?>
      </div>
      <?php if (!empty($breadcrumbs)): ?>
      <div class="breadcrumb">
        <?php foreach ($breadcrumbs as $i => $bc): ?>
          <?php if ($i > 0): ?><span class="sep">›</span><?php endif; ?>
          <?php if (isset($bc['url'])): ?>
            <a href="<?= htmlspecialchars($bc['url']) ?>"><?= htmlspecialchars($bc['label']) ?></a>
          <?php else: ?>
            <span><?= htmlspecialchars($bc['label']) ?></span>
          <?php endif; ?>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>
    </div>
    <div class="topbar-actions">
      <?= $topbarActions ?? '' ?>
    </div>
  </div>

  <div class="page-content">
    <?= $bodyContent ?? '' ?>
  </div>
</main>

</div><!-- .layout -->

<script>
// تأكيد الحذف
document.addEventListener('click', function(e){
  const btn = e.target.closest('[data-confirm]');
  if (!btn) return;
  if (!confirm(btn.dataset.confirm || 'هل أنت متأكد؟')) e.preventDefault();
});
// Toast تلقائي يختفي
setTimeout(function(){
  document.querySelectorAll('.alert').forEach(function(el){
    el.style.transition='opacity .5s';
    el.style.opacity='0';
    setTimeout(function(){el.remove();},600);
  });
}, 3500);
</script>
</body>
</html>
