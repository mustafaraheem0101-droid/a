<?php
/**
 * رموز استعادة كلمة مرور الإدارة + حد طلبات "نسيت كلمة المرور" لكل IP.
 */
declare(strict_types=1);

function pharma_password_reset_purge_expired(PDO $pdo): void
{
    try {
        $pdo->prepare('DELETE FROM pharma_password_reset_tokens WHERE expires_at < ?')->execute([time()]);
    } catch (Throwable $e) {
        error_log('[pharma_password_reset_purge] ' . $e->getMessage());
    }
}

/**
 * @return non-empty-string|null رمز عشوائي سداسي عشري (64 حرفاً) أو null عند الفشل
 */
function pharma_password_reset_create_token(PDO $pdo): ?string
{
    pharma_ensure_schema($pdo);
    pharma_password_reset_purge_expired($pdo);
    $raw = bin2hex(random_bytes(32));
    $hash = hash('sha256', $raw);
    $exp = time() + max(300, (int) env('PASSWORD_RESET_TTL_SEC', '3600'));
    $now = time();
    try {
        $pdo->prepare(
            'INSERT INTO pharma_password_reset_tokens (token_hash, expires_at, created_at) VALUES (?,?,?)'
        )->execute([$hash, $exp, $now]);
    } catch (Throwable $e) {
        error_log('[pharma_password_reset_create] ' . $e->getMessage());

        return null;
    }

    return $raw;
}

/**
 * يتحقق من الرمز ويحذف السجل عند النجاح (استخدام لمرة واحدة).
 */
function pharma_password_reset_validate_and_delete(PDO $pdo, string $rawToken): bool
{
    $rawToken = trim($rawToken);
    if (strlen($rawToken) < 64) {
        return false;
    }
    pharma_ensure_schema($pdo);
    $hash = hash('sha256', $rawToken);
    $now = time();
    try {
        $st = $pdo->prepare(
            'SELECT id FROM pharma_password_reset_tokens WHERE token_hash = ? AND expires_at > ? LIMIT 1'
        );
        $st->execute([$hash, $now]);
        $id = $st->fetchColumn();
        if (!$id) {
            return false;
        }
        $pdo->prepare('DELETE FROM pharma_password_reset_tokens WHERE id = ?')->execute([(int) $id]);

        return true;
    } catch (Throwable $e) {
        error_log('[pharma_password_reset_validate] ' . $e->getMessage());

        return false;
    }
}

/**
 * @return bool false عند تجاوز الحد
 */
function pharma_forgot_rate_allow(PDO $pdo, string $ip): bool
{
    pharma_ensure_schema($pdo);
    $now = time();
    $window = max(300, (int) env('FORGOT_PASSWORD_WINDOW_SEC', '3600'));
    $max = max(1, (int) env('FORGOT_PASSWORD_MAX_PER_WINDOW', '3'));

    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare('SELECT req_count, window_start FROM pharma_forgot_rate WHERE ip = ? FOR UPDATE');
        $st->execute([$ip]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            $pdo->prepare(
                'INSERT INTO pharma_forgot_rate (ip, req_count, window_start) VALUES (?, 1, ?)'
            )->execute([$ip, $now]);
            $pdo->commit();

            return true;
        }
        $ws = (int) $row['window_start'];
        $cnt = (int) $row['req_count'];
        if ($now - $ws > $window) {
            $pdo->prepare(
                'UPDATE pharma_forgot_rate SET req_count = 1, window_start = ? WHERE ip = ?'
            )->execute([$now, $ip]);
            $pdo->commit();

            return true;
        }
        if ($cnt >= $max) {
            $pdo->rollBack();

            return false;
        }
        $pdo->prepare('UPDATE pharma_forgot_rate SET req_count = req_count + 1 WHERE ip = ?')->execute([$ip]);
        $pdo->commit();

        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('[pharma_forgot_rate] ' . $e->getMessage());

        return false;
    }
}

/** قاعدة الرابط العامة (لرابط إعادة التعيين في البريد). يُفضّل ضبط APP_URL في .env */
function pharma_public_base_url(): string
{
    $fromEnv = trim(env('APP_URL', ''));
    if ($fromEnv !== '' && preg_match('#^https?://#i', $fromEnv)) {
        return rtrim($fromEnv, '/');
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    return ($https ? 'https://' : 'http://') . $host;
}
