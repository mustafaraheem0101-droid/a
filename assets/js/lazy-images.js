(function () {
  function markLoaded(ev) {
    ev.target.classList.add('loaded');
  }
  function wireLoaded(img) {
    if (img.complete && img.naturalHeight > 0) img.classList.add('loaded');
    else img.addEventListener('load', markLoaded, { once: true });
  }
  document.querySelectorAll('img[loading="lazy"]').forEach(wireLoaded);

  // للمتصفحات القديمة التي لا تدعم loading="lazy"
  if ('loading' in HTMLImageElement.prototype) return;

  const images = document.querySelectorAll('img[loading="lazy"]');
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src || img.src;
          observer.unobserve(img);
        }
      });
    },
    { rootMargin: '200px' }
  );

  images.forEach(function (img) {
    observer.observe(img);
  });
})();
