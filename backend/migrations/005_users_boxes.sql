-- 005_users_boxes.sql — participants, enrollments, boxes, audit, reward issues
CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(160) NULL,
  identifier VARCHAR(190) NOT NULL,   -- email or mobile
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

-- Immutable audit trail of every transition.
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
  UNIQUE KEY uq_issue_box (box_id),           -- exactly-once issuance per box
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

-- Idempotency keys for the open endpoint (per box + client key).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idem_key     VARCHAR(120) NOT NULL,
  box_id       INT UNSIGNED NOT NULL,
  response     JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_idem (idem_key, box_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
