-- Migration : Amélioration du système de notation des cours
-- Date : 2025-01-XX
-- Description : Ajout de champs supplémentaires pour un système de notation complet

USE mdsc_auth;

-- 1. Ajouter les nouvelles colonnes à course_reviews
ALTER TABLE course_reviews 
ADD COLUMN IF NOT EXISTS enrollment_id INT NULL AFTER course_id,
ADD COLUMN IF NOT EXISTS pros TEXT NULL AFTER comment,
ADD COLUMN IF NOT EXISTS cons TEXT NULL AFTER pros,
ADD COLUMN IF NOT EXISTS would_recommend BOOLEAN DEFAULT TRUE AFTER cons,
ADD COLUMN IF NOT EXISTS is_verified_purchase BOOLEAN DEFAULT TRUE AFTER would_recommend,
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE AFTER is_verified_purchase,
ADD COLUMN IF NOT EXISTS status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER is_anonymous;

-- 2. Ajouter la clé étrangère pour enrollment_id
ALTER TABLE course_reviews
ADD CONSTRAINT fk_course_reviews_enrollment 
FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE;

-- 3. Modifier la contrainte UNIQUE pour inclure enrollment_id
ALTER TABLE course_reviews
DROP INDEX IF EXISTS unique_review;

ALTER TABLE course_reviews
ADD UNIQUE KEY unique_review (course_id, user_id, enrollment_id);

-- 4. Ajouter index pour enrollment_id
CREATE INDEX IF NOT EXISTS idx_course_reviews_enrollment_id ON course_reviews(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_status ON course_reviews(status);

-- 5. Mettre à jour les colonnes existantes
-- Si is_approved existe, migrer vers status
UPDATE course_reviews 
SET status = CASE 
  WHEN is_approved = TRUE THEN 'approved'
  WHEN is_approved = FALSE THEN 'pending'
  ELSE 'pending'
END
WHERE status = 'pending' AND is_approved IS NOT NULL;

-- 6. Ajouter les colonnes de statistiques à courses si elles n'existent pas
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00 AFTER price,
ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0 AFTER average_rating,
ADD COLUMN IF NOT EXISTS rating_distribution JSON DEFAULT '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}' AFTER rating_count;

-- 7. Créer une fonction/procédure pour mettre à jour les statistiques (si supporté)
-- Note: MySQL/MariaDB ne supporte pas les fonctions stockées de la même manière que PostgreSQL
-- On utilisera une fonction JavaScript côté backend pour cela

