-- Migration : Ajout d'un trigger pour valider les cours live au niveau base de données
-- Date : 2025-11-26
-- Description : Valide que les cours live ont tous les champs obligatoires remplis

USE mdsc_auth;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS validate_live_course_before_insert;
DROP TRIGGER IF EXISTS validate_live_course_before_update;

-- Trigger pour INSERT : Valider les cours live avant insertion
DELIMITER $$

CREATE TRIGGER validate_live_course_before_insert
BEFORE INSERT ON courses
FOR EACH ROW
BEGIN
  IF NEW.course_type = 'live' THEN
    -- Vérifier que les champs obligatoires sont remplis
    IF NEW.enrollment_deadline IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'enrollment_deadline est obligatoire pour les cours en live';
    END IF;
    
    IF NEW.course_start_date IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'course_start_date est obligatoire pour les cours en live';
    END IF;
    
    IF NEW.course_end_date IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'course_end_date est obligatoire pour les cours en live';
    END IF;
    
    IF NEW.max_students IS NULL OR NEW.max_students <= 0 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'max_students doit être > 0 pour les cours en live';
    END IF;
    
    -- Vérifier l'ordre des dates
    IF NEW.enrollment_deadline >= NEW.course_start_date THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'enrollment_deadline doit être antérieure à course_start_date';
    END IF;
    
    IF NEW.course_start_date >= NEW.course_end_date THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'course_start_date doit être antérieure à course_end_date';
    END IF;
  END IF;
END$$

-- Trigger pour UPDATE : Valider les cours live avant mise à jour
CREATE TRIGGER validate_live_course_before_update
BEFORE UPDATE ON courses
FOR EACH ROW
BEGIN
  -- Si le type change vers 'live' ou si c'est déjà un cours live
  IF NEW.course_type = 'live' THEN
    -- Utiliser les nouvelles valeurs ou les anciennes si non modifiées
    SET @enrollment_deadline = COALESCE(NEW.enrollment_deadline, OLD.enrollment_deadline);
    SET @course_start_date = COALESCE(NEW.course_start_date, OLD.course_start_date);
    SET @course_end_date = COALESCE(NEW.course_end_date, OLD.course_end_date);
    SET @max_students = COALESCE(NEW.max_students, OLD.max_students);
    
    -- Vérifier que les champs obligatoires sont remplis
    IF @enrollment_deadline IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'enrollment_deadline est obligatoire pour les cours en live';
    END IF;
    
    IF @course_start_date IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'course_start_date est obligatoire pour les cours en live';
    END IF;
    
    IF @course_end_date IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'course_end_date est obligatoire pour les cours en live';
    END IF;
    
    IF @max_students IS NULL OR @max_students <= 0 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'max_students doit être > 0 pour les cours en live';
    END IF;
    
    -- Vérifier l'ordre des dates
    IF @enrollment_deadline >= @course_start_date THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'enrollment_deadline doit être antérieure à course_start_date';
    END IF;
    
    IF @course_start_date >= @course_end_date THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'course_start_date doit être antérieure à course_end_date';
    END IF;
  END IF;
END$$

DELIMITER ;

-- Vérifier la structure actuelle de la table courses
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'mdsc_auth'
  AND TABLE_NAME = 'courses'
  AND COLUMN_NAME IN ('course_type', 'enrollment_deadline', 'course_start_date', 'course_end_date', 'max_students')
ORDER BY ORDINAL_POSITION;

