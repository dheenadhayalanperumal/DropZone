-- 003_vouchers.sql — rewards/coupons defined by the admin + unique-code pool
CREATE TABLE IF NOT EXISTS vouchers (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title         VARCHAR(160) NOT NULL,
  description   VARCHAR(500) NULL,
  image         VARCHAR(512) NULL,
  type          ENUM('coupon','points','badge','custom','empty') NOT NULL DEFAULT 'coupon',
  value         VARCHAR(120) NULL,               -- e.g. "10% off", "50 pts"
  code_mode     ENUM('shared','unique') NOT NULL DEFAULT 'shared',
  shared_code   VARCHAR(120) NULL,               -- used when code_mode = 'shared'
  stock         INT NULL,                        -- NULL = unlimited; 0 = exhausted -> empty
  validity_days INT UNSIGNED NULL,               -- reward expires N days after issue
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vouchers_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pool of unique codes drawn from when a voucher uses code_mode = 'unique'.
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
