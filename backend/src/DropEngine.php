<?php
namespace DropZone;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

/**
 * DropEngine — the server-side integrity core (analogous to Streaks' StreakEngine).
 *
 * All box/reward state is computed and stored here. The client never decides
 * win/lose or box state; it only *requests* an open, which this engine validates.
 */
final class DropEngine
{
    /**
     * Compute the number of drops for a campaign given cadence + duration.
     * Daily×30 = 30, Weekly×90 ≈ 13, Monthly×365 = 12, etc.
     */
    public static function dropCount(string $type, int $durationDays): int
    {
        return match ($type) {
            'daily'   => $durationDays,
            'weekly'  => (int)ceil($durationDays / 7),
            'monthly' => max(1, (int)floor($durationDays / 30)) ?: (int)ceil($durationDays / 30),
            default   => $durationDays,
        };
    }

    /** Effective duration in days (custom overrides the preset). */
    public static function effectiveDuration(array $campaign): int
    {
        $dur = (int)$campaign['duration_days'];
        if ($dur === 0 && !empty($campaign['custom_duration_days'])) {
            return (int)$campaign['custom_duration_days'];
        }
        return $dur ?: (int)($campaign['custom_duration_days'] ?? 30);
    }

    /**
     * Generate (or regenerate) the drop rows for a campaign. Existing drops with
     * assigned rewards/windows are preserved by drop_index; new slots are appended.
     * Returns the number of drop rows now present.
     */
    public static function generateDrops(int $campaignId): int
    {
        $pdo = Database::pdo();
        $campaign = self::campaign($campaignId);
        if (!$campaign) {
            throw new ApiException('not_found', 'Campaign not found', 404);
        }

        $type = $campaign['type'];
        $duration = self::effectiveDuration($campaign);
        $count = self::dropCount($type, $duration);
        $tz = new DateTimeZone($campaign['timezone'] ?: 'UTC');
        $grace = (int)$campaign['grace_hours'];

        // Anchor at midnight of start_date in the campaign timezone.
        $start = new DateTimeImmutable($campaign['start_date'] . ' 00:00:00', $tz);

        // Existing drops keyed by drop_index (to preserve reward assignments).
        $existing = [];
        $stmt = $pdo->prepare('SELECT drop_index FROM drops WHERE campaign_id = ?');
        $stmt->execute([$campaignId]);
        foreach ($stmt->fetchAll() as $r) {
            $existing[(int)$r['drop_index']] = true;
        }

        $ins = $pdo->prepare(
            'INSERT INTO drops (campaign_id, drop_index, period_index, title, open_at, close_at)
             VALUES (?,?,?,?,?,?)'
        );
        $utc = new DateTimeZone('UTC');
        $lastEnd = $start;

        for ($i = 1; $i <= $count; $i++) {
            [$openAt, $closeAt, $label] = self::periodWindow($type, $start, $i, $grace, $tz);
            $lastEnd = $closeAt;
            if (isset($existing[$i])) {
                continue; // preserve already-configured drop
            }
            $ins->execute([
                $campaignId,
                $i,
                self::periodIndex($type, $openAt, $tz),
                $label,
                $openAt->setTimezone($utc)->format('Y-m-d H:i:s'),
                $closeAt->setTimezone($utc)->format('Y-m-d H:i:s'),
            ]);
        }

        // Trim drops beyond the new count (only if never opened by anyone).
        $del = $pdo->prepare(
            'DELETE d FROM drops d
             LEFT JOIN boxes b ON b.drop_id = d.id AND b.status = "opened"
             WHERE d.campaign_id = ? AND d.drop_index > ? AND b.id IS NULL'
        );
        $del->execute([$campaignId, $count]);

        // Record end_date.
        $pdo->prepare('UPDATE campaigns SET end_date = ? WHERE id = ?')
            ->execute([$lastEnd->setTimezone($tz)->format('Y-m-d'), $campaignId]);

        return $count;
    }

    /** Window [open, close] for drop N in the campaign timezone (grace added to close). */
    private static function periodWindow(string $type, DateTimeImmutable $start, int $n, int $graceHours, DateTimeZone $tz): array
    {
        $graceSpec = "PT{$graceHours}H";
        switch ($type) {
            case 'weekly':
                $open  = $start->modify('+' . (($n - 1) * 7) . ' days');
                $close = $open->modify('+7 days')->modify('-1 second');
                $label = "Week {$n}";
                break;
            case 'monthly':
                $open  = $start->modify('+' . ($n - 1) . ' months');
                $close = $open->modify('+1 month')->modify('-1 second');
                $label = "Month {$n}";
                break;
            case 'daily':
            default:
                $open  = $start->modify('+' . ($n - 1) . ' days');
                $close = $open->modify('+1 day')->modify('-1 second');
                $label = "Day {$n}";
                break;
        }
        if ($graceHours > 0) {
            $close = $close->add(new \DateInterval($graceSpec));
        }
        return [$open, $close, $label];
    }

    /** Integer period index in the campaign timezone (shared daily/weekly/monthly engine). */
    public static function periodIndex(string $type, DateTimeImmutable $when, DateTimeZone $tz): int
    {
        $local = $when->setTimezone($tz);
        return match ($type) {
            'weekly'  => (int)floor((int)$local->format('U') / (7 * 86400)),
            'monthly' => ((int)$local->format('Y') * 12) + ((int)$local->format('n') - 1),
            default   => (int)floor((int)$local->format('U') / 86400),
        };
    }

    /**
     * Materialize the boxes for an enrollment (one per drop) and recompute their
     * derived states (locked/available) against "now". Terminal states are left alone.
     */
    public static function syncBoxes(int $enrollmentId, ?DateTimeImmutable $now = null): void
    {
        $pdo = Database::pdo();
        $now = $now ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $nowStr = $now->format('Y-m-d H:i:s');

        $enroll = self::enrollment($enrollmentId);
        if (!$enroll) return;

        // Create any missing boxes for this enrollment's campaign drops.
        $pdo->prepare(
            'INSERT IGNORE INTO boxes (enrollment_id, drop_id, status)
             SELECT ?, d.id, "locked" FROM drops d WHERE d.campaign_id = ?'
        )->execute([$enrollmentId, $enroll['campaign_id']]);

        // locked -> available when the window is open.
        $pdo->prepare(
            'UPDATE boxes b JOIN drops d ON d.id = b.drop_id
             SET b.status = "available"
             WHERE b.enrollment_id = ? AND b.status = "locked"
               AND d.open_at <= ? AND d.close_at >= ?'
        )->execute([$enrollmentId, $nowStr, $nowStr]);

        // locked/available -> missed when the window has fully elapsed (keeps the
        // calendar honest immediately, without waiting for the close_drops cron).
        $stmt = $pdo->prepare(
            'SELECT b.id FROM boxes b JOIN drops d ON d.id = b.drop_id
             WHERE b.enrollment_id = ? AND b.status IN ("locked","available") AND d.close_at < ?'
        );
        $stmt->execute([$enrollmentId, $nowStr]);
        $elapsed = array_column($stmt->fetchAll(), 'id');
        foreach ($elapsed as $bid) {
            $pdo->prepare('UPDATE boxes SET status = "missed" WHERE id = ?')->execute([(int)$bid]);
            self::logEvent($pdo, (int)$bid, 'miss', ['reason' => 'window_elapsed']);
        }
        if ($elapsed) {
            self::maybeCompleteEnrollment($pdo, $enrollmentId);
        }
    }

    /**
     * Open a box. Full server-side validation + idempotent, exactly-once issuance.
     * Returns the reveal payload.
     */
    public static function openBox(array $user, int $dropId, ?string $idemKey = null): array
    {
        return Database::transaction(function (PDO $pdo) use ($user, $dropId, $idemKey) {
            $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
            $nowStr = $now->format('Y-m-d H:i:s');

            // Drop + campaign, locked for update.
            $stmt = $pdo->prepare(
                'SELECT d.*, c.active AS campaign_active, c.id AS c_id
                 FROM drops d JOIN campaigns c ON c.id = d.campaign_id
                 WHERE d.id = ? FOR UPDATE'
            );
            $stmt->execute([$dropId]);
            $drop = $stmt->fetch();
            if (!$drop) {
                throw new ApiException('not_found', 'Drop not found', 404);
            }
            if (!(int)$drop['campaign_active']) {
                throw new ApiException('campaign_inactive', 'Campaign is not active', 409);
            }

            // Enrollment (must be active).
            $stmt = $pdo->prepare(
                'SELECT * FROM enrollments WHERE user_id = ? AND campaign_id = ? AND status = "active" LIMIT 1'
            );
            $stmt->execute([$user['id'], $drop['campaign_id']]);
            $enroll = $stmt->fetch();
            if (!$enroll) {
                throw new ApiException('not_enrolled', 'You are not enrolled in this campaign', 403);
            }

            // Ensure the box row exists and lock it.
            $pdo->prepare('INSERT IGNORE INTO boxes (enrollment_id, drop_id, status) VALUES (?,?, "locked")')
                ->execute([$enroll['id'], $dropId]);
            $stmt = $pdo->prepare('SELECT * FROM boxes WHERE enrollment_id = ? AND drop_id = ? FOR UPDATE');
            $stmt->execute([$enroll['id'], $dropId]);
            $box = $stmt->fetch();

            // Idempotency: replay returns the stored response.
            if ($idemKey) {
                $stmt = $pdo->prepare('SELECT response FROM idempotency_keys WHERE idem_key = ? AND box_id = ? LIMIT 1');
                $stmt->execute([$idemKey, $box['id']]);
                if ($row = $stmt->fetch()) {
                    return json_decode($row['response'], true);
                }
            }

            // Already opened -> idempotent success with existing reward.
            if ($box['status'] === 'opened') {
                return self::revealPayload($pdo, $box, 'already_opened');
            }
            if ($box['status'] === 'missed') {
                throw new ApiException('missed', 'This drop has closed', 410);
            }

            // Window checks.
            if ($now < new DateTimeImmutable($drop['open_at'], new DateTimeZone('UTC'))) {
                throw new ApiException('too_early', 'This box is not open yet', 423);
            }
            if ($now > new DateTimeImmutable($drop['close_at'], new DateTimeZone('UTC'))) {
                // Late — mark missed for correctness.
                $pdo->prepare('UPDATE boxes SET status = "missed" WHERE id = ?')->execute([$box['id']]);
                self::logEvent($pdo, $box['id'], 'miss', ['reason' => 'opened_after_close']);
                throw new ApiException('missed', 'This drop has closed', 410);
            }

            // --- Reveal & issue ---
            self::logEvent($pdo, $box['id'], 'open', ['drop_index' => (int)$drop['drop_index']]);
            $issue = self::issueReward($pdo, $box, $drop, $user, $now);

            $pdo->prepare('UPDATE boxes SET status = "opened", opened_at = ?, reward_issue_id = ? WHERE id = ?')
                ->execute([$nowStr, $issue['issue_id'] ?? null, $box['id']]);

            $box['status'] = 'opened';
            $box['opened_at'] = $nowStr;
            $box['reward_issue_id'] = $issue['issue_id'] ?? null;

            $payload = self::revealPayload($pdo, $box, 'opened');

            // Persist idempotency response.
            if ($idemKey) {
                $pdo->prepare('INSERT IGNORE INTO idempotency_keys (idem_key, box_id, response) VALUES (?,?,?)')
                    ->execute([$idemKey, $box['id'], json_encode($payload)]);
            }

            self::maybeCompleteEnrollment($pdo, $enroll['id']);
            return $payload;
        });
    }

    /**
     * Draw a reward for the box: honor the drop's assigned voucher, enforce stock,
     * fall back to "empty" when exhausted or unassigned. Writes reveal + issue events.
     */
    private static function issueReward(PDO $pdo, array $box, array $drop, array $user, DateTimeImmutable $now): array
    {
        $rewardId = $drop['reward_id'] ? (int)$drop['reward_id'] : null;
        $voucher = null;
        if ($rewardId) {
            $stmt = $pdo->prepare('SELECT * FROM vouchers WHERE id = ? AND active = 1 FOR UPDATE');
            $stmt->execute([$rewardId]);
            $voucher = $stmt->fetch() ?: null;
        }

        // Empty box (no reward assigned, inactive, exhausted, or type=empty).
        $isEmpty = !$voucher || $voucher['type'] === 'empty';
        if (!$isEmpty && $voucher['stock'] !== null && (int)$voucher['stock'] <= 0) {
            $isEmpty = true; // exhausted -> better luck next time
        }

        if ($isEmpty) {
            self::logEvent($pdo, $box['id'], 'reveal', ['result' => 'empty']);
            return ['reward' => null, 'issue_id' => null];
        }

        // Draw a code.
        $code = null;
        if ($voucher['code_mode'] === 'unique') {
            $stmt = $pdo->prepare('SELECT id, code FROM voucher_codes WHERE voucher_id = ? AND used = 0 LIMIT 1 FOR UPDATE');
            $stmt->execute([$voucher['id']]);
            $cc = $stmt->fetch();
            if (!$cc) { // pool empty -> treat as empty
                self::logEvent($pdo, $box['id'], 'reveal', ['result' => 'empty', 'reason' => 'code_pool_empty']);
                return ['reward' => null, 'issue_id' => null];
            }
            $code = $cc['code'];
            $pdo->prepare('UPDATE voucher_codes SET used = 1, used_at = ? WHERE id = ?')
                ->execute([$now->format('Y-m-d H:i:s'), $cc['id']]);
        } else {
            $code = $voucher['shared_code'];
        }

        // Decrement stock atomically.
        if ($voucher['stock'] !== null) {
            $pdo->prepare('UPDATE vouchers SET stock = stock - 1 WHERE id = ? AND stock > 0')
                ->execute([$voucher['id']]);
        }

        $expiresAt = null;
        if ($voucher['validity_days'] !== null) {
            $expiresAt = $now->modify('+' . (int)$voucher['validity_days'] . ' days')->format('Y-m-d H:i:s');
        }

        $pdo->prepare(
            'INSERT INTO reward_issues (box_id, user_id, reward_id, code, status, issued_at, expires_at)
             VALUES (?,?,?,?, "issued", ?, ?)'
        )->execute([$box['id'], $user['id'], $voucher['id'], $code, $now->format('Y-m-d H:i:s'), $expiresAt]);
        $issueId = (int)$pdo->lastInsertId();

        self::logEvent($pdo, $box['id'], 'reveal', ['result' => 'reward', 'voucher_id' => (int)$voucher['id']]);
        self::logEvent($pdo, $box['id'], 'issue', ['issue_id' => $issueId, 'code' => $code]);

        return [
            'issue_id' => $issueId,
            'reward' => [
                'issue_id'    => $issueId,
                'title'       => $voucher['title'],
                'type'        => $voucher['type'],
                'value'       => $voucher['value'],
                'image'       => $voucher['image'],
                'code'        => $code,
                'expires_at'  => $expiresAt,
            ],
        ];
    }

    /** Build the client-facing reveal payload from a box row. */
    private static function revealPayload(PDO $pdo, array $box, string $status): array
    {
        $reward = null;
        if ($box['reward_issue_id']) {
            $stmt = $pdo->prepare(
                'SELECT ri.id AS issue_id, ri.code, ri.status, ri.expires_at,
                        v.title, v.type, v.value, v.image
                 FROM reward_issues ri JOIN vouchers v ON v.id = ri.reward_id
                 WHERE ri.id = ? LIMIT 1'
            );
            $stmt->execute([$box['reward_issue_id']]);
            $reward = $stmt->fetch() ?: null;
        }
        return [
            'status'    => $status,        // opened | already_opened
            'box_id'    => (int)$box['id'],
            'opened_at' => $box['opened_at'],
            'reward'    => $reward,        // null = better luck next time
        ];
    }

    /**
     * Cron: close elapsed windows. Any locked/available box whose drop window has
     * fully elapsed becomes 'missed'. Returns count of newly-missed boxes.
     */
    public static function closeElapsedDrops(?DateTimeImmutable $now = null): int
    {
        $pdo = Database::pdo();
        $now = $now ?? new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $nowStr = $now->format('Y-m-d H:i:s');

        // Promote windows that are currently open (locked -> available) first.
        $pdo->prepare(
            'UPDATE boxes b JOIN drops d ON d.id = b.drop_id
             SET b.status = "available"
             WHERE b.status = "locked" AND d.open_at <= ? AND d.close_at >= ?'
        )->execute([$nowStr, $nowStr]);

        // Find elapsed, un-terminal boxes.
        $stmt = $pdo->prepare(
            'SELECT b.id FROM boxes b JOIN drops d ON d.id = b.drop_id
             WHERE b.status IN ("locked","available") AND d.close_at < ?'
        );
        $stmt->execute([$nowStr]);
        $ids = array_column($stmt->fetchAll(), 'id');
        if (!$ids) return 0;

        foreach (array_chunk($ids, 500) as $chunk) {
            $in = implode(',', array_fill(0, count($chunk), '?'));
            $pdo->prepare("UPDATE boxes SET status = 'missed' WHERE id IN ($in)")->execute($chunk);
            foreach ($chunk as $bid) {
                self::logEvent($pdo, (int)$bid, 'miss', ['reason' => 'window_elapsed']);
            }
        }

        // Recompute completion for affected enrollments.
        $enrollStmt = $pdo->prepare('SELECT DISTINCT enrollment_id FROM boxes WHERE id IN (' .
            implode(',', array_fill(0, count($ids), '?')) . ')');
        $enrollStmt->execute($ids);
        foreach ($enrollStmt->fetchAll() as $r) {
            self::maybeCompleteEnrollment($pdo, (int)$r['enrollment_id']);
        }

        return count($ids);
    }

    /** Mark an enrollment completed when every box has reached a terminal state. */
    public static function maybeCompleteEnrollment(PDO $pdo, int $enrollmentId): void
    {
        $stmt = $pdo->prepare(
            'SELECT
                SUM(status IN ("locked","available")) AS pending,
                SUM(status = "opened") AS opened,
                COUNT(*) AS total
             FROM boxes WHERE enrollment_id = ?'
        );
        $stmt->execute([$enrollmentId]);
        $r = $stmt->fetch();
        if ((int)$r['total'] === 0 || (int)$r['pending'] > 0) {
            return; // still in progress
        }
        $pdo->prepare('UPDATE enrollments SET status = "completed", completed_at = NOW() WHERE id = ? AND status = "active"')
            ->execute([$enrollmentId]);
        // Log a completion event against any box for the activity feed.
        $box = $pdo->query('SELECT id FROM boxes WHERE enrollment_id = ' . (int)$enrollmentId . ' LIMIT 1')->fetch();
        if ($box) {
            self::logEvent($pdo, (int)$box['id'], 'complete', ['all_opened' => (int)$r['opened'] === (int)$r['total']]);
        }
    }

    public static function logEvent(PDO $pdo, int $boxId, string $type, array $meta = []): void
    {
        $pdo->prepare('INSERT INTO box_events (box_id, type, meta) VALUES (?,?,?)')
            ->execute([$boxId, $type, json_encode($meta)]);
    }

    // --- small fetch helpers ---
    public static function campaign(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM campaigns WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function enrollment(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM enrollments WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }
}
