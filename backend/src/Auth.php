<?php
namespace DropZone;

/** Bearer-token admin sessions + public participant identity resolution. */
final class Auth
{
    /** Require a valid admin bearer token; returns the admin user row. */
    public static function requireAdmin(): array
    {
        $token = self::bearerToken();
        if ($token === null) {
            throw new ApiException('unauthorized', 'Missing bearer token', 401);
        }
        $stmt = Database::pdo()->prepare(
            'SELECT a.* FROM admin_sessions s
             JOIN admin_users a ON a.id = s.admin_user_id
             WHERE s.token = ? AND s.expires_at > NOW() LIMIT 1'
        );
        $stmt->execute([$token]);
        $admin = $stmt->fetch();
        if (!$admin) {
            throw new ApiException('unauthorized', 'Invalid or expired session', 401);
        }
        return $admin;
    }

    public static function login(string $email, string $password): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $admin = $stmt->fetch();
        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            throw new ApiException('invalid_credentials', 'Email or password is incorrect', 401);
        }
        $cfg = self::config();
        $token = bin2hex(random_bytes(32));
        $expires = (new \DateTimeImmutable("+{$cfg['session_ttl_hours']} hours"))->format('Y-m-d H:i:s');
        $pdo->prepare('INSERT INTO admin_sessions (token, admin_user_id, expires_at) VALUES (?,?,?)')
            ->execute([$token, $admin['id'], $expires]);
        return [
            'token'   => $token,
            'expires' => $expires,
            'admin'   => ['id' => (int)$admin['id'], 'name' => $admin['name'], 'email' => $admin['email'], 'role' => $admin['role']],
        ];
    }

    public static function logout(): void
    {
        $token = self::bearerToken();
        if ($token) {
            Database::pdo()->prepare('DELETE FROM admin_sessions WHERE token = ?')->execute([$token]);
        }
    }

    /** Resolve the public participant from X-User-Id, X-User-Identifier, or body. */
    public static function participant(array $body = []): ?array
    {
        $pdo = Database::pdo();
        $id = $_SERVER['HTTP_X_USER_ID'] ?? ($body['user_id'] ?? null);
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([(int)$id]);
            $u = $stmt->fetch();
            if ($u) return $u;
        }
        $identifier = $_SERVER['HTTP_X_USER_IDENTIFIER'] ?? ($body['identifier'] ?? null);
        if ($identifier) {
            $stmt = $pdo->prepare('SELECT * FROM users WHERE identifier = ? LIMIT 1');
            $stmt->execute([trim($identifier)]);
            $u = $stmt->fetch();
            if ($u) return $u;
        }
        return null;
    }

    public static function requireParticipant(array $body = []): array
    {
        $u = self::participant($body);
        if (!$u) {
            throw new ApiException('unknown_user', 'Enroll first or provide a valid identity', 401);
        }
        return $u;
    }

    private static function bearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($header === '' && function_exists('apache_request_headers')) {
            $header = apache_request_headers()['Authorization'] ?? '';
        }
        if (preg_match('/Bearer\s+([A-Za-z0-9]+)/', $header, $m)) {
            return $m[1];
        }
        return null;
    }

    public static function config(): array
    {
        $cfgPath = __DIR__ . '/../config/config.php';
        return is_file($cfgPath) ? require $cfgPath : require __DIR__ . '/../config/config.example.php';
    }
}
