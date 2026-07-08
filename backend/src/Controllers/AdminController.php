<?php
namespace DropZone\Controllers;

use DropZone\Auth;
use DropZone\Database;
use DropZone\DropEngine;
use DropZone\Helpers;
use DropZone\Response;
use DropZone\ApiException;

/** All /api/admin/* endpoints (Bearer token, except /login). */
final class AdminController
{
    // ---- Auth ----
    public function login(): void
    {
        $b = Helpers::body();
        $email = trim($b['email'] ?? '');
        $password = $b['password'] ?? '';
        if ($email === '' || $password === '') {
            throw new ApiException('missing_fields', 'email and password required', 422);
        }
        Response::json(Auth::login($email, $password));
    }

    public function logout(): void
    {
        Auth::requireAdmin();
        Auth::logout();
        Response::json(['ok' => true]);
    }

    // ---- Branding ----
    public function getBrand(): void
    {
        Auth::requireAdmin();
        $row = Database::pdo()->query('SELECT * FROM brand_profile WHERE id = 1')->fetch();
        Response::json($row ?: []);
    }

    public function updateBrand(): void
    {
        Auth::requireAdmin();
        $b = Helpers::body();
        $fields = ['name','logo','tagline','favicon','primary_color','accent_color','background_color',
            'box_closed_image','box_opened_image','box_missed_image','reveal_style',
            'welcome_headline','opened_message','missed_message'];
        $set = [];
        $vals = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; }
        }
        if ($set) {
            $vals[] = 1;
            Database::pdo()->prepare('UPDATE brand_profile SET ' . implode(',', $set) . ' WHERE id = ?')->execute($vals);
        }
        $row = Database::pdo()->query('SELECT * FROM brand_profile WHERE id = 1')->fetch();
        Response::json($row);
    }

    /** Accept a base64 image data URL, store it under public/uploads, return its URL. */
    public function upload(): void
    {
        Auth::requireAdmin();
        $b = Helpers::body();
        $data = $b['data'] ?? '';
        if (!preg_match('#^data:(image/(png|jpe?g|webp|gif|svg\+xml));base64,(.+)$#s', $data, $m)) {
            throw new ApiException('bad_file', 'Expected a base64 image data URL', 422);
        }
        $extMap = [
            'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/jpg' => 'jpg',
            'image/webp' => 'webp', 'image/gif' => 'gif', 'image/svg+xml' => 'svg',
        ];
        $ext = $extMap[$m[1]] ?? 'png';
        $bytes = base64_decode($m[3], true);
        if ($bytes === false) throw new ApiException('bad_file', 'Invalid base64 data', 422);
        if (strlen($bytes) > 3_000_000) throw new ApiException('too_large', 'Image exceeds 3MB', 413);

        $dir = __DIR__ . '/../../public/uploads';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $name = 'logo_' . bin2hex(random_bytes(6)) . '.' . $ext;
        if (file_put_contents("$dir/$name", $bytes) === false) {
            throw new ApiException('write_failed', 'Could not store the file', 500);
        }
        Response::json(['url' => '/uploads/' . $name], 201);
    }

    // ---- Vouchers ----
    public function listVouchers(): void
    {
        Auth::requireAdmin();
        $rows = Database::pdo()->query(
            'SELECT v.*,
                (SELECT COUNT(*) FROM reward_issues ri WHERE ri.reward_id = v.id) AS issued,
                (SELECT COUNT(*) FROM reward_issues ri WHERE ri.reward_id = v.id AND ri.status = "redeemed") AS redeemed,
                (SELECT COUNT(*) FROM reward_issues ri WHERE ri.reward_id = v.id AND ri.status = "expired") AS expired
             FROM vouchers v ORDER BY v.created_at DESC'
        )->fetchAll();
        Response::json(['vouchers' => $rows]);
    }

    public function createVoucher(): void
    {
        Auth::requireAdmin();
        $b = Helpers::body();
        if (empty($b['title'])) throw new ApiException('missing_fields', 'title required', 422);
        $pdo = Database::pdo();
        $pdo->prepare(
            'INSERT INTO vouchers (title, description, image, type, value, code_mode, shared_code, stock, validity_days, active)
             VALUES (?,?,?,?,?,?,?,?,?,?)'
        )->execute([
            $b['title'], $b['description'] ?? null, $b['image'] ?? null,
            $b['type'] ?? 'coupon', $b['value'] ?? null,
            $b['code_mode'] ?? 'shared', $b['shared_code'] ?? null,
            $b['stock'] ?? null, $b['validity_days'] ?? null,
            isset($b['active']) ? (int)!!$b['active'] : 1,
        ]);
        $id = (int)$pdo->lastInsertId();
        if (($b['code_mode'] ?? '') === 'unique' && !empty($b['codes']) && is_array($b['codes'])) {
            $ins = $pdo->prepare('INSERT IGNORE INTO voucher_codes (voucher_id, code) VALUES (?,?)');
            foreach ($b['codes'] as $c) { $ins->execute([$id, trim($c)]); }
        }
        Response::json($this->voucher($id), 201);
    }

    public function updateVoucher(array $a): void
    {
        Auth::requireAdmin();
        $id = (int)$a['id'];
        $b = Helpers::body();
        $fields = ['title','description','image','type','value','code_mode','shared_code','stock','validity_days','active'];
        $set = []; $vals = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; }
        }
        if ($set) {
            $vals[] = $id;
            Database::pdo()->prepare('UPDATE vouchers SET ' . implode(',', $set) . ' WHERE id = ?')->execute($vals);
        }
        if (!empty($b['codes']) && is_array($b['codes'])) {
            $ins = Database::pdo()->prepare('INSERT IGNORE INTO voucher_codes (voucher_id, code) VALUES (?,?)');
            foreach ($b['codes'] as $c) { $ins->execute([$id, trim($c)]); }
        }
        Response::json($this->voucher($id));
    }

    public function deleteVoucher(array $a): void
    {
        Auth::requireAdmin();
        Database::pdo()->prepare('DELETE FROM vouchers WHERE id = ?')->execute([(int)$a['id']]);
        Response::json(['ok' => true]);
    }

    private function voucher(int $id): array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM vouchers WHERE id = ?');
        $stmt->execute([$id]);
        $v = $stmt->fetch();
        if (!$v) throw new ApiException('not_found', 'Voucher not found', 404);
        $c = Database::pdo()->prepare('SELECT COUNT(*) n, SUM(used) used FROM voucher_codes WHERE voucher_id = ?');
        $c->execute([$id]);
        $v['code_pool'] = $c->fetch();
        return $v;
    }

    // ---- Campaigns ----
    public function listCampaigns(): void
    {
        Auth::requireAdmin();
        $rows = Database::pdo()->query(
            'SELECT c.*, (SELECT COUNT(*) FROM drops d WHERE d.campaign_id = c.id) AS drop_count,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.campaign_id = c.id) AS enrolled
             FROM campaigns c ORDER BY c.created_at DESC'
        )->fetchAll();
        Response::json(['campaigns' => $rows]);
    }

    public function createCampaign(): void
    {
        Auth::requireAdmin();
        $b = Helpers::body();
        if (empty($b['name']) || empty($b['start_date'])) {
            throw new ApiException('missing_fields', 'name and start_date required', 422);
        }
        $pdo = Database::pdo();
        $pdo->prepare(
            'INSERT INTO campaigns (name, description, type, duration_days, custom_duration_days, grace_hours, timezone, start_date, active)
             VALUES (?,?,?,?,?,?,?,?,?)'
        )->execute([
            $b['name'], $b['description'] ?? null, $b['type'] ?? 'daily',
            (int)($b['duration_days'] ?? 30), $b['custom_duration_days'] ?? null,
            (int)($b['grace_hours'] ?? 0), $b['timezone'] ?? 'UTC',
            $b['start_date'], isset($b['active']) ? (int)!!$b['active'] : 1,
        ]);
        $id = (int)$pdo->lastInsertId();
        DropEngine::generateDrops($id);
        Response::json($this->campaignFull($id), 201);
    }

    public function getCampaign(array $a): void
    {
        Auth::requireAdmin();
        Response::json($this->campaignFull((int)$a['id']));
    }

    public function updateCampaign(array $a): void
    {
        Auth::requireAdmin();
        $id = (int)$a['id'];
        $b = Helpers::body();
        $fields = ['name','description','type','duration_days','custom_duration_days','grace_hours','timezone','start_date','end_date','active'];
        $set = []; $vals = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; }
        }
        if ($set) {
            $vals[] = $id;
            Database::pdo()->prepare('UPDATE campaigns SET ' . implode(',', $set) . ' WHERE id = ?')->execute($vals);
        }
        // Regenerate drops if cadence/duration/start changed.
        if (array_intersect(['type','duration_days','custom_duration_days','start_date','grace_hours','timezone'], array_keys($b))) {
            DropEngine::generateDrops($id);
        }
        Response::json($this->campaignFull($id));
    }

    public function deleteCampaign(array $a): void
    {
        Auth::requireAdmin();
        Database::pdo()->prepare('DELETE FROM campaigns WHERE id = ?')->execute([(int)$a['id']]);
        Response::json(['ok' => true]);
    }

    public function listDrops(array $a): void
    {
        Auth::requireAdmin();
        $stmt = Database::pdo()->prepare(
            'SELECT d.*, v.title AS reward_title, v.type AS reward_type, v.value AS reward_value
             FROM drops d LEFT JOIN vouchers v ON v.id = d.reward_id
             WHERE d.campaign_id = ? ORDER BY d.drop_index'
        );
        $stmt->execute([(int)$a['id']]);
        Response::json(['drops' => $stmt->fetchAll()]);
    }

    public function updateDrop(array $a): void
    {
        Auth::requireAdmin();
        $id = (int)$a['id'];
        $b = Helpers::body();
        $fields = ['reward_id','title','image','open_at','close_at'];
        $set = []; $vals = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f] === '' ? null : $b[$f]; }
        }
        if (!$set) throw new ApiException('nothing_to_update', 'No fields provided', 422);
        $vals[] = $id;
        Database::pdo()->prepare('UPDATE drops SET ' . implode(',', $set) . ' WHERE id = ?')->execute($vals);
        $stmt = Database::pdo()->prepare('SELECT * FROM drops WHERE id = ?');
        $stmt->execute([$id]);
        Response::json($stmt->fetch());
    }

    public function bulkDrops(array $a): void
    {
        Auth::requireAdmin();
        $campaignId = (int)$a['id'];
        $b = Helpers::body();
        $action = $b['action'] ?? 'fill';        // fill | clear
        $from = (int)($b['from'] ?? 1);
        $to = (int)($b['to'] ?? 1);
        $rewardId = $b['reward_id'] ?? null;
        $pdo = Database::pdo();
        if ($action === 'clear') {
            $pdo->prepare('UPDATE drops SET reward_id = NULL WHERE campaign_id = ? AND drop_index BETWEEN ? AND ?')
                ->execute([$campaignId, $from, $to]);
        } else {
            $pdo->prepare('UPDATE drops SET reward_id = ? WHERE campaign_id = ? AND drop_index BETWEEN ? AND ?')
                ->execute([$rewardId, $campaignId, $from, $to]);
        }
        $stmt = $pdo->prepare('SELECT * FROM drops WHERE campaign_id = ? ORDER BY drop_index');
        $stmt->execute([$campaignId]);
        Response::json(['drops' => $stmt->fetchAll()]);
    }

    private function campaignFull(int $id): array
    {
        $c = DropEngine::campaign($id);
        if (!$c) throw new ApiException('not_found', 'Campaign not found', 404);
        $stmt = Database::pdo()->prepare(
            'SELECT d.*, v.title AS reward_title, v.type AS reward_type
             FROM drops d LEFT JOIN vouchers v ON v.id = d.reward_id
             WHERE d.campaign_id = ? ORDER BY d.drop_index'
        );
        $stmt->execute([$id]);
        $c['drops'] = $stmt->fetchAll();
        return $c;
    }

    // ---- Users ----
    public function listUsers(): void
    {
        Auth::requireAdmin();
        $rows = Database::pdo()->query(
            'SELECT u.*,
                (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS campaigns,
                (SELECT COUNT(*) FROM reward_issues ri WHERE ri.user_id = u.id) AS rewards
             FROM users u ORDER BY u.created_at DESC LIMIT 500'
        )->fetchAll();
        Response::json(['users' => $rows]);
    }

    public function getUser(array $a): void
    {
        Auth::requireAdmin();
        $id = (int)$a['id'];
        $pdo = Database::pdo();
        $u = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $u->execute([$id]);
        $user = $u->fetch();
        if (!$user) throw new ApiException('not_found', 'User not found', 404);

        $boxes = $pdo->prepare(
            'SELECT b.*, d.drop_index, d.title AS drop_title, d.campaign_id, c.name AS campaign_name
             FROM boxes b
             JOIN enrollments e ON e.id = b.enrollment_id
             JOIN drops d ON d.id = b.drop_id
             JOIN campaigns c ON c.id = d.campaign_id
             WHERE e.user_id = ? ORDER BY d.campaign_id, d.drop_index'
        );
        $boxes->execute([$id]);

        $rewards = $pdo->prepare(
            'SELECT ri.*, v.title, v.type, v.value FROM reward_issues ri JOIN vouchers v ON v.id = ri.reward_id
             WHERE ri.user_id = ? ORDER BY ri.issued_at DESC'
        );
        $rewards->execute([$id]);

        // Full activity timeline for this user (every box transition).
        $events = $pdo->prepare(
            'SELECT ev.id, ev.type, ev.meta, ev.created_at,
                    d.drop_index, d.title AS drop_title, c.name AS campaign_name
             FROM box_events ev
             JOIN boxes b ON b.id = ev.box_id
             JOIN enrollments e ON e.id = b.enrollment_id
             JOIN drops d ON d.id = b.drop_id
             JOIN campaigns c ON c.id = d.campaign_id
             WHERE e.user_id = ? ORDER BY ev.id DESC LIMIT 200'
        );
        $events->execute([$id]);
        $evRows = $events->fetchAll();
        foreach ($evRows as &$ev) { $ev['meta'] = $ev['meta'] ? json_decode($ev['meta'], true) : null; }

        $user['boxes'] = $boxes->fetchAll();
        $user['rewards'] = $rewards->fetchAll();
        $user['events'] = $evRows;
        Response::json($user);
    }

    public function adjustBox(array $a): void
    {
        $admin = Auth::requireAdmin();
        $userId = (int)$a['id'];
        $b = Helpers::body();
        $boxId = (int)($b['box_id'] ?? 0);
        $newStatus = $b['status'] ?? null;   // e.g. re-open a missed box -> "available"
        if (!$boxId || !$newStatus) throw new ApiException('missing_fields', 'box_id and status required', 422);
        $pdo = Database::pdo();
        // Verify the box belongs to the user.
        $chk = $pdo->prepare(
            'SELECT b.id FROM boxes b JOIN enrollments e ON e.id = b.enrollment_id
             WHERE b.id = ? AND e.user_id = ?'
        );
        $chk->execute([$boxId, $userId]);
        if (!$chk->fetch()) throw new ApiException('not_found', 'Box not found for user', 404);

        $pdo->prepare('UPDATE boxes SET status = ? WHERE id = ?')->execute([$newStatus, $boxId]);
        DropEngine::logEvent($pdo, $boxId, 'adjust', [
            'by' => $admin['email'], 'to' => $newStatus, 'note' => $b['note'] ?? null,
        ]);
        Response::json(['ok' => true]);
    }

    public function patchRewardIssue(array $a): void
    {
        Auth::requireAdmin();
        $id = (int)$a['id'];
        $b = Helpers::body();
        $status = $b['status'] ?? null;   // redeemed | expired | issued
        if (!in_array($status, ['issued','redeemed','expired'], true)) {
            throw new ApiException('bad_status', 'status must be issued|redeemed|expired', 422);
        }
        $col = $status === 'redeemed' ? ', redeemed_at = NOW()' : '';
        Database::pdo()->prepare("UPDATE reward_issues SET status = ?$col WHERE id = ?")->execute([$status, $id]);
        Response::json(['ok' => true]);
    }

    // ---- Stats / Analytics / Activity ----
    public function stats(): void
    {
        Auth::requireAdmin();
        $campaign = Helpers::query('campaign');
        $where = $campaign ? 'AND d.campaign_id = ' . (int)$campaign : '';
        $pdo = Database::pdo();

        $registered = (int)$pdo->query(
            'SELECT COUNT(DISTINCT e.user_id) FROM enrollments e' .
            ($campaign ? ' WHERE e.campaign_id = ' . (int)$campaign : '')
        )->fetchColumn();

        $q = fn(string $status) => (int)$pdo->query(
            "SELECT COUNT(*) FROM boxes b JOIN drops d ON d.id = b.drop_id WHERE b.status = '$status' $where"
        )->fetchColumn();
        $opened = $q('opened');
        $missed = $q('missed');
        $available = (int)$pdo->query(
            "SELECT COUNT(*) FROM boxes b JOIN drops d ON d.id = b.drop_id
             WHERE b.status IN ('opened','missed','available') $where"
        )->fetchColumn();

        $rewardsClaimed = (int)$pdo->query(
            'SELECT COUNT(*) FROM reward_issues ri JOIN boxes b ON b.id = ri.box_id
             JOIN drops d ON d.id = b.drop_id WHERE 1 ' . $where
        )->fetchColumn();

        $enrolled = (int)$pdo->query(
            'SELECT COUNT(*) FROM enrollments e' . ($campaign ? ' WHERE e.campaign_id = ' . (int)$campaign : '')
        )->fetchColumn();
        $completed = (int)$pdo->query(
            "SELECT COUNT(*) FROM enrollments e WHERE e.status = 'completed'" .
            ($campaign ? ' AND e.campaign_id = ' . (int)$campaign : '')
        )->fetchColumn();

        Response::json([
            'registered_users' => $registered,
            'boxes_opened'     => $opened,
            'rewards_claimed'  => $rewardsClaimed,
            'open_rate'        => $available ? round($opened / $available * 100, 1) : 0.0,
            'missed_drops'     => $missed,
            'completion_rate'  => $enrolled ? round($completed / $enrolled * 100, 1) : 0.0,
        ]);
    }

    public function analytics(): void
    {
        Auth::requireAdmin();
        $campaign = Helpers::query('campaign');
        $cWhere = $campaign ? 'AND d.campaign_id = ' . (int)$campaign : '';
        $pdo = Database::pdo();

        // Daily opens (last 30 days of activity).
        $dailyOpens = $pdo->query(
            "SELECT DATE(b.opened_at) AS day, COUNT(*) AS opens
             FROM boxes b JOIN drops d ON d.id = b.drop_id
             WHERE b.status = 'opened' $cWhere
             GROUP BY DATE(b.opened_at) ORDER BY day"
        )->fetchAll();

        // Reward distribution.
        $rewardDist = $pdo->query(
            "SELECT v.title, v.type, COUNT(*) AS claimed
             FROM reward_issues ri JOIN vouchers v ON v.id = ri.reward_id
             JOIN boxes b ON b.id = ri.box_id JOIN drops d ON d.id = b.drop_id
             WHERE 1 $cWhere GROUP BY ri.reward_id ORDER BY claimed DESC"
        )->fetchAll();

        // Per-drop performance table.
        $perDrop = $pdo->query(
            "SELECT d.drop_index, d.title,
                SUM(b.status IN ('opened','missed','available')) AS available,
                SUM(b.status = 'opened') AS opened,
                SUM(b.status = 'missed') AS missed
             FROM drops d LEFT JOIN boxes b ON b.drop_id = d.id
             WHERE 1 $cWhere GROUP BY d.id ORDER BY d.drop_index"
        )->fetchAll();
        foreach ($perDrop as &$row) {
            $av = (int)$row['available'];
            $row['open_rate'] = $av ? round((int)$row['opened'] / $av * 100, 1) : 0.0;
        }

        // Redemption funnel.
        $funnel = $pdo->query(
            "SELECT
                SUM(ri.status IN ('issued','redeemed','expired')) AS issued,
                SUM(ri.status = 'redeemed') AS redeemed,
                SUM(ri.status = 'expired') AS expired
             FROM reward_issues ri JOIN boxes b ON b.id = ri.box_id
             JOIN drops d ON d.id = b.drop_id WHERE 1 $cWhere"
        )->fetch();

        Response::json([
            'daily_opens'        => $dailyOpens,
            'reward_distribution'=> $rewardDist,
            'per_drop'           => $perDrop,
            'redemption_funnel'  => $funnel,
        ]);
    }

    public function activity(): void
    {
        Auth::requireAdmin();
        $limit = min(100, max(1, (int)(Helpers::query('limit', 40))));
        $rows = Database::pdo()->query(
            "SELECT ev.id, ev.type, ev.meta, ev.created_at,
                    u.name AS user_name, u.identifier,
                    d.drop_index, c.name AS campaign_name
             FROM box_events ev
             JOIN boxes b ON b.id = ev.box_id
             JOIN enrollments e ON e.id = b.enrollment_id
             JOIN users u ON u.id = e.user_id
             JOIN drops d ON d.id = b.drop_id
             JOIN campaigns c ON c.id = d.campaign_id
             WHERE ev.type IN ('open','miss','complete')
             ORDER BY ev.id DESC LIMIT $limit"
        )->fetchAll();
        foreach ($rows as &$r) { $r['meta'] = $r['meta'] ? json_decode($r['meta'], true) : null; }
        Response::json(['activity' => $rows]);
    }

    // ---- WhatsApp (reused module surface) ----
    public function whatsappSettings(): void
    {
        Auth::requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            $b = Helpers::body();
            $fields = ['mode','phone_number_id','access_token','verify_token','business_acct_id'];
            $set = []; $vals = [];
            foreach ($fields as $f) { if (array_key_exists($f, $b)) { $set[] = "$f = ?"; $vals[] = $b[$f]; } }
            if ($set) { $vals[] = 1; Database::pdo()->prepare('UPDATE whatsapp_settings SET ' . implode(',', $set) . ' WHERE id = ?')->execute($vals); }
        }
        $row = Database::pdo()->query('SELECT * FROM whatsapp_settings WHERE id = 1')->fetch();
        unset($row['access_token']); // never leak the token back
        Response::json($row);
    }

    public function whatsappStatus(): void
    {
        Auth::requireAdmin();
        $row = Database::pdo()->query('SELECT mode, phone_number_id FROM whatsapp_settings WHERE id = 1')->fetch();
        Response::json(['mode' => $row['mode'] ?? 'simulation', 'configured' => !empty($row['phone_number_id'])]);
    }

    public function whatsappTemplates(): void
    {
        Auth::requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $b = Helpers::body();
            Database::pdo()->prepare(
                'INSERT INTO whatsapp_templates (name, language, category, body, status) VALUES (?,?,?,?,?)'
            )->execute([$b['name'], $b['language'] ?? 'en', $b['category'] ?? 'MARKETING', $b['body'] ?? '', $b['status'] ?? 'draft']);
        }
        $rows = Database::pdo()->query('SELECT * FROM whatsapp_templates ORDER BY id DESC')->fetchAll();
        Response::json(['templates' => $rows]);
    }

    public function updateTemplate(array $a): void
    {
        Auth::requireAdmin();
        $id = (int)$a['id'];
        $b = Helpers::body();
        $status = $b['status'] ?? null;   // draft | approved | rejected
        if (!in_array($status, ['draft','approved','rejected'], true)) {
            throw new ApiException('bad_status', 'status must be draft|approved|rejected', 422);
        }
        Database::pdo()->prepare('UPDATE whatsapp_templates SET status = ? WHERE id = ?')->execute([$status, $id]);
        Response::json(['ok' => true, 'status' => $status]);
    }

    public function whatsappBroadcast(): void
    {
        $admin = Auth::requireAdmin();
        $b = Helpers::body();
        $pdo = Database::pdo();
        $mode = $pdo->query('SELECT mode FROM whatsapp_settings WHERE id = 1')->fetchColumn() ?: 'simulation';

        // Resolve the template (approved templates only can be sent).
        $templateId = (int)($b['template_id'] ?? 0);
        $tpl = null;
        if ($templateId) {
            $t = $pdo->prepare('SELECT * FROM whatsapp_templates WHERE id = ?');
            $t->execute([$templateId]);
            $tpl = $t->fetch() ?: null;
            if ($tpl && $tpl['status'] !== 'approved') {
                throw new ApiException('template_not_approved', 'Only approved templates can be sent', 409);
            }
        }
        $body = trim($b['body'] ?? ($tpl['body'] ?? ''));
        if ($body === '') throw new ApiException('missing_body', 'A template or message body is required', 422);

        // Resolve recipients: explicit user_ids[] or all enrolled users, minus opt-outs.
        $userIds = array_values(array_filter(array_map('intval', (array)($b['user_ids'] ?? []))));
        if ($userIds) {
            $in = implode(',', array_fill(0, count($userIds), '?'));
            $stmt = $pdo->prepare("SELECT identifier FROM users WHERE id IN ($in)");
            $stmt->execute($userIds);
            $audience = count($userIds) . ' selected user' . (count($userIds) === 1 ? '' : 's');
        } else {
            $stmt = $pdo->query('SELECT identifier FROM users');
            $audience = 'All users';
        }
        $identifiers = $stmt->fetchAll(\PDO::FETCH_COLUMN);
        $optouts = $pdo->query('SELECT identifier FROM whatsapp_optouts')->fetchAll(\PDO::FETCH_COLUMN);
        $recipients = count(array_diff($identifiers, $optouts));

        $status = $mode === 'live' ? 'sent' : 'simulated';
        $pdo->prepare(
            'INSERT INTO whatsapp_messages (template_id, template_name, body, audience, recipients, status, sent_by)
             VALUES (?,?,?,?,?,?,?)'
        )->execute([
            $templateId ?: null, $tpl['name'] ?? null, $body, $audience, $recipients, $status, $admin['email'] ?? null,
        ]);

        Response::json([
            'ok' => true,
            'mode' => $mode,
            'status' => $status,
            'recipients' => $recipients,
            'audience' => $audience,
            'note' => $mode === 'simulation' ? 'Simulated — no live message sent' : 'Broadcast sent',
        ], 201);
    }

    public function whatsappMessages(): void
    {
        Auth::requireAdmin();
        $rows = Database::pdo()->query('SELECT * FROM whatsapp_messages ORDER BY id DESC LIMIT 200')->fetchAll();
        Response::json(['messages' => $rows]);
    }
}
