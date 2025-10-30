-- Script de nettoyage : Suppression des tables non utilisées dans le projet
-- À EXÉCUTER AVEC PRÉCAUTION - Faire une sauvegarde avant !

USE mdsc_auth;

-- ⚠️ ATTENTION: Ce script supprime des tables qui ne sont PAS utilisées dans le code
-- Faites une sauvegarde avant d'exécuter !

-- Tables qui semblent être des doublons ou non utilisées:
-- (Vérifiez manuellement avant de décommenter)

-- Supprimer lesson_progress (remplacé par progress)
-- DROP TABLE IF EXISTS lesson_progress;

-- Tables qui ne sont pas dans l'architecture actuelle:
-- (À supprimer seulement si confirmé qu'elles ne sont pas utilisées)

-- DROP TABLE IF EXISTS contents;
-- DROP TABLE IF EXISTS domains;
-- DROP TABLE IF EXISTS mini_controls;
-- DROP TABLE IF EXISTS mini_control_results;
-- DROP TABLE IF EXISTS sequences;
-- DROP TABLE IF EXISTS sequence_progress;
-- DROP TABLE IF EXISTS module_enrollments;
-- DROP TABLE IF EXISTS module_evaluations;
-- DROP TABLE IF EXISTS module_evaluation_results;
-- DROP TABLE IF EXISTS assignments;
-- DROP TABLE IF EXISTS assignment_submissions;
-- DROP TABLE IF EXISTS events;
-- DROP TABLE IF EXISTS event_attendees;
-- DROP TABLE IF EXISTS forum_categories;
-- DROP TABLE IF EXISTS forum_posts;
-- DROP TABLE IF EXISTS forum_topics;
-- DROP TABLE IF EXISTS user_files;
-- DROP TABLE IF EXISTS user_evaluations; -- Différent de quiz_attempts
-- DROP TABLE IF EXISTS evaluations; -- Différent de quizzes

-- Afficher les tables restantes
SHOW TABLES;

