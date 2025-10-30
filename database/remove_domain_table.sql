-- Migration: Retirer la table domaine et la colonne domain_id (remplacée par categories)

-- Adapter le nom de base si nécessaire
-- USE mdsc_auth;

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- Retirer la colonne domain_id de courses si présente (FK sera supprimée implicitement)
ALTER TABLE courses DROP COLUMN IF EXISTS domain_id;

-- Retirer la table domains si présente
DROP TABLE IF EXISTS domains;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- Optionnel: index/nettoyage liés
-- Aucun autre changement requis; la catégorisation passe via categories.category_id

COMMIT;


