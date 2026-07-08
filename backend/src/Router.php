<?php
namespace DropZone;

/** Tiny regex router. Patterns use :param placeholders. */
final class Router
{
    /** @var array<int,array{method:string,regex:string,params:string[],handler:callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $params = [];
        $regex = preg_replace_callback('#:([a-zA-Z_]+)#', function ($m) use (&$params) {
            $params[] = $m[1];
            return '([^/]+)';
        }, $pattern);
        $this->routes[] = [
            'method'  => strtoupper($method),
            'regex'   => '#^' . $regex . '/?$#',
            'params'  => $params,
            'handler' => $handler,
        ];
    }

    public function get(string $p, callable $h): void    { $this->add('GET', $p, $h); }
    public function post(string $p, callable $h): void   { $this->add('POST', $p, $h); }
    public function put(string $p, callable $h): void    { $this->add('PUT', $p, $h); }
    public function patch(string $p, callable $h): void  { $this->add('PATCH', $p, $h); }
    public function delete(string $p, callable $h): void { $this->add('DELETE', $p, $h); }

    public function dispatch(string $method, string $path): void
    {
        $matchedPath = false;
        foreach ($this->routes as $r) {
            if (!preg_match($r['regex'], $path, $m)) {
                continue;
            }
            $matchedPath = true;
            if ($r['method'] !== strtoupper($method)) {
                continue;
            }
            $args = [];
            foreach ($r['params'] as $i => $name) {
                $args[$name] = urldecode($m[$i + 1]);
            }
            call_user_func($r['handler'], $args);
            return;
        }
        if ($matchedPath) {
            Response::error('method_not_allowed', 'Method not allowed for this path', 405);
        }
        Response::error('not_found', 'No such endpoint', 404);
    }
}
