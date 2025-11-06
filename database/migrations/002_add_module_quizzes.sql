-- Migration : Quiz de modules
-- Date : 2024-01-XX

CREATE TABLE IF NOT EXISTS module_quizzes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  module_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  passing_score INT DEFAULT 70,
  badge_id INT NULL,
  time_limit_minutes INT NULL,
  max_attempts INT DEFAULT 3,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE SET NULL,
  UNIQUE KEY unique_module_quiz (module_id),
  INDEX idx_module_id (module_id),
  INDEX idx_badge_id (badge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les tentatives de quiz de modules (utilise la même structure que quiz_attempts)
-- On réutilise quiz_attempts avec un champ optionnel module_quiz_id
ALTER TABLE quiz_attempts 
ADD COLUMN module_quiz_id INT NULL AFTER quiz_id,
ADD INDEX idx_module_quiz_id (module_quiz_id),
ADD CONSTRAINT fk_quiz_attempts_module_quiz FOREIGN KEY (module_quiz_id) REFERENCES module_quizzes(id) ON DELETE CASCADE;

