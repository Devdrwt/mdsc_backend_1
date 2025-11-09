-- Migration : ajout des colonnes de suivi d'activité dans user_points
-- Date : 2025-11-09

ALTER TABLE user_points
ADD COLUMN last_activity_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER total_points_earned,
ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER last_activity_at;

UPDATE user_points
SET
  last_activity_at = COALESCE(last_activity_at, updated_at, NOW()),
  created_at = COALESCE(created_at, updated_at, NOW());

