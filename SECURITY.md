# Security hardening — NEW PHARMA

This document lists security and performance-related changes applied to the pharmacy storefront and API.

## 1. XSS output escaping

- Added global helper `escHtml(string $v): string` in `includes/security.php` using `htmlspecialchars(..., ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`.
- Replaced raw `htmlspecialchars` / echoed user data in admin templates (`admin/_layout.php`, `admin/dashboard.php`, `admin/_list_drugs.php`, `admin/_add_drug.php`, `admin/_edit_drug.php`, `login.php`, `unblock_login.php`) and `control-panel.html` (CSRF meta) with `escHtml()` where appropriate; delete confirmation in `_list_drugs.php` uses `json_encode()` for a safe JS string.
- JavaScript: existing patterns already use escaping helpers (e.g. `escHtml` / `escHtmlR`) for dynamic HTML in admin suggestions and reviews; no unsafe `innerHTML = userValue` without escaping was left unaddressed in the audited paths.

## 2. Client IP (`getClientIP`)

- `includes/security.php`: `BEHIND_CLOUDFLARE` (default `false`) from `.env`. If `true`, only `HTTP_CF_CONNECTING_IP` is used (validated). If `false`, only `REMOTE_ADDR` is used; `X-Forwarded-For` and `X-Real-IP` are ignored.
- Documented in `.env.example`. `env_loader.php` already loads arbitrary `KEY=value` entries.

## 3. Control panel exposure

- `control-panel.php`: after secure session init, calls `checkAuth(getClientIP(), false)` so unauthenticated users are redirected to `login.php` (second argument avoids JSON 401 for HTML).
- `admin/.htaccess`: denies `control-panel.php` / `control-panel.html` if mistakenly placed under `admin/`.

## 4. JavaScript bundle size

- Build: `npm run build:assets` (see `tools/build-assets.mjs`, `esbuild`) minifies `assets/js/main.js`, `admin.js`, `api.js`, `ui.js`, `utils.js` to `assets/js/dist/*.min.js`.
- Store and control-panel HTML now reference the `.min.js` files (version query `v=4.0.0`). Minified on-disk total for the five files is reduced versus sources; combined **gzip** size is on the order of **~78KB** (with Apache `mod_deflate`, transfer size stays well under the 150KB target).

## 5. CSS bundle size

- Same build purges CSS with PurgeCSS against `**/*.{html,php,js}` (with conservative safelists for dynamic classes), then minifies with esbuild to `assets/css/dist/*.min.css` for `pharma-bundle.css`, `shop-bundle.css`, `store-enhancements.css`.
- Public HTML updated to load `shop-bundle.min.css` and `store-enhancements.min.css` where applicable.

## 6. Admin section stubs

- `admin/cosmetics/*`, `admin/kids/*`, `admin/medical/*`: after `require_once .../_auth.php`, explicit `empty($_SESSION['admin_logged_in'])` guard with HTTP 403.
- `admin/_auth.php` includes `includes/security.php` for `escHtml` and shared helpers.

## 7. Composer lock and audit

- `composer.lock` is generated and should be committed; `vendor/` remains ignored.
- `composer update` / `composer install` and `composer audit` report **no known security vulnerability advisories** for locked dependencies (run locally when updating PHP deps).

## 8. API rate limiting

- `api.php`: `checkRateLimit($clientIP, $isPost)` — POST uses existing `RATE_WINDOW` / `MAX_REQUESTS`; GET uses `RATE_WINDOW_GET` / `MAX_REQUESTS_GET` (defaults 60s / 120 requests), configurable via `.env.example`.
- Implementation uses keyed rows in existing `pharma_rate_limit` table (no schema change); real IP is used for blocking/logging on exceed.
- HTTP **429** responses set **`Retry-After`** where applicable (rate limit and IP block paths).

## 9. Session fixation

- `login.php`: `session_regenerate_id(true)` runs **before** `$_SESSION['admin_logged_in'] = true` on successful login.
- `admin_panel_auth.php` `admin_restore_session_from_cookie()`: calls `session_regenerate_id(true)` before setting `$_SESSION['admin_logged_in']` when restoring from a valid signed cookie.

## 10. Error disclosure (API)

- `api.php`: `set_exception_handler` returns generic JSON **500** when `API_DEBUG` is false; uncaught exceptions do not expose traces in the response.
- Existing handlers already gate `jsonError(..., 500)` messages with `API_DEBUG` for caught exceptions; shutdown handler in `includes/api/response.php` already avoids path leakage unless `API_DEBUG` is on.

---

Rebuild front-end assets after editing JS/CSS sources: `npm run build:assets`.
