-- Migration : Ajout de thumbnail_url aux sessions live
-- Date : 2025-11-27
-- Description : Permet d'ajouter une image thumbnail aux sessions live

USE mdsc_auth;

-- Vérifier si la colonne existe déjà
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'live_sessions' 
  AND COLUMN_NAME = 'thumbnail_url');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE live_sessions ADD COLUMN thumbnail_url VARCHAR(500) NULL AFTER description',
  'SELECT "Column thumbnail_url already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier la structure
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'mdsc_auth'
  AND TABLE_NAME = 'live_sessions'
  AND COLUMN_NAME IN ('id', 'title', 'description', 'thumbnail_url', 'scheduled_start_at')
ORDER BY ORDINAL_POSITION;

