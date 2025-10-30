-- Script pour supprimer les tables liées aux Séquences (fonctionnalité non utilisée)
-- Les séquences sont une alternative aux modules/leçons qui n'est pas utilisée
-- Ce script supprime les tables vides liées à cette fonctionnalité

USE mdsc_auth;

-- ⚠️ ATTENTION: Faire une sauvegarde avant!
-- mysqldump -u root mdsc_auth > backup_before_remove_sequences.sql

-- ============================================
-- TABLES À SUPPRIMER (Liées aux Séquences)
-- ============================================

-- Vérifier d'abord qu'elles sont vides
SELECT 'sequences' as table_name, COUNT(*) as rows FROM sequences;
SELECT 'sequence_progress' as table_name, COUNT(*) as rows FROM sequence_progress;
SELECT 'contents' as table_name, COUNT(*) as rows FROM contents WHERE sequence_id IS NOT NULL;
SELECT 'mini_controls' as table_name, COUNT(*) as rows FROM mini_controls;
SELECT 'mini_control_results' as table_name, COUNT(*) as rows FROM mini_control_results;

-- Supprimer les tables (décommenter pour exécuter)
DROP TABLE IF EXISTS sequence_progress;
DROP TABLE IF EXISTS mini_control_results;
DROP TABLE IF EXISTS mini_controls;
DROP TABLE IF EXISTS contents; -- ⚠️ Si contents n'est utilisé QUE pour sequences
DROP TABLE IF EXISTS sequences;

-- Afficher les tables restantes
SHOW TABLES;

