/**
 * صفحة shop-products — منطق العرض والخصم.
 * للاستدعاءات المركزية للـ API انظر assets/js/api.js أو assets/js/modules/ (ES modules).
 */
(function () {
  try {
    var exp0 = localStorage.getItem("expiry");
    var expMs0 = exp0 != null ? parseInt(exp0, 10) : NaN;
    var expValid = Number.isFinite(expMs0) && Date.now() < expMs0;
    var fromOffer = localStorage.getItem("fromOffer") === "true";
    var raw = localStorage.getItem("discount");
    var n = raw != null ? parseInt(raw, 10) : NaN;
    var discValid = raw != null && String(raw).trim() !== "" && !Number.isNaN(n) && n > 0;
    if (fromOffer && expValid && discValid) {
      sessionStorage.setItem("activeOffer", "true");
      return;
    }
    localStorage.removeItem("discount");
    localStorage.removeItem("expiry");
    localStorage.removeItem("fromOffer");
    sessionStorage.removeItem("activeOffer");
  } catch (e) {}
})();

document.addEventListener("DOMContentLoaded", function () {
  /** رقم واتساب الصيدلية (بدون + أو مسافات) */
  var WHATSAPP_NUMBER = "9647711954040";

  var PRODUCTS = [
    { id: 1, name: "باراسيتامول 500 مجم — 20 قرص", price: 18.5 },
    { id: 2, name: "مضاد حموضة سائل — 200 مل", price: 24 },
    { id: 3, name: "فيتامين د3 — 1000 وحدة — 30 كبسولة", price: 45 },
    { id: 4, name: "معقم يدين — 500 مل", price: 32 },
    { id: 5, name: "شامبو طبي ضد القشرة — 200 مل", price: 39.75 },
    { id: 6, name: "مرطب صيدلاني للبشرة الحساسة — 400 مل", price: 28 },
    { id: 7, name: "مكمل أوميغا 3 — 60 كبسولة", price: 85 },
    { id: 8, name: "بخاخ أنف ملحي — 50 مل", price: 22.5 }
  ];

  var bannerEl = document.getElementById("banner");
  var bannerContentEl = document.getElementById("bannerContent");
  var listEl = document.getElementById("productList");
  var countdownTimerId = null;

  if (!bannerEl || !bannerContentEl || !listEl) {
    console.error("shop-products: missing required DOM elements");
    return;
  }

  function getExpiryMs() {
    var raw = localStorage.getItem("expiry");
    if (raw === null || raw === "") return NaN;
    var n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function readStoredDiscount() {
    var raw = localStorage.getItem("discount");
    if (raw === null || raw === "") return 10;
    var n = parseInt(raw, 10);
    if (Number.isNaN(n)) return 10;
    return Math.min(100, Math.max(0, n));
  }

  function formatMoney(n) {
    var num = Number(n);
    if (!Number.isFinite(num)) return "0";
    try {
      return num.toLocaleString("ar-IQ") + " د.ع";
    } catch (e) {
      return String(Math.round(num * 100) / 100) + " د.ع";
    }
  }

  function priceAfterDiscount(original, pct) {
    return Math.round(original * (1 - pct / 100) * 100) / 100;
  }

  /** نفس هيكل رسالة عرض QR (صفحة منتجات العرض) — فقط عندما fromOffer === "true" والخصم > 0 */
  function buildQrOfferWhatsAppText(name, listPrice, lineAfter) {
    var lines = [];
    lines.push("مرحبا 👋");
    lines.push("أرغب بطلب المنتجات التالية:");
    lines.push("");
    lines.push("🛒 الطلب:");
    lines.push("");
    lines.push("* " + name);
    lines.push("  السعر: " + formatMoney(lineAfter));
    lines.push("  السعر قبل الخصم: " + formatMoney(listPrice));
    lines.push("");
    lines.push("💰 المجموع: " + formatMoney(lineAfter));
    lines.push("");
    lines.push("🎁 تم استخدام خصم QR Code");
    lines.push("");
    lines.push("📍 الرجاء تأكيد توفر المنتجات وإتمام الطلب");
    lines.push("شكراً لكم 🙏");
    return lines.join("\n");
  }

  function buildNormalWhatsAppText(name, price) {
    var lines = [];
    lines.push("مرحبا 👋");
    lines.push("أرغب بطلب المنتجات التالية:");
    lines.push("");
    lines.push("🛒 الطلب:");
    lines.push("");
    lines.push("* " + name);
    lines.push("  السعر: " + formatMoney(price));
    lines.push("  السعر قبل الخصم: " + formatMoney(price));
    lines.push("");
    lines.push("💰 المجموع: " + formatMoney(price));
    lines.push("");
    lines.push("📍 الرجاء تأكيد توفر المنتجات وإتمام الطلب");
    lines.push("شكراً لكم 🙏");
    return lines.join("\n");
  }

  function openWhatsApp(text) {
    var digits = String(WHATSAPP_NUMBER).replace(/\D/g, "");
    var url = "https://wa.me/" + digits + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderBannerCountdown(expiryMs) {
    var remaining = expiryMs - Date.now();
    if (remaining <= 0) {
      return true;
    }
    var totalSec = Math.max(0, Math.floor(remaining / 1000));
    var mins = Math.floor(totalSec / 60);
    var secs = totalSec % 60;
    var mm = String(mins).padStart(2, "0");
    var ss = String(secs).padStart(2, "0");
    var urgent = remaining <= 5 * 60 * 1000;
    bannerEl.classList.toggle("banner--urgent", urgent);
    bannerContentEl.innerHTML =
      '<span class="banner-timer">⏳ باقي ' +
      mm +
      ":" +
      ss +
      '</span><span class="banner-warn"' +
      (urgent ? "" : ' style="display:none"') +
      ">🔴 العرض على وشك الانتهاء!</span>";
    return false;
  }

  function renderBannerExpired() {
    bannerEl.classList.add("banner--expired");
    bannerContentEl.textContent = "⛔ انتهى العرض";
  }

  function clearCountdownTimer() {
    if (countdownTimerId !== null) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
    }
  }

  function renderProducts(discount) {
    listEl.innerHTML = "";
    PRODUCTS.forEach(function (p) {
      var newPrice = priceAfterDiscount(p.price, discount);

      var card = document.createElement("article");
      card.className = "card";
      card.setAttribute("data-id", String(p.id));

      var title = document.createElement("h2");
      title.className = "card-title";
      title.textContent = p.name;

      var prices = document.createElement("div");
      prices.className = "prices";

      if (discount === 0) {
        var only = document.createElement("span");
        only.className = "price-only";
        only.textContent = formatMoney(p.price) + " ر.س";
        prices.appendChild(only);
      } else {
        var oldSpan = document.createElement("span");
        oldSpan.className = "price-old";
        oldSpan.textContent = formatMoney(p.price) + " ر.س";

        var newSpan = document.createElement("span");
        newSpan.className = "price-new";
        newSpan.textContent = formatMoney(newPrice) + " ر.س";

        prices.appendChild(oldSpan);
        prices.appendChild(newSpan);
      }

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-order";
      btn.textContent = "اطلب عبر واتساب";

      btn.addEventListener("click", function () {
        var fromOffer = false;
        try {
          fromOffer = localStorage.getItem("fromOffer") === "true";
        } catch (e) {}
        var msg;
        if (fromOffer && discount > 0) {
          msg = buildQrOfferWhatsAppText(p.name, p.price, newPrice);
        } else {
          msg = buildNormalWhatsAppText(p.name, p.price);
        }
        openWhatsApp(msg);
      });

      card.appendChild(title);
      card.appendChild(prices);
      card.appendChild(btn);
      listEl.appendChild(card);
    });
  }

  function clearOfferKeys() {
    try {
      localStorage.removeItem("discount");
      localStorage.removeItem("expiry");
      localStorage.removeItem("fromOffer");
      sessionStorage.removeItem("activeOffer");
    } catch (e) {}
  }

  function renderNoPromoState() {
    clearCountdownTimer();
    bannerEl.classList.remove("banner--expired", "banner--urgent");
    bannerEl.style.display = "none";
    bannerContentEl.innerHTML = "";
    renderProducts(0);
  }

  function renderExpiredState() {
    clearCountdownTimer();
    clearOfferKeys();
    bannerEl.style.display = "";
    bannerEl.classList.remove("banner--urgent");
    bannerEl.classList.add("banner--expired");
    renderBannerExpired();
    renderProducts(0);
  }

  function renderActiveState(expiryMs) {
    bannerEl.style.display = "";
    bannerEl.classList.remove("banner--expired");
    var discount = readStoredDiscount();
    if (renderBannerCountdown(expiryMs)) {
      renderExpiredState();
      return;
    }

    renderProducts(discount);

    clearCountdownTimer();
    countdownTimerId = setInterval(function () {
      var rem = expiryMs - Date.now();
      if (rem <= 0) {
        renderExpiredState();
        return;
      }
      if (renderBannerCountdown(expiryMs)) {
        renderExpiredState();
      }
    }, 1000);
  }

  function init() {
    if (sessionStorage.getItem("activeOffer") !== "true" || localStorage.getItem("fromOffer") !== "true") {
      renderNoPromoState();
      return;
    }
    var expiryMs = getExpiryMs();
    if (!Number.isFinite(expiryMs) || Date.now() >= expiryMs) {
      renderExpiredState();
      return;
    }
    renderActiveState(expiryMs);
  }

  init();
});
