-- Migration : Système de paiement
-- Date : 2024-01-XX

CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'XOF',
  payment_method ENUM('card', 'mobile_money') NOT NULL,
  payment_provider VARCHAR(50) NULL,
  provider_transaction_id VARCHAR(255) NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled') DEFAULT 'pending',
  payment_data JSON NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_status (status),
  INDEX idx_provider_transaction_id (provider_transaction_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter colonne payment_id dans enrollments
ALTER TABLE enrollments 
ADD COLUMN payment_id INT NULL AFTER enrolled_at,
ADD INDEX idx_payment_id (payment_id),
ADD CONSTRAINT fk_enrollments_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

