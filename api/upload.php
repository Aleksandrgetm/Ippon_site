<?php
declare(strict_types=1);

require __DIR__ . '/db.php';

function loadUploadEnv(string $rootPath): array
{
    $values = [];
    $envPath = $rootPath . DIRECTORY_SEPARATOR . '.env';
    if (!is_file($envPath)) {
        return $values;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return $values;
    }

    foreach ($lines as $line) {
        $trimmed = trim((string) $line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }
        $pos = strpos($trimmed, '=');
        if ($pos === false) {
            continue;
        }
        $key = trim(substr($trimmed, 0, $pos));
        $value = trim(substr($trimmed, $pos + 1));
        $values[$key] = trim($value, "\"'");
    }

    return $values;
}

function envPositiveInt(array $env, string $name, int $default): int
{
    $raw = trim((string) ($env[$name] ?? ''));
    if ($raw === '') {
        return $default;
    }
    $value = (int) $raw;
    return $value > 0 ? $value : $default;
}

function formatBytesPhp(int $bytes): string
{
    if ($bytes >= 1048576) {
        $mb = $bytes / 1048576;
        return (floor($mb) === $mb ? (string) (int) $mb : number_format($mb, 1, '.', '')) . ' MB';
    }
    if ($bytes >= 1024) {
        $kb = $bytes / 1024;
        return (floor($kb) === $kb ? (string) (int) $kb : number_format($kb, 1, '.', '')) . ' KB';
    }
    return $bytes . ' B';
}

function cleanOriginalName(string $name): string
{
    $base = pathinfo($name, PATHINFO_FILENAME);
    $base = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $base) ?: 'photo';
    return trim($base, '-') ?: 'photo';
}

function uniqueFileName(string $originalName, string $extension): string
{
    return cleanOriginalName($originalName) . '-' . date('YmdHis') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;
}

function detectIsoBmffImageMime(string $binary): ?array
{
    if (strlen($binary) < 16 || substr($binary, 4, 4) !== 'ftyp') {
        return null;
    }

    $brands = [];
    for ($i = 8; $i + 4 <= min(strlen($binary), 48); $i += 4) {
        $brands[] = strtolower(substr($binary, $i, 4));
    }
    $brands = array_unique($brands);

    if (in_array('avif', $brands, true) || in_array('avis', $brands, true)) {
        return ['mime' => 'image/avif', 'extension' => 'avif'];
    }
    if (in_array('heic', $brands, true) || in_array('heix', $brands, true) || in_array('hevc', $brands, true) || in_array('hevx', $brands, true)) {
        return ['mime' => 'image/heic', 'extension' => 'heic'];
    }
    if (in_array('heif', $brands, true) || in_array('mif1', $brands, true) || in_array('msf1', $brands, true)) {
        return ['mime' => 'image/heif', 'extension' => 'heif'];
    }

    return null;
}

function detectImageTypeFromBinary(string $binary): ?array
{
    if (str_starts_with($binary, "\xFF\xD8\xFF")) {
        return ['mime' => 'image/jpeg', 'extension' => 'jpg'];
    }
    if (str_starts_with($binary, "\x89PNG\x0D\x0A\x1A\x0A")) {
        return ['mime' => 'image/png', 'extension' => 'png'];
    }
    if (str_starts_with($binary, 'GIF87a') || str_starts_with($binary, 'GIF89a')) {
        return ['mime' => 'image/gif', 'extension' => 'gif'];
    }
    if (substr($binary, 0, 4) === 'RIFF' && substr($binary, 8, 4) === 'WEBP') {
        return ['mime' => 'image/webp', 'extension' => 'webp'];
    }
    return detectIsoBmffImageMime($binary);
}

function savePhoto(PDO $pdo, string $uploadDir, string $originalName, string $extension, string $binary): array
{
    $fileName = uniqueFileName($originalName, $extension);
    $targetPath = $uploadDir . DIRECTORY_SEPARATOR . $fileName;

    if (file_put_contents($targetPath, $binary, LOCK_EX) === false) {
        throw new RuntimeException('Failed to save file');
    }

    $stmt = $pdo->prepare('INSERT INTO photos (filename) VALUES (:filename)');
    $stmt->execute(['filename' => $fileName]);

    return [
        'id' => (int) $pdo->lastInsertId(),
        'filename' => $fileName,
        'url' => '/uploads/' . rawurlencode($fileName),
        'relativeUrl' => '/uploads/' . rawurlencode($fileName),
    ];
}

function validateImageUpload(string $originalName, string $binary, array $allowedExtensions, array $allowedMimeTypes): array
{
    $detected = detectImageTypeFromBinary($binary);
    if (!$detected || !in_array($detected['mime'], $allowedMimeTypes, true) || !in_array($detected['extension'], $allowedExtensions, true)) {
        throw new RuntimeException('Only JPG, JPEG, PNG, WEBP, GIF, AVIF, HEIC and HEIF images are allowed');
    }

    $extension = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
    if ($extension === 'jpeg') {
        $extension = 'jpg';
    }
    if ($extension !== '' && $extension !== $detected['extension']) {
        throw new RuntimeException('File extension does not match the actual image type');
    }

    return $detected;
}

function saveDataUrlPhoto(PDO $pdo, string $uploadDir, array $item, array $allowedExtensions, array $allowedMimeTypes, int $maxFileSizeBytes): array
{
    $originalName = (string) ($item['filename'] ?? 'photo.jpg');
    $dataUrl = (string) ($item['dataUrl'] ?? '');

    if (!preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i', $dataUrl, $matches)) {
        throw new RuntimeException('Invalid image data');
    }

    $binary = base64_decode($matches[2], true);
    if ($binary === false) {
        throw new RuntimeException('Invalid base64 image');
    }
    if (strlen($binary) > $maxFileSizeBytes) {
        throw new OverflowException('File is too large. Max ' . formatBytesPhp($maxFileSizeBytes) . ' per file');
    }

    $detected = validateImageUpload($originalName, $binary, $allowedExtensions, $allowedMimeTypes);
    return savePhoto($pdo, $uploadDir, $originalName, $detected['extension'], $binary);
}

function saveUploadedFile(PDO $pdo, string $uploadDir, array $file, array $allowedExtensions, array $allowedMimeTypes, int $maxFileSizeBytes): array
{
    $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($errorCode !== UPLOAD_ERR_OK) {
        throw new RuntimeException(match ($errorCode) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File is too large. Max ' . formatBytesPhp($maxFileSizeBytes) . ' per file',
            UPLOAD_ERR_PARTIAL => 'Upload was interrupted before the file finished uploading',
            default => 'Upload failed',
        });
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size <= 0) {
        throw new RuntimeException('Uploaded file is empty');
    }
    if ($size > $maxFileSizeBytes) {
        throw new OverflowException('File is too large. Max ' . formatBytesPhp($maxFileSizeBytes) . ' per file');
    }

    $tmpPath = (string) ($file['tmp_name'] ?? '');
    $binary = file_get_contents($tmpPath);
    if ($binary === false) {
        throw new RuntimeException('Failed to read uploaded file');
    }

    $originalName = (string) ($file['name'] ?? 'photo.jpg');
    $detected = validateImageUpload($originalName, $binary, $allowedExtensions, $allowedMimeTypes);
    return savePhoto($pdo, $uploadDir, $originalName, $detected['extension'], $binary);
}

$env = loadUploadEnv(dirname(__DIR__));
$maxFileSizeBytes = envPositiveInt($env, 'UPLOAD_MAX_FILE_SIZE_MB', 100) * 1024 * 1024;
$maxRequestSizeBytes = envPositiveInt($env, 'UPLOAD_MAX_REQUEST_SIZE_MB', 500) * 1024 * 1024;
$maxFiles = envPositiveInt($env, 'UPLOAD_MAX_FILES', 100);

$allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif'];
$allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];
$uploadDir = __DIR__ . '/../uploads';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed']);
}

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    jsonResponse(500, ['error' => 'Uploads directory is not writable']);
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 0 && $contentLength > $maxRequestSizeBytes) {
    jsonResponse(413, [
        'error' => 'Request is too large. Max ' . formatBytesPhp($maxRequestSizeBytes) . ' per upload request',
        'details' => [
            'maxRequestSizeBytes' => $maxRequestSizeBytes,
        ],
    ]);
}

$saved = [];
$failed = [];

try {
    if (!empty($_FILES)) {
        $field = $_FILES['photo'] ?? $_FILES['file'] ?? $_FILES['image'] ?? $_FILES['files'] ?? null;
        if (!$field) {
            throw new RuntimeException('No file uploaded');
        }

        if (is_array($field['name'])) {
            $count = count($field['name']);
            if ($count > $maxFiles) {
                throw new OverflowException('Too many files. Max ' . $maxFiles . ' files per request');
            }
            for ($index = 0; $index < $count; $index++) {
                $originalName = (string) ($field['name'][$index] ?? ('photo-' . $index));
                try {
                    $saved[] = saveUploadedFile($pdo, $uploadDir, [
                        'name' => $originalName,
                        'tmp_name' => $field['tmp_name'][$index] ?? '',
                        'error' => $field['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                        'size' => $field['size'][$index] ?? 0,
                    ], $allowedExtensions, $allowedMimeTypes, $maxFileSizeBytes);
                } catch (Throwable $e) {
                    $failed[] = [
                        'fileName' => $originalName,
                        'error' => $e->getMessage(),
                    ];
                }
            }
        } else {
            $saved[] = saveUploadedFile($pdo, $uploadDir, $field, $allowedExtensions, $allowedMimeTypes, $maxFileSizeBytes);
        }
    } else {
        $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
        if (!is_array($payload)) {
            throw new RuntimeException('Invalid JSON');
        }

        $files = [];
        if (isset($payload['files']) && is_array($payload['files'])) {
            $files = $payload['files'];
        } elseif (!empty($payload)) {
            $files = [$payload];
        }

        if (count($files) > $maxFiles) {
            throw new OverflowException('Too many files. Max ' . $maxFiles . ' files per request');
        }

        foreach ($files as $index => $item) {
            if (!is_array($item)) {
                $failed[] = [
                    'fileName' => 'file-' . ($index + 1),
                    'error' => 'Invalid upload item',
                ];
                continue;
            }
            $originalName = (string) ($item['filename'] ?? ('photo-' . ($index + 1) . '.jpg'));
            try {
                $saved[] = saveDataUrlPhoto($pdo, $uploadDir, $item, $allowedExtensions, $allowedMimeTypes, $maxFileSizeBytes);
            } catch (Throwable $e) {
                $failed[] = [
                    'fileName' => $originalName,
                    'error' => $e->getMessage(),
                ];
            }
        }
    }
} catch (OverflowException $e) {
    jsonResponse(413, ['error' => $e->getMessage()]);
} catch (Throwable $e) {
    jsonResponse(400, ['error' => $e->getMessage()]);
}

if (!$saved) {
    jsonResponse(400, [
        'error' => 'No files were uploaded',
        'failed' => $failed,
    ]);
}

$response = [
    'success' => true,
    'photos' => $saved,
    'failed' => $failed,
];
$response += $saved[0];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
