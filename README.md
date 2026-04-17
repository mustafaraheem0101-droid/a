# صيدلية شهد محمد — v2.0

متجر صيدلانية متكامل بـ PHP/MySQL مع واجهة HTML ثابتة.

## الشروع السريع

```bash
# 1. انسخ .env.example إلى .env وعدّل القيم
cp .env.example .env

# 2. أضف مفاتيح API قوية في .env
# PUBLIC_API_KEY=pub_...
# ADMIN_API_KEY=adm_...

# 3. أنشئ قاعدة MySQL ونفّذ schema
mysql -u user -p db_name < sql/schema_v2.sql

# 4. افتح المتجر
# الصفحة الرئيسية: index.html
# لوحة الإدارة: login.php
```

## اختبارات الوحدة (PHPUnit)

```bash
composer install
vendor/bin/phpunit
```

لا تحتاج MySQL — تغطي حالياً منطق تجميع `admin_get_customers` (`includes/orders_customers_aggregate.php`).

## التوثيق

- [الإعداد والنشر](SETUP.md)
- [هيكل المشروع](docs/ARCHITECTURE.md)
- [الأمان](docs/SECURITY.md)
- [ملاحظات الترقية](UPGRADE_NOTES.md)

## ما الجديد في v2.0

| التحسين | التفاصيل |
|---------|----------|
| تفكيك api.php | 5 handlers منفصلة بدلاً من 1177 سطر في ملف واحد |
| إصلاح مفاتيح API | لا توليد عشوائي — يتوقف إذا لم تُضبط في .env |
| CSS موحّد | `pharma-bundle.css` بدلاً من 6 ملفات |
| CSP headers | حماية XSS إضافية |
| Gzip في .htaccess | ضغط تلقائي يُوفّر 65% من حجم النقل |
| Schema v2 | أعمدة منفصلة للمنتجات + FULLTEXT search |
| نظام Migrations | تتبع تحديثات قاعدة البيانات |
