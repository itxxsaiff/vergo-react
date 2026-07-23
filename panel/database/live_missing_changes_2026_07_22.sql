-- Live DB targeted patch based on:
-- C:\Users\husna\Downloads\ripawucu_vergo (2).sql
-- Server shown in dump: MariaDB 10.11.18
-- This file adds only the fields/constraints missing from that live structure dump.

-- 1) Support ticket contact/comment fields.
ALTER TABLE `support_tickets`
  ADD COLUMN IF NOT EXISTS `first_name` VARCHAR(255) NULL AFTER `requester_email`,
  ADD COLUMN IF NOT EXISTS `last_name` VARCHAR(255) NULL AFTER `first_name`,
  ADD COLUMN IF NOT EXISTS `phone` VARCHAR(255) NULL AFTER `last_name`,
  ADD COLUMN IF NOT EXISTS `comment` TEXT NULL AFTER `message`;

-- 2) Provider review category ratings for communication, punctuality, and work quality.
ALTER TABLE `provider_reviews`
  ADD COLUMN IF NOT EXISTS `communication_rating` TINYINT UNSIGNED NULL AFTER `rating`,
  ADD COLUMN IF NOT EXISTS `punctuality_rating` TINYINT UNSIGNED NULL AFTER `communication_rating`,
  ADD COLUMN IF NOT EXISTS `quality_rating` TINYINT UNSIGNED NULL AFTER `punctuality_rating`;

UPDATE `provider_reviews`
SET
  `communication_rating` = COALESCE(`communication_rating`, `rating`),
  `punctuality_rating` = COALESCE(`punctuality_rating`, `rating`),
  `quality_rating` = COALESCE(`quality_rating`, `rating`)
WHERE `rating` IS NOT NULL;

-- 3) Document foreign keys for invoice metadata.
-- The columns are already present in the live dump, only the constraints are missing.
DELIMITER $$

DROP PROCEDURE IF EXISTS vergo_add_fk_if_missing$$
CREATE PROCEDURE vergo_add_fk_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_constraint_name VARCHAR(128),
  IN p_alter_clause TEXT
)
BEGIN
  DECLARE v_constraint_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_constraint_exists
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND CONSTRAINT_NAME = p_constraint_name;

  IF v_constraint_exists = 0 THEN
    SET @vergo_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'), '` ', p_alter_clause);
    PREPARE vergo_stmt FROM @vergo_sql;
    EXECUTE vergo_stmt;
    DEALLOCATE PREPARE vergo_stmt;
  END IF;
END$$

DELIMITER ;

CALL vergo_add_fk_if_missing(
  'documents',
  'documents_property_object_id_foreign',
  'ADD CONSTRAINT `documents_property_object_id_foreign` FOREIGN KEY (`property_object_id`) REFERENCES `property_objects` (`id`) ON DELETE SET NULL'
);

CALL vergo_add_fk_if_missing(
  'documents',
  'documents_service_provider_id_foreign',
  'ADD CONSTRAINT `documents_service_provider_id_foreign` FOREIGN KEY (`service_provider_id`) REFERENCES `service_providers` (`id`) ON DELETE SET NULL'
);

DROP PROCEDURE IF EXISTS vergo_add_fk_if_missing;

-- 4) Mark today's migrations as applied if you are patching through phpMyAdmin instead of running artisan migrate.
-- If these rows already exist, they will be skipped.
SET @vergo_batch = COALESCE((SELECT MAX(`batch`) FROM `migrations`), 0) + 1;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_22_120000_add_contact_and_comment_fields_to_support_tickets', @vergo_batch
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations`
  WHERE `migration` = '2026_07_22_120000_add_contact_and_comment_fields_to_support_tickets'
);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_22_130000_add_category_ratings_to_provider_reviews', @vergo_batch
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations`
  WHERE `migration` = '2026_07_22_130000_add_category_ratings_to_provider_reviews'
);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_22_140000_add_soft_deletes_to_orders_table', @vergo_batch
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations`
  WHERE `migration` = '2026_07_22_140000_add_soft_deletes_to_orders_table'
);
