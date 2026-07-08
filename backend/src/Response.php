<?php
namespace DropZone;

/** JSON response + a typed API exception for early exits. */
final class Response
{
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function error(string $code, string $message = '', int $status = 400): void
    {
        self::json(['error' => $code, 'message' => $message ?: $code], $status);
    }
}

final class ApiException extends \RuntimeException
{
    public string $errorCode;
    public int $status;

    public function __construct(string $code, string $message = '', int $status = 400)
    {
        parent::__construct($message ?: $code);
        $this->errorCode = $code;
        $this->status = $status;
    }
}
