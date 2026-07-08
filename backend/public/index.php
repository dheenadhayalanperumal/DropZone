<?php
declare(strict_types=1);

/**
 * DropZone REST API — dependency-free front controller.
 * Point your web root here, or run: php -S localhost:8080 -t backend/public
 */

use DropZone\Router;
use DropZone\Response;
use DropZone\ApiException;
use DropZone\Auth;
use DropZone\Controllers\AdminController;
use DropZone\Controllers\PublicController;

// --- PSR-4-ish autoload (no composer) ---
spl_autoload_register(function (string $class): void {
    $prefix = 'DropZone\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $rel = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = __DIR__ . '/../src/' . $rel . '.php';
    if (is_file($file)) require $file;
});
// Response.php also defines ApiException in the same file.
require_once __DIR__ . '/../src/Response.php';

// --- CORS ---
$cfg = Auth::config();
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $cfg['cors_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS');
header('Access-Control-Allow-Headers: Content-Type,Authorization,X-User-Id,X-User-Identifier,Idempotency-Key');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$router = new Router();
$admin = new AdminController();
$public = new PublicController();

// ===================== Public / customer API =====================
$router->get('/api/health', [$public, 'health']);
$router->get('/api/campaigns/active', [$public, 'activeCampaigns']);
$router->post('/api/enroll', [$public, 'enroll']);
$router->get('/api/me/calendar', [$public, 'calendar']);
$router->post('/api/boxes/:dropId/open', [$public, 'open']);
$router->get('/api/me/rewards', [$public, 'rewards']);
$router->post('/api/rewards/:id/redeem', [$public, 'redeem']);
$router->get('/api/whatsapp/webhook', [$public, 'whatsappWebhook']);
$router->post('/api/whatsapp/webhook', [$public, 'whatsappWebhook']);

// ===================== Admin API (Bearer) =====================
$router->post('/api/admin/login', [$admin, 'login']);
$router->post('/api/admin/logout', [$admin, 'logout']);

$router->get('/api/admin/brand', [$admin, 'getBrand']);
$router->put('/api/admin/brand', [$admin, 'updateBrand']);
$router->post('/api/admin/upload', [$admin, 'upload']);

$router->get('/api/admin/vouchers', [$admin, 'listVouchers']);
$router->post('/api/admin/vouchers', [$admin, 'createVoucher']);
$router->put('/api/admin/vouchers/:id', [$admin, 'updateVoucher']);
$router->delete('/api/admin/vouchers/:id', [$admin, 'deleteVoucher']);

$router->get('/api/admin/campaigns', [$admin, 'listCampaigns']);
$router->post('/api/admin/campaigns', [$admin, 'createCampaign']);
$router->get('/api/admin/campaigns/:id', [$admin, 'getCampaign']);
$router->put('/api/admin/campaigns/:id', [$admin, 'updateCampaign']);
$router->delete('/api/admin/campaigns/:id', [$admin, 'deleteCampaign']);
$router->get('/api/admin/campaigns/:id/drops', [$admin, 'listDrops']);
$router->post('/api/admin/campaigns/:id/drops/bulk', [$admin, 'bulkDrops']);
$router->put('/api/admin/drops/:id', [$admin, 'updateDrop']);

$router->get('/api/admin/users', [$admin, 'listUsers']);
$router->get('/api/admin/users/:id', [$admin, 'getUser']);
$router->post('/api/admin/users/:id/adjust-box', [$admin, 'adjustBox']);
$router->patch('/api/admin/reward-issues/:id', [$admin, 'patchRewardIssue']);

$router->get('/api/admin/stats', [$admin, 'stats']);
$router->get('/api/admin/analytics', [$admin, 'analytics']);
$router->get('/api/admin/activity', [$admin, 'activity']);

$router->get('/api/admin/whatsapp/settings', [$admin, 'whatsappSettings']);
$router->put('/api/admin/whatsapp/settings', [$admin, 'whatsappSettings']);
$router->get('/api/admin/whatsapp/status', [$admin, 'whatsappStatus']);
$router->get('/api/admin/whatsapp/templates', [$admin, 'whatsappTemplates']);
$router->post('/api/admin/whatsapp/templates', [$admin, 'whatsappTemplates']);
$router->patch('/api/admin/whatsapp/templates/:id', [$admin, 'updateTemplate']);
$router->post('/api/admin/whatsapp/broadcast', [$admin, 'whatsappBroadcast']);
$router->get('/api/admin/whatsapp/messages', [$admin, 'whatsappMessages']);

// --- Dispatch with unified error handling ---
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
try {
    $router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $path);
} catch (ApiException $e) {
    Response::error($e->errorCode, $e->getMessage(), $e->status);
} catch (\Throwable $e) {
    // Log server-side; return a generic error to clients.
    error_log('[dropzone] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error('server_error', 'Something went wrong', 500);
}
