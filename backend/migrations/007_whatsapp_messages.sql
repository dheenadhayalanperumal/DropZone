-- 007_whatsapp_messages.sql — promotional broadcast history (sent-message log)
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
