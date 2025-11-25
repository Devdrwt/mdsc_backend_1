-- Migration : Amélioration du système de forum
-- Date : 2025-01-XX
-- Description : Ajout de fonctionnalités avancées au forum (réactions, réponses imbriquées)

USE mdsc_auth;

-- 1. Créer la table forums si elle n'existe pas
CREATE TABLE IF NOT EXISTS forums (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NULL,
  description TEXT,
  is_announcement BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course (course_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter title si la table existe déjà mais sans cette colonne
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'forums' 
  AND COLUMN_NAME = 'title');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE forums ADD COLUMN title VARCHAR(255) NULL AFTER name',
  'SELECT "Column title already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Mettre à jour title depuis name si title est NULL
UPDATE forums 
SET title = name 
WHERE title IS NULL AND name IS NOT NULL;

-- 2. Créer forum_discussions si elle n'existe pas
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
  last_reply_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_forum (forum_id),
  INDEX idx_user (user_id),
  INDEX idx_pinned (is_pinned),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter last_reply_by si la table existe déjà mais sans cette colonne
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'forum_discussions' 
  AND COLUMN_NAME = 'last_reply_by');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE forum_discussions ADD COLUMN last_reply_by INT NULL AFTER last_reply_at, ADD CONSTRAINT fk_forum_discussions_last_reply_by FOREIGN KEY (last_reply_by) REFERENCES users(id) ON DELETE SET NULL, ADD INDEX idx_forum_discussions_last_reply_by (last_reply_by)',
  'SELECT "Column last_reply_by already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Créer forum_replies si elle n'existe pas
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

-- Ajouter les colonnes parent_reply_id, upvotes, downvotes si elles n'existent pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'forum_replies' 
  AND COLUMN_NAME = 'parent_reply_id');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE forum_replies ADD COLUMN parent_reply_id INT NULL AFTER user_id, ADD COLUMN upvotes INT DEFAULT 0 AFTER is_solution, ADD COLUMN downvotes INT DEFAULT 0 AFTER upvotes',
  'SELECT "Columns already exist" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter la contrainte de clé étrangère pour parent_reply_id si elle n'existe pas
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'mdsc_auth' 
  AND TABLE_NAME = 'forum_replies' 
  AND CONSTRAINT_NAME = 'fk_forum_replies_parent');

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE forum_replies ADD CONSTRAINT fk_forum_replies_parent FOREIGN KEY (parent_reply_id) REFERENCES forum_replies(id) ON DELETE CASCADE, ADD INDEX idx_forum_replies_parent_reply_id (parent_reply_id)',
  'SELECT "Foreign key already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Créer table pour les réactions (upvote/downvote)
CREATE TABLE IF NOT EXISTS forum_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reply_id INT NOT NULL,
  user_id INT NOT NULL,
  reaction_type ENUM('upvote', 'downvote') DEFAULT 'upvote',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reply_id) REFERENCES forum_replies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_reaction (reply_id, user_id, reaction_type),
  INDEX idx_forum_reactions_reply_id (reply_id),
  INDEX idx_forum_reactions_user_id (user_id),
  INDEX idx_forum_reactions_type (reaction_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
