<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$dbHost = '127.0.0.1';
$dbPort = 3306;
$dbName = 'ippon';
$dbUser = 'root';
$dbPass = '';
$dbCharset = 'utf8mb4';

$dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset={$dbCharset}";

try {
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $e) {
    jsonResponse(500, ['error' => 'Database connection failed: ' . $e->getMessage()]);
}

function jsonResponse(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function quoteIdentifier(string $name): string
{
    return '`' . str_replace('`', '``', $name) . '`';
}

function getTableColumns(PDO $pdo, string $tableName): array
{
    $stmt = $pdo->prepare("
        SELECT COLUMN_NAME, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
        ORDER BY ORDINAL_POSITION
    ");
    $stmt->execute(['table' => $tableName]);

    $columns = [];
    foreach ($stmt->fetchAll() as $column) {
        $columns[] = [
            'name' => $column['COLUMN_NAME'],
            'pk' => $column['COLUMN_KEY'] === 'PRI' ? 1 : 0,
        ];
    }

    return $columns;
}

function tableExists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
    ");
    $stmt->execute(['table' => $tableName]);
    return (int) $stmt->fetchColumn() > 0;
}

function ensurePinkiHallTable(PDO $pdo): void
{
    if (tableExists($pdo, 'zales_pinki')) {
        return;
    }

    $clonedFromZolitude = false;
    if (tableExists($pdo, 'zales_zolitude')) {
        $pdo->exec('CREATE TABLE `zales_pinki` LIKE `zales_zolitude`');
        $sourceId = $pdo->query('SELECT `id` FROM `zales_zolitude` ORDER BY `id` DESC LIMIT 1')->fetchColumn();
        if ($sourceId !== false) {
            $copyStmt = $pdo->prepare('INSERT INTO `zales_pinki` SELECT * FROM `zales_zolitude` WHERE `id` = :id');
            $copyStmt->execute(['id' => $sourceId]);
            $clonedFromZolitude = true;
        }
    } else {
        $pdo->exec("
            CREATE TABLE `zales_pinki` (
                `id` int NOT NULL AUTO_INCREMENT,
                `nosaukums` varchar(255) NOT NULL,
                `saturs` longtext,
                `attels` varchar(1024) DEFAULT NULL,
                `galerija` longtext,
                `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    $columns = array_column(getTableColumns($pdo, 'zales_pinki'), 'name');
    $values = [
        'nosaukums' => 'Sporta zāle Rīga (Piņķi)',
        'saturs' => '<p>Jaunā iela 12, VIA JURMALA OUTLET VILLAGE teritorijā</p><p>+371 26800478 Eduards Sujetovs</p>',
        'attels' => null,
        'galerija' => '',
    ];

    if ($clonedFromZolitude) {
        $latestId = $pdo->query('SELECT `id` FROM `zales_pinki` ORDER BY `id` DESC LIMIT 1')->fetchColumn();
        if ($latestId !== false) {
            $assignments = [];
            $params = ['id' => $latestId];
            foreach (['nosaukums', 'saturs'] as $name) {
                if (in_array($name, $columns, true)) {
                    $assignments[] = quoteIdentifier($name) . ' = :' . $name;
                    $params[$name] = $values[$name];
                }
            }
            if ($assignments) {
                $stmt = $pdo->prepare('UPDATE `zales_pinki` SET ' . implode(', ', $assignments) . ' WHERE `id` = :id');
                $stmt->execute($params);
            }
        }
        return;
    }

    $insertable = array_values(array_intersect(array_keys($values), $columns));
    if (!$insertable) {
        return;
    }

    $colsSql = implode(', ', array_map(fn(string $name): string => quoteIdentifier($name), $insertable));
    $placeholders = implode(', ', array_map(fn(string $name): string => ':' . $name, $insertable));
    $stmt = $pdo->prepare("INSERT INTO `zales_pinki` ({$colsSql}) VALUES ({$placeholders})");
    $params = [];
    foreach ($insertable as $name) {
        $params[$name] = $values[$name];
    }
    $stmt->execute($params);
}

ensurePinkiHallTable($pdo);
