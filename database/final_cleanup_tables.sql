-- Script de nettoyage FINAL : Suppression des tables NON utilisées
-- Tables vérifiées dans le codebase - Seules les tables vraiment inutilisées sont listées

USE mdsc_auth;

-- ⚠️ ATTENTION: Faire une sauvegarde avant!
-- mysqldump -u root mdsc_auth > backup_before_cleanup.sql

-- ============================================
-- TABLE À SUPPRIMER IMMÉDIATEMENT
-- ============================================

-- lesson_progress est remplacé par progress (nouvelle architecture)
-- Vérifier d'abord s'il y a des données à migrer:
SELECT COUNT(*) as rows_in_lesson_progress FROM lesson_progress;

-- Si 0 lignes ou après migration:
DROP TABLE IF EXISTS lesson_progress;

-- ============================================
-- TABLES NON UTILISÉES (Confirmé par recherche dans code)
-- ============================================

-- Forum non implémenté (pas de routes/controllers)
DROP TABLE IF EXISTS forum_categories;
DROP TABLE IF EXISTS forum_posts;
DROP TABLE IF EXISTS forum_topics;

-- Events non implémenté
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS event_attendees;

-- Assignments séparés (utilisés dans analytics mais pas de CRUD complet)
-- GARDER assignments pour analytics, mais pas assignment_submissions s'il n'est pas utilisé partout
-- DROP TABLE IF EXISTS assignment_submissions; -- À vérifier manuellement

-- ============================================
-- TABLES À GARDER (Utilisées dans le code)
-- ============================================
-- domains - Utilisé dans professionalController
-- sequences - Utilisé dans professionalController
-- contents - Utilisé dans professionalController
-- mini_controls - Utilisé dans professionalController
-- module_enrollments - Vérifier si utilisé
-- module_evaluations - Vérifier si utilisé
-- module_evaluation_results - Vérifier si utilisé
-- user_files - Utilisé dans fileController
-- user_evaluations - Utilisé dans evaluationController
-- evaluations - Utilisé dans evaluationController
-- assignments - Utilisé dans analyticsController

-- ============================================
-- Afficher les tables restantes
-- ============================================
SHOW TABLES;

