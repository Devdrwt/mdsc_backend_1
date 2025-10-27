-- Migration pour ajouter le support de l'authentification Google
-- Date: 2025-10-20

USE mdsc_auth;

-- Ajouter la colonne google_id si elle n'existe pas
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE NULL AFTER email,
ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500) NULL AFTER google_id;

-- Créer un index sur google_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_google_id ON users(google_id);

-- Afficher le résultat
SELECT 'Migration terminée avec succès !' AS message;

