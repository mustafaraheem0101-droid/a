# وحدات JavaScript (ES Modules)

## `pharma-http.js`

دوال مساعدة لاستدعاء `api.php` بصيغة JSON. **لا تُحمّل تلقائياً** في الصفحات الحالية؛ الصفحات تستخدم `assets/js/api.js` بدون modules.

### مثال في HTML

```html
<script type="module">
  import { pharmaFetchJson } from './assets/js/modules/pharma-http.js';

  pharmaFetchJson('api.php', { action: 'categories', active: '1' })
    .then((r) => console.log(r.data))
    .catch((e) => console.error(e.message));
</script>
```

### ملاحظات

- المسار النسبي لـ `import` يعتمد على موضع صفحة HTML؛ اضبطه حسب المجلد (مثلاً `../assets/js/modules/...` من مجلد فرعي).
- للتوافق مع المتصفحات القديمة بدون modules، استمر باستخدام `api.js`.

## التوسع المستقبلي

- تقسيم `api.js` تدريجياً إلى وحدات: `config`, `http`, `catalog`.
- أداة بناء (Vite/Rollup) إذا زاد عدد الوحدات أو رغبت بـ tree-shaking.
