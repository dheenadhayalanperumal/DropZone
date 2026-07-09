-- =============================================================
-- DropZone — Complete Dummy Dataset
-- Generated for: 2026-07-09 (today's reference date)
--
-- Usage:
--   mysql -uroot -p < backend/dummy_data.sql
--
-- Includes: all tables, 2 campaigns, 5 users, full box/reward history
-- Demo admin login: admin@dropzone.test / password  (see note in section 1)
-- =============================================================

CREATE DATABASE IF NOT EXISTS dropzone
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dropzone;

-- ---------------------------------------------------------------
-- Schema (idempotent — mirrors all 8 migrations)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('owner','admin','viewer') NOT NULL DEFAULT 'admin',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  token         CHAR(64) NOT NULL,
  admin_user_id INT UNSIGNED NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL,
  PRIMARY KEY (token),
  KEY idx_sessions_admin (admin_user_id),
  CONSTRAINT fk_sessions_admin FOREIGN KEY (admin_user_id)
    REFERENCES admin_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_profile (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name             VARCHAR(120) NOT NULL DEFAULT 'DropZone',
  tagline          VARCHAR(255) DEFAULT NULL,
  logo             VARCHAR(512) NULL,
  favicon          VARCHAR(512) NULL,
  primary_color    CHAR(7) NOT NULL DEFAULT '#6d28d9',
  accent_color     CHAR(7) NOT NULL DEFAULT '#f59e0b',
  background_color CHAR(7) NOT NULL DEFAULT '#0b0b12',
  box_closed_image VARCHAR(512) NULL,
  box_opened_image VARCHAR(512) NULL,
  box_missed_image VARCHAR(512) NULL,
  reveal_style     ENUM('flip','unwrap','confetti') NOT NULL DEFAULT 'unwrap',
  welcome_headline VARCHAR(255) NOT NULL DEFAULT 'Open a box, win a reward.',
  opened_message   VARCHAR(255) NOT NULL DEFAULT 'You unlocked a reward!',
  missed_message   VARCHAR(255) NOT NULL DEFAULT 'This drop has closed. Catch the next one!',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vouchers (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title         VARCHAR(160) NOT NULL,
  description   VARCHAR(500) NULL,
  image         VARCHAR(512) NULL,
  type          ENUM('coupon','points','badge','custom','empty') NOT NULL DEFAULT 'coupon',
  value         VARCHAR(120) NULL,
  code_mode     ENUM('shared','unique') NOT NULL DEFAULT 'shared',
  shared_code   VARCHAR(120) NULL,
  stock         INT NULL,
  validity_days INT UNSIGNED NULL,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vouchers_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher_codes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  voucher_id INT UNSIGNED NOT NULL,
  code       VARCHAR(120) NOT NULL,
  used       TINYINT(1) NOT NULL DEFAULT 0,
  used_at    DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_voucher_code (voucher_id, code),
  KEY idx_codes_available (voucher_id, used),
  CONSTRAINT fk_codes_voucher FOREIGN KEY (voucher_id)
    REFERENCES vouchers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                 VARCHAR(160) NOT NULL,
  description          VARCHAR(500) NULL,
  type                 ENUM('daily','weekly','monthly') NOT NULL DEFAULT 'daily',
  duration_days        INT UNSIGNED NOT NULL DEFAULT 30,
  custom_duration_days INT UNSIGNED NULL,
  grace_hours          INT UNSIGNED NOT NULL DEFAULT 0,
  timezone             VARCHAR(64) NOT NULL DEFAULT 'UTC',
  start_date           DATE NOT NULL,
  end_date             DATE NULL,
  active               TINYINT(1) NOT NULL DEFAULT 1,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campaigns_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drops (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id  INT UNSIGNED NOT NULL,
  drop_index   INT UNSIGNED NOT NULL,
  period_index INT NOT NULL,
  reward_id    INT UNSIGNED NULL,
  title        VARCHAR(160) NULL,
  image        VARCHAR(512) NULL,
  open_at      DATETIME NOT NULL,
  close_at     DATETIME NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_drop_period (campaign_id, drop_index),
  KEY idx_drops_window (campaign_id, open_at, close_at),
  CONSTRAINT fk_drops_campaign FOREIGN KEY (campaign_id)
    REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT fk_drops_reward FOREIGN KEY (reward_id)
    REFERENCES vouchers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(160) NULL,
  identifier VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  campaign_id  INT UNSIGNED NOT NULL,
  joined_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status       ENUM('active','left','completed') NOT NULL DEFAULT 'active',
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollment (user_id, campaign_id),
  KEY idx_enroll_campaign (campaign_id),
  CONSTRAINT fk_enroll_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_campaign FOREIGN KEY (campaign_id)
    REFERENCES campaigns (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS boxes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrollment_id   INT UNSIGNED NOT NULL,
  drop_id         INT UNSIGNED NOT NULL,
  status          ENUM('locked','available','opened','missed') NOT NULL DEFAULT 'locked',
  opened_at       DATETIME NULL,
  reward_issue_id INT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_box (enrollment_id, drop_id),
  KEY idx_box_status (status),
  KEY idx_box_drop (drop_id),
  CONSTRAINT fk_box_enrollment FOREIGN KEY (enrollment_id)
    REFERENCES enrollments (id) ON DELETE CASCADE,
  CONSTRAINT fk_box_drop FOREIGN KEY (drop_id)
    REFERENCES drops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS box_events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  box_id     INT UNSIGNED NOT NULL,
  type       ENUM('open','miss','reveal','issue','adjust','enroll','complete') NOT NULL,
  meta       JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_events_box (box_id),
  KEY idx_events_type_time (type, created_at),
  CONSTRAINT fk_events_box FOREIGN KEY (box_id)
    REFERENCES boxes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reward_issues (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  box_id      INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  reward_id   INT UNSIGNED NOT NULL,
  code        VARCHAR(120) NULL,
  status      ENUM('issued','redeemed','expired') NOT NULL DEFAULT 'issued',
  issued_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  redeemed_at DATETIME NULL,
  expires_at  DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_issue_box (box_id),
  KEY idx_issue_user (user_id),
  KEY idx_issue_reward (reward_id),
  KEY idx_issue_status (status),
  CONSTRAINT fk_issue_box FOREIGN KEY (box_id)
    REFERENCES boxes (id) ON DELETE CASCADE,
  CONSTRAINT fk_issue_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_issue_reward FOREIGN KEY (reward_id)
    REFERENCES vouchers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idem_key     VARCHAR(120) NOT NULL,
  box_id       INT UNSIGNED NOT NULL,
  response     JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_idem (idem_key, box_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mode              ENUM('simulation','live') NOT NULL DEFAULT 'simulation',
  phone_number_id   VARCHAR(64) NULL,
  access_token      VARCHAR(512) NULL,
  verify_token      VARCHAR(120) NULL,
  business_acct_id  VARCHAR(64) NULL,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  language   VARCHAR(12) NOT NULL DEFAULT 'en',
  category   VARCHAR(40) NOT NULL DEFAULT 'MARKETING',
  body       TEXT NOT NULL,
  status     ENUM('draft','approved','rejected') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_template_name (name, language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_optouts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  identifier VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_optout (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  template_id   INT UNSIGNED NULL,
  template_name VARCHAR(120) NULL,
  body          TEXT NOT NULL,
  audience      VARCHAR(120) NOT NULL DEFAULT 'All users',
  recipients    INT UNSIGNED NOT NULL DEFAULT 0,
  status        ENUM('simulated','sent','failed') NOT NULL DEFAULT 'simulated',
  sent_by       VARCHAR(190) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_msg_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- 1. Admin users
-- All admin accounts use password: "password"  (bcrypt cost=10)
-- To change to 'dropzone123', run after importing:
--   UPDATE admin_users SET password_hash = PASSWORD_HASH_HERE;
-- Or just run: php backend/cron/seed.php  (overwrites admin row with dropzone123)
-- ---------------------------------------------------------------
INSERT INTO admin_users (id, name, email, password_hash, role, created_at) VALUES
(1, 'Demo Admin',    'admin@dropzone.test',  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner',  '2026-06-01 10:00:00'),
(2, 'Campaign Mgr',  'manager@dropzone.test','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',  '2026-06-05 09:00:00'),
(3, 'Report Viewer', 'viewer@dropzone.test', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'viewer', '2026-06-10 08:00:00')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role);

-- ---------------------------------------------------------------
-- 2. Brand profile
-- ---------------------------------------------------------------
INSERT INTO brand_profile (id, name, tagline, primary_color, accent_color, background_color,
  reveal_style, welcome_headline, opened_message, missed_message)
VALUES (1, 'DropZone Demo', 'Open a box every day!', '#6d28d9', '#f59e0b', '#0b0b12',
  'confetti', 'Open a box every day — win amazing rewards!',
  'Congratulations! You unlocked a reward!',
  'This drop has closed. Catch the next one!')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), tagline = VALUES(tagline),
  primary_color = VALUES(primary_color), accent_color = VALUES(accent_color),
  reveal_style = VALUES(reveal_style),
  welcome_headline = VALUES(welcome_headline),
  opened_message = VALUES(opened_message),
  missed_message = VALUES(missed_message);

-- ---------------------------------------------------------------
-- 3. Vouchers
-- ---------------------------------------------------------------
INSERT INTO vouchers (id, title, description, type, value, code_mode, shared_code, stock, validity_days, active) VALUES
(1, 'Free Coffee',       'Redeem for a free medium coffee at any outlet.',        'coupon', 'Free medium coffee', 'shared', 'COFFEE-DZ',  NULL, 30,   1),
(2, '10% Off',           'Get 10% off your next purchase — no minimum spend.',    'coupon', '10% off',            'shared', 'SAVE10',      500, 14,   1),
(3, '50 Loyalty Points', 'Earn 50 points added to your loyalty account.',         'points', '50 pts',             'shared', NULL,          NULL, NULL, 1),
(4, 'Gold Badge',        'Unlock the exclusive Gold Collector badge.',            'badge',  'Gold Badge',         'shared', NULL,          NULL, NULL, 1),
(5, 'Surprise Gift',     'A handpicked surprise gift — collect your unique code.','coupon', 'Surprise Gift',      'unique', NULL,           100, 60,   1),
(6, 'Better Luck Next Time', 'Keep opening boxes for a chance to win!',          'empty',  NULL,                 'shared', NULL,          NULL, NULL, 1)
ON DUPLICATE KEY UPDATE title = VALUES(title), stock = VALUES(stock);

-- Unique code pool for voucher 5 (Surprise Gift)
INSERT INTO voucher_codes (id, voucher_id, code, used, used_at) VALUES
( 1, 5, 'GIFT-A1B2', 1, '2026-07-03 14:23:11'),
( 2, 5, 'GIFT-C3D4', 1, '2026-07-03 18:05:44'),
( 3, 5, 'GIFT-E5F6', 1, '2026-07-05 09:30:22'),
( 4, 5, 'GIFT-G7H8', 0, NULL),
( 5, 5, 'GIFT-I9J0', 0, NULL),
( 6, 5, 'GIFT-K1L2', 0, NULL),
( 7, 5, 'GIFT-M3N4', 0, NULL),
( 8, 5, 'GIFT-O5P6', 0, NULL),
( 9, 5, 'GIFT-Q7R8', 0, NULL),
(10, 5, 'GIFT-S9T0', 0, NULL)
ON DUPLICATE KEY UPDATE used = VALUES(used), used_at = VALUES(used_at);

-- ---------------------------------------------------------------
-- 4. WhatsApp settings & templates
-- ---------------------------------------------------------------
INSERT INTO whatsapp_settings (id, mode, verify_token) VALUES (1, 'simulation', 'dz-verify-token-2026')
ON DUPLICATE KEY UPDATE mode = VALUES(mode);

INSERT INTO whatsapp_templates (id, name, language, category, body, status, created_at) VALUES
(1, 'drop_reminder',  'en', 'MARKETING', 'Hi {{1}}! Your daily DropZone box is open right now. Tap to open it before midnight! 🎁', 'approved', '2026-06-15 10:00:00'),
(2, 'reward_issued',  'en', 'MARKETING', 'Great news {{1}}! You just won: {{2}}. Use code {{3}} before it expires. 🎉',            'approved', '2026-06-15 10:05:00'),
(3, 'enrollment_welcome', 'en', 'MARKETING', 'Welcome to DropZone, {{1}}! Your first box opens tomorrow at midnight. Stay tuned! 📦', 'approved', '2026-06-20 09:00:00'),
(4, 'campaign_launch','en', 'MARKETING', 'A new campaign is live on DropZone! Join now and start winning daily rewards. 🚀',          'draft',    '2026-07-01 08:00:00')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ---------------------------------------------------------------
-- 5. Campaigns
-- Campaign 1: 30-day daily (started 6 days ago, active)
-- Campaign 2: 8-week weekly (started 8 days ago, active)
-- ---------------------------------------------------------------
INSERT INTO campaigns (id, name, description, type, duration_days, grace_hours, timezone, start_date, end_date, active, created_at) VALUES
(1, 'Summer Daily Adventure',
   'Open a mystery box every day for 30 days and win exciting rewards.',
   'daily', 30, 0, 'UTC', '2026-07-03', '2026-08-01', 1, '2026-07-02 12:00:00'),
(2, 'Weekly Winners',
   'Eight weeks of big weekly prizes — open your box any time during the week.',
   'weekly', 56, 2, 'UTC', '2026-07-01', '2026-08-25', 1, '2026-06-28 10:00:00')
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);

-- ---------------------------------------------------------------
-- 6. Drops
-- Campaign 1 (daily): drop_ids 1-30
--   period_index baseline: floor(UNIX_TIMESTAMP('2026-07-03') / 86400) = 20635
--   Drops 1-6  : past windows (close_at < 2026-07-09 00:00:00 UTC)
--   Drop 7     : today's window (2026-07-09)
--   Drops 8-30 : future (locked)
--
-- Campaign 2 (weekly): drop_ids 31-38
--   period_index baseline: floor(UNIX_TIMESTAMP('2026-07-01') / (7*86400)) = 2947
--   Drop 31 (Week 1): 2026-07-01 – 2026-07-07  (past)
--   Drop 32 (Week 2): 2026-07-08 – 2026-07-14  (current)
--   Drops 33-38: future
--
-- Reward rotation (campaign 1): voucher ids cycle 1,2,3,4,5,6,1,2,...
-- ---------------------------------------------------------------

-- Campaign 1 drops
INSERT INTO drops (id, campaign_id, drop_index, period_index, reward_id, title, open_at, close_at) VALUES
-- Past drops (1-6)
( 1, 1,  1, 20635, 1, 'Day 1',  '2026-07-03 00:00:00', '2026-07-03 23:59:59'),
( 2, 1,  2, 20636, 2, 'Day 2',  '2026-07-04 00:00:00', '2026-07-04 23:59:59'),
( 3, 1,  3, 20637, 3, 'Day 3',  '2026-07-05 00:00:00', '2026-07-05 23:59:59'),
( 4, 1,  4, 20638, 4, 'Day 4',  '2026-07-06 00:00:00', '2026-07-06 23:59:59'),
( 5, 1,  5, 20639, 5, 'Day 5',  '2026-07-07 00:00:00', '2026-07-07 23:59:59'),
( 6, 1,  6, 20640, 6, 'Day 6',  '2026-07-08 00:00:00', '2026-07-08 23:59:59'),
-- Today (drop 7)
( 7, 1,  7, 20641, 1, 'Day 7',  '2026-07-09 00:00:00', '2026-07-09 23:59:59'),
-- Future drops (8-30)
( 8, 1,  8, 20642, 2, 'Day 8',  '2026-07-10 00:00:00', '2026-07-10 23:59:59'),
( 9, 1,  9, 20643, 3, 'Day 9',  '2026-07-11 00:00:00', '2026-07-11 23:59:59'),
(10, 1, 10, 20644, 4, 'Day 10', '2026-07-12 00:00:00', '2026-07-12 23:59:59'),
(11, 1, 11, 20645, 5, 'Day 11', '2026-07-13 00:00:00', '2026-07-13 23:59:59'),
(12, 1, 12, 20646, 6, 'Day 12', '2026-07-14 00:00:00', '2026-07-14 23:59:59'),
(13, 1, 13, 20647, 1, 'Day 13', '2026-07-15 00:00:00', '2026-07-15 23:59:59'),
(14, 1, 14, 20648, 2, 'Day 14', '2026-07-16 00:00:00', '2026-07-16 23:59:59'),
(15, 1, 15, 20649, 3, 'Day 15', '2026-07-17 00:00:00', '2026-07-17 23:59:59'),
(16, 1, 16, 20650, 4, 'Day 16', '2026-07-18 00:00:00', '2026-07-18 23:59:59'),
(17, 1, 17, 20651, 5, 'Day 17', '2026-07-19 00:00:00', '2026-07-19 23:59:59'),
(18, 1, 18, 20652, 6, 'Day 18', '2026-07-20 00:00:00', '2026-07-20 23:59:59'),
(19, 1, 19, 20653, 1, 'Day 19', '2026-07-21 00:00:00', '2026-07-21 23:59:59'),
(20, 1, 20, 20654, 2, 'Day 20', '2026-07-22 00:00:00', '2026-07-22 23:59:59'),
(21, 1, 21, 20655, 3, 'Day 21', '2026-07-23 00:00:00', '2026-07-23 23:59:59'),
(22, 1, 22, 20656, 4, 'Day 22', '2026-07-24 00:00:00', '2026-07-24 23:59:59'),
(23, 1, 23, 20657, 5, 'Day 23', '2026-07-25 00:00:00', '2026-07-25 23:59:59'),
(24, 1, 24, 20658, 6, 'Day 24', '2026-07-26 00:00:00', '2026-07-26 23:59:59'),
(25, 1, 25, 20659, 1, 'Day 25', '2026-07-27 00:00:00', '2026-07-27 23:59:59'),
(26, 1, 26, 20660, 2, 'Day 26', '2026-07-28 00:00:00', '2026-07-28 23:59:59'),
(27, 1, 27, 20661, 3, 'Day 27', '2026-07-29 00:00:00', '2026-07-29 23:59:59'),
(28, 1, 28, 20662, 4, 'Day 28', '2026-07-30 00:00:00', '2026-07-30 23:59:59'),
(29, 1, 29, 20663, 5, 'Day 29', '2026-07-31 00:00:00', '2026-07-31 23:59:59'),
(30, 1, 30, 20664, 6, 'Day 30', '2026-08-01 00:00:00', '2026-08-01 23:59:59'),
-- Campaign 2 weekly drops (grace_hours=2, so close_at = end_of_week + 2h)
(31, 2, 1, 2947, 2, 'Week 1', '2026-07-01 00:00:00', '2026-07-08 01:59:59'),
(32, 2, 2, 2948, 3, 'Week 2', '2026-07-08 00:00:00', '2026-07-15 01:59:59'),
(33, 2, 3, 2949, 4, 'Week 3', '2026-07-15 00:00:00', '2026-07-22 01:59:59'),
(34, 2, 4, 2950, 5, 'Week 4', '2026-07-22 00:00:00', '2026-07-29 01:59:59'),
(35, 2, 5, 2951, 1, 'Week 5', '2026-07-29 00:00:00', '2026-08-05 01:59:59'),
(36, 2, 6, 2952, 2, 'Week 6', '2026-08-05 00:00:00', '2026-08-12 01:59:59'),
(37, 2, 7, 2953, 3, 'Week 7', '2026-08-12 00:00:00', '2026-08-19 01:59:59'),
(38, 2, 8, 2954, 4, 'Week 8', '2026-08-19 00:00:00', '2026-08-26 01:59:59')
ON DUPLICATE KEY UPDATE reward_id = VALUES(reward_id), title = VALUES(title);

-- ---------------------------------------------------------------
-- 7. Users
-- ---------------------------------------------------------------
INSERT INTO users (id, name, identifier, created_at) VALUES
(1, 'John Doe',     'john@demo.test',    '2026-07-02 20:00:00'),
(2, 'Priya Sharma', 'priya@demo.test',   '2026-07-02 21:30:00'),
(3, 'Rahul Verma',  'rahul@demo.test',   '2026-07-03 07:45:00'),
(4, 'Alice Tan',    'alice@demo.test',   '2026-07-02 18:00:00'),
(5, 'Bob Lim',      '+6591234567',       '2026-07-09 08:15:00')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------------------------------------------------------------
-- 8. Enrollments
-- ---------------------------------------------------------------
INSERT INTO enrollments (id, user_id, campaign_id, joined_at, status) VALUES
(1, 1, 1, '2026-07-02 20:05:00', 'active'),   -- John  → Campaign 1
(2, 2, 1, '2026-07-02 21:35:00', 'active'),   -- Priya → Campaign 1
(3, 3, 1, '2026-07-03 07:50:00', 'active'),   -- Rahul → Campaign 1
(4, 4, 1, '2026-07-02 18:10:00', 'active'),   -- Alice → Campaign 1
(5, 5, 1, '2026-07-09 08:20:00', 'active'),   -- Bob   → Campaign 1 (joined today)
(6, 1, 2, '2026-07-01 10:00:00', 'active'),   -- John  → Campaign 2
(7, 2, 2, '2026-07-01 11:00:00', 'active')    -- Priya → Campaign 2
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ---------------------------------------------------------------
-- 9. Boxes  (reward_issue_id set to NULL first; updated after reward_issues insert)
--
-- Enrollment 1 = John   (campaign 1, drops 1-30)
-- Enrollment 2 = Priya  (campaign 1, drops 1-30)
-- Enrollment 3 = Rahul  (campaign 1, drops 1-30)
-- Enrollment 4 = Alice  (campaign 1, drops 1-30)
-- Enrollment 5 = Bob    (campaign 1, drops 1-30, joined today)
-- Enrollment 6 = John   (campaign 2, drops 31-38)
-- Enrollment 7 = Priya  (campaign 2, drops 31-38)
--
-- Box ID ranges:
--   1-30   : John   C1
--   31-60  : Priya  C1
--   61-90  : Rahul  C1
--   91-120 : Alice  C1
--  121-150 : Bob    C1
--  151-158 : John   C2
--  159-166 : Priya  C2
-- ---------------------------------------------------------------

-- John (enrollment 1): opened D1-D6, available D7, locked D8-D30
INSERT INTO boxes (id, enrollment_id, drop_id, status, opened_at, reward_issue_id) VALUES
  -- opened
  ( 1, 1,  1, 'opened', '2026-07-03 14:23:11', NULL),
  ( 2, 1,  2, 'opened', '2026-07-04 09:08:55', NULL),
  ( 3, 1,  3, 'opened', '2026-07-05 20:44:02', NULL),
  ( 4, 1,  4, 'opened', '2026-07-06 11:31:19', NULL),
  ( 5, 1,  5, 'opened', '2026-07-07 08:02:33', NULL),
  ( 6, 1,  6, 'opened', '2026-07-08 16:22:07', NULL),
  -- today: available
  ( 7, 1,  7, 'available', NULL, NULL),
  -- future: locked
  ( 8, 1,  8, 'locked', NULL, NULL),
  ( 9, 1,  9, 'locked', NULL, NULL),
  (10, 1, 10, 'locked', NULL, NULL),
  (11, 1, 11, 'locked', NULL, NULL),
  (12, 1, 12, 'locked', NULL, NULL),
  (13, 1, 13, 'locked', NULL, NULL),
  (14, 1, 14, 'locked', NULL, NULL),
  (15, 1, 15, 'locked', NULL, NULL),
  (16, 1, 16, 'locked', NULL, NULL),
  (17, 1, 17, 'locked', NULL, NULL),
  (18, 1, 18, 'locked', NULL, NULL),
  (19, 1, 19, 'locked', NULL, NULL),
  (20, 1, 20, 'locked', NULL, NULL),
  (21, 1, 21, 'locked', NULL, NULL),
  (22, 1, 22, 'locked', NULL, NULL),
  (23, 1, 23, 'locked', NULL, NULL),
  (24, 1, 24, 'locked', NULL, NULL),
  (25, 1, 25, 'locked', NULL, NULL),
  (26, 1, 26, 'locked', NULL, NULL),
  (27, 1, 27, 'locked', NULL, NULL),
  (28, 1, 28, 'locked', NULL, NULL),
  (29, 1, 29, 'locked', NULL, NULL),
  (30, 1, 30, 'locked', NULL, NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status), opened_at = VALUES(opened_at);

-- Priya (enrollment 2): opened D1,D3,D5; missed D2,D4,D6; available D7; locked D8-D30
INSERT INTO boxes (id, enrollment_id, drop_id, status, opened_at, reward_issue_id) VALUES
  (31, 2,  1, 'opened', '2026-07-03 19:11:00', NULL),
  (32, 2,  2, 'missed', NULL, NULL),
  (33, 2,  3, 'opened', '2026-07-05 12:55:30', NULL),
  (34, 2,  4, 'missed', NULL, NULL),
  (35, 2,  5, 'opened', '2026-07-07 22:40:18', NULL),
  (36, 2,  6, 'missed', NULL, NULL),
  (37, 2,  7, 'available', NULL, NULL),
  (38, 2,  8, 'locked', NULL, NULL),
  (39, 2,  9, 'locked', NULL, NULL),
  (40, 2, 10, 'locked', NULL, NULL),
  (41, 2, 11, 'locked', NULL, NULL),
  (42, 2, 12, 'locked', NULL, NULL),
  (43, 2, 13, 'locked', NULL, NULL),
  (44, 2, 14, 'locked', NULL, NULL),
  (45, 2, 15, 'locked', NULL, NULL),
  (46, 2, 16, 'locked', NULL, NULL),
  (47, 2, 17, 'locked', NULL, NULL),
  (48, 2, 18, 'locked', NULL, NULL),
  (49, 2, 19, 'locked', NULL, NULL),
  (50, 2, 20, 'locked', NULL, NULL),
  (51, 2, 21, 'locked', NULL, NULL),
  (52, 2, 22, 'locked', NULL, NULL),
  (53, 2, 23, 'locked', NULL, NULL),
  (54, 2, 24, 'locked', NULL, NULL),
  (55, 2, 25, 'locked', NULL, NULL),
  (56, 2, 26, 'locked', NULL, NULL),
  (57, 2, 27, 'locked', NULL, NULL),
  (58, 2, 28, 'locked', NULL, NULL),
  (59, 2, 29, 'locked', NULL, NULL),
  (60, 2, 30, 'locked', NULL, NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status), opened_at = VALUES(opened_at);

-- Rahul (enrollment 3): all missed D1-D6, available D7, locked D8-D30
INSERT INTO boxes (id, enrollment_id, drop_id, status, opened_at, reward_issue_id) VALUES
  (61, 3,  1, 'missed', NULL, NULL),
  (62, 3,  2, 'missed', NULL, NULL),
  (63, 3,  3, 'missed', NULL, NULL),
  (64, 3,  4, 'missed', NULL, NULL),
  (65, 3,  5, 'missed', NULL, NULL),
  (66, 3,  6, 'missed', NULL, NULL),
  (67, 3,  7, 'available', NULL, NULL),
  (68, 3,  8, 'locked', NULL, NULL),
  (69, 3,  9, 'locked', NULL, NULL),
  (70, 3, 10, 'locked', NULL, NULL),
  (71, 3, 11, 'locked', NULL, NULL),
  (72, 3, 12, 'locked', NULL, NULL),
  (73, 3, 13, 'locked', NULL, NULL),
  (74, 3, 14, 'locked', NULL, NULL),
  (75, 3, 15, 'locked', NULL, NULL),
  (76, 3, 16, 'locked', NULL, NULL),
  (77, 3, 17, 'locked', NULL, NULL),
  (78, 3, 18, 'locked', NULL, NULL),
  (79, 3, 19, 'locked', NULL, NULL),
  (80, 3, 20, 'locked', NULL, NULL),
  (81, 3, 21, 'locked', NULL, NULL),
  (82, 3, 22, 'locked', NULL, NULL),
  (83, 3, 23, 'locked', NULL, NULL),
  (84, 3, 24, 'locked', NULL, NULL),
  (85, 3, 25, 'locked', NULL, NULL),
  (86, 3, 26, 'locked', NULL, NULL),
  (87, 3, 27, 'locked', NULL, NULL),
  (88, 3, 28, 'locked', NULL, NULL),
  (89, 3, 29, 'locked', NULL, NULL),
  (90, 3, 30, 'locked', NULL, NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Alice (enrollment 4): opened D1-D3, missed D4-D6, available D7, locked D8-D30
INSERT INTO boxes (id, enrollment_id, drop_id, status, opened_at, reward_issue_id) VALUES
  ( 91, 4,  1, 'opened', '2026-07-03 10:00:01', NULL),
  ( 92, 4,  2, 'opened', '2026-07-04 15:33:00', NULL),
  ( 93, 4,  3, 'opened', '2026-07-05 08:20:45', NULL),
  ( 94, 4,  4, 'missed', NULL, NULL),
  ( 95, 4,  5, 'missed', NULL, NULL),
  ( 96, 4,  6, 'missed', NULL, NULL),
  ( 97, 4,  7, 'available', NULL, NULL),
  ( 98, 4,  8, 'locked', NULL, NULL),
  ( 99, 4,  9, 'locked', NULL, NULL),
  (100, 4, 10, 'locked', NULL, NULL),
  (101, 4, 11, 'locked', NULL, NULL),
  (102, 4, 12, 'locked', NULL, NULL),
  (103, 4, 13, 'locked', NULL, NULL),
  (104, 4, 14, 'locked', NULL, NULL),
  (105, 4, 15, 'locked', NULL, NULL),
  (106, 4, 16, 'locked', NULL, NULL),
  (107, 4, 17, 'locked', NULL, NULL),
  (108, 4, 18, 'locked', NULL, NULL),
  (109, 4, 19, 'locked', NULL, NULL),
  (110, 4, 20, 'locked', NULL, NULL),
  (111, 4, 21, 'locked', NULL, NULL),
  (112, 4, 22, 'locked', NULL, NULL),
  (113, 4, 23, 'locked', NULL, NULL),
  (114, 4, 24, 'locked', NULL, NULL),
  (115, 4, 25, 'locked', NULL, NULL),
  (116, 4, 26, 'locked', NULL, NULL),
  (117, 4, 27, 'locked', NULL, NULL),
  (118, 4, 28, 'locked', NULL, NULL),
  (119, 4, 29, 'locked', NULL, NULL),
  (120, 4, 30, 'locked', NULL, NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status), opened_at = VALUES(opened_at);

-- Bob (enrollment 5): joined today — D1-D6 already missed, D7 available, D8-D30 locked
INSERT INTO boxes (id, enrollment_id, drop_id, status, opened_at, reward_issue_id) VALUES
  (121, 5,  1, 'missed', NULL, NULL),
  (122, 5,  2, 'missed', NULL, NULL),
  (123, 5,  3, 'missed', NULL, NULL),
  (124, 5,  4, 'missed', NULL, NULL),
  (125, 5,  5, 'missed', NULL, NULL),
  (126, 5,  6, 'missed', NULL, NULL),
  (127, 5,  7, 'available', NULL, NULL),
  (128, 5,  8, 'locked', NULL, NULL),
  (129, 5,  9, 'locked', NULL, NULL),
  (130, 5, 10, 'locked', NULL, NULL),
  (131, 5, 11, 'locked', NULL, NULL),
  (132, 5, 12, 'locked', NULL, NULL),
  (133, 5, 13, 'locked', NULL, NULL),
  (134, 5, 14, 'locked', NULL, NULL),
  (135, 5, 15, 'locked', NULL, NULL),
  (136, 5, 16, 'locked', NULL, NULL),
  (137, 5, 17, 'locked', NULL, NULL),
  (138, 5, 18, 'locked', NULL, NULL),
  (139, 5, 19, 'locked', NULL, NULL),
  (140, 5, 20, 'locked', NULL, NULL),
  (141, 5, 21, 'locked', NULL, NULL),
  (142, 5, 22, 'locked', NULL, NULL),
  (143, 5, 23, 'locked', NULL, NULL),
  (144, 5, 24, 'locked', NULL, NULL),
  (145, 5, 25, 'locked', NULL, NULL),
  (146, 5, 26, 'locked', NULL, NULL),
  (147, 5, 27, 'locked', NULL, NULL),
  (148, 5, 28, 'locked', NULL, NULL),
  (149, 5, 29, 'locked', NULL, NULL),
  (150, 5, 30, 'locked', NULL, NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- John in Campaign 2 (enrollment 6): opened Week 1, available Week 2, locked W3-W8
INSERT INTO boxes (id, enrollment_id, drop_id, status, opened_at, reward_issue_id) VALUES
  (151, 6, 31, 'opened',    '2026-07-05 16:00:00', NULL),
  (152, 6, 32, 'available', NULL, NULL),
  (153, 6, 33, 'locked',    NULL, NULL),
  (154, 6, 34, 'locked',    NULL, NULL),
  (155, 6, 35, 'locked',    NULL, NULL),
  (156, 6, 36, 'locked',    NULL, NULL),
  (157, 6, 37, 'locked',    NULL, NULL),
  (158, 6, 38, 'locked',    NULL, NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status), opened_at = VALUES(opened_at);

-- Priya in Campaign 2 (enrollment 7): missed Week 1, available Week 2, locked W3-W8
INSERT INTO boxes (id, enrollment_id, drop_id, status, opened_at, reward_issue_id) VALUES
  (159, 7, 31, 'missed',    NULL, NULL),
  (160, 7, 32, 'available', NULL, NULL),
  (161, 7, 33, 'locked',    NULL, NULL),
  (162, 7, 34, 'locked',    NULL, NULL),
  (163, 7, 35, 'locked',    NULL, NULL),
  (164, 7, 36, 'locked',    NULL, NULL),
  (165, 7, 37, 'locked',    NULL, NULL),
  (166, 7, 38, 'locked',    NULL, NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ---------------------------------------------------------------
-- 10. Reward issues
--
-- Opened boxes that carry a non-empty voucher get a reward_issue.
-- Drop 6 is voucher 6 (Better Luck / empty) → no issue.
--
-- John  boxes 1-5  (drops 1-5, vouchers 1-5)
-- Priya boxes 31,33,35 (drops 1,3,5, vouchers 1,3,5)
-- Alice boxes 91-93 (drops 1-3, vouchers 1-3)
-- John C2 box 151 (drop 31 → voucher 2)
-- ---------------------------------------------------------------
INSERT INTO reward_issues (id, box_id, user_id, reward_id, code, status, issued_at, redeemed_at, expires_at) VALUES
-- John: D1 Free Coffee (redeemed)
 (1,  1, 1, 1, 'COFFEE-DZ', 'redeemed', '2026-07-03 14:23:12', '2026-07-04 10:00:00', '2026-08-02 14:23:12'),
-- John: D2 10% Off (issued)
 (2,  2, 1, 2, 'SAVE10',    'issued',   '2026-07-04 09:08:56', NULL,                   '2026-07-18 09:08:56'),
-- John: D3 50 Points (redeemed)
 (3,  3, 1, 3, NULL,        'redeemed', '2026-07-05 20:44:03', '2026-07-06 09:00:00', NULL),
-- John: D4 Gold Badge (issued)
 (4,  4, 1, 4, NULL,        'issued',   '2026-07-06 11:31:20', NULL,                   NULL),
-- John: D5 Surprise Gift unique code
 (5,  5, 1, 5, 'GIFT-A1B2', 'issued',   '2026-07-07 08:02:34', NULL,                   '2026-09-05 08:02:34'),
-- D6 is empty (Better Luck) → no reward_issue for box 6
-- Priya: D1 Free Coffee (issued)
 (6, 31, 2, 1, 'COFFEE-DZ', 'issued',   '2026-07-03 19:11:01', NULL,                   '2026-08-02 19:11:01'),
-- Priya: D3 50 Points (issued)
 (7, 33, 2, 3, NULL,        'issued',   '2026-07-05 12:55:31', NULL,                   NULL),
-- Priya: D5 Surprise Gift unique code
 (8, 35, 2, 5, 'GIFT-C3D4', 'issued',   '2026-07-07 22:40:19', NULL,                   '2026-09-05 22:40:19'),
-- Alice: D1 Free Coffee (expired)
 (9, 91, 4, 1, 'COFFEE-DZ', 'expired',  '2026-07-03 10:00:02', NULL,                   '2026-07-03 23:59:59'),
-- Alice: D2 10% Off (issued)
(10, 92, 4, 2, 'SAVE10',    'issued',   '2026-07-04 15:33:01', NULL,                   '2026-07-18 15:33:01'),
-- Alice: D3 50 Points (issued)
(11, 93, 4, 3, NULL,        'issued',   '2026-07-05 08:20:46', NULL,                   NULL),
-- John C2: Week 1 → 10% Off
(12, 151, 1, 2, 'SAVE10',   'issued',   '2026-07-05 16:00:01', NULL,                   '2026-07-19 16:00:01')
ON DUPLICATE KEY UPDATE status = VALUES(status), redeemed_at = VALUES(redeemed_at);

-- ---------------------------------------------------------------
-- 11. Link reward_issue_id back into opened boxes
-- ---------------------------------------------------------------
UPDATE boxes SET reward_issue_id =  1 WHERE id =  1;
UPDATE boxes SET reward_issue_id =  2 WHERE id =  2;
UPDATE boxes SET reward_issue_id =  3 WHERE id =  3;
UPDATE boxes SET reward_issue_id =  4 WHERE id =  4;
UPDATE boxes SET reward_issue_id =  5 WHERE id =  5;
UPDATE boxes SET reward_issue_id =  6 WHERE id = 31;
UPDATE boxes SET reward_issue_id =  7 WHERE id = 33;
UPDATE boxes SET reward_issue_id =  8 WHERE id = 35;
UPDATE boxes SET reward_issue_id =  9 WHERE id = 91;
UPDATE boxes SET reward_issue_id = 10 WHERE id = 92;
UPDATE boxes SET reward_issue_id = 11 WHERE id = 93;
UPDATE boxes SET reward_issue_id = 12 WHERE id = 151;

-- ---------------------------------------------------------------
-- 12. Box events (audit trail)
-- ---------------------------------------------------------------
INSERT INTO box_events (box_id, type, meta, created_at) VALUES
-- John D1
(  1, 'enroll', '{"enrollment_id":1}',             '2026-07-02 20:05:00'),
(  1, 'open',   '{"drop_index":1}',                '2026-07-03 14:23:11'),
(  1, 'reveal', '{"result":"reward","voucher_id":1}','2026-07-03 14:23:11'),
(  1, 'issue',  '{"issue_id":1,"code":"COFFEE-DZ"}','2026-07-03 14:23:12'),
-- John D2
(  2, 'open',   '{"drop_index":2}',                '2026-07-04 09:08:55'),
(  2, 'reveal', '{"result":"reward","voucher_id":2}','2026-07-04 09:08:55'),
(  2, 'issue',  '{"issue_id":2,"code":"SAVE10"}',   '2026-07-04 09:08:56'),
-- John D3
(  3, 'open',   '{"drop_index":3}',                '2026-07-05 20:44:02'),
(  3, 'reveal', '{"result":"reward","voucher_id":3}','2026-07-05 20:44:02'),
(  3, 'issue',  '{"issue_id":3,"code":null}',       '2026-07-05 20:44:03'),
-- John D4
(  4, 'open',   '{"drop_index":4}',                '2026-07-06 11:31:19'),
(  4, 'reveal', '{"result":"reward","voucher_id":4}','2026-07-06 11:31:19'),
(  4, 'issue',  '{"issue_id":4,"code":null}',       '2026-07-06 11:31:20'),
-- John D5
(  5, 'open',   '{"drop_index":5}',                '2026-07-07 08:02:33'),
(  5, 'reveal', '{"result":"reward","voucher_id":5}','2026-07-07 08:02:33'),
(  5, 'issue',  '{"issue_id":5,"code":"GIFT-A1B2"}','2026-07-07 08:02:34'),
-- John D6 (empty box — Better Luck)
(  6, 'open',   '{"drop_index":6}',                '2026-07-08 16:22:07'),
(  6, 'reveal', '{"result":"empty"}',               '2026-07-08 16:22:07'),
-- Priya D1
( 31, 'open',   '{"drop_index":1}',                '2026-07-03 19:11:00'),
( 31, 'reveal', '{"result":"reward","voucher_id":1}','2026-07-03 19:11:00'),
( 31, 'issue',  '{"issue_id":6,"code":"COFFEE-DZ"}','2026-07-03 19:11:01'),
-- Priya D2 missed
( 32, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-05 00:00:01'),
-- Priya D3
( 33, 'open',   '{"drop_index":3}',                '2026-07-05 12:55:30'),
( 33, 'reveal', '{"result":"reward","voucher_id":3}','2026-07-05 12:55:30'),
( 33, 'issue',  '{"issue_id":7,"code":null}',       '2026-07-05 12:55:31'),
-- Priya D4 missed
( 34, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-07 00:00:01'),
-- Priya D5
( 35, 'open',   '{"drop_index":5}',                '2026-07-07 22:40:18'),
( 35, 'reveal', '{"result":"reward","voucher_id":5}','2026-07-07 22:40:18'),
( 35, 'issue',  '{"issue_id":8,"code":"GIFT-C3D4"}','2026-07-07 22:40:19'),
-- Priya D6 missed
( 36, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 00:00:01'),
-- Rahul: all missed
( 61, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-04 00:00:01'),
( 62, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-05 00:00:01'),
( 63, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-06 00:00:01'),
( 64, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-07 00:00:01'),
( 65, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-08 00:00:01'),
( 66, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 00:00:01'),
-- Alice D1
( 91, 'open',   '{"drop_index":1}',                '2026-07-03 10:00:01'),
( 91, 'reveal', '{"result":"reward","voucher_id":1}','2026-07-03 10:00:01'),
( 91, 'issue',  '{"issue_id":9,"code":"COFFEE-DZ"}','2026-07-03 10:00:02'),
-- Alice D2
( 92, 'open',   '{"drop_index":2}',                '2026-07-04 15:33:00'),
( 92, 'reveal', '{"result":"reward","voucher_id":2}','2026-07-04 15:33:00'),
( 92, 'issue',  '{"issue_id":10,"code":"SAVE10"}',  '2026-07-04 15:33:01'),
-- Alice D3
( 93, 'open',   '{"drop_index":3}',                '2026-07-05 08:20:45'),
( 93, 'reveal', '{"result":"reward","voucher_id":3}','2026-07-05 08:20:45'),
( 93, 'issue',  '{"issue_id":11,"code":null}',      '2026-07-05 08:20:46'),
-- Alice D4,D5,D6 missed
( 94, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-07 00:00:01'),
( 95, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-08 00:00:01'),
( 96, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 00:00:01'),
-- Bob: all past drops missed (enrolled today)
(121, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 08:20:01'),
(122, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 08:20:01'),
(123, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 08:20:01'),
(124, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 08:20:01'),
(125, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 08:20:01'),
(126, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-09 08:20:01'),
-- John C2 Week 1
(151, 'open',   '{"drop_index":1}',                '2026-07-05 16:00:00'),
(151, 'reveal', '{"result":"reward","voucher_id":2}','2026-07-05 16:00:00'),
(151, 'issue',  '{"issue_id":12,"code":"SAVE10"}',  '2026-07-05 16:00:01'),
-- Priya C2 Week 1 missed
(159, 'miss',   '{"reason":"window_elapsed"}',      '2026-07-08 02:00:01');

-- ---------------------------------------------------------------
-- 13. WhatsApp messages (broadcast history)
-- ---------------------------------------------------------------
INSERT INTO whatsapp_messages (id, template_id, template_name, body, audience, recipients, status, sent_by, created_at) VALUES
(1, 3, 'enrollment_welcome',
   'Welcome to DropZone! Your first box opens tomorrow at midnight. Stay tuned! 📦',
   'All users', 4, 'simulated', 'admin@dropzone.test', '2026-07-02 22:00:00'),
(2, 1, 'drop_reminder',
   'Hi there! Your daily DropZone box is open right now. Tap to open it before midnight! 🎁',
   'All users', 5, 'simulated', 'manager@dropzone.test', '2026-07-09 08:00:00'),
(3, NULL, NULL,
   'Big week ahead — new rewards unlocked in the Weekly Winners campaign! Open your box now. 🏆',
   'Campaign 2 users', 2, 'simulated', 'admin@dropzone.test', '2026-07-08 09:00:00')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ---------------------------------------------------------------
-- 14. Update voucher stock to reflect used unique codes
-- voucher 5 (Surprise Gift): 100 stock, 3 codes used → 97 remaining
-- voucher 2 (10% Off): 500 stock, issued to John×2, Alice×1, John-C2×1 = 4 issued → 496 remaining
-- ---------------------------------------------------------------
UPDATE vouchers SET stock = 97  WHERE id = 5;
UPDATE vouchers SET stock = 496 WHERE id = 2;

-- ---------------------------------------------------------------
-- Done!
-- Summary:
--   Admin logins : admin@dropzone.test / password  (or run seed.php to switch to dropzone123)
--   Campaigns    : 2 (daily 30d, weekly 8w)
--   Drops        : 38 total
--   Users        : 5 (john, priya, rahul, alice, bob)
--   Enrollments  : 7
--   Boxes        : 166
--   Reward issues: 12
--   Box events   : 50+
-- ---------------------------------------------------------------
