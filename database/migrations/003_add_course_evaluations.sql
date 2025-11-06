-- Migration : Évaluation finale unique par cours
-- Date : 2024-01-XX

-- Table pour les évaluations finales (relation 1:1 avec courses)
CREATE TABLE IF NOT EXISTS course_evaluations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  passing_score INT DEFAULT 70,
  duration_minutes INT NULL,
  max_attempts INT DEFAULT 3,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course_id (course_id),
  INDEX idx_is_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les questions d'évaluation finale (réutilise quiz_questions avec un lien)
-- On ajoute un champ course_evaluation_id dans quiz_questions
ALTER TABLE quiz_questions 
ADD COLUMN course_evaluation_id INT NULL AFTER quiz_id,
ADD INDEX idx_course_evaluation_id (course_evaluation_id),
ADD CONSTRAINT fk_quiz_questions_course_evaluation FOREIGN KEY (course_evaluation_id) REFERENCES course_evaluations(id) ON DELETE CASCADE;

-- Table pour les tentatives d'évaluation finale (réutilise quiz_attempts)
ALTER TABLE quiz_attempts 
ADD COLUMN course_evaluation_id INT NULL AFTER module_quiz_id,
ADD INDEX idx_course_evaluation_id (course_evaluation_id),
ADD CONSTRAINT fk_quiz_attempts_course_evaluation FOREIGN KEY (course_evaluation_id) REFERENCES course_evaluations(id) ON DELETE CASCADE;

-- Mettre à jour la colonne evaluation_id dans courses si une évaluation finale existe
-- Cette requête sera exécutée après la création des évaluations finales

