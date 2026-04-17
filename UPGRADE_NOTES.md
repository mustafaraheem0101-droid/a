# ملاحظات الترقية — النسخة 2.0

## ما الجديد في v2.0

### 1. تفكيك api.php إلى Handlers (✅ مكتمل)
`api.php` الآن موجّه فقط (router) — كل المنطق في:
- `includes/api/handlers/products.php`
- `includes/api/handlers/categories.php`
- `includes/api/handlers/orders.php`
- `includes/api/handlers/reviews.php`
- `includes/api/handlers/misc.php`

**لإضافة action جديد:** أنشئ دالة في الـ handler المناسب وأضف اسمه إلى قائمة الـ actions في `api.php`.

### 2. إصلاح مشكلة المفاتيح العشوائية (✅ مكتمل)
**قبل:** إذا لم يُضبط `PUBLIC_API_KEY` في `.env`، كان يُولَّد عشوائياً في كل طلب.
**بعد:** الخادم يتوقف في الإنتاج ويعرض خطأ واضحاً. في التطوير يستخدم مفاتيح ثابتة مع تحذير.

**الإجراء المطلوب:** أضف إلى `.env`:
```
PUBLIC_API_KEY=pub_استبدل_هذا_بمفتاح_عشوائي
ADMIN_API_KEY=adm_استبدل_هذا_بمفتاح_عشوائي
```
لتوليد مفتاح: `php -r "echo 'pub_' . bin2hex(random_bytes(20)) . PHP_EOL;"`

### 3. دمج ملفات CSS (✅ مكتمل)
**قبل:** 6 ملفات CSS = 6 HTTP requests
**بعد:** ملف واحد `pharma-bundle.css`

**لتحديث HTML:** استبدل كل وسوم `<link>` للـ CSS المنفصلة بـ:
```html
<link rel="stylesheet" href="/assets/css/pharma-bundle.css?v=2.0">
```
الملفات القديمة لا تزال موجودة للتوافق، يمكن حذفها لاحقاً.

### 4. إضافة CSP Headers (✅ مكتمل)
- `api.php`: `Content-Security-Policy: default-src 'none'` (API لا يُعرض HTML)
- `.htaccess`: CSP كامل لصفحات HTML مع استثناءات للمكتبات المستخدمة

### 5. Schema v2 — أعمدة منفصلة للمنتجات (✅ مكتمل)
ملف `sql/schema_v2.sql` يحتوي على تصميم جديد لجدول `pharma_products` بأعمدة:
`name`, `price`, `category_slug`, `active`, `slug`, `product_type`, `is_rx`, `stock`, `wa_count`

**ملاحظة:** الانتقال للـ schema الجديد يتطلب migration للبيانات الحالية. راجع `includes/migrations.php`.

### 6. نظام Migrations (✅ مكتمل)
`includes/migrations.php` يوفر:
- `pharma_run_migration()` — يُشغّل migration إذا لم يُطبَّق بعد
- `pharma_run_pending_migrations()` — يُشغّل كل الـ migrations المعلّقة
- جدول `pharma_migrations` لتتبع الإصدارات المطبّقة

### 7. Gzip وCache Headers (✅ مكتمل)
`.htaccess` الجديد يتضمن:
- ضغط Gzip لـ HTML/CSS/JS/JSON (توفير ~65%)
- Cache لمدة سنة للصور والخطوط
- Cache لمدة شهر للـ CSS والـ JS

## خطوات الترقية على السيرفر

1. **نسخة احتياطية** من الملفات وقاعدة البيانات.
2. **رفع الملفات الجديدة** (api.php + includes/api/handlers/ + .htaccess + CSS bundle).
3. **تحديث .env** بإضافة `PUBLIC_API_KEY` و `ADMIN_API_KEY`.
4. **تحديث HTML** لاستخدام `pharma-bundle.css` (اختياري، الملفات القديمة لا تزال تعمل).
5. **تشغيل migrations** (اختياري لـ schema v2):
   ```php
   require_once 'includes/migrations.php';
   $results = pharma_run_pending_migrations($pdo);
   ```

## توافق

- PHP 8.0+ (لا تغيير)
- MySQL 5.7+ / MariaDB 10.3+ (لا تغيير)
- الـ API متوافق مع الإصدار السابق — نفس endpoints، نفس format الاستجابة
