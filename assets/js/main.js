/* main.js — منطق الواجهة الأمامية (مدمج) */
'use strict';

function __pharmaStoreHtmlFile() {
  var seg = (location.pathname.split('/').pop() || '').replace(/\?.*$/, '');
  return seg || 'index.html';
}

/* ---------- config.js ---------- */
/* config.js — إعدادات المشروع الرئيسية */
const API = 'api.php';
const MAP_URL = 'https://maps.app.goo.gl/9YRxXPqV9qtkRKrG7';

let settings = {
  phone: '07711954040',
  whatsapp: '9647711954040',
  address: 'الديالى - خانقين | مقابل مجمع سوڤار',
  openHour: 15,
  closeHour: 24,
  mapUrl: MAP_URL,
  instagram: '',
  facebook: ''
};

let prods = [];
let cart = [];
let likes = new Set();

// استعادة السلة من sessionStorage
try {
  const _cr = sessionStorage.getItem('pharma_cart_v1');
  if (_cr) {
    const _parsed = JSON.parse(_cr);
    if (Array.isArray(_parsed) && _parsed.length) {
      _parsed.forEach(x => cart.push(x));
    }
  }
} catch (e) {}

// استعادة الإعجابات
try {
  const _lk = localStorage.getItem('pharma_likes_v1');
  if (_lk) {
    const _arr = JSON.parse(_lk);
    if (Array.isArray(_arr)) _arr.forEach(id => likes.add(id));
  }
} catch (e) {}

window.API = API;
window.MAP_URL = MAP_URL;
window.settings = settings;
window.prods = prods;
window.cart = cart;
window.likes = likes;

/* ---------- shop-state.js ---------- */
/* shop-state.js — حالة خفيفة للمنتجات (بدون إطار عمل) */
(function () {
  var base = window.prods;
  if (!Array.isArray(base)) return;

  var listeners = [];

  var shopState = {
    products: base,
    version: 0
  };

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function unsubscribe() {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  /**
   * يستبدل محتوى مصفوفة المنتجات المشتركة (نفس مرجع window.prods / prods).
   * meta.view يحدد أي مشترك يعيد الرسم؛ meta.notify === false يمنع الإشعار.
   */
  function setShopProducts(next, meta) {
    meta = meta || {};
    var arr = Array.isArray(next) ? next : [];
    var p = shopState.products;
    p.length = 0;
    for (var i = 0; i < arr.length; i++) p.push(arr[i]);
    shopState.version++;
    window.prods = p;
    if (meta.notify === false) return;
    listeners.slice().forEach(function (fn) {
      try {
        fn(shopState, meta);
      } catch (e) {
        if (typeof pharmaLogError === 'function') pharmaLogError('[shop-state]', e);
      }
    });
  }

  window.shopState = shopState;
  window.subscribeShopState = subscribe;
  window.setShopProducts = setShopProducts;
})();

/* ---------- cart.js ---------- */
/* cart.js — إدارة السلة */
function saveCart() {
  try { sessionStorage.setItem('pharma_cart_v1', JSON.stringify(cart)); } catch (e) {}
}

function cartCount() {
  return cart.reduce((s, i) => s + (i.qty || 1), 0);
}

function cartTotal() {
  return cart.reduce((s, i) => s + (Number(i.price || 0) * (i.qty || 1)), 0);
}

/** أقصى عدد أسطر في السلة يُطبَّق عليها خصم عرض الرف (حسب ترتيب الإضافة). */
var CART_PROMO_MAX_DISCOUNTED_LINES = 3;

/**
 * يعيد تسعير كل سطر: أول 3 أسطر مؤهَّلة (قسم مسموح) تحصل على خصم العرض؛ الباقي بالسعر الاعتيادي.
 * يُخزَّن لكل بند: listPrice، price (الفعلي)، isDiscounted.
 */
function resolveCartLineCategorySlug(item) {
  if (!item) return '';
  if (item.category != null && String(item.category).trim() !== '') return String(item.category).trim();
  var cat = typeof prods !== 'undefined' && Array.isArray(prods)
    ? prods.find(function (x) { return x.id == item.id; })
    : null;
  if (!cat) return '';
  if (typeof productPrimaryCategorySlugs === 'function') {
    var slugs = productPrimaryCategorySlugs(cat);
    return slugs.length ? slugs[0] : '';
  }
  if (cat.cat != null && String(cat.cat).trim() !== '') return String(cat.cat).trim();
  return '';
}

function resolveCategoryFromProductForCart(p) {
  if (!p) return null;
  if (p.cat != null && String(p.cat).trim() !== '') return String(p.cat).trim();
  if (p.category != null && String(p.category).trim() !== '') return String(p.category).trim();
  if (Array.isArray(p.categories) && p.categories.length) return String(p.categories[0]).trim();
  return null;
}

function recalculateCartLineDiscounts() {
  if (!Array.isArray(cart)) return;
  if (!cart.length) {
    try { sessionStorage.setItem('pharma_cart_v1', JSON.stringify(cart)); } catch (e) {}
    return;
  }
  var promoPct = typeof getShelfPromoDiscountPercent === 'function' ? getShelfPromoDiscountPercent() : 0;
  var maxSlots = CART_PROMO_MAX_DISCOUNTED_LINES;
  var promoActive = promoPct > 0;
  var slotsUsed = 0;

  cart.forEach(function (item) {
    var cat = typeof prods !== 'undefined' && Array.isArray(prods)
      ? prods.find(function (x) { return x.id == item.id; })
      : null;
    var list = Number(item.listPrice);
    if (!Number.isFinite(list) || list < 0) {
      list = cat ? (Number(cat.price) || 0) : (Number(item.price) || 0);
    }
    item.listPrice = list;

    var slug = resolveCartLineCategorySlug(item);
    var categoryOk = false;
    if (cat && typeof isProductCategoryEligibleForQrShelfPromo === 'function') {
      categoryOk = isProductCategoryEligibleForQrShelfPromo(cat);
    } else if (typeof isQrShelfLineSlugEligibleForPromo === 'function') {
      categoryOk = isQrShelfLineSlugEligibleForPromo(slug);
    } else if (typeof isQrShelfCategorySlugAllowed === 'function') {
      categoryOk = isQrShelfCategorySlugAllowed(slug);
    }

    if (promoActive && categoryOk && slotsUsed < maxSlots && list > 0) {
      item.isDiscounted = true;
      item.price = typeof applyShelfPromoToPrice === 'function' ? applyShelfPromoToPrice(list, promoPct) : list;
      slotsUsed++;
    } else {
      item.isDiscounted = false;
      item.price = list;
    }
  });
  try { sessionStorage.setItem('pharma_cart_v1', JSON.stringify(cart)); } catch (e) {}
}

function updateCartBadge() {
  const n = cartCount();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = n;
    el.style.display = n > 0 ? 'flex' : 'none';
  });
}

function addToCart(id, fallback) {
  let p = prods.find(x => x.id == id || x.id === id);
  if (!p && fallback && fallback.name) {
    const pr = fallback.price != null && String(fallback.price) !== ''
      ? Number(fallback.price)
      : 0;
    p = {
      id: id,
      name: String(fallback.name),
      price: Number.isFinite(pr) ? pr : 0,
      image: fallback.image || fallback.img || null,
      slug: fallback.slug != null ? String(fallback.slug) : null,
      cat: fallback.cat != null ? String(fallback.cat) : (fallback.category != null ? String(fallback.category) : null),
      category: fallback.category != null ? String(fallback.category) : null,
      categories: Array.isArray(fallback.categories) ? fallback.categories : undefined
    };
  }
  if (!p) {
    if (typeof showToast === 'function') showToast('تعذر إضافة المنتج — حدّث الصفحة وحاول مجدداً', 'error');
    return;
  }
  const baseList = Number(p.price) || 0;
  const ex = cart.find(x => x.id == id);
  const catSlug = resolveCategoryFromProductForCart(p);
  if (ex) {
    ex.qty = (ex.qty || 1) + 1;
    if (!ex.category && catSlug) ex.category = catSlug;
  } else {
    cart.push({
      id: p.id,
      name: p.name,
      listPrice: baseList,
      price: baseList,
      image: p.image || p.img || null,
      slug: p.slug != null ? String(p.slug) : null,
      category: catSlug,
      qty: 1
    });
  }
  recalculateCartLineDiscounts();
  updateCartBadge();
  renderCartBody();
  showToast('تمت الإضافة إلى السلة ✓');
  try {
    const rw = document.getElementById('prodReviewsWrap');
    if (rw && String(rw.getAttribute('data-product-id') || '') === String(id)) {
      sessionStorage.setItem('pharma_review_nudge_' + String(id), '1');
    }
  } catch (e) { /* ignore */ }
}

function removeFromCart(id) {
  const idx = cart.findIndex(x => x.id == id);
  if (idx > -1) {
    cart.splice(idx, 1);
    recalculateCartLineDiscounts();
    updateCartBadge();
    renderCartBody();
  }
}

function changeQty(id, delta) {
  const ex = cart.find(x => x.id == id);
  if (!ex) return;
  ex.qty = Math.max(1, (ex.qty || 1) + delta);
  recalculateCartLineDiscounts();
  updateCartBadge();
  renderCartBody();
}

function renderCartBody() {
  const body = document.getElementById('csBody');
  const ft = document.getElementById('csFt');
  const countEl = document.getElementById('csHeadCount');
  const cntLine = document.getElementById('csLineCount');
  const subEl = document.getElementById('csSubtotal');
  const totEl = document.getElementById('csTotal');
  const saveRow = document.getElementById('csSaveRow');
  const saveAmt = document.getElementById('csSaveAmt');
  if (!body) return;

  recalculateCartLineDiscounts();

  if (!cart.length) {
    var onQrOffer =
      typeof isQrDiscountLandingPage === 'function' && isQrDiscountLandingPage();
    var emptyCta = onQrOffer
      ? '<button type="button" class="cs-empty-cta" data-action="close-cart">متابعة التسوق</button>'
      : '<a href="categories.html" class="cs-empty-cta" data-action="toggle-cart">تصفح المنتجات</a>';
    var emptyDesc = onQrOffer
      ? 'أضف منتجات من عروض العرض أدناه'
      : 'ابدأ بإضافة منتجات لتحسين صحتك';
    replaceChildrenFromHtml(body, `<div class="cs-empty cs-empty--animated">
      <div class="cs-empty-art" aria-hidden="true">
        <svg class="cs-empty-svg" viewBox="0 0 200 160" fill="none">
          <ellipse cx="100" cy="148" rx="72" ry="8" fill="rgba(0,135,90,.12)"/>
          <rect x="48" y="36" width="104" height="112" rx="16" fill="#f1f5f9" stroke="#cfe8dc" stroke-width="2"/>
          <rect x="58" y="50" width="84" height="56" rx="8" fill="#fff" stroke="#e2e8f0"/>
          <circle cx="100" cy="78" r="18" fill="rgba(0,135,90,.15)"/>
          <path d="M94 78h12M100 72v12" stroke="#00875A" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <h4 class="cs-empty-title">سلتك فارغة</h4>
      <p class="cs-empty-desc">${emptyDesc}</p>
      ${emptyCta}
    </div>`);
    if (ft) ft.style.display = 'none';
    if (countEl) countEl.hidden = true;
    if (saveRow) saveRow.style.display = 'none';
    return;
  }

  var promoPctUi = typeof getShelfPromoDiscountPercent === 'function' ? getShelfPromoDiscountPercent() : 0;
  var showSlotNotice =
    promoPctUi > 0 &&
    (typeof isQrDiscountLandingPage !== 'function' || isQrDiscountLandingPage());
  var noticeHtml = showSlotNotice
    ? '<div class="cs-slot-notice" role="status">🔥 خصم العرض: أول 3 منتجات في أقسام التجميل، العناية بالشعر، الفيتامينات، ومنتجات الأطفال — لا يشمل الأدوية</div>'
    : '';

  replaceChildrenFromHtml(body, noticeHtml + cart.map(item => {
    const q = Math.max(1, parseInt(String(item.qty || 1), 10) || 1);
    const unit = Number(item.price || 0);
    const line = unit * q;
    const listU = Number(item.listPrice != null ? item.listPrice : unit);
    const lineAtList = listU * q;
    var priceBlock;
    if (item.isDiscounted && Number.isFinite(listU) && listU > unit) {
      priceBlock = q > 1
        ? `<div class="cs-item-price-block"><div class="cs-item-price-row"><span class="cs-item-price-old">${fmt(lineAtList)}</span><span class="cs-item-subtotal">${fmt(line)}</span></div><div class="cs-item-unit-meta">${fmt(unit)} × ${q}</div></div>`
        : `<div class="cs-item-price-block"><div class="cs-item-price-row"><span class="cs-item-price-old">${fmt(listU)}</span><span class="cs-item-subtotal">${fmt(line)}</span></div><div class="cs-item-unit-meta">بعد خصم العرض</div></div>`;
    } else {
      priceBlock = q > 1
        ? `<div class="cs-item-price-block"><div class="cs-item-subtotal">${fmt(line)}</div><div class="cs-item-unit-meta">${fmt(unit)} × ${q}</div></div>`
        : `<div class="cs-item-price-block"><div class="cs-item-subtotal">${fmt(line)}</div></div>`;
    }
    return `
    <div class="cs-item" data-id="${escHtml(item.id)}">
      <div class="cs-item-img">
        ${(item.image && typeof item.image === 'string' && (item.image.startsWith('http://')||item.image.startsWith('https://')||item.image.startsWith('/'))) ? `<img src="${escHtml(item.image)}" alt="${escHtml(item.name)}" class="img-cover" loading="lazy" decoding="async">` : `<span style="font-size:28px">📦</span>`}
      </div>
      <div class="cs-item-info">
        <div class="cs-item-name">${escHtml(item.name)}</div>
        ${priceBlock}
      </div>
      <div class="cs-item-qty">
        <button data-action="qty-minus" data-id="${escHtml(item.id)}" aria-label="تقليل">−</button>
        <span>${q}</span>
        <button data-action="qty-plus" data-id="${escHtml(item.id)}" aria-label="زيادة">+</button>
      </div>
      <button class="cs-item-del" data-action="remove-cart" data-id="${escHtml(item.id)}" aria-label="حذف">✕</button>
    </div>`;
  }).join(''));

  const cnt = cartCount(), total = cartTotal();
  var savedSum = 0;
  cart.forEach(function (ci) {
    var cq = Math.max(1, parseInt(String(ci.qty || 1), 10) || 1);
    var lu = Number(ci.listPrice != null ? ci.listPrice : ci.price);
    var eu = Number(ci.price || 0);
    if (ci.isDiscounted && Number.isFinite(lu) && lu > eu) savedSum += (lu - eu) * cq;
  });
  if (ft) {
    ft.style.display = 'block';
    if (cntLine) cntLine.textContent = cnt;
    if (subEl) subEl.textContent = fmt(total);
    if (totEl) totEl.textContent = fmt(total);
  }
  if (saveRow && saveAmt) {
    if (savedSum > 0.0001) {
      saveRow.style.display = '';
      saveAmt.textContent = fmt(savedSum);
    } else {
      saveRow.style.display = 'none';
    }
  }
  if (countEl) { countEl.textContent = cnt + ' منتج'; countEl.hidden = false; }
}

function toggleCart() {
  const cs = document.getElementById('cs');
  const co = document.getElementById('co');
  if (!cs) return;
  const isOpen = cs.classList.toggle('open');
  co && co.classList.toggle('open', isOpen);
  if (isOpen) renderCartBody();
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function openModal() {
  const mo = document.getElementById('mo');
  if (!mo) return;
  recalculateCartLineDiscounts();
  const lines = document.getElementById('moOrderLines');
  const totEl = document.getElementById('moOrderTotal');
  if (lines) {
    const html = typeof cartItemModalSummaryLiHtml === 'function'
      ? cart.map(function (i) { return cartItemModalSummaryLiHtml(i); }).join('')
      : cart.map(function (i) {
          return '<li><span>' + escHtml(i.name) + ' × ' + (i.qty || 1) + '</span><strong>' + fmt(Number(i.price) * (i.qty || 1)) + '</strong></li>';
        }).join('');
    replaceChildrenFromHtml(lines, html);
  }
  if (totEl) totEl.textContent = fmt(cartTotal());
  mo.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const mo = document.getElementById('mo');
  if (mo) mo.style.display = 'none';
  document.body.style.overflow = '';
}

function sendWA() {
  const name = (document.getElementById('cName')?.value || '').trim();
  const phone = (document.getElementById('cPhone')?.value || '').trim();
  const addr = (document.getElementById('cAddr')?.value || '').trim();
  const notes = (document.getElementById('cNotes')?.value || '').trim();

  let valid = true;
  const nameErr = document.getElementById('cNameErr');
  const phoneErr = document.getElementById('cPhoneErr');
  if (nameErr) nameErr.textContent = '';
  if (phoneErr) phoneErr.textContent = '';

  if (!name) { if (nameErr) nameErr.textContent = 'الرجاء إدخال الاسم'; valid = false; }
  if (!valid) return;

  recalculateCartLineDiscounts();

  /* الهاتف اختياري: يُذكر في واتساب بعد تطبيع (+964، أرقام عربية، إلخ) */
  const phoneOk =
    typeof normalizeOrderPhoneForWa === 'function'
      ? normalizeOrderPhoneForWa(phone)
      : (function () {
          const n = phone.replace(/\s/g, '');
          return n && /^07\d{9}$/.test(n) ? n : '';
        })();

  var msg = typeof buildWhatsAppCartOrderMessage === 'function'
    ? buildWhatsAppCartOrderMessage({
        name: name,
        phone: phoneOk,
        addr: addr,
        notes: notes,
        cart: cart,
        total: cartTotal()
      })
    : '';
  if (!msg) {
    msg = 'مرحبا 👋\nأرغب بطلب المنتجات التالية:\n\n👤 الاسم: ' + name + '\n';
    if (phoneOk) msg += '📞 الهاتف: ' + phoneOk + '\n';
    if (addr) msg += '📍 العنوان: ' + addr + '\n';
    msg += '\n🛒 الطلب:\n\n';
    if (typeof buildCartItemsDetailsForWa === 'function') {
      msg += buildCartItemsDetailsForWa(cart) + '\n\n';
    }
    msg += '💰 المجموع: ' + fmt(cartTotal()) + '\n\n';
    msg += '📍 الرجاء تأكيد توفر المنتجات وإتمام الطلب\nشكراً لكم 🙏';
    if (notes) msg += '\n\n📝 ملاحظات: ' + notes;
  }

  const cartSnap = cart.map(function (i) {
    return { id: i.id, name: i.name, price: i.price, qty: i.qty || 1 };
  });
  if (typeof logWhatsappCartIntent === 'function') logWhatsappCartIntent(cartSnap);
  try {
    cartSnap.forEach(function (i) {
      if (i && i.id != null) sessionStorage.setItem('pharma_review_nudge_' + String(i.id), '1');
    });
  } catch (e) { /* ignore */ }
  (function openWaSafe(href) {
    var a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  })(buildWaUrl(msg));
  closeModal();
  cart.length = 0;
  saveCart();
  updateCartBadge();
  renderCartBody();
}

function toggleLike(id) {
  if (likes.has(id)) { likes.delete(id); } else { likes.add(id); }
  try { localStorage.setItem('pharma_likes_v1', JSON.stringify([...likes])); } catch (e) {}
  document.querySelectorAll(`.pc-like[data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('liked', likes.has(id));
  });
}

/** فقاعات قلوب تطير من زر الإعجاب عند التفعيل */
function spawnPcLikeHeartBubbles(button) {
  if (!button || typeof button.getBoundingClientRect !== 'function') return;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var rect = button.getBoundingClientRect();
  var cx = rect.left + rect.width / 2;
  var cy = rect.top + rect.height / 2;
  var hearts = ['❤', '💕', '💖', '❤️'];
  var n = 7 + Math.floor(Math.random() * 4);
  for (var i = 0; i < n; i++) {
    (function (idx) {
      var el = document.createElement('span');
      el.className = 'pc-like-bubble';
      el.setAttribute('aria-hidden', 'true');
      el.textContent = hearts[idx % hearts.length];
      var dx = (Math.random() - 0.5) * 72;
      var dy = -70 - Math.random() * 55;
      var rot = (Math.random() - 0.5) * 42;
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      el.style.setProperty('--rot', rot + 'deg');
      el.style.animationDelay = (idx * 35) + 'ms';
      document.body.appendChild(el);
      var ms = 1100 + idx * 35;
      setTimeout(function () {
        try { el.remove(); } catch (e) { /* ignore */ }
      }, ms);
    })(i);
  }
}

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.changeQty = changeQty;
window.toggleCart = toggleCart;
window.openModal = openModal;
window.closeModal = closeModal;
window.sendWA = sendWA;
window.toggleLike = toggleLike;
window.updateCartBadge = updateCartBadge;
window.renderCartBody = renderCartBody;
window.cartCount = cartCount;
window.cartTotal = cartTotal;
window.CART_PROMO_MAX_DISCOUNTED_LINES = CART_PROMO_MAX_DISCOUNTED_LINES;
window.recalculateCartLineDiscounts = recalculateCartLineDiscounts;

try {
  if (cart.length) recalculateCartLineDiscounts();
} catch (e) { /* ignore */ }

// إضافة: دعم تمرير عنصر الزر لتحديث aria-pressed + فقاعات قلب عند الإعجاب
(function patchToggleLike() {
  const _orig = window.toggleLike;
  window.toggleLike = function (id, btnEl) {
    const wasLiked = likes.has(id);
    _orig(id);
    if (btnEl && !wasLiked && likes.has(id)) spawnPcLikeHeartBubbles(btnEl);
    if (btnEl) {
      btnEl.setAttribute('aria-pressed', likes.has(id) ? 'true' : 'false');
      btnEl.setAttribute('aria-label', likes.has(id) ? 'إزالة الإعجاب' : 'إعجاب');
    }
  };
})();

/* البحث والاقتراحات: assets/js/shop-search.js (API action=search، MySQL) */

/* ---------- mega-menu.js ---------- */
/* mega-menu.js — القائمة الرئيسية */
(function () {
  var INDEX_NAV_FALLBACK = [
    { slug: 'medicine', name: 'الأدوية', icon: '💊' },
    { slug: 'cosmetics', name: 'التجميل', icon: '💄' },
    { slug: 'medical', name: 'المستلزمات الطبية', icon: '🩺' },
    { slug: 'kids', name: 'الأطفال', icon: '👶' },
    { slug: 'vitamins', name: 'الفيتامينات', icon: '🧬' },
    { slug: 'haircare', name: 'العناية بالشعر', icon: '💇' },
    { slug: 'oralcare', name: 'العناية بالفم والأسنان', icon: '🦷' }
  ];

  function navRingHtml(cat, isHome) {
    var slug = isHome ? '' : (cat.slug != null && String(cat.slug) !== '' ? String(cat.slug) : String(cat.id != null ? cat.id : ''));
    var href = isHome ? 'index.html' : 'category.html?slug=' + encodeURIComponent(slug);
    var name = isHome ? 'الرئيسية' : String(cat.name != null ? cat.name : 'قسم');
    var imgUrl = '';
    if (!isHome && typeof window.resolveHomeCategoryImage === 'function') {
      imgUrl = window.resolveHomeCategoryImage(cat) || '';
    }
    var discInner = imgUrl
      ? '<img class="p-nav-ring__img" src="' + escHtml(imgUrl) + '" alt="" width="96" height="96" loading="lazy" decoding="async"/>'
      : '<span class="p-nav-ring__emoji" aria-hidden="true">' + escHtml(isHome ? '🏠' : (cat.icon || '📦')) + '</span>';
    var cls = 'p-nav-ring' + (isHome ? ' p-nav-ring--home' : '');
    return (
      '<a href="' +
      escHtml(href) +
      '" class="' +
      cls +
      '" data-cat="' +
      escHtml(slug) +
      '">' +
      '<span class="p-nav-ring__disc">' +
      discInner +
      '</span>' +
      '<span class="p-nav-ring__lbl">' +
      escHtml(name) +
      '</span></a>'
    );
  }

  function buildNav(cats) {
    const nav = document.getElementById('navContainer');
    if (!nav) return;
    const navUrlParams = new URLSearchParams(location.search || '');
    const slugFromUrl = navUrlParams.get('slug');
    const slugCanon =
      slugFromUrl && typeof window.resolveCategorySlugAlias === 'function'
        ? window.resolveCategorySlugAlias(slugFromUrl)
        : slugFromUrl;
    if (document.body.classList.contains('index-page')) {
      nav.classList.add('p-nav-rings');
      var sorted = (cats || [])
        .filter(function (c) { return c && c.active !== false; })
        .sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
      var list = sorted.length ? sorted : INDEX_NAV_FALLBACK;
      var parts = [navRingHtml({}, true)];
      for (var i = 0; i < list.length; i++) {
        parts.push(navRingHtml(list[i], false));
      }
      replaceChildrenFromHtml(nav, parts.join(''));

      nav.querySelectorAll('.p-nav-ring').forEach(function (a) {
        a.classList.remove('act');
      });
      if (!slugFromUrl) {
        var homeEl = nav.querySelector('.p-nav-ring--home');
        if (homeEl) homeEl.classList.add('act');
      } else {
        nav.querySelectorAll('.p-nav-ring').forEach(function (a) {
          var dc = a.dataset.cat;
          if (dc && (dc === slugFromUrl || dc === slugCanon)) a.classList.add('act');
        });
      }
      return;
    }
    const items = (cats || []).filter(c => c.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!items.length) return;

    replaceChildrenFromHtml(nav, `
      <div style="display:flex;align-items:center;flex:1;">
        ${items.map(c => `<a href="category.html?slug=${escHtml(c.slug || c.id)}" class="p-nl" data-cat="${escHtml(c.slug || c.id)}">
          <span>${c.icon || '📦'}</span> ${escHtml(c.name)}
        </a>`).join('')}
      </div>`);

    // تحديد القسم النشط (يدعم أسماء slug القديمة مثل drugs → medicine عبر canonicalCategorySlug)
    if (slugFromUrl || slugCanon) {
      nav.querySelectorAll('.p-nl').forEach(a => {
        const dc = a.dataset.cat;
        if (dc && (dc === slugFromUrl || dc === slugCanon)) a.classList.add('act');
      });
    }
  }

  function buildFooterCats(cats) {
    const ul = document.getElementById('footerCategories');
    if (!ul || !cats || !cats.length) return;
    const items = cats.filter(c => c.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 6);
    replaceChildrenFromHtml(ul, items.map(c =>
      `<li style="cursor:pointer" data-action="nav-cat" data-slug="${escHtml(c.slug || c.id)}">${c.icon || '📦'} ${escHtml(c.name)}</li>`
    ).join(''));
  }

  window.buildNav = buildNav;
  window.buildFooterCats = buildFooterCats;
})();

/* ---------- subcategories.js ---------- */
/* subcategories.js — منطق الأقسام الفرعية */
function buildHomeCategories(cats, subcats) {
  const grid = document.querySelector('.p-cats');
  if (!grid) return;
  if (!cats || !cats.length) {
    grid.classList.remove('p-cats--skel-mode');
    grid.removeAttribute('aria-busy');
    grid.removeAttribute('aria-label');
    if (typeof replaceChildrenFromHtml === 'function') {
      replaceChildrenFromHtml(grid, '<div class="home-cats-empty" role="status">لا توجد أقسام بعد</div>');
    }
    return;
  }
  /* أقسام الرئيسية المرسومة يدوياً (صور، swipe، لوحة فرعية) — لا تستبدلها ببطاقات الـ API */
  if (grid.getAttribute('data-static-home-cats') === 'true') {
    grid.classList.remove('p-cats--skel-mode');
    grid.removeAttribute('aria-busy');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(x => { if (x.isIntersecting) x.target.classList.add('in'); });
    }, { threshold: 0.06 });
    grid.querySelectorAll('.reveal').forEach(el => { if (!el.classList.contains('in')) obs.observe(el); });
    return;
  }
  const active = cats.filter(c => c.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  const subsList = Array.isArray(subcats) ? subcats : [];
  grid.classList.remove('p-cats--skel-mode');
  replaceChildrenFromHtml(grid, active.map(c => buildCategoryCardHtml(c, subsList)).join(''));
  grid.removeAttribute('aria-busy');
  grid.setAttribute('aria-label', 'أقسام رئيسية — اسحب أفقياً على الموبايل');

  // Intersection Observer للكشف
  const obs = new IntersectionObserver(entries => {
    entries.forEach(x => { if (x.isIntersecting) x.target.classList.add('in'); });
  }, { threshold: 0.06 });
  grid.querySelectorAll('.reveal').forEach(el => { if (!el.classList.contains('in')) obs.observe(el); });
}

window.buildHomeCategories = buildHomeCategories;

/* ---------- shop-pages.js ---------- */
/* shop-pages.js — تهيئة مشتركة لصفحات المتجر الداخلية v3.0 */
// ─── إعادة توجيه addCart → addToCart ─────────────────────────
window.addCart = function (id) {
  if (typeof addToCart === 'function') addToCart(id);
};

// ─── تنسيق السعر ─────────────────────────────────────────────
window.formatPrice = function (p) {
  return typeof fmt === 'function' ? fmt(p) : (Number(p).toLocaleString('ar-IQ') + ' د.ع');
};

// ─── تصحيح مسار الصورة ───────────────────────────────────────
window.fixImgUrl = function (url) {
  if (!url || typeof url !== 'string') return '';
  var t = url.trim().replace(/\\/g, '/');
  if (!t) return '';
  if (typeof window.normalizeProductImagePath === 'function') {
    t = window.normalizeProductImagePath(t);
  }
  if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:')) return t;
  if (t.startsWith('/')) {
    return typeof pharmaPublicAssetUrl === 'function' ? pharmaPublicAssetUrl(t) : t;
  }
  if (/^(images|uploads|assets)\//i.test(t)) {
    return typeof pharmaPublicAssetUrl === 'function' ? pharmaPublicAssetUrl('/' + t) : '/' + t;
  }
  return '';
};

/**
 * أول مسار صورة صالح للبطاقات (مشابهة / حزم / شبكات) — نفس ترتيب معرض صفحة المنتج:
 * image ثم img ثم images[]، مع تجاهل placeholder حتى لا يُعرض «لا توجد صورة» بدل الصورة الحقيقية.
 */
window.productCardDisplayImageUrl = function (p) {
  if (!p || typeof p !== 'object') return '';
  function isPlaceholderProductImgUrl(s) {
    if (!s || typeof s !== 'string') return true;
    var t = s.toLowerCase();
    return t.indexOf('placeholder.svg') !== -1 || t.indexOf('placeholder.png') !== -1;
  }
  var seen = new Set();
  function pick(raw) {
    if (!raw || typeof raw !== 'string') return '';
    var x = typeof fixImgUrl === 'function' ? fixImgUrl(raw) : '';
    if (!x || isPlaceholderProductImgUrl(x) || isPlaceholderProductImgUrl(raw) || seen.has(x)) return '';
    seen.add(x);
    return x;
  }
  var a = pick(p.image);
  if (a) return a;
  a = pick(p.img);
  if (a) return a;
  if (Array.isArray(p.images)) {
    for (var i = 0; i < p.images.length; i++) {
      a = pick(p.images[i]);
      if (a) return a;
    }
  }
  return '';
};

// ─── placeholder لـ initProductReviews ───────────────────────
if (typeof window.initProductReviews === 'undefined') {
  window.initProductReviews = function () {};
}

// البحث في الهيدر: assets/js/shop-search.js

// ─── حالة المتجر في الفوتر (liveT / ldot) ────────────────────
(function () {
  function updateLiveDot() {
    var liveT = document.getElementById('liveT');
    var ldot  = document.getElementById('ldot');
    if (!liveT && !ldot) return;
    var h     = new Date().getHours();
    var open  = (window.settings && settings.openHour  != null) ? settings.openHour  : 15;
    var close = (window.settings && settings.closeHour != null) ? settings.closeHour : 24;
    var offDays = (window.settings && Array.isArray(settings.offDays)) ? settings.offDays : [];
    var dayOfWeek = new Date().getDay();
    var isHoliday = offDays.indexOf(dayOfWeek) !== -1;
    var isOpen = !isHoliday && h >= open && h < close;
    if (ldot)  ldot.style.background  = isOpen ? '#22c55e' : '#ef4444';
    if (liveT) { liveT.textContent = isHoliday ? 'عطلة رسمية' : (isOpen ? 'مفتوح الآن' : 'مغلق حالياً'); liveT.style.color = isOpen ? '#22c55e' : '#ef4444'; }
  }
  document.addEventListener('DOMContentLoaded', updateLiveDot);
  setInterval(updateLiveDot, 60000);
})();

/* ---------- shop-page-logic.js ---------- */
/* shop-page-logic.js — منطق صفحات المتجر (بدون تلاعب مباشر بالواجهة حيث أمكن) */
function mergeSettingsFromApi(s) {
  if (!s || typeof s !== 'object') return;
  Object.assign(settings, s);
}

/** يحدّث روابط التذييل من الكائن العام settings (هاتف، واتساب، الخريطة) */
function applyShopPageFooterFromSettings() {
  const phoneRaw = String(settings.phone || '').trim();
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const waDigits = String(settings.whatsapp || '').replace(/\D/g, '');
  const mapUrl = String(settings.mapUrl || MAP_URL || '').trim() || MAP_URL;
  const ftPhone = document.getElementById('ft-phone');
  const ftWa = document.getElementById('ft-wa2');
  const ftAddr = document.getElementById('ft-addr');
  if (ftPhone) {
    ftPhone.href = 'tel:+' + phoneDigits;
    ftPhone.textContent = '📞 ' + (phoneRaw || '—');
  }
  if (ftWa) {
    var waMsgFt = (ftWa.dataset && ftWa.dataset.waText != null) ? String(ftWa.dataset.waText) : '';
    ftWa.href = typeof buildWaUrl === 'function' ? buildWaUrl(waMsgFt) : ('https://wa.me/' + waDigits + (waMsgFt ? '?text=' + encodeURIComponent(waMsgFt) : ''));
  }
  if (ftAddr) {
    ftAddr.href = mapUrl;
    ftAddr.textContent = '📍 ' + (settings.address || '—');
  }
}

// ─── صفحة القسم (category.html) ───────────────────────────────

function categoryPageCanonicalSlug(x) {
  if (typeof window.canonicalCategorySlug === 'function') {
    return window.canonicalCategorySlug(x);
  }
  return String(x || '')
    .trim()
    .toLowerCase();
}

/** أول قسم رئيسي للمنتج (مطابق لـ product.category على الخادم). */
function categoryPageProductPrimarySlug(p) {
  if (!p || typeof p !== 'object') return '';
  if (p.category != null && String(p.category).trim() !== '') {
    return categoryPageCanonicalSlug(p.category);
  }
  if (p.cat != null && String(p.cat).trim() !== '') {
    return categoryPageCanonicalSlug(p.cat);
  }
  if (Array.isArray(p.categories) && p.categories.length) {
    return categoryPageCanonicalSlug(p.categories[0]);
  }
  return '';
}

function categoryPageResolveCategory(categories, slug) {
  const cats = Array.isArray(categories) ? categories : [];
  const want = categoryPageCanonicalSlug(slug);
  const found = cats.find(c => {
    if (String(c.id) === String(slug)) return true;
    return c.slug != null && categoryPageCanonicalSlug(c.slug) === want && want !== '';
  });
  return found || { slug: slug, name: slug, icon: '📁' };
}

function categoryPageDebugLog(msg, data) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('pharma_category_debug') === '1') {
      console.log('[pharma-category]', msg, data);
    }
  } catch (e) { /* ignore */ }
}

function categoryPageFilterProductsBySlug(products, slug) {
  if (!Array.isArray(products)) return [];
  const want = categoryPageCanonicalSlug(slug);
  return products.filter(p => {
    if (p.active === false) return false;
    return categoryPageProductPrimarySlug(p) === want;
  });
}

function categoryPageSubcategoriesForParent(subcategories, parentSlug) {
  if (!Array.isArray(subcategories)) return [];
  const want = categoryPageCanonicalSlug(parentSlug);
  return subcategories.filter(
    s => categoryPageCanonicalSlug(s.parent) === want && s.active !== false
  );
}

function categoryPageCountProductsInSubcategory(products, subId) {
  return products.filter(p => {
    const subs = p.subcategories || [];
    return subs.includes(subId) || subs.includes(+subId) || subs.includes(String(subId));
  }).length;
}

/**
 * تحميل منتجات القسم من MySQL عبر API، مع احتياطي محلي عند فشل get_products_by_category.
 * @returns {{ cat: object, products: array }}
 */
async function categoryLoadProductsForSlug(slug) {
  const norm = function (arr) {
    return (Array.isArray(arr) ? arr : []).map(function (p) {
      return typeof normalizeProductFromApi === 'function' ? normalizeProductFromApi(p) : p;
    });
  };
  const prodRes = await fetchProductsByCategorySlug(slug);
  if (apiIsSuccess(prodRes) && prodRes.data && prodRes.data.category) {
    const list = norm(coerceApiArray(prodRes.data.products));
    categoryPageDebugLog('get_products_by_category', {
      slug: slug,
      count: list.length,
      sample: list.slice(0, 6).map(function (p) {
        return { id: p.id, cat: p.cat, categories: p.categories };
      })
    });
    return {
      cat: prodRes.data.category,
      products: list
    };
  }
  const [catRes, prodRes2] = await Promise.all([
    apiFetch('getCategories', { active: 1 }),
    apiFetch('getProducts', { active: 0 })
  ]);
  const cats = apiPick(catRes, 'categories', []);
  const cat = categoryPageResolveCategory(cats, slug);
  const products = norm(categoryPageFilterProductsBySlug(apiPick(prodRes2, 'products', []), slug));
  return { cat, products };
}

async function categoryPageLoadPayload(slug) {
  const [primary, settingsRes, subRes] = await Promise.all([
    categoryLoadProductsForSlug(slug),
    apiFetch('getSettings'),
    apiFetch('getSubcategories')
  ]);
  const cat = primary.cat;
  const filtered = primary.products;
  const allSubs = typeof apiPick === 'function' ? apiPick(subRes, 'subcategories', []) : [];
  const subcats = sortSubcategoriesByUsageOrder(categoryPageSubcategoriesForParent(allSubs, slug));
  return { settingsRes, cat, filtered, subcats };
}

// ─── صفحة القسم الفرعي (subcategory.html) ─────────────────────

async function subcategoryPageLoadPayload(subcatId) {
  const [subData, settingsData] = await Promise.all([
    apiFetch('getSubcategories'),
    apiFetch('getSettings')
  ]);
  const subcategories = apiPick(subData, 'subcategories', []);
  const subcat = subcategories.find(s => s.id == subcatId) || null;
  const prodData = await fetchProductsBySubcategory(subcatId);
  const raw = apiPick(prodData, 'products', []);
  const products = (Array.isArray(raw) ? raw : []).map(function (p) {
    return typeof normalizeProductFromApi === 'function' ? normalizeProductFromApi(p) : p;
  });
  return { settingsData, subData, prodData, subcat, products };
}

// ─── صفحة المنتج (product.html) ───────────────────────────────

function productPagePrimaryCategories(p) {
  if (p.categories && Array.isArray(p.categories) && p.categories.length) return p.categories;
  if (p.cat) return [p.cat];
  return [];
}

function productPageFindSimilar(allProducts, p, limit) {
  const pCats = productPagePrimaryCategories(p);
  const pSubs = Array.isArray(p.subcategories) ? p.subcategories.map(function (id) { return String(id); }) : [];
  const pPrice = Number(p.price);
  const priceP = Number.isFinite(pPrice) ? pPrice : 0;

  const list = allProducts.filter(x => {
    if (String(x.id) === String(p.id)) return false;
    if ((x.active ?? true) === false) return false;
    const xCats = productPagePrimaryCategories(x);
    if (!pCats.length || !xCats.length) return (x.cat === p.cat);
    return xCats.some(c => pCats.includes(c));
  });

  function subOverlap(x) {
    const xs = Array.isArray(x.subcategories) ? x.subcategories.map(function (id) { return String(id); }) : [];
    if (!pSubs.length || !xs.length) return 0;
    const set = new Set(pSubs);
    var n = 0;
    for (var i = 0; i < xs.length; i++) if (set.has(xs[i])) n++;
    return n;
  }

  function sameMainCat(x) {
    if (p.cat == null || x.cat == null) return 0;
    return String(x.cat) === String(p.cat) ? 1 : 0;
  }

  function priceDistance(x) {
    var px = Number(x.price);
    if (!Number.isFinite(px)) px = 0;
    var m = Math.max(Math.abs(priceP), Math.abs(px), 1);
    return Math.abs(px - priceP) / m;
  }

  function popularity(x) {
    var w = Number(x.wa_order_count);
    if (Number.isFinite(w) && w > 0) return w;
    if (x.badge === 'pb-hot' || x.featured === true || x.featured === 1) return 1;
    return 0;
  }

  list.sort(function (a, b) {
    var sb = subOverlap(b) - subOverlap(a);
    if (sb !== 0) return sb;
    var mb = sameMainCat(b) - sameMainCat(a);
    if (mb !== 0) return mb;
    var da = priceDistance(a);
    var db = priceDistance(b);
    if (da !== db) return da - db;
    var pop = popularity(b) - popularity(a);
    if (pop !== 0) return pop;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
  });

  var lim = limit != null ? limit : 4;
  return list.slice(0, lim);
}

// ─── مراجعات المنتج (منطق فقط) ─────────────────────────────────

function reviewsFilterApproved(reviews) {
  if (!Array.isArray(reviews)) return [];
  return reviews.filter(rv => rv.approved !== false);
}

function reviewsAverageRating(reviews) {
  if (!reviews.length) return null;
  const sum = reviews.reduce((s, r) => s + (r.rating || 5), 0);
  return (sum / reviews.length).toFixed(1);
}

/* ---------- category-logic.js ---------- */
const _slugFromQuery = new URLSearchParams(location.search).get('slug');
const slug = _slugFromQuery && typeof window.resolveCategorySlugAlias === 'function'
  ? window.resolveCategorySlugAlias(_slugFromQuery)
  : _slugFromQuery;

/** حالة عرض القسم: baseList من API (لا تُستبدل بالفلترة)، filteredList للعرض */
const categoryState = {
  baseList: [],
  filteredList: []
};

/** قائمة القسم الكاملة (ثابتة بعد أول تحميل) */
let categoryChipCatalog = [];

if (typeof subscribeShopState === 'function') {
  subscribeShopState(function (s, meta) {
    if (!meta || meta.view !== 'category') return;
    if (!slug || !document.getElementById('prodSec')) return;
    categoryState.filteredList = Array.isArray(s.products) ? s.products.slice() : [];
    categoryViewRenderProductGrid();
  });
}

function categorySetBaseFromApi(products) {
  const arr = Array.isArray(products) ? products.slice() : [];
  categoryState.baseList = arr;
  categoryState.filteredList = arr.slice();
}

function categoryComputeFilteredFromBase(baseList, minP, maxP, typ) {
  let out = baseList.slice();
  if (minP != null && !isNaN(minP)) out = out.filter(function (p) { return Number(p.price || 0) >= minP; });
  if (maxP != null && !isNaN(maxP)) out = out.filter(function (p) { return Number(p.price || 0) <= maxP; });
  if (typ) out = out.filter(function (p) { return (p.product_type || '') === typ; });
  return out;
}

function categoryReadFilterInputs() {
  const minEl = document.getElementById('fltMinPrice');
  const maxEl = document.getElementById('fltMaxPrice');
  const typeEl = document.getElementById('fltProductType');
  const minP = minEl && minEl.value !== '' ? Number(minEl.value) : null;
  const maxP = maxEl && maxEl.value !== '' ? Number(maxEl.value) : null;
  const typ = typeEl ? typeEl.value : '';
  return { minP: minP, maxP: maxP, typ: typ };
}

window.categoryReadFilterInputs = categoryReadFilterInputs;

/** بحث نصي محلي على قائمة (احتياطي) */
function categoryLocalTextFilter(list, q) {
  const ql = (q || '').toLowerCase();
  if (!ql) return list.slice();
  return list.filter(function (p) {
    return (p.name && p.name.toLowerCase().indexOf(ql) !== -1) ||
      (p.desc && String(p.desc).toLowerCase().indexOf(ql) !== -1) ||
      (p.cat && String(p.cat).toLowerCase().indexOf(ql) !== -1);
  });
}

/**
 * دمج بحث MySQL + فلاتر السعر/النوع + نطاق baseList (قسم/قسم فرعي).
 * يُستدعى من shop-search عند الكتابة في الهيدر ومن فلاتر القسم.
 */
async function categoryRunUnifiedProductFilter() {
  if (typeof __pharmaStoreHtmlFile === 'function' && __pharmaStoreHtmlFile() !== 'category.html') return;
  if (!slug || !document.getElementById('prodSec')) return;

  const box = document.querySelector('#srchInput, .p-srch-box');
  const qRaw = (box && box.value) ? box.value.trim() : '';
  const fp = categoryReadFilterInputs();

  if (!qRaw) {
    categoryState.filteredList = categoryComputeFilteredFromBase(categoryState.baseList, fp.minP, fp.maxP, fp.typ);
    categorySyncShopAndRender();
    return;
  }

  try {
    const res = await apiFetch('search', {
      q: qRaw,
      category: slug
    });
    let pool = [];
    if (apiIsSuccess(res) && res.data && res.data.products) {
      pool = coerceApiArray(res.data.products).map(function (p) {
        return typeof normalizeProductFromApi === 'function' ? normalizeProductFromApi(p) : p;
      });
    }
    const allowed = Object.create(null);
    categoryState.baseList.forEach(function (p) {
      allowed[String(p.id)] = true;
    });
    let merged = pool.filter(function (p) {
      return allowed[String(p.id)];
    });
    if (!merged.length) {
      merged = categoryLocalTextFilter(categoryState.baseList, qRaw);
    }
    categoryState.filteredList = categoryComputeFilteredFromBase(merged, fp.minP, fp.maxP, fp.typ);
    categorySyncShopAndRender();
  } catch (e) {
    if (typeof pharmaLogError === 'function') pharmaLogError('[category-search]', e);
    const merged = categoryLocalTextFilter(categoryState.baseList, qRaw);
    categoryState.filteredList = categoryComputeFilteredFromBase(merged, fp.minP, fp.maxP, fp.typ);
    categorySyncShopAndRender();
  }
}

window.categoryRunUnifiedProductFilter = categoryRunUnifiedProductFilter;

function categoryApplyFiltersFromInputs() {
  categoryRunUnifiedProductFilter().catch(function (e) {
    if (typeof pharmaLogError === 'function') pharmaLogError('[category-filter]', e);
  });
}

function categoryPageResetFilters() {
  const minEl = document.getElementById('fltMinPrice');
  const maxEl = document.getElementById('fltMaxPrice');
  const typeEl = document.getElementById('fltProductType');
  if (minEl) minEl.value = '';
  if (maxEl) maxEl.value = '';
  if (typeEl) typeEl.value = '';
  return categoryRunUnifiedProductFilter();
}

function categorySyncShopAndRender() {
  if (typeof setShopProducts === 'function') {
    setShopProducts(categoryState.filteredList, { view: 'category', notify: false });
  }
  categoryViewRenderProductGrid();
  categoryUpdateFilterMeta();
}

function categoryUpdateFilterMeta() {
  const meta = document.getElementById('shopFiltersMeta');
  const statEl = document.getElementById('fltResultStat');
  if (!meta || !statEl) return;
  const b = categoryState.baseList.length;
  const f = categoryState.filteredList.length;
  if (!b) {
    meta.hidden = true;
    return;
  }
  meta.hidden = false;
  if (f === b) {
    statEl.textContent = 'عرض ' + f + ' منتج (ضمن النطاق الحالي)';
  } else {
    statEl.textContent = 'عرض ' + f + ' من ' + b + ' منتج';
  }
}

function categoryBuildProductStatLine() {
  const b = categoryState.baseList.length;
  const f = categoryState.filteredList.length;
  if (!b) return '0 منتج';
  if (f === b) return f + ' منتج';
  return 'عرض ' + f + ' من ' + b + ' منتج';
}

function categoryViewRenderProductGrid() {
  const sec = document.getElementById('prodSec');
  if (!sec) return;
  const baseLen = categoryState.baseList.length;
  const filt = categoryState.filteredList;

  if (!baseLen) {
    const inner = typeof buildEmptyProductsStateHtml === 'function'
      ? buildEmptyProductsStateHtml('لا توجد منتجات حالياً في هذا القسم', { variant: 'default' })
      : `<div class="empty-state empty-state--rich" style="grid-column:1/-1" role="status"><div class="empty-state__icon">📦</div><p class="empty-state__msg">لا توجد منتجات حالياً في هذا القسم</p><a href="index.html" class="empty-state__back">الرئيسية</a></div>`;
    replaceChildrenFromHtml(sec, `<div class="pgrid6">${inner}</div>`);
    return;
  }

  if (!filt.length) {
    const inner = typeof buildEmptyProductsStateHtml === 'function'
      ? buildEmptyProductsStateHtml('لا توجد نتائج مطابقة لبحثك في هذا القسم', { variant: 'search' })
      : `<div class="empty-state empty-state--rich" style="grid-column:1/-1" role="status"><div class="ei" aria-hidden="true">🔎</div><p class="empty-state__msg">لا توجد نتائج مطابقة لبحثك في هذا القسم</p></div>`;
    replaceChildrenFromHtml(sec, `<div class="pgrid6">${inner}</div>`);
    return;
  }

  const cards = typeof buildProductCardHtml === 'function' ? filt.map(function (p) { return buildProductCardHtml(p); }).join('') : '';
  const statLine = categoryBuildProductStatLine();
  replaceChildrenFromHtml(sec, `
    <div class="prods-hdr">
      <h3>المنتجات</h3>
      <span class="prods-hdr__stat" id="catProdStat">${statLine}</span>
    </div>
    <div class="pgrid6" id="catPgrid" aria-label="شبكة المنتجات">${cards}</div>`);
  const g = document.getElementById('catPgrid');
  if (g && cards) categoryViewObserveReveals(g);
}

window.categoryPageResetFilters = categoryPageResetFilters;

// ─── عرض (واجهة فقط) ───────────────────────────────────────────

function categoryViewShowMissingSlug(catHdr, prodSec) {
  catHdr.innerHTML = '<div class="err-box">⚠️ لم يتم تحديد القسم</div>';
  prodSec.innerHTML = '';
}

function categoryViewShowLoadError(catHdr, prodSec) {
  catHdr.innerHTML = '<div class="err-box">⚠️ حدث خطأ في تحميل البيانات. حاول مجدداً.</div>';
  prodSec.innerHTML = '';
}

/**
 * طبقة ترتيب للأقسام الفرعية حسب الاستخدام الشائع:
 * 1 مسكنات/آلام → 2 برد/أنفلونزا → 3 معدة/هضم → 4 مضادات حيوية → 5 أطفال → 6 الباقي
 */
function subcategoryUsageSortTier(s) {
  const name = String(s && s.name != null ? s.name : '');
  const slug = String(s && s.slug != null ? s.slug : '').toLowerCase().replace(/-/g, '_');
  if (/أطفال|للأطفال|الأطفال|طفل/i.test(name) || /child|pediatric|kids|infant/i.test(slug)) return 5;
  if (slug === 'pain_relief' || slug === 'headache_medicine') return 1;
  if (slug === 'cold_flu') return 2;
  if (slug === 'stomach_medicine') return 3;
  if (slug === 'antibiotics') return 4;
  if (/مسكن|مسكنات|الألم|آلام|وجع|مفصل|عضل|خافض\s*حرارة|الصداع/i.test(name)) return 1;
  if (/برد|انفلونز|زكام|احتقان|جيوب|سعال|الأنف|الانفلونزا/i.test(name)) return 2;
  if (/معدة|هضم|الهضم|جهاز\s*هضم|أسهال|انتفاخ/i.test(name)) return 3;
  if (/مضادات?\s*حيوي|مضاد\s*حيوي|أنتيبيوتيك|antibiot/i.test(name + slug)) return 4;
  return 6;
}

function sortSubcategoriesByUsageOrder(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  arr.sort(function (a, b) {
    const d = subcategoryUsageSortTier(a) - subcategoryUsageSortTier(b);
    if (d !== 0) return d;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
  });
  return arr;
}

function categoryViewRenderHeader(catHdr, cat, productCount) {
  const esc = typeof escHtml === 'function' ? escHtml : function (t) { return t == null ? '' : String(t); };
  const nm = esc(cat.name);
  const heroImg = typeof resolveHomeCategoryImage === 'function' ? resolveHomeCategoryImage(cat) : '';
  const icoBlock = heroImg
    ? `<div class="cat-hdr-media"><img class="cat-hdr-img" src="${esc(heroImg)}" alt="" width="200" height="200" loading="eager" decoding="async"/></div>`
    : `<div class="cat-hdr-ico" aria-hidden="true">${cat.icon || '📁'}</div>`;
  catHdr.innerHTML = `<nav class="p-breadcrumb" aria-label="مسار التنقل">
      <a href="index.html">الرئيسية</a><span class="p-breadcrumb__sep" aria-hidden="true">›</span>
      <a href="categories.html">الأقسام</a><span class="p-breadcrumb__sep" aria-hidden="true">›</span>
      <span class="p-breadcrumb__here" aria-current="page">${nm}</span>
    </nav>
    <div class="cat-hdr">
      ${icoBlock}
      <div class="cat-hdr-name">${nm}</div>
      <div class="cat-hdr-desc">${productCount} منتج متوفر في هذا القسم — اختر المنتج ثم أرسل الطلب عبر واتساب</div>
    </div>`;
}

function categoryViewRenderSubcategorySection(subcatSec, subcats, products) {
  if (!subcatSec) return;
  if (!Array.isArray(subcats) || subcats.length === 0) {
    subcatSec.innerHTML = '';
    subcatSec.hidden = true;
    return;
  }
  const esc = typeof escHtml === 'function' ? escHtml : function (t) { return t == null ? '' : String(t); };
  const prods = Array.isArray(products) ? products : [];
  const items = subcats.map(function (s) {
    const id = s.id != null ? s.id : '';
    const href = 'subcategory.html?id=' + encodeURIComponent(String(id));
    const nm = esc(s.name);
    const cnt = typeof categoryPageCountProductsInSubcategory === 'function'
      ? categoryPageCountProductsInSubcategory(prods, id)
      : 0;
    const meta = cnt === 0 ? 'لا منتجات بعد' : (cnt === 1 ? '1 منتج' : cnt + ' منتجات');
    var chipEmoji =
      typeof resolveSubcategoryChipEmoji === 'function' ? resolveSubcategoryChipEmoji(s) : (s.icon || '📁');
    var mediaHtml =
      '<div class="subcat-chip__ico"><span aria-hidden="true">' + esc(chipEmoji) + '</span></div>';
    return '<li><a class="subcat-chip reveal" href="' + esc(href) + '" aria-label="' + nm + ' — ' + esc(meta) + '">' +
      mediaHtml +
      '<div class="subcat-chip__body"><span class="subcat-chip__name">' + nm + '</span><span class="subcat-chip__meta">' + esc(meta) + '</span></div></a></li>';
  }).join('');
  subcatSec.innerHTML =
    '<section class="subcat-sec" aria-labelledby="subcat-sec-title">' +
    '<h2 class="subcat-sec__title" id="subcat-sec-title"><span class="subcat-sec__title-ico" aria-hidden="true">📂</span> الأقسام الفرعية</h2>' +
    '<p class="subcat-sec__hint">اختر قسمًا فرعيًا لتصفّح منتجاته، أو تابع الأسفل لعرض كل منتجات القسم الرئيسي.</p>' +
    '<ul class="subcat-grid" role="list">' + items + '</ul></section>';
  subcatSec.hidden = false;
  if (typeof initScrollReveal === 'function') initScrollReveal();
}

function categoryViewObserveReveals(gridEl) {
  const obs = new IntersectionObserver(e => {
    e.forEach(x => { if (x.isIntersecting) x.target.classList.add('in'); });
  }, { threshold: 0.06 });
  gridEl.querySelectorAll('.reveal:not(.in)').forEach(el => obs.observe(el));
}

// ─── تدفق التحميل ──────────────────────────────────────────────

async function load() {
  const catHdr = document.getElementById('catHdr');
  const subcatSec = document.getElementById('subcatSec');
  const prodSec = document.getElementById('prodSec');

  if (!slug) {
    categoryViewShowMissingSlug(catHdr, prodSec);
    return;
  }

  if (typeof showLoader === 'function') showLoader();
  try {
    const payload = await categoryPageLoadPayload(slug);

    if (payload.settingsRes && apiIsSuccess(payload.settingsRes) && payload.settingsRes.data && payload.settingsRes.data.settings) {
      mergeSettingsFromApi(payload.settingsRes.data.settings);
      applySettings();
      applyShopPageFooterFromSettings();
    }

    const cat = payload.cat;
    document.title = `${cat.icon} ${cat.name} - صيدلية شهد محمد`;
    window.__waFloatText = `أود الاستفسار بخصوص قسم: ${cat.name}`;
    if (typeof applySettings === 'function') applySettings();

    categoryChipCatalog = payload.filtered.slice();
    categorySetBaseFromApi(payload.filtered);

    categoryViewRenderHeader(catHdr, cat, categoryChipCatalog.length);
    categoryViewRenderSubcategorySection(subcatSec, payload.subcats || [], categoryChipCatalog);
    categorySyncShopAndRender();
  } catch (e) {
    if (typeof pharmaLogError === 'function') pharmaLogError('[category]', e);
    categoryViewShowLoadError(catHdr, prodSec);
    if (typeof showToast === 'function') showToast('تعذر تحميل القسم', 'error');
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
  }
}

if (__pharmaStoreHtmlFile() === 'category.html') {
  (async function () {
    try {
      const sd = await apiFetch('getSettings');
      if (sd && apiIsSuccess(sd) && sd.data && sd.data.settings) {
        mergeSettingsFromApi(sd.data.settings);
        applySettings();
        applyShopPageFooterFromSettings();
      }
    } catch (e) {}
    initShopChrome();
    await load();
  })();
}

/* ---------- product-logic.js ---------- */
const params = new URLSearchParams(location.search);
const pidRaw = params.get('id');
const slugRaw = params.get('slug') || '';

let _elMain;
function getMainEl() {
  if (!_elMain) _elMain = document.getElementById('main');
  return _elMain;
}

function catNameLookup() {
  return (typeof CAT_NAME !== 'undefined' && CAT_NAME) ? CAT_NAME : {};
}

function discount(price, old) {
  if (!old || old <= price) return '';
  return Math.round((old - price) / old * 100) + '%';
}

function formatPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString() + ' د.ع';
}

/** سعر القائمة + سعر بعد خصم العرض (localStorage) إن وُجد — واجهة العرض فقط على صفحة qr-discount. */
function productPriceWithShelfPromo(p) {
  if (!p) return { list: 0, final: 0, promoPct: 0, active: false };
  const list = Number(p.price) || 0;
  const uiOn = typeof isOfferQrShelfPromoUiActive === 'function' ? isOfferQrShelfPromoUiActive() : false;
  const promoPct =
    uiOn && typeof getShelfPromoDiscountPercent === 'function' ? getShelfPromoDiscountPercent() : 0;
  const categoryOk = typeof isProductCategoryEligibleForQrShelfPromo === 'function'
    ? isProductCategoryEligibleForQrShelfPromo(p)
    : false;
  const fin = typeof applyShelfPromoToPrice === 'function' ? applyShelfPromoToPrice(list, promoPct) : list;
  const active = promoPct > 0 && list > 0 && categoryOk;
  return { list: list, final: fin, promoPct: promoPct, active: active };
}

function productCloneForWaOrder(p) {
  const s = productPriceWithShelfPromo(p);
  if (!s.active) return p;
  return Object.assign({}, p, { price: s.final });
}

function cartUnitPriceWithShelf(p) {
  const s = productPriceWithShelfPromo(p);
  return s.active ? s.final : (Number(p.price) || 0);
}

/** نص آمن للعرض في HTML (يحافظ على الأسطر) */
function escProductBodyHtml(s) {
  if (s == null || s === '') return '';
  return escHtml(String(s)).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
}

/** معرّف منتج آمن من عنوان URL (يُرسل لـ API بعد تنقية) */
function productSanitizeUrlId(raw) {
  if (raw == null || raw === '') return '';
  const t = String(raw).trim();
  if (t.length < 1 || t.length > 128) return '';
  if (/[<>'"`]/.test(t) || /javascript:/i.test(t)) return '';
  return t;
}

function productSanitizeUrlSlug(raw) {
  if (raw == null || raw === '') return '';
  const t = String(raw).trim();
  if (t.length < 1 || t.length > 200) return '';
  if (/[<>'"`]/.test(t) || /javascript:/i.test(t)) return '';
  return t;
}

function productPagePublicUrl(p) {
  const u = new URL('product.html', location.origin);
  const slug = p.slug || p.slug_en;
  if (slug) u.searchParams.set('slug', String(slug));
  else u.searchParams.set('id', String(p.id));
  return u.href;
}

function productPageMetaDescription(p) {
  const raw = p.desc || p.usage || p.warnings || '';
  const plain = String(raw).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (plain) return plain.slice(0, 180);
  const s = productPriceWithShelfPromo(p);
  return `${p.name} — ${formatPrice(s.active ? s.final : p.price)} — صيدلية شهد محمد`;
}

function applyProductPageMeta(p, gallery) {
  const descText = productPageMetaDescription(p);
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', descText);
  const url = productPagePublicUrl(p);
  const can = document.getElementById('prod-meta-canonical');
  if (can) can.setAttribute('href', url);
  const ogTitle = `${p.name} - صيدلية شهد محمد`;
  function setOg(id, val) {
    const el = document.getElementById(id);
    if (el && val != null && val !== '') el.setAttribute('content', val);
  }
  setOg('prod-meta-og-title', ogTitle);
  setOg('prod-meta-og-desc', descText);
  setOg('prod-meta-og-url', url);
  const img0 = Array.isArray(gallery) && gallery[0] ? gallery[0] : '';
  let absImg = '';
  if (img0) {
    if (img0.startsWith('http://') || img0.startsWith('https://')) absImg = img0;
    else if (img0.startsWith('/')) absImg = new URL(img0, location.origin).href;
  }
  if (!absImg) absImg = new URL('brand-logo-20260330.png?v=2', location.origin).href;
  setOg('prod-meta-og-image', absImg);
}

function buildProductBreadcrumbHtml(p, primaryCat, primaryCatLabel) {
  const rawName = String(p.name || '');
  const short = rawName.length > 72 ? rawName.slice(0, 69) + '…' : rawName;
  const cur = escHtml(short);
  const catPart = primaryCat
    ? `<span class="prod-breadcrumb__sep" aria-hidden="true">›</span><a href="category.html?slug=${encodeURIComponent(String(primaryCat))}" class="prod-breadcrumb__link">${escHtml(String(primaryCatLabel || primaryCat))}</a>`
    : '';
  return `<nav class="prod-breadcrumb" aria-label="مسار التصفح"><a href="index.html" class="prod-breadcrumb__link">الرئيسية</a><span class="prod-breadcrumb__sep" aria-hidden="true">›</span><a href="categories.html" class="prod-breadcrumb__link">الأقسام</a>${catPart}<span class="prod-breadcrumb__sep" aria-hidden="true">›</span><span class="prod-breadcrumb__current">${cur}</span></nav>`;
}

/** نص فرعي لقسم «منتجات مشابهة» بصياغة عربية سليمة */
function similarProductsSectionSubtitle(count) {
  const n = Math.max(0, parseInt(String(count), 10) || 0);
  if (n === 0) return '';
  if (n === 1) return 'منتج واحد مقترَح من نفس التصنيف تقريباً';
  if (n === 2) return 'منتجان مقترَحان من نفس التصنيف تقريباً';
  return n + ' منتجات مقترَحة من نفس التصنيف تقريباً';
}

/** سعر شبكة المنتجات المشابهة / الحزم — نفس خصم الرف (حسب قسم المنتج). */
function shelfSimPriceHtml(p) {
  const prod = p && typeof p === 'object' && p !== null && 'price' in p ? p : null;
  const list = Number(prod ? prod.price : p) || 0;
  var uiOn = typeof isOfferQrShelfPromoUiActive === 'function' ? isOfferQrShelfPromoUiActive() : false;
  var pct = uiOn && typeof getShelfPromoDiscountPercent === 'function' ? getShelfPromoDiscountPercent() : 0;
  if (!prod || (typeof isProductCategoryEligibleForQrShelfPromo === 'function' && !isProductCategoryEligibleForQrShelfPromo(prod))) {
    pct = 0;
  }
  const fin = typeof applyShelfPromoToPrice === 'function' ? applyShelfPromoToPrice(list, pct) : list;
  if (pct > 0 && list > 0) {
    return `<div class="sim-price-row"><span class="sim-price">${formatPrice(fin)}</span><span class="sim-price-old">${formatPrice(list)}</span></div>`;
  }
  return `<div class="sim-price">${formatPrice(list)}</div>`;
}

/**
 * فيديو بدل الصورة الرئيسية في المعرض — منتجات محددة فقط (مسار mp4 لكل منتج).
 * null = عرض الصور كالمعتاد.
 */
function getProductPageGalleryVideo(p) {
  if (!p || typeof p !== 'object') return null;
  var id = String(p.id || '');
  var slug = String(p.slug || '').toLowerCase();
  var name = String(p.name || '').toLowerCase();
  var nameAr = String(p.name || '');

  if (id === 'seed_panadol_extra_24') return { src: 'assets/videos/panadol-extra.mp4' };
  if (slug.indexOf('panadol-extra') !== -1) return { src: 'assets/videos/panadol-extra.mp4' };
  if (name.indexOf('panadol') !== -1 && name.indexOf('extra') !== -1) return { src: 'assets/videos/panadol-extra.mp4' };

  if (slug.indexOf('nunu') !== -1 && slug.indexOf('shampoo') !== -1) return { src: 'assets/videos/nunu-baby-shampoo.mp4' };
  if ((name.indexOf('nunu') !== -1 || nameAr.indexOf('نونو') !== -1) &&
      (name.indexOf('shampoo') !== -1 || nameAr.indexOf('شامبو') !== -1)) {
    return { src: 'assets/videos/nunu-baby-shampoo.mp4' };
  }

  return null;
}

/** يبني HTML المحتوى الرئيسي فقط (بدون تعديل DOM) */
function buildProductMainHtml(p, similar, bundles) {
  bundles = Array.isArray(bundles) ? bundles : [];
  const CAT = catNameLookup();
  const qrOffer = typeof isOfferQrShelfPromoUiActive === 'function'
    ? isOfferQrShelfPromoUiActive()
    : false;
  const shelf = productPriceWithShelfPromo(p);
  const pWa = productCloneForWaOrder(p);
  const catElig = typeof isProductCategoryEligibleForQrShelfPromo === 'function'
    ? isProductCategoryEligibleForQrShelfPromo(p)
    : false;
  const disc = !shelf.active && qrOffer && catElig ? discount(p.price, p.old) : '';
  const cats = productPagePrimaryCategories(p);
  const primaryCat = cats[0];
  const primaryCatLabel = primaryCat ? (CAT[primaryCat] || primaryCat) : (CAT[p.cat] || p.cat);
  const catsExtra = cats.length > 1 ? ` +${cats.length - 1}` : '';
  const badgeHTML = p.badge ? `<div class="badge-wrap"><span class="pb ${p.badge}">${p.btxt || ''}</span></div>` : '';

  const gallery = [];
  const seen = new Set();
  function isPlaceholderProductImgUrl(s) {
    if (!s || typeof s !== 'string') return true;
    var t = s.toLowerCase();
    return t.indexOf('placeholder.svg') !== -1 || t.indexOf('placeholder.png') !== -1;
  }
  function pushImg(u) {
    const x = fixImgUrl(u);
    if (!x || isPlaceholderProductImgUrl(x) || seen.has(x)) return;
    seen.add(x);
    gallery.push(x);
  }
  /* image أولاً — غالباً هو المعتمد بعد الرفع؛ img قد يبقى قديماً أو placeholder */
  pushImg(p.image);
  pushImg(p.img);
  if (Array.isArray(p.images)) p.images.forEach(pushImg);
  const _safeImg = gallery[0] || '';
  const galleryVideo = getProductPageGalleryVideo(p);
  const thumbsHtml = (!galleryVideo && gallery.length > 1) ? `<div class="prod-gallery-thumbs" role="tablist">${gallery.map((src, i) =>
    `<button type="button" class="prod-gallery-thumb${i === 0 ? ' is-active' : ''}" data-action="switch-gallery-thumb" data-gallery-idx="${i}" aria-label="صورة ${i + 1}"><img src="${escHtml(src)}" alt="" loading="lazy" decoding="async" class="img-cover"></button>`).join('')}</div>` : '';

  var imgHTML;
  if (galleryVideo && galleryVideo.src) {
    var posterAttr = _safeImg ? (' poster="' + escHtml(_safeImg) + '"') : '';
    imgHTML = '<div class="prod-gallery-zoom">\n  <div class="prod-gallery-col">\n    <div class="prod-gallery-main">\n      <div class="img-zoom-wrap img-zoom-wrap--product-video" id="prodImgZoomWrap">\n        <video id="prodGalleryVideo" class="img-cover prod-main-img prod-main-img--video" autoplay muted loop playsinline preload="metadata" disablepictureinpicture disableremoteplayback' + posterAttr + '>\n          <source src="' + escHtml(galleryVideo.src) + '" type="video/mp4" />\n        </video>\n        <div class="img-zoom-lens" id="prodZoomLens" hidden aria-hidden="true"></div>\n      </div>\n      ' + thumbsHtml + '\n    </div>\n  </div>\n  <div class="prod-zoom-pane" id="prodZoomPane" aria-hidden="true"></div>\n</div>';
  } else if (_safeImg) {
    imgHTML = `<div class="prod-gallery-zoom">
  <div class="prod-gallery-col">
    <div class="prod-gallery-main">
      <div class="img-zoom-wrap" id="prodImgZoomWrap">
        <img id="prodMainImg" src="${_safeImg}" alt="${escHtml(p.name)}" class="img-cover prod-main-img" decoding="async" fetchpriority="high" loading="eager" data-fallback-parent=".no-img-fb">
        <div class="img-zoom-lens" id="prodZoomLens" hidden aria-hidden="true"></div>
        <button type="button" class="prod-zoom-full" data-action="open-img-modal" data-src="${escHtml(_safeImg)}" aria-label="عرض الصورة بالحجم الكامل">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
        <div class="no-img no-img-fb" style="display:none">${p.ico || '💊'}</div>
      </div>
      ${thumbsHtml}
    </div>
  </div>
  <div class="prod-zoom-pane" id="prodZoomPane" aria-hidden="true"></div>
</div>`;
  } else {
    imgHTML = `<div class="no-img prod-gallery-main">${p.ico || '💊'}</div>`;
  }

  window.__productGalleryUrls = gallery;

  const waOrderText = typeof buildProductWaOrderText === 'function' ? buildProductWaOrderText(pWa) : (`أريد الاستفسار عن: ${p.name}\nالسعر: ${formatPrice(pWa.price)}`);
  const waOrderHref = typeof buildWaUrl === 'function' ? buildWaUrl(waOrderText) : ('https://wa.me/' + String(settings.whatsapp || '9647711954040').replace(/\D/g, '') + '?text=' + encodeURIComponent(waOrderText));
  const askPhText = typeof buildProductPharmacistConsultText === 'function'
    ? buildProductPharmacistConsultText(p)
    : (`استفسار صيدلاني بخصوص: ${p.name}`);
  const askPharmacistHref = typeof buildWaUrl === 'function' ? buildWaUrl(askPhText) : waOrderHref;

  const usageItems = [];
  if (p.dose) usageItems.push({ ico: '💊', lbl: 'الجرعة', val: escHtml(String(p.dose)) });
  if (p.frequency) usageItems.push({ ico: '🕐', lbl: 'التكرار', val: escHtml(String(p.frequency)) });
  if (p.age) usageItems.push({ ico: '👤', lbl: 'الفئة العمرية', val: escHtml(String(p.age)) });
  if (p.storage) usageItems.push({ ico: '🌡️', lbl: 'التخزين', val: escHtml(String(p.storage)) });

  const usageGridHTML = usageItems.length ? `
    <div class="usage-grid">
      ${usageItems.map(u => `<div class="usage-item"><div class="usage-ico">${u.ico}</div><div class="usage-lbl">${escHtml(u.lbl)}</div><div class="usage-val">${u.val}</div></div>`).join('')}
    </div>` : '';

  const tabs = [];
  if (p.desc) tabs.push({ id: 'desc', label: '📋 وصف كامل' });
  if (p.usage) tabs.push({ id: 'usage', label: '📍 موضع الاستعمال' });
  if (usageItems.length) tabs.push({ id: 'dose', label: '💊 الجرعة والاستخدام' });
  if (p.warnings) tabs.push({ id: 'warn', label: '⚠️ تحذيرات' });
  if (p.contraindications) tabs.push({ id: 'contra', label: '🚫 موانع' });
  if (p.ingredients) tabs.push({ id: 'ingr', label: '🧪 المكونات' });

  const tabsHTML = tabs.length ? `
    <div class="tabs">
      ${tabs.map((t, i) => `<button class="tab-btn${i === 0 ? ' act' : ''}" data-action="switch-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    ${p.desc ? `<div class="tab-content${tabs[0]?.id === 'desc' ? ' act' : ''}" id="tab-desc"><div class="info-block"><h4>📋 وصف كامل</h4><p>${escProductBodyHtml(p.desc)}</p></div></div>` : ''}
    ${p.usage ? `<div class="tab-content${tabs[0]?.id === 'usage' ? ' act' : ''}" id="tab-usage"><div class="info-block"><h4>📍 موضع الاستعمال</h4><p>${escProductBodyHtml(p.usage)}</p></div></div>` : ''}
    ${usageItems.length ? `<div class="tab-content${tabs[0]?.id === 'dose' ? ' act' : ''}" id="tab-dose"><div class="info-block"><h4>💊 الجرعة والاستخدام</h4>${usageGridHTML}</div></div>` : ''}
    ${p.warnings ? `<div class="tab-content${tabs[0]?.id === 'warn' ? ' act' : ''}" id="tab-warn"><div class="warn-block"><h4>⚠️ تحذيرات مهمة</h4><p>${escProductBodyHtml(p.warnings)}</p></div></div>` : ''}
    ${p.contraindications ? `<div class="tab-content${tabs[0]?.id === 'contra' ? ' act' : ''}" id="tab-contra"><div class="warn-block"><h4>🚫 موانع الاستخدام</h4><p>${escProductBodyHtml(p.contraindications)}</p></div></div>` : ''}
    ${p.ingredients ? `<div class="tab-content${tabs[0]?.id === 'ingr' ? ' act' : ''}" id="tab-ingr"><div class="info-block"><h4>🧪 المكونات الفعالة</h4><p>${escProductBodyHtml(p.ingredients)}</p></div></div>` : ''}
  ` : '';

  const emptyDetailsHTML = !tabs.length
    ? `<div class="prod-empty-details" role="status"><p class="prod-empty-details__txt">لم يُضف وصف تفصيلي أو تعليمات استخدام لهذا المنتج بعد. يمكنك <a href="${waOrderHref}" class="prod-empty-details__wa" target="_blank" rel="noopener noreferrer">الاستفسار عبر واتساب</a> للحصول على التفاصيل من الصيدلي.</p></div>`
    : '';

  const rxStrip = (p.prescription_required ? '<div class="prod-rx-strip">⚕️ هذا المنتج يتطلب وصفة طبية</div>' : '');

  const breadcrumbHtml = buildProductBreadcrumbHtml(p, primaryCat, primaryCatLabel);

  const similarHTML = similar.length ? `
    <div class="similar-sec">
      <h3>منتجات مشابهة</h3>
      <p class="similar-sec__sub">${similarProductsSectionSubtitle(similar.length)}</p>
      <div class="similar-grid" role="region" aria-label="منتجات مشابهة — مرّر أفقياً لعرض المزيد" tabindex="0">
        ${similar.map(s => {
          const href = typeof productPageUrl === 'function' ? productPageUrl(s) : ('product.html?id=' + encodeURIComponent(s.id));
          const simSrc = typeof productCardDisplayImageUrl === 'function' ? productCardDisplayImageUrl(s) : fixImgUrl(s.image || s.img);
          return `
          <a href="${href}" class="sim-card sim-card--similar">
            <div class="sim-img"><span class="sim-badge sim-badge--similar" aria-hidden="true"><span class="sim-badge__ico">🔥</span><span class="sim-badge__txt">مشابه</span></span>${simSrc ? `<img src="${simSrc}" alt="${escHtml(s.name)}" class="img-cover" loading="lazy" decoding="async" data-fallback-next="sim-img-fb"><span class="sim-img-fb" style="display:none;font-size:28px">${s.ico || '💊'}</span>` : `<span style="font-size:28px">${s.ico || '💊'}</span>`}</div>
            <div class="sim-info">
              <div class="sim-name">${escHtml(s.name)}</div>
              ${shelfSimPriceHtml(s)}
            </div>
          </a>`;
        }).join('')}
      </div>
    </div>` : '';

  return `
    <div class="product-page">
    ${breadcrumbHtml}
    <article class="prod-card">
      <div class="img-sec">
        ${badgeHTML}
        ${imgHTML}
      </div>
      <div class="info-sec">
        <div>
          <span class="prod-cat">${primaryCatLabel}${catsExtra}</span>
          <h1 class="prod-name">${p.name}</h1>
          <div class="prod-rating-summary" id="prodRatingSummary" aria-live="polite"><span class="prod-rating-summary__muted">جاري تحميل التقييمات…</span></div>
        </div>
        <div class="price-row">
          ${shelf.active
            ? `<span class="price-now">${formatPrice(shelf.final)}</span><span class="price-old">${formatPrice(shelf.list)}</span><span class="discount-tag">خصم ${shelf.promoPct}%</span>`
            : `<span class="price-now">${formatPrice(p.price)}</span>${qrOffer && catElig && p.old ? `<span class="price-old">${formatPrice(p.old)}</span>` : ''}${disc ? `<span class="discount-tag">خصم ${disc}</span>` : ''}`}
        </div>
        <ul class="prod-trust-strip" aria-label="ضمانات الخدمة">
          <li class="prod-trust-strip__item"><span class="prod-trust-strip__ico" aria-hidden="true">🚚</span><span>توصيل سريع خلال 24 ساعة</span></li>
          <li class="prod-trust-strip__item"><span class="prod-trust-strip__ico" aria-hidden="true">✅</span><span>منتجات أصلية 100٪</span></li>
          <li class="prod-trust-strip__item"><span class="prod-trust-strip__ico" aria-hidden="true">💊</span><span>استشارة صيدلانية مجانية</span></li>
        </ul>
        ${rxStrip}
        <div class="divider"></div>
        ${tabsHTML}${emptyDetailsHTML}
        <div class="prod-cta-row prod-cta-row--wa">
          <a href="${waOrderHref}" target="_blank" rel="noopener noreferrer" class="prod-wa-order-btn" data-action="wa-open-product" data-id="${escHtml(String(p.id))}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            اطلب الآن عبر واتساب
          </a>
          <a href="${askPharmacistHref}" target="_blank" rel="noopener noreferrer" class="prod-ask-rx-btn" data-action="wa-open-product" data-id="${escHtml(String(p.id))}">💬 اسأل صيدلي</a>
          <button type="button" class="prod-add-cart" data-action="add-cart-product" data-id="${p.id}">إضافة للسلة</button>
        </div>
        <p class="prod-disclaimer">المعلومات المعروضة لا تغني عن استشارة الطبيب أو الصيدلي المختص.</p>
      </div>
    </article>
    ${bundles.length ? `<section class="bundle-sec" aria-label="حزم مرتبطة"><h3 class="bundle-sec__title">🎁 منتجات ضمن العرض</h3><div class="similar-grid" role="region" aria-label="منتجات العرض — مرّر أفقياً" tabindex="0">${bundles.map(b => {
  const bh = typeof productPageUrl === 'function' ? productPageUrl(b) : ('product.html?id=' + encodeURIComponent(b.id));
  const bimg = typeof productCardDisplayImageUrl === 'function' ? productCardDisplayImageUrl(b) : fixImgUrl(b.image || b.img);
  return `<a href="${bh}" class="sim-card sim-card--bundle"><div class="sim-img"><span class="sim-badge sim-badge--bestseller" aria-hidden="true"><span class="sim-badge__ico">⭐</span><span class="sim-badge__txt">الأكثر شراءً</span></span>${bimg ? `<img src="${bimg}" alt="" class="img-cover" loading="lazy" decoding="async">` : '<span style="font-size:28px">📦</span>'}</div><div class="sim-info"><div class="sim-name">${escHtml(b.name)}</div>${shelfSimPriceHtml(b)}</div></a>`;
}).join('')}</div></section>` : ''}
    <section class="prod-reviews-wrap" id="prodReviewsWrap" data-product-id="${p.id}" aria-label="مراجعات المنتج"></section>
    ${similarHTML}
    </div>
  `;
}

function renderProductFetchError(message) {
  removeProductWaStickyBar();
  const main = getMainEl();
  if (!main) return;
  main.setAttribute('aria-busy', 'false');
  const msg = message || 'تعذر تحميل بيانات المنتج';
  replaceChildrenFromHtml(main, `
    <div class="not-found prod-page-error" role="alert">
      <div aria-hidden="true">⚠️</div>
      <p style="font-size:16px;font-weight:800;margin-bottom:8px;">${escHtml(msg)}</p>
      <button type="button" class="prod-page-retry-btn" id="prodPageRetryBtn" style="margin-top:12px;padding:10px 22px;background:#00875a;color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-family:inherit;font-size:15px">إعادة المحاولة</button>
      <a href="index.html" style="color:var(--g);font-weight:800;display:inline-block;margin-top:14px;">← العودة للرئيسية</a>
    </div>`);
  const btn = document.getElementById('prodPageRetryBtn');
  if (btn) {
    btn.addEventListener('click', function () {
      loadProduct().catch(function () {});
    });
  }
}

async function loadProduct() {
  removeProductWaStickyBar();
  const safeId = productSanitizeUrlId(pidRaw);
  const safeSlug = productSanitizeUrlSlug(slugRaw);
  const main = getMainEl();
  if (!main) return;

  if (!safeId && !safeSlug) {
    main.setAttribute('aria-busy', 'false');
    replaceChildrenFromHtml(main, `
      <div class="not-found" role="alert">
        <div aria-hidden="true">⚠️</div>
        <p style="font-size:16px;font-weight:800;margin-bottom:8px;">لم يُحدد منتج في الرابط</p>
        <p style="color:#64748b;font-size:14px;margin-bottom:12px;">استخدم <code style="background:#f1f5f9;padding:2px 8px;border-radius:6px">product.html?id=…</code></p>
        <a href="categories.html" style="color:var(--g);font-weight:800;">تصفح المنتجات</a>
      </div>`);
    return;
  }

  main.setAttribute('aria-busy', 'true');
  if (typeof showLoader === 'function') showLoader();

  try {
    const [res, sd] = await Promise.all([
      apiFetch('getProduct', safeId ? { id: safeId } : { slug: safeSlug }),
      apiFetch('getSettings')
    ]);

    if (sd && apiIsSuccess(sd) && sd.data && sd.data.settings) {
      mergeSettingsFromApi(sd.data.settings);
      applySettings();
      applyShopPageFooterFromSettings();
    }

    if (!apiIsSuccess(res) || !res.data || !res.data.product) {
      const errText = apiErrorMessage(res) || '';
      if (errText.indexOf('غير موجود') !== -1) {
        renderNotFound();
        return;
      }
      throw new Error(errText || 'استجابة غير صالحة');
    }

    const p = typeof normalizeProductFromApi === 'function'
      ? normalizeProductFromApi(res.data.product)
      : res.data.product;

    let catalog = [];
    try {
      const dAll = await apiFetch('getProducts', { active: 1 });
      catalog = coerceApiArray(apiPick(dAll, 'products', [])).map(function (x) {
        return typeof normalizeProductFromApi === 'function' ? normalizeProductFromApi(x) : x;
      });
    } catch (eCat) {
      if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[product-catalog]', eCat);
    }

    if (typeof setShopProducts === 'function') {
      setShopProducts(catalog.length ? catalog : [p], { view: 'product', notify: false });
    } else {
      prods = catalog.length ? catalog : [p];
    }

    const similar = catalog.length ? productPageFindSimilar(catalog, p, 4) : [];
    const bidArr = Array.isArray(p.bundle_ids) ? p.bundle_ids : (Array.isArray(p.bundleIds) ? p.bundleIds : []);
    const bundles = bidArr.map(function (bid) {
      return catalog.find(function (x) { return String(x.id) === String(bid); });
    }).filter(Boolean);

    main.setAttribute('aria-busy', 'false');
    renderProduct(p, similar, bundles);
  } catch (e) {
    if (typeof pharmaLogError === 'function') pharmaLogError('[product]', e);
    renderProductFetchError('تعذر الاتصال بالخادم أو قراءة المنتج');
    if (typeof showToast === 'function') showToast('تعذر تحميل المنتج', 'error');
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
  }
}

function renderNotFound() {
  removeProductWaStickyBar();
  const main = getMainEl();
  if (main) main.setAttribute('aria-busy', 'false');
  replaceChildrenFromHtml(getMainEl(), `
    <div class="not-found" role="status">
      <div aria-hidden="true">🔍</div>
      <p style="font-size:16px;font-weight:800;margin-bottom:8px;">المنتج غير موجود</p>
      <a href="index.html" style="color:var(--g);font-weight:800;">← العودة للرئيسية</a>
    </div>`);
}

function removeProductWaStickyBar() {
  document.body.classList.remove('product-page--wa-sticky');
  const bar = document.getElementById('prodWaStickyBar');
  if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
}

/** شريط واتساب ثابت أسفل الشاشة (موبايل) — نفس رسالة الطلب + تتبع النقر */
function mountProductWaStickyBar(p) {
  removeProductWaStickyBar();
  if (!p || p.id == null) return;
  document.body.classList.add('product-page--wa-sticky');
  const waText = typeof buildProductWaOrderText === 'function' ? buildProductWaOrderText(p) : '';
  const href = typeof buildWaUrl === 'function' ? buildWaUrl(waText) : '#';
  const bar = document.createElement('div');
  bar.id = 'prodWaStickyBar';
  bar.className = 'prod-wa-sticky';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'طلب عبر واتساب');
  const inner = document.createElement('div');
  inner.className = 'prod-wa-sticky__inner';
  const a = document.createElement('a');
  a.className = 'prod-wa-sticky__btn';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.setAttribute('data-action', 'wa-open-product');
  a.setAttribute('data-id', String(p.id));
  a.innerHTML = '<span class="prod-wa-sticky__ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></span><span class="prod-wa-sticky__txt">اطلب الآن عبر واتساب</span>';
  inner.appendChild(a);
  bar.appendChild(inner);
  document.body.appendChild(bar);
}

function renderProduct(p, similar, bundles) {
  document.title = p.name + ' - صيدلية شهد محمد';
  replaceChildrenFromHtml(getMainEl(), buildProductMainHtml(p, similar, bundles));
  applyProductPageMeta(p, window.__productGalleryUrls || []);
  window.__waFloatText = `أريد الاستفسار عن: ${p.name}`;
  if (typeof applySettings === 'function') applySettings();
  if (typeof applyShopPageFooterFromSettings === 'function') applyShopPageFooterFromSettings();
  if (typeof initProductReviews === 'function')   initProductReviews(p.id);
  mountProductWaStickyBar(productCloneForWaOrder(p));
  initProductImageZoom();
  tryProductGalleryVideoPlay();
}

/** تشغيل فيديو المعرض (بعد بناء DOM) — منتجات بفيديو مخصص فقط */
function tryProductGalleryVideoPlay() {
  var v = document.getElementById('prodGalleryVideo');
  if (!v) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    v.removeAttribute('autoplay');
    try { v.pause(); } catch (e) {}
    return;
  }
  var pr = v.play();
  if (pr && typeof pr.catch === 'function') pr.catch(function () {});
}

/**
 * تكبير عند المرور (مكبّر) — يعمل مع object-fit: cover على سطح المكتب فقط
 */
function initProductImageZoom() {
  var root = document.querySelector('.prod-gallery-zoom');
  var wrap = document.getElementById('prodImgZoomWrap');
  var img = document.getElementById('prodMainImg');
  var lens = document.getElementById('prodZoomLens');
  var pane = document.getElementById('prodZoomPane');
  if (!root || !wrap || !img || !lens || !pane) return;

  var ZOOM = 2.35;
  var LENS_FRAC = 0.34;

  function reduceMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  function isNarrow() {
    try {
      return window.matchMedia('(max-width: 899px)').matches;
    } catch (e) {
      return window.innerWidth < 900;
    }
  }

  function coverGeometry() {
    var rect = img.getBoundingClientRect();
    var nw = img.naturalWidth;
    var nh = img.naturalHeight;
    if (!nw || !nh || rect.width < 8 || rect.height < 8) return null;
    var ir = nw / nh;
    var wr = rect.width / rect.height;
    var s; var dispW; var dispH; var offX; var offY;
    if (ir > wr) {
      s = rect.height / nh;
      dispW = nw * s;
      dispH = rect.height;
      offX = (rect.width - dispW) / 2;
      offY = 0;
    } else {
      s = rect.width / nw;
      dispW = rect.width;
      dispH = nh * s;
      offX = 0;
      offY = (rect.height - dispH) / 2;
    }
    return { rect: rect, nw: nw, nh: nh, s: s, dispW: dispW, dispH: dispH, offX: offX, offY: offY };
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function onMove(e) {
    if (isNarrow() || reduceMotion()) return;
    var g = coverGeometry();
    if (!g) return;

    var lx = e.clientX - g.rect.left;
    var ly = e.clientY - g.rect.top;
    if (lx < g.offX || ly < g.offY || lx > g.offX + g.dispW || ly > g.offY + g.dispH) {
      root.classList.remove('is-zooming');
      lens.hidden = true;
      pane.setAttribute('aria-hidden', 'true');
      pane.style.backgroundImage = '';
      pane.style.backgroundSize = '';
      pane.style.backgroundPosition = '';
      return;
    }

    var lc = Math.min(g.rect.width, g.rect.height) * LENS_FRAC;
    var lensLeft = lx - lc / 2;
    var lensTop = ly - lc / 2;
    lensLeft = clamp(lensLeft, g.offX, g.offX + g.dispW - lc);
    lensTop = clamp(lensTop, g.offY, g.offY + g.dispH - lc);

    lens.style.width = lc + 'px';
    lens.style.height = lc + 'px';
    lens.style.left = lensLeft + 'px';
    lens.style.top = lensTop + 'px';
    lens.hidden = false;

    var ncx = (lensLeft + lc / 2 - g.offX) / g.s;
    var ncy = (lensTop + lc / 2 - g.offY) / g.s;

    // يجب إظهار اللوحة (.is-zooming) قبل قياسها — وإلا display:none فيعطي عرض/ارتفاع 0 ولا يُرسم التكبير
    root.classList.add('is-zooming');
    pane.setAttribute('aria-hidden', 'false');

    var paneRect = pane.getBoundingClientRect();
    var pw = paneRect.width;
    var ph = paneRect.height;
    if (pw < 4 || ph < 4) {
      root.classList.remove('is-zooming');
      pane.setAttribute('aria-hidden', 'true');
      lens.hidden = true;
      return;
    }

    var src = img.currentSrc || img.src;
    pane.style.backgroundImage = 'url(' + JSON.stringify(String(src)) + ')';
    pane.style.backgroundSize = (g.nw * ZOOM) + 'px ' + (g.nh * ZOOM) + 'px';
    pane.style.backgroundPosition = (pw / 2 - ncx * ZOOM) + 'px ' + (ph / 2 - ncy * ZOOM) + 'px';
    pane.style.backgroundRepeat = 'no-repeat';
  }

  function onLeave() {
    root.classList.remove('is-zooming');
    lens.hidden = true;
    pane.setAttribute('aria-hidden', 'true');
    pane.style.backgroundImage = '';
    pane.style.backgroundSize = '';
    pane.style.backgroundPosition = '';
  }

  if (wrap.getAttribute('data-pharma-zoom-init') === '1') return;
  if (reduceMotion()) return;
  wrap.setAttribute('data-pharma-zoom-init', '1');

  wrap.addEventListener('mousemove', onMove);
  wrap.addEventListener('mouseleave', onLeave);
}

window.initProductImageZoom = initProductImageZoom;

function switchTab(id, btn) {
  const root = getMainEl();
  if (!root || !btn) return;
  /** الضغط على نفس التبويب النشط يطوي المحتوى */
  if (btn.classList.contains('act')) {
    root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('act'));
    root.querySelectorAll('.tab-content').forEach(c => c.classList.remove('act'));
    return;
  }
  root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('act'));
  root.querySelectorAll('.tab-content').forEach(c => c.classList.remove('act'));
  btn.classList.add('act');
  const el = document.getElementById('tab-' + id);
  if (el) el.classList.add('act');
}

if (__pharmaStoreHtmlFile() === 'product.html') {
  (async function () {
    initShopChrome();
    await loadProduct();
  })();
}

/* ---------- subcategory-logic.js ---------- */
const urlParams = new URLSearchParams(location.search);
const subcatId = urlParams.get('id');

if (typeof subscribeShopState === 'function') {
  subscribeShopState(function (s, meta) {
    if (!meta || meta.view !== 'subcategory') return;
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    if (!s.products.length) subcategoryViewRenderGridEmpty(grid);
    else subcategoryViewRenderGridProducts(grid, s.products);
  });
}

function subcategoryViewObserveReveals(gridEl) {
  const obs = new IntersectionObserver(e => {
    e.forEach(x => { if (x.isIntersecting) x.target.classList.add('in'); });
  }, { threshold: 0.06 });
  gridEl.querySelectorAll('.reveal:not(.in)').forEach(el => obs.observe(el));
}

function subcategoryViewRenderHeaderFound(headerDiv, subcat) {
  window.__subcategoryContext = subcat && subcat.parent != null && String(subcat.parent) !== ''
    ? { parentSlug: subcat.parent }
    : null;
  document.title = `${subcat.icon || '📁'} ${subcat.name} - صيدلية شهد محمد`;
  window.__waFloatText = `أود الاستفسار عن قسم: ${subcat.name}`;
  if (typeof applySettings === 'function') applySettings();
  const esc = typeof escHtml === 'function' ? escHtml : function (t) { return t == null ? '' : String(t); };
  const nm = esc(subcat.name);
  const parent = subcat.parent != null && String(subcat.parent) !== ''
    ? '<a href="category.html?slug=' + encodeURIComponent(String(subcat.parent)) + '">القسم الرئيسي</a><span class="p-breadcrumb__sep" aria-hidden="true">›</span>'
    : '';
  headerDiv.innerHTML = `
        <nav class="p-breadcrumb" aria-label="مسار التنقل">
          <a href="index.html">الرئيسية</a><span class="p-breadcrumb__sep" aria-hidden="true">›</span>
          <a href="categories.html">الأقسام</a><span class="p-breadcrumb__sep" aria-hidden="true">›</span>
          ${parent}
          <span class="p-breadcrumb__here" aria-current="page">${nm}</span>
        </nav>
        <div class="category-icon">${subcat.icon || '📁'}</div>
        <div class="category-name">${nm}</div>
        <div class="category-desc">جميع المنتجات المتوفرة هنا — الطلب يتم عبر واتساب بعد تأكيد التوفر</div>
      `;
}

function subcategoryViewRenderHeaderMissing(headerDiv) {
  window.__subcategoryContext = null;
  window.__waFloatText = '';
  if (typeof applySettings === 'function') applySettings();
  headerDiv.innerHTML = `<div class="category-name">القسم غير موجود</div>`;
}

function subcategoryViewRenderGridEmpty(grid) {
  grid.classList.remove('pgrid6--skel-wrap');
  let extra = '';
  const sc = window.__subcategoryContext;
  if (sc && sc.parentSlug != null && String(sc.parentSlug) !== '') {
    const href = 'category.html?slug=' + encodeURIComponent(String(sc.parentSlug));
    extra = `<p class="empty-state__parent"><a href="${href}">← العودة إلى القسم الرئيسي</a></p>`;
  }
  const inner = typeof buildEmptyProductsStateHtml === 'function'
    ? buildEmptyProductsStateHtml('لا توجد منتجات في هذا القسم الفرعي حالياً', { variant: 'default', extraHtml: extra })
    : `<div class="empty-state empty-state--rich" role="status"><p class="empty-state__msg">لا توجد منتجات في هذا القسم الفرعي حالياً</p>${extra}<a href="index.html" class="empty-state__back">الرئيسية</a></div>`;
  replaceChildrenFromHtml(grid, inner);
  grid.setAttribute('aria-busy', 'false');
}

function subcategoryViewRenderGridProducts(grid, products) {
  grid.classList.remove('pgrid6--skel-wrap');
  grid.setAttribute('aria-busy', 'false');
  replaceChildrenFromHtml(grid, products.map(p => buildProductCardHtml(p)).join(''));
  subcategoryViewObserveReveals(grid);
}

function subcategoryViewShowFatalError() {
  const hdr = document.getElementById('categoryHeader');
  const grd = document.getElementById('productsGrid');
  if (hdr) hdr.innerHTML = '<div class="category-name">حدث خطأ</div>';
  if (grd) replaceChildrenFromHtml(grd, '<div class="empty-state"><div class="ei">⚠️</div><p>حدث خطأ في التحميل</p></div>');
}

async function loadCategoryAndProducts() {
  if (typeof showLoader === 'function') showLoader();
  try {
    const payload = await subcategoryPageLoadPayload(subcatId);

    if (payload.settingsData && apiIsSuccess(payload.settingsData) && payload.settingsData.data && payload.settingsData.data.settings) {
      mergeSettingsFromApi(payload.settingsData.data.settings);
      applySettings();
      applyShopPageFooterFromSettings();
    }

    const headerDiv = document.getElementById('categoryHeader');
    if (payload.subcat) {
      subcategoryViewRenderHeaderFound(headerDiv, payload.subcat);
    } else {
      subcategoryViewRenderHeaderMissing(headerDiv);
    }

    const grid = document.getElementById('productsGrid');
    if (typeof setShopProducts === 'function') {
      setShopProducts(payload.products || [], { view: 'subcategory' });
    } else {
      prods = payload.products;
      if (!payload.products.length) {
        subcategoryViewRenderGridEmpty(grid);
        return;
      }
      subcategoryViewRenderGridProducts(grid, payload.products);
    }
  } catch (e) {
    if (typeof pharmaLogError === 'function') pharmaLogError('[subcategory]', e);
    subcategoryViewShowFatalError();
    if (typeof showToast === 'function') showToast('تعذر تحميل المنتجات', 'error');
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
  }
}

if (__pharmaStoreHtmlFile() === 'subcategory.html') {
  (async function () {
    try {
      const sd = await apiFetch('getSettings');
      if (sd && apiIsSuccess(sd) && sd.data && sd.data.settings) {
        mergeSettingsFromApi(sd.data.settings);
        applySettings();
        applyShopPageFooterFromSettings();
      }
    } catch (e) {}
    initShopChrome();
    await loadCategoryAndProducts();
  })();
}

/* ---------- categories-page.js ---------- */
/* categories-page.js — صفحة الأقسام (مدمج مع categories-filter) */
async function initCategories() {
  const grid        = document.getElementById('categoriesPageGrid');
  const skel        = document.getElementById('categoriesPageSkel');
  const searchInput = document.getElementById('catSearchInput');

  let allCats = [];

  try {
    showLoader();
    const [catRes, setRes] = await Promise.all([
      apiFetch('getCategories', { active: 1 }),
      apiFetch('getSettings')
    ]);

    if (setRes && apiIsSuccess(setRes) && setRes.data && setRes.data.settings) Object.assign(settings, setRes.data.settings);
    if (typeof applySettings === 'function') applySettings();
    if (typeof initShopChrome === 'function') initShopChrome();

    allCats = (catRes && apiIsSuccess(catRes) && catRes.data && catRes.data.categories)
      ? catRes.data.categories.filter(c => c.active !== false) : [];

    if (skel) skel.style.display = 'none';
    renderCatsGrid(allCats);

  } catch (e) {
    if (typeof pharmaLogError === 'function') pharmaLogError('[categories-page]', e);
    if (grid) replaceChildrenFromHtml(grid, '<div class="empty-state"><div class="ei">⚠️</div><p>حدث خطأ في تحميل الأقسام</p></div>');
    if (skel) skel.style.display = 'none';
    if (typeof showToast === 'function') showToast('تعذر تحميل الأقسام', 'error');
  } finally {
    hideLoader();
  }

  function applyCategorySearchFilter() {
    const q = (searchInput && searchInput.value.trim().toLowerCase()) || '';
    renderCatsGrid(q ? allCats.filter(c => (c.name || '').toLowerCase().includes(q)) : allCats);
  }

  if (searchInput) {
    const doFilter = typeof debounce === 'function'
      ? debounce(applyCategorySearchFilter, 250)
      : applyCategorySearchFilter;
    searchInput.addEventListener('input', doFilter);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCategorySearchFilter();
      }
    });
  }

  const catHeroSearchBtn = document.getElementById('catHeroSearchBtn');
  if (catHeroSearchBtn) {
    catHeroSearchBtn.addEventListener('click', applyCategorySearchFilter);
  }

  function renderCatsGrid(cats) {
    if (!grid) return;
    if (!cats.length) {
      replaceChildrenFromHtml(grid, '<div class="empty-state"><div class="ei">📦</div><p>لا توجد أقسام</p></div>');
      return;
    }
    const sorted = [...cats].sort((a, b) => (a.order || 0) - (b.order || 0));
    replaceChildrenFromHtml(grid, sorted.map(cat => {
      const catImg = typeof resolveHomeCategoryImage === 'function' ? resolveHomeCategoryImage(cat) : '';
      const catHeroVisual = catImg
        ? `<div class="cats-card-media cats-card-media--brand" style="width:100%;max-width:132px;margin:0 auto 14px;border-radius:18px;overflow:hidden;aspect-ratio:1;border:1px solid rgba(0,135,90,.12);box-shadow:0 8px 24px rgba(0,135,90,.08)">
            <img class="cats-card-media__img" src="${escHtml(catImg)}" alt="" width="200" height="200" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;vertical-align:middle"/>
          </div>`
        : `<span style="font-size:52px;display:block;line-height:1;margin-bottom:12px" aria-hidden="true">${cat.icon || '📦'}</span>`;
      return `<div class="cat-card-item reveal"
          style="background:white;border:1.5px solid #e2e8f0;border-radius:18px;overflow:hidden;cursor:pointer"
          data-action="nav-cat" data-slug="${encodeURIComponent(cat.slug || cat.id)}">
        <div style="background:linear-gradient(135deg,#f0faf5,#e4f5ec);padding:28px 20px;text-align:center;border-bottom:1px solid #e2e8f0">
          ${catHeroVisual}
          <div style="font-size:17px;font-weight:900;color:#0a1628">${escHtml(cat.name)}</div>
        </div>
        <div style="padding:14px 16px;font-size:13px;color:#94a3b8">تصفح المنتجات ←</div>
      </div>`;
    }).join(''));

    if (typeof initScrollReveal === 'function') initScrollReveal();
  }
}

window.initCategories = initCategories;

/* ---------- product-reviews.js ---------- */
/* product-reviews.js — تقييمات المنتج في صفحة المنتج */
function escHtmlR(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderProductRatingSummary(stats, reviews, avgFallback) {
  const el = document.getElementById('prodRatingSummary');
  if (!el) return;
  const count = stats && typeof stats.count === 'number' ? stats.count : (reviews && reviews.length) || 0;
  let avgNum = null;
  if (stats && stats.average != null && !Number.isNaN(Number(stats.average))) {
    avgNum = Number(stats.average);
  } else if (avgFallback != null && avgFallback !== '') {
    const p = parseFloat(String(avgFallback));
    if (!Number.isNaN(p)) avgNum = p;
  }
  if (!count || avgNum == null || Number.isNaN(avgNum)) {
    el.innerHTML =
      '<span class="prod-rating-summary__muted prod-rating-summary__encourage">كن أول من يقيّم هذا المنتج — <button type="button" class="prod-rating-summary__encourage-btn" id="prodRatingScrollToReview">أضف تقييمك</button></span>';
    el.classList.add('prod-rating-summary--empty');
    const jump = el.querySelector('#prodRatingScrollToReview');
    if (jump) {
      jump.addEventListener('click', function () {
        const w = document.getElementById('reviewFormWrap');
        if (w) {
          w.scrollIntoView({ behavior: 'smooth', block: 'start' });
          document.getElementById('rv-name-input')?.focus();
        }
      });
    }
    return;
  }
  el.classList.remove('prod-rating-summary--empty');
  const stars = Math.min(5, Math.max(1, Math.round(avgNum)));
  el.innerHTML =
    '<span class="prod-rating-summary__inner">' +
    '<span class="prod-rating-summary__stars star-row" aria-hidden="true">' +
    buildReviewStarsVisualHtml(stars) +
    '</span>' +
    '<strong class="prod-rating-summary__num">' +
    avgNum.toFixed(1) +
    '</strong>' +
    '<span class="prod-rating-summary__count">(' +
    count +
    ' تقييم)</span>' +
    '</span>';
}

function buildReviewStarsVisualHtml(rating) {
  const r = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  let h = '';
  for (let i = 1; i <= 5; i++) {
    h += '<span class="star-row__s' + (i <= r ? ' star-row__s--on' : ' star-row__s--off') + '">★</span>';
  }
  return h;
}

function pickFeaturedReviewIndex(list) {
  if (!list || list.length < 2) return -1;
  let best = 0;
  for (let i = 1; i < list.length; i++) {
    const a = list[best];
    const b = list[i];
    const br = b.rating || 0;
    const ar = a.rating || 0;
    if (br > ar) best = i;
    else if (br === ar) {
      const bu = b.helpful_up || 0;
      const au = a.helpful_up || 0;
      if (bu > au) best = i;
      else if (bu === au && String(b.date || '') > String(a.date || '')) best = i;
    }
  }
  return best;
}

function reviewsFilteredSorted(list, sort, starFilter) {
  let arr = (list || []).slice();
  if (starFilter > 0) arr = arr.filter(function (x) { return (x.rating || 0) === starFilter; });
  if (sort === 'highest') {
    arr.sort(function (a, b) {
      const dr = (b.rating || 0) - (a.rating || 0);
      if (dr !== 0) return dr;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  } else {
    arr.sort(function (a, b) {
      const dd = String(b.date || '').localeCompare(String(a.date || ''));
      if (dd !== 0) return dd;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }
  return arr;
}

function reviewCommentDisplay(text, maxLen) {
  const t = String(text || '').trim();
  if (t.length <= maxLen) return { html: escHtmlR(t), truncated: false };
  return { html: escHtmlR(t.slice(0, maxLen)) + '…', truncated: true, full: t };
}

function reviewImageSrc(url) {
  const u = String(url || '').trim();
  if (!u || (!u.startsWith('/') && !u.startsWith('http'))) return '';
  if (u.startsWith('/') && typeof pharmaPublicAssetUrl === 'function') return pharmaPublicAssetUrl(u);
  return u;
}

function renderProductReviewsCards() {
  const st = window.__reviewsUi;
  const wrap = document.getElementById('reviewsCardsWrap');
  const emptyEl = document.getElementById('reviewsEmptyState');
  if (!st || !wrap) return;
  const sortEl = document.getElementById('reviewSortSelect');
  const sort = sortEl && sortEl.value ? sortEl.value : 'newest';
  const activeF = document.querySelector('.review-star-filter.is-active');
  const starFilter = activeF && activeF.dataset.stars != null ? parseInt(activeF.dataset.stars, 10) : 0;
  const filtered = reviewsFilteredSorted(st.reviews, sort, starFilter);
  const featIdx = pickFeaturedReviewIndex(filtered);

  if (!filtered.length) {
    wrap.innerHTML = '';
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent =
        st.reviews.length === 0
          ? 'كن أول من يقيّم هذا المنتج — تجربتك تهمنا.'
          : 'لا توجد تقييمات ضمن الفلتر الحالي.';
    }
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  wrap.innerHTML = filtered
    .map(function (rv, i) {
      const featured = i === featIdx;
      const cityLine = (rv.city || '').trim();
      const who =
        escHtmlR(rv.name || 'مجهول') +
        (cityLine ? ' <span class="review-card__city">· ' + escHtmlR(cityLine) + '</span>' : '');
      const dt = rv.date ? new Date(rv.date).toLocaleDateString('ar-IQ') : '';
      const comment = rv.comment ? reviewCommentDisplay(rv.comment, 280) : { html: '', truncated: false };
      const imgUrl = reviewImageSrc(rv.image_url);
      const reply = (rv.pharmacist_reply || '').trim();
      const verifiedBadge =
        rv.verified === true
          ? '<span class="review-card__verified" title="تم التحقق من ارتباطه بطلب">مشتري موثّق</span>'
          : '';
      let thumbSrc = imgUrl;
      if (imgUrl && typeof safeImgSrc === 'function') {
        const s = safeImgSrc(imgUrl);
        if (s) thumbSrc = s;
      }
      const imgBlock = thumbSrc
        ? '<button type="button" class="review-card__img-btn" data-action="open-review-img" data-src="' +
          escHtmlR(imgUrl) +
          '"><img src="' +
          escHtmlR(thumbSrc) +
          '" alt="" class="review-card__thumb" loading="lazy" decoding="async"></button>'
        : '';
      return (
        '<article class="review-card review-card--enter' +
        (featured ? ' review-card--featured' : '') +
        '" style="--rv-i:' +
        i +
        '" data-review-id="' +
        escHtmlR(rv.id || '') +
        '">' +
        '<div class="review-card__header">' +
        '<div class="review-card__avatar" aria-hidden="true">' +
        (rv.name || 'م')[0].toUpperCase() +
        '</div>' +
        '<div class="review-card__meta">' +
        '<div class="review-card__name-line">' +
        who +
        '</div>' +
        '<div class="review-card__date">' +
        dt +
        '</div>' +
        '</div>' +
        verifiedBadge +
        '</div>' +
        '<div class="review-card__stars-row" aria-label="التقييم ' +
        (rv.rating || 0) +
        ' من 5">' +
        buildReviewStarsVisualHtml(rv.rating || 0) +
        '</div>' +
        (comment.html
          ? '<p class="review-card__text"' +
            (comment.truncated ? ' title="' + escHtmlR(comment.full) + '"' : '') +
            '>' +
            comment.html +
            '</p>'
          : '') +
        (imgBlock ? '<div class="review-card__media">' + imgBlock + '</div>' : '') +
        (reply
          ? '<div class="review-card__reply"><span class="review-card__reply-label">رد الصيدلي</span><p class="review-card__reply-text">' +
            escHtmlR(reply) +
            '</p></div>'
          : '') +
        '</article>'
      );
    })
    .join('');

  wrap.querySelectorAll('[data-action="open-review-img"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const s = btn.getAttribute('data-src');
      if (s && typeof openImgModal === 'function') openImgModal(s);
    });
  });
}

function scrollToReviewForm() {
  const w = document.getElementById('reviewFormWrap');
  if (w) {
    w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('rv-name-input')?.focus();
  }
}

function wireProductReviewsUi(productId) {
  const sortEl = document.getElementById('reviewSortSelect');
  if (sortEl) {
    sortEl.addEventListener('change', function () {
      renderProductReviewsCards();
    });
  }
  const filt = document.getElementById('reviewStarFilters');
  if (filt) {
    filt.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest ? e.target.closest('.review-star-filter') : null;
      if (!btn || !filt.contains(btn)) return;
      filt.querySelectorAll('.review-star-filter').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      renderProductReviewsCards();
    });
  }
  const addBtn = document.getElementById('btnAddYourReview');
  if (addBtn) addBtn.addEventListener('click', scrollToReviewForm);
  const nudgeCta = document.getElementById('reviewNudgeToForm');
  if (nudgeCta) nudgeCta.addEventListener('click', scrollToReviewForm);
  const nudgeDismiss = document.getElementById('reviewNudgeDismiss');
  const banner = document.getElementById('reviewNudgeBanner');
  if (nudgeDismiss && banner) {
    nudgeDismiss.addEventListener('click', function () {
      banner.hidden = true;
      try {
        sessionStorage.removeItem('pharma_review_nudge_' + String(productId));
      } catch (err) { /* ignore */ }
    });
  }
  try {
    if (banner && sessionStorage.getItem('pharma_review_nudge_' + String(productId)) === '1') {
      banner.hidden = false;
    }
  } catch (e2) { /* ignore */ }
}

/** هيكل قسم المراجعات + نموذج الإرسال */
function buildProductReviewsSectionHtml(productId, reviews, avg, stats) {
  const count = stats && typeof stats.count === 'number' ? stats.count : reviews.length;
  const avgNum =
    stats && stats.average != null && !Number.isNaN(Number(stats.average)) ? Number(stats.average) : null;
  const headerStats =
    count && avgNum != null && !Number.isNaN(avgNum)
      ? '<div class="reviews-head-stats" aria-label="متوسط التقييم">' +
        '<span class="reviews-head-stats__stars star-row" aria-hidden="true">' +
        buildReviewStarsVisualHtml(Math.round(avgNum)) +
        '</span>' +
        '<strong class="reviews-head-stats__avg">' +
        avgNum.toFixed(1) +
        '</strong>' +
        '<span class="reviews-head-stats__meta">من 5 · ' +
        count +
        ' تقييم</span></div>'
      : '';

  return (
    '<div class="reviews-section" data-product-id="' +
    escHtmlR(productId) +
    '">' +
    '<div id="reviewNudgeBanner" class="review-nudge-banner" hidden>' +
    '<p class="review-nudge-banner__text">يسعدنا سماع تجربتك ✨ رأيك القصير يمنح الآخرين ثقةً عند اختيار ما يناسبهم.</p>' +
    '<button type="button" class="review-nudge-banner__cta" id="reviewNudgeToForm">أضف تقييمك</button>' +
    '<button type="button" class="review-nudge-banner__dismiss" id="reviewNudgeDismiss" aria-label="إغلاق">✕</button>' +
    '</div>' +
    '<div class="reviews-toolbar">' +
    '<div class="reviews-toolbar__title-wrap">' +
    '<h3 class="reviews-title">تقييمات العملاء</h3>' +
    headerStats +
    '</div>' +
    '<div class="reviews-toolbar__actions">' +
    '<label class="reviews-sort-label"><span class="sr-only">ترتيب التقييمات</span>' +
    '<select id="reviewSortSelect" class="reviews-sort-select">' +
    '<option value="newest">الأحدث أولاً</option>' +
    '<option value="highest">الأعلى تقييماً</option>' +
    '</select></label>' +
    '<div class="reviews-star-filters" id="reviewStarFilters" role="group" aria-label="فلترة حسب النجوم">' +
    '<button type="button" class="review-star-filter is-active" data-stars="0">الكل</button>' +
    '<button type="button" class="review-star-filter" data-stars="5">5★</button>' +
    '<button type="button" class="review-star-filter" data-stars="4">4★</button>' +
    '<button type="button" class="review-star-filter" data-stars="3">3★</button>' +
    '<button type="button" class="review-star-filter" data-stars="2">2★</button>' +
    '<button type="button" class="review-star-filter" data-stars="1">1★</button>' +
    '</div>' +
    '<button type="button" class="review-add-cta" id="btnAddYourReview">أضف تقييمك</button>' +
    '</div></div>' +
    '<div id="reviewsCardsWrap" class="reviews-cards-wrap"></div>' +
    '<p id="reviewsEmptyState" class="reviews-empty-state" hidden></p>' +
    '<div class="review-form" id="reviewFormWrap">' +
    '<h4 class="review-form__title">أضف تقييمك</h4>' +
    '<p class="review-form__hint">تقييم قصير وواضح (حتى 500 حرف) — الاسم والمدينة تزيد الثقة.</p>' +
    '<div class="review-stars-input" id="starInput" role="group" aria-label="اختر عدد النجوم">' +
    [1, 2, 3, 4, 5]
      .map(function (n) {
        return '<button type="button" class="review-star-hit" data-val="' + n + '" data-action="set-star" aria-label="' + n + ' من 5"><span class="review-star-hit__icon">★</span></button>';
      })
      .join('') +
    '</div>' +
    '<div class="review-form__row2">' +
    '<input type="text" id="rv-name-input" class="review-form__input" placeholder="الاسم" maxlength="120" autocomplete="name">' +
    '<input type="text" id="rv-city-input" class="review-form__input" placeholder="المدينة" maxlength="80" autocomplete="address-level2">' +
    '</div>' +
    '<textarea id="rv-comment-input" class="review-form__textarea" placeholder="تعليقك (اختياري)" rows="3" maxlength="500"></textarea>' +
    '<button type="button" class="review-form__submit" data-action="submit-review" data-product="' +
    escHtmlR(productId) +
    '">إرسال التقييم</button>' +
    '<p id="rv-msg" class="review-form__msg" hidden></p>' +
    '</div></div>'
  );
}

function reviewReadFormValues() {
  return {
    name: (document.getElementById('rv-name-input')?.value || '').trim(),
    city: (document.getElementById('rv-city-input')?.value || '').trim(),
    comment: (document.getElementById('rv-comment-input')?.value || '').trim()
  };
}

function reviewShowMessage(msgEl, text, color) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.color = color;
  msgEl.hidden = false;
}

async function initProductReviews(productId, opts) {
  const wrap = document.getElementById('prodReviewsWrap');
  if (!wrap) return;
  const quiet = opts && opts.quiet;

  if (!quiet) {
    wrap.innerHTML = '<p class="reviews-loading" style="color:#64748b;text-align:center;padding:20px">جاري تحميل التقييمات...</p>';
  }
  try {
    const data = await fetchProductReviews(productId);
    const rawList = apiPick(data, 'reviews', []);
    const stats = data && data.data && data.data.stats ? data.data.stats : null;
    const reviews = reviewsFilterApproved(rawList);
    const avg = reviewsAverageRating(reviews);
    renderProductRatingSummary(stats, reviews, avg);
    window.__reviewsUi = { productId: String(productId), reviews: reviews, stats: stats };
    if (quiet && document.getElementById('reviewFormWrap')) {
      renderProductReviewsCards();
      setReviewStar(_rvStar);
    } else {
      wrap.innerHTML = buildProductReviewsSectionHtml(productId, reviews, avg, stats);
      renderProductReviewsCards();
      wireProductReviewsUi(productId);
      setReviewStar(_rvStar);
    }
    const msgEl = document.getElementById('rv-msg');
    if (msgEl && !quiet) msgEl.hidden = true;
  } catch (e) {
    if (typeof pharmaLogWarn === 'function') pharmaLogWarn('[reviews]', e);
    window.__reviewsUi = null;
    const sumEl = document.getElementById('prodRatingSummary');
    if (sumEl) {
      sumEl.innerHTML = '<span class="prod-rating-summary__muted">تعذر تحميل ملخص التقييم</span>';
    }
    if (!quiet) {
      wrap.innerHTML = '<p style="color:#64748b;text-align:center;padding:20px">تعذر تحميل التقييمات</p>';
    }
    if (typeof showToast === 'function') showToast('تعذر تحميل التقييمات', 'error');
  }
}

let _rvStar = 5;
function setReviewStar(n) {
  _rvStar = Math.min(5, Math.max(1, parseInt(n, 10) || 5));
  const box = document.getElementById('starInput');
  if (!box) return;
  box.querySelectorAll('.review-star-hit').forEach(function (el) {
    const v = parseInt(el.dataset.val, 10);
    el.classList.toggle('is-selected', v <= _rvStar);
    el.setAttribute('aria-pressed', v <= _rvStar ? 'true' : 'false');
  });
}

async function submitReview(productId) {
  const { name, city, comment } = reviewReadFormValues();
  const msg = document.getElementById('rv-msg');
  const btn = document.querySelector('[data-action="submit-review"]');
  if (!name) {
    reviewShowMessage(msg, '⚠️ يرجى إدخال اسمك', '#ef4444');
    return;
  }
  if (!city) {
    reviewShowMessage(msg, '⚠️ يرجى إدخال المدينة (تظهر بجانب الاسم وتزيد المصداقية)', '#ef4444');
    return;
  }

  const origText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'جارٍ الإرسال...';
  }
  try {
    const data = await submitProductReview({
      product_id: productId,
      name: name,
      city: city,
      comment: comment,
      rating: _rvStar,
      image_url: ''
    });
    reviewShowMessage(
      msg,
      apiIsSuccess(data) ? '✓ تم إرسال تقييمك بنجاح، سيظهر بعد المراجعة' : (apiErrorMessage(data) || data.msg || 'حدث خطأ'),
      apiIsSuccess(data) ? '#00875a' : '#ef4444'
    );
    if (apiIsSuccess(data)) {
      const n = document.getElementById('rv-name-input');
      const c = document.getElementById('rv-city-input');
      const t = document.getElementById('rv-comment-input');
      if (n) n.value = '';
      if (c) c.value = '';
      if (t) t.value = '';
      _rvStar = 5;
      setReviewStar(5);
      await initProductReviews(productId, { quiet: true });
    }
  } catch (e) {
    reviewShowMessage(msg, '⚠️ تعذر الإرسال', '#ef4444');
    if (typeof showToast === 'function') showToast('تعذر الإرسال', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText || 'إرسال التقييم';
    }
  }
}

window.initProductReviews = initProductReviews;
window.setReviewStar = setReviewStar;
window.submitReview = submitReview;

/* ---------- product-modal.js ---------- */
const imgModal = document.createElement('div');
imgModal.className = 'img-modal';
imgModal.id = 'imgModal';
imgModal.innerHTML = '<img id="imgModalImg" src="" alt="" decoding="async" data-skip-img-fallback="1" class="img-modal__img img-cover"><button class="img-modal-x" data-action="close-img-modal" id="imgModalClose">✕</button>';
document.body.appendChild(imgModal);
imgModal.addEventListener('click', e => { if(e.target === imgModal) closeImgModal(); });

function openImgModal(src){ 
  // ✅ FIX: تحقق من الـ src قبل تعيينه للصورة — يمنع استخدام الإيموجي كـ src
  var safeSrc = (typeof safeImgSrc === 'function') ? safeImgSrc(src) : (src && (src.startsWith('http')||src.startsWith('/')) ? src : '');
  if (!safeSrc) return;
  if (safeSrc.startsWith('/') && typeof pharmaPublicAssetUrl === 'function') {
    safeSrc = pharmaPublicAssetUrl(safeSrc);
  }
  document.getElementById('imgModalImg').src = safeSrc;
  imgModal.classList.add('open');
  document.body.style.overflow='hidden';
}
function closeImgModal(){ 
  imgModal.classList.remove('open');
  document.body.style.overflow='';
}
document.addEventListener('keydown', e => { if(e.key==='Escape') closeImgModal(); });

/* ---------- hero-slider-init.js ---------- */
(function(){
  'use strict';
  var track = document.getElementById('heroSliderTrack');
  var slides = document.querySelectorAll('.hero-slide');
  var dots = document.querySelectorAll('.hero-slider__dot');
  var progress = document.getElementById('heroSliderProgress');
  var prevBtn = document.getElementById('heroSliderPrev');
  var nextBtn = document.getElementById('heroSliderNext');

  if(!track || !slides.length) return;

  var current = 0;
  var total = slides.length;
  var autoMs = 2000;
  var timer = null;
  var progTimer = null;
  var paused = false;
  /** عرض شريحة واحدة بالبكسل — ضروري لـ translate3d ويعمل مع السحب (كان width:100% على الـ track يُثبّت العرض) */
  var heroSlideW = 0;
  var pageRtl = typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl';

  function syncHeroDom() {
    slides = track.querySelectorAll('.hero-slide');
    total = slides.length;
    dots = document.querySelectorAll('.hero-slider__dot');
    if (total < 1) return;
    current = ((current % total) + total) % total;
  }

  function applyHeroTransform() {
    if (!track || total < 1) return;
    if (heroSlideW > 0) {
      track.style.transform = 'translate3d(' + (-current * heroSlideW) + 'px,0,0)';
    } else {
      track.style.transform = 'translateX(calc(' + (-current) + ' * 100% / ' + total + '))';
    }
  }

  function layoutHeroSlides() {
    if (!track) return;
    syncHeroDom();
    if (total < 1) return;
    var host = track.parentElement;
    var w = 0;
    if (host && host.getBoundingClientRect) {
      w = Math.round(host.getBoundingClientRect().width);
    }
    if (w < 1 && host) {
      try {
        w = Math.round(host.offsetWidth) || 0;
      } catch (e) {}
    }
    if (w < 1) {
      applyHeroTransform();
      return;
    }
    heroSlideW = w;
    track.style.width = w * total + 'px';
    track.querySelectorAll('.hero-slide').forEach(function (s) {
      s.style.flex = '0 0 ' + w + 'px';
      s.style.width = w + 'px';
      s.style.minWidth = w + 'px';
      s.style.maxWidth = w + 'px';
    });
    applyHeroTransform();
  }

  function goTo(idx, dir) {
    syncHeroDom();
    if (total < 1 || !slides[current]) return;
    slides[current].classList.remove('active');
    dots[current] && dots[current].classList.remove('active');
    current = (idx + total) % total;
    slides[current].classList.add('active');
    dots[current] && dots[current].classList.add('active');
    applyHeroTransform();
    startProgress();
  }

  function startProgress() {
    clearInterval(progTimer);
    if(progress) { progress.style.transition='none'; progress.style.width='0%'; }
    setTimeout(function(){
      if(progress) { progress.style.transition='width '+autoMs+'ms linear'; progress.style.width='100%'; }
    }, 30);
  }

  function startAuto() {
    clearInterval(timer);
    if(!paused) {
      timer = setInterval(function(){ goTo(current + 1); }, autoMs);
    }
  }

  function stopAuto() { clearInterval(timer); if(progress){ progress.style.transition='none'; } }

  var mqHeroMobile = window.matchMedia ? window.matchMedia('(max-width: 767px)') : { matches: false, addEventListener: function () {} };
  var mqHeroReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener: function () {} };
  function heroTransitionCss() {
    if (mqHeroReduce.matches) return 'transform .35s ease';
    if (mqHeroMobile.matches) return 'transform .88s cubic-bezier(.22, 1, .36, 1)';
    return 'transform .7s cubic-bezier(.4,0,.2,1)';
  }
  function applyHeroTrackTransition() {
    track.style.transition = heroTransitionCss();
  }
  applyHeroTrackTransition();
  if (window.matchMedia) {
    try {
      mqHeroMobile.addEventListener('change', applyHeroTrackTransition);
      mqHeroReduce.addEventListener('change', applyHeroTrackTransition);
    } catch (e) {
      mqHeroMobile.addListener && mqHeroMobile.addListener(applyHeroTrackTransition);
      mqHeroReduce.addListener && mqHeroReduce.addListener(applyHeroTrackTransition);
    }
  }
  function heroSwipeThresholdPx() {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (mqHeroMobile.matches || coarse) return 28;
    return 40;
  }
  function kickHeroLayout() {
    layoutHeroSlides();
    startProgress();
  }
  kickHeroLayout();
  requestAnimationFrame(function () {
    requestAnimationFrame(kickHeroLayout);
  });
  startAuto();
  window.addEventListener('resize', layoutHeroSlides);
  window.addEventListener('load', kickHeroLayout);

  var sliderEl = document.getElementById('heroSlider');
  if (sliderEl && typeof ResizeObserver !== 'undefined') {
    try {
      var heroRo = new ResizeObserver(function () {
        layoutHeroSlides();
      });
      heroRo.observe(sliderEl);
    } catch (e) {}
  }

  // Buttons
  prevBtn && prevBtn.addEventListener('click', function(){ stopAuto(); goTo(current - 1); startAuto(); });
  nextBtn && nextBtn.addEventListener('click', function(){ stopAuto(); goTo(current + 1); startAuto(); });

  // Dots
  dots.forEach(function(d){ d.addEventListener('click', function(){ stopAuto(); goTo(parseInt(d.dataset.idx)); startAuto(); }); });

  /* سحب أفقي: لمس + فأرة. في صفحة RTL السحب بإصبعك لليمين = الشريحة التالية (عكس نمط iOS الافتراضي) */
  var ptrDown = false;
  var ptrStartX = 0;
  var ptrId = null;
  function heroIsInteractiveTarget(t) {
    /* عقدة نص داخل <a> ليس لها .closest — فيُعتبر الهدف غير تفاعلي ويُخطف السحب فيفشل النقر */
    var el = t && t.nodeType === 1 ? t : (t && t.parentElement) ? t.parentElement : null;
    if (!el || typeof el.closest !== 'function') return false;
    /* بدون هذا: setPointerCapture على السلايدر يخطف الأحداث فلا يُكمَل نقر الروابط/الأزرار */
    return !!el.closest('a, button, input, select, textarea, label, [data-wa-link]');
  }
  function heroSwipeFromDelta(dx) {
    var threshold = heroSwipeThresholdPx();
    if (Math.abs(dx) <= threshold) return;
    stopAuto();
    var next = pageRtl ? dx > 0 : dx < 0;
    goTo(next ? current + 1 : current - 1);
    startAuto();
  }
  sliderEl && sliderEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (heroIsInteractiveTarget(e.target)) return;
    ptrDown = true;
    ptrId = e.pointerId;
    ptrStartX = e.clientX;
    try {
      sliderEl.setPointerCapture(e.pointerId);
    } catch (err) {}
  });
  sliderEl && sliderEl.addEventListener('pointerup', function (e) {
    if (!ptrDown) return;
    if (e.pointerId != null && ptrId != null && e.pointerId !== ptrId) return;
    ptrDown = false;
    ptrId = null;
    heroSwipeFromDelta(e.clientX - ptrStartX);
    try {
      sliderEl.releasePointerCapture(e.pointerId);
    } catch (err) {}
  });
  sliderEl && sliderEl.addEventListener('pointercancel', function (e) {
    ptrDown = false;
    ptrId = null;
    try {
      if (e.pointerId != null) sliderEl.releasePointerCapture(e.pointerId);
    } catch (err) {}
  });

  // Pause on hover
  sliderEl && sliderEl.addEventListener('mouseenter', function(){ paused=true; stopAuto(); clearInterval(progTimer); if(progress){progress.style.transition='none';} });
  sliderEl && sliderEl.addEventListener('mouseleave', function(){ paused=false; startAuto(); startProgress(); });

  // Load slides data from admin (localStorage or API)
  function loadAdminSlides() {
    try {
      // Try localStorage first (saved by HeroSliderAdmin)
      var saved = localStorage.getItem('pharma_hero_slides_v1');
      if(saved) {
        var slides = JSON.parse(saved);
        applyAdminSlides(slides);
        return;
      }
    } catch(e){}
    // Fallback: try API
    try {
      if(!window.SHOP_CONFIG) return;
      if(typeof fetchHomepageSettings !== 'function') return;
      fetchHomepageSettings().then(function(data){
        if(!apiIsSuccess(data) || !data.data || !data.data.settings || !data.data.settings.heroSlides) return;
        var st = data.data.settings;
        var msRaw = st.heroSliderAutoplayMs != null && st.heroSliderAutoplayMs !== '' ? st.heroSliderAutoplayMs : st.heroMs;
        if (msRaw != null && msRaw !== '') {
          var parsedMs = parseInt(msRaw, 10);
          if (Number.isFinite(parsedMs) && parsedMs > 0) autoMs = parsedMs;
        }
        applyAdminSlides(st.heroSlides);
      }).catch(function(){});
    } catch(e){}
  }

  function applyAdminSlides(adminSlides) {
    if(!adminSlides || !adminSlides.length) return;
    var activeSlides = adminSlides.filter(function(s){ return s.active !== false; });
    if(!activeSlides.length) return;

    var bgMap = {
      green: 'radial-gradient(ellipse at 70% 0%,rgba(0,168,110,.22),transparent 60%),radial-gradient(ellipse at 10% 100%,rgba(0,100,68,.28),transparent 55%),linear-gradient(150deg,#0a1628 0%,#0f2744 50%,#0c2e20 100%)',
      purple: 'radial-gradient(ellipse at 30% 20%,rgba(124,58,237,.3),transparent 55%),linear-gradient(150deg,#0a1628 0%,#1a0a2e 50%,#0a1628 100%)',
      orange: 'radial-gradient(ellipse at 60% 30%,rgba(234,88,12,.3),transparent 55%),linear-gradient(150deg,#0a1628 0%,#1f0a00 50%,#0a1628 100%)'
    };
    var accentMap = {
      green: {color:'var(--mint)', grad:'linear-gradient(90deg,var(--mint),#40ffc2,var(--g-xl))'},
      purple: {color:'#c4b5fd', grad:'linear-gradient(90deg,#c4b5fd,#a78bfa,#7c3aed)'},
      orange: {color:'#fdba74', grad:'linear-gradient(90deg,#fdba74,#fb923c,#ea580c)'}
    };
    var btn1BgMap = {
      primary: 'linear-gradient(135deg,var(--g-l),var(--g))',
      purple: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
      orange: 'linear-gradient(135deg,#f97316,#ea580c)'
    };

    var track = document.getElementById('heroSliderTrack');
    var dotsContainer = document.getElementById('heroSliderDots');
    if(!track) return;

    // Rebuild slides
    track.innerHTML = '';
    dotsContainer && (dotsContainer.innerHTML = '');

    var heroConsultWaUrl = '';
    try {
      if (typeof buildWaUrl === 'function' && typeof buildSitePharmacistConsultText === 'function') {
        heroConsultWaUrl = buildWaUrl(buildSitePharmacistConsultText());
      }
    } catch (e) { heroConsultWaUrl = ''; }
    if (!heroConsultWaUrl) {
      var _hp = (window.SHOP_CONFIG && window.SHOP_CONFIG.waPhone) ? window.SHOP_CONFIG.waPhone : '9647711954040';
      heroConsultWaUrl = 'https://wa.me/' + _hp + '?text=' + encodeURIComponent('مرحباً صيدلية شهد محمد، أريد الاستفسار');
    }

    activeSlides.forEach(function(s, i) {
      var bgColor = s.bgColor || 'green';
      var accent = accentMap[bgColor] || accentMap.green;
      var bgGrad = bgMap[bgColor] || bgMap.green;

      // Build title with optional em highlight
      var titleHtml = s.title;
      if(s.titleEm && s.title.includes(s.titleEm)) {
        titleHtml = s.title.replace(s.titleEm, '<em style="font-style:normal;background:'+accent.grad+';-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">'+s.titleEm+'</em>');
      }

      var btn1Link = s.btn1Link === 'wa' ? heroConsultWaUrl : (
        // ✅ FIX: تحقق من الرابط قبل استخدامه — يمنع استخدام الإيموجي كـ URL
        (typeof safeHref === 'function')
          ? safeHref(s.btn1Link, '#prod-sec')
          : (s.btn1Link && (s.btn1Link.startsWith('http') || s.btn1Link.startsWith('/') || s.btn1Link.startsWith('#')) ? s.btn1Link : '#prod-sec')
      );
      var btn1Target = s.btn1Link === 'wa' ? '_blank' : '_self';
      var btn2Link = s.btn2Link === 'wa' ? heroConsultWaUrl : (
        (typeof safeHref === 'function')
          ? safeHref(s.btn2Link, heroConsultWaUrl)
          : heroConsultWaUrl
      );
      var btn2Target = (s.btn2Link === 'wa' || (typeof btn2Link === 'string' && btn2Link.indexOf('https://wa.me') === 0)) ? '_blank' : '_self';
      var btn2ClassExtra = (s.btn2Style === 'wa') ? 'hero-slide__cta--wa' : 'hero-slide__cta--secondary';
      var btn1Bg = btn1BgMap[s.btn1Style||'primary'] || btn1BgMap.primary;
      var btn1Shadow = (s.btn1Style === 'purple')
        ? '0 10px 32px rgba(109,40,217,.48)'
        : ((s.btn1Style === 'orange')
          ? '0 10px 28px rgba(234,88,12,.4)'
          : '0 6px 24px rgba(0,135,90,.35)');

      var safeHeroImg = (s.image && typeof s.image === 'string' && (s.image.startsWith('http://')||s.image.startsWith('https://')||s.image.startsWith('/'))) ? s.image : '';
      /* بدون صورة خلفية: نعرض صورة جانبية من مجلد أقسام الرئيسية (مثل الشرائح الثابتة) — وإلا تختفي بعد استبدال الـ DOM من لوحة التحكم */
      var sideImgPath = '';
      if (!safeHeroImg && s.sideImage !== false) {
        if (s.sideImage && typeof s.sideImage === 'string' && s.sideImage.trim()) {
          sideImgPath = s.sideImage.trim();
        } else {
          var _hc = 'assets/img/home-categories/';
          var _hv = '20260413';
          if (bgColor === 'purple') sideImgPath = _hc + 'vitamin.png?v=' + _hv;
          else if (bgColor === 'orange') sideImgPath = _hc + 'baby.png?v=' + _hv;
          else sideImgPath = _hc + 'medicine.png?v=' + _hv;
        }
      }
      var contentClass = sideImgPath ? 'hero-slide__content hero-slide__content--visual' : 'hero-slide__content';
      var visWrapClass = bgColor === 'purple' ? 'hero-slide__visual hero-slide__visual--violet'
        : (bgColor === 'orange' ? 'hero-slide__visual hero-slide__visual--amber' : 'hero-slide__visual hero-slide__visual--mint');

      var slideHtml = '<div class="hero-slide hero-slide--'+(bgColor)+'" id="heroSlide'+i+'">';
      slideHtml += '<div class="hero-slide__bg">';
      if(safeHeroImg) {
        slideHtml += '<img src="'+escHtml(safeHeroImg)+'" alt="" class="img-cover hero-slide__photo" loading="'+(i===0?'eager':'lazy')+'" decoding="async" fetchpriority="'+(i===0?'high':'low')+'" style="display:block;">';
        slideHtml += '<div style="position:absolute;inset:0;background:'+bgGrad+';opacity:.7;"></div>';
      } else {
        slideHtml += '<div style="position:absolute;inset:0;background:'+bgGrad+';"></div>';
        slideHtml += '<div style="position:absolute;inset:0;background-image:linear-gradient(rgba(0,135,90,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,135,90,.05) 1px,transparent 1px);background-size:52px 52px;"></div>';
      }
      slideHtml += '</div>';
      slideHtml += '<div class="hero-slide__bg-grad"></div>';
      slideHtml += '<div class="'+contentClass+'"><div class="hero-slide__left">';
      slideHtml += '<div class="hero-slide__badge"><span class="hero-slide__badge-dot" style="background:'+accent.color+';"></span><span style="color:'+accent.color+';">'+escHtml(s.badge)+'</span></div>';
      slideHtml += '<h1 class="hero-slide__title">'+titleHtml+'</h1>';
      slideHtml += '<p class="hero-slide__desc">'+escHtml(s.desc)+'</p>';
      slideHtml += '<div class="hero-slide__btns">';
      slideHtml += '<a href="'+escHtml(btn1Link)+'" target="'+btn1Target+'"'+(btn1Target === '_blank' ? ' rel="noopener noreferrer"' : '')+' class="hero-slide__cta" style="background:'+btn1Bg+';color:white;box-shadow:'+btn1Shadow+';">'+escHtml(s.btn1Text)+'</a>';
      slideHtml += '<a href="'+escHtml(btn2Link)+'" target="'+btn2Target+'"'+(btn2Target === '_blank' ? ' rel="noopener noreferrer"' : '')+' class="hero-slide__cta '+btn2ClassExtra+'">'+escHtml(s.btn2Text||'💬 واتساب')+'</a>';
      slideHtml += '</div></div>';
      if (sideImgPath) {
        slideHtml += '<div class="'+visWrapClass+'" aria-hidden="true">';
        slideHtml += '<div class="hero-slide__visual-glow"></div>';
        slideHtml += '<div class="hero-slide__visual-frame">';
        slideHtml += '<img class="hero-slide__visual-img" src="'+escHtml(sideImgPath)+'" alt="" width="520" height="520" decoding="async" loading="'+(i===0?'eager':'lazy')+'"/>';
        slideHtml += '</div></div>';
      }
      slideHtml += '</div></div>';

      var el = document.createElement('div');
      el.innerHTML = slideHtml;
      track.appendChild(el.firstChild);

      // Dot
      if(dotsContainer) {
        var dot = document.createElement('button');
        dot.className = 'hero-slider__dot' + (i===0?' active':'');
        dot.type = 'button';
        dot.dataset.idx = i;
        dot.setAttribute('aria-label', 'الشريحة '+(i+1));
        dotsContainer.appendChild(dot);
      }
    });

    // Re-init slider with new slides
    slides = document.querySelectorAll('.hero-slide');
    dots = document.querySelectorAll('.hero-slider__dot');
    total = slides.length;
    current = 0;
    layoutHeroSlides();
    slides[0] && slides[0].classList.add('active');
    dots[0] && dots[0].classList.add('active');

    // Re-attach dot clicks
    dots.forEach(function(d){ d.addEventListener('click', function(){ stopAuto(); goTo(parseInt(d.dataset.idx)); startAuto(); }); });

    stopAuto(); startAuto(); startProgress();
  }

  function escHtml(str) { return str ? String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

  window.addEventListener('load', function(){ setTimeout(loadAdminSlides, 400); });
})();

/* بانر فيديو الرئيسية — منطق التشغيل هنا ليتوافق مع CSP (بدون سكربت مضمّن في index.html) */
(function () {
  var v = document.getElementById('homeHeroVideo');
  if (!v) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    v.removeAttribute('autoplay');
    try { v.pause(); } catch (e) {}
    return;
  }
  var p = v.play();
  if (p && typeof p.catch === 'function') p.catch(function () {});
})();

window.closeHomeCatSubpanel = function () {};

/* ---------- main.js ---------- */
/* main.js — المنطق الرئيسي للصفحة الرئيسية */
const PRODUCTS_PER_PAGE = 8;
try { window.HOME_ALL_PRODUCTS_PAGE_SIZE = PRODUCTS_PER_PAGE; } catch (e) {}
let _currentPage = 1;
let _filteredProds = [];
let _elProdSec;

function getProdSecEl() {
  if (!_elProdSec) _elProdSec = document.getElementById('prod-sec');
  return _elProdSec;
}

if (typeof subscribeShopState === 'function') {
  subscribeShopState(function (s, meta) {
    if (!meta || meta.view !== 'home') return;
    if (!document.getElementById('pgrid2')) return;
    _filteredProds = s.products;
    if (meta.homePagination) {
      window.__homeProductPagination = meta.homePagination;
      _currentPage = meta.homePagination.page || _currentPage;
      renderProductGrid(_filteredProds, _currentPage, meta.homePagination);
    } else if (window.__homeServerPagination && window.__homeProductPagination) {
      renderProductGrid(_filteredProds, _currentPage, window.__homeProductPagination);
    } else {
      renderProductGrid(_filteredProds, _currentPage);
    }
  });
}

// ──────────────────────────────────────────────
// عرض شبكة المنتجات مع pagination
// ──────────────────────────────────────────────
function updateHomeProductsMetaBar(list, page) {
  const meta = document.getElementById('homeProdMeta');
  if (!meta) return;
  const total = list.length;
  if (!total) {
    meta.textContent = '';
    meta.hidden = true;
    return;
  }
  meta.hidden = false;
  const pages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  const start = (page - 1) * PRODUCTS_PER_PAGE + 1;
  const end = Math.min(page * PRODUCTS_PER_PAGE, total);
  if (pages <= 1) {
    meta.textContent = 'عرض ' + total + ' منتجًا متاحًا للطلب عبر واتساب';
  } else {
    meta.textContent = 'عرض ' + start + '–' + end + ' من ' + total + ' منتجًا · الصفحة ' + page + ' من ' + pages;
  }
}

/** شريط النص عند التصفح من الخادم (page / limit / total) */
function updateHomeProductsMetaBarServer(total, page, totalPages /* , perPage ignored — الشبكة ثابتة PRODUCTS_PER_PAGE */) {
  const meta = document.getElementById('homeProdMeta');
  if (!meta) return;
  /* دائماً حجم صفحة الشبكة في الرئيسية — يمنع عرض «1–12» إذا رجع الخادم per_page أعلى من 8 */
  const lim = PRODUCTS_PER_PAGE;
  if (!total) {
    meta.textContent = '';
    meta.hidden = true;
    return;
  }
  meta.hidden = false;
  const pages = Math.max(1, totalPages || Math.ceil(total / lim));
  const start = (page - 1) * lim + 1;
  const end = Math.min(page * lim, total);
  if (pages <= 1) {
    meta.textContent = 'عرض ' + total + ' منتجًا متاحًا للطلب عبر واتساب';
  } else {
    meta.textContent = 'عرض ' + start + '–' + end + ' من ' + total + ' منتجًا · الصفحة ' + page + ' من ' + pages;
  }
}

/**
 * عناصر الترقيم: أرقام + … عند وجود فجوات (بدل عرض 1..10 كاملة).
 */
function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 1) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages]);
  const win = 2; /* نافذة ±2 ≈ 5 أرقام حول الصفحة الحالية */
  for (let i = currentPage - win; i <= currentPage + win; i++) {
    if (i >= 1 && i <= totalPages) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
}

function buildPagerHtml(currentPage, totalPages) {
  const items = getPaginationItems(currentPage, totalPages);
  const nums = items.map(function (item) {
    if (item === 'ellipsis') {
      return '<span class="pager-ellipsis" aria-hidden="true">…</span>';
    }
    const n = item;
    if (n === currentPage) {
      return '<span class="pager-num pager-num--active" aria-current="page" title="الصفحة الحالية">' + n + '</span>';
    }
    return '<button type="button" class="pager-num" data-action="pager" data-page="' + n + '" aria-label="الذهاب إلى الصفحة ' + n + '">' + n + '</button>';
  }).join('');

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  const prevBtn = prevDisabled
    ? '<span class="pager-nav pager-nav--prev pager-nav--disabled" aria-disabled="true"><span class="pager-nav__ico" aria-hidden="true">&gt;</span></span>'
    : '<button type="button" class="pager-nav pager-nav--prev" data-action="pager" data-page="' + (currentPage - 1) + '" aria-label="الصفحة السابقة"><span class="pager-nav__ico" aria-hidden="true">&gt;</span></button>';
  const nextBtn = nextDisabled
    ? '<span class="pager-nav pager-nav--next pager-nav--disabled" aria-disabled="true"><span class="pager-nav__ico" aria-hidden="true">&lt;</span></span>'
    : '<button type="button" class="pager-nav pager-nav--next" data-action="pager" data-page="' + (currentPage + 1) + '" aria-label="الصفحة التالية"><span class="pager-nav__ico" aria-hidden="true">&lt;</span></button>';

  return (
    '<div class="pager-wrap pager-wrap--numbered" role="navigation" aria-label="تصفح الصفحات" dir="rtl">' +
    prevBtn +
    '<div class="pager-nums" role="group" aria-label="أرقام الصفحات">' +
    nums +
    '</div>' +
    nextBtn +
    '</div>'
  );
}

function renderProductGrid(list, page, pagMeta) {
  const grid  = document.getElementById('pgrid2');
  const pager = document.getElementById('pgrid2Pager');
  if (!grid) return;

  const serverPag = pagMeta && typeof pagMeta.total === 'number';
  let pageItems;
  let totalPages;

  if (serverPag) {
    /* شبكة الرئيسية (#pgrid2): دائماً PRODUCTS_PER_PAGE — حتى لا يُعرض 12 إذا رجع الخادم/الحالة per_page أعلى */
    const per = PRODUCTS_PER_PAGE;
    const raw = Array.isArray(list) ? list : [];
    pageItems = raw.slice(0, per);
    const tot = pagMeta.total;
    totalPages = tot > 0 ? Math.max(1, Math.ceil(tot / per)) : 0;
    if (tot > 0) {
      updateHomeProductsMetaBarServer(tot, page, totalPages, per);
    } else {
      updateHomeProductsMetaBar([], 1);
    }
  } else {
    const start = (page - 1) * PRODUCTS_PER_PAGE;
    pageItems = (Array.isArray(list) ? list : []).slice(start, start + PRODUCTS_PER_PAGE);
    totalPages = Math.max(1, Math.ceil((Array.isArray(list) ? list.length : 0) / PRODUCTS_PER_PAGE));
    updateHomeProductsMetaBar(Array.isArray(list) ? list : [], page);
  }

  pageItems = (Array.isArray(pageItems) ? pageItems : []).slice(0, PRODUCTS_PER_PAGE);

  if (!pageItems.length) {
    renderEmptyState(grid, 'لا توجد منتجات تطابق البحث');
    if (!serverPag) updateHomeProductsMetaBar([], 1);
    if (serverPag && pagMeta && pagMeta.total === 0) updateHomeProductsMetaBar([], 1);
    if (pager) replaceChildrenFromHtml(pager, '');
    return;
  }

  replaceChildrenFromHtml(grid, pageItems.map(p => buildProductCardHtml(p)).join(''));
  grid.removeAttribute('aria-busy');

  const reveals = grid.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); obs.unobserve(x.target); } });
    }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => { if (!el.classList.contains('in')) obs.observe(el); });
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  if (pager) {
    if (totalPages <= 1) {
      replaceChildrenFromHtml(pager, '');
      return;
    }
    replaceChildrenFromHtml(pager, buildPagerHtml(page, totalPages));
  }
}

async function goPage(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n < 1) return;

  if (typeof __pharmaStoreHtmlFile === 'function' && __pharmaStoreHtmlFile() === 'index.html' && window.__homeServerPagination && window.__homeProductPagination) {
    const hp = window.__homeProductPagination;
    const perHome = PRODUCTS_PER_PAGE;
    const maxP = hp.total > 0 ? Math.max(1, Math.ceil(hp.total / perHome)) : hp.total_pages > 0 ? hp.total_pages : 0;
    if (n > maxP) return;
    var fullOrder = window.__homeGridFullOrder;
    if (Array.isArray(fullOrder) && fullOrder.length > 0) {
      const products = fullOrder.slice((n - 1) * perHome, n * perHome).slice(0, perHome);
      const pag = { page: n, per_page: perHome, total: hp.total, total_pages: maxP };
      _currentPage = pag.page;
      window.__homeProductPagination = pag;
      if (typeof setShopProducts === 'function') {
        setShopProducts(products, { view: 'home', homePagination: pag });
      }
      getProdSecEl()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (typeof showLoader === 'function') showLoader();
    try {
      const r = await apiFetch('getProducts', { active: 1, page: n, per_page: perHome });
      if (typeof apiIsSuccess === 'function' && !apiIsSuccess(r)) throw new Error('api');
      if (!r || !r.data) throw new Error('api');
      const products = (typeof coerceApiArray === 'function' ? coerceApiArray : function (x) { return Array.isArray(x) ? x : []; })(
        typeof pickAdminProductsFromData === 'function' ? pickAdminProductsFromData(r.data) : []
      ).map(function (x) {
        return typeof normalizeProductFromApi === 'function' ? normalizeProductFromApi(x) : x;
      });
      var pag = typeof pickProductsPaginationFromData === 'function' ? pickProductsPaginationFromData(r.data) : null;
      if (!pag) {
        pag = { page: n, per_page: perHome, total: hp.total, total_pages: maxP };
      } else {
        pag.per_page = perHome;
        pag.total = hp.total;
        pag.total_pages = maxP;
        pag.page = n;
      }
      _currentPage = pag.page;
      window.__homeProductPagination = pag;
      if (typeof setShopProducts === 'function') {
        setShopProducts(products.slice(0, perHome), { view: 'home', homePagination: pag });
      }
    } catch (e) {
      if (typeof pharmaLogError === 'function') pharmaLogError('[goPage]', e);
      if (typeof showToast === 'function') showToast('تعذر تحميل الصفحة', 'error');
    } finally {
      if (typeof hideLoader === 'function') hideLoader();
    }
    getProdSecEl()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const pages = Math.max(1, Math.ceil(_filteredProds.length / PRODUCTS_PER_PAGE));
  if (n > pages) return;
  _currentPage = n;
  renderProductGrid(_filteredProds, n);
  getProdSecEl()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ──────────────────────────────────────────────
// تهيئة الصفحة الرئيسية
// ──────────────────────────────────────────────
if (__pharmaStoreHtmlFile() === 'index.html') {
window.initHome = async function initHome() {
  const grid = document.getElementById('pgrid2');

  // 1. عرض skeleton فوراً — بدون showLoader() حتى لا يغطي #_globalLoader (z-index 9000) الهيرو والسلايدر
  if (grid) renderSkeletons(grid, 8);

  try {
    // 2. تحميل كل البيانات بالتوازي — Promise.allSettled يمنع توقف الكل عند فشل طلب واحد
    const data = await loadHomepageData();

    // 3. تطبيق الإعدادات
    if (data.settings) Object.assign(settings, data.settings);
    applySettings();
    initShopChrome();
    initImageFallbacks();

    // 4. بناء واجهة التنقل
    buildNav(data.categories);
    buildFooterCats(data.categories);

    // 5. المنتجات — ترتيب عشوائي لكل تحميل؛ الترقيم من المصفوفة الكاملة (انظر loadHomepageData)
    var hp = data.productPagination;
    if (hp && typeof hp === 'object' && typeof hp.total === 'number' && hp.total > 0) {
      hp.per_page = PRODUCTS_PER_PAGE;
      hp.total_pages = Math.max(1, Math.ceil(hp.total / PRODUCTS_PER_PAGE));
    }
    window.__homeGridFullOrder = Array.isArray(data.homeGridFull) && data.homeGridFull.length ? data.homeGridFull : null;
    window.__homeServerPagination = !!(hp && hp.total > 0 && hp.total_pages >= 1);
    window.__homeProductPagination = hp || null;
    _currentPage = hp && hp.page ? hp.page : 1;
    var firstPageProds = Array.isArray(data.products) ? data.products.slice(0, PRODUCTS_PER_PAGE) : data.products;
    if (typeof setShopProducts === 'function') {
      setShopProducts(firstPageProds, { view: 'home', homePagination: hp });
    } else {
      firstPageProds.forEach(p => prods.push(p));
      _filteredProds = firstPageProds;
      renderProductGrid(firstPageProds, _currentPage, window.__homeServerPagination ? hp : undefined);
    }

    if (typeof renderHomeExtras === 'function') {
      renderHomeExtras(Object.assign({}, data, {
        products: Array.isArray(data.allProductsForExtras) && data.allProductsForExtras.length
          ? data.allProductsForExtras
          : data.products
      }));
    }

    /* 7. كشف العناصر .reveal المحقونة بعد التحميل */
    if (typeof window.initScrollReveal === 'function') window.initScrollReveal();

  } catch (e) {
    if (typeof pharmaLogError === 'function') pharmaLogError('[main] initHome', e);
    if (typeof showToast === 'function') {
      showToast('تعذر تحميل الصفحة. حاول تحديث الصفحة.', 'error');
    }
    // fallback — تهيئة الواجهة بدون بيانات
    applySettings();
    initShopChrome();
    if (typeof buildNav === 'function') buildNav([]);
    if (grid) renderEmptyState(grid, 'حدث خطأ في تحميل المنتجات. يرجى تحديث الصفحة.');
    if (typeof updateHomeProductsMetaBar === 'function') updateHomeProductsMetaBar([], 1);
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
  }
};
}

window.goPage          = goPage;
window.renderProductGrid = renderProductGrid;

/**
 * سلايدر «الأكثر طلباً»: تكرار شرائح حتى يصبح عرض المسار ≥ ضعف عرض المنطقة الظاهرة
 * (يمنع الفراغ عندما يكون عدد البطاقات قليلاً أو الشاشة عريضة — الصفحة RTL والمسار LTR).
 */
function homeHotMarqueeEnsureWide() {
  var viewport = document.getElementById('homeTopOrderedGrid');
  if (!viewport || viewport.classList.contains('home-hot-slider__viewport--static')) return;
  var track = viewport.querySelector('.home-hot-slider__track');
  if (!track || track.classList.contains('home-hot-slider__track--static')) return;
  var vw = Math.max(1, viewport.clientWidth);
  var target = vw * 2 + 48;
  var guard = 0;
  while (track.scrollWidth < target && guard < 36) {
    var proto = track.querySelector('.home-hot-slider__segment');
    if (!proto) return;
    var clone = proto.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
    guard++;
  }
}

/**
 * مسافة انتقال الحلقة = عرض شريحة واحدة + gap (بكسل) — يجب أن تطابق حركة translateX حتى لا يظهر فراغ.
 */
function homeHotMarqueeApplyShift() {
  var viewport = document.getElementById('homeTopOrderedGrid');
  if (!viewport || viewport.classList.contains('home-hot-slider__viewport--static')) return;
  var track = viewport.querySelector('.home-hot-slider__track');
  if (!track || track.classList.contains('home-hot-slider__track--static')) return;
  var segs = track.querySelectorAll('.home-hot-slider__segment');
  if (segs.length < 2) return;
  var s0 = segs[0];
  var s1 = segs[1];
  var shift = Math.round(s1.offsetLeft - s0.offsetLeft);
  if (shift <= 0) {
    var r0 = s0.getBoundingClientRect();
    var r1 = s1.getBoundingClientRect();
    shift = Math.round(r1.left - r0.left);
  }
  if (shift <= 0) {
    var gs = getComputedStyle(track);
    var g = parseFloat(gs.columnGap || gs.gap) || 18;
    shift = Math.round(s0.getBoundingClientRect().width + g);
  }
  if (shift > 0) {
    track.style.setProperty('--home-hot-shift', shift + 'px');
  }
}

function homeHotMarqueeSync() {
  homeHotMarqueeEnsureWide();
  homeHotMarqueeApplyShift();
}
window.homeHotMarqueeApplyShift = homeHotMarqueeApplyShift;
window.homeHotMarqueeEnsureWide = homeHotMarqueeEnsureWide;
window.homeHotMarqueeSync = homeHotMarqueeSync;

function homeHotMarqueeBindResizeObserver() {
  if (typeof ResizeObserver === 'undefined' || window.__pharmaHomeHotROBound) return;
  var vp = document.getElementById('homeTopOrderedGrid');
  if (!vp) return;
  window.__pharmaHomeHotROBound = true;
  var ro = new ResizeObserver(function () {
    if (typeof homeHotMarqueeSync === 'function') homeHotMarqueeSync();
  });
  ro.observe(vp);
  window.__pharmaHomeHotRO = ro;
}

if (typeof __pharmaStoreHtmlFile === 'function' && __pharmaStoreHtmlFile() === 'index.html') {
  if (!window.__pharmaHomeHotResizeBound) {
    window.__pharmaHomeHotResizeBound = true;
    var _homeHotResize = function () {
      if (typeof homeHotMarqueeSync === 'function') homeHotMarqueeSync();
    };
    var _deb = typeof debounce === 'function' ? debounce(_homeHotResize, 200) : _homeHotResize;
    window.addEventListener('resize', _deb, { passive: true });
    function _hotMarqueeOnLoad() {
      if (typeof homeHotMarqueeSync === 'function') homeHotMarqueeSync();
      homeHotMarqueeBindResizeObserver();
    }
    if (document.readyState === 'complete') {
      setTimeout(_hotMarqueeOnLoad, 0);
    } else {
      window.addEventListener('load', _hotMarqueeOnLoad, { passive: true });
    }
  }
}

function renderHomeExtras(data) {
  const s = (data && data.settings) ? data.settings : {};
  const tag = document.getElementById('p-logo-tagline');
  if (tag && s.tagline) tag.textContent = s.tagline;
  const faqList = document.getElementById('homeFaqList');
  if (faqList && Array.isArray(s.faq) && s.faq.length) {
    faqList.innerHTML = s.faq.map(function (item, i) {
      if (!item || !item.q) return '';
      var op = i === 0 ? ' open' : '';
      return '<details class="faq-item"' + op + '><summary>' + escHtml(item.q) + '</summary><p>' + escHtml(item.a || '') + '</p></details>';
    }).join('');
  }
  const topSec = document.getElementById('home-top-ordered-sec');
  const topGrid = document.getElementById('homeTopOrderedGrid');
  function isHiddenFromHome(p) {
    var h = p && p.hide_from_home;
    return h === true || h === 1 || h === '1';
  }
  const prods = (data && data.products)
    ? data.products.filter(function (p) {
      if (p.active === false) return false;
      return !isHiddenFromHome(p);
    })
    : [];
  const ranked = prods.slice().sort(function (a, b) {
    const wa = (b.wa_order_count || 0) - (a.wa_order_count || 0);
    if (wa !== 0) return wa;
    return (b.badge === 'pb-hot' ? 1 : 0) - (a.badge === 'pb-hot' ? 1 : 0);
  });
  const HOT_MAX = 6;
  const top = ranked.slice(0, HOT_MAX);

  if (topSec && topGrid && top.length && typeof buildProductCardHtml === 'function') {
    topSec.hidden = false;
    var cardsHtml = top.map(function (p, i) {
      return buildProductCardHtml(p, {
        trustStrip: true,
        bestseller: i < 3,
        waProminent: true,
        size: 'hot'
      });
    }).join('');
    var reduceMotion = false;
    try {
      reduceMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* ignore */ }
    var trackHtml;
    try {
      window.__homeHotMarqueeChunkHtml = cardsHtml;
    } catch (e) { /* ignore */ }
    if (reduceMotion) {
      trackHtml =
        '<div class="home-hot-slider__track home-hot-slider__track--static" role="list">' +
        '<div class="home-hot-slider__segment" role="presentation">' +
        cardsHtml +
        '</div></div>';
      topGrid.classList.add('home-hot-slider__viewport--static');
    } else {
      /* شريحتان متطابقتان؛ يُكرَّر المزيد في DOM حتى يملأ عرض الشاشة مرتين (بدون فراغ) */
      trackHtml =
        '<div class="home-hot-slider__track" role="list">' +
        '<div class="home-hot-slider__segment" role="presentation">' +
        cardsHtml +
        '</div>' +
        '<div class="home-hot-slider__segment" aria-hidden="true">' +
        cardsHtml +
        '</div></div>';
      topGrid.classList.remove('home-hot-slider__viewport--static');
    }
    replaceChildrenFromHtml(topGrid, trackHtml);
    if (!reduceMotion) {
      homeHotMarqueeBindResizeObserver();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (typeof homeHotMarqueeSync === 'function') homeHotMarqueeSync();
        });
      });
      setTimeout(function () {
        if (typeof homeHotMarqueeSync === 'function') homeHotMarqueeSync();
      }, 450);
      setTimeout(function () {
        if (typeof homeHotMarqueeSync === 'function') homeHotMarqueeSync();
      }, 1200);
    }
  }

  if (top.length && typeof initScrollReveal === 'function') initScrollReveal();
}
window.renderHomeExtras = renderHomeExtras;

if (__pharmaStoreHtmlFile() === 'qr-discount.html') {
  (async function initQrDiscountLanding() {
    var grid = document.getElementById('qrProductGrid');
    var emptyEl = document.getElementById('qrEmpty');
    var countdownEl = document.getElementById('qrCountdown');
    var bannerActivate = document.getElementById('qrOfferActivateBanner');

    if (typeof showLoader === 'function') showLoader();
    try {
      var sd = await apiFetch('getSettings');
      if (sd && apiIsSuccess(sd) && sd.data && sd.data.settings) {
        mergeSettingsFromApi(sd.data.settings);
      }
      if (typeof applySettings === 'function') applySettings();
      if (typeof applyShopPageFooterFromSettings === 'function') applyShopPageFooterFromSettings();
      if (typeof initShopChrome === 'function') initShopChrome();
      if (typeof initImageFallbacks === 'function') initImageFallbacks();

      await loadProducts(true);
      var all = Array.isArray(window.prods) ? window.prods.slice() : [];
      var filtered = all.filter(function (p) {
        if (p.active === false) return false;
        return typeof isProductCategoryEligibleForQrShelfPromo === 'function' && isProductCategoryEligibleForQrShelfPromo(p);
      });

      function tickCountdown() {
        if (!countdownEl) return;
        if (typeof isOfferQrFlowActive === 'function' && isOfferQrFlowActive()) {
          var r = localStorage.getItem('expiry');
          var end = r != null ? parseInt(r, 10) : NaN;
          if (Number.isFinite(end) && end > Date.now()) {
            var rem = end - Date.now();
            var totalSec = Math.floor(rem / 1000);
            var m = Math.floor(totalSec / 60);
            var secs = totalSec % 60;
            var mm = String(m).padStart(2, '0');
            var ss = String(secs).padStart(2, '0');
            countdownEl.innerHTML = '<span class="qr-lp-countdown__label">ينتهي العرض خلال</span> <strong class="qr-lp-countdown__digits">' + mm + ':' + ss + '</strong>';
            countdownEl.classList.toggle('qr-lp-countdown--urgent', totalSec <= 300 && totalSec > 0);
            if (bannerActivate) bannerActivate.hidden = true;
            return;
          }
        }
        countdownEl.classList.remove('qr-lp-countdown--urgent');
        countdownEl.innerHTML = '<span class="qr-lp-countdown__na">انتهى الوقت — أعد مسح رمز QR مرة أخرى</span>';
        if (bannerActivate) bannerActivate.hidden = false;
      }
      tickCountdown();
      window.setInterval(tickCountdown, 1000);

      function renderCard(p) {
        return typeof buildProductCardHtml === 'function' ? buildProductCardHtml(p) : '';
      }

      if (!grid) return;
      if (!filtered.length) {
        grid.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
      } else {
        if (emptyEl) emptyEl.hidden = true;
        grid.innerHTML = filtered.map(renderCard).join('');
      }
      grid.setAttribute('aria-busy', 'false');
      if (typeof initScrollReveal === 'function') initScrollReveal();
    } catch (e) {
      if (typeof pharmaLogError === 'function') pharmaLogError('[qr-discount]', e);
      if (typeof showToast === 'function') showToast('تعذر تحميل العروض', 'error');
      if (grid) grid.setAttribute('aria-busy', 'false');
    } finally {
      if (typeof hideLoader === 'function') hideLoader();
    }
  })();
}

