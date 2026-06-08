<?php
/**
 * includes/api/handlers/sliders.php
 * إدارة السلايدرات — CRUD كامل (إدارة فقط)
 */
declare(strict_types=1);

function handle_sliders(string $action, array $body, array $rawBody, string $clientIP, string $method, mixed $db): void
{
    /* ══════════════════════════════════════════════════════
       السلايدرات تُخزَّن في MySQL مباشرة (وليس ملف JSON)
    ══════════════════════════════════════════════════════ */
    $pdo = getPdo();
    if (!$pdo) {
        jsonError('قاعدة البيانات غير مُعدّة — السلايدرات تتطلب MySQL. تحقق من إعدادات .env', [], 500);
    }
    $db = $pdo;

    /* ══════════════════════════════════════════════════════
       تأكد الجدول موجود
    ══════════════════════════════════════════════════════ */
    try {
        pharma_ensure_sliders_table($db);
    } catch (Exception $e) {
        jsonError('تعذر إنشاء جدول السلايدرات: ' . $e->getMessage(), [], 500);
    }

    switch ($action) {

        /* ══════ جلب كل السلايدرات (للإدارة — نشطة وغير نشطة) ══════ */
        case 'admin_get_sliders':
            if (empty($_SESSION['admin_logged_in'])) { jsonError('غير مصرح', [], 401); }
            try {
                $rows = $db->query(
                    "SELECT id, title, link_url, img_desktop, img_mobile, alt_text, sort_order, active
                     FROM pharma_sliders
                     ORDER BY sort_order ASC, id ASC"
                )->fetchAll(PDO::FETCH_ASSOC);
                // تحويل الأنواع
                foreach ($rows as &$r) {
                    $r['id']         = (int) $r['id'];
                    $r['sort_order'] = (int) $r['sort_order'];
                    $r['active']     = (bool) $r['active'];
                }
                unset($r);
                jsonSuccess(['sliders' => $rows], '');
            } catch (Exception $e) {
                jsonError('فشل جلب السلايدرات: ' . $e->getMessage(), [], 500);
            }
            break;

        /* ══════ إضافة سلايدر جديد ══════ */
        case 'admin_add_slider':
            if (empty($_SESSION['admin_logged_in'])) { jsonError('غير مصرح', [], 401); }
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }

            $imgDesktop = trim($rawBody['img_desktop'] ?? '');
            $imgMobile  = trim($rawBody['img_mobile']  ?? '');
            $title      = trim($rawBody['title']       ?? '');
            $linkUrl    = trim($rawBody['link_url']    ?? '');
            $altText    = trim($rawBody['alt_text']    ?? '');
            $sortOrder  = (int) ($rawBody['sort_order'] ?? 0);
            $active     = isset($rawBody['active']) ? (int)(bool)$rawBody['active'] : 1;

            if ($imgDesktop === '' && $imgMobile === '') {
                jsonError('يجب إدخال صورة الديسكتوب أو الموبايل على الأقل');
            }

            try {
                $stmt = $db->prepare(
                    "INSERT INTO pharma_sliders (title, link_url, img_desktop, img_mobile, alt_text, sort_order, active)
                     VALUES (:title, :link_url, :img_desktop, :img_mobile, :alt_text, :sort_order, :active)"
                );
                $stmt->execute([
                    ':title'       => $title,
                    ':link_url'    => $linkUrl,
                    ':img_desktop' => $imgDesktop,
                    ':img_mobile'  => $imgMobile,
                    ':alt_text'    => $altText,
                    ':sort_order'  => $sortOrder,
                    ':active'      => $active,
                ]);
                $newId = (int) $db->lastInsertId();
                logActivity('ADD_SLIDER', "إضافة سلايدر #$newId", $clientIP);
                jsonSuccess(['id' => $newId], 'تمت إضافة السلايدر بنجاح');
            } catch (Exception $e) {
                jsonError('فشل إضافة السلايدر: ' . $e->getMessage(), [], 500);
            }
            break;

        /* ══════ تعديل سلايدر ══════ */
        case 'admin_update_slider':
            if (empty($_SESSION['admin_logged_in'])) { jsonError('غير مصرح', [], 401); }
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }

            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) { jsonError('معرف السلايدر غير صالح'); }

            $imgDesktop = trim($rawBody['img_desktop'] ?? '');
            $imgMobile  = trim($rawBody['img_mobile']  ?? '');
            $title      = trim($rawBody['title']       ?? '');
            $linkUrl    = trim($rawBody['link_url']    ?? '');
            $altText    = trim($rawBody['alt_text']    ?? '');
            $sortOrder  = (int) ($rawBody['sort_order'] ?? 0);
            $active     = isset($rawBody['active']) ? (int)(bool)$rawBody['active'] : 1;

            try {
                $stmt = $db->prepare(
                    "UPDATE pharma_sliders
                     SET title=:title, link_url=:link_url, img_desktop=:img_desktop,
                         img_mobile=:img_mobile, alt_text=:alt_text,
                         sort_order=:sort_order, active=:active
                     WHERE id=:id"
                );
                $stmt->execute([
                    ':title'       => $title,
                    ':link_url'    => $linkUrl,
                    ':img_desktop' => $imgDesktop,
                    ':img_mobile'  => $imgMobile,
                    ':alt_text'    => $altText,
                    ':sort_order'  => $sortOrder,
                    ':active'      => $active,
                    ':id'          => $id,
                ]);
                logActivity('UPDATE_SLIDER', "تعديل سلايدر #$id", $clientIP);
                jsonSuccess([], 'تم تعديل السلايدر بنجاح');
            } catch (Exception $e) {
                jsonError('فشل تعديل السلايدر: ' . $e->getMessage(), [], 500);
            }
            break;

        /* ══════ حذف سلايدر ══════ */
        case 'admin_delete_slider':
            if (empty($_SESSION['admin_logged_in'])) { jsonError('غير مصرح', [], 401); }
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }

            $id = (int) ($rawBody['id'] ?? 0);
            if ($id <= 0) { jsonError('معرف السلايدر غير صالح'); }

            try {
                $stmt = $db->prepare("DELETE FROM pharma_sliders WHERE id=:id");
                $stmt->execute([':id' => $id]);
                logActivity('DELETE_SLIDER', "حذف سلايدر #$id", $clientIP);
                jsonSuccess([], 'تم حذف السلايدر بنجاح');
            } catch (Exception $e) {
                jsonError('فشل حذف السلايدر: ' . $e->getMessage(), [], 500);
            }
            break;

        /* ══════ تبديل حالة السلايدر (نشط/معطل) ══════ */
        case 'admin_toggle_slider':
            if (empty($_SESSION['admin_logged_in'])) { jsonError('غير مصرح', [], 401); }
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }

            $id     = (int)  ($rawBody['id']     ?? 0);
            $active = (int)(bool)($rawBody['active'] ?? 0);
            if ($id <= 0) { jsonError('معرف السلايدر غير صالح'); }

            try {
                $stmt = $db->prepare("UPDATE pharma_sliders SET active=:active WHERE id=:id");
                $stmt->execute([':active' => $active, ':id' => $id]);
                logActivity('TOGGLE_SLIDER', "سلايدر #$id → " . ($active ? 'نشط' : 'معطل'), $clientIP);
                jsonSuccess(['active' => (bool)$active], '');
            } catch (Exception $e) {
                jsonError('فشل تحديث الحالة: ' . $e->getMessage(), [], 500);
            }
            break;

        /* ══════ رفع صورة سلايدر ══════ */
        case 'upload_slider_image':
            if (empty($_SESSION['admin_logged_in'])) { jsonError('غير مصرح', [], 401); }
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }
            if (empty($_FILES['image']) || !is_array($_FILES['image'])) { jsonError('لم يتم إرسال صورة'); }

            $check = validateUploadedImage($_FILES['image'], null);
            if (!$check['ok']) { jsonError($check['msg']); }

            if (!is_dir(IMAGES_DIR)) { mkdir(IMAGES_DIR, 0755, true); }
            $name   = 'slider_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $check['ext'];
            $target = IMAGES_DIR . $name;
            if (!move_uploaded_file($_FILES['image']['tmp_name'], $target)) {
                jsonError('تعذر حفظ الصورة على السيرفر', [], 500);
            }
            chmod($target, 0644);
            logActivity('UPLOAD_SLIDER_IMAGE', "رفع صورة سلايدر: $name", $clientIP);
            jsonSuccess(['path' => '/images/' . $name, 'url' => '/images/' . $name], '');
            break;

        /* ══════ إعادة ترتيب السلايدرات ══════ */
        case 'admin_reorder_sliders':
            if (empty($_SESSION['admin_logged_in'])) { jsonError('غير مصرح', [], 401); }
            if ($method !== 'POST') { jsonError('POST فقط', [], 405); }

            $ids = $rawBody['ids'] ?? [];
            if (!is_array($ids) || empty($ids)) { jsonError('قائمة المعرفات فارغة'); }

            try {
                $stmt = $db->prepare("UPDATE pharma_sliders SET sort_order=:ord WHERE id=:id");
                foreach ($ids as $ord => $sid) {
                    $stmt->execute([':ord' => (int)$ord, ':id' => (int)$sid]);
                }
                jsonSuccess([], 'تم حفظ الترتيب');
            } catch (Exception $e) {
                jsonError('فشل إعادة الترتيب: ' . $e->getMessage(), [], 500);
            }
            break;

        default:
            jsonError('إجراء غير معروف: ' . $action, [], 400);
    }
}
