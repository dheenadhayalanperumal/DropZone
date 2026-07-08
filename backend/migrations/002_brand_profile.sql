-- 002_brand_profile.sql — single-brand look & feel for the customer drop experience
CREATE TABLE IF NOT EXISTS brand_profile (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name             VARCHAR(120) NOT NULL DEFAULT 'DropZone',
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

INSERT INTO brand_profile (id) VALUES (1)
  ON DUPLICATE KEY UPDATE id = id;
