-- Migration pour ajouter les nouveaux champs utilisateur
-- À exécuter sur la base de données mdsc_auth

USE mdsc_auth;

-- Ajouter les nouveaux champs à la table users
ALTER TABLE users 
ADD COLUMN npi VARCHAR(50) NULL AFTER last_name,
ADD COLUMN phone VARCHAR(20) NULL AFTER npi,
ADD COLUMN organization VARCHAR(255) NULL AFTER phone,
ADD COLUMN country VARCHAR(3) NULL AFTER organization;

-- Ajouter des index pour les nouveaux champs
ALTER TABLE users 
ADD INDEX idx_npi (npi),
ADD INDEX idx_country (country),
ADD INDEX idx_organization (organization);

-- Vérifier la structure de la table
DESCRIBE users;
