<?php
/**
 * تجميع بيانات العملاء من مصفوفة طلبات (منطق خالص عن التخزين — مناسب للاختبارات).
 */
declare(strict_types=1);

/**
 * @param list<array<string,mixed>> $orders
 * @return list<array{phone:string,name:string,orders_count:int,orderCount:int,last_order_at:string,total_spent:float,totalSpent:float}>
 */
function pharma_aggregate_customers_from_orders(array $orders): array
{
    $byPhone = [];
    foreach ($orders as $o) {
        if (!is_array($o)) {
            continue;
        }
        $p = trim((string) ($o['phone'] ?? ''));
        if ($p === '') {
            continue;
        }
        if (!isset($byPhone[$p])) {
            $byPhone[$p] = [
                'phone'         => $p,
                'name'          => $o['customer_name'] ?? '',
                'orders_count'  => 0,
                'orderCount'    => 0,
                'last_order_at' => $o['created_at'] ?? '',
                'total_spent'   => 0.0,
                'totalSpent'    => 0.0,
            ];
        }
        $byPhone[$p]['orders_count']++;
        $byPhone[$p]['orderCount']    = $byPhone[$p]['orders_count'];
        $byPhone[$p]['total_spent']  += (float) ($o['total'] ?? 0);
        $byPhone[$p]['totalSpent']    = $byPhone[$p]['total_spent'];
        $ca = $o['created_at'] ?? '';
        if ($ca > ($byPhone[$p]['last_order_at'] ?? '')) {
            $byPhone[$p]['last_order_at'] = $ca;
            if (!empty($o['customer_name'])) {
                $byPhone[$p]['name'] = $o['customer_name'];
            }
        }
    }
    $list = array_values($byPhone);
    usort($list, static fn($a, $b) => strcmp($b['last_order_at'] ?? '', $a['last_order_at'] ?? ''));

    return $list;
}
