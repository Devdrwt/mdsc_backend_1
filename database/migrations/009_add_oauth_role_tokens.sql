-- Migration: Ajouter la table oauth_role_tokens pour stocker les rôles lors de l'authentification Google OAuth
-- Date: 2024-12-XX
-- Description: Cette table permet de stocker temporairement le rôle sélectionné lors de l'authentification Google OAuth
--              Le token est passé dans le paramètre state et récupéré dans le callback

CREATE TABLE IF NOT EXISTS oauth_role_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nettoyer les tokens expirés (optionnel - peut être fait par un cron job)
-- DELETE FROM oauth_role_tokens WHERE expires_at < NOW();

