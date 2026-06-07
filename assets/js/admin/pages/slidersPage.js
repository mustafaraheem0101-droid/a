/**
 * slidersPage.js — إدارة السلايدرات (ديسكتوب + موبايل)
 */
'use strict';

(function (global) {

  function createSlidersPage(deps) {
    var sliderService = deps.sliderService;

    var _sliders = [];
    var _editId   = null; // null = إضافة جديدة، رقم = تعديل

    /* ══════════════════════════════════
       مساعدات DOM
    ══════════════════════════════════ */
    function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
    function toast(msg, ok) {
      if (typeof global.showToast === 'function') { global.showToast(msg, ok ? 'success' : 'error'); return; }
      var el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.className = 'toast show' + (ok === false ? ' toast-error' : '');
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.className = 'toast'; }, 3000);
    }

    /* ══════════════════════════════════
       جلب وعرض القائمة
    ══════════════════════════════════ */
    async function loadSliders() {
      var wrap = document.getElementById('sliders-list');
      if (!wrap) return;
      wrap.innerHTML = '<div class="sl-loading">جاري التحميل...</div>';

      var res = await sliderService.fetchAll();
      if (!res.ok) {
        wrap.innerHTML = '<div class="sl-empty">⚠️ ' + (res.message || 'تعذر تحميل السلايدرات') + '</div>';
        return;
      }
      _sliders = res.sliders;
      renderList();
    }

    function renderList() {
      var wrap = document.getElementById('sliders-list');
      if (!wrap) return;

      if (!_sliders.length) {
        wrap.innerHTML = '<div class="sl-empty">لا توجد سلايدرات بعد — أضف أول سلايدر!</div>';
        return;
      }

      var html = _sliders.map(function (sl) {
        var thumbD = sl.img_desktop
          ? '<img src="' + escHtmlAttr(sl.img_desktop) + '" alt="desktop" class="sl-thumb" onerror="this.style.display=\'none\'">'
          : '<div class="sl-thumb-empty"><span>🖥️</span><small>لا توجد صورة</small></div>';
        var thumbM = sl.img_mobile
          ? '<img src="' + escHtmlAttr(sl.img_mobile) + '" alt="mobile" class="sl-thumb sl-thumb-mobile" onerror="this.style.display=\'none\'">'
          : '<div class="sl-thumb-empty sl-thumb-empty-sm"><span>📱</span><small>لا توجد صورة</small></div>';

        var activeClass = sl.active ? 'sl-badge-active' : 'sl-badge-inactive';
        var activeLabel = sl.active ? 'نشط' : 'معطل';

        return '<div class="sl-card" data-id="' + sl.id + '">' +
          '<div class="sl-drag-handle" title="اسحب لإعادة الترتيب">⠿</div>' +
          '<div class="sl-thumbs">' +
            '<div class="sl-thumb-wrap">' + thumbD + '<div class="sl-thumb-label">ديسكتوب</div></div>' +
            '<div class="sl-thumb-wrap">' + thumbM + '<div class="sl-thumb-label">موبايل</div></div>' +
          '</div>' +
          '<div class="sl-info">' +
            '<div class="sl-title">' + escHtml(sl.title || 'بدون عنوان') + '</div>' +
            (sl.link_url ? '<div class="sl-link">' + escHtml(sl.link_url) + '</div>' : '') +
          '</div>' +
          '<div class="sl-actions">' +
            '<span class="sl-badge ' + activeClass + '">' + activeLabel + '</span>' +
            '<button class="sl-btn sl-btn-toggle" data-id="' + sl.id + '" data-active="' + (sl.active ? 1 : 0) + '" title="' + (sl.active ? 'إيقاف' : 'تفعيل') + '">' +
              (sl.active ? '⏸ إيقاف' : '▶ تفعيل') +
            '</button>' +
            '<button class="sl-btn sl-btn-edit" data-id="' + sl.id + '">✏️ تعديل</button>' +
            '<button class="sl-btn sl-btn-delete" data-id="' + sl.id + '">🗑️ حذف</button>' +
          '</div>' +
        '</div>';
      }).join('');

      wrap.innerHTML = html;

      // ربط الأحداث
      wrap.querySelectorAll('.sl-btn-edit').forEach(function (btn) {
        btn.addEventListener('click', function () { openModal(parseInt(this.dataset.id)); });
      });
      wrap.querySelectorAll('.sl-btn-delete').forEach(function (btn) {
        btn.addEventListener('click', function () { confirmDelete(parseInt(this.dataset.id)); });
      });
      wrap.querySelectorAll('.sl-btn-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id     = parseInt(this.dataset.id);
          var active = parseInt(this.dataset.active) === 1;
          doToggle(id, !active);
        });
      });

      // Sortable
      if (typeof Sortable !== 'undefined') {
        Sortable.create(wrap, {
          handle: '.sl-drag-handle',
          animation: 180,
          onEnd: function () {
            var ids = Array.from(wrap.querySelectorAll('.sl-card')).map(function (c) {
              return parseInt(c.dataset.id);
            });
            sliderService.reorderSliders(ids).then(function (r) {
              if (r.ok) toast('تم حفظ الترتيب', true);
            });
          }
        });
      }
    }

    /* ══════════════════════════════════
       مودال الإضافة / التعديل
    ══════════════════════════════════ */
    function openModal(id) {
      _editId = id != null ? id : null;
      var modal = document.getElementById('slider-modal');
      if (!modal) return;

      var sl = id != null ? _sliders.find(function (s) { return s.id === id; }) : null;

      qs('#sm-title',       modal).value   = sl ? (sl.title    || '') : '';
      qs('#sm-link',        modal).value   = sl ? (sl.link_url || '') : '';
      qs('#sm-alt',         modal).value   = sl ? (sl.alt_text || '') : '';
      qs('#sm-sort',        modal).value   = sl ? sl.sort_order : 0;
      qs('#sm-active',      modal).checked = sl ? sl.active : true;
      qs('#sm-desktop-url', modal).value   = sl ? (sl.img_desktop || '') : '';
      qs('#sm-mobile-url',  modal).value   = sl ? (sl.img_mobile  || '') : '';

      // معاينة الصور الحالية
      updatePreview('desktop', sl ? sl.img_desktop : '');
      updatePreview('mobile',  sl ? sl.img_mobile  : '');

      qs('#slider-modal-title', modal).textContent = id != null ? 'تعديل السلايدر' : 'إضافة سلايدر جديد';
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      var modal = document.getElementById('slider-modal');
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = '';
      _editId = null;
    }

    function updatePreview(type, url) {
      var prev = document.getElementById('sm-' + type + '-preview');
      if (!prev) return;
      if (url) {
        prev.innerHTML = '<img src="' + escHtmlAttr(url) + '" alt="preview" onerror="this.parentElement.innerHTML=\'<span class=sl-no-img>تعذر تحميل الصورة</span>\'">';
      } else {
        prev.innerHTML = '<span class="sl-no-img">' + (type === 'desktop' ? '🖥️ لا توجد صورة' : '📱 لا توجد صورة') + '</span>';
      }
    }

    /* ══════════════════════════════════
       حفظ
    ══════════════════════════════════ */
    async function saveModal() {
      var modal = document.getElementById('slider-modal');
      if (!modal) return;

      var data = {
        title:       qs('#sm-title',       modal).value.trim(),
        link_url:    qs('#sm-link',        modal).value.trim(),
        alt_text:    qs('#sm-alt',         modal).value.trim(),
        sort_order:  parseInt(qs('#sm-sort', modal).value) || 0,
        active:      qs('#sm-active', modal).checked ? 1 : 0,
        img_desktop: qs('#sm-desktop-url', modal).value.trim(),
        img_mobile:  qs('#sm-mobile-url',  modal).value.trim()
      };

      if (!data.img_desktop && !data.img_mobile) {
        toast('يجب إدخال صورة الديسكتوب أو الموبايل على الأقل', false);
        return;
      }

      var saveBtn = qs('#sm-save-btn', modal);
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ...'; }

      var res;
      if (_editId != null) {
        data.id = _editId;
        res = await sliderService.updateSlider(data);
      } else {
        res = await sliderService.addSlider(data);
      }

      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'حفظ'; }

      if (res.ok) {
        toast(_editId != null ? 'تم تعديل السلايدر بنجاح' : 'تمت إضافة السلايدر بنجاح', true);
        closeModal();
        loadSliders();
      } else {
        toast(res.message || 'حدث خطأ', false);
      }
    }

    /* ══════════════════════════════════
       رفع صورة
    ══════════════════════════════════ */
    async function handleImageUpload(type, file) {
      if (!file) return;
      var btn = document.getElementById('sm-' + type + '-upload-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'جاري الرفع...'; }

      var res = await sliderService.uploadImage(file);

      if (btn) { btn.disabled = false; btn.textContent = 'رفع صورة'; }

      if (res.ok) {
        var urlInput = document.getElementById('sm-' + type + '-url');
        if (urlInput) urlInput.value = res.url;
        updatePreview(type, res.url);
        toast('تم رفع الصورة بنجاح', true);
      } else {
        toast(res.message || 'فشل رفع الصورة', false);
      }
    }

    /* ══════════════════════════════════
       حذف
    ══════════════════════════════════ */
    async function confirmDelete(id) {
      var sl = _sliders.find(function (s) { return s.id === id; });
      var name = sl ? (sl.title || 'هذا السلايدر') : 'هذا السلايدر';
      if (!confirm('هل تريد حذف "' + name + '"؟')) return;

      var res = await sliderService.deleteSlider(id);
      if (res.ok) {
        toast('تم حذف السلايدر', true);
        loadSliders();
      } else {
        toast(res.message || 'فشل الحذف', false);
      }
    }

    /* ══════════════════════════════════
       تبديل الحالة
    ══════════════════════════════════ */
    async function doToggle(id, active) {
      var res = await sliderService.toggleSlider(id, active);
      if (res.ok) {
        loadSliders();
      } else {
        toast(res.message || 'فشل التحديث', false);
      }
    }

    /* ══════════════════════════════════
       escape HTML helpers
    ══════════════════════════════════ */
    function escHtml(s) {
      if (!s) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    function escHtmlAttr(s) { return escHtml(s); }

    /* ══════════════════════════════════
       mount / unmount
    ══════════════════════════════════ */
    function mount() {
      var container = document.getElementById('page-sliders');
      if (!container) return;
      container.style.display = '';

      // زر إضافة
      var addBtn = document.getElementById('sliders-add-btn');
      if (addBtn) {
        addBtn.onclick = function () { openModal(null); };
      }

      // مودال: أزرار
      var closeBtn = document.getElementById('sm-close-btn');
      if (closeBtn) closeBtn.onclick = closeModal;

      var cancelBtn = document.getElementById('sm-cancel-btn');
      if (cancelBtn) cancelBtn.onclick = closeModal;

      var saveBtn = document.getElementById('sm-save-btn');
      if (saveBtn) saveBtn.onclick = saveModal;

      // إغلاق بالنقر خارج المودال
      var modal = document.getElementById('slider-modal');
      if (modal) {
        modal.addEventListener('click', function (e) {
          if (e.target === modal) closeModal();
        });
      }

      // رفع صور — ديسكتوب
      var dInput = document.getElementById('sm-desktop-file');
      if (dInput) {
        dInput.onchange = function () {
          if (this.files && this.files[0]) handleImageUpload('desktop', this.files[0]);
        };
      }
      var dBtn = document.getElementById('sm-desktop-upload-btn');
      if (dBtn) {
        dBtn.onclick = function () {
          var fi = document.getElementById('sm-desktop-file');
          if (fi) fi.click();
        };
      }

      // رفع صور — موبايل
      var mInput = document.getElementById('sm-mobile-file');
      if (mInput) {
        mInput.onchange = function () {
          if (this.files && this.files[0]) handleImageUpload('mobile', this.files[0]);
        };
      }
      var mBtn = document.getElementById('sm-mobile-upload-btn');
      if (mBtn) {
        mBtn.onclick = function () {
          var fi = document.getElementById('sm-mobile-file');
          if (fi) fi.click();
        };
      }

      // تحديث المعاينة عند تغيير الرابط يدوياً
      var dUrl = document.getElementById('sm-desktop-url');
      if (dUrl) dUrl.addEventListener('input', function () { updatePreview('desktop', this.value.trim()); });
      var mUrl = document.getElementById('sm-mobile-url');
      if (mUrl) mUrl.addEventListener('input', function () { updatePreview('mobile', this.value.trim()); });

      loadSliders();
    }

    function unmount() {
      var container = document.getElementById('page-sliders');
      if (container) container.style.display = 'none';
      closeModal();
    }

    return { mount: mount, unmount: unmount };
  }

  if (!global.AdminPages) { global.AdminPages = {}; }
  global.AdminPages.createSlidersPage = createSlidersPage;

})(typeof window !== 'undefined' ? window : global);
