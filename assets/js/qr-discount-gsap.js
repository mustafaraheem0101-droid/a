/**
 * QR discount landing — product card motion (GSAP + ScrollTrigger)
 * - Staggered fade + slide up on first scroll-into-view
 * - Parallax on .pc-img (container) — keeps .pc-img-el free for CSS hover scale
 * - Respects prefers-reduced-motion; lighter parallax on small viewports
 */
(function initQrDiscountCardMotion() {
  'use strict';

  var GRID_ID = 'qrProductGrid';
  var DONE_KEY = '__qrDiscountGsapDone';
  var initialized = false;
  var gridObserver = null;

  function getGrid() {
    return document.getElementById(GRID_ID);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isNarrow() {
    return window.matchMedia && window.matchMedia('(max-width: 519px)').matches;
  }

  function getProductCards(grid) {
    return grid.querySelectorAll('.pc.pc--product:not(.pc--skel)');
  }

  /**
   * When IO-based `.reveal` is removed, cards would jump to full opacity; set GSAP
   * state first in the same synchronous block to avoid a flash.
   */
  function prepareCardsForGsap(cards) {
    if (typeof gsap === 'undefined') return;
    gsap.set(cards, { opacity: 0, y: 26 });
  }

  function stripRevealClasses(cards) {
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('reveal', 'in');
    }
  }

  /** Reveal on scroll: fade in + move up, staggered */
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

  /**
   * Subtle vertical parallax on the image *container* (not the <img>).
   * Scrubbed scroll-linked motion — uses transform on .pc-img only, so existing
   * .pc-img-el hover scale in shop CSS stays smooth.
   */
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

    // Images / fonts can shift layout; refresh triggers once the page is stable
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
      } catch (e) { /* no-op */ }
      gridObserver = null;
    }
  }

  function tryStart() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    onLibsReady();
  }

  // If GSAP fails to load, .reveal + app.js initScrollReveal() (IntersectionObserver) still applies .in in view.

  // Wait for getSettings + products async in main.js (grid fills after)
  var grid = getGrid();
  if (grid) {
    gridObserver = new MutationObserver(function () {
      tryStart();
    });
    gridObserver.observe(grid, {
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
