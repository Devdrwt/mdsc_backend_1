-- Migration 022: Ajouter la colonne storage_type à la table user_files pour supporter MinIO
-- Date: 2025-12-10
-- Description: Permet de spécifier le type de stockage (local, minio, s3) pour les fichiers utilisateur

USE mdsc_auth;

-- Vérifier si la colonne storage_type existe déjà
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'user_files' 
  AND COLUMN_NAME = 'storage_type');

-- Ajouter la colonne storage_type si elle n'existe pas
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE user_files ADD COLUMN storage_type ENUM(\'minio\', \'s3\', \'local\') DEFAULT \'local\' AFTER mime_type',
  'SELECT "Column storage_type already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier si l'index idx_storage_type existe déjà
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'user_files' 
  AND INDEX_NAME = 'idx_storage_type');

-- Ajouter l'index si il n'existe pas
SET @sql_idx = IF(@idx_exists = 0,
  'ALTER TABLE user_files ADD INDEX idx_storage_type (storage_type)',
  'SELECT "Index idx_storage_type already exists" AS message');

PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Vérifier la structure
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'mdsc_auth'
  AND TABLE_NAME = 'user_files'
  AND COLUMN_NAME IN ('id', 'user_id', 'file_type', 'file_name', 'mime_type', 'storage_type', 'created_at')
ORDER BY ORDINAL_POSITION;

