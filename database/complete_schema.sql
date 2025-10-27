-- Architecture complète MdSC MOOC - Backend uniquement
-- Extension du schéma existant pour une plateforme complète

USE mdsc_auth;

-- ==============================================
-- MODULE GAMIFICATION
-- ==============================================

-- Table des badges
CREATE TABLE IF NOT EXISTS badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#007bff',
  points_required INT DEFAULT 0,
  criteria JSON, -- Critères pour obtenir le badge
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_points (points_required),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des badges utilisateurs
CREATE TABLE IF NOT EXISTS user_badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  badge_id INT NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  points_earned INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_badge (user_id, badge_id),
  INDEX idx_user (user_id),
  INDEX idx_badge (badge_id),
  INDEX idx_earned_at (earned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des points utilisateurs
CREATE TABLE IF NOT EXISTS user_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  points INT NOT NULL DEFAULT 0,
  level INT DEFAULT 1,
  total_points_earned INT DEFAULT 0,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_points (user_id),
  INDEX idx_points (points),
  INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des activités (pour calculer les points)
CREATE TABLE IF NOT EXISTS user_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  activity_type ENUM('login', 'course_completed', 'quiz_passed', 'lesson_completed', 'assignment_submitted', 'forum_post', 'badge_earned') NOT NULL,
  points_earned INT DEFAULT 0,
  description TEXT,
  metadata JSON, -- Données supplémentaires
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_activity_type (activity_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- MODULE DEVOIRS ET ÉVALUATIONS
-- ==============================================

-- Table des devoirs
CREATE TABLE IF NOT EXISTS assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  due_date DATETIME,
  max_points DECIMAL(5,2) DEFAULT 100.00,
  assignment_type ENUM('essay', 'file_upload', 'quiz', 'presentation') DEFAULT 'essay',
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course (course_id),
  INDEX idx_due_date (due_date),
  INDEX idx_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des soumissions de devoirs
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT,
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size INT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  grade DECIMAL(5,2) DEFAULT NULL,
  feedback TEXT,
  graded_at DATETIME DEFAULT NULL,
  graded_by INT DEFAULT NULL,
  status ENUM('submitted', 'graded', 'returned') DEFAULT 'submitted',
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_assignment_user (assignment_id, user_id),
  INDEX idx_assignment (assignment_id),
  INDEX idx_user (user_id),
  INDEX idx_submitted_at (submitted_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- MODULE FORUM ET COMMUNICATION
-- ==============================================

-- Table des forums
CREATE TABLE IF NOT EXISTS forums (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_announcement BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course (course_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des discussions
CREATE TABLE IF NOT EXISTS forum_discussions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  forum_id INT NOT NULL,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  views_count INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  last_reply_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_forum (forum_id),
  INDEX idx_user (user_id),
  INDEX idx_pinned (is_pinned),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des réponses aux discussions
CREATE TABLE IF NOT EXISTS forum_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discussion_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  is_solution BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (discussion_id) REFERENCES forum_discussions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_discussion (discussion_id),
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- MODULE IA ET RECOMMANDATIONS
-- ==============================================

-- Table des conversations IA
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255),
  context ENUM('general', 'course_help', 'assignment_help', 'study_plan') DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_context (context),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des messages IA
CREATE TABLE IF NOT EXISTS ai_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  metadata JSON, -- Données supplémentaires (tokens, model, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
  INDEX idx_conversation (conversation_id),
  INDEX idx_role (role),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des recommandations
CREATE TABLE IF NOT EXISTS recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT,
  recommendation_type ENUM('course', 'lesson', 'quiz', 'assignment', 'study_plan') NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority INT DEFAULT 1, -- 1-5, 5 étant le plus prioritaire
  is_viewed BOOLEAN DEFAULT FALSE,
  is_accepted BOOLEAN DEFAULT NULL,
  metadata JSON, -- Données de scoring, raisons, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_course (course_id),
  INDEX idx_type (recommendation_type),
  INDEX idx_priority (priority),
  INDEX idx_viewed (is_viewed),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- MODULE ANALYTICS ET MONITORING
-- ==============================================

-- Table des événements système
CREATE TABLE IF NOT EXISTS system_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type ENUM('user_login', 'user_logout', 'course_created', 'course_completed', 'quiz_submitted', 'assignment_graded', 'error_occurred') NOT NULL,
  user_id INT,
  course_id INT,
  description TEXT,
  metadata JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  INDEX idx_event_type (event_type),
  INDEX idx_user (user_id),
  INDEX idx_course (course_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des métriques de performance
CREATE TABLE IF NOT EXISTS performance_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  metric_unit VARCHAR(20),
  context JSON,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_metric_name (metric_name),
  INDEX idx_recorded_at (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- MODULE NOTIFICATIONS
-- ==============================================

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error', 'course', 'assignment', 'quiz', 'badge') DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_type (type),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- MODULE CALENDRIER ET ÉVÉNEMENTS
-- ==============================================

-- Table des événements
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type ENUM('assignment_due', 'quiz_scheduled', 'course_start', 'course_end', 'live_session', 'announcement') NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME,
  is_all_day BOOLEAN DEFAULT FALSE,
  location VARCHAR(255),
  is_public BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_course (course_id),
  INDEX idx_event_type (event_type),
  INDEX idx_start_date (start_date),
  INDEX idx_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- INSERTION DES DONNÉES INITIALES
-- ==============================================

-- Badges par défaut
INSERT INTO badges (name, description, icon, color, points_required, criteria) VALUES
('🏆 Première Connexion', 'Bienvenue sur la plateforme MdSC !', 'trophy', '#FFD700', 0, '{"action": "first_login"}'),
('📚 Premier Cours Complété', 'Félicitations pour votre premier cours !', 'book', '#28a745', 100, '{"action": "course_completed", "count": 1}'),
('🔥 Série de 7 Jours', 'Connexion quotidienne pendant 7 jours', 'fire', '#ff6b35', 200, '{"action": "daily_login", "streak": 7}'),
('🌟 Top du Leaderboard', 'Dans le top 10 du classement', 'star', '#ffc107', 500, '{"action": "leaderboard_top", "position": 10}'),
('👑 Master de la Plateforme', 'Expert de la plateforme MdSC', 'crown', '#6f42c1', 1000, '{"action": "total_points", "points": 5000}'),
('🎯 Perfectionniste', '100% de réussite aux quiz', 'target', '#dc3545', 300, '{"action": "quiz_perfect", "percentage": 100}'),
('🚀 Contributeur Actif', 'Participation active aux forums', 'rocket', '#17a2b8', 150, '{"action": "forum_posts", "count": 10}');

-- Forums par défaut pour chaque cours
-- (Sera créé automatiquement lors de la création d'un cours)

-- ==============================================
-- TRIGGERS POUR AUTOMATISATION
-- ==============================================

DELIMITER //

-- Trigger pour mettre à jour les points utilisateur
CREATE TRIGGER update_user_points 
AFTER INSERT ON user_activities
FOR EACH ROW
BEGIN
  INSERT INTO user_points (user_id, points, total_points_earned)
  VALUES (NEW.user_id, NEW.points_earned, NEW.points_earned)
  ON DUPLICATE KEY UPDATE
    points = points + NEW.points_earned,
    total_points_earned = total_points_earned + NEW.points_earned,
    last_activity_at = NOW();
  
  -- Mettre à jour le niveau basé sur les points
  UPDATE user_points 
  SET level = CASE
    WHEN points >= 10000 THEN 5  -- Expert
    WHEN points >= 6000 THEN 4   -- Avancé
    WHEN points >= 3000 THEN 3   -- Intermédiaire
    WHEN points >= 1000 THEN 2  -- Débutant
    ELSE 1                       -- Novice
  END
  WHERE user_id = NEW.user_id;
END//

-- Trigger pour créer un forum par défaut pour chaque cours
CREATE TRIGGER create_default_forum 
AFTER INSERT ON courses
FOR EACH ROW
BEGIN
  INSERT INTO forums (course_id, name, description, is_announcement)
  VALUES (NEW.id, 'Général', 'Forum général du cours', FALSE);
  
  INSERT INTO forums (course_id, name, description, is_announcement)
  VALUES (NEW.id, 'Annonces', 'Annonces importantes du cours', TRUE);
END//

-- Trigger pour créer des événements automatiques
CREATE TRIGGER create_course_events 
AFTER INSERT ON courses
FOR EACH ROW
BEGIN
  IF NEW.course_start_date IS NOT NULL THEN
    INSERT INTO events (course_id, title, event_type, start_date, is_public, created_by)
    VALUES (NEW.id, CONCAT('Début du cours: ', NEW.title), 'course_start', NEW.course_start_date, TRUE, NEW.instructor_id);
  END IF;
  
  IF NEW.course_end_date IS NOT NULL THEN
    INSERT INTO events (course_id, title, event_type, start_date, is_public, created_by)
    VALUES (NEW.id, CONCAT('Fin du cours: ', NEW.title), 'course_end', NEW.course_end_date, TRUE, NEW.instructor_id);
  END IF;
END//

DELIMITER ;
