<?php
declare(strict_types=1);
require __DIR__ . '/../content.php';

$key = trim((string) ($_SERVER['PATH_INFO'] ?? ''), '/');
$map = [
    'imanta' => 'zales_imanta',
    'pinki' => 'zales_pinki',
    'zolitude' => 'zales_zolitude',
    'sloka' => 'zales_sloka',
];

if (!isset($map[$key])) jsonResponse(404, ['error' => 'Hall not found']);
sendItem(latestItem($pdo, [$map[$key]], 'mapContentPage'), 'Hall not found');
