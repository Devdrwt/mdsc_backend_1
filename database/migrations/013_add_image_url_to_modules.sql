-- Migration: Ajouter la colonne image_url à la table modules
-- Date: 2024

USE mdsc_auth;

-- Ajouter la colonne image_url à la table modules
-- Le script run_migrations.js gère automatiquement l'erreur ER_DUP_FIELDNAME si la colonne existe déjà
ALTER TABLE modules
ADD COLUMN image_url VARCHAR(500) NULL AFTER description;

