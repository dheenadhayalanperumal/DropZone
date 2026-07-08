<?php
namespace DropZone;

/** Request-body + basic rate-limit helpers. */
final class Helpers
{
    public static function body(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw === '') return $_POST ?: [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public static function query(string $key, $default = null)
    {
        return $_GET[$key] ?? $default;
    }

    public static function idempotencyKey(): ?string
    {
        return $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? null;
    }

    /**
     * Coarse rate limit keyed on IP + bucket, backed by the idempotency_keys-free
     * approach of a lightweight table-less token check. Uses APCu if present,
     * otherwise a file lock in the system temp dir. Fails open.
     */
    public static function rateLimit(string $bucket, int $max, int $window): void
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'cli';
        $key = "dz_rl_{$bucket}_{$ip}";
        $now = time();

        if (function_exists('apcu_fetch')) {
            $entry = apcu_fetch($key) ?: ['count' => 0, 'reset' => $now + $window];
            if ($now > $entry['reset']) {
                $entry = ['count' => 0, 'reset' => $now + $window];
            }
            $entry['count']++;
            apcu_store($key, $entry, $window);
            if ($entry['count'] > $max) {
                throw new ApiException('rate_limited', 'Too many requests, slow down', 429);
            }
            return;
        }

        // File fallback.
        $file = sys_get_temp_dir() . '/' . $key . '.json';
        $entry = ['count' => 0, 'reset' => $now + $window];
        if (is_file($file)) {
            $data = json_decode(@file_get_contents($file), true);
            if (is_array($data) && $now <= ($data['reset'] ?? 0)) {
                $entry = $data;
            }
        }
        $entry['count']++;
        @file_put_contents($file, json_encode($entry), LOCK_EX);
        if ($entry['count'] > $max) {
            throw new ApiException('rate_limited', 'Too many requests, slow down', 429);
        }
    }
}
