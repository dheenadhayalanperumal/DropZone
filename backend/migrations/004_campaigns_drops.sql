-- 004_campaigns_drops.sql — campaigns and the generated drop calendar
CREATE TABLE IF NOT EXISTS campaigns (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                 VARCHAR(160) NOT NULL,
  description          VARCHAR(500) NULL,
  type                 ENUM('daily','weekly','monthly') NOT NULL DEFAULT 'daily',
  duration_days        INT UNSIGNED NOT NULL DEFAULT 30,   -- 7,14,30,90,365 or custom
  custom_duration_days INT UNSIGNED NULL,
  grace_hours          INT UNSIGNED NOT NULL DEFAULT 0,    -- box stays openable N hours past period
  timezone             VARCHAR(64) NOT NULL DEFAULT 'UTC',
  start_date           DATE NOT NULL,
  end_date             DATE NULL,                          -- computed on generation
  active               TINYINT(1) NOT NULL DEFAULT 1,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campaigns_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per box slot in the calendar. Generated when a campaign is saved.
CREATE TABLE IF NOT EXISTS drops (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id  INT UNSIGNED NOT NULL,
  drop_index   INT UNSIGNED NOT NULL,     -- 1..N human label ("Day 5")
  period_index INT NOT NULL,              -- integer period in campaign tz (shared engine)
  reward_id    INT UNSIGNED NULL,         -- voucher inside this box (NULL = empty)
  title        VARCHAR(160) NULL,
  image        VARCHAR(512) NULL,
  open_at      DATETIME NOT NULL,         -- window start (UTC)
  close_at     DATETIME NOT NULL,         -- window end incl. grace (UTC)
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_drop_period (campaign_id, drop_index),
  KEY idx_drops_window (campaign_id, open_at, close_at),
  CONSTRAINT fk_drops_campaign FOREIGN KEY (campaign_id)
    REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT fk_drops_reward FOREIGN KEY (reward_id)
    REFERENCES vouchers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
