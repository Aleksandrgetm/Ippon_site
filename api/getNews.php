<?php
declare(strict_types=1);
require __DIR__ . '/content.php';
sendList(selectRows($pdo, ['ippon_news', 'jaunumi'], 'mapNews', newsOrderSql($pdo, ['ippon_news', 'jaunumi'])));
