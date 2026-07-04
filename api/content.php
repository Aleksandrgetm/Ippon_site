<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function apiLimit(): int
{
    return max(1, min(500, (int) ($_GET['limit'] ?? 100)));
}

function apiPage(): int
{
    return max(1, (int) ($_GET['page'] ?? 1));
}

function firstTable(PDO $pdo, array $names): ?string
{
    foreach ($names as $name) {
        if (tableExists($pdo, $name)) return $name;
    }
    return null;
}

function tableColumns(PDO $pdo, string $table): array
{
    return array_map(fn($c) => $c['name'], getTableColumns($pdo, $table));
}

function hasCol(array $cols, string $name): bool
{
    return in_array($name, $cols, true);
}

function pickValue(array $row, array $keys, string $fallback = ''): string
{
    foreach ($keys as $key) {
        if (isset($row[$key]) && trim((string) $row[$key]) !== '') {
            return trim((string) $row[$key]);
        }
    }
    return $fallback;
}

function slugifyApi(string $text): string
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/i', '-', $text) ?: '';
    return trim($text, '-');
}

function publicImage(?string $value): string
{
    $value = trim((string) $value);
    if ($value === '') return '';
    if (preg_match('~^(https?:)?//|^data:|^/~i', $value)) return $value;
    return '/uploads/' . ltrim($value, '/');
}

function parseJsonMaybe($value)
{
    if (is_array($value)) return $value;
    $text = trim((string) $value);
    if ($text === '') return [];
    $decoded = json_decode($text, true);
    return is_array($decoded) ? $decoded : [];
}

function parseGallery($value): array
{
    $decoded = parseJsonMaybe($value);
    $items = $decoded ?: preg_split('/\r?\n|,/', (string) $value);
    $out = [];
    foreach ($items as $item) {
        $url = is_array($item) ? pickValue($item, ['url', 'src', 'image', 'foto_attels', 'filename']) : (string) $item;
        $url = publicImage($url);
        if ($url !== '' && !in_array($url, $out, true)) $out[] = $url;
    }
    return $out;
}

function decodeStructured($value)
{
    $decoded = parseJsonMaybe($value);
    return $decoded ?: null;
}

function selectRows(PDO $pdo, array $tables, ?callable $mapper = null, string $order = ''): array
{
    $table = firstTable($pdo, $tables);
    if (!$table) return ['items' => [], 'total' => 0, 'page' => apiPage(), 'totalPages' => 1];

    $limit = apiLimit();
    $page = apiPage();
    $offset = ($page - 1) * $limit;
    $quoted = quoteIdentifier($table);
    $cols = tableColumns($pdo, $table);
    $orderSql = $order ?: defaultOrderSql($cols);

    $total = (int) $pdo->query("SELECT COUNT(*) FROM {$quoted}")->fetchColumn();
    $stmt = $pdo->prepare("SELECT * FROM {$quoted} {$orderSql} LIMIT :limit OFFSET :offset");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll();
    $items = $mapper ? array_map($mapper, $rows) : $rows;

    return [
        'items' => $items,
        'total' => $total,
        'page' => $page,
        'totalPages' => max(1, (int) ceil($total / $limit)),
    ];
}

function defaultOrderSql(array $cols): string
{
    foreach (['position', 'ordering'] as $col) {
        if (hasCol($cols, $col)) return 'ORDER BY ' . quoteIdentifier($col) . ' ASC';
    }
    foreach (['datums', 'date', 'created_at', 'id'] as $col) {
        if (hasCol($cols, $col)) return 'ORDER BY ' . quoteIdentifier($col) . ' DESC';
    }
    return '';
}

function findItem(PDO $pdo, array $tables, string $key, callable $mapper): ?array
{
    $table = firstTable($pdo, $tables);
    if (!$table) return null;
    $cols = tableColumns($pdo, $table);
    $quoted = quoteIdentifier($table);

    foreach (['slug', 'id'] as $col) {
        if (!hasCol($cols, $col)) continue;
        $stmt = $pdo->prepare("SELECT * FROM {$quoted} WHERE " . quoteIdentifier($col) . " = :key LIMIT 1");
        $stmt->execute(['key' => $key]);
        $row = $stmt->fetch();
        if ($row) return $mapper($row);
    }

    if (preg_match('/-(\d+)$/', $key, $m) && hasCol($cols, 'id')) {
        $stmt = $pdo->prepare("SELECT * FROM {$quoted} WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => (int) $m[1]]);
        $row = $stmt->fetch();
        if ($row) return $mapper($row);
    }

    return null;
}

function mapTrainer(array $row): array
{
    $name = pickValue($row, ['vards_uzvards', 'name', 'name_lv', 'title'], 'Treneris');
    $image = publicImage(pickValue($row, ['foto_attels', 'image', 'photo', 'attels']));
    return $row + [
        'name' => $name,
        'vards_uzvards' => $name,
        'image' => $image,
        'foto_attels' => $image,
        'description' => pickValue($row, ['par_mani', 'description', 'apraksts']),
        'slug' => pickValue($row, ['slug'], slugifyApi($name)),
        'galerija' => parseGallery($row['galerija'] ?? ''),
    ];
}

function mapNews(array $row): array
{
    $title = pickValue($row, ['nosaukums', 'title', 'name'], 'Jaunums');
    $image = publicImage(pickValue($row, ['foto_attels', 'image', 'attels']));
    return $row + [
        'nosaukums' => $title,
        'title' => $title,
        'foto_attels' => $image,
        'image' => $image,
        'slug' => pickValue($row, ['slug'], slugifyApi($title . '-' . ($row['id'] ?? ''))),
        'galerija' => parseGallery($row['galerija'] ?? ''),
    ];
}

function mapSportist(array $row): array
{
    $name = pickValue($row, ['vards_uzvards', 'name_lv', 'name', 'title'], 'Sportists');
    $image = publicImage(pickValue($row, ['foto', 'foto_attels', 'image', 'attels']));
    return $row + [
        'vards_uzvards' => $name,
        'name' => $name,
        'foto' => $image,
        'foto_attels' => $image,
        'slug' => pickValue($row, ['slug'], slugifyApi($name . '-' . ($row['id'] ?? ''))),
        'par_sevi_html' => pickValue($row, ['par_sevi_html', 'o_sebe_lv', 'par_mani']),
        'par_sevi_text' => pickValue($row, ['par_sevi_text', 'description']),
    ];
}

function mapGallery(array $row): array
{
    $title = pickValue($row, ['nosaukums', 'name_lv', 'title', 'name'], 'Foto galerija');
    $photos = [];
    foreach (parseGallery($row['fotografijas'] ?? $row['galerija'] ?? '') as $i => $url) {
        $photos[] = ['id' => $i + 1, 'url' => $url];
    }
    $cover = publicImage(pickValue($row, ['foto_attels', 'image', 'cover', 'attels']));
    if (!$cover && $photos) $cover = $photos[0]['url'];
    return $row + [
        'nosaukums' => $title,
        'apraksts' => pickValue($row, ['apraksts', 'content_lv', 'description', 'content']),
        'foto_attels' => $cover,
        'slug' => pickValue($row, ['slug'], slugifyApi($title . '-' . ($row['id'] ?? ''))),
        'fotografijas' => $photos,
    ];
}

function mapVideo(array $row): array
{
    $title = pickValue($row, ['nosaukums', 'title', 'name'], 'Video galerija');
    return $row + [
        'nosaukums' => $title,
        'apraksts' => pickValue($row, ['apraksts', 'description', 'content']),
        'video_embed_url' => pickValue($row, ['video_embed_url', 'embed', 'embed_url']),
        'video_saite' => pickValue($row, ['video_saite', 'url', 'link']),
        'slug' => pickValue($row, ['slug'], slugifyApi($title . '-' . ($row['id'] ?? ''))),
    ];
}

function mapRaksti(array $row): array
{
    $title = pickValue($row, ['nosaukums', 'title', 'name'], 'Raksti prese');
    $image = publicImage(pickValue($row, ['attels', 'foto_attels', 'image']));
    return $row + [
        'nosaukums' => $title,
        'attels' => $image,
        'slug' => (string) ($row['id'] ?? pickValue($row, ['slug'], slugifyApi($title))),
    ];
}

function mapResult(array $row): array
{
    $title = pickValue($row, ['nosaukums', 'title', 'name'], 'Rezultats');
    $image = publicImage(pickValue($row, ['foto_attels', 'image', 'attels']));
    return $row + [
        'nosaukums' => $title,
        'title' => $title,
        'foto_attels' => $image,
        'slug' => pickValue($row, ['slug'], slugifyApi($title . '-' . ($row['id'] ?? ''))),
        'record_type' => pickValue($row, ['record_type'], 'sacensibas'),
        'layout_type' => pickValue($row, ['layout_type'], 'competition_default'),
        'structured_data' => decodeStructured($row['structured_data'] ?? null),
        'results_rows' => parseJsonMaybe($row['results_rows'] ?? ''),
    ];
}

function mapCalendar(array $row): array
{
    $title = pickValue($row, ['title', 'nosaukums', 'name'], 'Kalendārs');
    $date = pickValue($row, ['date', 'datums']);
    $image = publicImage(pickValue($row, ['image', 'foto_attels', 'attels']));
    return $row + [
        'title' => $title,
        'nosaukums' => $title,
        'date' => $date,
        'datums' => $date,
        'image' => $image,
        'foto_attels' => $image,
        'custom_html' => pickValue($row, ['custom_html', 'content_html', 'saturs', 'content']),
        'slug' => pickValue($row, ['slug'], slugifyApi($title . '-' . ($row['id'] ?? ''))),
    ];
}

function mapContentPage(array $row): array
{
    $image = publicImage(pickValue($row, ['attels', 'foto_attels', 'image']));
    return $row + [
        'nosaukums' => pickValue($row, ['nosaukums', 'title', 'name']),
        'ievads' => pickValue($row, ['ievads', 'intro', 'description']),
        'saturs' => pickValue($row, ['saturs', 'content', 'teksts']),
        'attels' => $image,
        'foto_attels' => $image,
        'galerija' => parseGallery($row['galerija'] ?? ''),
    ];
}

function latestItem(PDO $pdo, array $tables, callable $mapper): ?array
{
    $payload = selectRows($pdo, $tables, $mapper, '');
    return $payload['items'][0] ?? null;
}

function sendList(array $payload): void
{
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sendItem(?array $item, string $message = 'Not found'): void
{
    if (!$item) jsonResponse(404, ['error' => $message]);
    echo json_encode(['item' => $item], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
