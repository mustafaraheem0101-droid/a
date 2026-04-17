const CATS = {
  all:       { ar: 'الكل',                 icon: '🛍️',  cls: 'all' },
  cosmetics: { ar: 'مستحضرات التجميل',    icon: '💄',  cls: 'cosmetics' },
  kids:      { ar: 'منتجات الأطفال',       icon: '🧸',  cls: 'kids' },
  medical:   { ar: 'المستلزمات الطبية',   icon: '🩺',  cls: 'medical' },
};

const API = 'admin/api-drugs.php';
let currentCat = 'all';
let searchTimer = null;
let allCounts = {};

// ── جلب الإحصائيات أولاً ────────────────────────────────────────────
async function loadCounts() {
  try {
    const res = await fetch(API + '?category=all&per_page=1');
    const json = await res.json();
    if (json.status === 'success') allCounts.all = json.data.pagination.total;
  } catch(e) {}
  for (const cat of ['cosmetics','kids','medical']) {
    try {
      const res = await fetch(API + '?category=' + cat + '&per_page=1');
      const json = await res.json();
      if (json.status === 'success') allCounts[cat] = json.data.pagination.total;
    } catch(e) {}
  }
  renderTabs();
}

// ── Tabs ─────────────────────────────────────────────────────────────
function renderTabs() {
  const container = document.getElementById('tabsContainer');
  container.innerHTML = Object.entries(CATS).map(([slug, info]) => {
    const cnt = allCounts[slug] ?? '';
    const active = slug === currentCat ? 'active ' + info.cls : '';
    return `<button type="button" class="tab-btn ${active}" data-cat="${slug}">
      ${info.icon} ${info.ar}
      ${cnt !== '' ? '<span class="tab-count">' + cnt + '</span>' : ''}
    </button>`;
  }).join('');
}

// ── تبديل القسم ─────────────────────────────────────────────────────
function switchCat(cat) {
  currentCat = cat;
  const info = CATS[cat];
  document.getElementById('heroIcon').textContent  = info.icon;
  document.getElementById('heroTitle').textContent = info.ar;
  document.getElementById('searchInput').value     = '';
  renderTabs();
  loadProducts();
}

// ── تحميل المنتجات ───────────────────────────────────────────────────
async function loadProducts(q = '') {
  const grid = document.getElementById('productsGrid');
  const box  = document.getElementById('stateBox');

  // Skeleton
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="skel-card">
      <div class="skeleton skel-img"></div>
      <div class="skel-body">
        <div class="skeleton skel-line w80"></div>
        <div class="skeleton skel-line w50"></div>
      </div>
    </div>`).join('');
  box.style.display = 'none';

  try {
    let url = API + '?category=' + currentCat + '&per_page=60';
    if (q) url += '&q=' + encodeURIComponent(q);
    const res  = await fetch(url);
    const json = await res.json();

    if (json.status !== 'success') throw new Error(json.message || 'خطأ');
    const drugs = json.data.drugs;

    grid.innerHTML = '';
    if (drugs.length === 0) {
      box.style.display = 'block';
      box.innerHTML = `<div class="state-icon">${q ? '🔍' : CATS[currentCat].icon}</div>
        <div class="state-title">${q ? 'لا توجد نتائج' : 'لا توجد منتجات بعد'}</div>
        <div class="state-sub">${q ? 'جرّب كلمة بحث مختلفة' : 'سيتم إضافة المنتجات قريباً'}</div>`;
      return;
    }

    grid.innerHTML = drugs.map(d => drugCard(d)).join('');
    // تحديث العدد
    allCounts[currentCat] = json.data.pagination.total;
    renderTabs();

  } catch(e) {
    grid.innerHTML = '';
    box.style.display = 'block';
    box.innerHTML = `<div class="state-icon">⚠️</div>
      <div class="state-title">تعذّر تحميل المنتجات</div>
      <div class="state-sub">${e.message}</div>`;
  }
}

// ── بطاقة منتج ───────────────────────────────────────────────────────
function drugCard(d) {
  const catInfo = CATS[d.category] || { ar: d.category, icon: '💊' };
  const imgSrc  = d.image_url
    ? d.image_url
    : 'assets/img/placeholder.svg';
  const price   = d.price > 0
    ? `<span class="prod-price">${d.price.toLocaleString('ar-IQ')} د.ع</span>`
    : `<span class="prod-price free">السعر عند الطلب</span>`;
  const desc    = d.description
    ? `<div class="prod-desc">${esc(d.description)}</div>`
    : '';
  const waMsg   = encodeURIComponent(`أريد الاستفسار عن: ${d.name}`);

  return `
  <div class="prod-card">
    <div class="prod-img-wrap">
      <img class="prod-img" src="${imgSrc}" alt="${esc(d.name)}"
           width="440" height="440" loading="lazy" decoding="async" data-fallback-src="assets/img/placeholder.svg">
      <span class="prod-cat-badge badge-${d.category}">${catInfo.icon} ${catInfo.ar}</span>
    </div>
    <div class="prod-body">
      <div class="prod-name">${esc(d.name)}</div>
      ${desc}
      <div class="prod-footer">
        ${price}
        <button type="button" class="wa-btn" data-wa-name="${encodeURIComponent(d.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15
            -.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475
            -.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52
            .149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207
            -.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372
            -.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2
            5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085
            1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.312
            A9.945 9.945 0 0012 22c5.523 0 10-4.477 10-10S17.522 2 11.999 2zm.001 18a7.963 7.963 0
            01-4.07-1.115l-.29-.173-3.005.79.8-2.92-.19-.3A7.97 7.97 0 014 12c0-4.418 3.582-8
            8-8s8 3.582 8 8-3.581 8-7.999 8z"/>
          </svg>
          اطلب الآن
        </button>
      </div>
    </div>
  </div>`;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function waOrder(name) {
  const phone = '9647711954040';
  const msg   = encodeURIComponent(`السلام عليكم، أريد الاستفسار عن المنتج: ${name}`);
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

// ── Search ───────────────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', function() {
  clearTimeout(searchTimer);
  const q = this.value.trim();
  searchTimer = setTimeout(() => loadProducts(q), 350);
});

document.addEventListener('error', function drugProdImgFallback(ev) {
  const t = ev.target;
  if (!t || t.tagName !== 'IMG' || !t.classList.contains('prod-img')) return;
  const fb = t.getAttribute('data-fallback-src');
  if (fb && t.src.indexOf('placeholder') === -1) {
    t.src = fb;
  }
}, true);

document.getElementById('tabsContainer').addEventListener('click', function (e) {
  const btn = e.target.closest('.tab-btn');
  if (!btn || !btn.dataset.cat) return;
  switchCat(btn.dataset.cat);
});

document.getElementById('productsGrid').addEventListener('click', function (e) {
  const b = e.target.closest('.wa-btn');
  if (!b || b.dataset.waName == null || b.dataset.waName === '') return;
  try {
    waOrder(decodeURIComponent(b.dataset.waName));
  } catch (err) {
    waOrder(b.dataset.waName);
  }
});

// ── Init ─────────────────────────────────────────────────────────────
(async function init() {
  const params = new URLSearchParams(location.search);
  const catParam = params.get('cat') || 'all';
  /* المتجر الرئيسي لقسم الأطفال هو category.html — تجنّب صفحة drugs الفارغة/القديمة */
  if (catParam === 'kids') {
    location.replace('category.html?slug=kids');
    return;
  }
  if (CATS[catParam]) currentCat = catParam;
  const info = CATS[currentCat];
  document.getElementById('heroIcon').textContent = info.icon;
  document.getElementById('heroTitle').textContent = info.ar;

  renderTabs();
  await loadCounts();
  loadProducts();
})();
