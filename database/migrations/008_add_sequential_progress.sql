-- Migration : Support progression séquentielle
-- Date : 2024-01-XX

-- Ajouter colonne is_sequential dans courses
ALTER TABLE courses 
ADD COLUMN is_sequential BOOLEAN DEFAULT TRUE AFTER course_type,
ADD INDEX idx_is_sequential (is_sequential);

-- Ajouter colonne is_optional dans lessons
ALTER TABLE lessons 
ADD COLUMN is_optional BOOLEAN DEFAULT FALSE AFTER is_published,
ADD INDEX idx_is_optional (is_optional);

