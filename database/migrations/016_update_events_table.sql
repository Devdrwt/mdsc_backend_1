-- Migration : Mise à jour de la table events pour la synchronisation calendrier
-- Date : 2025-11-14

USE mdsc_auth;

-- ==============================================
-- Ajout des colonnes manquantes
-- ==============================================

ALTER TABLE `events`
  ADD COLUMN `event_type` ENUM('assignment_due', 'quiz_scheduled', 'course_start', 'course_end', 'live_session', 'announcement') NOT NULL DEFAULT 'announcement' AFTER `description`,
  ADD COLUMN `is_all_day` BOOLEAN DEFAULT FALSE AFTER `end_date`,
  ADD COLUMN `is_public` BOOLEAN DEFAULT TRUE AFTER `location`;

-- ==============================================
-- Index pour les nouvelles colonnes
-- ==============================================

ALTER TABLE `events`
  ADD INDEX `idx_event_type` (`event_type`),
  ADD INDEX `idx_public` (`is_public`);

-- ==============================================
-- Mise à jour des données existantes
-- ==============================================

UPDATE `events`
SET `event_type` = 'announcement'
WHERE `event_type` IS NULL;

