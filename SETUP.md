# صيدلية شهد محمد — دليل الإعداد والنشر

## المتطلبات

| المتطلب | ملاحظات |
|---------|---------|
| PHP | **8.0+** (يُفضّل 8.2+) مع امتدادات: `pdo_mysql`, `json`, `mbstring`, `openssl`, `fileinfo` |
| MySQL / MariaDB | قاعدة بيانات فارغة + مستخدم بصلاحيات كافية |
| خادم ويب | Apache مع `mod_rewrite` أو nginx مع تكافئ القواعد |

## تشغيل سريع (مطور)

1. استنسخ المشروع إلى مجلد يخدمه الخادم (مثلاً `public_html` أو `htdocs`).
2. انسخ `.env.example` إلى `.env` وعدّل:
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`
   - `API_DEBUG=1` أثناء التطوير فقط
3. من المتصفح: افتح `install/check_db_connection.php` إن وُجد للتحقق من الاتصال.
4. الصفحة الرئيسية: `index.html` — واجهة API: `api.php?action=categories` (أو POST JSON `{ "action": "categories" }`).

**تسجيل دخول الإدارة:** `login.php` (ليس `login.html` فقط) — كلمة المرور من `admin_panel_auth.php` / تجزئة bcrypt في الملفات الخاصة حسب إعداد الاستضافة.

## هيكل المجلدات (ملخّص)

```
/
├── api.php                 ← واجهة JSON الرئيسية
├── login.php               ← دخول الإدارة (CSRF + جلسة آمنة)
├── control-panel.php       ← إعادة توجيه لوحة التحكم إن وُجدت
├── index.html, product.html, …  ← واجهة المتجر
├── assets/css/mobile-ux.css  ← لمس 48px، خط 16px، صور متجاوبة، مسافات موبايل (يُحمّل مع المتجر)
├── assets/js/
│   ├── api.js              ← استدعاءات API للمتجر (غير modules)
│   ├── main.js, app.js, …
│   └── modules/
│       ├── pharma-http.js  ← عميل fetch اختياري (ES module)
│       └── README.md
├── includes/
│   ├── bootstrap_session.php
│   ├── security.php
│   ├── db.php
│   └── api/response.php    ← استجابات JSON موحّدة (مُحمّلة من api.php)
├── docs/
│   ├── ARCHITECTURE.md     ← تدفق البيانات والطبقات
│   └── SECURITY.md         ← أمان وقائمة تحقق
├── private_data/           ← (على السيرفر) تجزئة الإدارة، سجلات، نسخ احتياطية — لا ترفعها للمستودع إن تحتوي أسراراً
└── .env                    ← أسرار DB ومفاتيح API — chmod 600
```

## النشر على استضافة مشتركة (مثل Hostinger)

1. ارفع الملفات عبر FTP أو مدير الملفات إلى الجذر العام للموقع.
2. أنشئ قاعدة MySQL من لوحة التحكم واضبط `.env`.
3. فعّل **SSL** وأعد التوجيه إلى HTTPS.
4. صلاحيات مقترحة: ملفات `644`، مجلدات `755`، `.env` **600**.
5. راجع `docs/SECURITY.md` قبل الإنتاج.

## الوثائق الإضافية

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — تنظيم الكود ومسار الطلبات.
- **[docs/SECURITY.md](docs/SECURITY.md)** — SQL/XSS/الجلسات وقائمة تحقق.
- **[UPGRADE_NOTES.md](UPGRADE_NOTES.md)** — ملاحظات ترقية إن وُجدت.

## ما تم الاعتماد عليه تقنياً

- **PDO + prepared statements** لجميع استعلامات MySQL الحرجة.
- **CORS** محدود بـ `ALLOWED_ORIGIN` عند الحاجة.
- **Rate limiting** و**حظر IP** في المسارات الحساسة.
- واجهة المتجر: تحميل أصول مع **cache busting** (`?v=…` في الروابط).

## استكشاف الأخطاء

| المشكلة | ما يمكن فعله |
|---------|----------------|
| `500` من `api.php` | راجع سجلات PHP على الخادم؛ عيّن `API_DEBUG=1` مؤقتاً محلياً فقط. |
| لا اتصال بقاعدة البيانات | تحقق من `DB_*` في `.env` ومن أن المستخدم لديه صلاحية على `DB_NAME`. |
| جلسة الإدارة تُفقد | تأكد من HTTPS، وSameSite cookies، وعدم خلط نطاقات فرعية مختلفة للكوكيز. |

---

*آخر تحديث للهيكل والوثائق: يتوافق مع فصل `includes/api/response.php` و`includes/bootstrap_session.php`.*
