require('dotenv').config();
const { pool } = require('../src/config/database');

async function applyMigration() {
  try {
    console.log('📝 Application de la migration pour corriger la progression...\n');
    
    const connection = await pool.getConnection();
    
    try {
      // Supprimer l'ancien trigger
      await connection.query('DROP TRIGGER IF EXISTS update_course_progress');
      console.log('✅ Ancien trigger supprimé\n');
      
      // Créer le nouveau trigger
      const triggerSQL = `
        CREATE TRIGGER update_course_progress 
        AFTER UPDATE ON lesson_progress
        FOR EACH ROW
        BEGIN
          DECLARE total_lessons INT;
          DECLARE completed_lessons INT;
          DECLARE progress_from_lessons DECIMAL(5,2);
          DECLARE has_final_evaluation BOOLEAN;
          DECLARE final_evaluation_completed BOOLEAN;
          DECLARE final_evaluation_id INT;
          DECLARE final_progress_percentage DECIMAL(5,2);

          -- Compter le total des leçons publiées du cours
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
            SET progress_from_lessons = (completed_lessons / total_lessons) * 100;
          ELSE
            SET progress_from_lessons = 0;
          END IF;

          -- Vérifier si une évaluation finale existe pour ce cours
          SELECT id INTO final_evaluation_id
          FROM course_evaluations
          WHERE course_id = NEW.course_id AND is_published = TRUE
          LIMIT 1;

          SET has_final_evaluation = (final_evaluation_id IS NOT NULL);
          SET final_evaluation_completed = FALSE;

          IF has_final_evaluation THEN
            -- Vérifier si l'évaluation finale est complétée (peu importe si réussie ou échouée)
            SELECT COUNT(*) > 0 INTO final_evaluation_completed
            FROM quiz_attempts
            WHERE course_evaluation_id = final_evaluation_id
              AND user_id = NEW.user_id
              AND completed_at IS NOT NULL;
          END IF;

          -- Calculer la progression finale
          IF has_final_evaluation THEN
            IF progress_from_lessons >= 100 THEN
              IF final_evaluation_completed THEN
                -- Évaluation finale complétée (réussie ou échouée) = 100%
                SET final_progress_percentage = 100;
              ELSE
                -- Modules complétés mais évaluation finale pas encore complétée = 90%
                SET final_progress_percentage = 90;
              END IF;
            ELSE
              SET final_progress_percentage = progress_from_lessons;
            END IF;
          ELSE
            -- Pas d'évaluation finale, progression normale
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
          WHERE user_id = NEW.user_id AND course_id = NEW.course_id;
        END
      `;
      
      await connection.query(triggerSQL);
      
      console.log('✅ Nouveau trigger créé avec succès\n');
      console.log('✅ Le trigger vérifie maintenant que l\'évaluation finale est COMPLÉTÉE (réussie ou échouée) avant de mettre la progression à 100%\n');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'application de la migration:', error);
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

applyMigration();

