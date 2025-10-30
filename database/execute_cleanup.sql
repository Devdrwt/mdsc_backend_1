-- Script de nettoyage EXECUTABLE
USE mdsc_auth;

-- Vérifier d'abord les données
SELECT 'lesson_progress' as table_name, COUNT(*) as rows FROM lesson_progress;
SELECT 'forum_categories' as table_name, COUNT(*) as rows FROM forum_categories;
SELECT 'forum_posts' as table_name, COUNT(*) as rows FROM forum_posts;
SELECT 'forum_topics' as table_name, COUNT(*) as rows FROM forum_topics;
SELECT 'events' as table_name, COUNT(*) as rows FROM events;
SELECT 'event_attendees' as table_name, COUNT(*) as rows FROM event_attendees;

-- Supprimer les tables non utilisées
DROP TABLE IF EXISTS lesson_progress;
DROP TABLE IF EXISTS forum_categories;
DROP TABLE IF EXISTS forum_posts;
DROP TABLE IF EXISTS forum_topics;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS event_attendees;

-- Afficher les tables restantes
SELECT 'Tables restantes:' as info;
SHOW TABLES;

