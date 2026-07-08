<?php
// Copy to config.php and fill in. config.php is git-ignored.
return [
    'db' => [
        'host'    => getenv('DZ_DB_HOST') ?: '127.0.0.1',
        'port'    => getenv('DZ_DB_PORT') ?: '3306',
        'name'    => getenv('DZ_DB_NAME') ?: 'dropzone',
        'user'    => getenv('DZ_DB_USER') ?: 'root',
        'pass'    => getenv('DZ_DB_PASS') ?: '',
        'charset' => 'utf8mb4',
    ],
    // Comma-separated list of allowed CORS origins for the frontends.
    'cors_origins' => explode(',', getenv('DZ_CORS_ORIGINS') ?: 'http://localhost:3000'),
    'session_ttl_hours' => 24 * 7,
    // Simple in-memory-per-request rate limit fallback window (seconds).
    'rate_limit' => ['window' => 60, 'max_enroll' => 10, 'max_open' => 60],
];
