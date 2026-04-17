/**
 * صفحة عرض/خصم (QR) — حالة الجلسة والكونفيتي.
 * استدعاءات الخادم: استخدم assets/js/api.js أو الوحدة assets/js/modules/pharma-http.js عند الترحيل لـ type="module".
 *
 * رمز صفحة العرض — يجب أن يطابق query ?token=...
 * غيّر القيمة وحدّث روابط الـ QR لاستخدام نفس الرمز.
 */
var OFFER_PAGE_TOKEN = "pharma-offer-qr-v1";

/** يُضبط بعد أول توليد ناجح في هذه الجلسة — يمنع إعادة السحب حتى لو عُدّل localStorage. */
var OFFER_SESSION_USED_KEY = "used";

function isOfferPageTokenValid() {
  try {
    var q = new URLSearchParams(window.location.search);
    var t = q.get("token");
    if (t == null || String(t).trim() === "") return false;
    return String(t).trim() === OFFER_PAGE_TOKEN;
  } catch (e) {
    return false;
  }
}

(function () {
  try {
    var exp = localStorage.getItem("expiry");
    var expMs = exp != null ? parseInt(exp, 10) : NaN;
    var expValid = Number.isFinite(expMs) && Date.now() < expMs;
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

/**
 * إن وُجد خصم محفوظ ضمن جلسة العرض ولم ينتهِ — يُعاد الرقم ولا يُعاد توليد خصم جديد.
 */
function readPersistedOfferDiscount() {
  try {
    if (sessionStorage.getItem("activeOffer") !== "true") return null;
    if (localStorage.getItem("fromOffer") !== "true") return null;
    var raw = localStorage.getItem("discount");
    if (raw == null || String(raw).trim() === "") return null;
    var n = parseInt(raw, 10);
    if (Number.isNaN(n) || n <= 0) return null;
    var exp = localStorage.getItem("expiry");
    var expMs = exp != null ? parseInt(exp, 10) : NaN;
    if (!Number.isFinite(expMs) || Date.now() >= expMs) return null;
    return n;
  } catch (e) {
    return null;
  }
}

/** اختيار نسبة خصم حسب احتمالات مرجّحة (الأعلى أندر). */
function pickWeightedDiscountPercent() {
  var r = Math.random() * 100;
  if (r < 40) return 5;
  if (r < 65) return 10;
  if (r < 80) return 15;
  if (r < 90) return 20;
  if (r < 97) return 25;
  return 30;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

/** كونفيتي خفيف — لا يعيق النقرات (pointer-events: none على الطبقة). */
function launchOfferConfetti() {
  if (prefersReducedMotion()) return;
  var layer = document.createElement("div");
  layer.className = "offer-confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  var colors = ["#22c55e", "#f59e0b", "#ec4899", "#3b82f6", "#eab308", "#a855f7", "#ef4444"];
  var n = 42;
  var i;
  for (i = 0; i < n; i++) {
    var piece = document.createElement("span");
    piece.className = "offer-confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.background = colors[i % colors.length];
    var dur = 1.5 + Math.random() * 1.35;
    var dx = (Math.random() * 200 - 100).toFixed(1) + "px";
    var rot = Math.floor(360 + Math.random() * 720) + "deg";
    piece.style.setProperty("--dx", dx);
    piece.style.setProperty("--rot", rot);
    piece.style.animation = "offer-confetti-fall " + dur + "s linear forwards";
    piece.style.animationDelay = Math.random() * 0.25 + "s";
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  window.setTimeout(function () {
    if (layer.parentNode) layer.parentNode.removeChild(layer);
  }, Math.ceil(3200));
}

/** نغمة فوز قصيرة (Web Audio) — لا ملفات خارجية؛ يعمل بعد تفاعل المستخدم. */
function playWinChime() {
  if (prefersReducedMotion()) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    function ding() {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      var t0 = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, t0);
      osc.frequency.exponentialRampToValueAtTime(783.99, t0 + 0.1);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.start(t0);
      osc.stop(t0 + 0.24);
    }
    var p = ctx.resume ? ctx.resume() : Promise.resolve();
    p.then(ding).catch(ding);
  } catch (e) { /* ignore */ }
}

function restartPctAnimation(el) {
  if (!el) return;
  el.classList.remove("pct--animate");
  void el.offsetWidth;
  el.classList.add("pct--animate");
}

document.addEventListener("DOMContentLoaded", function () {
  var revealBtn = document.getElementById("revealBtn");
  var intro = document.getElementById("intro");
  var result = document.getElementById("result");
  var pctEl = document.getElementById("pct");
  var useDiscountBtn = document.getElementById("useDiscountBtn");
  var deniedEl = document.getElementById("offerDenied");

  if (!isOfferPageTokenValid()) {
    if (intro) intro.classList.add("hidden");
    if (result) result.classList.add("hidden");
    if (deniedEl) deniedEl.classList.remove("hidden");
    return;
  }

  if (deniedEl) deniedEl.classList.add("hidden");

  var offerSessionLockEl = document.getElementById("offerSessionLock");
  if (offerSessionLockEl) offerSessionLockEl.classList.add("hidden");

  if (revealBtn && intro && result && pctEl) {
    var existingPct = readPersistedOfferDiscount();
    var sessionWheelUsed = sessionStorage.getItem(OFFER_SESSION_USED_KEY) === "true";

    if (existingPct != null) {
      pctEl.textContent = String(existingPct);
      intro.classList.add("hidden");
      result.classList.remove("hidden");
      revealBtn.disabled = true;
      revealBtn.setAttribute("aria-disabled", "true");
      revealBtn.classList.add("hidden");
      window.requestAnimationFrame(function () {
        restartPctAnimation(pctEl);
      });
    } else if (sessionWheelUsed) {
      intro.classList.add("hidden");
      result.classList.add("hidden");
      revealBtn.disabled = true;
      revealBtn.setAttribute("aria-disabled", "true");
      revealBtn.classList.add("hidden");
      if (offerSessionLockEl) offerSessionLockEl.classList.remove("hidden");
    } else {
      revealBtn.addEventListener("click", function () {
        if (sessionStorage.getItem(OFFER_SESSION_USED_KEY) === "true") {
          return;
        }

        revealBtn.classList.add("btn-shake");
        window.setTimeout(function () {
          revealBtn.classList.remove("btn-shake");
        }, 480);

        var pct = pickWeightedDiscountPercent();
        pctEl.textContent = String(pct);
        try {
          localStorage.setItem("discount", String(pct));
          localStorage.setItem("expiry", String(Date.now() + 30 * 60 * 1000));
          localStorage.setItem("fromOffer", "true");
          sessionStorage.setItem("activeOffer", "true");
          sessionStorage.setItem(OFFER_SESSION_USED_KEY, "true");
        } catch (e) {}

        revealBtn.disabled = true;
        revealBtn.setAttribute("aria-disabled", "true");

        launchOfferConfetti();
        playWinChime();

        window.setTimeout(function () {
          intro.classList.add("hidden");
          result.classList.remove("hidden");
          revealBtn.classList.add("hidden");
          window.requestAnimationFrame(function () {
            restartPctAnimation(pctEl);
          });
        }, 260);
      });
    }
  }

  if (useDiscountBtn) {
    useDiscountBtn.addEventListener("click", function () {
      try {
        window.location.href = new URL("qr-discount.html", String(window.location.href)).href;
      } catch (e) {
        window.location.href = "qr-discount.html";
      }
    });
  }
});
