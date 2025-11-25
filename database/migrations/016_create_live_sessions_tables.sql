-- Migration : Création des tables pour les cours en live avec Jitsi Meet
-- Date : 2025-01-XX
-- Description : Tables pour gérer les sessions live, participants et chat

USE mdsc_auth;

-- 1. Table live_sessions
CREATE TABLE IF NOT EXISTS live_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  instructor_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_start_at DATETIME NOT NULL,
  scheduled_end_at DATETIME NOT NULL,
  actual_start_at DATETIME NULL,
  actual_end_at DATETIME NULL,
  jitsi_room_name VARCHAR(255) NOT NULL UNIQUE,
  jitsi_server_url VARCHAR(255) DEFAULT 'https://meet.jit.si',
  jitsi_room_password VARCHAR(100) NULL,
  max_participants INT DEFAULT 50,
  is_recording_enabled BOOLEAN DEFAULT FALSE,
  recording_url TEXT NULL,
  status ENUM('scheduled', 'live', 'ended', 'cancelled') DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_live_sessions_course (course_id),
  INDEX idx_live_sessions_instructor (instructor_id),
  INDEX idx_live_sessions_scheduled_start (scheduled_start_at),
  INDEX idx_live_sessions_status (status),
  INDEX idx_live_sessions_jitsi_room (jitsi_room_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table live_session_participants
CREATE TABLE IF NOT EXISTS live_session_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  enrollment_id INT NULL,
  joined_at DATETIME NULL,
  left_at DATETIME NULL,
  attendance_duration INT DEFAULT 0 COMMENT 'Durée en minutes',
  is_present BOOLEAN DEFAULT FALSE,
  role ENUM('instructor', 'participant', 'moderator') DEFAULT 'participant',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_session_user (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL,
  INDEX idx_participants_session (session_id),
  INDEX idx_participants_user (user_id),
  INDEX idx_participants_enrollment (enrollment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table live_session_chat (optionnel - chat pendant la session)
CREATE TABLE IF NOT EXISTS live_session_chat (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  message_type ENUM('text', 'question', 'answer') DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_chat_session (session_id),
  INDEX idx_chat_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Vérifier et ajouter les colonnes à courses si elles n'existent pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'courses' 
  AND COLUMN_NAME = 'course_type');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE courses ADD COLUMN course_type ENUM(\'live\', \'on_demand\') DEFAULT \'on_demand\' AFTER difficulty',
  'SELECT "Column course_type already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier max_students
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'courses' 
  AND COLUMN_NAME = 'max_students');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE courses ADD COLUMN max_students INT NULL AFTER price',
  'SELECT "Column max_students already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier enrollment_deadline
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'courses' 
  AND COLUMN_NAME = 'enrollment_deadline');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE courses ADD COLUMN enrollment_deadline DATETIME NULL AFTER max_students',
  'SELECT "Column enrollment_deadline already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier course_start_date
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'courses' 
  AND COLUMN_NAME = 'course_start_date');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE courses ADD COLUMN course_start_date DATETIME NULL AFTER enrollment_deadline',
  'SELECT "Column course_start_date already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérifier course_end_date
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'courses' 
  AND COLUMN_NAME = 'course_end_date');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE courses ADD COLUMN course_end_date DATETIME NULL AFTER course_start_date',
  'SELECT "Column course_end_date already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Créer index pour course_type si nécessaire
CREATE INDEX IF NOT EXISTS idx_courses_type ON courses(course_type);
CREATE INDEX IF NOT EXISTS idx_courses_start_date ON courses(course_start_date);

