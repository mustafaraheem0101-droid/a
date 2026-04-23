/**
 * QR discount landing — product card motion (GSAP + ScrollTrigger)
 * - Staggered fade + slide up; parallax on .pc-img
 * - Optional: magnetic + 3D tilt + focus + dynamic shadow (fine pointer only; see buildPremiumTilt)
 */
(function initQrDiscountCardMotion() {
  'use strict';

  var GRID_ID = 'qrProductGrid';
  var DONE_KEY = '__qrDiscountGsapDone';
  var initialized = false;
  var gridObserver = null;
  // Matches :root --qr-sh on qr-discount.html
  var DEFAULT_SH =
    '0 12px 40px rgba(12, 18, 34, 0.09), 0 2px 8px rgba(12, 18, 34, 0.04)';
  var FOCUS_O = 0.66;
  var TILT_MAX = 6;
  var MAG_MAX = 7;
  var LIFT_PX = 5;
  var SCALE_H = 1.01;

  function getGrid() {
    return document.getElementById(GRID_ID);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isFinePointer() {
    return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function isNarrow() {
    return window.matchMedia && window.matchMedia('(max-width: 519px)').matches;
  }

  function getProductCards(grid) {
    return grid.querySelectorAll('.pc.pc--product:not(.pc--skel)');
  }

  function prepareCardsForGsap(cards) {
    if (typeof gsap === 'undefined') return;
    gsap.set(cards, { opacity: 0, y: 26 });
  }

  function stripRevealClasses(cards) {
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('reveal', 'in');
    }
  }

  function runEntranceAnimation(grid, cards) {
    gsap.to(cards, {
      opacity: 1,
      y: 0,
      duration: 0.55,
      ease: 'power2.out',
      stagger: { each: 0.075, from: 'start' },
      scrollTrigger: {
        trigger: grid,
        start: 'top 90%',
        once: true
      }
    });
  }

  function addParallax(cards) {
    var yRange = isNarrow() ? 5 : 10;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var media = card.querySelector('.pc-img');
      if (!media) continue;
      gsap.fromTo(
        media,
        { y: yRange },
        {
          y: -yRange,
          ease: 'none',
          scrollTrigger: {
            trigger: card,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.55
          }
        }
      );
    }
  }

  /**
   * Soft shadow that shifts with tilt (very subtle, premium)
   */
  function makeShadow(rotateX, rotateY) {
    var oy = 10 + (Math.abs(rotateX) + Math.abs(rotateY)) * 0.12;
    var ox = -rotateY * 0.55;
    var bl = 32 + (Math.abs(rotateX) + Math.abs(rotateY)) * 0.4;
    var g = 0.12 + (Math.abs(rotateX) + Math.abs(rotateY)) * 0.006;
    return (
      '0 ' +
      oy.toFixed(1) +
      'px ' +
      bl.toFixed(0) +
      'px rgba(12, 18, 34, 0.1), ' +
      ox.toFixed(1) +
      'px ' +
      (oy * 0.55).toFixed(1) +
      'px 22px rgba(5, 150, 105, ' +
      g.toFixed(2) +
      ')'
    );
  }

  /**
   * magnetic + 3D tilt + focus + dynamic shadow, gsap.quickTo for smooth follow
   */
  function buildPremiumTilt(grid, cardList) {
    if (typeof gsap === 'undefined' || !isFinePointer() || isNarrow() || !cardList.length) return;
    if (typeof gsap.quickTo !== 'function') return;

    var cards = Array.prototype.slice.call(cardList, 0);
    grid.classList.add('qr-pc-3d');
    for (var k = 0; k < cards.length; k++) {
      cards[k].classList.add('qr-pc--motion');
    }
    gsap.set(cards, { transformPerspective: 1000, transformOrigin: '50% 50% 0' });
    for (k = 0; k < cards.length; k++) {
      (function (card) {
        var xTo = gsap.quickTo(card, 'x', { duration: 0.5, ease: 'power2.out' });
        var yTo = gsap.quickTo(card, 'y', { duration: 0.5, ease: 'power2.out' });
        var sTo = gsap.quickTo(card, 'scale', { duration: 0.38, ease: 'power2.out' });
        var rxTo = gsap.quickTo(card, 'rotationX', { duration: 0.45, ease: 'power2.out' });
        var ryTo = gsap.quickTo(card, 'rotationY', { duration: 0.45, ease: 'power2.out' });
        var hovered = false;
        var rafId = 0;
        var pending = null;

        function doShadow(rx, ry) {
          if (!hovered) return;
          if (card.style) card.style.boxShadow = makeShadow(rx, ry);
        }
        function scheduleShadow(rx, ry) {
          pending = { x: rx, y: ry };
          if (rafId) return;
          rafId = requestAnimationFrame(function () {
            rafId = 0;
            if (pending) doShadow(pending.x, pending.y);
            pending = null;
          });
        }

        function onMove(e) {
          if (!hovered) return;
          var r = card.getBoundingClientRect();
          var nxa = (e.clientX - r.left) / r.width - 0.5;
          var nya = (e.clientY - r.top) / r.height - 0.5;
          var mX = nxa * 2 * MAG_MAX;
          var mY = nya * 2 * MAG_MAX - LIFT_PX;
          var rY = nxa * 2 * TILT_MAX;
          var rX = -nya * 2 * TILT_MAX;
          xTo(mX);
          yTo(mY);
          rxTo(rX);
          ryTo(rY);
          sTo(SCALE_H);
          scheduleShadow(rX, rY);
        }

        function onEnter() {
          hovered = true;
          card.classList.add('qr-pc--active');
          var i, o;
          for (i = 0; i < cards.length; i++) {
            o = cards[i];
            if (o === card) continue;
            gsap.to(o, { opacity: FOCUS_O, duration: 0.22, ease: 'power1.out' });
          }
          gsap.to(card, { opacity: 1, duration: 0.18, ease: 'power1.out' });
        }

        function resetLeave() {
          hovered = false;
          card.classList.remove('qr-pc--active');
          xTo(0);
          yTo(0);
          rxTo(0);
          ryTo(0);
          sTo(1);
          if (card.style) card.style.boxShadow = DEFAULT_SH;
          for (var i2 = 0; i2 < cards.length; i2++) {
            gsap.to(cards[i2], { opacity: 1, duration: 0.32, ease: 'power2.out' });
          }
        }

        card.addEventListener('pointerenter', onEnter);
        card.addEventListener('pointermove', onMove, { passive: true });
        card.addEventListener('pointerleave', resetLeave, { passive: true });
        if (card.style) card.style.boxShadow = DEFAULT_SH;
      })(cards[k]);
    }
  }

  function onLibsReady() {
    if (initialized) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window[DONE_KEY]) return;

    var grid = getGrid();
    if (!grid || grid.getAttribute('aria-busy') === 'true') return;

    var cards = getProductCards(grid);
    if (!cards.length) return;

    initialized = true;
    window[DONE_KEY] = true;

    if (prefersReducedMotion()) {
      stripRevealClasses(cards);
      for (var j = 0; j < cards.length; j++) {
        cards[j].style.opacity = '1';
        cards[j].style.transform = 'none';
      }
      if (gridObserver) {
        try {
          gridObserver.disconnect();
        } catch (e) { /* no-op */ }
        gridObserver = null;
      }
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    prepareCardsForGsap(cards);
    stripRevealClasses(cards);

    runEntranceAnimation(grid, cards);
    addParallax(cards);
    buildPremiumTilt(grid, cards);

    function refresh() {
      if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
        ScrollTrigger.refresh();
      }
    }
    if (document.readyState === 'complete') {
      requestAnimationFrame(refresh);
    } else {
      window.addEventListener('load', function onLoad() {
        window.removeEventListener('load', onLoad);
        requestAnimationFrame(refresh);
      });
    }
    if (gridObserver) {
      try {
        gridObserver.disconnect();
      } catch (e2) { /* no-op */ }
      gridObserver = null;
    }
  }

  function tryStart() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    onLibsReady();
  }

  var g = getGrid();
  if (g) {
    gridObserver = new MutationObserver(function () {
      tryStart();
    });
    gridObserver.observe(g, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-busy']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryStart);
  } else {
    tryStart();
  }
  window.addEventListener('load', tryStart);
})();
