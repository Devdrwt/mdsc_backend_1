// Script pour exécuter la migration 020_add_course_type_validation_trigger.sql
const { pool } = require('../src/config/database');

async function runMigration() {
  let connection;
  try {
    console.log('🔄 Exécution de la migration 020_add_course_type_validation_trigger.sql...');
    
    connection = await pool.getConnection();
    
    // Supprimer les triggers s'ils existent
    console.log('🗑️  Suppression des anciens triggers...');
    try {
      await connection.query('DROP TRIGGER IF EXISTS validate_live_course_before_insert');
      console.log('✅ Trigger validate_live_course_before_insert supprimé (s\'il existait)');
    } catch (error) {
      console.log('⚠️  Erreur lors de la suppression (normal si n\'existe pas):', error.message);
    }
    
    try {
      await connection.query('DROP TRIGGER IF EXISTS validate_live_course_before_update');
      console.log('✅ Trigger validate_live_course_before_update supprimé (s\'il existait)');
    } catch (error) {
      console.log('⚠️  Erreur lors de la suppression (normal si n\'existe pas):', error.message);
    }
    
    // Créer le trigger pour INSERT
    console.log('\n📝 Création du trigger validate_live_course_before_insert...');
    const triggerInsert = `
      CREATE TRIGGER validate_live_course_before_insert
      BEFORE INSERT ON courses
      FOR EACH ROW
      BEGIN
        IF NEW.course_type = 'live' THEN
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
          
          IF NEW.enrollment_deadline >= NEW.course_start_date THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'enrollment_deadline doit être antérieure à course_start_date';
          END IF;
          
          IF NEW.course_start_date >= NEW.course_end_date THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'course_start_date doit être antérieure à course_end_date';
          END IF;
        END IF;
      END
    `;
    
    await connection.query(triggerInsert);
    console.log('✅ Trigger validate_live_course_before_insert créé');
    
    // Créer le trigger pour UPDATE
    console.log('\n📝 Création du trigger validate_live_course_before_update...');
    const triggerUpdate = `
      CREATE TRIGGER validate_live_course_before_update
      BEFORE UPDATE ON courses
      FOR EACH ROW
      BEGIN
        IF NEW.course_type = 'live' THEN
          SET @enrollment_deadline = COALESCE(NEW.enrollment_deadline, OLD.enrollment_deadline);
          SET @course_start_date = COALESCE(NEW.course_start_date, OLD.course_start_date);
          SET @course_end_date = COALESCE(NEW.course_end_date, OLD.course_end_date);
          SET @max_students = COALESCE(NEW.max_students, OLD.max_students);
          
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
          
          IF @enrollment_deadline >= @course_start_date THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'enrollment_deadline doit être antérieure à course_start_date';
          END IF;
          
          IF @course_start_date >= @course_end_date THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'course_start_date doit être antérieure à course_end_date';
          END IF;
        END IF;
      END
    `;
    
    await connection.query(triggerUpdate);
    console.log('✅ Trigger validate_live_course_before_update créé');
    
    // Vérifier la structure
    console.log('\n📊 Vérification de la structure de la table courses...');
    const [columns] = await connection.query(`
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
      ORDER BY ORDINAL_POSITION
    `);
    
    console.table(columns);
    
    console.log('\n✅ Migration 020 exécutée avec succès!');
    console.log('✅ Triggers de validation créés pour les cours live');
    console.log('\n🔒 Protection complète activée:');
    console.log('   - Validation au niveau application (backend)');
    console.log('   - Validation au niveau base de données (triggers)');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

runMigration();

