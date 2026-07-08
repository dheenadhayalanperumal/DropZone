<?php
namespace DropZone;

use PDO;

/** Thin PDO wrapper — dependency-free, matches Streaks conventions. */
final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }
        $cfgPath = __DIR__ . '/../config/config.php';
        $cfg = is_file($cfgPath)
            ? require $cfgPath
            : require __DIR__ . '/../config/config.example.php';
        $db = $cfg['db'];
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $db['host'], $db['port'], $db['name'], $db['charset']
        );
        self::$pdo = new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        return self::$pdo;
    }

    /** Run $fn inside a transaction, committing on success. */
    public static function transaction(callable $fn)
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $result = $fn($pdo);
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
