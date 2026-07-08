-- 006_whatsapp.sql — reused from Streaks 005 (settings, templates, opt-outs)
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

INSERT INTO whatsapp_settings (id) VALUES (1)
  ON DUPLICATE KEY UPDATE id = id;

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
