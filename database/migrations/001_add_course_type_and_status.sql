-- Migration : Ajout type de cours et statut de validation
-- Date : 2024-01-XX

-- 1. Ajouter colonnes dans courses (une par une pour éviter les erreurs)
ALTER TABLE courses 
ADD COLUMN course_type ENUM('live', 'on_demand') DEFAULT 'on_demand';

ALTER TABLE courses 
ADD COLUMN status ENUM('draft', 'pending_approval', 'approved', 'rejected', 'published') DEFAULT 'draft';

ALTER TABLE courses 
ADD COLUMN approved_by INT NULL;

ALTER TABLE courses 
ADD COLUMN approved_at TIMESTAMP NULL;

ALTER TABLE courses 
ADD COLUMN rejection_reason TEXT NULL;

ALTER TABLE courses 
ADD COLUMN evaluation_id INT NULL;

-- Ajouter les index
CREATE INDEX idx_course_type ON courses(course_type);

CREATE INDEX idx_status ON courses(status);

CREATE INDEX idx_approved_by ON courses(approved_by);

-- 2. Mettre à jour les cours existants
UPDATE courses SET status = 'published' WHERE is_published = TRUE;

UPDATE courses SET status = 'draft' WHERE is_published = FALSE;

-- 3. Table course_approvals (historique des validations)
CREATE TABLE IF NOT EXISTS course_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL,
  admin_id INT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT NULL,
  comments TEXT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_course_id (course_id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

