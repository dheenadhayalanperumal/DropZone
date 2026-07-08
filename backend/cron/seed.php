<?php
declare(strict_types=1);
/**
 * seed.php — create a demo admin, brand, vouchers, a 30-day daily campaign,
 * and a couple of enrolled users. Usage: php backend/cron/seed.php
 *
 * Default admin login:  admin@dropzone.test / dropzone123
 */

require __DIR__ . '/../src/Response.php';
spl_autoload_register(function (string $class): void {
    $prefix = 'DropZone\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $file = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) require $file;
});

use DropZone\Database;
use DropZone\DropEngine;

$pdo = Database::pdo();

// Admin
$hash = password_hash('dropzone123', PASSWORD_DEFAULT);
$pdo->prepare('INSERT INTO admin_users (name,email,password_hash,role) VALUES (?,?,?,"owner")
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)')
    ->execute(['Demo Admin', 'admin@dropzone.test', $hash]);

// Brand
$pdo->exec("UPDATE brand_profile SET name='DropZone Demo', welcome_headline='Open a box every day!' WHERE id=1");

// Vouchers
$vouchers = [
    ['Free Coffee', 'coupon', '☕ Free medium coffee', 'shared', 'COFFEE-DZ', null],
    ['10% Off', 'coupon', '10% off your order', 'shared', 'SAVE10', 500],
    ['50 Points', 'points', '50 loyalty points', 'shared', null, null],
    ['Gold Badge', 'badge', 'Collector badge', 'shared', null, null],
    ['Better luck', 'empty', null, 'shared', null, null],
];
$vids = [];
$ins = $pdo->prepare('INSERT INTO vouchers (title,type,value,code_mode,shared_code,stock,validity_days,active) VALUES (?,?,?,?,?,?,30,1)');
foreach ($vouchers as $v) {
    $ins->execute([$v[0], $v[1], $v[2], $v[3], $v[4], $v[5]]);
    $vids[] = (int)$pdo->lastInsertId();
}

// Campaign — 30-day daily, starting a week ago so some boxes are open/past.
$start = (new DateTimeImmutable('-6 days'))->format('Y-m-d');
$pdo->prepare('INSERT INTO campaigns (name,description,type,duration_days,grace_hours,timezone,start_date,active)
    VALUES (?,?,?,?,?,?,?,1)')
    ->execute(['Holiday 30-Day Advent', 'A reward a day for 30 days', 'daily', 30, 0, 'UTC', $start]);
$campaignId = (int)$pdo->lastInsertId();
DropEngine::generateDrops($campaignId);

// Assign rewards to drops in a rotation.
$drops = $pdo->query("SELECT id, drop_index FROM drops WHERE campaign_id = $campaignId ORDER BY drop_index")->fetchAll();
$upd = $pdo->prepare('UPDATE drops SET reward_id = ? WHERE id = ?');
foreach ($drops as $i => $d) {
    $upd->execute([$vids[$i % count($vids)], $d['id']]);
}

// Users + enrollments
foreach (['john@demo.test' => 'John', 'priya@demo.test' => 'Priya', 'rahul@demo.test' => 'Rahul'] as $ident => $name) {
    $pdo->prepare('INSERT INTO users (name,identifier) VALUES (?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)')
        ->execute([$name, $ident]);
    $uid = (int)$pdo->query("SELECT id FROM users WHERE identifier='" . $ident . "'")->fetchColumn();
    $pdo->prepare('INSERT IGNORE INTO enrollments (user_id,campaign_id) VALUES (?,?)')->execute([$uid, $campaignId]);
    $eid = (int)$pdo->query("SELECT id FROM enrollments WHERE user_id=$uid AND campaign_id=$campaignId")->fetchColumn();
    DropEngine::syncBoxes($eid);
}

// Close any already-elapsed windows so metrics look realistic.
DropEngine::closeElapsedDrops();

fwrite(STDOUT, "Seeded. Admin: admin@dropzone.test / dropzone123. Campaign #$campaignId.\n");
