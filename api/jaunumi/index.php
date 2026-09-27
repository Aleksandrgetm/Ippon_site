<?php
declare(strict_types=1);
require __DIR__ . '/../content.php';

$key = trim((string) ($_SERVER['PATH_INFO'] ?? ''), '/');
if ($key !== '') {
    sendItem(findItem($pdo, ['ippon_news', 'jaunumi'], $key, 'mapNews'), 'News not found');
}
sendList(selectRows($pdo, ['ippon_news', 'jaunumi'], 'mapNews', newsOrderSql($pdo, ['ippon_news', 'jaunumi'])));
