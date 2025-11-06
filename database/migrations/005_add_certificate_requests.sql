-- Migration : Workflow demande/validation certificats
-- Date : 2024-01-XX

CREATE TABLE IF NOT EXISTS certificate_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  enrollment_id INT NOT NULL,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'issued') DEFAULT 'pending',
  user_info JSON NOT NULL,
  rejection_reason TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  issued_at TIMESTAMP NULL,
  certificate_number VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_status (status),
  INDEX idx_reviewed_by (reviewed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter colonne request_id dans certificates
ALTER TABLE certificates 
ADD COLUMN request_id INT NULL AFTER id,
ADD INDEX idx_request_id (request_id),
ADD CONSTRAINT fk_certificates_request FOREIGN KEY (request_id) REFERENCES certificate_requests(id) ON DELETE SET NULL;

