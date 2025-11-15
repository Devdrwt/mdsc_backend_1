require('dotenv').config();
const { pool } = require('../src/config/database');

async function resetEvaluation() {
  const email = 'abdoubachabikowiyou@gmail.com';
  const courseTitle = 'Développement Web Full-Stack';
  
  try {
    // 1. Trouver l'utilisateur
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log(`❌ Utilisateur non trouvé avec l'email: ${email}`);
      return;
    }

    const user = users[0];
    const userId = user.id;
    console.log(`\n✅ Utilisateur trouvé: ${user.first_name} ${user.last_name} (ID: ${user.id})\n`);

    // 2. Trouver le cours
    const [courses] = await pool.execute(
      'SELECT id, title FROM courses WHERE title LIKE ?',
      [`%${courseTitle}%`]
    );

    if (courses.length === 0) {
      console.log(`❌ Cours non trouvé: ${courseTitle}`);
      return;
    }

    const course = courses[0];
    console.log(`✅ Cours trouvé: ${course.title} (ID: ${course.id})\n`);

    // 3. Trouver l'évaluation finale du cours
    const [evaluations] = await pool.execute(
      'SELECT id, title FROM course_evaluations WHERE course_id = ? AND is_published = TRUE',
      [course.id]
    );

    if (evaluations.length === 0) {
      console.log(`❌ Aucune évaluation finale trouvée pour ce cours`);
      return;
    }

    const evaluation = evaluations[0];
    console.log(`✅ Évaluation trouvée: ${evaluation.title} (ID: ${evaluation.id})\n`);

    // 4. Trouver l'enrollment
    const [enrollments] = await pool.execute(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND is_active = TRUE',
      [userId, course.id]
    );

    if (enrollments.length === 0) {
      console.log(`❌ Aucun enrollment actif trouvé pour cet utilisateur et ce cours`);
      return;
    }

    const enrollment = enrollments[0];
    console.log(`✅ Enrollment trouvé (ID: ${enrollment.id})\n`);

    // 5. Trouver toutes les tentatives d'évaluation
    const [attempts] = await pool.execute(
      `SELECT id, started_at, completed_at, score, percentage, is_passed 
       FROM quiz_attempts 
       WHERE user_id = ? AND course_evaluation_id = ?`,
      [userId, evaluation.id]
    );

    console.log(`📝 Tentatives trouvées: ${attempts.length}\n`);
    
    if (attempts.length === 0) {
      console.log('ℹ️ Aucune tentative à supprimer.\n');
      return;
    }

    attempts.forEach((attempt, index) => {
      console.log(`${index + 1}. Tentative ID: ${attempt.id}`);
      console.log(`   Démarrée: ${new Date(attempt.started_at).toLocaleString('fr-FR')}`);
      if (attempt.completed_at) {
        console.log(`   Complétée: ${new Date(attempt.completed_at).toLocaleString('fr-FR')}`);
        console.log(`   Score: ${attempt.score || 'N/A'}`);
        console.log(`   Pourcentage: ${attempt.percentage || 'N/A'}%`);
        console.log(`   Réussie: ${attempt.is_passed ? 'Oui' : 'Non'}`);
      } else {
        console.log(`   ⏳ En cours (non complétée)`);
      }
      console.log('');
    });

    // 6. Supprimer toutes les tentatives
    console.log('🗑️ Suppression des tentatives...\n');
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Supprimer les réponses des tentatives (si elles existent dans une table séparée)
      // Note: Les réponses sont généralement stockées dans quiz_attempts.answers (JSON)
      // On supprime directement les tentatives

      // Supprimer toutes les tentatives
      const [deleteResult] = await connection.execute(
        'DELETE FROM quiz_attempts WHERE user_id = ? AND course_evaluation_id = ?',
        [userId, evaluation.id]
      );

      await connection.commit();
      
      console.log(`✅ ${deleteResult.affectedRows} tentative(s) supprimée(s) avec succès\n`);
      console.log('✅ L\'évaluation a été réinitialisée. L\'utilisateur peut maintenant refaire l\'évaluation.\n');

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // 7. Vérifier que les tentatives ont bien été supprimées
    const [remainingAttempts] = await pool.execute(
      'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ? AND course_evaluation_id = ?',
      [userId, evaluation.id]
    );

    console.log(`📊 Vérification: ${remainingAttempts[0].count} tentative(s) restante(s)\n`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await pool.end();
  }
}

resetEvaluation();

