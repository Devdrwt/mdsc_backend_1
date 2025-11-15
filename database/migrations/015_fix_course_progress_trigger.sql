-- Migration pour corriger le trigger de progression du cours
-- Le trigger doit tenir compte de l'évaluation finale avant de mettre à 100%

-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS update_course_progress;

-- Créer le nouveau trigger avec la logique de l'évaluation finale
DELIMITER //

CREATE TRIGGER update_course_progress 
AFTER UPDATE ON lesson_progress
FOR EACH ROW
BEGIN
  DECLARE total_lessons INT;
  DECLARE completed_lessons INT;
  DECLARE progress_percentage DECIMAL(5,2);
  DECLARE has_final_evaluation INT DEFAULT 0;
  DECLARE final_evaluation_completed INT DEFAULT 0;
  DECLARE final_evaluation_id INT;
  DECLARE passing_score DECIMAL(5,2);
  
  -- Compter le total des leçons du cours
  SELECT COUNT(*) INTO total_lessons 
  FROM lessons 
  WHERE course_id = NEW.course_id AND is_published = TRUE;
  
  -- Compter les leçons complétées par l'utilisateur
  SELECT COUNT(*) INTO completed_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  WHERE lp.user_id = NEW.user_id 
    AND lp.course_id = NEW.course_id 
    AND lp.is_completed = TRUE
    AND l.is_published = TRUE;
  
  -- Calculer la progression basée sur les leçons
  IF total_lessons > 0 THEN
    SET progress_percentage = (completed_lessons / total_lessons) * 100;
    
    -- Vérifier si une évaluation finale existe pour ce cours
    SELECT COUNT(*), id, passing_score INTO has_final_evaluation, final_evaluation_id, passing_score
    FROM course_evaluations 
    WHERE course_id = NEW.course_id AND is_published = TRUE
    LIMIT 1;
    
    -- Si une évaluation finale existe et que toutes les leçons sont complétées
    IF has_final_evaluation > 0 AND progress_percentage >= 100 THEN
      -- Vérifier si l'évaluation finale est complétée (peu importe si réussie ou échouée)
      SELECT COUNT(*) INTO final_evaluation_completed
      FROM quiz_attempts
      WHERE course_evaluation_id = final_evaluation_id 
        AND user_id = NEW.user_id 
        AND completed_at IS NOT NULL;
      
      -- Si l'évaluation finale n'est pas complétée, limiter à 90%
      IF final_evaluation_completed = 0 THEN
        SET progress_percentage = 90;
      END IF;
    END IF;
    
    -- Mettre à jour la progression dans enrollments
    UPDATE enrollments 
    SET progress_percentage = progress_percentage,
        completed_at = CASE 
          WHEN progress_percentage = 100 THEN NOW() 
          ELSE completed_at 
        END
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;
  END IF;
END//

DELIMITER ;

