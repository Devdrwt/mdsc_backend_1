-- Migration: Ajout des modules, media_files et amélioration de la structure selon l'architecture
-- À exécuter après courses_schema.sql

USE mdsc_auth;

-- Ajouter slug et prerequisite_course_id à la table courses
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE AFTER title,
ADD COLUMN IF NOT EXISTS prerequisite_course_id INT AFTER instructor_id,
ADD INDEX IF NOT EXISTS idx_slug (slug),
ADD INDEX IF NOT EXISTS idx_prerequisite (prerequisite_course_id),
ADD FOREIGN KEY IF NOT EXISTS (prerequisite_course_id) REFERENCES courses(id) ON DELETE SET NULL;

-- Ajouter status à enrollments selon l'architecture
ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS status ENUM('enrolled', 'in_progress', 'completed', 'certified') DEFAULT 'enrolled' AFTER course_id,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL AFTER enrolled_at,
ADD INDEX IF NOT EXISTS idx_status (status);

-- Table des modules (selon l'architecture)
CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  is_unlocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course (course_id),
  INDEX idx_order (course_id, order_index),
  INDEX idx_unlocked (is_unlocked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Modifier lessons pour suivre l'architecture: ajouter module_id et content_type
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS module_id INT AFTER course_id,
ADD COLUMN IF NOT EXISTS content_type ENUM(
  'video', 'text', 'quiz', 'h5p', 'forum', 
  'assignment', 'document', 'audio', 'presentation'
) DEFAULT 'text' AFTER title,
ADD COLUMN IF NOT EXISTS media_file_id INT AFTER content_type,
ADD COLUMN IF NOT EXISTS content_url VARCHAR(500) AFTER media_file_id,
ADD COLUMN IF NOT EXISTS content_text TEXT AFTER content_url,
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT TRUE AFTER order_index,
ADD INDEX IF NOT EXISTS idx_module (module_id),
ADD INDEX IF NOT EXISTS idx_content_type (content_type),
ADD INDEX IF NOT EXISTS idx_media_file (media_file_id),
MODIFY COLUMN content TEXT COMMENT 'Pour type text: contenu HTML/Markdown';

-- Modifier la relation: les leçons peuvent appartenir à un module ou directement au cours
-- Si module_id est NULL, la leçon appartient directement au cours (pour compatibilité)
ALTER TABLE lessons
ADD FOREIGN KEY IF NOT EXISTS (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Table des media_files (selon l'architecture)
CREATE TABLE IF NOT EXISTS media_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT,
  course_id INT,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL COMMENT 'MIME type',
  file_category ENUM('video', 'document', 'audio', 'image', 'presentation', 'h5p', 'other') NOT NULL,
  file_size BIGINT NOT NULL COMMENT 'en bytes',
  storage_type ENUM('minio', 's3', 'local') DEFAULT 'local',
  bucket_name VARCHAR(100),
  storage_path VARCHAR(500) NOT NULL,
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  duration INT COMMENT 'Pour vidéos/audio en secondes',
  metadata JSON,
  uploaded_by INT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lesson (lesson_id),
  INDEX idx_course (course_id),
  INDEX idx_category (file_category),
  INDEX idx_uploaded_by (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table de progression selon l'architecture (différente de lesson_progress)
-- Cette table lie progress à enrollment_id et lesson_id
CREATE TABLE IF NOT EXISTS progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  lesson_id INT NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  completion_percentage INT DEFAULT 0,
  time_spent INT DEFAULT 0 COMMENT 'en secondes',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE KEY unique_progress (enrollment_id, lesson_id),
  INDEX idx_enrollment (enrollment_id),
  INDEX idx_lesson (lesson_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter foreign key pour media_file_id dans lessons après création de media_files
ALTER TABLE lessons
ADD FOREIGN KEY IF NOT EXISTS (media_file_id) REFERENCES media_files(id) ON DELETE SET NULL;

-- Modifier quizzes pour suivre l'architecture
ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT FALSE AFTER max_attempts,
MODIFY COLUMN passing_score DECIMAL(5,2) DEFAULT 70.00 COMMENT 'Score minimum en %',
MODIFY COLUMN time_limit_minutes INT COMMENT 'en minutes';

-- Modifier quiz_questions pour supporter JSON options
ALTER TABLE quiz_questions
ADD COLUMN IF NOT EXISTS options JSON COMMENT 'Pour multiple_choice: [{"text": "...", "correct": true}]' AFTER question_type,
ADD COLUMN IF NOT EXISTS correct_answer TEXT COMMENT 'Pour true_false et short_answer' AFTER options,
MODIFY COLUMN question_type ENUM('multiple_choice', 'true_false', 'short_answer') DEFAULT 'multiple_choice';

-- Modifier quiz_attempts pour supporter JSON answers
ALTER TABLE quiz_attempts
ADD COLUMN IF NOT EXISTS answers JSON COMMENT '{questionId: answer}' AFTER quiz_id,
MODIFY COLUMN score DECIMAL(5,2) DEFAULT 0.00,
MODIFY COLUMN time_spent_minutes INT COMMENT 'en minutes';

-- Améliorer certificates selon l'architecture
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS certificate_code VARCHAR(100) UNIQUE NOT NULL COMMENT 'Pour QR code' AFTER id,
ADD COLUMN IF NOT EXISTS qr_code_url VARCHAR(500) AFTER pdf_url,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL COMMENT 'Validité optionnelle' AFTER issued_at,
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE AFTER expires_at,
MODIFY COLUMN certificate_number VARCHAR(50) COMMENT 'Numéro formaté pour affichage',
ADD INDEX IF NOT EXISTS idx_certificate_code (certificate_code),
ADD INDEX IF NOT EXISTS idx_verified (verified);

-- Table badges selon l'architecture
CREATE TABLE IF NOT EXISTS badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  category VARCHAR(50),
  criteria JSON NOT NULL COMMENT '{"type": "course_completion", "value": 1}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- S'assurer que toutes les colonnes existent si la table existe déjà
ALTER TABLE badges
ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS icon_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS criteria JSON NOT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Table user_badges selon l'architecture
CREATE TABLE IF NOT EXISTS user_badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  badge_id INT NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_badge (user_id, badge_id),
  INDEX idx_user (user_id),
  INDEX idx_badge (badge_id),
  INDEX idx_earned_at (earned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Créer un trigger pour générer automatiquement le slug
DELIMITER //

DROP TRIGGER IF EXISTS generate_course_slug //
CREATE TRIGGER generate_course_slug
BEFORE INSERT ON courses
FOR EACH ROW
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    SET NEW.slug = LOWER(REPLACE(REPLACE(REPLACE(NEW.title, ' ', '-'), 'é', 'e'), 'è', 'e'));
    SET NEW.slug = CONCAT(NEW.slug, '-', UNIX_TIMESTAMP());
  END IF;
END//

DELIMITER ;

-- Insérer quelques badges par défaut
INSERT IGNORE INTO badges (name, description, category, criteria) VALUES
('Premiers pas', 'Compléter son profil utilisateur', 'general', '{"type": "profile_completion", "completed": true}'),
('Explorateur MdSC', 'Visiter au moins 3 pages différentes', 'general', '{"type": "pages_visited", "count": 3}'),
('Engagé', 'S\'inscrire à son premier cours', 'courses', '{"type": "courses_enrolled", "count": 1}'),
('Marathonien', 'Compléter 5 cours', 'courses', '{"type": "courses_completed", "count": 5}');

-- Mettre à jour les catégories pour correspondre à l'architecture
UPDATE categories SET name = 'Santé', color = '#e74c3c' WHERE name = 'Développement Web';
INSERT IGNORE INTO categories (name, description, color, icon) VALUES
('Éducation', 'Cours de formation et éducation', '#3498db', 'book'),
('Gouvernance', 'Formation en gouvernance et leadership', '#2ecc71', 'shield'),
('Environnement', 'Cours sur l\'environnement et le développement durable', '#1abc9c', 'leaf'),
('Économie', 'Formation économique et financière', '#f39c12', 'dollar');

COMMIT;

