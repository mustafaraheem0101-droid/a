<?php
/**
 * روابط مختصرة ودّية لصفحات المنتجات
 */
declare(strict_types=1);

function pharma_slugify_product_name(string $name, string $id): string
{
    $name = trim($name);
    if ($name === '') {
        return 'product-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
    }
    $s = preg_replace('/\s+/u', '-', $name);
    $s = preg_replace('/[^\p{L}\p{N}\-_]/u', '', $s);
    $s = trim($s, '-');
    if ($s === '') {
        return 'product-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
    }

    return mb_strtolower($s, 'UTF-8');
}

/**
 * @param array<string,mixed> $p
 */
function pharma_apply_product_slug(array &$p): void
{
    $id = (string) ($p['id'] ?? '');
    $name = (string) ($p['name'] ?? '');
    $cur = isset($p['slug']) && is_string($p['slug']) ? trim($p['slug']) : '';
    if ($cur === '') {
        $p['slug'] = pharma_slugify_product_name($name, $id);
    }
}
