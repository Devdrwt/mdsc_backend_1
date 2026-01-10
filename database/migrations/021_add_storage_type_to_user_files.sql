-- Migration pour ajouter le support MinIO à la table user_files
-- Ajouter la colonne storage_type si elle n'existe pas

ALTER TABLE user_files
ADD COLUMN IF NOT EXISTS storage_type ENUM('minio', 's3', 'local') DEFAULT 'local' AFTER mime_type;

-- Ajouter un index pour améliorer les performances
ALTER TABLE user_files
ADD INDEX IF NOT EXISTS idx_storage_type (storage_type);
