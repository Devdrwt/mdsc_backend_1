require('dotenv').config();
const { pool } = require('../src/config/database');

async function applyTrigger() {
  try {
    console.log('📝 Application du trigger pour la progression après évaluation finale...\n');
    
    const connection = await pool.getConnection();
    
    try {
      // Supprimer l'ancien trigger
      await connection.query('DROP TRIGGER IF EXISTS update_progress_on_evaluation_complete');
      console.log('✅ Ancien trigger supprimé\n');
      
      // Créer le nouveau trigger
      const triggerSQL = `
        CREATE TRIGGER update_progress_on_evaluation_complete
        AFTER UPDATE ON quiz_attempts
        FOR EACH ROW
        BEGIN
          DECLARE enrollment_id_val INT;
          DECLARE user_id_val INT;
          DECLARE course_id_val INT;
          DECLARE total_lessons INT;
          DECLARE completed_lessons INT;
          DECLARE progress_from_lessons DECIMAL(5,2);
          DECLARE final_progress_percentage DECIMAL(5,2);

          IF NEW.course_evaluation_id IS NOT NULL 
             AND NEW.completed_at IS NOT NULL 
             AND (OLD.completed_at IS NULL OR OLD.completed_at = '0000-00-00 00:00:00') THEN
            
            SET enrollment_id_val = NEW.enrollment_id;
            SET user_id_val = NEW.user_id;
            
            SELECT course_id INTO course_id_val
            FROM course_evaluations
            WHERE id = NEW.course_evaluation_id
            LIMIT 1;

            IF course_id_val IS NOT NULL AND enrollment_id_val IS NOT NULL THEN
              SELECT COUNT(*) INTO total_lessons
              FROM lessons
              WHERE course_id = course_id_val AND is_published = TRUE;

              SELECT COUNT(*) INTO completed_lessons
              FROM lesson_progress lp
              JOIN lessons l ON lp.lesson_id = l.id
              WHERE lp.user_id = user_id_val
                AND lp.course_id = course_id_val
                AND lp.is_completed = TRUE
                AND l.is_published = TRUE;

              IF total_lessons > 0 THEN
                SET progress_from_lessons = (completed_lessons / total_lessons) * 100;
              ELSE
                SET progress_from_lessons = 0;
              END IF;

              IF progress_from_lessons >= 100 THEN
                SET final_progress_percentage = 100;
              ELSE
                SET final_progress_percentage = progress_from_lessons;
              END IF;

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
        END
      `;
      
      await connection.query(triggerSQL);
      
      console.log('✅ Nouveau trigger créé avec succès\n');
      console.log('✅ Le trigger recalcule automatiquement la progression à 100% lorsqu\'une évaluation finale est complétée\n');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'application du trigger:', error);
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await pool.end();
  }
}

applyTrigger();

