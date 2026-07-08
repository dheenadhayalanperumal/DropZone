<?php
namespace DropZone\Controllers;

use DropZone\Auth;
use DropZone\Database;
use DropZone\DropEngine;
use DropZone\Helpers;
use DropZone\Response;
use DropZone\ApiException;

/** Public / customer-facing endpoints (X-User-Id / identifier convention). */
final class PublicController
{
    public function health(): void
    {
        Response::json(['ok' => true, 'service' => 'dropzone', 'time' => gmdate('c')]);
    }

    public function activeCampaigns(): void
    {
        $pdo = Database::pdo();
        $brand = $pdo->query('SELECT * FROM brand_profile WHERE id = 1')->fetch();
        unset($brand['created_at'], $brand['updated_at']);
        $campaigns = $pdo->query(
            'SELECT id, name, description, type, start_date, end_date, grace_hours, timezone
             FROM campaigns WHERE active = 1 ORDER BY start_date DESC'
        )->fetchAll();
        Response::json(['brand' => $brand, 'campaigns' => $campaigns]);
    }

    public function enroll(): void
    {
        $cfg = Auth::config();
        Helpers::rateLimit('enroll', $cfg['rate_limit']['max_enroll'], $cfg['rate_limit']['window']);
        $b = Helpers::body();
        $identifier = trim($b['identifier'] ?? '');
        $campaignId = (int)($b['campaign_id'] ?? 0);
        if ($identifier === '' || !$campaignId) {
            throw new ApiException('missing_fields', 'identifier and campaign_id required', 422);
        }
        $campaign = DropEngine::campaign($campaignId);
        if (!$campaign || !(int)$campaign['active']) {
            throw new ApiException('campaign_unavailable', 'Campaign not available', 404);
        }

        $result = Database::transaction(function ($pdo) use ($identifier, $campaignId, $b) {
            $pdo->prepare('INSERT INTO users (name, identifier) VALUES (?,?) ON DUPLICATE KEY UPDATE name = COALESCE(VALUES(name), name)')
                ->execute([$b['name'] ?? null, $identifier]);
            $u = $pdo->prepare('SELECT * FROM users WHERE identifier = ?');
            $u->execute([$identifier]);
            $user = $u->fetch();

            $pdo->prepare('INSERT IGNORE INTO enrollments (user_id, campaign_id) VALUES (?,?)')
                ->execute([$user['id'], $campaignId]);
            $e = $pdo->prepare('SELECT * FROM enrollments WHERE user_id = ? AND campaign_id = ?');
            $e->execute([$user['id'], $campaignId]);
            $enroll = $e->fetch();
            return ['user' => $user, 'enrollment' => $enroll];
        });

        DropEngine::syncBoxes((int)$result['enrollment']['id']);

        Response::json([
            'user_id'       => (int)$result['user']['id'],
            'identifier'    => $result['user']['identifier'],
            'enrollment_id' => (int)$result['enrollment']['id'],
            'campaign_id'   => $campaignId,
        ], 201);
    }

    public function calendar(): void
    {
        $user = Auth::requireParticipant();
        $campaignId = (int)Helpers::query('campaign', 0);
        if (!$campaignId) throw new ApiException('missing_fields', 'campaign query param required', 422);
        $pdo = Database::pdo();

        $e = $pdo->prepare('SELECT * FROM enrollments WHERE user_id = ? AND campaign_id = ?');
        $e->execute([$user['id'], $campaignId]);
        $enroll = $e->fetch();
        if (!$enroll) throw new ApiException('not_enrolled', 'Not enrolled in this campaign', 403);

        // Refresh derived box states before returning.
        DropEngine::syncBoxes((int)$enroll['id']);

        $stmt = $pdo->prepare(
            'SELECT d.id AS drop_id, d.drop_index, d.title, d.image, d.open_at, d.close_at,
                    b.status, b.opened_at,
                    ri.code, ri.expires_at, ri.status AS reward_status,
                    v.title AS reward_title, v.type AS reward_type, v.value AS reward_value, v.image AS reward_image
             FROM drops d
             LEFT JOIN boxes b ON b.drop_id = d.id AND b.enrollment_id = ?
             LEFT JOIN reward_issues ri ON ri.id = b.reward_issue_id
             LEFT JOIN vouchers v ON v.id = ri.reward_id
             WHERE d.campaign_id = ? ORDER BY d.drop_index'
        );
        $stmt->execute([$enroll['id'], $campaignId]);
        $drops = $stmt->fetchAll();

        // Hide unrevealed reward contents; only expose the box state + date.
        foreach ($drops as &$d) {
            if ($d['status'] !== 'opened') {
                $d['reward_title'] = $d['reward_type'] = $d['reward_value'] = $d['reward_image'] = null;
                $d['code'] = $d['expires_at'] = $d['reward_status'] = null;
            }
            $d['status'] = $d['status'] ?? 'locked';
        }

        $campaign = DropEngine::campaign($campaignId);
        Response::json([
            'campaign' => ['id' => $campaignId, 'name' => $campaign['name'], 'type' => $campaign['type']],
            'status'   => $enroll['status'],
            'drops'    => $drops,
        ]);
    }

    public function open(array $a): void
    {
        $cfg = Auth::config();
        Helpers::rateLimit('open', $cfg['rate_limit']['max_open'], $cfg['rate_limit']['window']);
        $user = Auth::requireParticipant(Helpers::body());
        $dropId = (int)$a['dropId'];
        $payload = DropEngine::openBox($user, $dropId, Helpers::idempotencyKey());
        Response::json($payload);
    }

    public function rewards(): void
    {
        $user = Auth::requireParticipant();
        $stmt = Database::pdo()->prepare(
            'SELECT ri.id, ri.code, ri.status, ri.issued_at, ri.redeemed_at, ri.expires_at,
                    v.title, v.type, v.value, v.image,
                    d.drop_index, c.name AS campaign_name
             FROM reward_issues ri
             JOIN vouchers v ON v.id = ri.reward_id
             JOIN boxes b ON b.id = ri.box_id
             JOIN drops d ON d.id = b.drop_id
             JOIN campaigns c ON c.id = d.campaign_id
             WHERE ri.user_id = ? ORDER BY ri.issued_at DESC'
        );
        $stmt->execute([$user['id']]);
        Response::json(['rewards' => $stmt->fetchAll()]);
    }

    public function redeem(array $a): void
    {
        $user = Auth::requireParticipant(Helpers::body());
        $id = (int)$a['id'];
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT * FROM reward_issues WHERE id = ? AND user_id = ? LIMIT 1');
        $stmt->execute([$id, $user['id']]);
        $issue = $stmt->fetch();
        if (!$issue) throw new ApiException('not_found', 'Reward not found', 404);
        if ($issue['status'] === 'redeemed') {
            Response::json(['ok' => true, 'status' => 'redeemed', 'note' => 'already redeemed']);
        }
        if ($issue['status'] === 'expired' ||
            ($issue['expires_at'] && new \DateTimeImmutable($issue['expires_at']) < new \DateTimeImmutable())) {
            throw new ApiException('expired', 'This reward has expired', 410);
        }
        $pdo->prepare('UPDATE reward_issues SET status = "redeemed", redeemed_at = NOW() WHERE id = ?')->execute([$id]);
        Response::json(['ok' => true, 'status' => 'redeemed']);
    }

    // ---- WhatsApp webhook (Meta-facing, reused from Streaks) ----
    public function whatsappWebhook(): void
    {
        $pdo = Database::pdo();
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            // Verification handshake.
            $verify = $pdo->query('SELECT verify_token FROM whatsapp_settings WHERE id = 1')->fetchColumn();
            $mode = $_GET['hub_mode'] ?? ($_GET['hub.mode'] ?? '');
            $token = $_GET['hub_verify_token'] ?? ($_GET['hub.verify_token'] ?? '');
            $challenge = $_GET['hub_challenge'] ?? ($_GET['hub.challenge'] ?? '');
            if ($mode === 'subscribe' && $token && hash_equals((string)$verify, (string)$token)) {
                header('Content-Type: text/plain');
                echo $challenge; exit;
            }
            Response::error('forbidden', 'verification failed', 403);
        }

        // Inbound: honor STOP / UNSUBSCRIBE opt-outs.
        $b = Helpers::body();
        $text = strtoupper(trim(self::extractText($b)));
        $from = self::extractFrom($b);
        if ($from && in_array($text, ['STOP', 'UNSUBSCRIBE'], true)) {
            $pdo->prepare('INSERT IGNORE INTO whatsapp_optouts (identifier) VALUES (?)')->execute([$from]);
        }
        Response::json(['ok' => true]);
    }

    private static function extractText(array $b): string
    {
        return $b['entry'][0]['changes'][0]['value']['messages'][0]['text']['body'] ?? '';
    }

    private static function extractFrom(array $b): ?string
    {
        return $b['entry'][0]['changes'][0]['value']['messages'][0]['from'] ?? null;
    }
}
