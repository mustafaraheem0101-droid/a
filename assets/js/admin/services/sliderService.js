/**
 * sliderService.js — خدمة إدارة السلايدرات
 */
'use strict';

(function (global) {
  function af(action, data, method) {
    return global.adminFetch(action, data || {}, method || 'POST');
  }

  async function fetchAll() {
    try {
      var r = await af('admin_get_sliders', {}, 'GET');
      if (global.apiIsSuccess(r) && r.data && Array.isArray(r.data.sliders)) {
        return { ok: true, sliders: r.data.sliders };
      }
      return { ok: false, message: global.apiErrorMessage ? global.apiErrorMessage(r) : 'فشل جلب السلايدرات' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function addSlider(data) {
    try {
      var r = await af('admin_add_slider', data, 'POST');
      return { ok: global.apiIsSuccess(r), message: r.message || '', id: r.data && r.data.id };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function updateSlider(data) {
    try {
      var r = await af('admin_update_slider', data, 'POST');
      return { ok: global.apiIsSuccess(r), message: r.message || '' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function deleteSlider(id) {
    try {
      var r = await af('admin_delete_slider', { id: id }, 'POST');
      return { ok: global.apiIsSuccess(r), message: r.message || '' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function toggleSlider(id, active) {
    try {
      var r = await af('admin_toggle_slider', { id: id, active: active ? 1 : 0 }, 'POST');
      return { ok: global.apiIsSuccess(r), message: r.message || '' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function reorderSliders(ids) {
    try {
      var r = await af('admin_reorder_sliders', { ids: ids }, 'POST');
      return { ok: global.apiIsSuccess(r), message: r.message || '' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  async function uploadImage(file) {
    try {
      var fd = new FormData();
      fd.append('image', file);
      var csrf = global.adminApiGetCsrf ? global.adminApiGetCsrf() : '';
      if (csrf) fd.append('_csrf', csrf);

      var resp = await fetch('/api.php?action=upload_slider_image', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd
      });
      var json = await resp.json();
      if (global.apiIsSuccess(json) && json.data && json.data.url) {
        return { ok: true, url: json.data.url };
      }
      return { ok: false, message: json.message || 'فشل رفع الصورة' };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }

  if (!global.AdminServices) { global.AdminServices = {}; }
  global.AdminServices.sliderService = {
    fetchAll: fetchAll,
    addSlider: addSlider,
    updateSlider: updateSlider,
    deleteSlider: deleteSlider,
    toggleSlider: toggleSlider,
    reorderSliders: reorderSliders,
    uploadImage: uploadImage
  };
})(typeof window !== 'undefined' ? window : global);
