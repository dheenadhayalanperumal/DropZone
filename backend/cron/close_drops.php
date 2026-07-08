<?php
declare(strict_types=1);
/**
 * close_drops.php — run periodically (e.g. every 5 min via crontab):
 *   [every 5 min]  php /path/DropZone/backend/cron/close_drops.php
 *
 * Promotes locked->available windows and marks elapsed, unopened boxes as missed,
 * then recomputes enrollment completion. Powers the "Missed Drops" metric.
 */

require __DIR__ . '/../src/Response.php';
spl_autoload_register(function (string $class): void {
    $prefix = 'DropZone\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $rel = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = __DIR__ . '/../src/' . $rel . '.php';
    if (is_file($file)) require $file;
});

use DropZone\DropEngine;

$missed = DropEngine::closeElapsedDrops();
fwrite(STDOUT, sprintf("[%s] close_drops: %d box(es) marked missed\n", gmdate('c'), $missed));
