<?php
/**
 * إرسال البريد عبر SMTP (Gmail وغيره) باستخدام PHPMailer.
 * شغّل: composer install (لمكتبة vendor/phpmailer)
 */
declare(strict_types=1);

/**
 * يحمّل مرة واحدة ملف private_data/mail_smtp.env إن وُجد (نفس صيغة .env) — مفيد عندما لا يُقرأ .env من جذر الموقع على الاستضافة.
 */
function pharma_mail_merge_private_smtp_env(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;
    if (!function_exists('pharma_merge_env_file')) {
        require_once dirname(__DIR__) . '/env_loader.php';
    }
    $paths = [];
    if (function_exists('pharma_resolve_private_dir')) {
        $paths[] = pharma_resolve_private_dir() . 'mail_smtp.env';
    }
    $paths[] = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private_data' . DIRECTORY_SEPARATOR . 'mail_smtp.env';
    foreach ($paths as $p) {
        if ($p !== '' && is_readable($p)) {
            pharma_merge_env_file($p);

            return;
        }
    }
}

function pharma_mail_autoload(): bool
{
    static $ok = null;
    if ($ok !== null) {
        return $ok;
    }
    $base = dirname(__DIR__) . '/vendor/autoload.php';
    if (!is_readable($base)) {
        $ok = false;

        return false;
    }
    require_once $base;
    $ok = class_exists(\PHPMailer\PHPMailer\PHPMailer::class);

    return $ok;
}

function pharma_mail_configured(): bool
{
    pharma_mail_merge_private_smtp_env();

    return trim(env('MAIL_HOST', '')) !== ''
        && trim(env('MAIL_USERNAME', '')) !== ''
        && trim(env('MAIL_PASSWORD', '')) !== '';
}

/**
 * بريد المسؤول لاستعادة كلمة المرور والتجارب:
 * ADMIN_EMAIL ثم MAIL_FROM_ADDRESS ثم MAIL_USERNAME، ثم ثابت ADMIN_EMAIL من api.php،
 * ثم ملف private_data/admin_recovery_email.txt (سطر واحد — مفيد إن لم يُحمّل .env على الاستضافة).
 */
function pharma_admin_recovery_email(): string
{
    pharma_mail_merge_private_smtp_env();

    foreach (['ADMIN_EMAIL', 'MAIL_FROM_ADDRESS', 'MAIL_USERNAME'] as $key) {
        $v = strtolower(trim(env($key, '')));
        if ($v !== '' && filter_var($v, FILTER_VALIDATE_EMAIL)) {
            return $v;
        }
    }

    if (defined('ADMIN_EMAIL')) {
        $v = strtolower(trim((string) constant('ADMIN_EMAIL')));
        if ($v !== '' && filter_var($v, FILTER_VALIDATE_EMAIL)) {
            return $v;
        }
    }

    $paths = [];
    if (function_exists('pharma_resolve_private_dir')) {
        $paths[] = pharma_resolve_private_dir() . 'admin_recovery_email.txt';
    }
    $paths[] = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private_data' . DIRECTORY_SEPARATOR . 'admin_recovery_email.txt';

    foreach ($paths as $fp) {
        if ($fp === '' || !is_readable($fp)) {
            continue;
        }
        $line = trim((string) file_get_contents($fp));
        $line = strtolower(trim(explode("\n", $line, 2)[0]));
        if ($line !== '' && filter_var($line, FILTER_VALIDATE_EMAIL)) {
            return $line;
        }
    }

    return '';
}

/**
 * @return bool تم الإرسال بنجاح
 */
function pharma_send_html_mail(string $to, string $subject, string $htmlBody, string $altBody = ''): bool
{
    pharma_mail_merge_private_smtp_env();

    $to = trim($to);
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    if (!pharma_mail_configured()) {
        error_log('[pharma_mail] إعداد MAIL_* غير مكتمل في .env');

        return false;
    }
    if (!pharma_mail_autoload()) {
        error_log('[pharma_mail] لم يُحمّل vendor/autoload.php — نفّذ composer install في جذر المشروع');

        return false;
    }

    $host = trim(env('MAIL_HOST', ''));
    $port = (int) env('MAIL_PORT', '587');
    $enc = strtolower(trim(env('MAIL_ENCRYPTION', 'tls')));
    $user = trim(env('MAIL_USERNAME', ''));
    $pass = trim(env('MAIL_PASSWORD', ''));
    $fromAddr = trim(env('MAIL_FROM_ADDRESS', $user));
    $fromName = trim(env('MAIL_FROM_NAME', 'لوحة الإدارة'));

    try {
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->CharSet = 'UTF-8';
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->Port = $port > 0 ? $port : 587;
        $mail->SMTPAuth = true;
        $mail->Username = $user;
        $mail->Password = $pass;
        if ($enc === 'ssl') {
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($enc === 'tls' || $enc === '') {
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPAutoTLS = false;
        }
        $mail->setFrom($fromAddr, $fromName);
        $mail->addAddress($to);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $htmlBody;
        $mail->AltBody = $altBody !== '' ? $altBody : strip_tags($htmlBody);

        return $mail->send();
    } catch (\Throwable $e) {
        error_log('[pharma_mail] ' . $e->getMessage());

        return false;
    }
}
