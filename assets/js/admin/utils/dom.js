/**
 * dom.js — تخزين مؤقت لعناصر شائعة وتفادي استعلامات متكررة
 */
'use strict';

(function (global) {
  var cache = Object.create(null);

  function byId(id) {
    if (!cache[id]) {
      cache[id] = document.getElementById(id);
    }
    return cache[id];
  }

  function invalidate(id) {
    if (id) delete cache[id];
    else cache = Object.create(null);
  }

  global.AdminDom = {
    byId: byId,
    invalidate: invalidate
  };
})(typeof window !== 'undefined' ? window : global);
