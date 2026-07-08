-- 008_add_tagline_to_brand_profile.sql — add brand tagline (idempotent).
-- migrate.php re-runs every file, so guard the ALTER against re-application.
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brand_profile' AND COLUMN_NAME = 'tagline'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE brand_profile ADD COLUMN tagline VARCHAR(255) DEFAULT NULL AFTER name',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
