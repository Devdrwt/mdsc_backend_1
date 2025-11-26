-- Migration pour ajouter un trigger qui recalcule la progression
-- lorsqu'une évaluation finale est complétée

DELIMITER //

DROP TRIGGER IF EXISTS update_progress_on_evaluation_complete;

CREATE TRIGGER update_progress_on_evaluation_complete
AFTER UPDATE ON quiz_attempts
FOR EACH ROW
BEGIN
  -- Déclarer les variables au début du bloc
  DECLARE enrollment_id_val INT;
  DECLARE user_id_val INT;
  DECLARE course_id_val INT;
  DECLARE total_lessons INT;
  DECLARE completed_lessons INT;
  DECLARE progress_from_lessons DECIMAL(5,2);
  DECLARE final_progress_percentage DECIMAL(5,2);

  -- Vérifier si c'est une évaluation finale (course_evaluation_id IS NOT NULL)
  -- et si la tentative vient d'être complétée (completed_at est maintenant défini)
  IF NEW.course_evaluation_id IS NOT NULL 
     AND NEW.completed_at IS NOT NULL 
     AND (OLD.completed_at IS NULL OR OLD.completed_at = '0000-00-00 00:00:00') THEN
    
    -- Récupérer l'enrollment_id depuis la tentative
    SET enrollment_id_val = NEW.enrollment_id;
    SET user_id_val = NEW.user_id;
    
    -- Récupérer le course_id depuis l'évaluation finale
    SELECT course_id INTO course_id_val
    FROM course_evaluations
    WHERE id = NEW.course_evaluation_id
    LIMIT 1;

    IF course_id_val IS NOT NULL AND enrollment_id_val IS NOT NULL THEN
      -- Compter le total des leçons publiées du cours
      SELECT COUNT(*) INTO total_lessons
      FROM lessons
      WHERE course_id = course_id_val AND is_published = TRUE;

      -- Compter les leçons complétées par l'utilisateur
      SELECT COUNT(*) INTO completed_lessons
      FROM lesson_progress lp
      JOIN lessons l ON lp.lesson_id = l.id
      WHERE lp.user_id = user_id_val
        AND lp.course_id = course_id_val
        AND lp.is_completed = TRUE
        AND l.is_published = TRUE;

      -- Calculer la progression basée sur les leçons
      IF total_lessons > 0 THEN
        SET progress_from_lessons = (completed_lessons / total_lessons) * 100;
      ELSE
        SET progress_from_lessons = 0;
      END IF;

      -- Calculer la progression finale
      IF progress_from_lessons >= 100 THEN
        -- Tous les modules sont complétés et l'évaluation finale est complétée = 100%
        SET final_progress_percentage = 100;
      ELSE
        SET final_progress_percentage = progress_from_lessons;
      END IF;

      -- Mettre à jour la progression dans enrollments
      UPDATE enrollments
      SET progress_percentage = final_progress_percentage,
          completed_at = CASE
            WHEN final_progress_percentage = 100 AND completed_at IS NULL THEN NOW()
            ELSE completed_at
          END,
          status = CASE
            WHEN final_progress_percentage = 100 THEN 'completed'
            ELSE 'in_progress'
          END
      WHERE id = enrollment_id_val;
    END IF;
  END IF;
END//

DELIMITER ;

