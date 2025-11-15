require('dotenv').config();
const { pool } = require('../src/config/database');

async function getUserEvaluations() {
  const email = 'abdoubachabikowiyou@gmail.com';
  
  try {
    // 1. Trouver l'utilisateur par email
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log(`❌ Utilisateur non trouvé avec l'email: ${email}`);
      return;
    }

    const user = users[0];
    console.log(`\n✅ Utilisateur trouvé:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nom: ${user.first_name} ${user.last_name}\n`);

    const userId = user.id;

    // 2. Récupérer les évaluations finales (course_evaluations)
    const finalEvaluationsQuery = `
      SELECT 
        ce.id,
        ce.title,
        ce.description,
        ce.passing_score,
        ce.duration_minutes,
        ce.max_attempts,
        ce.is_published,
        ce.created_at,
        ce.updated_at,
        c.id as course_id,
        c.title as course_title,
        c.slug as course_slug,
        e.id as enrollment_id,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN qa.id END) as attempts_count,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as best_score,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.completed_at END) as passed_at,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NULL THEN qa.id END) as incomplete_attempts_count,
        MAX(CASE WHEN qa.completed_at IS NULL THEN qa.started_at END) as incomplete_started_at
      FROM course_evaluations ce
      INNER JOIN courses c ON ce.course_id = c.id
      INNER JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.is_active = TRUE
      LEFT JOIN quiz_attempts qa ON ce.id = qa.course_evaluation_id AND qa.user_id = ?
      WHERE ce.is_published = TRUE
      GROUP BY ce.id, c.id, e.id
      ORDER BY ce.created_at DESC
    `;

    const [finalEvaluations] = await pool.execute(finalEvaluationsQuery, [userId, userId]);

    console.log(`\n📊 ÉVALUATIONS FINALES (${finalEvaluations.length}):\n`);
    
    if (finalEvaluations.length === 0) {
      console.log('   Aucune évaluation finale trouvée.\n');
    } else {
      finalEvaluations.forEach((eval, index) => {
        console.log(`${index + 1}. ${eval.title}`);
        console.log(`   Cours: ${eval.course_title} (ID: ${eval.course_id})`);
        console.log(`   Enrollment ID: ${eval.enrollment_id}`);
        console.log(`   Score minimum: ${eval.passing_score}%`);
        console.log(`   Durée: ${eval.duration_minutes || 'N/A'} minutes`);
        console.log(`   Tentatives max: ${eval.max_attempts}`);
        console.log(`   Tentatives complétées: ${eval.attempts_count || 0}`);
        console.log(`   Meilleur score: ${eval.best_score ? eval.best_score + '%' : 'N/A'}`);
        console.log(`   Dernière réussite: ${eval.passed_at ? new Date(eval.passed_at).toLocaleString('fr-FR') : 'N/A'}`);
        console.log(`   Tentatives incomplètes: ${eval.incomplete_attempts_count || 0}`);
        if (eval.incomplete_started_at) {
          console.log(`   Dernière tentative incomplète démarrée: ${new Date(eval.incomplete_started_at).toLocaleString('fr-FR')}`);
        }
        console.log('');
      });
    }

    // 3. Récupérer les tentatives d'évaluations
    const attemptsQuery = `
      SELECT 
        qa.id,
        qa.course_evaluation_id,
        qa.enrollment_id,
        qa.started_at,
        qa.completed_at,
        qa.score,
        qa.percentage,
        qa.is_passed,
        ce.title as evaluation_title,
        c.title as course_title
      FROM quiz_attempts qa
      INNER JOIN course_evaluations ce ON qa.course_evaluation_id = ce.id
      INNER JOIN courses c ON ce.course_id = c.id
      WHERE qa.user_id = ? AND qa.course_evaluation_id IS NOT NULL
      ORDER BY qa.started_at DESC
    `;

    const [attempts] = await pool.execute(attemptsQuery, [userId]);

    console.log(`\n📝 TENTATIVES D'ÉVALUATIONS (${attempts.length}):\n`);
    
    if (attempts.length === 0) {
      console.log('   Aucune tentative trouvée.\n');
    } else {
      attempts.forEach((attempt, index) => {
        console.log(`${index + 1}. Tentative ID: ${attempt.id}`);
        console.log(`   Évaluation: ${attempt.evaluation_title}`);
        console.log(`   Cours: ${attempt.course_title}`);
        console.log(`   Enrollment ID: ${attempt.enrollment_id}`);
        console.log(`   Démarrée: ${new Date(attempt.started_at).toLocaleString('fr-FR')}`);
        if (attempt.completed_at) {
          console.log(`   ✅ Complétée: ${new Date(attempt.completed_at).toLocaleString('fr-FR')}`);
          console.log(`   Score: ${attempt.score || 'N/A'}`);
          console.log(`   Pourcentage: ${attempt.percentage || 'N/A'}%`);
          console.log(`   Réussie: ${attempt.is_passed ? 'Oui' : 'Non'}`);
        } else {
          console.log(`   ⏳ En cours (non complétée)`);
        }
        console.log('');
      });
    }

    // 4. Récupérer les quiz de modules
    const moduleQuizzesQuery = `
      SELECT 
        mq.id,
        mq.title,
        mq.description,
        mq.passing_score,
        mq.time_limit_minutes,
        mq.max_attempts,
        m.id as module_id,
        m.title as module_title,
        c.id as course_id,
        c.title as course_title,
        e.id as enrollment_id,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as best_score,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN qa.id END) as attempts_count
      FROM module_quizzes mq
      INNER JOIN modules m ON mq.module_id = m.id
      INNER JOIN courses c ON m.course_id = c.id
      INNER JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.is_active = TRUE
      LEFT JOIN quiz_attempts qa ON mq.id = qa.module_quiz_id AND qa.user_id = ?
      WHERE mq.is_published = TRUE
      GROUP BY mq.id, m.id, c.id, e.id
      ORDER BY m.order_index ASC, mq.created_at DESC
    `;

    const [moduleQuizzes] = await pool.execute(moduleQuizzesQuery, [userId, userId]);

    console.log(`\n📝 QUIZ DE MODULES (${moduleQuizzes.length}):\n`);
    
    if (moduleQuizzes.length === 0) {
      console.log('   Aucun quiz de module trouvé.\n');
    } else {
      moduleQuizzes.forEach((quiz, index) => {
        console.log(`${index + 1}. ${quiz.title}`);
        console.log(`   Module: ${quiz.module_title} (ID: ${quiz.module_id})`);
        console.log(`   Cours: ${quiz.course_title} (ID: ${quiz.course_id})`);
        console.log(`   Enrollment ID: ${quiz.enrollment_id}`);
        console.log(`   Score minimum: ${quiz.passing_score}%`);
        console.log(`   Tentatives max: ${quiz.max_attempts || 'Illimité'}`);
        console.log(`   Tentatives complétées: ${quiz.attempts_count || 0}`);
        console.log(`   Meilleur score: ${quiz.best_score ? quiz.best_score + '%' : 'N/A'}`);
        console.log('');
      });
    }

    // 5. Récupérer les tentatives de quiz de modules
    const moduleQuizAttemptsQuery = `
      SELECT 
        qa.id,
        qa.module_quiz_id,
        qa.enrollment_id,
        qa.started_at,
        qa.completed_at,
        qa.score,
        qa.percentage,
        qa.is_passed,
        mq.title as quiz_title,
        m.title as module_title,
        c.title as course_title
      FROM quiz_attempts qa
      INNER JOIN module_quizzes mq ON qa.module_quiz_id = mq.id
      INNER JOIN modules m ON mq.module_id = m.id
      INNER JOIN courses c ON m.course_id = c.id
      WHERE qa.user_id = ? AND qa.module_quiz_id IS NOT NULL
      ORDER BY qa.started_at DESC
    `;

    const [moduleQuizAttempts] = await pool.execute(moduleQuizAttemptsQuery, [userId]);

    console.log(`\n📝 TENTATIVES DE QUIZ DE MODULES (${moduleQuizAttempts.length}):\n`);
    
    if (moduleQuizAttempts.length === 0) {
      console.log('   Aucune tentative de quiz de module trouvée.\n');
    } else {
      moduleQuizAttempts.forEach((attempt, index) => {
        console.log(`${index + 1}. Tentative ID: ${attempt.id}`);
        console.log(`   Quiz: ${attempt.quiz_title}`);
        console.log(`   Module: ${attempt.module_title}`);
        console.log(`   Cours: ${attempt.course_title}`);
        console.log(`   Enrollment ID: ${attempt.enrollment_id}`);
        console.log(`   Démarrée: ${new Date(attempt.started_at).toLocaleString('fr-FR')}`);
        if (attempt.completed_at) {
          console.log(`   ✅ Complétée: ${new Date(attempt.completed_at).toLocaleString('fr-FR')}`);
          console.log(`   Score: ${attempt.score || 'N/A'}`);
          console.log(`   Pourcentage: ${attempt.percentage || 'N/A'}%`);
          console.log(`   Réussie: ${attempt.is_passed ? 'Oui' : 'Non'}`);
        } else {
          console.log(`   ⏳ En cours (non complétée)`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await pool.end();
  }
}

getUserEvaluations();

