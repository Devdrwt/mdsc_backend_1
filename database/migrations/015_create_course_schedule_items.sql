-- Migration : Création de la table course_schedule_items pour synchroniser progression et calendrier
-- Date : 2025-11-13
-- Description : Table centrale pour lier le suivi de cours avec le calendrier

USE mdsc_auth;

-- ==============================================
-- Table course_schedule_items
-- ==============================================

CREATE TABLE IF NOT EXISTS `course_schedule_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` INT NOT NULL COMMENT 'Inscription à laquelle appartient cet item',
  `course_id` INT NOT NULL COMMENT 'Cours concerné',
  `lesson_id` INT NULL COMMENT 'Leçon associée (si type = lesson)',
  `quiz_id` INT NULL COMMENT 'Quiz associé (si type = quiz)',
  `module_id` INT NULL COMMENT 'Module associé (pour milestones)',
  `item_type` ENUM('lesson', 'quiz', 'deadline', 'reminder', 'milestone') NOT NULL DEFAULT 'lesson',
  `scheduled_date` DATETIME NOT NULL COMMENT 'Date et heure programmées',
  `estimated_duration_minutes` INT DEFAULT 30 COMMENT 'Durée estimée en minutes',
  `priority` ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  `status` ENUM('pending', 'in_progress', 'completed', 'skipped', 'overdue') DEFAULT 'pending',
  `auto_generated` BOOLEAN DEFAULT TRUE COMMENT 'Généré automatiquement ou créé manuellement',
  `metadata` JSON NULL COMMENT 'Données supplémentaires (type de milestone, etc.)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` DATETIME NULL COMMENT 'Date de complétion effective',
  `reminder_sent` BOOLEAN DEFAULT FALSE COMMENT 'Rappel déjà envoyé',
  FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE SET NULL,
  INDEX `idx_enrollment` (`enrollment_id`),
  INDEX `idx_scheduled_date` (`scheduled_date`),
  INDEX `idx_status` (`status`),
  INDEX `idx_item_type` (`item_type`),
  INDEX `idx_course` (`course_id`),
  INDEX `idx_lesson` (`lesson_id`),
  INDEX `idx_quiz` (`quiz_id`),
  INDEX `idx_enrollment_status` (`enrollment_id`, `status`),
  INDEX `idx_scheduled_status` (`scheduled_date`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- Extension de la table events pour la synchronisation
-- ==============================================
-- Note: Les colonnes schedule_item_id et auto_sync doivent être ajoutées manuellement
-- ou via un script Node.js car MySQL/MariaDB nécessite des vérifications dynamiques
-- 
-- Pour ajouter ces colonnes, exécutez les commandes suivantes :
--
-- ALTER TABLE events 
--   ADD COLUMN schedule_item_id INT NULL COMMENT 'Référence vers course_schedule_items' AFTER course_id,
--   ADD COLUMN auto_sync BOOLEAN DEFAULT FALSE COMMENT 'Synchronisé automatiquement depuis la progression' AFTER schedule_item_id;
--
-- ALTER TABLE events ADD INDEX idx_schedule_item (schedule_item_id);
--
-- ALTER TABLE events 
--   ADD CONSTRAINT fk_events_schedule_item 
--   FOREIGN KEY (schedule_item_id) REFERENCES course_schedule_items(id) ON DELETE SET NULL;

