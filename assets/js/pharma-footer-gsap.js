/**
 * Subtle scroll reveal for the premium shop footer (GSAP + ScrollTrigger)
 * Fails open: if GSAP is missing, a class is set so static CSS can show the footer.
 */
(function initPharmaFooterGsap() {
  'use strict';

  var F_ID = 'footer';
  var DONE = '__pharmaFooterGsapDone';

  function prefersReduce() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setFailVisible(footer) {
    if (!footer) return;
    footer.classList.add('p-footer--gsap-fail');
  }

  function onReady() {
    if (window[DONE]) return;
    var footer = document.getElementById(F_ID);
    if (!footer || !footer.classList.contains('p-footer--animate')) return;
    if (prefersReduce()) {
      window[DONE] = true;
      footer.classList.add('p-footer--gsap-on');
      return;
    }
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      setFailVisible(footer);
      return;
    }

    window[DONE] = true;

    gsap.registerPlugin(ScrollTrigger);

    var parts = footer.querySelectorAll('.p-footer-reveal');
    if (!parts || !parts.length) {
      footer.classList.add('p-footer--gsap-on');
      return;
    }

    gsap.fromTo(
      parts,
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.1,
        scrollTrigger: {
          trigger: footer,
          start: 'top 90%',
          once: true
        },
        onComplete: function onComplete() {
          gsap.set(parts, { clearProps: 'all' });
          footer.classList.add('p-footer--gsap-on');
          if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
            ScrollTrigger.refresh();
          }
        }
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
  window.addEventListener('load', onReady);
})();
