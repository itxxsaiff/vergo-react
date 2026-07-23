-- Vergo database changes prepared on 2026-07-22.
-- Safe/idempotent version: existing columns, indexes, and foreign keys are skipped.
-- Take a database backup before running this file.

DELIMITER $$

DROP PROCEDURE IF EXISTS vergo_add_column_if_missing$$
CREATE PROCEDURE vergo_add_column_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_column_name VARCHAR(128),
  IN p_alter_clause TEXT
)
BEGIN
  DECLARE v_table_exists INT DEFAULT 0;
  DECLARE v_column_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_table_exists
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name;

  SELECT COUNT(*) INTO v_column_exists
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND COLUMN_NAME = p_column_name;

  IF v_table_exists > 0 AND v_column_exists = 0 THEN
    SET @vergo_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'), '` ', p_alter_clause);
    PREPARE vergo_stmt FROM @vergo_sql;
    EXECUTE vergo_stmt;
    DEALLOCATE PREPARE vergo_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS vergo_add_index_if_missing$$
CREATE PROCEDURE vergo_add_index_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_index_name VARCHAR(128),
  IN p_alter_clause TEXT
)
BEGIN
  DECLARE v_table_exists INT DEFAULT 0;
  DECLARE v_index_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_table_exists
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name;

  SELECT COUNT(*) INTO v_index_exists
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND INDEX_NAME = p_index_name;

  IF v_table_exists > 0 AND v_index_exists = 0 THEN
    SET @vergo_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'), '` ', p_alter_clause);
    PREPARE vergo_stmt FROM @vergo_sql;
    EXECUTE vergo_stmt;
    DEALLOCATE PREPARE vergo_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS vergo_drop_index_if_exists$$
CREATE PROCEDURE vergo_drop_index_if_exists(
  IN p_table_name VARCHAR(128),
  IN p_index_name VARCHAR(128)
)
BEGIN
  DECLARE v_index_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_index_exists
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND INDEX_NAME = p_index_name;

  IF v_index_exists > 0 THEN
    SET @vergo_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'), '` DROP INDEX `', REPLACE(p_index_name, '`', '``'), '`');
    PREPARE vergo_stmt FROM @vergo_sql;
    EXECUTE vergo_stmt;
    DEALLOCATE PREPARE vergo_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS vergo_add_foreign_key_if_missing$$
CREATE PROCEDURE vergo_add_foreign_key_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_constraint_name VARCHAR(128),
  IN p_alter_clause TEXT
)
BEGIN
  DECLARE v_table_exists INT DEFAULT 0;
  DECLARE v_constraint_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_table_exists
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name;

  SELECT COUNT(*) INTO v_constraint_exists
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND CONSTRAINT_NAME = p_constraint_name;

  IF v_table_exists > 0 AND v_constraint_exists = 0 THEN
    SET @vergo_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'), '` ', p_alter_clause);
    PREPARE vergo_stmt FROM @vergo_sql;
    EXECUTE vergo_stmt;
    DEALLOCATE PREPARE vergo_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS vergo_drop_foreign_key_if_exists$$
CREATE PROCEDURE vergo_drop_foreign_key_if_exists(
  IN p_table_name VARCHAR(128),
  IN p_constraint_name VARCHAR(128)
)
BEGIN
  DECLARE v_constraint_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_constraint_exists
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND CONSTRAINT_NAME = p_constraint_name;

  IF v_constraint_exists > 0 THEN
    SET @vergo_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'), '` DROP FOREIGN KEY `', REPLACE(p_constraint_name, '`', '``'), '`');
    PREPARE vergo_stmt FROM @vergo_sql;
    EXECUTE vergo_stmt;
    DEALLOCATE PREPARE vergo_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS vergo_modify_column_if_exists$$
CREATE PROCEDURE vergo_modify_column_if_exists(
  IN p_table_name VARCHAR(128),
  IN p_column_name VARCHAR(128),
  IN p_alter_clause TEXT
)
BEGIN
  DECLARE v_column_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_column_exists
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table_name
    AND COLUMN_NAME = p_column_name;

  IF v_column_exists > 0 THEN
    SET @vergo_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'), '` ', p_alter_clause);
    PREPARE vergo_stmt FROM @vergo_sql;
    EXECUTE vergo_stmt;
    DEALLOCATE PREPARE vergo_stmt;
  END IF;
END$$

DELIMITER ;

-- Orders workflow, quote, attachment, and recovery columns.
CALL vergo_add_column_if_missing('orders', 'property_object_ids', 'ADD COLUMN `property_object_ids` JSON NULL AFTER `property_object_id`');
CALL vergo_add_column_if_missing('orders', 'workflow_meta', 'ADD COLUMN `workflow_meta` JSON NULL AFTER `due_date`');
CALL vergo_add_column_if_missing('orders', 'workflow_type', 'ADD COLUMN `workflow_type` VARCHAR(40) NULL AFTER `status`');
CALL vergo_add_column_if_missing('orders', 'workflow_status', 'ADD COLUMN `workflow_status` VARCHAR(40) NULL AFTER `workflow_type`');
CALL vergo_add_column_if_missing('orders', 'bid_priority', 'ADD COLUMN `bid_priority` VARCHAR(40) NULL AFTER `workflow_status`');
CALL vergo_add_column_if_missing('orders', 'bid_deadline_at', 'ADD COLUMN `bid_deadline_at` TIMESTAMP NULL AFTER `due_date`');
CALL vergo_add_column_if_missing('orders', 'quote_items', 'ADD COLUMN `quote_items` JSON NULL AFTER `workflow_meta`');
CALL vergo_add_column_if_missing('orders', 'attachment_name', 'ADD COLUMN `attachment_name` VARCHAR(255) NULL AFTER `quote_items`');
CALL vergo_add_column_if_missing('orders', 'attachment_path', 'ADD COLUMN `attachment_path` VARCHAR(255) NULL AFTER `attachment_name`');
CALL vergo_add_column_if_missing('orders', 'attachment_mime_type', 'ADD COLUMN `attachment_mime_type` VARCHAR(255) NULL AFTER `attachment_path`');
CALL vergo_add_column_if_missing('orders', 'attachment_size', 'ADD COLUMN `attachment_size` BIGINT UNSIGNED NULL AFTER `attachment_mime_type`');
CALL vergo_add_column_if_missing('orders', 'deleted_at', 'ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `updated_at`');

-- Bid workflow, quote item, draft, and attachment support.
CALL vergo_add_column_if_missing('bids', 'line_items', 'ADD COLUMN `line_items` JSON NULL AFTER `currency`');
CALL vergo_add_column_if_missing('bids', 'workflow_meta', 'ADD COLUMN `workflow_meta` JSON NULL AFTER `notes`');
CALL vergo_add_column_if_missing('bids', 'rejection_reason', 'ADD COLUMN `rejection_reason` TEXT NULL AFTER `status`');
CALL vergo_add_column_if_missing('bids', 'assigned_provider_email', 'ADD COLUMN `assigned_provider_email` VARCHAR(255) NULL AFTER `service_provider_id`');
CALL vergo_add_column_if_missing('bids', 'draft_payload', 'ADD COLUMN `draft_payload` JSON NULL AFTER `workflow_meta`');
CALL vergo_add_column_if_missing('bids', 'draft_saved_at', 'ADD COLUMN `draft_saved_at` TIMESTAMP NULL AFTER `draft_payload`');
CALL vergo_modify_column_if_exists('bids', 'amount', 'MODIFY COLUMN `amount` DECIMAL(12, 2) NULL');

-- Owner profile fields.
CALL vergo_add_column_if_missing('users', 'access_level', 'ADD COLUMN `access_level` VARCHAR(30) NOT NULL DEFAULT ''admin'' AFTER `status`');
CALL vergo_add_column_if_missing('users', 'owner_type', 'ADD COLUMN `owner_type` VARCHAR(30) NULL AFTER `access_level`');
CALL vergo_add_column_if_missing('users', 'company_name', 'ADD COLUMN `company_name` VARCHAR(255) NULL AFTER `owner_type`');
CALL vergo_add_column_if_missing('users', 'address', 'ADD COLUMN `address` VARCHAR(255) NULL AFTER `company_name`');
CALL vergo_add_column_if_missing('users', 'postal_code', 'ADD COLUMN `postal_code` VARCHAR(30) NULL AFTER `address`');
CALL vergo_add_column_if_missing('users', 'city', 'ADD COLUMN `city` VARCHAR(255) NULL AFTER `postal_code`');
CALL vergo_add_column_if_missing('users', 'domain_suffix', 'ADD COLUMN `domain_suffix` VARCHAR(255) NULL AFTER `city`');
CALL vergo_add_column_if_missing('users', 'login_email', 'ADD COLUMN `login_email` VARCHAR(255) NULL AFTER `domain_suffix`');

UPDATE `users`
JOIN `roles` ON `roles`.`id` = `users`.`role_id`
SET
  `users`.`owner_type` = COALESCE(`users`.`owner_type`, 'company'),
  `users`.`company_name` = COALESCE(`users`.`company_name`, `users`.`name`),
  `users`.`address` = COALESCE(`users`.`address`, `users`.`location`),
  `users`.`login_email` = COALESCE(`users`.`login_email`, `users`.`email`),
  `users`.`domain_suffix` = CASE
    WHEN `users`.`email` LIKE '%@%' THEN LOWER(SUBSTRING_INDEX(`users`.`email`, '@', -1))
    ELSE `users`.`domain_suffix`
  END
WHERE `roles`.`name` = 'owner';

CALL vergo_add_index_if_missing('users', 'users_login_email_unique', 'ADD UNIQUE KEY `users_login_email_unique` (`login_email`)');

CALL vergo_add_column_if_missing('manager_login_codes', 'owner_id', 'ADD COLUMN `owner_id` BIGINT UNSIGNED NULL AFTER `property_id`');
CALL vergo_add_foreign_key_if_missing(
  'manager_login_codes',
  'manager_login_codes_owner_id_foreign',
  'ADD CONSTRAINT `manager_login_codes_owner_id_foreign` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL'
);

-- Property and property-manager profile fields.
CALL vergo_add_column_if_missing('properties', 'apartment_count', 'ADD COLUMN `apartment_count` INT UNSIGNED NULL AFTER `lot_area`');
CALL vergo_add_column_if_missing('properties', 'commercial_area', 'ADD COLUMN `commercial_area` DECIMAL(12, 2) NULL AFTER `apartment_count`');
CALL vergo_add_column_if_missing('properties', 'property_manager_profile_id', 'ADD COLUMN `property_manager_profile_id` BIGINT UNSIGNED NULL AFTER `management`');
CALL vergo_add_foreign_key_if_missing(
  'properties',
  'properties_property_manager_profile_id_foreign',
  'ADD CONSTRAINT `properties_property_manager_profile_id_foreign` FOREIGN KEY (`property_manager_profile_id`) REFERENCES `property_manager_profiles` (`id`) ON DELETE SET NULL'
);

CALL vergo_add_column_if_missing('property_manager_profiles', 'address', 'ADD COLUMN `address` VARCHAR(255) NULL AFTER `email`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'phone', 'ADD COLUMN `phone` VARCHAR(50) NULL AFTER `email`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'postal_code', 'ADD COLUMN `postal_code` VARCHAR(50) NULL AFTER `address`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'city', 'ADD COLUMN `city` VARCHAR(255) NULL AFTER `postal_code`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'domain_suffix', 'ADD COLUMN `domain_suffix` VARCHAR(255) NULL AFTER `city`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'canton', 'ADD COLUMN `canton` VARCHAR(120) NULL AFTER `city`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'invoice_delivery_method', 'ADD COLUMN `invoice_delivery_method` VARCHAR(20) NOT NULL DEFAULT ''email'' AFTER `canton`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'invoice_email', 'ADD COLUMN `invoice_email` VARCHAR(255) NULL AFTER `invoice_delivery_method`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'invoice_company_name', 'ADD COLUMN `invoice_company_name` VARCHAR(255) NULL AFTER `invoice_email`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'invoice_company_extra', 'ADD COLUMN `invoice_company_extra` VARCHAR(255) NULL AFTER `invoice_company_name`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'invoice_address', 'ADD COLUMN `invoice_address` VARCHAR(255) NULL AFTER `invoice_company_extra`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'invoice_postal_code', 'ADD COLUMN `invoice_postal_code` VARCHAR(50) NULL AFTER `invoice_address`');
CALL vergo_add_column_if_missing('property_manager_profiles', 'invoice_city', 'ADD COLUMN `invoice_city` VARCHAR(255) NULL AFTER `invoice_postal_code`');

CALL vergo_drop_foreign_key_if_exists('property_manager_profiles', 'property_manager_profiles_property_id_foreign');
CALL vergo_modify_column_if_exists('property_manager_profiles', 'property_id', 'MODIFY COLUMN `property_id` BIGINT UNSIGNED NULL');
CALL vergo_add_foreign_key_if_missing(
  'property_manager_profiles',
  'property_manager_profiles_property_id_foreign',
  'ADD CONSTRAINT `property_manager_profiles_property_id_foreign` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL'
);

-- Service provider fields.
CALL vergo_add_column_if_missing('service_providers', 'order_email', 'ADD COLUMN `order_email` VARCHAR(255) NULL AFTER `contact_email`');
CALL vergo_add_column_if_missing('service_providers', 'domain_suffix', 'ADD COLUMN `domain_suffix` VARCHAR(255) NULL AFTER `order_email`');
CALL vergo_add_column_if_missing('service_providers', 'trade_groups', 'ADD COLUMN `trade_groups` JSON NULL AFTER `domain_suffix`');
CALL vergo_add_column_if_missing('service_providers', 'address', 'ADD COLUMN `address` VARCHAR(255) NULL AFTER `order_email`');
CALL vergo_add_column_if_missing('service_providers', 'postal_code', 'ADD COLUMN `postal_code` VARCHAR(50) NULL AFTER `address`');
CALL vergo_add_column_if_missing('service_providers', 'city', 'ADD COLUMN `city` VARCHAR(255) NULL AFTER `postal_code`');
CALL vergo_add_column_if_missing('service_providers', 'canton', 'ADD COLUMN `canton` VARCHAR(120) NULL AFTER `city`');
CALL vergo_add_column_if_missing('service_providers', 'is_vat_subject', 'ADD COLUMN `is_vat_subject` TINYINT(1) NOT NULL DEFAULT 0 AFTER `phone`');

-- Document invoice metadata used by AI price benchmarks.
CALL vergo_add_column_if_missing('documents', 'property_object_id', 'ADD COLUMN `property_object_id` BIGINT UNSIGNED NULL AFTER `property_id`');
CALL vergo_add_column_if_missing('documents', 'property_object_ids', 'ADD COLUMN `property_object_ids` JSON NULL AFTER `property_object_id`');
CALL vergo_add_column_if_missing('documents', 'service_provider_id', 'ADD COLUMN `service_provider_id` BIGINT UNSIGNED NULL AFTER `order_id`');
CALL vergo_add_column_if_missing('documents', 'service_type', 'ADD COLUMN `service_type` VARCHAR(120) NULL AFTER `type`');
CALL vergo_add_column_if_missing('documents', 'trade_object', 'ADD COLUMN `trade_object` VARCHAR(255) NULL AFTER `service_type`');
CALL vergo_add_column_if_missing('documents', 'trade_activity', 'ADD COLUMN `trade_activity` VARCHAR(255) NULL AFTER `trade_object`');
CALL vergo_add_foreign_key_if_missing(
  'documents',
  'documents_property_object_id_foreign',
  'ADD CONSTRAINT `documents_property_object_id_foreign` FOREIGN KEY (`property_object_id`) REFERENCES `property_objects` (`id`) ON DELETE SET NULL'
);
CALL vergo_add_foreign_key_if_missing(
  'documents',
  'documents_service_provider_id_foreign',
  'ADD CONSTRAINT `documents_service_provider_id_foreign` FOREIGN KEY (`service_provider_id`) REFERENCES `service_providers` (`id`) ON DELETE SET NULL'
);

-- Company addition requests.
CREATE TABLE IF NOT EXISTS `company_addition_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_manager_profile_id` BIGINT UNSIGNED NULL,
  `property_id` BIGINT UNSIGNED NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `contact_name` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(255) NULL,
  `canton` VARCHAR(10) NULL,
  `city` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `company_addition_requests_property_manager_profile_id_foreign` (`property_manager_profile_id`),
  KEY `company_addition_requests_property_id_foreign` (`property_id`),
  CONSTRAINT `company_addition_requests_property_manager_profile_id_foreign`
    FOREIGN KEY (`property_manager_profile_id`) REFERENCES `property_manager_profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `company_addition_requests_property_id_foreign`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Support tickets.
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ticket_number` VARCHAR(255) NOT NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `property_manager_profile_id` BIGINT UNSIGNED NULL,
  `requester_role` VARCHAR(50) NULL,
  `requester_name` VARCHAR(255) NULL,
  `requester_email` VARCHAR(255) NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'general',
  `priority` VARCHAR(30) NOT NULL DEFAULT 'normal',
  `subject` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'open',
  `admin_notes` TEXT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `support_tickets_ticket_number_unique` (`ticket_number`),
  KEY `support_tickets_user_id_foreign` (`user_id`),
  KEY `support_tickets_property_manager_profile_id_foreign` (`property_manager_profile_id`),
  CONSTRAINT `support_tickets_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `support_tickets_property_manager_profile_id_foreign`
    FOREIGN KEY (`property_manager_profile_id`) REFERENCES `property_manager_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL vergo_add_column_if_missing('support_tickets', 'first_name', 'ADD COLUMN `first_name` VARCHAR(255) NULL AFTER `requester_email`');
CALL vergo_add_column_if_missing('support_tickets', 'last_name', 'ADD COLUMN `last_name` VARCHAR(255) NULL AFTER `first_name`');
CALL vergo_add_column_if_missing('support_tickets', 'phone', 'ADD COLUMN `phone` VARCHAR(255) NULL AFTER `last_name`');
CALL vergo_add_column_if_missing('support_tickets', 'comment', 'ADD COLUMN `comment` TEXT NULL AFTER `message`');

-- Provider review category ratings.
CALL vergo_add_column_if_missing('provider_reviews', 'communication_rating', 'ADD COLUMN `communication_rating` TINYINT UNSIGNED NULL AFTER `rating`');
CALL vergo_add_column_if_missing('provider_reviews', 'punctuality_rating', 'ADD COLUMN `punctuality_rating` TINYINT UNSIGNED NULL AFTER `communication_rating`');
CALL vergo_add_column_if_missing('provider_reviews', 'quality_rating', 'ADD COLUMN `quality_rating` TINYINT UNSIGNED NULL AFTER `punctuality_rating`');

UPDATE `provider_reviews`
SET
  `communication_rating` = COALESCE(`communication_rating`, `rating`),
  `punctuality_rating` = COALESCE(`punctuality_rating`, `rating`),
  `quality_rating` = COALESCE(`quality_rating`, `rating`)
WHERE `rating` IS NOT NULL;

-- Property manager profile de-duplication by email.
DROP TEMPORARY TABLE IF EXISTS `tmp_property_manager_profile_keepers`;

CREATE TEMPORARY TABLE `tmp_property_manager_profile_keepers` AS
SELECT LOWER(`email`) AS `email_key`, MIN(`id`) AS `keeper_id`
FROM `property_manager_profiles`
GROUP BY LOWER(`email`);

UPDATE `orders` o
JOIN `property_manager_profiles` p ON p.`id` = o.`property_manager_profile_id`
JOIN `tmp_property_manager_profile_keepers` k ON k.`email_key` = LOWER(p.`email`)
SET o.`property_manager_profile_id` = k.`keeper_id`
WHERE p.`id` <> k.`keeper_id`;

UPDATE `properties` pty
JOIN `property_manager_profiles` p ON p.`id` = pty.`property_manager_profile_id`
JOIN `tmp_property_manager_profile_keepers` k ON k.`email_key` = LOWER(p.`email`)
SET pty.`property_manager_profile_id` = k.`keeper_id`
WHERE p.`id` <> k.`keeper_id`;

DELETE p
FROM `property_manager_profiles` p
JOIN `tmp_property_manager_profile_keepers` k ON k.`email_key` = LOWER(p.`email`)
WHERE p.`id` <> k.`keeper_id`;

DROP TEMPORARY TABLE IF EXISTS `tmp_property_manager_profile_keepers`;

CALL vergo_add_index_if_missing(
  'property_manager_profiles',
  'property_manager_profiles_property_id_index',
  'ADD INDEX `property_manager_profiles_property_id_index` (`property_id`)'
);
CALL vergo_drop_index_if_exists('property_manager_profiles', 'property_manager_profiles_property_id_email_unique');
CALL vergo_add_index_if_missing(
  'property_manager_profiles',
  'property_manager_profiles_email_unique',
  'ADD UNIQUE KEY `property_manager_profiles_email_unique` (`email`)'
);

-- Optional: mark these migrations as applied if you run raw SQL instead of artisan migrate.
CREATE TABLE IF NOT EXISTS `migrations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` VARCHAR(255) NOT NULL,
  `batch` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @vergo_batch = COALESCE((SELECT MAX(`batch`) FROM `migrations`), 0) + 1;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_04_26_150000_add_workflow_metadata_to_orders_table', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_04_26_150000_add_workflow_metadata_to_orders_table');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_04_26_163000_add_quote_workflow_fields_to_orders_and_bids', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_04_26_163000_add_quote_workflow_fields_to_orders_and_bids');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_04_26_171500_make_bid_amount_nullable_for_workflow_invitations', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_04_26_171500_make_bid_amount_nullable_for_workflow_invitations');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_05_30_120000_add_access_level_to_users_table', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_05_30_120000_add_access_level_to_users_table');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_05_31_130000_add_owner_profile_fields_to_users_and_login_codes', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_05_31_130000_add_owner_profile_fields_to_users_and_login_codes');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_05_31_150000_add_property_usage_detail_fields', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_05_31_150000_add_property_usage_detail_fields');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_06_02_150000_add_company_fields_to_property_manager_profiles', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_06_02_150000_add_company_fields_to_property_manager_profiles');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_06_02_163000_add_trade_and_order_email_fields_to_service_providers', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_06_02_163000_add_trade_and_order_email_fields_to_service_providers');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_06_03_120000_align_company_profile_fields', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_06_03_120000_align_company_profile_fields');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_06_04_120000_add_manager_profile_assignment_to_properties', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_06_04_120000_add_manager_profile_assignment_to_properties');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_06_04_130000_make_property_manager_profile_property_optional', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_06_04_130000_make_property_manager_profile_property_optional');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_06_05_150000_add_provider_assignment_and_drafts_to_bids', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_06_05_150000_add_provider_assignment_and_drafts_to_bids');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_01_120000_add_canton_to_property_manager_profiles', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_01_120000_add_canton_to_property_manager_profiles');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_01_130000_add_canton_to_service_providers', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_01_130000_add_canton_to_service_providers');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_01_140000_add_invoice_metadata_to_documents', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_01_140000_add_invoice_metadata_to_documents');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_01_150000_add_invoice_delivery_fields_to_property_manager_profiles', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_01_150000_add_invoice_delivery_fields_to_property_manager_profiles');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_02_120000_add_attachment_fields_to_orders_table', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_02_120000_add_attachment_fields_to_orders_table');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_09_170000_create_company_addition_requests_table', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_09_170000_create_company_addition_requests_table');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_09_180000_create_support_tickets_table', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_09_180000_create_support_tickets_table');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_14_120000_add_vat_subject_to_service_providers', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_14_120000_add_vat_subject_to_service_providers');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_16_120000_dedupe_property_manager_profiles_by_email', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_16_120000_dedupe_property_manager_profiles_by_email');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_22_120000_add_contact_and_comment_fields_to_support_tickets', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_22_120000_add_contact_and_comment_fields_to_support_tickets');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_22_130000_add_category_ratings_to_provider_reviews', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_22_130000_add_category_ratings_to_provider_reviews');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_22_140000_add_soft_deletes_to_orders_table', @vergo_batch
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_07_22_140000_add_soft_deletes_to_orders_table');

DROP PROCEDURE IF EXISTS vergo_add_column_if_missing;
DROP PROCEDURE IF EXISTS vergo_add_index_if_missing;
DROP PROCEDURE IF EXISTS vergo_drop_index_if_exists;
DROP PROCEDURE IF EXISTS vergo_add_foreign_key_if_missing;
DROP PROCEDURE IF EXISTS vergo_drop_foreign_key_if_exists;
DROP PROCEDURE IF EXISTS vergo_modify_column_if_exists;
