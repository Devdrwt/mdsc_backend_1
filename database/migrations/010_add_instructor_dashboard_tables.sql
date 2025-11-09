-- Migration : Tables essentielles pour le dashboard instructeur
-- Date : 2025-11-09

-- Table des paiements (utilisée pour les revenus instructeur)
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'XOF',
  payment_method ENUM('card', 'mobile_money', 'bank_transfer', 'cash', 'other') DEFAULT 'card',
  payment_provider VARCHAR(100) NULL,
  provider_transaction_id VARCHAR(255) NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled') DEFAULT 'pending',
  payment_data JSON NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_payments_user_id (user_id),
  INDEX idx_payments_course_id (course_id),
  INDEX idx_payments_status (status),
  INDEX idx_payments_provider_tx (provider_transaction_id),
  INDEX idx_payments_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table analytics cours (vue d'ensemble des cours instructeur)
CREATE TABLE IF NOT EXISTS course_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  total_enrollments INT DEFAULT 0,
  completion_rate DECIMAL(5, 2) DEFAULT 0.00,
  average_rating DECIMAL(3, 2) DEFAULT 0.00,
  total_views INT DEFAULT 0,
  total_enrollments_30d INT DEFAULT 0,
  total_views_30d INT DEFAULT 0,
  total_revenue_30d DECIMAL(12, 2) DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_course (course_id),
  INDEX idx_course_analytics_views (total_views),
  INDEX idx_course_analytics_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des activités utilisateur (gamification / activité récente)
CREATE TABLE IF NOT EXISTS user_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  points_earned INT DEFAULT 0,
  description TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_activities_user (user_id),
  INDEX idx_user_activities_type (activity_type),
  INDEX idx_user_activities_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des événements système (flux d'activité instructeur)
CREATE TABLE IF NOT EXISTS system_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  description TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INT NULL,
  course_id INT NULL,
  severity ENUM('info', 'warning', 'error') DEFAULT 'info',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  INDEX idx_system_events_type (event_type),
  INDEX idx_system_events_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des notifications (notifications instructeur)
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error', 'reminder') DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_type (type),
  INDEX idx_notifications_is_read (is_read),
  INDEX idx_notifications_created_at (created_at),
  INDEX idx_notifications_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

