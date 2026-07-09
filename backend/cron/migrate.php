<?php
declare(strict_types=1);
/** Apply all migrations in filename order. Usage: php backend/cron/migrate.php */

require __DIR__ . '/../src/Response.php';
spl_autoload_register(function (string $class): void {
    $prefix = 'DropZone\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $file = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) require $file;
});

use DropZone\Database;

$pdo = Database::pdo();
$dir = __DIR__ . '/../migrations';
$files = glob($dir . '/*.sql');
sort($files);
foreach ($files as $f) {
    $sql = file_get_contents($f);
    fwrite(STDOUT, 'Applying ' . basename($f) . " ... ");
    $pdo->exec($sql);
    fwrite(STDOUT, "ok\n");
}
fwrite(STDOUT, "All migrations applied.\n");
    